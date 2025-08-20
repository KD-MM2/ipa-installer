import { BUCKET_NAME, s3Client, isS3Available } from '@/lib/s3';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    if (!isS3Available()) {
        return NextResponse.json(
            { success: false, error: 'S3 service not available' },
            { status: 503 }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folder = (formData.get('folder') as string) || 'uploads';

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        // Validate file size (max 100MB for IPA files, 5MB for icons)
        const maxSize = folder === 'ipa' ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
            const maxSizeText = folder === 'ipa' ? '100MB' : '5MB';
            return NextResponse.json({ 
                success: false, 
                error: `File size too large (max ${maxSizeText})` 
            }, { status: 400 });
        }

        // Validate file type based on folder
        let allowedTypes: string[] = [];
        if (folder === 'ipa') {
            allowedTypes = ['application/octet-stream'];
            if (!file.name.toLowerCase().endsWith('.ipa')) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'File must be an IPA file' 
                }, { status: 400 });
            }
        } else if (folder === 'icons') {
            allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        } else if (folder === 'plists') {
            allowedTypes = ['application/xml', 'text/xml', 'text/plain'];
            if (!file.name.toLowerCase().endsWith('.plist')) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'File must be a plist file' 
                }, { status: 400 });
            }
        } else {
            // General uploads
            allowedTypes = [
                'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf', 'application/zip', 'application/x-zip-compressed',
                'application/octet-stream', 'application/xml', 'text/xml', 'text/plain'
            ];
        }

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ 
                success: false, 
                error: 'File type not allowed' 
            }, { status: 400 });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2);
        const extension = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomString}.${extension}`;
        const objectKey = `${folder}/${fileName}`;

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Ensure bucket exists
        const bucketExists = await s3Client.bucketExists(BUCKET_NAME);
        if (!bucketExists) {
            await s3Client.makeBucket(BUCKET_NAME);
        }

        // Set content type based on file type
        let contentType = file.type;
        if (folder === 'ipa') {
            contentType = 'application/octet-stream';
        } else if (folder === 'plists') {
            contentType = 'application/xml';
        }

        // Upload to S3
        await s3Client.putObject(BUCKET_NAME, objectKey, buffer, buffer.length, {
            'Content-Type': contentType,
            'Cache-Control': 'max-age=31536000',
            'Content-Disposition': folder === 'ipa' ? `attachment; filename="${file.name}"` : 'inline'
        });

        return NextResponse.json({
            success: true,
            filename: fileName,
            originalName: file.name,
            size: file.size,
            type: file.type,
            key: objectKey
        });
    } catch (error: any) {
        console.error('S3 Upload Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Upload failed' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    if (!isS3Available()) {
        return NextResponse.json(
            { success: false, error: 'S3 service not available' },
            { status: 503 }
        );
    }

    try {
        const { objectKey } = await request.json();

        if (!objectKey) {
            return NextResponse.json({ 
                success: false, 
                error: 'Object key is required' 
            }, { status: 400 });
        }

        await s3Client.removeObject(BUCKET_NAME, objectKey);

        return NextResponse.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error: any) {
        console.error('S3 Delete Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Delete failed' },
            { status: 500 }
        );
    }
}

// Connection test endpoint
export async function GET() {
    if (!isS3Available()) {
        return NextResponse.json({
            success: false,
            message: 'S3 service not configured',
            buckets: []
        });
    }

    try {
        const buckets = await s3Client.listBuckets();
        return NextResponse.json({
            success: true,
            message: 'S3 connection successful',
            buckets: buckets.map((b) => b.name)
        });
    } catch (error: any) {
        console.error('S3 Connection Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Connection failed' },
            { status: 500 }
        );
    }
}
