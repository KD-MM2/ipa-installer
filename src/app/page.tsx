'use client';

import UploadIPA from '@/components/UploadIPA';
import UploadSuccessState from '@/components/UploadSuccessState';
import Link from 'next/link';

import { Button } from 'primereact/button';
import { useState } from 'react';

export default function Home() {
    const [uploadResult, setUploadResult] = useState<{
        appId: string;
        jobId: string;
        estimatedTime: string;
    } | null>(null);

    const handleUploadSuccess = (result: { appId: string; jobId: string; estimatedTime: string }) => {
        setUploadResult(result);
        console.log('Upload successful:', result);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">📱 IPA Installer</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">Nền tảng phân phối app iOS đơn giản. Upload file .ipa và nhận link cài đặt ngay lập tức.</p>
                </div>

                {/* Upload Section */}
                {!uploadResult ? (
                    <div className="bg-white rounded-lg shadow-sm p-8">
                        <UploadIPA onUploadSuccess={handleUploadSuccess} />
                    </div>
                ) : (
                    /* Success State with Progress Tracking */
                    <UploadSuccessState uploadResult={uploadResult} onReset={() => setUploadResult(null)} />
                )}

                {/* Features Section */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="text-center">
                        <div className="text-3xl mb-3">🚀</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Upload nhanh chóng</h3>
                        <p className="text-sm text-gray-600">Chỉ cần kéo thả file .ipa và nhận link cài đặt ngay lập tức</p>
                    </div>

                    <div className="text-center">
                        <div className="text-3xl mb-3">🔗</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Link chia sẻ</h3>
                        <p className="text-sm text-gray-600">Tạo link tải và QR code để chia sẻ dễ dàng với team</p>
                    </div>

                    <div className="text-center">
                        <div className="text-3xl mb-3">⏰</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Tự động xóa</h3>
                        <p className="text-sm text-gray-600">Thiết lập thời gian hết hạn và số lượt tải tối đa</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-16 text-center text-sm text-gray-500">
                    <p>
                        Nền tảng phân phối app iOS cho{' '}
                        <Link href="/admin" className="hover:text-gray-700">
                            developer
                        </Link>{' '}
                        và team nhỏ
                    </p>
                </div>
            </div>
        </div>
    );
}
