// lib/S3Service.ts
import { api } from '@/lib/axios-client';
import { CommonS3Response, UploadResponse } from '@/lib/s3';

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

    // Upload file (IPA or icon)
    async uploadFile(file: File, folder: string = 'uploads'): Promise<UploadResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const response = await api.post<UploadResponse>('/api/s3/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    // Upload IPA file specifically
    async uploadIPA(file: File): Promise<UploadResponse> {
        return this.uploadFile(file, 'ipa');
    },

    // Upload app icon specifically
    async uploadIcon(file: File): Promise<UploadResponse> {
        return this.uploadFile(file, 'icons');
    },

    // Upload plist file specifically
    async uploadPlist(file: File): Promise<UploadResponse> {
        return this.uploadFile(file, 'plists');
    },

    // Delete file
    async deleteFile(objectKey: string): Promise<CommonS3Response> {
        const response = await api.delete<CommonS3Response>('/api/s3/upload', {
            data: { objectKey }
        });
        return response.data;
    },

    // Generate presigned URL
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

    // Generate multiple presigned URLs
    async generateMultiplePresignedUrls(keys: string[], expirySeconds: number = 24 * 60 * 60): Promise<{ [key: string]: string }> {
        try {
            if (keys.length === 0) return {};

            const result = await api.put<{
                success: boolean;
                urls: Array<{ key: string; url: string }>;
            }>('/api/s3/presigned', {
                keys,
                expirySeconds
            });
            if (result.data.success) {
                const urlMap: { [key: string]: string } = {};
                result.data.urls.forEach((item) => {
                    if (item.url) {
                        urlMap[item.key] = item.url;
                    }
                });
                return urlMap;
            }
            return {};
        } catch (error) {
            console.error('Error generating multiple presigned URLs:', error);
            return {};
        }
    },

    // Generate proxy URL (for local access through your app)
    generateProxyUrl(key: string, type: 'icon' | 'ipa' = 'icon'): string {
        if (!key) return '';

        let baseUrl: string;
        if (typeof window !== 'undefined') {
            baseUrl = window.location.origin;
        } else {
            baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
        }

        const endpoint = type === 'icon' ? 'icons' : 'files';
        return `${baseUrl}/assets/${endpoint}/${key}`;
    },

    // Generate icon proxy URL
    generateIconUrl(key: string): string {
        return this.generateProxyUrl(key, 'icon');
    },

    // Generate IPA download URL
    generateIPAUrl(key: string): string {
        return this.generateProxyUrl(key, 'ipa');
    },

    // Utility functions
    getFileKeyFromUrl(url: string): string | null {
        if (url.includes('/')) {
            const parts = url.split('/');
            return parts[parts.length - 1];
        }
        return url;
    },

    isValidS3Key(key: string): boolean {
        return typeof key === 'string' && key.length > 0 && !key.includes('http') && !key.startsWith('/') && !key.endsWith('/');
    },

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getFileExtension(filename: string): string {
        return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
    },

    isImageFile(filename: string): boolean {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        const extension = this.getFileExtension(filename).toLowerCase();
        return imageExtensions.includes(extension);
    },

    // Validate IPA file
    isValidIPA(file: File): boolean {
        return file.type === 'application/octet-stream' && file.name.toLowerCase().endsWith('.ipa');
    },

    // Validate icon file
    isValidIcon(file: File): boolean {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        return validTypes.includes(file.type);
    },

    // Get file type from name
    getFileType(filename: string): 'ipa' | 'icon' | 'plist' | 'other' {
        const extension = this.getFileExtension(filename).toLowerCase();

        if (extension === 'ipa') return 'ipa';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'icon';
        if (extension === 'plist') return 'plist';
        return 'other';
    }
};
