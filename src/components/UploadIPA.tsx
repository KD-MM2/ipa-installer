'use client';

import { api } from '@/lib/axios-client';

import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UploadIPAProps {
    onUploadSuccess?: (result: { appId: string; jobId: string; estimatedTime: string }) => void;
}

interface JobStatus {
    id: string;
    state: 'active' | 'completed' | 'failed' | 'waiting';
    progress?: {
        step: string;
        percentage: number;
        message?: string;
    };
    failedReason?: string;
}

interface AppInfo {
    appId: string;
    appName: string;
    bundleId: string;
    version: string;
    buildNumber: string;
    status: string;
    iconUrl?: string;
    createdAt: string;
}

interface FileUploadItem {
    id: string;
    file: File;
    progress: number;
    status: 'waiting' | 'uploading' | 'processing' | 'completed' | 'failed';
    error?: string;
    uploadResult?: { appId: string; jobId: string; estimatedTime: string };
    jobStatus?: JobStatus;
    appInfo?: AppInfo;
    processingProgress?: number;
}

export default function UploadIPA({ onUploadSuccess }: UploadIPAProps) {
    const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
    const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const toast = useRef<Toast>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const pollStatus = useCallback(
        async (itemId: string, jobId: string, appId: string) => {
            try {
                const response = await api.get(`/api/status?jobId=${jobId}&appId=${appId}`);
                const data = response.data;

                if (!data.success) return;

                const jobStatus = data.job;
                const appInfo = data.app;

                // Update item with latest status
                setUploadQueue((prev) =>
                    prev.map((item) => {
                        if (item.id === itemId) {
                            const updates: Partial<FileUploadItem> = {
                                jobStatus,
                                appInfo,
                                processingProgress: jobStatus?.progress?.percentage || 0
                            };

                            // Check if processing is complete
                            if (jobStatus?.state === 'completed') {
                                updates.status = 'completed';
                            } else if (jobStatus?.state === 'failed') {
                                updates.status = 'failed';
                                updates.error = jobStatus.failedReason || 'Processing failed';
                            }

                            return { ...item, ...updates };
                        }
                        return item;
                    })
                );

                // Handle completion or failure
                if (jobStatus?.state === 'completed' || jobStatus?.state === 'failed') {
                    // Stop polling
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    // Show appropriate toast
                    const item = uploadQueue.find((i) => i.id === itemId);
                    if (item) {
                        if (jobStatus.state === 'completed') {
                            toast.current?.show({
                                severity: 'success',
                                summary: 'Xử lý hoàn tất',
                                detail: `${item.file.name} đã sẵn sàng để tải xuống`
                            });
                        } else {
                            toast.current?.show({
                                severity: 'error',
                                summary: 'Xử lý thất bại',
                                detail: `${item.file.name}: ${jobStatus.failedReason || 'Unknown error'}`
                            });
                        }
                    }

                    // Process next item in queue
                    setCurrentProcessingId(null);
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        },
        [uploadQueue]
    );

    const startStatusPolling = useCallback(
        (itemId: string, jobId: string, appId: string) => {
            // Clear any existing polling
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }

            // Poll immediately
            pollStatus(itemId, jobId, appId);

            // Set up interval for subsequent polls
            pollingIntervalRef.current = setInterval(() => {
                pollStatus(itemId, jobId, appId);
            }, 3000); // Poll every 3 seconds
        },
        [pollStatus]
    );

    const uploadFile = useCallback(
        async (itemId: string) => {
            const item = uploadQueue.find((i) => i.id === itemId);
            if (!item) return;

            // Update status to uploading
            updateItemStatus(itemId, 'uploading', 0);

            try {
                const formData = new FormData();
                formData.append('file', item.file);

                // Create new AbortController for this upload
                abortControllerRef.current = new AbortController();

                // Use axios with progress tracking
                const response = await api.post('/api/upload', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    signal: abortControllerRef.current.signal,
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                            updateItemProgress(itemId, progress);
                        }
                    }
                });

                const result = response.data;

                if (!result.success) {
                    throw new Error(result.error || 'Upload failed');
                }

                // Update with upload result
                updateItemStatus(itemId, 'processing', 100, {
                    uploadResult: result
                });

                onUploadSuccess?.(result);

                toast.current?.show({
                    severity: 'success',
                    summary: 'Upload thành công',
                    detail: `${item.file.name} đã được upload, đang xử lý...`
                });

                // Start polling for processing status
                startStatusPolling(itemId, result.jobId, result.appId);
            } catch (error: any) {
                console.error('Upload error:', error);

                updateItemStatus(itemId, 'failed', 0, {
                    error: error.message
                });

                toast.current?.show({
                    severity: 'error',
                    summary: 'Upload thất bại',
                    detail: `${item.file.name}: ${error.message}`
                });

                // Process next item
                setCurrentProcessingId(null);
            }
        },
        [onUploadSuccess, startStatusPolling, uploadQueue]
    );

    const processNextInQueue = useCallback(async () => {
        const nextItem = uploadQueue.find((item) => item.status === 'waiting');
        if (!nextItem) return;

        setCurrentProcessingId(nextItem.id);
        await uploadFile(nextItem.id);
    }, [uploadQueue, uploadFile]);

    // Process queue when no current processing and queue has waiting items
    useEffect(() => {
        if (!currentProcessingId && uploadQueue.some((item) => item.status === 'waiting')) {
            processNextInQueue();
        }
    }, [currentProcessingId, uploadQueue, processNextInQueue]);

    const updateItemStatus = (itemId: string, status: FileUploadItem['status'], progress?: number, additionalData?: Partial<FileUploadItem>) => {
        setUploadQueue((prev) => prev.map((item) => (item.id === itemId ? { ...item, status, ...(progress !== undefined && { progress }), ...additionalData } : item)));
    };

    const updateItemProgress = (itemId: string, progress: number) => {
        setUploadQueue((prev) => prev.map((item) => (item.id === itemId ? { ...item, progress } : item)));
    };

    const validateFile = (file: File): string | null => {
        if (!file.name.toLowerCase().endsWith('.ipa')) {
            return 'Chỉ chấp nhận file .ipa';
        }
        if (file.size > 2 * 1024 * 1024 * 1024) {
            return 'File quá lớn. Kích thước tối đa: 2GB';
        }
        return null;
    };

    const handleFileSelect = (files: FileList | File[]) => {
        const filesArray = Array.from(files);
        const newItems: FileUploadItem[] = [];

        for (const file of filesArray) {
            const validationError = validateFile(file);
            if (validationError) {
                toast.current?.show({
                    severity: 'error',
                    summary: 'File không hợp lệ',
                    detail: `${file.name}: ${validationError}`
                });
                continue;
            }

            // Check for duplicates
            const exists = uploadQueue.some((item) => item.file.name === file.name && item.file.size === file.size);

            if (exists) {
                toast.current?.show({
                    severity: 'warn',
                    summary: 'File đã tồn tại',
                    detail: `${file.name} đã có trong hàng đợi`
                });
                continue;
            }

            newItems.push({
                id: `${Date.now()}-${Math.random()}`,
                file,
                progress: 0,
                status: 'waiting'
            });
        }

        if (newItems.length > 0) {
            setUploadQueue((prev) => [...prev, ...newItems]);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleFileSelect(files);
        }
        event.target.value = '';
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelect(files);
        }
    };

    const removeFileFromQueue = (id: string) => {
        // const item = uploadQueue.find((i) => i.id === id);

        // If removing current processing item, stop it
        if (id === currentProcessingId) {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setCurrentProcessingId(null);
        }

        setUploadQueue((prev) => prev.filter((item) => item.id !== id));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusDisplay = (item: FileUploadItem) => {
        const statusConfig = {
            waiting: { icon: '⏳', tag: 'Chờ', severity: 'secondary' as const },
            uploading: { icon: '📤', tag: 'Uploading', severity: 'info' as const },
            processing: { icon: '⚙️', tag: 'Đang xử lý', severity: 'warning' as const },
            completed: { icon: '✅', tag: 'Hoàn tất', severity: 'success' as const },
            failed: { icon: '❌', tag: 'Thất bại', severity: 'danger' as const }
        };

        return statusConfig[item.status] || statusConfig.waiting;
    };

    const getStatusText = (item: FileUploadItem) => {
        switch (item.status) {
            case 'waiting':
                const position = uploadQueue.filter((i) => i.status === 'waiting').findIndex((i) => i.id === item.id) + 1;
                return position > 0 ? `Đang chờ (vị trí ${position})` : 'Đang chờ';
            case 'uploading':
                return `Đang upload... ${item.progress}%`;
            case 'processing':
                return item.jobStatus?.progress?.message || 'Đang xử lý...';
            case 'completed':
                return 'Xử lý hoàn tất';
            case 'failed':
                return item.error || 'Xử lý thất bại';
            default:
                return '';
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            <Toast ref={toast} />

            {/* Upload Area */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                    ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="space-y-4">
                    <div className="text-6xl">📱</div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Upload file IPA</h3>
                        <p className="text-sm text-gray-600 mt-1">Kéo thả file .ipa vào đây hoặc click để chọn file (có thể chọn nhiều file)</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".ipa" onChange={handleFileChange} className="hidden" multiple />
                    <div className="text-xs text-gray-500">Kích thước tối đa: 2GB mỗi file</div>
                </div>
            </div>

            {/* Upload Queue */}
            {uploadQueue.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Hàng đợi ({uploadQueue.length} file)</h4>

                    {uploadQueue.map((item) => {
                        const statusDisplay = getStatusDisplay(item);

                        return (
                            <div key={item.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1">
                                        <span className="text-xl">{statusDisplay.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-900 font-medium">{item.file.name}</span>
                                                <Tag value={statusDisplay.tag} severity={statusDisplay.severity} />
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                {formatFileSize(item.file.size)} • {getStatusText(item)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {item.status === 'completed' && item.appInfo && <Button label="Xem" icon="pi pi-eye" size="small" severity="success" onClick={() => window.open(`/app/${item.appInfo!.appId}`, '_blank')} />}
                                        {item.status !== 'uploading' && item.status !== 'processing' && <Button icon="pi pi-times" size="small" severity="danger" text onClick={() => removeFileFromQueue(item.id)} />}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {(item.status === 'uploading' || item.status === 'processing') && (
                                    <ProgressBar value={item.status === 'uploading' ? item.progress : item.processingProgress || 0} showValue={false} className="h-1" color={item.status === 'processing' ? '#f59e0b' : undefined} />
                                )}

                                {/* App Info */}
                                {item.status === 'completed' && item.appInfo && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <div className="flex items-start space-x-3">
                                            {item.appInfo.iconUrl && <img src={item.appInfo.iconUrl} alt="App Icon" className="w-12 h-12 rounded-lg" />}
                                            <div className="flex-1 text-xs space-y-1">
                                                <div className="font-medium">{item.appInfo.appName}</div>
                                                <div>
                                                    Version: {item.appInfo.version} ({item.appInfo.buildNumber})
                                                </div>
                                                <div>Bundle ID: {item.appInfo.bundleId}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
