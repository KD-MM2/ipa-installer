import { BUCKET_NAME, isS3Available, s3Client } from '@/lib/s3';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to parse file size from env (e.g., "5120MB" -> bytes)
function parseFileSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)(B|KB|MB|GB)$/i);
    if (!match) {
        throw new Error(`Invalid file size format: ${sizeStr}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
        case 'B':
            return value;
        case 'KB':
            return value * 1024;
        case 'MB':
            return value * 1024 * 1024;
        case 'GB':
            return value * 1024 * 1024 * 1024;
        default:
            throw new Error(`Unsupported unit: ${unit}`);
    }
}

export async function POST(request: NextRequest) {
    if (!isS3Available()) {
        return NextResponse.json({ success: false, error: 'S3 service not available' }, { status: 503 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folder = (formData.get('folder') as string) || 'uploads';

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        // Get max file size from environment variable
        const maxFileSizeStr = process.env.MAX_FILE_SIZE || '2GB';
        const maxSize = parseFileSize(maxFileSizeStr);

        if (file.size > maxSize) {
            return NextResponse.json(
                {
                    success: false,
                    error: `File size too large (max ${maxFileSizeStr})`
                },
                { status: 400 }
            );
        }

        // Get allowed file types from environment variable
        const allowedFileTypesStr = process.env.ALLOWED_FILE_TYPES || '.ipa,.zip,.png,.jpg,.jpeg,.gif,.webp,.plist,.pdf';
        const allowedExtensions = allowedFileTypesStr.split(',').map((ext) => ext.trim().toLowerCase());

        // Check if file extension is allowed
        const fileExtension = '.' + file.name.toLowerCase().split('.').pop();
        if (!allowedExtensions.includes(fileExtension)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `File type not allowed. Allowed types: ${allowedFileTypesStr}`
                },
                { status: 400 }
            );
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

        // Set content type based on file extension
        let contentType = file.type;
        if (fileExtension === '.ipa') {
            contentType = 'application/octet-stream';
        } else if (fileExtension === '.plist') {
            contentType = 'application/xml';
        } else if (['.zip', '.rar', '.7z'].includes(fileExtension)) {
            contentType = 'application/octet-stream';
        }

        // Upload to S3
        await s3Client.putObject(BUCKET_NAME, objectKey, buffer, buffer.length, {
            'Content-Type': contentType,
            'Cache-Control': 'max-age=31536000',
            'Content-Disposition': fileExtension === '.ipa' ? `attachment; filename="${file.name}"` : 'inline'
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
        return NextResponse.json({ success: false, error: error.message || 'Upload failed' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!isS3Available()) {
        return NextResponse.json({ success: false, error: 'S3 service not available' }, { status: 503 });
    }

    try {
        const { objectKey } = await request.json();

        if (!objectKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Object key is required'
                },
                { status: 400 }
            );
        }

        await s3Client.removeObject(BUCKET_NAME, objectKey);

        return NextResponse.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error: any) {
        console.error('S3 Delete Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Delete failed' }, { status: 500 });
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
        return NextResponse.json({ success: false, error: error.message || 'Connection failed' }, { status: 500 });
    }
}
