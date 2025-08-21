#!/usr/bin/env node

/**
 * Worker process để chạy tất cả các workers cho queue system
 * Chạy file này để start workers: `node workers/index.js`
 */

import 'dotenv/config';

import '@/workers/ipa-process-worker';
import '@/workers/cleanup-worker';
import { scheduleExpiredAppsCleanup } from '@/workers/cleanup-worker';
import { checkRedisConnection, closeRedisConnection } from '@/lib/redis';

console.log('🚀 Starting IPA Installer Workers...');

// Kiểm tra kết nối Redis
async function initializeWorkers() {
    try {
        const redisConnected = await checkRedisConnection();

        if (!redisConnected) {
            console.error('❌ Failed to connect to Redis. Exiting...');
            process.exit(1);
        }

        console.log('✅ Workers initialized successfully');
        console.log('📋 Active workers:');
        console.log('  - IPA Process Worker (processing .ipa files)');
        console.log('  - Cleanup Worker (removing expired builds)');

        // Schedule periodic cleanup của expired builds
        schedulePeriodicCleanup();
    } catch (error) {
        console.error('❌ Error initializing workers:', error);
        process.exit(1);
    }
}

// Schedule cleanup job mỗi giờ
function schedulePeriodicCleanup() {
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 giờ

    setInterval(async () => {
        try {
            console.log('⏰ Running periodic cleanup check...');
            const cleanedCount = await scheduleExpiredAppsCleanup();
            console.log(`🧹 Scheduled cleanup for ${cleanedCount} expired builds`);
        } catch (error) {
            console.error('❌ Error during periodic cleanup:', error);
        }
    }, CLEANUP_INTERVAL);

    // Chạy cleanup lần đầu sau 1 phút
    setTimeout(async () => {
        try {
            console.log('🧹 Running initial cleanup check...');
            const cleanedCount = await scheduleExpiredAppsCleanup();
            console.log(`🗑️ Scheduled cleanup for ${cleanedCount} expired builds`);
        } catch (error) {
            console.error('❌ Error during initial cleanup:', error);
        }
    }, 60 * 1000);
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down workers...');

    try {
        await closeRedisConnection();
        console.log('✅ Workers shut down gracefully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down workers...');

    try {
        await closeRedisConnection();
        console.log('✅ Workers shut down gracefully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start workers
initializeWorkers();
