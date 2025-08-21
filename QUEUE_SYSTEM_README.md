# Queue System Documentation

## Tổng quan

Hệ thống queue được xây dựng với Redis và BullMQ để xử lý các tác vụ nền bao gồm:

1. **IPA Processing Queue**: Xử lý file .ipa (giải nén, extract metadata, upload storage)
2. **Cleanup Queue**: Xóa các file và builds đã hết hạn

## Kiến trúc

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Upload API    │───▶│   Redis Queue   │───▶│    Workers      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │ MinIO + Database│
                                              └─────────────────┘
```

## Components

### 1. Queue Manager (`src/lib/queue/index.ts`)

- Tạo và quản lý BullMQ queues
- Thêm jobs vào queue
- Theo dõi trạng thái jobs

### 2. Workers

#### IPA Process Worker (`src/workers/ipa-process-worker.ts`)

- Validate file .ipa
- Giải nén và extract metadata từ Info.plist
- Tối ưu app icon
- Upload files lên MinIO/S3
- Sinh file .plist cho itms-services
- Lưu thông tin vào database

#### Cleanup Worker (`src/workers/cleanup-worker.ts`)

- Xóa builds đã hết hạn
- Xóa files từ storage
- Dọn dẹp database records

### 3. Utilities

#### IPA Utils (`src/lib/ipa-utils.ts`)

- Extract metadata từ .ipa files
- Tối ưu hóa icon
- Validate files
- Generate build IDs

#### S3 Service Worker (`src/lib/S3ServiceWorker.ts`)

- Upload/delete files từ MinIO
- Generate presigned URLs
- Quản lý storage operations

## Setup

### 1. Cài đặt dependencies

```bash
pnpm install
```

### 2. Setup Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Hoặc cài đặt Redis locally
```

### 3. Setup MinIO

```bash
# Using Docker
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

### 4. Environment Variables

Copy `.env.example` to `.env` và cấu hình:

```bash
cp .env.example .env
```

### 5. Database Setup

```bash
npx prisma generate
npx prisma db push
```

## Chạy hệ thống

### 1. Start Redis và MinIO

Đảm bảo Redis và MinIO đang chạy.

### 2. Start Workers

```bash
# Development mode (with auto-reload)
pnpm run workers:dev

# Production mode
pnpm run workers
```

### 3. Start Next.js App

```bash
pnpm run dev
```

## API Endpoints

### Upload IPA

```http
POST /api/upload-ipa
Content-Type: multipart/form-data

file: [ipa file]
```

Response:

```json
{
    "success": true,
    "buildId": "a1b2c3",
    "jobId": "12345",
    "message": "File uploaded successfully. Processing started.",
    "estimatedTime": "2-5 minutes"
}
```

### Check Status

```http
GET /api/status?buildId=a1b2c3&jobId=12345
```

Response:

```json
{
    "success": true,
    "job": {
        "id": "12345",
        "state": "completed",
        "progress": {
            "step": "Completed",
            "percentage": 100
        }
    },
    "build": {
        "buildId": "a1b2c3",
        "appName": "My App",
        "version": "1.0.0",
        "status": "active"
        // ... other fields
    }
}
```

### Admin - List Builds

```http
GET /api/admin/apps?page=1&limit=10&status=active&search=app
```

### Admin - Update Build

```http
PATCH /api/admin/apps
Content-Type: application/json

{
  "buildId": "a1b2c3",
  "updates": {
    "status": "disabled",
    "maxDownloads": 50,
    "expiresAt": "2025-08-27T10:00:00Z"
  }
}
```

### Admin - Delete Build

```http
DELETE /api/admin/apps
Content-Type: application/json

{
  "buildId": "a1b2c3"
}
```

## Monitoring

### Queue Stats

Có thể monitor queue thông qua:

1. **BullMQ Dashboard**: Cài đặt bull-board để xem UI
2. **Logs**: Workers in ra logs chi tiết
3. **Database**: Theo dõi builds table

### Logs

Workers sẽ log:

- ✅ Successful operations
- ❌ Errors và failures
- 📈 Progress updates
- 🧹 Cleanup operations

## Troubleshooting

### Common Issues

1. **Redis connection failed**
    - Kiểm tra Redis đang chạy
    - Verify REDIS_URL trong .env

2. **MinIO upload failed**
    - Kiểm tra MinIO đang chạy
    - Verify MinIO credentials
    - Kiểm tra bucket permissions

3. **Worker not processing jobs**
    - Restart workers: `pnpm run workers`
    - Kiểm tra Redis connection
    - Xem logs để debug

4. **IPA processing failed**
    - Kiểm tra file .ipa có hợp lệ không
    - Verify temp directory permissions
    - Kiểm tra Info.plist format

### Debug Commands

```bash
# Check Redis connection
redis-cli ping

# List Redis keys
redis-cli keys "*"

# Check MinIO buckets
mc ls minio/

# View recent logs
tail -f workers.log
```

## Performance Tuning

### Worker Concurrency

Điều chỉnh trong worker files:

```typescript
{
  concurrency: 2, // Số jobs chạy đồng thời
}
```

### Queue Options

```typescript
{
  removeOnComplete: 10, // Giữ 10 jobs thành công
  removeOnFail: 50,     // Giữ 50 jobs failed
  attempts: 3,          // Retry 3 lần
}
```

### Cleanup Schedule

Điều chỉnh `CLEANUP_INTERVAL` trong `src/workers/index.ts` để thay đổi tần suất cleanup.

## Security

1. **File Validation**: Chỉ accept .ipa files
2. **Size Limits**: Giới hạn 500MB per file
3. **Expiry**: Auto-delete files sau 7 ngày
4. **Storage**: Files được lưu trên private MinIO
5. **Access Control**: Download links có thể expired
