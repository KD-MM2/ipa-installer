import { config } from 'dotenv';
import { Client as MinioClient } from 'minio';
import { resolve } from 'path';
import { Readable } from 'stream';

import { api } from './axios-client';

// // Load environment variables
config({ path: resolve(process.cwd(), '.env') });

// ====================
// TYPES AND INTERFACES
// ====================

export interface CommonS3Response {
    success: boolean;
    error?: string;
    message?: string;
}

export interface UploadResponse extends CommonS3Response {
    filename?: string;
    originalName?: string;
    size?: number;
    type?: string;
    key?: string; // S3 object key
}

export interface PresignedUrlResponse extends CommonS3Response {
    url?: string;
    key?: string;
    expiresIn?: number;
}

export interface ProcessedFiles {
    ipaKey: string;
    iconKey?: string;
    plistKey: string;
    fileSize: number;
}

export interface AppInfo {
    appName: string;
    bundleId: string;
    version: string;
    buildNumber: string;
    displayName?: string;
    minOSVersion?: string;
}

// ====================
// CONFIGURATION
// ====================

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'localhost';
const S3_PORT = parseInt(process.env.S3_PORT || '9000');
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin';
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ipa-installer';

// ====================
// S3 CLIENT PROXY
// ====================

let _s3Client: MinioClient | null = null;

const __s3Client = new Proxy({} as MinioClient, {
    get(target, prop) {
        // During build time, return mock functions
        if (process.env.NEXT_PHASE === 'phase-production-build') {
            if (typeof prop === 'string' && ['bucketExists', 'makeBucket', 'putObject', 'getObject', 'removeObject', 'listObjects', 'listBuckets', 'statObject', 'presignedUrl'].includes(prop)) {
                return async () => {
                    throw new Error('S3 operations not available during build');
                };
            }
        }

        // Initialize client on first use
        if (!_s3Client) {
            _s3Client = new MinioClient({
                endPoint: S3_ENDPOINT,
                port: S3_PORT,
                useSSL: S3_USE_SSL,
                accessKey: S3_ACCESS_KEY,
                secretKey: S3_SECRET_KEY
            });
        }

        return _s3Client[prop as keyof MinioClient];
    }
});

const globalForS3 = globalThis as unknown as { s3Client: MinioClient };
export const s3Client = globalForS3.s3Client || __s3Client;
if (process.env.NODE_ENV !== 'production') globalForS3.s3Client = s3Client;

// ====================
// UTILITY FUNCTIONS
// ====================

export const isS3Available = () => {
    return !!(S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY && process.env.NEXT_PHASE !== 'phase-production-build');
};

export const generateProxyUrl = (key: string, type: 'icon' | 'ipa' = 'icon'): string => {
    if (!key) return '';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const endpoint = type === 'icon' ? 'icons' : 'files';
    return `${baseUrl}/assets/${endpoint}/${key}`;
};

export const getFileKeyFromUrl = (url: string): string | null => {
    if (url.includes('/')) {
        const parts = url.split('/');
        return parts[parts.length - 1];
    }
    return url;
};

export const getFullKeyFromUrl = (url: string): string | null => {
    if (!url.includes('/assets/')) return url;

    const parts = url.split('/assets/');
    if (parts.length < 2) return url;

    const assetPath = parts[1];
    const pathParts = assetPath.split('/');
    if (pathParts.length < 2) return assetPath;

    return pathParts.slice(1).join('/');
};

export const isValidS3Key = (key: string): boolean => {
    return typeof key === 'string' && key.length > 0 && !key.includes('http') && !key.startsWith('/') && !key.endsWith('/');
};

// ====================
// BASE S3 SERVICE CLASS
// ====================

export abstract class BaseS3Service {
    protected client: MinioClient;
    protected bucketName: string;

    constructor() {
        this.client = new MinioClient({
            endPoint: S3_ENDPOINT,
            port: S3_PORT,
            useSSL: S3_USE_SSL,
            accessKey: S3_ACCESS_KEY,
            secretKey: S3_SECRET_KEY
        });

        this.bucketName = BUCKET_NAME;
    }

    /**
     * Ensure bucket exists
     */
    protected async ensureBucketExists(): Promise<void> {
        const bucketExists = await this.client.bucketExists(this.bucketName);
        if (!bucketExists) {
            await this.client.makeBucket(this.bucketName);
        }
    }

    /**
     * Upload file stream
     */
    async uploadFile(stream: Readable, key: string, metadata?: any): Promise<string> {
        try {
            await this.ensureBucketExists();
            await this.client.putObject(this.bucketName, key, stream, undefined, metadata);
            return generateProxyUrl(key, 'ipa');
        } catch (error) {
            console.error('Error uploading file to MinIO:', error);
            throw error;
        }
    }

