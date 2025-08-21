# IPA Installer Next

Nền tảng phân phối app iOS đơn giản và hiệu quả cho developer và team nhỏ.

## 🎯 Mục tiêu

- **Tập trung duy nhất cho iOS**: Giải quyết nhu cầu quản lý, phân phối bản build .ipa cho cá nhân hoặc nhóm nhỏ phát triển ứng dụng iOS.
- **Đơn giản và nhanh chóng**: Upload file .ipa và nhận link cài đặt ngay lập tức.
- **Tự động hóa**: Xử lý metadata, icon và tạo manifest files tự động.

## 👥 Đối tượng sử dụng

- **Cá nhân lập trình viên iOS**
- **Team nhỏ phát triển mobile**
- **QA testers** cần phân phối build nội bộ

## ✨ Tính năng chính

### 📱 Quản lý & phân phối ứng dụng

- ✅ Upload file .ipa với xử lý tự động
- ✅ Tự động extract metadata từ Info.plist (app name, version, bundle ID)
- ✅ Tối ưu hóa và extract app icon
- ✅ Tạo link tải riêng biệt cho từng build với ID ngắn (6 ký tự)
- ✅ Sinh QR code để chia sẻ dễ dàng
- ✅ Cài đặt trực tiếp qua iOS Safari (itms-services)
- ✅ Thiết lập thời gian hết hạn và giới hạn số lượt tải

### 🔧 Xử lý tự động

- ✅ Queue system với Redis và BullMQ
- ✅ Background processing cho file upload
- ✅ Auto-cleanup cho builds hết hạn
- ✅ Progress tracking real-time

### 🛡️ Bảo mật & tự động dọn dẹp

- ✅ Tự động xóa file khi hết hạn hoặc vượt quá số lượt tải
- ✅ File validation và size limits
- ✅ Secure file storage với MinIO S3

### 🎛️ Quản lý admin

- ✅ Dashboard admin để quản lý tất cả builds
- ✅ Xem, chỉnh sửa, xóa builds
- ✅ Theo dõi trạng thái và thống kê download
- ✅ Bulk operations

## 🏗️ Công nghệ & Kiến trúc

### Stack công nghệ

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: SQLite với Prisma ORM
- **File Storage**: MinIO (S3-compatible)
- **Queue System**: Redis + BullMQ
- **Styling**: TailwindCSS 4
- **Utilities**: Sharp (image processing), Plist parser, QRCode generator

### Kiến trúc hệ thống

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

### Luồng xử lý

1. **Upload**: User upload .ipa tại trang chủ
2. **Queue**: File được đưa vào Redis queue để xử lý background
3. **Processing**: Worker giải nén, extract metadata, optimize icon
4. **Storage**: Lưu files lên MinIO và metadata vào database
5. **Ready**: User được redirect đến trang detail với link download

## 📁 Cấu trúc dự án

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Trang upload chính
│   ├── app/[id]/          # Trang detail build
│   ├── admin/             # Trang admin dashboard
│   └── api/               # API endpoints
├── components/            # React components
├── lib/                   # Utilities và services
│   ├── queue.ts          # BullMQ queue setup
│   ├── redis.ts          # Redis connection
│   ├── ipa-utils.ts      # IPA processing utilities
│   └── S3Service.ts      # MinIO/S3 operations
├── workers/               # Background workers
│   ├── ipa-process-worker.ts  # Xử lý file IPA
│   └── cleanup-worker.ts      # Dọn dẹp files hết hạn
└── types/                 # TypeScript type definitions
```

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống

- Node.js 18+
- pnpm (recommended) hoặc npm/yarn
- Docker (cho Redis và MinIO)

### 1. Clone repository

```bash
git clone <repository-url>
cd ipa-installer-next
```

### 2. Cài đặt dependencies

```bash
pnpm install
```

### 3. Setup environment

Tạo file `.env.local`:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Redis
REDIS_URL="redis://localhost:6379"

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

### 4. Setup services

#### Redis (với Docker)

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

#### MinIO (với Docker)

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

### 5. Setup database

```bash
npx prisma generate
npx prisma db push
```

### 6. Chạy ứng dụng

#### Development mode

```bash
# Terminal 1: Start workers
pnpm run workers:dev

# Terminal 2: Start Next.js
pnpm dev
```

#### Production mode

```bash
# Build
pnpm build

# Start workers
pnpm run workers

