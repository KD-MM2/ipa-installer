import { Worker, Job } from 'bullmq';
import { PrismaClient } from '../../prisma/prisma';
import { redisConnection } from '../lib/redis';
import { QUEUE_NAMES } from '../types/queue';
import { S3ServiceWorker } from '../lib/S3ServiceWorker';
import { UrlUtils } from '../lib/url-utils';

const prisma = new PrismaClient();
const s3Service = new S3ServiceWorker();

interface CleanupJobData {
    buildId: string;
    force?: boolean; // Force delete even if not expired
}

// Worker cho cleanup (xóa file hết hạn)
export const cleanupWorker = new Worker(
    QUEUE_NAMES.CLEANUP,
    async (job: Job<CleanupJobData>) => {
        const { buildId, force = false } = job.data;

        console.log(`🧹 Processing cleanup job ${job.id} for build ${buildId}`);

        try {
            // Lấy thông tin build từ database
            const build = await prisma.build.findUnique({
                where: { buildId: buildId }
            });

            if (!build) {
                console.log(`⚠️ Build ${buildId} not found, skipping cleanup`);
                return { success: true, message: 'Build not found' };
            }

            // Kiểm tra xem build có hết hạn chưa (hoặc force delete)
            const now = new Date();
            const isExpired = build.expiresAt && build.expiresAt < now;

            if (!force && !isExpired) {
                console.log(`⏳ Build ${buildId} not yet expired, skipping cleanup`);
                return { success: true, message: 'Build not expired' };
            }

            console.log(`🗑️ Deleting expired build ${buildId}`);

            // Generate S3 keys using UrlUtils
            const s3Keys = UrlUtils.getS3Keys(buildId, build.originalFilename);

            // Xóa files từ S3/MinIO
            const deletePromises: Promise<any>[] = [
                s3Service.deleteFile(s3Keys.ipaKey).catch((err) => console.warn(`Failed to delete IPA file: ${err.message}`)),
                s3Service.deleteFile(s3Keys.plistKey).catch((err) => console.warn(`Failed to delete plist file: ${err.message}`))
            ];

            // Xóa icon nếu có
            if (build.hasIcon) {
                deletePromises.push(s3Service.deleteFile(s3Keys.iconKey).catch((err) => console.warn(`Failed to delete icon file: ${err.message}`)));
            }

            // Đợi tất cả file được xóa
            await Promise.allSettled(deletePromises);

            // Xóa record khỏi database
            await prisma.build.delete({
                where: { buildId: buildId }
            });

            console.log(`✅ Successfully cleaned up build ${buildId}`);

            return {
                success: true,
                message: 'Build cleaned up successfully',
                buildId,
                filesDeleted: deletePromises.length
            };
        } catch (error) {
            console.error(`❌ Error during cleanup for build ${buildId}:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 1 // Chỉ chạy 1 cleanup job tại một thời điểm
    }
);

// Function để schedule cleanup jobs cho tất cả builds hết hạn
export async function scheduleExpiredBuildsCleanup() {
    try {
        const now = new Date();

        // Tìm tất cả builds đã hết hạn
        const expiredBuilds = await prisma.build.findMany({
            where: {
                expiresAt: {
                    lt: now
                },
                status: {
                    not: 'failed' // Không cleanup builds đã failed
                }
            },
            select: {
                id: true,
                buildId: true,
                appName: true,
                expiresAt: true
            }
        });

        console.log(`🔍 Found ${expiredBuilds.length} expired builds to cleanup`);

        // Thêm cleanup jobs cho từng build hết hạn
        const { cleanupQueue } = await import('../lib/queue');

        for (const build of expiredBuilds) {
            await cleanupQueue.add(
                'cleanup-expired',
                { buildId: build.buildId },
                {
                    priority: 10, // Priority cao cho cleanup
                    delay: Math.random() * 10000 // Random delay để tránh tải đồng loạt
                }
            );

            console.log(`📋 Scheduled cleanup for build ${build.buildId} (${build.appName})`);
        }

        return expiredBuilds.length;
    } catch (error) {
        console.error('❌ Error scheduling expired builds cleanup:', error);
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
