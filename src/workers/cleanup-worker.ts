import { prisma } from '@/lib/prisma';
import { redisConnection } from '@/lib/redis';
import { S3ServiceWorker } from '@/lib/s3';
import { UrlUtils } from '@/lib/utils';
import { QUEUE_NAMES } from '@/types/queue';
import { Job, Worker } from 'bullmq';
import { config } from 'dotenv';
import { resolve } from 'path';

// // Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const s3Service = new S3ServiceWorker();

interface CleanupJobData {
    appId: string;
    force?: boolean; // Force delete even if not expired
}

// Worker cho cleanup (xóa file hết hạn)
export const cleanupWorker = new Worker(
    QUEUE_NAMES.CLEANUP,
    async (job: Job<CleanupJobData>) => {
        const { appId, force = false } = job.data;

        console.log(`🧹 Processing cleanup job ${job.id} for app ${appId}`);

        try {
            // Lấy thông tin app từ database
            const app = await prisma.app.findUnique({
                where: { appId: appId }
            });

            if (!app) {
                console.log(`⚠️ App ${appId} not found, skipping cleanup`);
                return { success: true, message: 'App not found' };
            }

            // Kiểm tra xem app có hết hạn chưa (hoặc force delete)
            const now = new Date();
            const isExpired = app.expiresAt && app.expiresAt < now;

            if (!force && !isExpired) {
                console.log(`⏳ App ${appId} not yet expired, skipping cleanup`);
                return { success: true, message: 'App not expired' };
            }

            console.log(`🗑️ Deleting expired app ${appId}`);

            // Generate S3 keys using UrlUtils
            const s3Keys = UrlUtils.getS3Keys(appId, app.originalFilename);

            // Xóa files từ S3/MinIO
            const deletePromises: Promise<any>[] = [
                s3Service.deleteFile(s3Keys.ipaKey).catch((err) => console.warn(`Failed to delete IPA file: ${err.message}`)),
                s3Service.deleteFile(s3Keys.plistKey).catch((err) => console.warn(`Failed to delete plist file: ${err.message}`))
            ];

            // Xóa icon nếu có
            if (app.hasIcon) {
                deletePromises.push(s3Service.deleteFile(s3Keys.iconKey).catch((err) => console.warn(`Failed to delete icon file: ${err.message}`)));
            }

            // Đợi tất cả file được xóa
            await Promise.allSettled(deletePromises);

            // Xóa record khỏi database
            await prisma.app.delete({
                where: { appId: appId }
            });

            console.log(`✅ Successfully cleaned up app ${appId}`);

            return {
                success: true,
                message: 'App cleaned up successfully',
                appId,
                filesDeleted: deletePromises.length
            };
        } catch (error) {
            console.error(`❌ Error during cleanup for app ${appId}:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 1 // Chỉ chạy 1 cleanup job tại một thời điểm
    }
);

// Function để schedule cleanup jobs cho tất cả apps hết hạn
export async function scheduleExpiredAppsCleanup() {
    try {
        const now = new Date();

        // Tìm tất cả apps đã hết hạn
        const expiredApps = await prisma.app.findMany({
            where: {
                expiresAt: {
                    lt: now
                },
                status: {
                    not: 'failed' // Không cleanup apps đã failed
                }
            },
            select: {
                id: true,
                appId: true,
                appName: true,
                expiresAt: true
            }
        });

        console.log(`🔍 Found ${expiredApps.length} expired apps to cleanup`);

        // Thêm cleanup jobs cho từng app hết hạn
        const { cleanupQueue } = await import('@/lib/queue');
        for (const app of expiredApps) {
            await cleanupQueue.add(
                'cleanup-expired',
                { appId: app.appId },
                {
                    priority: 10, // Priority cao cho cleanup
                    delay: Math.random() * 10000 // Random delay để tránh tải đồng loạt
                }
            );

            console.log(`📋 Scheduled cleanup for app ${app.appId} (${app.appName})`);
        }

        return expiredApps.length;
    } catch (error) {
        console.error('❌ Error scheduling expired apps cleanup:', error);
        throw error;
    }
}

// Event listeners
cleanupWorker.on('completed', (job) => {
    console.log(`✅ Cleanup job ${job.id} completed successfully`);
});

cleanupWorker.on('failed', (job, err) => {
    console.error(`❌ Cleanup job ${job?.id} failed:`, err);
});

cleanupWorker.on('error', (err) => {
    console.error('❌ Cleanup worker error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down cleanup worker...');
    await cleanupWorker.close();
    await prisma.$disconnect();
    process.exit(0);
});

export default cleanupWorker;
