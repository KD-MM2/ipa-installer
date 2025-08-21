'use client';

import { api } from '@/lib/axios-client';
import { useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';

interface UploadSuccessStateProps {
    uploadResult: {
        appId: string;
        jobId: string;
        estimatedTime: string;
    };
    onReset: () => void;
}

interface JobStatus {
    id: string;
    state: string;
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

export default function UploadSuccessState({ uploadResult, onReset }: UploadSuccessStateProps) {
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Poll for job status
    useEffect(() => {
        const pollStatus = async () => {
            try {
                const response = await api.get(`/api/status?jobId=${uploadResult.jobId}&appId=${uploadResult.appId}`);
                const data = response.data;

                if (data.success) {
                    setJobStatus(data.job);
                    setAppInfo(data.app);
                    setLoading(false);

                    // Stop polling if job is completed or failed
                    if (data.job?.state === 'completed' || data.job?.state === 'failed') {
                        if (pollInterval) {
                            clearInterval(pollInterval);
                        }
                    }
                } else {
                    setError(data.error || 'Failed to get status');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error polling status:', err);
                setError('Failed to check processing status');
                setLoading(false);
            }
        };

        // Poll immediately
        pollStatus();

        // Then poll every 2 seconds
        const pollInterval = setInterval(pollStatus, 2000);

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [uploadResult.jobId, uploadResult.appId]);

    const getStatusIcon = () => {
        if (loading) return '⏳';
        if (error) return '❌';

        switch (jobStatus?.state) {
            case 'completed':
                return '✅';
            case 'failed':
                return '❌';
            case 'active':
                return '🔄';
            default:
                return '⏳';
        }
    };

    const getStatusMessage = () => {
        if (loading) return 'Đang kiểm tra trạng thái...';
        if (error) return error;

        switch (jobStatus?.state) {
            case 'completed':
                return 'Xử lý hoàn tất! App đã sẵn sàng để tải xuống.';
            case 'failed':
                return `Xử lý thất bại: ${jobStatus.failedReason || 'Unknown error'}`;
            case 'active':
                return jobStatus.progress?.message || 'Đang xử lý file IPA...';
            case 'waiting':
                return 'Đang chờ xử lý...';
            default:
                return 'Đang xử lý...';
        }
    };

    const getProgressPercentage = () => {
        if (jobStatus?.state === 'completed') return 100;
        if (jobStatus?.state === 'failed') return 0;
        return jobStatus?.progress?.percentage || 0;
    };

    const handleViewApp = () => {
        if (appInfo && jobStatus?.state === 'completed') {
            router.push(`/app/${appInfo.appId}`);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6">
            {/* Status Icon */}
            <div className="text-center">
                <div className="text-6xl mb-4">{getStatusIcon()}</div>
                <h2 className="text-2xl font-bold text-gray-900">{jobStatus?.state === 'completed' ? 'Xử lý hoàn tất!' : 'Đang xử lý...'}</h2>
                <p className="text-gray-600 mt-2">{getStatusMessage()}</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tiến độ xử lý</span>
                    <span className="text-gray-900 font-medium">{getProgressPercentage()}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${getProgressPercentage()}%` }}></div>
                </div>
                {jobStatus?.progress?.step && <p className="text-xs text-gray-500">{jobStatus.progress.step}</p>}
            </div>

            {/* Upload Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-gray-900">Thông tin upload:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-gray-600">App ID:</span>
                        <code className="ml-2 bg-gray-200 px-2 py-1 rounded text-xs text-black">{uploadResult.appId}</code>
                    </div>
                    <div>
                        <span className="text-gray-600">Job ID:</span>
                        <code className="ml-2 bg-gray-200 px-2 py-1 rounded text-xs text-black">{uploadResult.jobId}</code>
                    </div>
                    <div>
                        <span className="text-gray-600">Thời gian ước tính:</span>
                        <span className="ml-2 text-gray-900">{uploadResult.estimatedTime}</span>
                    </div>
                    <div>
                        <span className="text-gray-600">Trạng thái:</span>
                        <span className="ml-2 text-gray-900 capitalize">{jobStatus?.state || 'unknown'}</span>
                    </div>
                </div>
            </div>

            {/* App Info (when available) */}
            {appInfo && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-gray-900">Thông tin ứng dụng:</h3>
                    <div className="flex items-start space-x-4">
                        {appInfo.iconUrl && (
                            <img
                                src={appInfo.iconUrl}
                                alt="App Icon"
                                className="w-16 h-16 rounded-lg shadow-sm"
                                onError={(e) => {
                                    // Hide icon if failed to load
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        )}
                        <div className="flex-1 space-y-1 text-sm">
                            <div>
                                <span className="font-medium text-gray-900">{appInfo.appName}</span>
                            </div>
                            <div className="text-gray-600">
                                Version: {appInfo.version} ({appInfo.buildNumber})
                            </div>
                            <div className="text-gray-600">Bundle ID: {appInfo.bundleId}</div>
                            <div className="text-gray-500 text-xs">Tạo lúc: {new Date(appInfo.createdAt).toLocaleString('vi-VN')}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={onReset} className="btn px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                    Upload file khác
                </button>

                {jobStatus?.state === 'completed' && appInfo && (
                    <button onClick={handleViewApp} className="btn px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Xem chi tiết & Tải xuống
                    </button>
                )}

                {jobStatus?.state === 'failed' && (
                    <button onClick={onReset} className="btn px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                        Thử lại
                    </button>
                )}
            </div>

            {/* Processing Time Info */}
            {jobStatus?.state === 'active' && (
                <div className="text-center text-sm text-gray-500">
                    <p>⏱️ Thời gian xử lý dự kiến: {uploadResult.estimatedTime}</p>
                    <p className="mt-1">Bạn có thể đóng trang này và quay lại sau, quá trình xử lý sẽ tiếp tục.</p>
                </div>
            )}
        </div>
    );
}
