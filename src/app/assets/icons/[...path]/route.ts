import { BUCKET_NAME, s3Client, isS3Available } from '@/lib/s3';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
    const params = await props.params;
    
    if (!isS3Available()) {
        return NextResponse.json(
            { error: 'S3 service not available' },
            { status: 503 }
        );
    }

    try {
        const objectKey = params.path.join('/');

        // Validate object exists
        let objectStat;
        try {
            objectStat = await s3Client.statObject(BUCKET_NAME, objectKey);
        } catch (error) {
            console.error('Object not found:', error);
            return NextResponse.json({ error: 'Icon not found' }, { status: 404 });
        }

        // Get object stream
        const objectStream = await s3Client.getObject(BUCKET_NAME, objectKey);

        // Convert to Web ReadableStream
        let webStream: ReadableStream<Uint8Array>;
        if (typeof (objectStream as any).toWeb === 'function') {
            webStream = (objectStream as any).toWeb();
        } else {
            // Fallback: buffer entire stream
            const chunks: Uint8Array[] = [];
            for await (const chunk of objectStream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    'Content-Type': objectStat.metaData?.['content-type'] || 'image/jpeg',
                    'Cache-Control': 'public, max-age=31536000',
                    ETag: objectStat.etag || '',
                    'Last-Modified': objectStat.lastModified?.toUTCString() || ''
                }
            });
        }

        return new NextResponse(webStream, {
            headers: {
                'Content-Type': objectStat.metaData?.['content-type'] || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000',
                ETag: objectStat.etag || '',
                'Last-Modified': objectStat.lastModified?.toUTCString() || ''
            }
        });
    } catch (error: any) {
        console.error('Icon proxy error:', error);
        return NextResponse.json({ error: 'Failed to load icon' }, { status: 500 });
    }
}
