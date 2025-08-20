'use client';

import { useState } from 'react';
import UploadIPA from '@/components/UploadIPA';

export default function Home() {
  const [uploadResult, setUploadResult] = useState<{ buildId: string; key: string } | null>(null);

  const handleUploadSuccess = (result: { buildId: string; key: string }) => {
    setUploadResult(result);
    // In real app, this would redirect to /app/${buildId}
    console.log('Upload successful:', result);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📱 IPA Installer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Nền tảng phân phối app iOS đơn giản. Upload file .ipa và nhận link cài đặt ngay lập tức.
          </p>
        </div>

        {/* Upload Section */}
        {!uploadResult ? (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <UploadIPA onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          /* Success State */
          <div className="bg-white rounded-lg shadow-sm p-8 text-center space-y-6">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-600">
              Upload thành công!
            </h2>
            <p className="text-gray-600">
              File IPA của bạn đã được upload và đang được xử lý.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-gray-900">Thông tin upload:</h3>
              <div className="text-sm space-y-1">
                <div>Build ID: <code className="bg-gray-200 px-2 py-1 rounded">{uploadResult.buildId}</code></div>
                <div>S3 Key: <code className="bg-gray-200 px-2 py-1 rounded text-xs">{uploadResult.key}</code></div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setUploadResult(null)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Upload file khác
              </button>
              <button
                onClick={() => {
                  // In real app: router.push(`/app/${uploadResult.buildId}`)
                  alert(`Sẽ redirect đến: /app/${uploadResult.buildId}`);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Xem chi tiết build
              </button>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-3xl mb-3">🚀</div>
            <h3 className="font-semibold text-gray-900 mb-2">Upload nhanh chóng</h3>
            <p className="text-sm text-gray-600">
              Chỉ cần kéo thả file .ipa và nhận link cài đặt ngay lập tức
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl mb-3">🔗</div>
            <h3 className="font-semibold text-gray-900 mb-2">Link chia sẻ</h3>
            <p className="text-sm text-gray-600">
              Tạo link tải và QR code để chia sẻ dễ dàng với team
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-3xl mb-3">⏰</div>
            <h3 className="font-semibold text-gray-900 mb-2">Tự động xóa</h3>
            <p className="text-sm text-gray-600">
              Thiết lập thời gian hết hạn và số lượt tải tối đa
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>Nền tảng phân phối app iOS cho developer và team nhỏ</p>
          <div className="mt-4 space-x-4">
            <a href="/test-s3" className="hover:text-gray-700">Test S3</a>
            <a href="/admin" className="hover:text-gray-700">Admin</a>
          </div>
        </div>
      </div>
    </div>
  );
}