# Start app
pnpm start
```

### 7. Truy cập ứng dụng

- **App**: http://localhost:3000
- **Admin**: http://localhost:3000/admin
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## 📖 Sử dụng

### Upload IPA

1. Truy cập trang chủ
2. Kéo thả file .ipa hoặc click để chọn file
3. Chờ processing hoàn tất (2-5 phút)
4. Nhận link download và QR code

### Quản lý builds

1. Truy cập `/admin`
2. Xem danh sách tất cả builds
3. Thực hiện các thao tác: edit, delete, disable
4. Theo dõi thống kê download

### Cài đặt app trên iPhone

1. Mở link download trên Safari iOS
2. Tap "Install" 
3. App sẽ được cài đặt trực tiếp

## 🔌 API Documentation

### Upload IPA

```http
POST /api/upload
Content-Type: multipart/form-data

file: [ipa file]
```

**Response:**

```json
{
    "success": true,
    "appId": "a1b2c3",
    "jobId": "12345",
    "message": "File uploaded successfully. Processing started.",
    "estimatedTime": "2-5 minutes"
}
```

### Check Processing Status

```http
GET /api/status?appId=a1b2c3&jobId=12345
```

**Response:**

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
        "appId": "a1b2c3",
        "appName": "My App",
        "version": "1.0.0",
        "status": "active"
    }
}
```

### Get Build Details

```http
GET /api/app/[id]
```

### Admin APIs

#### List All Builds

```http
GET /api/admin/apps?page=1&limit=10&status=active&search=app
```

#### Update Build

```http
PATCH /api/admin/apps
Content-Type: application/json

{
  "appId": "a1b2c3",
  "updates": {
    "status": "disabled",
    "maxDownloads": 50,
    "expiresAt": "2025-08-27T10:00:00Z"
  }
}
```

#### Delete Build

```http
DELETE /api/admin/apps
Content-Type: application/json

{
  "appId": "a1b2c3"
}
```

## 🛠️ Troubleshooting

### Common Issues

1. **Redis connection failed**
   - Kiểm tra Redis đang chạy: `docker ps`
   - Verify REDIS_URL trong .env

2. **MinIO upload failed**
   - Kiểm tra MinIO đang chạy
   - Verify credentials và bucket permissions
   - Check MinIO Console: http://localhost:9001

3. **Worker not processing jobs**
   - Restart workers: `pnpm run workers`
   - Check Redis connection
   - Review worker logs

4. **IPA processing failed**
   - Kiểm tra file .ipa hợp lệ
   - Verify file size < 500MB
   - Check Info.plist format

### Debug Commands

```bash
# Check Redis connection
docker exec redis redis-cli ping

# Check MinIO status
docker exec minio mc ls

# View worker logs
pnpm run workers:dev
```

## 📊 Monitoring & Analytics

### Queue Dashboard

Workers sẽ log chi tiết:

- ✅ Successful operations
- ❌ Errors và failures  
- 📈 Progress updates
- 🧹 Cleanup operations

### Database Schema

```sql
-- Apps table structure
CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  appId TEXT UNIQUE,        -- 6-character public ID
  appName TEXT,
  bundleId TEXT,
  version TEXT,
  buildNumber TEXT,
  originalFilename TEXT,
  fileSize INTEGER,
  hasIcon BOOLEAN,
  status TEXT DEFAULT 'processing',
  maxDownloads INTEGER,
  downloadCount INTEGER DEFAULT 0,
  expiresAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 Security & Best Practices

### File Validation

- ✅ Chỉ accept .ipa files
- ✅ File size limit: 500MB
- ✅ Virus scanning (có thể thêm)

### Storage Security

- ✅ Private MinIO storage
- ✅ Signed URLs với expiry
- ✅ Proxy routes để ẩn direct links

### Auto Cleanup

- ✅ Tự động xóa builds hết hạn
- ✅ Cleanup failed uploads
- ✅ Periodic maintenance tasks

## 📈 Performance

### Optimizations

- ✅ Image optimization với Sharp
- ✅ Background processing với queues
- ✅ Efficient database indexes
- ✅ CDN-ready asset serving

### Scalability

- 🔄 Horizontal scaling với multiple workers
- 🔄 Redis cluster support
- 🔄 Load balancing ready
- 🔄 S3-compatible storage

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 📞 Support

- 📖 Documentation: [Link to docs]
- 🐛 Issues: [GitHub Issues]
- 💬 Discussions: [GitHub Discussions]

---

**Được xây dựng với ❤️ cho iOS developer community**
