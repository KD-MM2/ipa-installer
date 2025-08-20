import { Queue } from 'bullmq';
import { redisConnection } from '../redis';
import { IpaProcessJobData, QUEUE_NAMES } from '../../types/queue';

// Tạo queue cho xử lý IPA
export const ipaProcessQueue = new Queue(QUEUE_NAMES.IPA_PROCESS, {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 10, // Giữ lại 10 job thành công gần nhất
        removeOnFail: 50, // Giữ lại 50 job thất bại để debug
        attempts: 3, // Thử lại tối đa 3 lần
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    }
});

// Tạo queue cho cleanup (xóa file hết hạn)
export const cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 5000
        }
    }
});

// Function để thêm job xử lý IPA
export async function addIpaProcessJob(data: IpaProcessJobData) {
    try {
        const job = await ipaProcessQueue.add('process-ipa', data, {
            priority: 1 // Priority cao cho xử lý IPA
        });

        console.log(`📦 Added IPA process job: ${job.id} for build: ${data.buildId}`);
        return job;
    } catch (error) {
        console.error('❌ Error adding IPA process job:', error);
        throw error;
    }
}

// Function để thêm job cleanup
export async function addCleanupJob(buildId: string, delay?: number) {
    try {
        const job = await cleanupQueue.add(
            'cleanup-expired',
            { buildId },
            {
                delay: delay || 0, // Delay trong milliseconds
                priority: 5 // Priority thấp hơn
            }
        );

        console.log(`🧹 Added cleanup job: ${job.id} for build: ${buildId}`);
        return job;
    } catch (error) {
        console.error('❌ Error adding cleanup job:', error);
        throw error;
    }
}

// Function để lấy thông tin job
export async function getJobStatus(jobId: string, queueName: string) {
    try {
        const queue = queueName === QUEUE_NAMES.IPA_PROCESS ? ipaProcessQueue : cleanupQueue;
        const job = await queue.getJob(jobId);

        if (!job) {
            return null;
        }

        return {
            id: job.id,
            data: job.data,
            progress: job.progress,
            state: await job.getState(),
            failedReason: job.failedReason,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn
        };
    } catch (error) {
        console.error('❌ Error getting job status:', error);
        throw error;
    }
}

// Function để hủy job
export async function cancelJob(jobId: string, queueName: string) {
    try {
        const queue = queueName === QUEUE_NAMES.IPA_PROCESS ? ipaProcessQueue : cleanupQueue;
        const job = await queue.getJob(jobId);

        if (job) {
            await job.remove();
            console.log(`🚫 Cancelled job: ${jobId}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error cancelling job:', error);
        throw error;
    }
}

// Function để đóng tất cả queue connections
export async function closeQueues() {
    try {
        await Promise.all([ipaProcessQueue.close(), cleanupQueue.close()]);
        console.log('✅ All queues closed');
    } catch (error) {
        console.error('❌ Error closing queues:', error);
    }
}
