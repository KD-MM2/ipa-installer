'use client';

import UploadIPA from '@/components/UploadIPA';
import Link from 'next/link';

import { Card } from 'primereact/card';

export default function Home() {
    const handleUploadSuccess = (result: { appId: string; jobId: string; estimatedTime: string }) => {
        console.log('Upload successful:', result);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                {/* <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">📱 IPA Installer</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">Nền tảng phân phối app iOS đơn giản. Upload file .ipa và nhận link cài đặt ngay lập tức.</p>
                </div> */}

                {/* Upload Section */}
                <Card className="shadow-sm p-8">
                    <UploadIPA onUploadSuccess={handleUploadSuccess} />
                </Card>

                {/* Features Section */}
                {/* <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card className="text-center p-6 border-0 shadow-sm">
                        <div className="text-3xl mb-3">🚀</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Upload nhanh chóng</h3>
                        <p className="text-sm text-gray-600">Chỉ cần kéo thả file .ipa và nhận link cài đặt ngay lập tức</p>
                    </Card>

                    <Card className="text-center p-6 border-0 shadow-sm">
                        <div className="text-3xl mb-3">🔗</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Link chia sẻ</h3>
                        <p className="text-sm text-gray-600">Tạo link tải và QR code để chia sẻ dễ dàng với team</p>
                    </Card>

                    <Card className="text-center p-6 border-0 shadow-sm">
                        <div className="text-3xl mb-3">⏰</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Tự động xóa</h3>
                        <p className="text-sm text-gray-600">Thiết lập thời gian hết hạn và số lượt tải tối đa</p>
                    </Card>
                </div> */}

                {/* Footer */}
                <div className="mt-16 text-center text-sm text-gray-500">
                    <p>
                        Nền tảng phân phối app iOS cho{' '}
                        <Link href="/admin" className="hover:text-gray-700 transition-colors">
                            developer
                        </Link>{' '}
                        và team nhỏ
                    </p>
                </div>
            </div>
        </div>
    );
}
