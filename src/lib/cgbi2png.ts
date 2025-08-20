/* 
  cgbi2png.ts
  Convert Apple CgBI PNG ("iPhone-optimized PNG") to standard PNG.

  What this does:
  - Parses PNG, detects and removes the CgBI chunk (present before IHDR).
  - Concatenates IDAT data and inflates using raw DEFLATE (inflateRaw).
  - For color type 6 (RGBA, 8-bit):
      * Reverse PNG scanline filters to reconstruct pixels
      * Convert BGRA -> RGBA
      * Unpremultiply alpha to straight alpha
      * Re-encode scanlines with filter 0
    For other color types:
      * Keep the filtered bytes unchanged (no per-pixel change)
  - Compress with standard zlib (deflate) and write a new single IDAT.
  - Preserve all other chunks, drop CgBI.
  - Recompute CRCs for all written chunks.

  References:
  - CgBI details (chunk position, raw deflate IDAT, BGRA, premultiplied alpha, conversion steps)
    The Apple Wiki: https://theapplewiki.com/wiki/PNG_CgBI_Format
  - PNG chunk + IDAT/zlib and filters: 
    libpng / PNG spec: https://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html
    W3C PNG chunks: https://www.w3.org/TR/PNG-Chunks.html
*/

// import * as fs from 'fs';
import * as zlib from 'zlib';

type Chunk = { type: string; data: Buffer };

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function findPngSignatureOffset(buf: Buffer): number {
    for (let i = 0; i <= buf.length - PNG_SIG.length; i++) {
        let match = true;
        for (let j = 0; j < PNG_SIG.length; j++) {
            if (buf[i + j] !== PNG_SIG[j]) {
                match = false;
                break;
            }
        }
        if (match) return i;
    }
    return -1;
}

function readUInt32BE(buf: Buffer, off: number): number {
    return buf.readUInt32BE(off);
}

function writeUInt32BE(n: number): Buffer {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
}

