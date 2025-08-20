// lib/s3.ts
import * as Minio from 'minio';

// S3 Configuration with build-time safety
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'localhost';
const S3_PORT = parseInt(process.env.S3_PORT || '9000');
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin';
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ipa-installer';

// Create a lazy-initialized S3 client
let _s3Client: Minio.Client | null = null;

export const s3Client = new Proxy({} as Minio.Client, {
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
            _s3Client = new Minio.Client({
                endPoint: S3_ENDPOINT,
                port: S3_PORT,
                useSSL: S3_USE_SSL,
                accessKey: S3_ACCESS_KEY,
                secretKey: S3_SECRET_KEY
            });
        }

        return _s3Client[prop as keyof Minio.Client];
    }
});

// Helper to check if S3 is available
export const isS3Available = () => {
    return !!(S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY && process.env.NEXT_PHASE !== 'phase-production-build');
};

// TypeScript Definitions for S3 responses
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

// Generate proxy URL
export const generateProxyUrl = (key: string, type: 'icon' | 'ipa' = 'icon'): string => {
    if (!key) return '';

    let baseUrl: string;
    if (typeof window !== 'undefined') {
        baseUrl = window.location.origin;
    } else {
        baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    }

    const endpoint = type === 'icon' ? 'icons' : 'files';
    return `${baseUrl}/assets/${endpoint}/${key}`;
};

// Helper functions
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

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
};

export const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const extension = getFileExtension(filename).toLowerCase();
    return imageExtensions.includes(extension);
};
