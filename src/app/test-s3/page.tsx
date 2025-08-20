'use client';

import { useState } from 'react';
import { S3Service } from '@/lib/S3Service';

export default function TestS3Page() {
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [connectionMessage, setConnectionMessage] = useState('');
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadMessage, setUploadMessage] = useState('');
    const [uploadedFile, setUploadedFile] = useState<{ key: string; url: string } | null>(null);

    const testConnection = async () => {
        setConnectionStatus('testing');
        setConnectionMessage('Testing S3 connection...');
        
        try {
            const result = await S3Service.testConnection();
            if (result.success) {
                setConnectionStatus('success');
                setConnectionMessage(`✅ S3 Connected! Buckets: ${result.buckets?.join(', ') || 'None'}`);
            } else {
                setConnectionStatus('error');
                setConnectionMessage(`❌ Connection failed: ${result.message}`);
            }
        } catch (error: any) {
            setConnectionStatus('error');
            setConnectionMessage(`❌ Connection error: ${error.message}`);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadStatus('uploading');
        setUploadMessage('Uploading file...');
        setUploadedFile(null);

        try {
            let result;
            let fileType: 'icon' | 'ipa' = 'icon';

            if (file.name.toLowerCase().endsWith('.ipa')) {
                result = await S3Service.uploadIPA(file);
                fileType = 'ipa';
            } else if (S3Service.isValidIcon(file)) {
                result = await S3Service.uploadIcon(file);
                fileType = 'icon';
            } else {
                result = await S3Service.uploadFile(file);
                fileType = 'icon';
            }

            if (result.success && result.key) {
                setUploadStatus('success');
                setUploadMessage(`✅ File uploaded successfully!`);
                
                const proxyUrl = S3Service.generateProxyUrl(result.key, fileType);
                setUploadedFile({
                    key: result.key,
                    url: proxyUrl
                });
            } else {
                setUploadStatus('error');
                setUploadMessage(`❌ Upload failed: ${result.error}`);
            }
        } catch (error: any) {
            setUploadStatus('error');
            setUploadMessage(`❌ Upload error: ${error.message}`);
        }
    };

    const deleteFile = async () => {
        if (!uploadedFile) return;

        try {
            const result = await S3Service.deleteFile(uploadedFile.key);
            if (result.success) {
                setUploadedFile(null);
                setUploadMessage('✅ File deleted successfully!');
            } else {
                setUploadMessage(`❌ Delete failed: ${result.error}`);
            }
        } catch (error: any) {
            setUploadMessage(`❌ Delete error: ${error.message}`);
        }
    };

    // Generate sample plist content
    const generateSamplePlist = () => {
        const appInfo = {
            appName: 'Test App',
            bundleId: 'com.example.testapp',
            version: '1.0.0',
            buildNumber: '1',
            displayName: 'Test Application'
        };

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>https://example.com/assets/files/ipa/test.ipa</string>
                </dict>
                <dict>
                    <key>kind</key>
                    <string>display-image</string>
                    <key>url</key>
                    <string>https://example.com/assets/icons/icons/test.png</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>${appInfo.bundleId}</string>
                <key>bundle-version</key>
                <string>${appInfo.version}</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>${appInfo.displayName}</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <h1 className="text-3xl font-bold">S3 Storage Test</h1>
            
            {/* Connection Test */}
            <div className="border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-semibold">Connection Test</h2>
                
                <button
                    onClick={testConnection}
                    disabled={connectionStatus === 'testing'}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    {connectionStatus === 'testing' ? 'Testing...' : 'Test S3 Connection'}
                </button>
                
                {connectionMessage && (
                    <div className={`p-3 rounded ${
                        connectionStatus === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : connectionStatus === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                    }`}>
                        {connectionMessage}
                    </div>
                )}
            </div>

            {/* File Upload Test */}
            <div className="border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-semibold">File Upload Test</h2>
                
                <div className="space-y-2">
                    <label className="block text-sm font-medium">
                        Choose file (IPA, image, or other):
                    </label>
                    <input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={uploadStatus === 'uploading'}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                </div>
                
                {uploadMessage && (
                    <div className={`p-3 rounded ${
                        uploadStatus === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : uploadStatus === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                    }`}>
                        {uploadMessage}
                    </div>
                )}

                {uploadedFile && (
                    <div className="bg-gray-50 p-4 rounded space-y-2">
                        <h3 className="font-medium">Uploaded File:</h3>
                        <p className="text-sm text-gray-600">S3 Key: {uploadedFile.key}</p>
                        <p className="text-sm text-gray-600">Proxy URL: {uploadedFile.url}</p>
                        
                        <div className="flex space-x-2">
                            <a 
                                href={uploadedFile.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                            >
                                View File
                            </a>
                            <button
                                onClick={deleteFile}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                                Delete File
                            </button>
                        </div>

                        {/* Preview for images */}
                        {S3Service.isImageFile(uploadedFile.key) && (
                            <div className="mt-4">
                                <h4 className="font-medium mb-2">Image Preview:</h4>
                                <img 
                                    src={uploadedFile.url} 
                                    alt="Uploaded" 
                                    className="max-w-xs max-h-48 border rounded"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Storage Utils Test */}
            <div className="border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-semibold">Storage Utils Test</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <h3 className="font-medium">Environment Variables:</h3>
                        <ul className="space-y-1 text-gray-600">
                            <li>S3_ENDPOINT: {process.env.NEXT_PUBLIC_S3_ENDPOINT || 'Not set'}</li>
                            <li>S3_BUCKET_NAME: {process.env.NEXT_PUBLIC_S3_BUCKET_NAME || 'Not set'}</li>
                            <li>APP_URL: {process.env.NEXT_PUBLIC_APP_URL || 'Not set'}</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 className="font-medium">Example URLs:</h3>
                        <ul className="space-y-1 text-gray-600">
                            <li>Icon: {S3Service.generateProxyUrl('icons/test.png', 'icon')}</li>
                            <li>IPA: {S3Service.generateProxyUrl('ipa/test.ipa', 'ipa')}</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Test plist generation */}
            <div className="border rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-semibold">Plist Generation Test</h2>
                
                <div className="bg-gray-50 p-4 rounded">
                    <h3 className="font-medium mb-2">Sample Plist Content:</h3>
                    <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
{generateSamplePlist()}
                    </pre>
                </div>
            </div>
        </div>
    );
}
