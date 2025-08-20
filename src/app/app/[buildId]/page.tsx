'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { api } from '@/lib/axios-client';
import Link from 'next/link';
interface BuildInfo {
    buildId: string;
    appName: string;
    bundleId: string;
    version: string;
    buildNumber: string;
    displayName?: string;
    minimumOSVersion?: string;
    originalFilename: string;
    fileSize: string;
    hasIcon: boolean;
    iconUrl?: string;
    ipaUrl: string;
    plistUrl: string;
    installationUrl: string;
    appDetailUrl: string;
    status: string;
    maxDownloads?: number;
    downloadCount: number;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
}

export default function BuildDetailPage() {
    const params = useParams();
    const buildId = params.buildId as string;
    const [build, setBuild] = useState<BuildInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

    useEffect(() => {
        if (!buildId) return;

        const fetchBuildInfo = async () => {
            try {
                const response = await api.get(`/api/status?buildId=${buildId}`);
                const data = response.data;

                if (data.success && data.build) {
                    setBuild(data.build);
                } else {
                    setError('Build không tồn tại hoặc đã bị xóa');
                }
            } catch (err) {
                console.error('Error fetching build info:', err);
                setError('Không thể tải thông tin build');
            } finally {
                setLoading(false);
            }
        };

        fetchBuildInfo();
    }, [buildId]);

    useEffect(() => {
        const generateQRCode = async () => {
            try {
                const currentUrl = window.location.href;
                const qrCodeDataURL = await QRCode.toDataURL(currentUrl, {
                    width: 200,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                setQrCodeDataUrl(qrCodeDataURL);
            } catch (err) {
                console.error('Error generating QR code:', err);
            }
        };

        generateQRCode();
    }, []);

    const handleInstall = async () => {
        if (!build) return;

        setIsInstalling(true);

        try {
            // Increment download count first
            const downloadResponse = await api.post('/api/download', {
                buildId: build.buildId
            });

            if (downloadResponse.status !== 200) {
                const errorData = downloadResponse.data;
                alert(errorData.error || 'Cannot download at this time');
                return;
            }

            // On iOS, this will trigger the app installation
            // The plist URL contains the manifest for itms-services
            const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(build.plistUrl)}`;
            window.location.href = installUrl;

            // Update local download count
            const downloadData = downloadResponse.data;
            setBuild((prev) =>
                prev
                    ? {
                          ...prev,
                          downloadCount: downloadData.downloadCount
                      }
                    : null
            );
        } catch (error) {
            console.error('Error installing app:', error);
            alert('Có lỗi xảy ra khi cài đặt ứng dụng');
        } finally {
            setTimeout(() => setIsInstalling(false), 2000);
        }
    };

    const formatFileSize = (bytes: string): string => {
        const size = parseInt(bytes);
        if (size === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    const isExpired = (): boolean => {
        if (!build?.expiresAt) return false;
        return new Date(build.expiresAt) < new Date();
    };

    const canDownload = (): boolean => {
        if (!build) return false;
        if (build.status !== 'active') return false;
        if (isExpired()) return false;
        if (build.maxDownloads && build.downloadCount >= build.maxDownloads) return false;
        return true;
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'active':
                return 'text-green-600 bg-green-100';
            case 'processing':
                return 'text-blue-600 bg-blue-100';
            case 'failed':
                return 'text-red-600 bg-red-100';
            case 'expired':
                return 'text-gray-600 bg-gray-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusText = (status: string): string => {
        switch (status) {
            case 'active':
                return 'Sẵn sàng';
            case 'processing':
                return 'Đang xử lý';
            case 'failed':
                return 'Thất bại';
            case 'expired':
                return 'Hết hạn';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải thông tin build...</p>
                </div>
            </div>
        );
    }

    if (error || !build) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Build không tìm thấy</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Link href="/" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Về trang chủ
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">📱 Chi tiết ứng dụng</h1>
                    <p className="text-gray-600">Thông tin và link cài đặt cho {build.displayName || build.appName}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* App Info Card */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="flex items-start space-x-6">
                                {/* App Icon */}
                                <div className="flex-shrink-0">
                                    <img
                                        src={`/assets/icons/builds/${build.buildId}/icon.png`}
                                        alt={`${build.appName} icon`}
                                        className="w-20 h-20 rounded-xl shadow-md"
                                        onError={(e) => {
                                            // Hide the image and show fallback instead
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                </div>

                                {/* App Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-3 mb-3">
                                        <h2 className="text-2xl font-bold text-gray-900 truncate">{build.displayName || build.appName}</h2>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(build.status)}`}>{getStatusText(build.status)}</span>
                                    </div>

                                    <div className="space-y-2 text-sm text-gray-600">
                                        <div>
                                            <span className="font-medium">Bundle ID:</span> {build.bundleId}
                                        </div>
                                        <div>
                                            <span className="font-medium">Version:</span> {build.version} ({build.buildNumber})
                                        </div>
                                        {build.minimumOSVersion && (
                                            <div>
                                                <span className="font-medium">Minimum iOS:</span> {build.minimumOSVersion}
                                            </div>
                                        )}
                                        <div>
                                            <span className="font-medium">File size:</span> {formatFileSize(build.fileSize)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Download Stats */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-600">{build.downloadCount}</div>
                                        <div className="text-sm text-gray-600">Lượt tải</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-600">{build.maxDownloads ? build.maxDownloads - build.downloadCount : '∞'}</div>
                                        <div className="text-sm text-gray-600">Còn lại</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-purple-600">{build.expiresAt ? Math.max(0, Math.ceil((new Date(build.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : '∞'}</div>
                                        <div className="text-sm text-gray-600">Ngày còn lại</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-600">{formatDate(build.createdAt).split(' ')[0]}</div>
                                        <div className="text-sm text-gray-600">Ngày tạo</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Installation Instructions */}
                        <div className="bg-blue-50 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Hướng dẫn cài đặt</h3>
                            <div className="space-y-3 text-sm text-blue-800">
                                <div className="flex items-start space-x-2">
                                    <span className="font-bold">1.</span>
                                    <span>Mở trang này trên thiết bị iOS của bạn (iPhone/iPad)</span>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <span className="font-bold">2.</span>
                                    <span>{'Nhấn nút "Cài đặt ứng dụng" bên dưới'}</span>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <span className="font-bold">3.</span>
                                    <span>Làm theo hướng dẫn trên màn hình để hoàn tất cài đặt</span>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <span className="font-bold">4.</span>
                                    <span>Vào Settings → General → VPN & Device Management để tin tưởng developer</span>
                                </div>
                            </div>
                        </div>

                        {/* Warning Messages */}
                        {!canDownload() && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 text-red-800">
                                    <span>⚠️</span>
                                    <span className="font-medium">{isExpired() ? 'Build đã hết hạn' : build.status !== 'active' ? 'Build không khả dụng' : 'Đã hết số lượt tải cho phép'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Install Button */}
                        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                            <button
                                onClick={handleInstall}
                                disabled={!canDownload() || isInstalling}
                                className={`
                                    w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors
                                    ${canDownload() && !isInstalling ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                                `}
                            >
                                {isInstalling ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        <span>Đang cài đặt...</span>
                                    </div>
                                ) : canDownload() ? (
                                    <>📲 Cài đặt ứng dụng</>
                                ) : (
                                    <>🚫 Không khả dụng</>
                                )}
                            </button>

                            {canDownload() && <p className="text-xs text-gray-500 mt-3">Chỉ hoạt động trên thiết bị iOS</p>}
                        </div>

                        {/* QR Code */}
                        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                            <h3 className="font-semibold text-gray-900 mb-4">📱 QR Code</h3>
                            <div className="flex justify-center mb-4">
                                {qrCodeDataUrl ? (
                                    <img src={qrCodeDataUrl} alt="QR Code for app download" className="w-32 h-32 border border-gray-200 rounded-lg p-2" />
                                ) : (
                                    <div className="w-48 h-48 border border-gray-200 rounded-lg bg-gray-100 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">Quét để mở trang này trên điện thoại</p>
                        </div>

                        {/* Share Link */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">🔗 Chia sẻ link</h3>
                            <div className="flex space-x-2">
                                <input type="text" value={typeof window !== 'undefined' ? window.location.href : ''} readOnly className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-gray-50" />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        alert('Đã copy link!');
                                    }}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-black transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        {/* Build Info */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">ℹ️ Thông tin build</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-600">Build ID:</span>
                                    <code className="ml-2 text-xs bg-gray-100 px-2 py-1 text-black rounded">{build.buildId}</code>
                                </div>
                                <div>
                                    <span className="text-gray-600">File name:</span>
                                    <span className="ml-2 text-gray-900">{build.originalFilename}</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Tạo lúc:</span>
                                    <span className="ml-2 text-gray-900">{formatDate(build.createdAt)}</span>
                                </div>
                                {build.expiresAt && (
                                    <div>
                                        <span className="text-gray-600">Hết hạn:</span>
                                        <span className="ml-2 text-gray-900">{formatDate(build.expiresAt)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <Link href="/" className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                        <span>←</span>
                        <span>Về trang chủ</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
