/**
 * Utility functions for generating URLs based on buildId and filenames
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const MINIO_BASE_URL = process.env.MINIO_EXTERNAL_URL || 'http://192.168.0.2:9000';
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'ipa-installer';

export class UrlUtils {
    /**
     * Generate IPA download URL (proxied through Next.js)
     */
    static getIpaUrl(buildId: string, originalFilename: string): string {
        return `${BASE_URL}/assets/files/builds/${buildId}/${originalFilename}`;
    }

    /**
     * Generate icon URL if hasIcon is true (proxied through Next.js)
     */
    static getIconUrl(buildId: string, hasIcon: boolean): string | null {
        if (!hasIcon) return null;
        return `${BASE_URL}/assets/icons/builds/${buildId}/icon.png`;
    }

    /**
     * Generate plist URL for iTunes installation (proxied through Next.js)
     */
    static getPlistUrl(buildId: string): string {
        return `${BASE_URL}/assets/files/builds/${buildId}/install.plist`;
    }

    /**
     * Generate iTunes installation link
     */
    static getInstallationUrl(buildId: string): string {
        const plistUrl = this.getPlistUrl(buildId);
        return `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;
    }

    /**
     * Generate app detail page URL
     */
    static getAppDetailUrl(buildId: string): string {
        return `${BASE_URL}/app/${buildId}`;
    }

    /**
     * Generate direct MinIO URLs (for internal operations only)
     */
    static getDirectIpaUrl(buildId: string, originalFilename: string): string {
        return `${MINIO_BASE_URL}/${BUCKET_NAME}/builds/${buildId}/${originalFilename}`;
    }

    static getDirectIconUrl(buildId: string, hasIcon: boolean): string | null {
        if (!hasIcon) return null;
        return `${MINIO_BASE_URL}/${BUCKET_NAME}/builds/${buildId}/icon.png`;
    }

    static getDirectPlistUrl(buildId: string): string {
        return `${MINIO_BASE_URL}/${BUCKET_NAME}/builds/${buildId}/install.plist`;
    }

    /**
     * Generate all URLs for a build
     */
    static getAllUrls(buildId: string, originalFilename: string, hasIcon: boolean) {
        return {
            ipaUrl: this.getIpaUrl(buildId, originalFilename),
            iconUrl: this.getIconUrl(buildId, hasIcon),
            plistUrl: this.getPlistUrl(buildId),
            installationUrl: this.getInstallationUrl(buildId),
            appDetailUrl: this.getAppDetailUrl(buildId)
        };
    }

    /**
     * Generate S3 keys for file storage
     */
    static getS3Keys(buildId: string, originalFilename: string) {
        return {
            ipaKey: `builds/${buildId}/${originalFilename}`,
            iconKey: `builds/${buildId}/icon.png`,
            plistKey: `builds/${buildId}/install.plist`
        };
    }
}
