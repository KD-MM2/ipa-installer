'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { StorageUtils } from '@/lib/storage-utils';
import { api } from '@/lib/axios-client';
import Link from 'next/link';

interface Build {
    id: string;
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

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

interface SortConfig {
    key: keyof Build | '';
    direction: 'asc' | 'desc';
}

interface ConfirmModal {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmAction: () => void;
    type: 'danger' | 'warning' | 'info';
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

export default function AdminPage() {
    const [builds, setBuilds] = useState<Build[]>([]);
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
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: 'desc' });
    const [editingBuild, setEditingBuild] = useState<string | null>(null);
    const [editData, setEditData] = useState({
        status: '',
        maxDownloads: '',
        expiresAt: ''
    });
    const [selectedBuilds, setSelectedBuilds] = useState<string[]>([]);
    const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        confirmAction: () => {},
        type: 'danger'
    });
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

    // Memoized sorted and filtered builds
    const sortedBuilds = useMemo(() => {
        if (!sortConfig.key) return builds;

        return [...builds].sort((a, b) => {
            const aValue = a[sortConfig.key as keyof Build];
            const bValue = b[sortConfig.key as keyof Build];

            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const result = aValue.localeCompare(bValue);
                return sortConfig.direction === 'asc' ? result : -result;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [builds, sortConfig]);

    const fetchBuilds = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                ...(search && { search }),
                ...(statusFilter !== 'all' && { status: statusFilter })
            });

            const response = await api.get(`/api/admin/builds?${params}`);
            const data = response.data;

            if (data.success) {
                setBuilds(data.data);
                setPagination(data.pagination);

                // Calculate stats
                const newStats = {
                    total: data.pagination.total,
                    active: data.data.filter((b: Build) => b.status === 'active').length,
                    processing: data.data.filter((b: Build) => b.status === 'processing').length,
                    expired: data.data.filter((b: Build) => b.status === 'expired').length,
                    totalDownloads: data.data.reduce((sum: number, b: Build) => sum + b.downloadCount, 0)
                };
                setStats(newStats);
            }
        } catch (error) {
            console.error('Error fetching builds:', error);
        }
        setLoading(false);
    }, [pagination.page, pagination.limit, search, statusFilter]);

    useEffect(() => {
        fetchBuilds();
    }, [fetchBuilds]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination({ ...pagination, page: 1 });
        fetchBuilds();
    };

    const handleStatusFilter = (status: string) => {
        setStatusFilter(status);
        setPagination({ ...pagination, page: 1 });
    };

    const handleSort = (key: keyof Build) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSelectAll = () => {
        if (selectedBuilds.length === builds.length) {
            setSelectedBuilds([]);
        } else {
            setSelectedBuilds(builds.map((build) => build.buildId));
        }
    };

    const handleSelectBuild = (buildId: string) => {
        setSelectedBuilds((prev) => (prev.includes(buildId) ? prev.filter((id) => id !== buildId) : [...prev, buildId]));
    };

    const openConfirmModal = (title: string, message: string, confirmText: string, action: () => void, type: 'danger' | 'warning' | 'info' = 'danger') => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            confirmText,
            confirmAction: action,
            type
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    };

    const handleDelete = async (buildId: string) => {
        openConfirmModal('Xóa Build', `Bạn có chắc muốn xóa vĩnh viễn build này khỏi hệ thống? Hành động này không thể hoàn tác.`, 'Xóa', async () => {
            setActionLoading(buildId);
            try {
                const response = await api.delete('/api/admin/builds', {
                    data: { buildId }
                });

                const data = response.data;
                if (data.success) {
                    alert('Build đã được xóa vĩnh viễn thành công');
                    fetchBuilds();
                    setSelectedBuilds((prev) => prev.filter((id) => id !== buildId));
                } else {
                    alert(`Lỗi: ${data.error}`);
                }
            } catch (error) {
                console.error('Error deleting build:', error);
                alert('Có lỗi xảy ra khi xóa build');
            } finally {
                setActionLoading(null);
                closeConfirmModal();
            }
        });
    };

    const handleBulkDelete = () => {
        if (selectedBuilds.length === 0) return;

        openConfirmModal('Xóa nhiều Builds', `Bạn có chắc muốn xóa vĩnh viễn ${selectedBuilds.length} builds đã chọn? Hành động này không thể hoàn tác.`, 'Xóa tất cả', async () => {
            setActionLoading('bulk-delete');
            try {
                // Use bulk delete API
                const response = await api.delete('/api/admin/builds', {
                    data: { buildIds: selectedBuilds }
                });

                const data = response.data;
                if (data.success) {
                    alert(`Đã xóa vĩnh viễn ${data.deletedCount || selectedBuilds.length} builds thành công`);
                    fetchBuilds();
                    setSelectedBuilds([]);
                } else {
                    alert(`Lỗi: ${data.error}`);
                }
            } catch (error) {
                console.error('Error bulk deleting builds:', error);
                alert('Có lỗi xảy ra khi xóa builds');
            } finally {
                setActionLoading(null);
                closeConfirmModal();
            }
        });
    };

    const handleExport = () => {
        const csvData = builds.map((build) => ({
            'Build ID': build.buildId,
            'App Name': build.appName,
            'Bundle ID': build.bundleId,
            Version: build.version,
            'Build Number': build.buildNumber,
            Status: build.status,
            Downloads: build.downloadCount,
            'Max Downloads': build.maxDownloads || 'Unlimited',
            'File Size': StorageUtils.formatFileSize(parseInt(build.fileSize)),
            'Created At': formatDate(build.createdAt),
            'Expires At': build.expiresAt ? formatDate(build.expiresAt) : 'Never'
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
        link.setAttribute('download', `builds-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownload = async (build: Build) => {
        if (!build || build.status !== 'active') {
            alert('Build không khả dụng để cài đặt');
            return;
        }

        try {
            // Increment download count first
            const response = await api.post('/api/download', {
                buildId: build.buildId
            });

            if (response.status !== 200) {
                const errorData = response.data;
                alert(errorData.error || 'Không thể tải xuống lúc này');
                return;
            }

            // Use itms-services link for direct installation (like in app detail page)
            const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(build.plistUrl)}`;
            window.location.href = installUrl;

            // Refresh the build list to show updated download count
            fetchBuilds();
        } catch (error) {
            console.error('Error downloading app:', error);
            alert('Có lỗi xảy ra khi tải ứng dụng');
        }
    };

    const startEdit = (build: Build) => {
        setEditingBuild(build.buildId);
        setEditData({
            status: build.status,
            maxDownloads: build.maxDownloads?.toString() || '',
            expiresAt: build.expiresAt ? new Date(build.expiresAt).toISOString().slice(0, 16) : ''
        });
    };

    const cancelEdit = () => {
        setEditingBuild(null);
        setEditData({ status: '', maxDownloads: '', expiresAt: '' });
    };

    const saveEdit = async () => {
        if (!editingBuild) return;

        setActionLoading(editingBuild);
        try {
            const updates: {
                status: string;
                maxDownloads?: number;
                expiresAt?: string;
            } = {
                status: editData.status
            };

            if (editData.maxDownloads) {
                updates.maxDownloads = parseInt(editData.maxDownloads);
            }

            if (editData.expiresAt) {
                updates.expiresAt = editData.expiresAt;
            }

            const response = await api.patch('/api/admin/builds', {
                buildId: editingBuild,
                updates
            });

            const data = response.data;
            if (data.success) {
                alert('Cập nhật thành công');
                cancelEdit();
                fetchBuilds();
            } else {
                alert(`Lỗi: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating build:', error);
            alert('Có lỗi xảy ra khi cập nhật');
        } finally {
            setActionLoading(null);
        }
    };

    const getSortIcon = (key: keyof Build) => {
        if (sortConfig.key !== key) {
            return <span className="text-gray-400">⇅</span>;
        }
        return sortConfig.direction === 'asc' ? <span className="text-blue-600">↑</span> : <span className="text-blue-600">↓</span>;
    };

    const getStatusBadge = (status: string) => {
        const statusColors = {
            processing: 'bg-yellow-100 text-yellow-800',
            active: 'bg-green-100 text-green-800',
            expired: 'bg-red-100 text-red-800',
            disabled: 'bg-gray-100 text-gray-800',
            failed: 'bg-red-100 text-red-800'
        };

        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>{getStatusText(status)}</span>;
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
        return diffDays <= 7 && diffDays > 0; // Expires within 7 days
    };

    const isExpired = (expiresAt: string | undefined) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">📱</span>
                                </div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Tổng Builds</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">✓</span>
                                </div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Đang Hoạt Động</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.active}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">⏳</span>
                                </div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Đang Xử Lý</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.processing}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">⚠️</span>
                                </div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Đã Hết Hạn</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.expired}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">⬇️</span>
                                </div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Tổng Downloads</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.totalDownloads}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h1 className="text-2xl font-bold text-gray-900">Admin - Quản lý Builds</h1>
                        <div className="flex gap-2">
                            <button
                                onClick={handleExport}
                                disabled={builds.length === 0 || loading}
                                className="btn px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                📊 Export CSV
                            </button>
                            <button onClick={fetchBuilds} disabled={loading} className="btn px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {loading ? '🔄 Đang tải...' : '🔄 Làm mới'}
                            </button>
                        </div>
                    </div>

                    {/* Filters and Bulk Actions */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex flex-col lg:flex-row gap-4 justify-between">
                            <form onSubmit={handleSearch} className="flex-1 max-w-md">
                                <div className="flex">
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm theo tên app, bundle ID, build ID, phiên bản..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                    <button type="submit" className="btn px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                                        Tìm
                                    </button>
                                </div>
                            </form>

                            <div className="flex flex-wrap gap-2">
                                {/* Status Filter */}
                                <div className="flex gap-1">
                                    {['all', 'processing', 'active', 'expired', 'disabled', 'failed'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => handleStatusFilter(status)}
                                            className={`btn px-3 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                        >
                                            {getStatusText(status)}
                                        </button>
                                    ))}
                                </div>

                                {/* Bulk Actions */}
                                {selectedBuilds.length > 0 && (
                                    <div className="flex gap-2 ml-4 pl-4 border-l border-gray-300 justify-center items-center">
                                        <span className="px-3 py-2 text-sm text-gray-600">{selectedBuilds.length} đã chọn</span>
                                        <button
                                            onClick={handleBulkDelete}
                                            disabled={actionLoading === 'bulk-delete'}
                                            className="btn px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                        >
                                            {actionLoading === 'bulk-delete' ? 'Đang xóa...' : 'Xóa đã chọn'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Table */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                    <p className="text-gray-600">Đang tải dữ liệu...</p>
                                </div>
                            </div>
                        ) : builds.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <div className="text-6xl mb-4">📱</div>
                                <h3 className="text-lg font-medium mb-2">Không có builds nào</h3>
                                <p className="text-sm">{search || statusFilter !== 'all' ? 'Không tìm thấy builds phù hợp với bộ lọc' : 'Chưa có builds nào được tải lên'}</p>
                            </div>
                        ) : (
                            <div className="block md:hidden">
                                {/* Mobile Card View */}
                                <div className="space-y-4 p-4">
                                    {sortedBuilds.map((build) => (
                                        <div key={build.id} className={`bg-white border rounded-lg p-4 ${selectedBuilds.includes(build.buildId) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" checked={selectedBuilds.includes(build.buildId)} onChange={() => handleSelectBuild(build.buildId)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                    {build.iconUrl && (
                                                        <img
                                                            className="h-12 w-12 rounded-lg border border-gray-200"
                                                            src={build.iconUrl}
                                                            alt="App icon"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <div className="flex flex-col items-start justify-center">
                                                        <h3 className="font-medium text-gray-900">{build.displayName || build.appName}</h3>
                                                        <p className="text-sm text-gray-600">{build.bundleId}</p>
                                                        <p className="text-sm text-gray-500">
                                                            Phiên bản {build.version} ({build.buildNumber})
                                                        </p>
                                                    </div>
                                                </div>
                                                {getStatusBadge(build.status)}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Downloads:</span>
                                                    <span className={build.downloadCount >= (build.maxDownloads || Infinity) ? 'text-red-600 font-medium' : ''}>
                                                        {build.downloadCount}/{build.maxDownloads || '∞'}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Kích thước:</span>
                                                    <span>{StorageUtils.formatFileSize(parseInt(build.fileSize))}</span>
                                                </div>

                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Tạo lúc:</span>
                                                    <span>{formatRelativeTime(build.createdAt)}</span>
                                                </div>

                                                {build.expiresAt && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-500">Hết hạn:</span>
                                                        <span className={isExpired(build.expiresAt) ? 'text-red-600 font-medium' : isExpiredSoon(build.expiresAt) ? 'text-yellow-600 font-medium' : ''}>
                                                            {isExpired(build.expiresAt) ? 'Đã hết hạn' : isExpiredSoon(build.expiresAt) ? 'Sắp hết hạn' : formatRelativeTime(build.expiresAt)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200">
                                                <button onClick={() => startEdit(build)} className="btn px-2 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                                    Sửa
                                                </button>
                                                <button onClick={() => handleDownload(build)} className="btn px-2 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                                                    Tải
                                                </button>
                                                <Link href={`/app/${build.buildId}`} target="_blank" rel="noopener noreferrer" className="btn px-2 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700">
                                                    Xem
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(build.buildId)}
                                                    disabled={actionLoading === build.buildId}
                                                    className="btn px-2 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    {actionLoading === build.buildId ? 'Đang xóa...' : 'Xóa'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Desktop Table View */}
                        {!loading && builds.length > 0 && (
                            <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left">
                                            <input type="checkbox" checked={selectedBuilds.length === builds.length && builds.length > 0} onChange={handleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('appName')}>
                                            <div className="flex items-center gap-1">Ứng dụng {getSortIcon('appName')}</div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('version')}>
                                            <div className="flex items-center gap-1">Phiên bản {getSortIcon('version')}</div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                                            <div className="flex items-center gap-1">Trạng thái {getSortIcon('status')}</div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('downloadCount')}>
                                            <div className="flex items-center gap-1">Lượt tải {getSortIcon('downloadCount')}</div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('expiresAt')}>
                                            <div className="flex items-center gap-1">Hết hạn {getSortIcon('expiresAt')}</div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('createdAt')}>
                                            <div className="flex items-center gap-1">Ngày tạo {getSortIcon('createdAt')}</div>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sortedBuilds.map((build) => (
                                        <tr key={build.id} className={`hover:bg-gray-50 transition-colors ${selectedBuilds.includes(build.buildId) ? 'bg-blue-50' : ''}`} onClick={() => handleSelectBuild(build.buildId)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input type="checkbox" checked={selectedBuilds.includes(build.buildId)} onChange={() => handleSelectBuild(build.buildId)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {build.iconUrl && (
                                                        <img
                                                            className="h-12 w-12 rounded-lg mr-4 border border-gray-200"
                                                            src={build.iconUrl}
                                                            alt="App icon"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={build.appName}>
                                                            {build.appName}
                                                        </div>
                                                        <div className="text-sm text-gray-500 max-w-xs truncate" title={build.bundleId}>
                                                            {build.bundleId}
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-mono">{build.buildId.substring(0, 8)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{build.version}</div>
                                                <div className="text-sm text-gray-500">Build {build.buildNumber}</div>
                                                <div className="text-xs text-gray-400">{StorageUtils.formatFileSize(parseInt(build.fileSize))}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingBuild === build.buildId ? (
                                                    <select
                                                        value={editData.status}
                                                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 text-black"
                                                        disabled={actionLoading === build.buildId}
                                                    >
                                                        <option value="processing">{getStatusText('processing')}</option>
                                                        <option value="active">{getStatusText('active')}</option>
                                                        <option value="disabled">{getStatusText('disabled')}</option>
                                                        <option value="expired">{getStatusText('expired')}</option>
                                                    </select>
                                                ) : (
                                                    getStatusBadge(build.status)
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingBuild === build.buildId ? (
                                                    <input
                                                        type="number"
                                                        value={editData.maxDownloads}
                                                        onChange={(e) => setEditData({ ...editData, maxDownloads: e.target.value })}
                                                        placeholder="Không giới hạn"
                                                        className="text-sm border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-500 text-black"
                                                        disabled={actionLoading === build.buildId}
                                                    />
                                                ) : (
                                                    <div className="text-sm text-gray-900">
                                                        <span className={build.downloadCount >= (build.maxDownloads || Infinity) ? 'text-red-600 font-medium' : ''}>{build.downloadCount}</span>/{build.maxDownloads || '∞'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingBuild === build.buildId ? (
                                                    <input
                                                        type="datetime-local"
                                                        value={editData.expiresAt}
                                                        onChange={(e) => setEditData({ ...editData, expiresAt: e.target.value })}
                                                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 text-black"
                                                        disabled={actionLoading === build.buildId}
                                                    />
                                                ) : (
                                                    <div className={`text-sm ${isExpired(build.expiresAt) ? 'text-red-600 font-medium' : isExpiredSoon(build.expiresAt) ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                                                        {build.expiresAt ? (
                                                            <div>
                                                                <div>{formatDate(build.expiresAt)}</div>
                                                                <div className="text-xs">{isExpired(build.expiresAt) ? 'Đã hết hạn' : isExpiredSoon(build.expiresAt) ? 'Sắp hết hạn' : 'Còn hiệu lực'}</div>
                                                            </div>
                                                        ) : (
                                                            'Không giới hạn'
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div>{formatDate(build.createdAt)}</div>
                                                <div className="text-xs text-gray-400">{formatRelativeTime(build.createdAt)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {editingBuild === build.buildId ? (
                                                    <div className="flex gap-2">
                                                        <button onClick={saveEdit} disabled={actionLoading === build.buildId} className="btn text-green-600 hover:text-green-900 disabled:opacity-50 transition-colors">
                                                            {actionLoading === build.buildId ? 'Đang lưu...' : 'Lưu'}
                                                        </button>
                                                        <button onClick={cancelEdit} disabled={actionLoading === build.buildId} className="btn text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors">
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                startEdit(build);
                                                            }}
                                                            className="btn text-blue-600 hover:text-blue-900 transition-colors"
                                                        >
                                                            Sửa
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleDownload(build);
                                                            }}
                                                            className="btn text-green-600 hover:text-green-900 transition-colors"
                                                        >
                                                            Tải
                                                        </button>
                                                        <Link href={`/app/${build.buildId}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-900 transition-colors">
                                                            Xem
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleDelete(build.buildId);
                                                            }}
                                                            disabled={actionLoading === build.buildId}
                                                            className="btn text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
                                                        >
                                                            {actionLoading === build.buildId ? 'Đang xóa...' : 'Xóa'}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Enhanced Pagination */}
                    {!loading && builds.length > 0 && pagination.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-gray-700">
                                Hiển thị <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> đến <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> trong tổng số{' '}
                                <span className="font-medium">{pagination.total}</span> kết quả
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPagination({ ...pagination, page: 1 })}
                                    disabled={!pagination.hasPrev}
                                    className="btn px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    ‹‹
                                </button>
                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                                    disabled={!pagination.hasPrev}
                                    className="btn px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    ‹ Trước
                                </button>

                                {/* Page Numbers */}
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (pagination.totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (pagination.page <= 3) {
                                            pageNum = i + 1;
                                        } else if (pagination.page >= pagination.totalPages - 2) {
                                            pageNum = pagination.totalPages - 4 + i;
                                        } else {
                                            pageNum = pagination.page - 2 + i;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setPagination({ ...pagination, page: pageNum })}
                                                className={`btn px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                                                    pagination.page === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                                    disabled={!pagination.hasNext}
                                    className="btn px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Sau ›
                                </button>
                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.totalPages })}
                                    disabled={!pagination.hasNext}
                                    className="btn px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    ››
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Confirmation Modal */}
                    {confirmModal.isOpen && (
                        <div className="fixed inset-0 z-50 overflow-y-auto">
                            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                                <div className="fixed inset-0 backdrop-blur bg-opacity-75 transition-opacity" onClick={closeConfirmModal}></div>

                                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                                    &#8203;
                                </span>

                                <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="sm:flex sm:items-start">
                                            <div
                                                className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                                                    confirmModal.type === 'danger' ? 'bg-red-100' : confirmModal.type === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
                                                }`}
                                            >
                                                <span className={`text-xl ${confirmModal.type === 'danger' ? 'text-red-600' : confirmModal.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`}>
                                                    {confirmModal.type === 'danger' ? '⚠️' : confirmModal.type === 'warning' ? '⚠️' : 'ℹ️'}
                                                </span>
                                            </div>
                                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">{confirmModal.title}</h3>
                                                <div className="mt-2">
                                                    <p className="text-sm text-gray-500">{confirmModal.message}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                        <button
                                            type="button"
                                            onClick={confirmModal.confirmAction}
                                            disabled={actionLoading !== null}
                                            className={`btn w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors disabled:opacity-50 ${
                                                confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                                            }`}
                                        >
                                            {actionLoading ? 'Đang xử lý...' : confirmModal.confirmText}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeConfirmModal}
                                            disabled={actionLoading !== null}
                                            className="btn mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors disabled:opacity-50"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
    );
}
