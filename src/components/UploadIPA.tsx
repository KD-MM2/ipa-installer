'use client';

import { useState } from 'react';

interface UploadIPAProps {
    onUploadSuccess?: (result: { buildId: string; jobId: string; estimatedTime: string }) => void;
}

export default function UploadIPA({ onUploadSuccess }: UploadIPAProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const validateFile = (file: File): string | null => {
        // Check file extension
        if (!file.name.toLowerCase().endsWith('.ipa')) {
            return 'Chỉ chấp nhận file .ipa';
        }

        // Check file size (max 500MB)
        if (file.size > 500 * 1024 * 1024) {
            return 'File quá lớn. Kích thước tối đa: 500MB';
        }

        return null;
    };

    const handleFileSelect = (selectedFile: File) => {
        const validationError = validateFile(selectedFile);
        if (validationError) {
            setError(validationError);
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
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

        const droppedFile = event.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Vui lòng chọn file IPA');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', file);

            // Upload file and trigger queue processing
            const response = await fetch('/api/upload-ipa', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                onUploadSuccess?.({
                    buildId: result.buildId,
                    jobId: result.jobId,
                    estimatedTime: result.estimatedTime
                });

                // Reset form
                setFile(null);
                setError(null);
            } else {
                setError(result.error || 'Upload thất bại');
            }
        } catch (error: any) {
            setError(error.message || 'Có lỗi xảy ra khi upload');
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Upload Area */}
            <div
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-colors
                    ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="space-y-4">
                    <div className="text-6xl">📱</div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Upload file IPA</h3>
                        <p className="text-sm text-gray-600 mt-1">Kéo thả file .ipa vào đây hoặc click để chọn file</p>
                    </div>

                    <div className="space-y-2">
                        <input type="file" accept=".ipa" onChange={handleFileChange} disabled={uploading} className="hidden" id="ipa-upload" />
                        <label htmlFor="ipa-upload" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-50">
                            Chọn file IPA
                        </label>

                        <div className="text-xs text-gray-500">Kích thước tối đa: 500MB</div>
                    </div>
                </div>
            </div>

            {/* Selected File Info */}
            {file && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-gray-900">File đã chọn:</h4>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{file.name}</span>
                        <span className="text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="text-red-600 text-sm">❌ {error}</div>
                    </div>
                </div>
            )}

            {/* Upload Button */}
            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`
                    w-full py-3 px-4 rounded-lg font-medium text-white transition-colors
                    ${!file || uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                `}
            >
                {uploading ? (
                    <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Đang upload...</span>
                    </div>
                ) : (
                    'Upload IPA'
                )}
            </button>
        </div>
    );
}
