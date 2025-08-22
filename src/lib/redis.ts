// import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from 'redis';

// // Load environment variables
config({ path: resolve(process.cwd(), '.env') });

// Cấu hình Redis connection
const redisConfig = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // Cấu hình bổ sung
    socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 500)
    },
    lazyConnect: true
};

// Tạo Redis client cho BullMQ
const globalForRedis = globalThis as unknown as { redisClient: ReturnType<typeof createClient> };
export const redisClient = globalForRedis.redisClient || createClient(redisConfig);
if (process.env.NODE_ENV !== 'production') globalForRedis.redisClient = redisClient;

// Export cấu hình để sử dụng trong BullMQ
export const redisConnection = {
    host: process.env.REDIS_HOST || process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
    port: parseInt(process.env.REDIS_PORT || process.env.REDIS_URL?.split(':')[2] || '6379'),
    db: parseInt(process.env.REDIS_DB || '0'),
    // Thêm password nếu có
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD })
};

// Kiểm tra kết nối Redis
export async function checkRedisConnection(): Promise<boolean> {
    try {
        await redisClient.connect();
        await redisClient.ping();
        console.log('✅ Redis connection successful');
        return true;
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        return false;
    }
}

// Graceful shutdown
export async function closeRedisConnection(): Promise<void> {
    try {
        await redisClient.quit();
        console.log('✅ Redis connection closed');
    } catch (error) {
        console.error('❌ Error closing Redis connection:', error);
    }
}
