import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Shared file utility functions to eliminate duplicates
 */
export class FileUtils {
    /**
     * Safely delete a file with error handling
     */
    static safeDeleteFile(filePath: string): boolean {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted file: ${filePath}`);
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ Failed to delete file ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Safely delete a directory with error handling
     */
    static safeDeleteDirectory(dirPath: string): boolean {
        try {
            if (fs.existsSync(dirPath)) {
                execSync(`rm -rf "${dirPath}"`, { cwd: path.dirname(dirPath) });
                console.log(`🗂️ Deleted directory: ${dirPath}`);
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ Failed to delete directory ${dirPath}:`, error);
            return false;
        }
    }

    /**
     * Clean up temporary files with optional fallback cleanup
     */
    static cleanupTempFiles(filePaths: string[], onError?: (error: any, filePath: string) => void): number {
        let successCount = 0;

        for (const filePath of filePaths) {
            try {
                if (this.safeDeleteFile(filePath)) {
                    successCount++;
                }
            } catch (error) {
                if (onError) {
                    onError(error, filePath);
                } else {
                    console.warn(`Warning: Failed to cleanup temp file ${filePath}:`, error);
                }
            }
        }

        return successCount;
    }

    /**
     * Validate file exists and has valid size
     */
    static validateFile(filePath: string, maxSize?: number): boolean {
        try {
            if (!filePath || typeof filePath !== 'string') {
                return false;
            }

            const normalizedPath = path.resolve(filePath);

            if (!fs.existsSync(normalizedPath)) {
                return false;
            }

            const stats = fs.statSync(normalizedPath);

            // Check if file is empty
            if (stats.size === 0) {
                return false;
            }

            // Check max size if provided
            if (maxSize && stats.size > maxSize) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating file:', error);
            return false;
        }
    }

    /**
     * Get file size safely
     */
    static getFileSize(filePath: string): number {
        try {
            const normalizedPath = path.resolve(filePath);
            if (fs.existsSync(normalizedPath)) {
                return fs.statSync(normalizedPath).size;
            }
            return 0;
        } catch (error) {
            console.error('Error getting file size:', error);
            return 0;
        }
    }

    /**
     * Create temporary directory safely
     */
    static createTempDirectory(basePath: string, dirName: string = '.tmp'): string {
        const tempDir = path.join(basePath, dirName);

        try {
            // Clean up existing temp directory
            if (fs.existsSync(tempDir)) {
                this.safeDeleteDirectory(tempDir);
            }

            // Create new temp directory
            fs.mkdirSync(tempDir, { recursive: true });
            return tempDir;
        } catch (error) {
            console.error('Error creating temp directory:', error);
            throw error;
        }
    }
}
