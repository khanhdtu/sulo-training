# Hướng Dẫn Lấy CRON_SECRET

## Tổng Quan

`CRON_SECRET` là một chuỗi bí mật được sử dụng để xác thực các cron job requests từ Vercel đến các API endpoints của ứng dụng. Điều này đảm bảo chỉ có Vercel mới có thể gọi các cron job endpoints, bảo vệ ứng dụng khỏi các request trái phép.

## Tạo CRON_SECRET

### Cách 1: Sử dụng OpenSSL (Khuyến nghị)

Trên **Windows (PowerShell)**:
```powershell
# Tạo CRON_SECRET ngẫu nhiên 32 bytes (base64 encoded)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Trên **Windows (Command Prompt)**:
```cmd
# Cần cài đặt OpenSSL trước, sau đó chạy:
openssl rand -base64 32
```

Trên **Linux/Mac**:
```bash
openssl rand -base64 32
```

### Cách 2: Sử dụng Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Cách 3: Sử dụng Online Generator

Bạn có thể sử dụng các công cụ online để tạo random string, nhưng **không khuyến nghị** vì lý do bảo mật.

## Cấu Hình CRON_SECRET

### 1. Môi Trường Local (Development)

1. Tạo hoặc mở file `.env.local` trong thư mục gốc của dự án:
   ```bash
   # .env.local
   CRON_SECRET=your-generated-secret-key-here
   ```

2. Thay thế `your-generated-secret-key-here` bằng CRON_SECRET bạn đã tạo ở bước trên.

3. Khởi động lại Next.js development server để áp dụng thay đổi:
   ```bash
   npm run dev
   ```

### 2. Môi Trường Production (Vercel)

#### Bước 1: Tạo CRON_SECRET

Sử dụng một trong các phương pháp ở trên để tạo CRON_SECRET.

#### Bước 2: Thêm CRON_SECRET vào Vercel Environment Variables

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard)

2. Chọn project của bạn

3. Vào **Settings** → **Environment Variables**

4. Thêm biến môi trường mới:
   - **Name**: `CRON_SECRET`
   - **Value**: CRON_SECRET bạn đã tạo
   - **Environment**: Chọn tất cả các môi trường (Production, Preview, Development) hoặc chỉ Production

5. Click **Save**

#### Bước 3: Redeploy Application

Sau khi thêm environment variable, bạn cần redeploy ứng dụng để áp dụng thay đổi:

1. Vào tab **Deployments**
2. Click vào menu **...** của deployment mới nhất
3. Chọn **Redeploy**
4. Hoặc push một commit mới lên repository

## Kiểm Tra CRON_SECRET

### Test Local

Bạn có thể test CRON_SECRET bằng cách gọi API endpoint với header Authorization:

```bash
# Windows PowerShell
$headers = @{
    "Authorization" = "Bearer your-cron-secret-here"
}
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/send-weekly-activity-email" -Method GET -Headers $headers

# Linux/Mac
curl -X GET "http://localhost:3000/api/cron/send-weekly-activity-email" \
  -H "Authorization: Bearer your-cron-secret-here"
```

Nếu CRON_SECRET đúng, bạn sẽ nhận được response thành công. Nếu sai, bạn sẽ nhận được `401 Unauthorized`.

### Test trên Vercel

Sau khi deploy, Vercel sẽ tự động gọi cron job endpoints theo schedule đã cấu hình trong `vercel.json`. Bạn có thể kiểm tra logs trong Vercel Dashboard:

1. Vào **Deployments** → Chọn deployment mới nhất
2. Click vào **Functions** tab
3. Xem logs của cron job để kiểm tra xem có lỗi authentication không

## Lưu Ý Bảo Mật

1. **Không commit CRON_SECRET vào Git**: Đảm bảo `.env.local` và `.env` đã được thêm vào `.gitignore`

2. **Sử dụng CRON_SECRET khác nhau cho mỗi môi trường**: 
   - Development: CRON_SECRET cho local
   - Production: CRON_SECRET cho Vercel production

3. **Giữ CRON_SECRET bí mật**: Không chia sẻ CRON_SECRET với bất kỳ ai hoặc đăng lên public repository

4. **Rotate CRON_SECRET định kỳ**: Nên thay đổi CRON_SECRET định kỳ để tăng cường bảo mật

## Troubleshooting

### Lỗi: "Unauthorized" khi gọi cron endpoint

**Nguyên nhân có thể:**
- CRON_SECRET không khớp giữa Vercel và code
- CRON_SECRET chưa được cấu hình trong Vercel Environment Variables
- Application chưa được redeploy sau khi thêm CRON_SECRET

**Giải pháp:**
1. Kiểm tra CRON_SECRET trong Vercel Environment Variables
2. Đảm bảo CRON_SECRET trong code khớp với Vercel
3. Redeploy application

### Cron job không chạy

**Nguyên nhân có thể:**
- `vercel.json` chưa được cấu hình đúng
- CRON_SECRET không đúng
- Schedule format không đúng

**Giải pháp:**
1. Kiểm tra `vercel.json` có đúng format không
2. Kiểm tra CRON_SECRET
3. Kiểm tra schedule format (sử dụng cron syntax: `minute hour day month day-of-week`)

## Tài Liệu Tham Khảo

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Cron Expression Format](https://crontab.guru/)

