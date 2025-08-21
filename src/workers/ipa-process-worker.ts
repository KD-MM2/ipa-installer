import { Worker, Job } from 'bullmq';
import fs from 'fs';
import { PrismaClient } from '@/../prisma/prisma';
import { redisConnection } from '@/lib/redis';
import { IpaProcessJobData, QUEUE_NAMES, JobProgress } from '@/types/queue';
import { extractIpaMetadata, optimizeIcon, generatePlistContent, validateIpaFile } from '@/lib/ipa-utils';
import { S3ServiceWorker } from '@/lib/S3ServiceWorker';
import { UrlUtils } from '@/lib/url-utils';
import { convertCgbiToStandardPng } from '@/lib/cgbi2png';

const prisma = new PrismaClient();
const s3Service = new S3ServiceWorker();

// Worker cho xử lý IPA
export const ipaProcessWorker = new Worker(
    QUEUE_NAMES.IPA_PROCESS,
    async (job: Job<IpaProcessJobData>) => {
        const { appId, filePath, originalFilename, fileSize } = job.data;

        console.log(`🔄 Processing IPA job ${job.id} for app ${appId}`);

        try {
            // Bước 1: Validate file
            await updateProgress(job, 'Validating file...', 10);

            if (!validateIpaFile(filePath)) {
                throw new Error('Invalid IPA file');
            }

            // Bước 2: Extract metadata và icon
            await updateProgress(job, 'Extracting metadata...', 30);

            const processedData = await extractIpaMetadata(filePath);
            const { metadata, iconBuffer } = processedData;

            await updateProgress(job, 'Metadata extraction completed', 40);

            /// Bước 3: Tối ưu icon nếu có
            let optimizedIconBuffer: Buffer | undefined;
            if (iconBuffer) {
                await updateProgress(job, 'Converting icon to standard PNG...', 45);
                const convertedIcon = convertCgbiToStandardPng(iconBuffer);
                await updateProgress(job, 'Optimizing icon...', 50);
                optimizedIconBuffer = await optimizeIcon(convertedIcon);
                await updateProgress(job, 'Icon optimization completed', 55);
            }

            // Bước 4: Upload files lên S3
            await updateProgress(job, 'Uploading files to storage...', 60);

            // Generate S3 keys using UrlUtils
            const s3Keys = UrlUtils.getS3Keys(appId, originalFilename);

            // Upload IPA file
            await s3Service.uploadFile(fs.createReadStream(filePath), s3Keys.ipaKey, {
                ContentType: 'application/octet-stream',
                ContentDisposition: `attachment; filename="${originalFilename}"`
            });

            await updateProgress(job, 'IPA file uploaded', 70);

            // Upload icon nếu có
            let hasIcon = false;
            if (optimizedIconBuffer) {
                await updateProgress(job, 'Uploading icon...', 75);
                await s3Service.uploadBuffer(optimizedIconBuffer, s3Keys.iconKey, {
                    ContentType: 'image/png'
                });
                hasIcon = true;
            }

            // Sinh và upload plist file
            await updateProgress(job, 'Generating plist file...', 80);

            // Generate URLs for plist content
            const urls = UrlUtils.getAllUrls(appId, originalFilename, hasIcon);
            const plistContent = generatePlistContent(metadata, urls.ipaUrl, urls.iconUrl || undefined);
            await s3Service.uploadBuffer(Buffer.from(plistContent), s3Keys.plistKey, {
                ContentType: 'application/xml'
            });

            await updateProgress(job, 'All files uploaded', 85);

            // Bước 5: Lưu vào database
            await updateProgress(job, 'Saving to database...', 90);

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Hết hạn sau 7 ngày

            await prisma.app.create({
                data: {
                    appId: appId,
                    appName: metadata.appName,
                    bundleId: metadata.bundleId,
                    version: metadata.version,
                    buildNumber: metadata.buildNumber,
                    minimumOSVersion: metadata.minimumOSVersion,
                    displayName: metadata.displayName,
                    originalFilename,
                    fileSize: BigInt(fileSize),
                    hasIcon,
                    status: 'active',
                    maxDownloads: 100, // Mặc định 100 lượt tải
                    downloadCount: 0,
                    expiresAt
                }
            });

            // Bước 6: Dọn dẹp file tạm
            await updateProgress(job, 'Cleaning up...', 95);

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupError) {
                console.warn('Warning: Failed to cleanup temp file:', cleanupError);
            }

            await updateProgress(job, 'Completed', 100);

            console.log(`✅ Successfully processed IPA for app ${appId}`);

            return {
                appId,
                metadata,
                urls: UrlUtils.getAllUrls(appId, originalFilename, hasIcon)
            };
        } catch (error) {
            console.error(`❌ Error processing IPA for app ${appId}:`, error);

            // Cleanup on error
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupError) {
                console.warn('Warning: Failed to cleanup temp file on error:', cleanupError);
            }

            // Update database status to failed
            try {
                await prisma.app.upsert({
                    where: { appId: appId },
                    create: {
                        appId: appId,
                        appName: 'Unknown App',
                        bundleId: '',
                        version: '1.0',
                        buildNumber: '1',
                        originalFilename,
                        fileSize: BigInt(fileSize),
                        hasIcon: false,
                        status: 'failed',
                        maxDownloads: 0,
                        downloadCount: 0,
                        expiresAt: new Date()
                    },
                    update: {
                        status: 'failed'
                    }
                });
            } catch (dbError) {
                console.error('Failed to update database on error:', dbError);
            }

            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 2, // Xử lý tối đa 2 job cùng lúc
        stalledInterval: 5 * 60 * 1000, // 5 phút - thời gian cho phép job chạy trước khi bị coi là stalled
        maxStalledCount: 1 // Số lần tối đa job được retry khi bị stalled
    }
);

// Helper function để update progress
async function updateProgress(job: Job, message: string, percentage: number) {
    const progress: JobProgress = {
        step: message,
        percentage,
        message
    };

    await job.updateProgress(progress);
    console.log(`📈 Job ${job.id}: ${message} (${percentage}%)`);
}

// Event listeners
ipaProcessWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

ipaProcessWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err);
});

ipaProcessWorker.on('error', (err) => {
    console.error('❌ Worker error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down IPA process worker...');
    await ipaProcessWorker.close();
    await prisma.$disconnect();
    process.exit(0);
});

export default ipaProcessWorker;
