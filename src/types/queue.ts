// Định nghĩa các kiểu dữ liệu cho queue jobs

export interface IpaProcessJobData {
    buildId: string;
    filePath: string; // Đường dẫn file .ipa tạm thời
    originalFilename: string;
    fileSize: number;
    uploadedBy?: string; // User ID hoặc IP
}

export interface IpaMetadata {
    appName: string;
    bundleId: string;
    version: string;
    buildNumber: string;
    minimumOSVersion?: string;
    displayName?: string;
    iconPaths?: string[];
}

export interface ProcessedIpaData {
    metadata: IpaMetadata;
    iconBuffer?: Buffer;
    iconFileName?: string;
    plistContent: string;
    fileSize: number;
}

export interface StorageUrls {
    ipaUrl: string;
    iconUrl?: string;
    plistUrl: string;
}

// Enum cho trạng thái của job
export enum JobStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

// Interface cho job progress
export interface JobProgress {
    step: string;
    percentage: number;
    message?: string;
}

// Queue names
export const QUEUE_NAMES = {
    IPA_PROCESS: 'ipa-process',
    CLEANUP: 'cleanup'
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
