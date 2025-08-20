# MinIO S3 Storage Setup

## Tổng quan

Hệ thống này sử dụng MinIO làm S3-compatible storage để lưu trữ:

- **IPA files**: Các file .ipa được upload
- **App icons**: Icon được extract từ IPA
- **Plist files**: Manifest files cho iOS installation
- **Other assets**: Các file khác

## Cấu trúc thư mục S3

```
bucket-name/
├── ipa/           # File .ipa
│   └── timestamp-random.ipa
├── icons/         # App icons
│   └── timestamp-random.png
├── plists/        # Manifest files
│   └── timestamp-random.plist
└── uploads/       # General uploads
    └── timestamp-random.*
```

## Proxy URLs

Thay vì expose direct S3 URLs, hệ thống sử dụng proxy routes:

- **Icons**: `/assets/icons/{s3-key}`
- **Files**: `/assets/files/{s3-key}` (cho IPA và plist)

## Cài đặt và chạy

### 1. Cài đặt dependencies

```bash
pnpm install
```

### 2. Cấu hình environment

Tạo file `.env.local`:

```env
# MinIO S3 Configuration
S3_ENDPOINT=localhost
S3_PORT=9000
S3_USE_SSL=false
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=ipa-installer

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

### 3. Chạy MinIO với Docker

```bash
# Start MinIO
pnpm minio:start

# Check logs
pnpm minio:logs

# Stop MinIO
pnpm minio:stop
```

MinIO sẽ chạy tại:

- **API**: http://localhost:9000
- **Console**: http://localhost:9001 (admin/admin)

### 4. Chạy ứng dụng

```bash
pnpm dev
```

### 5. Test S3 integration

Truy cập: http://localhost:3000/test-s3

## Cách sử dụng

### Upload file

```typescript
import { S3Service } from '@/lib/S3Service';

// Upload IPA
const result = await S3Service.uploadIPA(ipaFile);

// Upload icon
const result = await S3Service.uploadIcon(iconFile);

// Upload plist
const result = await S3Service.uploadPlist(plistFile);
```

### Generate URLs

```typescript
import { S3Service } from '@/lib/S3Service';

// Proxy URL (recommended)
const iconUrl = S3Service.generateIconUrl(s3Key);
const ipaUrl = S3Service.generateIPAUrl(s3Key);

// Presigned URL (direct S3)
const presignedUrl = await S3Service.generatePresignedUrl(s3Key);
```

### Storage Utils

```typescript
import { StorageUtils } from '@/lib/storage-utils';

// Generate plist for iOS installation
const plistContent = StorageUtils.generatePlistContent(appInfo, ipaUrl, iconUrl);

// Get build URLs
const urls = StorageUtils.getBuildUrls(ipaKey, iconKey, plistKey);

// Delete build files
await StorageUtils.deleteBuildFiles(ipaKey, iconKey, plistKey);
```

## API Endpoints

### Upload/Delete

- **POST** `/api/s3/upload` - Upload file
- **DELETE** `/api/s3/upload` - Delete file
- **GET** `/api/s3/upload` - Test connection

### Presigned URLs

- **POST** `/api/s3/presigned` - Generate single presigned URL
- **PUT** `/api/s3/presigned` - Generate multiple presigned URLs

### Asset Proxy

- **GET** `/assets/icons/[...path]` - Serve icons
- **GET** `/assets/files/[...path]` - Serve files (IPA/plist)

## Security Features

1. **File validation**: Type và size validation
2. **Proxy routing**: Không expose direct S3 URLs
3. **Cache headers**: Optimize performance
4. **Error handling**: Proper error responses
5. **Build-time safety**: Mock S3 during build

## Troubleshooting

### MinIO connection issues

1. Check MinIO is running: `docker ps`
2. Check logs: `pnpm minio:logs`
3. Verify environment variables
4. Test connection: `/test-s3`

### Upload failures

1. Check file size limits
2. Verify file types
3. Check S3 permissions
4. Review server logs

### Proxy route issues

1. Verify file exists in S3
2. Check S3 key format
3. Review proxy route logs
4. Test direct S3 access

## Production Deployment

### Environment Variables

```env
S3_ENDPOINT=your-s3-endpoint.com
S3_PORT=443
S3_USE_SSL=true
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket
NEXT_PUBLIC_APP_URL=https://your-domain.com
APP_URL=https://your-domain.com
```

### S3 Bucket Policy

Bucket nên có policy cho phép public read access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket/*"
        }
    ]
}
```

### CDN (Optional)

Có thể setup CloudFront hoặc CDN khác cho proxy routes để improve performance.

## File Size Limits

- **IPA files**: 100MB max
- **Icons**: 5MB max
- **Plist files**: 1MB max
- **General uploads**: 10MB max

## Supported File Types

### IPA Upload

- `.ipa` files only
- `application/octet-stream` MIME type

### Icon Upload

- `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Image MIME types

### Plist Upload

- `.plist` files only
- XML MIME types
