import { BUCKET_NAME, s3Client, isS3Available } from '@/lib/s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    if (!isS3Available()) {
        return NextResponse.json({ success: false, error: 'S3 service not available' }, { status: 503 });
    }

    try {
        const { key, expirySeconds = 24 * 60 * 60 } = await request.json();

        if (!key) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'File key is required'
                },
                { status: 400 }
            );
        }

        const url = await s3Client.presignedUrl('GET', BUCKET_NAME, key, expirySeconds);

        return NextResponse.json({
            success: true,
            url: url,
            key: key,
            expiresIn: expirySeconds
        });
    } catch (error: any) {
        console.error('Presigned URL Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to generate presigned URL'
            },
            { status: 500 }
        );
    }
}

// Batch generate presigned URLs
export async function PUT(request: NextRequest) {
    if (!isS3Available()) {
        return NextResponse.json({ success: false, error: 'S3 service not available' }, { status: 503 });
    }

    try {
        const { keys, expirySeconds = 24 * 60 * 60 } = await request.json();

        if (!keys || !Array.isArray(keys)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'File keys array is required'
                },
                { status: 400 }
            );
        }

        const results = await Promise.allSettled(
            keys.map(async (key: string) => {
                const url = await s3Client.presignedUrl('GET', BUCKET_NAME, key, expirySeconds);
                return { key, url };
            })
        );

        const urls = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return { key: keys[index], url: null, error: result.reason?.message };
            }
        });

        return NextResponse.json({
            success: true,
            urls: urls,
            expiresIn: expirySeconds
        });
    } catch (error: any) {
        console.error('Batch Presigned URL Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to generate presigned URLs'
            },
            { status: 500 }
        );
    }
}
