'use client';

import { api } from '@/lib/axios-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

// PrimeReact imports
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { InputText } from 'primereact/inputtext';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { useEffect, useState } from 'react';
import { useRef } from 'react';

interface AppInfo {
    appId: string;
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

export default function AppDetailPage() {
    const params = useParams();
    const appId = params.appId as string;
    const [app, setApp] = useState<AppInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const toast = useRef<Toast>(null);

    useEffect(() => {
        if (!appId) return;

        const fetchAppInfo = async () => {
            try {
                const response = await api.get(`/api/status?appId=${appId}`);
                const data = response.data;

                if (data.success && data.app) {
                    setApp(data.app);
                } else {
                    setError('App không tồn tại hoặc đã bị xóa');
                }
            } catch (err) {
                console.error('Error fetching app info:', err);
                setError('Không thể tải thông tin app');
            } finally {
                setLoading(false);
            }
        };

        fetchAppInfo();
    }, [appId]);

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
        if (!app) return;

        setIsInstalling(true);

        try {
            // Increment download count first
            const downloadResponse = await api.post('/api/download', {
                appId: app.appId
            });

            if (downloadResponse.status !== 200) {
                const errorData = downloadResponse.data;
                toast.current?.show({
                    severity: 'error',
                    summary: 'Lỗi',
                    detail: errorData.error || 'Cannot download at this time'
                });
                return;
            }

            // On iOS, this will trigger the app installation
            const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(app.plistUrl)}`;
            window.location.href = installUrl;

            // Update local download count
            const downloadData = downloadResponse.data;
            setApp((prev) =>
                prev
                    ? {
                          ...prev,
                          downloadCount: downloadData.downloadCount
                      }
                    : null
            );
        } catch (error) {
            console.error('Error installing app:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Lỗi',
                detail: 'Có lỗi xảy ra khi cài đặt ứng dụng'
            });
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
        if (!app?.expiresAt) return false;
        return new Date(app.expiresAt) < new Date();
    };

    const canDownload = (): boolean => {
        if (!app) return false;
        if (app.status !== 'active') return false;
        if (isExpired()) return false;
        if (app.maxDownloads && app.downloadCount >= app.maxDownloads) return false;
        return true;
    };

    const getStatusSeverity = (status: string): 'success' | 'info' | 'warning' | 'danger' => {
        switch (status) {
            case 'active':
                return 'success';
            case 'processing':
                return 'info';
            case 'failed':
                return 'danger';
            case 'expired':
                return 'warning';
            default:
                return 'warning';
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

    const copyToClipboard = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.current?.show({
            severity: 'success',
            summary: 'Thành công',
            detail: 'Đã copy link!',
            life: 2000
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="4" />
                    <p className="text-gray-600 mt-4">Đang tải thông tin app...</p>
                </div>
            </div>
        );
    }

    if (error || !app) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="max-w-md mx-auto text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">App không tìm thấy</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Link href="/">
                        <Button label="Về trang chủ" icon="pi pi-home" />
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <>
            <Toast ref={toast} />
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4">
                    {/* Header */}
                    {/* <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">📱 Chi tiết ứng dụng</h1>
                        <p className="text-gray-600">Thông tin và link cài đặt cho {app.displayName || app.appName}</p>
                    </div> */}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* App Info Card */}
                            <Card>
                                <div className="flex items-start gap-6">
                                    {/* App Icon */}
                                    <div className="flex-shrink-0">
                                        <img
                                            src={`/assets/icons/apps/${app.appId}/icon.png`}
                                            alt={`${app.appName} icon`}
                                            className="w-20 h-20 rounded-xl shadow-md"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>

                                    {/* App Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-row w-full justify-between items-start gap-3 mb-3">
                                            <div className="flex flex-row justify-start items-center gap-3">
                                                <h2 className="text-2xl font-bold text-gray-900 truncate">{app.displayName || app.appName}</h2>
                                                <Tag value={getStatusText(app.status)} severity={getStatusSeverity(app.status)} />
                                            </div>
                                            <div className="flex flex-row gap-2">
                                                <Button
                                                    onClick={handleInstall}
                                                    disabled={!canDownload() || isInstalling}
                                                    size="small"
                                                    severity={canDownload() && !isInstalling ? 'info' : 'secondary'}
                                                    loading={isInstalling}
                                                    loadingIcon="pi pi-spin pi-spinner"
                                                    icon={isInstalling ? undefined : canDownload() ? 'pi pi-download' : 'pi pi-ban'}
                                                    label={isInstalling ? 'Đang cài đặt...' : canDownload() ? 'Cài đặt' : 'Không khả dụng'}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm text-gray-600">
                                            <div>
                                                <span className="font-medium">ID Gói:</span> {app.bundleId}
                                            </div>
                                            <div>
                                                <span className="font-medium">Phiên bản:</span> {app.version} ({app.buildNumber})
                                            </div>
                                            {app.minimumOSVersion && (
                                                <div>
                                                    <span className="font-medium">iOS Tối thiểu:</span> {app.minimumOSVersion}
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium">Kích thước:</span> {formatFileSize(app.fileSize)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Divider />

                                {/* Download Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-600">{app.downloadCount}</div>
                                        <div className="text-sm text-gray-600">Lượt tải</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-600">{app.maxDownloads ? app.maxDownloads - app.downloadCount : '∞'}</div>
                                        <div className="text-sm text-gray-600">Còn lại</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-purple-600">{app.expiresAt ? Math.max(0, Math.ceil((new Date(app.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : '∞'}</div>
                                        <div className="text-sm text-gray-600">Ngày còn lại</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-600">{formatDate(app.createdAt).split(' ')[0]}</div>
                                        <div className="text-sm text-gray-600">Ngày tạo</div>
                                    </div>
                                </div>
                            </Card>

                            {/* Installation Instructions */}
                            <Card className="bg-blue-50">
                                <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Hướng dẫn cài đặt</h3>
                                <div className="space-y-3 text-sm text-blue-800">
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold">1.</span>
                                        <span>Mở trang này trên thiết bị iOS của bạn (iPhone/iPad)</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold">2.</span>
                                        <span>Nhấn nút &quot;Cài đặt ứng dụng&quot; bên dưới</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold">3.</span>
                                        <span>Làm theo hướng dẫn trên màn hình để hoàn tất cài đặt</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold">4.</span>
                                        <span>Vào Settings → General → VPN & Device Management để tin tưởng developer</span>
                                    </div>
                                </div>
                            </Card>

                            {/* Warning Messages */}
                            {!canDownload() && (
                                <Card className="bg-red-50 border border-red-200">
                                    <div className="flex items-center gap-2 text-red-800">
                                        <i className="pi pi-exclamation-triangle" />
                                        <span className="font-medium">{isExpired() ? 'Ứng dụng đã hết hạn' : app.status !== 'active' ? 'Ứng dụng không khả dụng' : 'Đã hết số lượt tải cho phép'}</span>
                                    </div>
                                </Card>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Install Button */}
                            {/* <Card className="text-center">
                                <Button
                                    onClick={handleInstall}
                                    disabled={!canDownload() || isInstalling}
                                    className="w-full"
                                    size="large"
                                    severity={canDownload() && !isInstalling ? 'info' : 'secondary'}
                                    loading={isInstalling}
                                    loadingIcon="pi pi-spin pi-spinner"
                                    icon={isInstalling ? undefined : canDownload() ? 'pi pi-download' : 'pi pi-ban'}
                                    label={isInstalling ? 'Đang cài đặt...' : canDownload() ? '📲 Cài đặt ứng dụng' : '🚫 Không khả dụng'}
                                />
                                {canDownload() && <p className="text-xs text-gray-500 mt-3">Chỉ hoạt động trên thiết bị iOS</p>}
                            </Card> */}

                            {/* QR Code */}
                            <Card className="text-center">
                                <h3 className="font-semibold text-gray-900 mb-4">📱 QR Code</h3>
                                <div className="flex justify-center mb-4">
                                    {qrCodeDataUrl ? (
                                        <img src={qrCodeDataUrl} alt="QR Code for app download" className="w-32 h-32 border border-gray-200 rounded-lg p-2" />
                                    ) : (
                                        <div className="w-32 h-32 border border-gray-200 rounded-lg bg-gray-100 flex items-center justify-center">
                                            <ProgressSpinner style={{ width: '24px', height: '24px' }} strokeWidth="4" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500">Quét để mở trang này trên điện thoại</p>
                            </Card>

                            {/* Share Link */}
                            <Card>
                                <h3 className="font-semibold text-gray-900 mb-4">🔗 Chia sẻ link</h3>
                                <div className="flex gap-2">
                                    <InputText value={typeof window !== 'undefined' ? window.location.href : ''} readOnly className="flex-1" />
                                    <Button onClick={copyToClipboard} icon="pi pi-copy" severity="secondary" outlined tooltip="Copy" />
                                </div>
                            </Card>

                            {/* App Info */}
                            <Card>
                                <h3 className="font-semibold text-gray-900 mb-4">ℹ️ Thông tin ứng dụng</h3>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">ID Ứng dụng:</span>
                                        <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">{app.appId}</code>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Tên tệp:</span>
                                        <span className="ml-2 text-gray-900">{app.originalFilename}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Tạo lúc:</span>
                                        <span className="ml-2 text-gray-900">{formatDate(app.createdAt)}</span>
                                    </div>
                                    {app.expiresAt && (
                                        <div>
                                            <span className="text-gray-600">Hết hạn:</span>
                                            <span className="ml-2 text-gray-900">{formatDate(app.expiresAt)}</span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center">
                        <Link href="/">
                            <Button icon="pi pi-arrow-left" label="Về trang chủ" text className="text-gray-600 hover:text-gray-900" />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