    /**
     * Upload buffer
     */
    async uploadBuffer(buffer: Buffer, key: string, metadata?: any): Promise<string> {
        try {
            await this.ensureBucketExists();
            await this.client.putObject(this.bucketName, key, buffer, buffer.length, metadata);
            return generateProxyUrl(key, 'ipa');
        } catch (error) {
            console.error('Error uploading buffer to MinIO:', error);
            throw error;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(key: string): Promise<void> {
        try {
            await this.client.removeObject(this.bucketName, key);
        } catch (error) {
            console.error('Error deleting file from MinIO:', error);
            throw error;
        }
    }

    /**
     * Generate presigned URL
     */
    async generatePresignedUrl(key: string, expirySeconds: number = 3600): Promise<string> {
        try {
            return await this.client.presignedGetObject(this.bucketName, key, expirySeconds);
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            await this.client.statObject(this.bucketName, key);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(key: string) {
        try {
            return await this.client.statObject(this.bucketName, key);
        } catch (error) {
            console.error('Error getting file info:', error);
            throw error;
        }
    }
}

// ====================
// WORKER S3 SERVICE (Server-side processing)
// ====================

export class S3ServiceWorker extends BaseS3Service {
    constructor() {
        super();
    }

    /**
     * Upload processed IPA file to S3 (worker only)
     */
    async uploadProcessedIPA(buffer: Buffer, key: string): Promise<string> {
        return this.uploadBuffer(buffer, key, {
            'Content-Type': 'application/octet-stream'
        });
    }

    /**
     * Upload app icon to S3 (worker only)
     */
    async uploadIcon(iconBuffer: Buffer, key: string): Promise<string> {
        return this.uploadBuffer(iconBuffer, key, {
            'Content-Type': 'image/png'
        });
    }

    /**
     * Upload plist file to S3 (worker only)
     */
    async uploadPlist(plistContent: string, key: string): Promise<string> {
        const buffer = Buffer.from(plistContent, 'utf8');
        return this.uploadBuffer(buffer, key, {
            'Content-Type': 'application/xml'
        });
    }

    /**
     * Generate plist content for iOS installation
     */
    generatePlistContent(appInfo: AppInfo, ipaUrl: string, iconUrl?: string): string {
        const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>${ipaUrl}</string>
                </dict>
                ${
                    iconUrl
                        ? `
                <dict>
                    <key>kind</key>
                    <string>display-image</string>
                    <key>url</key>
                    <string>${iconUrl}</string>
                </dict>
                <dict>
                    <key>kind</key>
                    <string>full-size-image</string>
                    <key>url</key>
                    <string>${iconUrl}</string>
                </dict>`
                        : ''
                }
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>${appInfo.bundleId}</string>
                <key>bundle-version</key>
                <string>${appInfo.version}</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>${appInfo.appName}</string>
                ${
                    appInfo.minOSVersion
                        ? `
                <key>minimum-os-version</key>
                <string>${appInfo.minOSVersion}</string>`
                        : ''
                }
            </dict>
        </dict>
    </array>
</dict>
</plist>`;
        return plistXml;
    }

    /**
     * Delete app files from S3 (cleanup)
     */
    async deleteAppFiles(ipaKey: string, iconKey?: string, plistKey?: string): Promise<void> {
        const deletePromises: Promise<any>[] = [this.deleteFile(ipaKey)];

        if (iconKey) {
            deletePromises.push(this.deleteFile(iconKey));
        }

        if (plistKey) {
            deletePromises.push(this.deleteFile(plistKey));
        }

        try {
            await Promise.all(deletePromises);
        } catch (error) {
            console.error('Error deleting some app files:', error);
        }
    }
}

// ====================
// CLIENT S3 SERVICE (Frontend - chỉ upload temp file)
// ====================

export const S3Service = {
    // Connection test
    async testConnection(): Promise<{
        success: boolean;
        message: string;
        buckets?: string[];
    }> {
        try {
            const response = await api.get<{
                success: boolean;
                message: string;
                buckets?: string[];
            }>('/api/s3/upload');
            return response.data;
        } catch (error) {
            console.error('Error testing S3 connection:', error);
            return { success: false, message: 'Connection test failed' };
        }
    },

    // Upload IPA file to temp folder (frontend only)
    async uploadTempFile(file: File): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'temp');

        const response = await api.post<UploadResponse>('/api/upload/temp', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    // Generate presigned URL for asset access
    async generatePresignedUrl(key: string, expirySeconds: number = 24 * 60 * 60): Promise<string | null> {
        try {
            const result = await api.post<{ success: boolean; url: string }>('/api/s3/presigned', {
                key,
                expirySeconds
            });
            return result.data.success ? result.data.url : null;
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            return null;
        }
    },

    // Utility functions
    getFileKeyFromUrl,
    isValidS3Key,
    generateProxyUrl
};

// ====================
// DEFAULT EXPORTS
// ====================

export default S3Service;
