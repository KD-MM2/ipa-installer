'use client';

import { useState, useEffect, useCallback } from 'react';
import { StorageUtils } from '@/lib/storage-utils';
import { api } from '@/lib/axios-client';

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

export default function AdminPage() {
    const [builds, setBuilds] = useState<Build[]>([]);
    const [loading, setLoading] = useState(true);
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
    const [editingBuild, setEditingBuild] = useState<string | null>(null);
    const [editData, setEditData] = useState({
        status: '',
        maxDownloads: '',
        expiresAt: ''
    });

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

    const handleDelete = async (buildId: string) => {
        if (!confirm('Bạn có chắc muốn xóa build này? Hành động này không thể hoàn tác.')) {
            return;
        }

        try {
            const response = await api.delete('/api/admin/builds', {
                data: { buildId }
            });

            const data = response.data;
            if (data.success) {
                alert('Build đã được lên lịch xóa thành công');
                fetchBuilds();
            } else {
                alert(`Lỗi: ${data.error}`);
            }
        } catch (error) {
            console.error('Error deleting build:', error);
            alert('Có lỗi xảy ra khi xóa build');
        }
    };

    const handleDownload = (buildId: string) => {
        window.open(`/api/download?buildId=${buildId}`, '_blank');
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
        }
    };

    const getStatusBadge = (status: string) => {
        const statusColors = {
            processing: 'bg-yellow-100 text-yellow-800',
            active: 'bg-green-100 text-green-800',
            expired: 'bg-red-100 text-red-800',
            disabled: 'bg-gray-100 text-gray-800',
            failed: 'bg-red-100 text-red-800'
        };

        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-gray-900">Admin - Quản lý Builds</h1>
                    </div>

                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <form onSubmit={handleSearch} className="flex-1">
                                <div className="flex">
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm theo tên app, bundle ID, build ID, version..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        Tìm
                                    </button>
                                </div>
                            </form>

                            <div className="flex gap-2">
                                {['all', 'processing', 'active', 'expired', 'disabled', 'failed'].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusFilter(status)}
                                        className={`px-3 py-2 rounded-md text-sm font-medium ${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        {status === 'all' ? 'Tất cả' : status}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex justify-center items-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">App</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hết hạn</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {builds.map((build) => (
                                        <tr key={build.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {build.iconUrl && <img className="h-10 w-10 rounded mr-3" src={build.iconUrl} alt="App icon" />}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{build.appName}</div>
                                                        <div className="text-sm text-gray-500">{build.bundleId}</div>
                                                        <div className="text-xs text-gray-400">ID: {build.buildId}</div>
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
                                                    <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="text-sm border border-gray-300 rounded px-2 py-1">
                                                        <option value="processing">processing</option>
                                                        <option value="active">active</option>
                                                        <option value="disabled">disabled</option>
                                                        <option value="expired">expired</option>
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
                                                        className="text-sm border border-gray-300 rounded px-2 py-1 w-20"
                                                    />
                                                ) : (
                                                    <div className="text-sm text-gray-900">
                                                        {build.downloadCount}/{build.maxDownloads || '∞'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingBuild === build.buildId ? (
                                                    <input type="datetime-local" value={editData.expiresAt} onChange={(e) => setEditData({ ...editData, expiresAt: e.target.value })} className="text-sm border border-gray-300 rounded px-2 py-1" />
                                                ) : (
                                                    <div className="text-sm text-gray-500">{build.expiresAt ? formatDate(build.expiresAt) : 'Không'}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(build.createdAt)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {editingBuild === build.buildId ? (
                                                    <div className="flex gap-2">
                                                        <button onClick={saveEdit} className="text-green-600 hover:text-green-900">
                                                            Lưu
                                                        </button>
                                                        <button onClick={cancelEdit} className="text-gray-600 hover:text-gray-900">
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => startEdit(build)} className="text-blue-600 hover:text-blue-900">
                                                            Sửa
                                                        </button>
                                                        <button onClick={() => handleDownload(build.buildId)} className="text-green-600 hover:text-green-900">
                                                            Tải
                                                        </button>
                                                        <a href={`/app/${build.buildId}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-900">
                                                            Xem
                                                        </a>
                                                        <button onClick={() => handleDelete(build.buildId)} className="text-red-600 hover:text-red-900">
                                                            Xóa
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

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-700">
                                Hiển thị {(pagination.page - 1) * pagination.limit + 1} đến {Math.min(pagination.page * pagination.limit, pagination.total)} trong tổng số {pagination.total} kết quả
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                                    disabled={!pagination.hasPrev}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Trước
                                </button>
                                <span className="px-3 py-2 text-sm font-medium text-gray-700">
                                    Trang {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                                    disabled={!pagination.hasNext}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
