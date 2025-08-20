import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

export class S3ServiceWorker {
    private client: MinioClient;
    private bucketName: string;

    constructor() {
        this.client = new MinioClient({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || ''
        });

        this.bucketName = process.env.MINIO_BUCKET_NAME || 'ipa-builds';
    }

    async uploadFile(stream: Readable, key: string, metadata?: any): Promise<string> {
        try {
            // Ensure bucket exists
            const bucketExists = await this.client.bucketExists(this.bucketName);
            if (!bucketExists) {
                await this.client.makeBucket(this.bucketName);
            }

            await this.client.putObject(this.bucketName, key, stream, undefined, metadata);

            // Return the URL through Next.js proxy
            const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
            return `${appBaseUrl}/assets/files/${key}`;
        } catch (error) {
            console.error('Error uploading file to MinIO:', error);
            throw error;
        }
    }

    async uploadBuffer(buffer: Buffer, key: string, metadata?: any): Promise<string> {
        try {
            // Ensure bucket exists
            const bucketExists = await this.client.bucketExists(this.bucketName);
            if (!bucketExists) {
                await this.client.makeBucket(this.bucketName);
            }

            await this.client.putObject(this.bucketName, key, buffer, buffer.length, metadata);

            // Return the URL through Next.js proxy
            const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
            return `${appBaseUrl}/assets/files/${key}`;
        } catch (error) {
            console.error('Error uploading buffer to MinIO:', error);
            throw error;
        }
    }

    async deleteFile(key: string): Promise<void> {
        try {
            await this.client.removeObject(this.bucketName, key);
        } catch (error) {
            console.error('Error deleting file from MinIO:', error);
            throw error;
        }
    }

    async generatePresignedUrl(key: string, expirySeconds: number = 3600): Promise<string> {
        try {
            return await this.client.presignedGetObject(this.bucketName, key, expirySeconds);
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw error;
        }
    }
}
