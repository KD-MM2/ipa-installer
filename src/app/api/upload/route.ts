import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { generateAppId } from '@/lib/ipa-utils';
import { addIpaProcessJob } from '@/lib/queue';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.ipa')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid file type. Only .ipa files are allowed.'
                },
                { status: 400 }
            );
        }

        // Validate file size (max 500MB)
        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
            return NextResponse.json({ success: false, error: 'File too large. Maximum size is 500MB.' }, { status: 400 });
        }

        // Generate unique app ID
        const appId = generateAppId();

        // Create temp directory if not exists
        const tempDir = path.join(process.cwd(), 'temp');
        if (!existsSync(tempDir)) {
            await mkdir(tempDir, { recursive: true });
        }

        // Save file temporarily
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const tempFilePath = path.join(tempDir, `${appId}_${file.name}`);

        await writeFile(tempFilePath, buffer);

        // Add job to queue
        const job = await addIpaProcessJob({
            appId,
            filePath: tempFilePath,
            originalFilename: file.name,
            fileSize: file.size,
            uploadedBy: request.headers.get('x-forwarded-for') || 'unknown'
        });

        return NextResponse.json({
            success: true,
            appId,
            jobId: job.id,
            message: 'File uploaded successfully. Processing started.',
            estimatedTime: '2-5 minutes'
        });
    } catch (error) {
        console.error('Error uploading IPA:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
