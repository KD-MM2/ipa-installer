/**
 * Utility functions for generating URLs based on appId and filenames
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const MINIO_BASE_URL = process.env.MINIO_BASE_URL || 'http://localhost:9000';
const BUCKET_NAME = process.env.BUCKET_NAME || 'ipa-installer';

export class UrlUtils {
    /**
     * Generate IPA download URL
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
     * Generate direct IPA URL from MinIO/S3
     */
    static getDirectIpaUrl(appId: string, originalFilename: string): string {
        return `${MINIO_BASE_URL}/${BUCKET_NAME}/apps/${appId}/${originalFilename}`;
    }

    static getDirectIconUrl(appId: string, hasIcon: boolean): string | null {
        if (!hasIcon) return null;
        return `${MINIO_BASE_URL}/${BUCKET_NAME}/apps/${appId}/icon.png`;
    }

    static getDirectPlistUrl(appId: string): string {
        return `${MINIO_BASE_URL}/${BUCKET_NAME}/apps/${appId}/install.plist`;
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
