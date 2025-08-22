import { FileUtils } from '@/lib/file-utils';
import { IpaMetadata, ProcessedIpaData } from '@/types/queue';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as plist from 'plist';
import sharp from 'sharp';

// Function để giải nén và extract metadata từ file IPA
export async function extractIpaMetadata(ipaFilePath: string): Promise<ProcessedIpaData> {
    // Validate file path before processing
    if (!ipaFilePath || typeof ipaFilePath !== 'string') {
        throw new Error('Invalid IPA file path provided');
    }

    // Normalize the file path to prevent path traversal issues
    const normalizedPath = path.resolve(ipaFilePath);

    if (!fs.existsSync(normalizedPath)) {
        throw new Error(`IPA file does not exist: ${normalizedPath}`);
    }

    const tempDir = path.join(path.dirname(normalizedPath), '.tmp');

    try {
        console.log('📦 Starting IPA metadata extraction...');

        // Create temp directory using shared utility
        FileUtils.createTempDirectory(path.dirname(normalizedPath));

        // Extract IPA file using unzip
        console.log('� Extracting IPA file...');
        execSync(`unzip "${normalizedPath}" -d "${tempDir}"`, {
            cwd: path.dirname(normalizedPath),
            stdio: 'pipe' // Suppress output
        });

        // Find the .app directory
        const payloadDir = path.join(tempDir, 'Payload');
        if (!fs.existsSync(payloadDir)) {
            throw new Error('Invalid IPA structure: Payload directory not found');
        }

        const appDirs = fs.readdirSync(payloadDir).filter((dir) => dir.endsWith('.app'));
        if (appDirs.length === 0) {
            throw new Error('Invalid IPA structure: No .app directory found in Payload');
        }

        const appDir = path.join(payloadDir, appDirs[0]);
        console.log(`📱 Found app directory: ${appDirs[0]}`);

        // Extract metadata from Info.plist
        const infoPlistPath = path.join(appDir, 'Info.plist');
        if (!fs.existsSync(infoPlistPath)) {
            throw new Error('Info.plist not found in app directory');
        }

        console.log('📋 Reading Info.plist...');
        const plistContent = fs.readFileSync(infoPlistPath, 'utf8');
        const parsed = plist.parse(plistContent) as Record<string, any>;

        // Validate required fields
        if (!parsed.CFBundleIdentifier) {
            throw new Error('Missing CFBundleIdentifier in Info.plist');
        }

        const metadata: IpaMetadata = {
            appName: parsed.CFBundleName || parsed.CFBundleDisplayName || 'Unknown App',
            bundleId: parsed.CFBundleIdentifier || '',
            version: parsed.CFBundleShortVersionString || '1.0',
            buildNumber: parsed.CFBundleVersion || '1',
            minimumOSVersion: parsed.MinimumOSVersion,
            displayName: parsed.CFBundleDisplayName,
            iconPaths: parsed.CFBundleIcons?.CFBundlePrimaryIcon?.CFBundleIconFiles || []
        };

        console.log(`📋 Extracted metadata: ${metadata.appName} v${metadata.version}`);

        // Find and extract app icon
        let iconBuffer: Buffer | undefined;
        let iconFileName: string | undefined;

        const iconCandidates = fs.readdirSync(appDir).filter((file) => (file.includes('AppIcon') || file.includes('Icon')) && (file.endsWith('.png') || file.endsWith('@2x.png') || file.endsWith('@3x.png')));

        if (iconCandidates.length > 0) {
            // Sort to prioritize higher resolution icons
            iconCandidates.sort((a, b) => {
                if (a.includes('@3x')) return -1;
                if (b.includes('@3x')) return 1;
                if (a.includes('@2x')) return -1;
                if (b.includes('@2x')) return 1;
                return 0;
            });

            const iconPath = path.join(appDir, iconCandidates[0]);
            iconBuffer = fs.readFileSync(iconPath);
            iconFileName = iconCandidates[0];
            console.log(`🎨 Extracted icon: ${iconFileName} (${iconBuffer.length} bytes)`);
        } else {
            console.log('⚠️ No app icon found');
        }

        // Generate plist content for itms-services
        const plistContentForInstall = generatePlistContent(metadata, ''); // URL will be updated later

        const fileSize = fs.statSync(normalizedPath).size;

        console.log('✅ IPA metadata extraction completed successfully');

        const result: ProcessedIpaData = {
            metadata,
            iconBuffer,
            iconFileName,
            plistContent: plistContentForInstall,
            fileSize
        };

        return result;
    } catch (error: any) {
        console.error('❌ Error extracting IPA metadata:', error.message);
        throw new Error(`Failed to extract IPA metadata: ${error.message}`);
    } finally {
        // Clean up temp directory using shared utility
        FileUtils.safeDeleteDirectory(tempDir);
        console.log('🧹 Cleaned up temporary files');
    }
}

// Function để sinh file plist cho itms-services
export function generatePlistContent(metadata: IpaMetadata, ipaUrl: string, iconUrl?: string): string {
    const plistData = {
        items: [
            {
                assets: [
                    {
                        kind: 'software-package',
                        url: ipaUrl
                    },
                    ...(iconUrl
                        ? [
                              {
                                  kind: 'full-size-image',
                                  'needs-shine': false,
                                  url: iconUrl
                              },
                              {
                                  kind: 'display-image',
                                  'needs-shine': false,
                                  url: iconUrl
                              }
                          ]
                        : [])
                ],
                metadata: {
                    'bundle-identifier': metadata.bundleId,
                    'bundle-version': metadata.version,
                    kind: 'software',
                    subtitle: metadata.displayName || metadata.appName,
                    title: metadata.appName
                }
            }
        ]
    };

    return plist.build(plistData as plist.PlistValue);
}

// Function để tối ưu icon (resize và convert)
export async function optimizeIcon(iconBuffer: Buffer): Promise<Buffer> {
    try {
        // Validate input
        if (!iconBuffer || iconBuffer.length === 0) {
            throw new Error('Invalid icon buffer provided');
        }

        // Check if buffer appears to be a valid image
        const imageSignatures = [
            [0x89, 0x50, 0x4e, 0x47], // PNG
            [0xff, 0xd8, 0xff], // JPEG
            [0x47, 0x49, 0x46] // GIF
        ];

        const hasValidSignature = imageSignatures.some((signature) => signature.every((byte, index) => iconBuffer[index] === byte));

        if (!hasValidSignature) {
            console.warn('Warning: Icon buffer does not appear to be a valid image format');
        }

        // Resize icon thành 512x512 và convert sang PNG
        return await sharp(iconBuffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toBuffer();
    } catch (error: any) {
        console.warn('Warning: Failed to optimize icon, using original:', error.message);
        return iconBuffer;
    }
}

// Function để validate file IPA - Uses shared FileUtils
export function validateIpaFile(filePath: string): boolean {
    try {
        // Basic validation using shared utility
        if (!FileUtils.validateFile(filePath, 500 * 1024 * 1024)) {
            // 500MB max
            return false;
        }

        // Normalize path
        const normalizedPath = path.resolve(filePath);

        // Check IPA extension
        if (!normalizedPath.toLowerCase().endsWith('.ipa')) {
            console.error('File is not an IPA:', normalizedPath);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating IPA file:', error);
        return false;
    }
}

// Function để tạo app ID ngẫu nhiên
export function generateAppId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
