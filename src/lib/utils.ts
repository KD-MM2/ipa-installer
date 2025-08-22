const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

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

export const isValidIPA = (file: File): boolean => {
    return file.type === 'application/octet-stream' && file.name.toLowerCase().endsWith('.ipa');
};

export const getFileType = (filename: string): 'ipa' | 'icon' | 'plist' | 'other' => {
    const extension = getFileExtension(filename).toLowerCase();
    if (extension === 'ipa') return 'ipa';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'icon';
    if (extension === 'plist') return 'plist';
    return 'other';
};

export class UrlUtils {
    /**
     * Generate asset URLs for app access (proxy routes)
     */
    static getIpaUrl(appId: string, originalFilename: string): string {
        return `${BASE_URL}/assets/files/apps/${appId}/${originalFilename}`;
    }

    /**
     * Generate icon URL
     */
    static getIconUrl(appId: string, hasIcon: boolean): string | null {
        if (!hasIcon) return null;
        return `${BASE_URL}/assets/icons/apps/${appId}/icon.png`;
    }

    /**
     * Generate plist URL for iOS installation
     */
    static getPlistUrl(appId: string): string {
        return `${BASE_URL}/assets/files/apps/${appId}/install.plist`;
    }

    /**
     * Generate iTunes installation URL
     */
    static getInstallationUrl(appId: string): string {
        const plistUrl = this.getPlistUrl(appId);
        return `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;
    }

    /**
     * Generate app detail page URL
     */
    static getAppDetailUrl(appId: string): string {
        return `${BASE_URL}/app/${appId}`;
    }

    /**
     * Get all URLs for a given app
     */
    static getAllUrls(appId: string, originalFilename: string, hasIcon: boolean) {
        return {
            ipaUrl: this.getIpaUrl(appId, originalFilename),
            iconUrl: this.getIconUrl(appId, hasIcon),
            plistUrl: this.getPlistUrl(appId),
            installationUrl: this.getInstallationUrl(appId),
            appDetailUrl: this.getAppDetailUrl(appId)
        };
    }

    /**
     * Get S3/MinIO object keys
     */
    static getS3Keys(appId: string, originalFilename: string) {
        return {
            ipaKey: `apps/${appId}/${originalFilename}`,
            iconKey: `apps/${appId}/icon.png`,
            plistKey: `apps/${appId}/install.plist`
        };
    }
}
