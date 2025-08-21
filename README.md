### Nền tảng phân phối app iOS

#### 1. Mục tiêu sản phẩm

- **Tập trung duy nhất cho iOS**: Giải quyết nhu cầu quản lý, phân phối bản build .ipa cho cá nhân hoặc nhóm nhỏ phát triển ứng dụng iOS.

#### 2. Đối tượng khách hàng mục tiêu

- **Cá nhân lập trình viên iOS**, hoặc các nhóm nhỏ tự test và phân phối nội bộ app.

#### 3. Tính năng chính

**3.1. Quản lý & phân phối ứng dụng**

- Tải lên các file .ipa (iOS), **không giới hạn số lượng bản build**.
- Tạo **link tải riêng biệt** cho từng phiên bản app (tự sinh link, QR code).
- Cho phép cài đặt app trực tiếp qua **link hoặc quét QR code**.
- Thiết lập **thời gian hoạt động** và **số lượt tải tối đa** cho mỗi link build.

**3.2. Trình quản lý tester**

- **Không cần**.

**3.3. Phản hồi & phân tích**

- **Không cần**.

**3.4. Bảo mật & quyền riêng tư**

- Khi hết hạn hoặc vượt quá số lượt tải, **tự động xóa file build** khỏi hệ thống.
- Không cần các tính năng bảo mật hay kiểm soát truy cập phức tạp khác.

**3.5. Tích hợp CI/CD & API**

- Hỗ trợ API và webhook tích hợp với các pipeline CI/CD (tự động upload build từ CI/CD lên hệ thống).

**3.6. Quản lý phiên bản & lịch sử**

- Lưu lịch sử các bản build; dễ dàng xem, chọn, hoặc xóa từng version.
- Ghi chú tag cho từng bản build.
- Cho phép rollback về các phiên bản trước.

**3.7. Định hướng Freemium**

- **Không cần** — mặc định **full tính năng**, không phân chia gói miễn phí/trả phí.

---

#### 4. Giao diện người dùng (UI/UX)

- **Admin Dashboard:**
    - Bảng dữ liệu build (datatable) – hiển thị danh sách file, thông tin: tên app, version, ngày tải lên, trạng thái, số lượt tải còn lại, ngày hết hạn.
    - Các thao tác trên từng dòng (row actions): remove, download, disable, set expiry.

- **Trang upload build:**
    - Đơn giản với quy trình "Chọn file .ipa" → "Upload" → Hệ thống sinh link/download, hiển thị QR code chia sẻ.

- **Trang download (app detail):**
    - Thông tin app/build (tên, version, ngày upload, trạng thái).
    - Nút Download – khi nhấn vào sẽ sử dụng itms để tải về và cài đặt trực tiếp lên iPhone.

---

#### 5. Công nghệ & kiến trúc dự kiến

- **Frontend:** Next.js 15 (App Router)
- **Backend:** Tích hợp vào Next.js API Routes
- **Database:** SQLite quản lý thông tin file (Prisma ORM)
- **File Storage:** MinIO (API S3 Compatible)
- **Queue:** Redis
- **Worker:** Bull.js (quản lý các tác vụ nền như xóa file hết hạn, thống kê lượt tải, cleanup...)

---

#### 6. Kế hoạch mở rộng

- **Chỉ phát triển dưới dạng web app**.
- Không triển khai native app/mobile app (tập trung tối ưu web).

---

#### 7. Điểm khác biệt có thể bổ sung

- **Không cần** điểm khác biệt bổ sung ngoài tập trung tối giản, chuyên cho cá nhân.

---

# Mô tả chi tiết flow & API cho nền tảng phân phối app iOS tối giản

---

Cảm ơn bạn đã làm rõ luồng nghiệp vụ! Dưới đây là mô tả concept **rất cụ thể và thực tế** phù hợp với mô hình mà bạn đề xuất:

---

### 1. Flow tổng thể

- **Web root ("/")**
    - Là trang upload file .ipa.
    - User upload file, sau khi upload thành công sẽ redirect tới trang file detail.

- **Admin page ("/admin")**
    - Trang bảng dữ liệu quản lý toàn bộ builds (datatable).
    - Có các thao tác như: xóa, download, disable, set expiry.

---

### 2. Quy trình upload & xử lý file

1. **Người dùng upload file .ipa tại root ("/")**
    - Frontend: Form upload file đơn giản, gửi request đến API backend.

2. **Backend nhận file .ipa**
    - Tạo một task vào queue (Redis/Bull.js) để xử lý file nền.

3. **Bull.js worker thực hiện:**
    - **Giải nén file .ipa** (ipa thực chất là một file zip).
    - **Trích xuất info.plist** lấy thông tin metadata: app name, bundle id, version, build number.
    - **Lấy app icon** từ thư mục Payload.
    - **Sinh file .plist** theo chuẩn itms-services để phục vụ cài đặt trực tiếp.
    - **Lưu tất cả file liên quan** (ipa, icon, plist, metadata) lên storage (MinIO/S3).
    - **Insert bản ghi vào database**: Tên app, thông tin version, bundle ID, đường dẫn các file (ipa, icon, plist), trạng thái, ngày hết hạn...

4. **Sau khi xử lý xong**
    - Redirect client tới trang **build detail** (hiển thị info + link download, QR code).

---

### 3. Giao diện Người dùng

**Trang root “/”**

- Form upload file .ipa.
- Sau khi upload thành công, tự động redirect sang `"/app/:buildId"`.
- `buildId` là randomized [a-zA-Z0-9] 6 ký tự.

**Trang chi tiết file “/app/:buildId”**

- Hiển thị thông tin trích xuất: Tên app, bundle id, version, ngày upload, trạng thái, số lượt tải còn lại, ngày hết hạn.
- Hiển thị app icon.
- Nút Download (dẫn link plist cho iOS itms-services), nút Copy link, hiển thị QR code.

**Trang admin “/admin”**

- Bảng dữ liệu: Danh sách các build, cùng các thao tác như xóa, download, disable, set expiry...

---

### 4. Công nghệ & Kiến trúc

- **Frontend:** Next.js 15 (App Router)
- **Backend:** Next.js API Routes (có thể dùng middleware để nhận, lưu file tạm thời, tạo queue)
- **Database:** SQLite + Prisma ORM
- **File Storage:** MinIO (chuẩn S3)
- **Queue:** Redis
- **Worker:** Bull.js (chạy riêng, xử lý giải nén, extract metadata/icon, sinh plist, lưu storage, insert DB...)

---

### 5. Chi tiết xử lý worker (Bull.js)

- **Input:** Đường dẫn file .ipa tạm thời.
- **Quy trình:**
    - Giải nén ipa, tìm và đọc `Payload/*.app/Info.plist` → parse metadata.
    - Lấy icon: tìm file icon đúng chuẩn trong bundle app.
    - Sinh file `.plist` (manifest) cho itms-services (tham số: tên app, bundle id, version, url ipa, icon, v.v.)
    - Đẩy tất cả file (ipa, plist, icon) lên MinIO/S3.
    - Insert bản ghi vào DB: bao gồm link đến các file, metadata vừa extract được.

---

### 6. Luồng sau khi xử lý thành công

- Backend trả về buildId.
- Frontend redirect user sang build detail-page với buildId vừa tạo.
- Admin page có thể tra cứu, quản lý toàn bộ builds.

---

### 7. Tóm tắt API

- **POST `/api/upload`**: upload file, trả về buildId.
- **GET `/api/builds/:id`**: lấy info chi tiết build/id.
- **GET `/api/admin/apps`**: datatable admin.
- **DELETE/PATCH ...**: thao tác quản lý khác.

---