// CRC32 for PNG chunks
const CRC_TABLE = (() => {
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function parseChunks(buf: Buffer, startOff: number): Chunk[] {
    let off = startOff + PNG_SIG.length;
    const chunks: Chunk[] = [];
    while (off + 8 <= buf.length) {
        const len = readUInt32BE(buf, off);
        const type = buf.slice(off + 4, off + 8).toString('ascii');
        const dataStart = off + 8;
        const dataEnd = dataStart + len;
        const crcPos = dataEnd + 4;
        if (crcPos > buf.length) throw new Error('PNG truncated while reading chunk');
        const data = buf.slice(dataStart, dataEnd);
        // const crc = readUInt32BE(buf, dataEnd); // not validated here
        chunks.push({ type, data });
        off = crcPos;
        if (type === 'IEND') break;
    }
    return chunks;
}

function buildChunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = writeUInt32BE(data.length);
    const crcBuf = writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function bytesPerPixel(colorType: number, bitDepth: number): number {
    // colorType: 0=G, 2=RGB, 3=Indexed, 4=GA, 6=RGBA
    // This function only supports bitDepth=8 for per-pixel math.
    // For other bit depths, you’ll likely need bit packing/unpacking.
    switch (colorType) {
        case 0:
            return bitDepth === 8 ? 1 : Math.ceil(bitDepth / 8); // grayscale
        case 2:
            return bitDepth === 8 ? 3 : Math.ceil((3 * bitDepth) / 8);
        case 3:
            return 1; // indexed: 1 byte per sample after filtering (palette elsewhere)
        case 4:
            return bitDepth === 8 ? 2 : Math.ceil((2 * bitDepth) / 8);
        case 6:
            return bitDepth === 8 ? 4 : Math.ceil((4 * bitDepth) / 8);
        default:
            throw new Error('Unsupported color type');
    }
}

function unfilterScanlines(filtered: Buffer, width: number, height: number, bpp: number): Buffer {
    const stride = width * bpp;
    const result = Buffer.alloc(height * stride);
    let srcOff = 0;
    const priorRow = Buffer.alloc(stride, 0);

    for (let y = 0; y < height; y++) {
        const filterType = filtered[srcOff++];
        const row = filtered.subarray(srcOff, srcOff + stride);
        srcOff += stride;

        const outOff = y * stride;
        switch (filterType) {
            case 0: // None
                row.copy(result, outOff);
                break;

            case 1: // Sub
                for (let x = 0; x < stride; x++) {
                    const left = x >= bpp ? result[outOff + x - bpp] : 0;
                    result[outOff + x] = (row[x] + left) & 0xff;
                }
                break;

            case 2: // Up
                for (let x = 0; x < stride; x++) {
                    const up = priorRow[x];
                    result[outOff + x] = (row[x] + up) & 0xff;
                }
                break;

            case 3: // Average
                for (let x = 0; x < stride; x++) {
                    const left = x >= bpp ? result[outOff + x - bpp] : 0;
                    const up = priorRow[x];
                    const avg = Math.floor((left + up) / 2);
                    result[outOff + x] = (row[x] + avg) & 0xff;
                }
                break;

            case 4: // Paeth
                for (let x = 0; x < stride; x++) {
                    const a = x >= bpp ? result[outOff + x - bpp] : 0; // left
                    const b = priorRow[x]; // up
                    const c = x >= bpp ? priorRow[x - bpp] : 0; // up-left
                    const p = a + b - c;
                    const pa = Math.abs(p - a);
                    const pb = Math.abs(p - b);
                    const pc = Math.abs(p - c);
                    let pr: number;
                    if (pa <= pb && pa <= pc) pr = a;
                    else if (pb <= pc) pr = b;
                    else pr = c;
                    result[outOff + x] = (row[x] + pr) & 0xff;
                }
                break;

            default:
                throw new Error(`Unsupported PNG filter type ${filterType}`);
        }
        // save current row as priorRow for next iteration
        result.subarray(outOff, outOff + stride).copy(priorRow, 0);
    }
    return result;
}

function filterNone(pixels: Buffer, width: number, height: number, bpp: number): Buffer {
    const stride = width * bpp;
    const out = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
        const rowStart = y * (stride + 1);
        out[rowStart] = 0; // filter type 0
        pixels.copy(out, rowStart + 1, y * stride, y * stride + stride);
    }
    return out;
}

function unpremultiplyRGBA(pixels: Buffer): void {
    // pixels: RGBA straight memory with premultiplied channels (r,g,b premultiplied by a)
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        if (a === 0) {
            // result should be 0 for RGB if alpha is 0
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
        } else if (a < 255) {
            // reverse premultiplication: color' = round(color * 255 / alpha)
            pixels[i] = Math.min(255, Math.round((r * 255) / a));
            pixels[i + 1] = Math.min(255, Math.round((g * 255) / a));
            pixels[i + 2] = Math.min(255, Math.round((b * 255) / a));
        }
    }
}

