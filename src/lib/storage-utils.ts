// lib/storage-utils.ts
import { S3Service } from '@/lib/S3Service';

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

export class StorageUtils {
    /**
     * Upload IPA file to S3
     */
    static async uploadIPA(file: File): Promise<{ key: string; size: number }> {
        const result = await S3Service.uploadIPA(file);
        if (!result.success || !result.key) {
            throw new Error(result.error || 'Failed to upload IPA file');
        }
        return {
            key: result.key,
            size: result.size || 0
        };
    }

    /**
     * Upload app icon to S3
     */
    static async uploadIcon(iconBuffer: Buffer, filename: string): Promise<{ key: string }> {
        // Create a File object from buffer
        const uint8Array = new Uint8Array(iconBuffer);
        const iconFile = new File([uint8Array], filename, { type: 'image/png' });
        
        const result = await S3Service.uploadIcon(iconFile);
        if (!result.success || !result.key) {
            throw new Error(result.error || 'Failed to upload icon');
        }
        return { key: result.key };
    }

    /**
     * Upload plist file to S3
     */
    static async uploadPlist(plistContent: string, filename: string): Promise<{ key: string }> {
        // Create a File object from plist content
        const plistFile = new File([plistContent], filename, { type: 'application/xml' });
        
        const result = await S3Service.uploadPlist(plistFile);
        if (!result.success || !result.key) {
            throw new Error(result.error || 'Failed to upload plist');
        }
        return { key: result.key };
    }

    /**
     * Generate plist content for iOS installation
     */
    static generatePlistContent(appInfo: AppInfo, ipaUrl: string, iconUrl?: string): string {
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
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
                ${iconUrl ? `
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
                </dict>
                ` : ''}
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
                <string>${appInfo.displayName || appInfo.appName}</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;
        return plistContent;
    }

    /**
     * Get URLs for build files
     */
    static getBuildUrls(ipaKey: string, iconKey?: string, plistKey?: string) {
        return {
            ipaUrl: S3Service.generateProxyUrl(ipaKey, 'ipa'),
            iconUrl: iconKey ? S3Service.generateProxyUrl(iconKey, 'icon') : undefined,
            plistUrl: plistKey ? S3Service.generateProxyUrl(plistKey, 'ipa') : undefined, // plist uses files endpoint
            downloadUrl: plistKey ? `itms-services://?action=download-manifest&url=${encodeURIComponent(S3Service.generateProxyUrl(plistKey, 'ipa'))}` : undefined
        };
    }

    /**
     * Delete build files from S3
     */
    static async deleteBuildFiles(ipaKey: string, iconKey?: string, plistKey?: string): Promise<void> {
        const deletePromises: Promise<any>[] = [
            S3Service.deleteFile(ipaKey)
        ];

        if (iconKey) {
            deletePromises.push(S3Service.deleteFile(iconKey));
        }

        if (plistKey) {
            deletePromises.push(S3Service.deleteFile(plistKey));
        }

        try {
            await Promise.all(deletePromises);
        } catch (error) {
            console.error('Error deleting some build files:', error);
            // Don't throw error for cleanup operations
        }
    }

    /**
     * Generate installation link for iOS
     */
    static generateInstallationLink(plistKey: string): string {
        const plistUrl = S3Service.generateProxyUrl(plistKey, 'ipa');
        return `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Validate S3 configuration
     */
    static async testS3Connection(): Promise<boolean> {
        try {
            const result = await S3Service.testConnection();
            return result.success;
        } catch (error) {
            console.error('S3 connection test failed:', error);
            return false;
        }
    }
}
