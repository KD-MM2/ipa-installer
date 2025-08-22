import { BUCKET_NAME, isS3Available, s3Client } from '@/lib/s3';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
    const params = await props.params;

    if (!isS3Available()) {
        return NextResponse.json({ error: 'S3 service not available' }, { status: 503 });
    }

    try {
        const objectKey = params.path.join('/');

        let objectStat;
        try {
            objectStat = await s3Client.statObject(BUCKET_NAME, objectKey);
        } catch (error) {
            console.error('Object not found:', error);
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const objectStream = await s3Client.getObject(BUCKET_NAME, objectKey);

        // Get filename from path
        const filename = params.path[params.path.length - 1];

        // Determine content type and disposition based on file extension
        let contentType = objectStat.metaData?.['X-Amz-Meta-Contenttype'] || 'application/octet-stream';
        let contentDisposition = 'attachment';

        if (filename.toLowerCase().endsWith('.ipa')) {
            contentType = 'application/octet-stream';
            contentDisposition = `attachment; filename="${filename}"`;
        } else if (filename.toLowerCase().endsWith('.plist')) {
            contentType = 'text/xml';
            contentDisposition = 'inline'; // plist files should be inline for iOS installation
        }

        let webStream: ReadableStream<Uint8Array>;
        if (typeof (objectStream as any).toWeb === 'function') {
            webStream = (objectStream as any).toWeb();
        } else {
            const chunks: Uint8Array[] = [];
            for await (const chunk of objectStream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': contentDisposition,
                    'Cache-Control': 'public, max-age=31536000',
                    ETag: objectStat.etag || '',
                    'Last-Modified': objectStat.lastModified?.toUTCString() || ''
                }
            });
        }

        return new NextResponse(webStream, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': contentDisposition,
                'Cache-Control': 'public, max-age=31536000',
                ETag: objectStat.etag || '',
                'Last-Modified': objectStat.lastModified?.toUTCString() || ''
            }
        });
    } catch (error: any) {
        console.error('File proxy error:', error);
        return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
    }
}