function convertCgbiToStandardPng(input: Buffer): Buffer {
    // Locate PNG signature (some tools may prepend bytes)
    const sigOff = findPngSignatureOffset(input);
    if (sigOff < 0) throw new Error('PNG signature not found');
    const chunks = parseChunks(input, sigOff);

    const hasCgBI = chunks.length > 0 && chunks[0].type === 'CgBI';
    if (!hasCgBI) {
        throw new Error('No CgBI chunk found. This does not appear to be an iOS-optimized PNG.');
    }

    // IHDR
    const ihdr = chunks.find((c) => c.type === 'IHDR');
    if (!ihdr) throw new Error('IHDR not found');
    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    const bitDepth = ihdr.data.readUInt8(8);
    const colorType = ihdr.data.readUInt8(9);
    const compressionMethod = ihdr.data.readUInt8(10);
    const filterMethod = ihdr.data.readUInt8(11);
    const interlaceMethod = ihdr.data.readUInt8(12);

    if (compressionMethod !== 0) throw new Error('Unsupported compression method');
    if (filterMethod !== 0) throw new Error('Unsupported filter method');
    if (interlaceMethod !== 0) {
        throw new Error('Interlaced PNGs are not supported by this converter');
    }

    // Concatenate IDAT
    const idatData = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
    if (idatData.length === 0) throw new Error('No IDAT data found');

    // Inflate: try raw (CgBI uses raw deflate), fallback to zlib
    let inflated: Buffer;
    try {
        inflated = zlib.inflateRawSync(idatData);
    } catch {
        // fallback just in case (defensive)
        inflated = zlib.inflateSync(idatData);
    }

    const bpp = bytesPerPixel(colorType, bitDepth);
    const rowSize = width * bpp + 1; // +1 filter byte
    if (inflated.length !== rowSize * height) {
        throw new Error(`Inflated data size mismatch: expected ${rowSize * height}, got ${inflated.length}`);
    }

    let newFiltered: Buffer;

    if (colorType === 6 && bitDepth === 8) {
        // RGBA path: unfilter -> BGRA to RGBA -> unpremultiply -> refilter
        const unfiltered = unfilterScanlines(inflated, width, height, bpp);

        // Convert BGRA -> RGBA in-place into a new buffer
        const rgba = Buffer.from(unfiltered); // copy to mutate safely
        for (let i = 0; i < rgba.length; i += 4) {
            const b = rgba[i + 0];
            const g = rgba[i + 1];
            const r = rgba[i + 2];
            const a = rgba[i + 3];
            // rearrange to RGBA
            rgba[i + 0] = r;
            rgba[i + 1] = g;
            rgba[i + 2] = b;
            rgba[i + 3] = a;
        }

        // Unpremultiply alpha to produce straight-alpha RGBA
        unpremultiplyRGBA(rgba);

        // Re-filter using filter type 0 (None) for simplicity
        newFiltered = filterNone(rgba, width, height, 4);
    } else {
        // Other color types: do not change pixels. Just convert raw deflate -> zlib and drop CgBI.
        // Keep filtered bytes unchanged (inflated already contains filter bytes).
        newFiltered = inflated;
    }

    // Deflate with standard zlib headers (PNG requires zlib inside IDAT)
    const newIdatData = zlib.deflateSync(newFiltered);

    // Rebuild PNG: signature + all chunks except CgBI and old IDATs,
    // but insert one new IDAT where the first IDAT would be.
    const outParts: Buffer[] = [];
    outParts.push(PNG_SIG);

    let idatInserted = false;
    for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        if (c.type === 'CgBI') {
            // drop
            continue;
        }
        if (c.type === 'IDAT') {
            if (!idatInserted) {
                outParts.push(buildChunk('IDAT', newIdatData));
                idatInserted = true;
            }
            // skip all original IDATs
            continue;
        }
        outParts.push(buildChunk(c.type, c.data));
    }

    // If somehow there was no IDAT position (shouldn’t happen), append now before IEND.
    if (!idatInserted) {
        // insert before IEND
        const last = outParts.pop(); // IEND
        outParts.push(buildChunk('IDAT', newIdatData));
        if (last) outParts.push(last);
    }

    return Buffer.concat(outParts);
}

export { convertCgbiToStandardPng };

// function main() {
//   if (require.main === module) {
//     const [, , inPath, outPath] = process.argv;
//     if (!inPath || !outPath) {
//       console.error('Usage: ts-node cgbi2png.ts <input.png> <output.png>');
//       process.exit(1);
//     }
//     const input = fs.readFileSync(inPath);
//     const output = convertCgbiToStandardPng(input);
//     fs.writeFileSync(outPath, output);
//     console.log(`Wrote ${outPath}`);
//   }
// }

// main();
