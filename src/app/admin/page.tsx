'use client';

import { api } from '@/lib/axios-client';
import { StorageUtils } from '@/lib/storage-utils';
import Link from 'next/link';

import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Card } from 'primereact/card';
import { Column } from 'primereact/column';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
// PrimeReact Components
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Paginator } from 'primereact/paginator';
import { Panel } from 'primereact/panel';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Tag } from 'primereact/tag';
import { Toolbar } from 'primereact/toolbar';
import { useCallback, useEffect, useState } from 'react';

interface App {
    id: string;
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

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

const statusText = {
    all: 'Tất cả',
    active: 'Đang hoạt động',
    processing: 'Đang xử lý',
    expired: 'Đã hết hạn',
    disabled: 'Đã tắt',
    failed: 'Đã thất bại',
    unknown: 'Không xác định'
};

const statusOptions = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Đang hoạt động', value: 'active' },
    { label: 'Đang xử lý', value: 'processing' },
    { label: 'Đã hết hạn', value: 'expired' },
    { label: 'Đã tắt', value: 'disabled' },
    { label: 'Đã thất bại', value: 'failed' }
];

export default function AdminPage() {
    const [apps, setApps] = useState<App[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
    });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [editingApp, setEditingApp] = useState<string | null>(null);
    const [editData, setEditData] = useState({
        status: '',
        maxDownloads: null as number | null,
        expiresAt: null as Date | null
    });
    const [selectedApps, setSelectedApps] = useState<App[]>([]);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        processing: 0,
        expired: 0,
        totalDownloads: 0
    });

    const getStatusText = (status: string) => {
        return statusText[status as keyof typeof statusText] || status;
    };

    const fetchApps = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                ...(search && { search }),
                ...(statusFilter !== 'all' && { status: statusFilter })
            });

            const response = await api.get(`/api/admin/apps?${params}`);
            const data = response.data;

            if (data.success) {
                setApps(data.data);
                setPagination(data.pagination);

                const newStats = {
                    total: data.pagination.total,
                    active: data.data.filter((b: App) => b.status === 'active').length,
                    processing: data.data.filter((b: App) => b.status === 'processing').length,
                    expired: data.data.filter((b: App) => b.status === 'expired').length,
                    totalDownloads: data.data.reduce((sum: number, b: App) => sum + b.downloadCount, 0)
                };
                setStats(newStats);
            }
        } catch (error) {
            console.error('Error fetching apps:', error);
        }
        setLoading(false);
    }, [pagination.page, pagination.limit, search, statusFilter]);

    useEffect(() => {
        fetchApps();
    }, [fetchApps]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination({ ...pagination, page: 1 });
        fetchApps();
    };

    const handleDelete = (appId: string) => {
        confirmDialog({
            message: 'Bạn có chắc muốn xóa vĩnh viễn ứng dụng này khỏi hệ thống? Hành động này không thể hoàn tác.',
            header: 'Xóa Ứng dụng',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Xóa',
            rejectLabel: 'Hủy',
            accept: async () => {
                setActionLoading(appId);
                try {
                    const response = await api.delete('/api/admin/apps', {
                        data: { appId }
                    });

                    const data = response.data;
                    if (data.success) {
                        //alert('Ứng dụng đã được xóa thành công');
                        fetchApps();
                        setSelectedApps((prev) => prev.filter((app) => app.appId !== appId));
                    } else {
                        //alert(`Lỗi: ${data.error}`);
                    }
                } catch (error) {
                    console.error('Error deleting app:', error);
                    //alert('Có lỗi xảy ra khi xóa ứng dụng');
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleBulkDelete = () => {
        if (selectedApps.length === 0) return;

        confirmDialog({
            message: `Bạn có chắc muốn xóa vĩnh viễn ${selectedApps.length} ứng dụng đã chọn? Hành động này không thể hoàn tác.`,
            header: 'Xóa nhiều Ứng dụng',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Xóa tất cả',
            rejectLabel: 'Hủy',
            accept: async () => {
                setActionLoading('bulk-delete');
                try {
                    const response = await api.delete('/api/admin/apps', {
                        data: { appIds: selectedApps.map((app) => app.appId) }
                    });

                    const data = response.data;
                    if (data.success) {
                        //alert(`Đã xóa vĩnh viễn ${data.deletedCount || selectedApps.length} ứng dụng thành công`);
                        fetchApps();
                        setSelectedApps([]);
                    } else {
                        //alert(`Lỗi: ${data.error}`);
                    }
                } catch (error) {
                    console.error('Error bulk deleting apps:', error);
                    //alert('Có lỗi xảy ra khi xóa ứng dụng');
                } finally {
                    setActionLoading(null);
                }
            }
        });
    };

    const handleExport = () => {
        const csvData = apps.map((app) => ({
            'App ID': app.appId,
            'App Name': app.appName,
            'Bundle ID': app.bundleId,
            Version: app.version,
            'Build Number': app.buildNumber,
            Status: app.status,
            Downloads: app.downloadCount,
            'Max Downloads': app.maxDownloads || 'Unlimited',
            'File Size': StorageUtils.formatFileSize(parseInt(app.fileSize)),
            'Created At': formatDate(app.createdAt),
            'Expires At': app.expiresAt ? formatDate(app.expiresAt) : 'Never'
        }));

        const csvContent = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map((row) =>
                Object.values(row)
                    .map((value) => `"${value}"`)
                    .join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `apps-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownload = async (app: App) => {
        if (!app || app.status !== 'active') {
            //alert('Ứng dụng không khả dụng để cài đặt');
            return;
        }

        try {
            const response = await api.post('/api/download', {
                appId: app.appId
            });

            if (response.status !== 200) {
                // const errorData = response.data;
                //alert(errorData.error || 'Không thể tải xuống lúc này');
                return;
            }

            const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(app.plistUrl)}`;
            window.location.href = installUrl;

            fetchApps();
        } catch (error) {
            console.error('Error downloading app:', error);
            //alert('Có lỗi xảy ra khi tải ứng dụng');
        }
    };

    const startEdit = (app: App) => {
        setEditingApp(app.appId);
        setEditData({
            status: app.status,
            maxDownloads: app.maxDownloads || null,
            expiresAt: app.expiresAt ? new Date(app.expiresAt) : null
        });
        setEditDialogVisible(true);
    };

    const saveEdit = async () => {
        if (!editingApp) return;

        setActionLoading(editingApp);
        try {
            const updates: {
                status: string;
                maxDownloads?: number;
                expiresAt?: string;
            } = {
                status: editData.status
            };

            if (editData.maxDownloads) {
                updates.maxDownloads = editData.maxDownloads;
            }

            if (editData.expiresAt) {
                updates.expiresAt = editData.expiresAt.toISOString();
            }

            const response = await api.patch('/api/admin/apps', {
                appId: editingApp,
                updates
            });

            const data = response.data;
            if (data.success) {
                //alert('Cập nhật thành công');
                setEditDialogVisible(false);
                setEditingApp(null);
                fetchApps();
            } else {
                //alert(`Lỗi: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating app:', error);
            //alert('Có lỗi xảy ra khi cập nhật');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusSeverity = (status: string) => {
        switch (status) {
            case 'active':
                return 'success';
            case 'processing':
                return 'warning';
            case 'expired':
                return 'danger';
            case 'disabled':
                return 'secondary';
            case 'failed':
                return 'danger';
            default:
                return 'info';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    const formatRelativeTime = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffDays > 0) {
            return `${diffDays} ngày trước`;
        } else if (diffHours > 0) {
            return `${diffHours} giờ trước`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} phút trước`;
        } else {
            return 'Vừa xong';
        }
    };

    const isExpiredSoon = (expiresAt: string | undefined) => {
        if (!expiresAt) return false;
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 7 && diffDays > 0;
    };

    const isExpired = (expiresAt: string | undefined) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    // Template functions for DataTable columns
    const appTemplate = (rowData: App) => (
        <div className="flex align-items-center">
            {rowData.iconUrl && (
                <img
                    className="w-3rem h-3rem border-round mr-3"
                    src={rowData.iconUrl}
                    width={64}
                    alt="App icon"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            )}
            <div>
                <div className="font-medium">{rowData.appName}</div>
                <div className="text-sm text-600">{rowData.bundleId}</div>
                <div className="text-xs text-400 font-mono">{rowData.appId}</div>
            </div>
        </div>
    );

    const versionTemplate = (rowData: App) => (
        <div>
            <div>{rowData.version}</div>
            <div className="text-sm text-600">Build {rowData.buildNumber}</div>
            <div className="text-xs text-400">{StorageUtils.formatFileSize(parseInt(rowData.fileSize))}</div>
        </div>
    );

    const statusTemplate = (rowData: App) => <Tag value={getStatusText(rowData.status)} severity={getStatusSeverity(rowData.status)} />;

    const downloadsTemplate = (rowData: App) => (
        <div>
            <span className={rowData.downloadCount >= (rowData.maxDownloads || Infinity) ? 'text-red-500 font-medium' : ''}>{rowData.downloadCount}</span>/{rowData.maxDownloads || '∞'}
        </div>
    );

    const expiresTemplate = (rowData: App) => {
        if (!rowData.expiresAt) return 'Không giới hạn';

        const expired = isExpired(rowData.expiresAt);
        const expiringSoon = isExpiredSoon(rowData.expiresAt);

        return (
            <div className={expired ? 'text-red-500' : expiringSoon ? 'text-yellow-500' : ''}>
                <div>{formatDate(rowData.expiresAt)}</div>
                <div className="text-xs">{expired ? 'Đã hết hạn' : expiringSoon ? 'Sắp hết hạn' : 'Còn hiệu lực'}</div>
            </div>
        );
    };

    const createdTemplate = (rowData: App) => (
        <div>
            <div>{formatDate(rowData.createdAt)}</div>
            <div className="text-xs text-400">{formatRelativeTime(rowData.createdAt)}</div>
        </div>
    );

    const actionsTemplate = (rowData: App) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" size="small" onClick={() => startEdit(rowData)} tooltip="Sửa" />
            <Button icon="pi pi-download" size="small" severity="success" onClick={() => handleDownload(rowData)} tooltip="Tải" />
            <Link href={`/app/${rowData.appId}`} target="_blank" rel="noopener noreferrer">
                <Button icon="pi pi-eye" size="small" severity="info" tooltip="Xem" />
            </Link>
            <Button icon="pi pi-trash" size="small" severity="danger" onClick={() => handleDelete(rowData.appId)} loading={actionLoading === rowData.appId} tooltip="Xóa" />
        </div>
    );

    const toolbarStartContent = (
        <div className="flex align-items-center gap-2">
            <h1 className="text-2xl font-bold m-0">Admin - Quản lý Ứng dụng</h1>
        </div>
    );

    const toolbarEndContent = (
        <div className="flex gap-2">
            <Button label="Export CSV" icon="pi pi-download" severity="success" onClick={handleExport} disabled={apps.length === 0 || loading} />
            <Button label="Làm mới" icon="pi pi-refresh" onClick={fetchApps} loading={loading} />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-xl mx-auto">
                <ConfirmDialog />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <div className="w-full">
                        <Card className="text-center h-full">
                            <div className="text-2xl font-bold text-blue-500 mb-2">📱</div>
                            <div className="text-600 mb-1">Tổng Ứng dụng</div>
                            <div className="text-2xl font-semibold">{stats.total}</div>
                        </Card>
                    </div>
                    <div className="w-full">
                        <Card className="text-center h-full">
                            <div className="text-2xl font-bold text-green-500 mb-2">✓</div>
                            <div className="text-600 mb-1">Đang Hoạt Động</div>
                            <div className="text-2xl font-semibold">{stats.active}</div>
                        </Card>
                    </div>
                    <div className="w-full">
                        <Card className="text-center h-full">
                            <div className="text-2xl font-bold text-yellow-500 mb-2">⏳</div>
                            <div className="text-600 mb-1">Đang Xử Lý</div>
                            <div className="text-2xl font-semibold">{stats.processing}</div>
                        </Card>
                    </div>
                    <div className="w-full">
                        <Card className="text-center h-full">
                            <div className="text-2xl font-bold text-red-500 mb-2">⚠️</div>
                            <div className="text-600 mb-1">Đã Hết Hạn</div>
                            <div className="text-2xl font-semibold">{stats.expired}</div>
                        </Card>
                    </div>
                    <div className="w-full">
                        <Card className="text-center h-full">
                            <div className="text-2xl font-bold text-purple-500 mb-2">⬇️</div>
                            <div className="text-600 mb-1">Tổng Lượt tải</div>
                            <div className="text-2xl font-semibold">{stats.totalDownloads}</div>
                        </Card>
                    </div>
                </div>

                <Panel className="mt-4">
                    <Toolbar start={toolbarStartContent} end={toolbarEndContent} className="mb-4" />

                    {/* Filters */}
                    <div className="flex flex-column lg:flex-row gap-3 mb-4 align-items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-2">Tìm kiếm</label>
                            <div className="p-inputgroup">
                                <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm theo tên app, bundle ID, app ID, phiên bản..." onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)} />
                                <Button icon="pi pi-search" onClick={handleSearch} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Trạng thái</label>
                            <Dropdown
                                value={statusFilter}
                                options={statusOptions}
                                onChange={(e) => {
                                    setStatusFilter(e.value);
                                    setPagination({ ...pagination, page: 1 });
                                }}
                                className="w-12rem"
                            />
                        </div>

                        {selectedApps.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Thao tác hàng loạt</label>
                                <div className="flex gap-2">
                                    <Button label={`${selectedApps.length} đã chọn`} severity="secondary" size="small" disabled />
                                    <Button label="Xóa đã chọn" icon="pi pi-trash" severity="danger" onClick={handleBulkDelete} loading={actionLoading === 'bulk-delete'} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Data Table */}
                    {loading ? (
                        <div className="flex justify-content-center align-items-center p-8">
                            <div className="text-center">
                                <ProgressSpinner style={{ width: '50px', height: '50px' }} />
                                <div className="mt-3">Đang tải dữ liệu...</div>
                            </div>
                        </div>
                    ) : (
                        <DataTable
                            value={apps}
                            selection={selectedApps}
                            onSelectionChange={(e: { value: App[] }) => setSelectedApps(e.value as any)}
                            dataKey="appId"
                            paginator={false}
                            emptyMessage="Không có ứng dụng nào"
                            // responsiveLayout="scroll"
                            scrollable
                            className="p-datatable-sm"
                            selectionMode="multiple"
                        >
                            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
                            <Column field="appName" header="Ứng dụng" body={appTemplate} />
                            <Column field="version" header="Phiên bản" body={versionTemplate} />
                            <Column field="status" header="Trạng thái" body={statusTemplate} />
                            <Column field="downloadCount" header="Lượt tải" body={downloadsTemplate} />
                            <Column field="expiresAt" header="Hết hạn" body={expiresTemplate} />
                            <Column field="createdAt" header="Ngày tạo" body={createdTemplate} />
                            <Column header="Thao tác" body={actionsTemplate} style={{ width: '12rem' }} />
                        </DataTable>
                    )}

                    {/* Pagination */}
                    {!loading && apps.length > 0 && pagination.totalPages > 1 && (
                        <Paginator first={(pagination.page - 1) * pagination.limit} rows={pagination.limit} totalRecords={pagination.total} onPageChange={(e) => setPagination({ ...pagination, page: e.page + 1 })} className="mt-4" />
                    )}
                </Panel>

                {/* Edit Dialog */}
                <Dialog
                    header="Chỉnh sửa ứng dụng"
                    visible={editDialogVisible}
                    style={{ width: '450px' }}
                    onHide={() => setEditDialogVisible(false)}
                    footer={
                        <div>
                            <Button label="Hủy" icon="pi pi-times" outlined onClick={() => setEditDialogVisible(false)} />
                            <Button label="Lưu" icon="pi pi-check" onClick={saveEdit} loading={actionLoading === editingApp} />
                        </div>
                    }
                >
                    <div className="field">
                        <label htmlFor="status" className="font-bold">
                            Trạng thái
                        </label>
                        <Dropdown
                            id="status"
                            value={editData.status}
                            options={[
                                { label: 'Đang xử lý', value: 'processing' },
                                { label: 'Đang hoạt động', value: 'active' },
                                { label: 'Đã tắt', value: 'disabled' },
                                { label: 'Đã hết hạn', value: 'expired' }
                            ]}
                            onChange={(e) => setEditData({ ...editData, status: e.value })}
                            className="w-full"
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="maxDownloads" className="font-bold">
                            Số lượt tải tối đa
                        </label>
                        <InputNumber id="maxDownloads" value={editData.maxDownloads} onValueChange={(e) => setEditData({ ...editData, maxDownloads: e.value ?? null })} placeholder="Không giới hạn" className="w-full" />
                    </div>

                    <div className="field">
                        <label htmlFor="expiresAt" className="font-bold">
                            Ngày hết hạn
                        </label>
                        <Calendar id="expiresAt" value={editData.expiresAt} onChange={(e) => setEditData({ ...editData, expiresAt: e.value as Date })} showTime dateFormat="dd/mm/yy" className="w-full" />
                    </div>
                </Dialog>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <Link href="/">
                        <Button icon="pi pi-arrow-left" label="Về trang chủ" text className="text-gray-600 hover:text-gray-900" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
