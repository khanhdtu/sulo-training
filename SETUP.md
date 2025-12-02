# Setup Guide - Sulo Training

## Bước 1: Clone và Install Dependencies

```bash
cd sulo-training
npm install
```

## Bước 2: Setup Supabase

1. Tạo tài khoản tại [supabase.com](https://supabase.com)
2. Tạo project mới
3. Lấy các thông tin sau:
   - Project URL (NEXT_PUBLIC_SUPABASE_URL)
   - Anon Key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - Service Role Key (SUPABASE_SERVICE_ROLE_KEY)
   - Database URL (DATABASE_URL) - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## Bước 3: Setup Database

1. Copy `env.example.txt` thành `.env`:
```bash
cp env.example.txt .env
```

2. Điền các thông tin vào `.env`:
   - DATABASE_URL: Từ Supabase
   - NEXT_PUBLIC_SUPABASE_URL: Từ Supabase
   - NEXT_PUBLIC_SUPABASE_ANON_KEY: Từ Supabase
   - SUPABASE_SERVICE_ROLE_KEY: Từ Supabase
   - JWT_SECRET: Tạo một chuỗi ngẫu nhiên (ví dụ: `openssl rand -base64 32`)
   - OPENAI_API_KEY: Lấy từ [platform.openai.com](https://platform.openai.com)
   - RESEND_API_KEY: Lấy từ [resend.com](https://resend.com)
   - RESEND_FROM_EMAIL: Email của bạn (phải verify trong Resend)
   - CRON_SECRET: Tạo một chuỗi ngẫu nhiên
   - NEXT_PUBLIC_APP_URL: `http://localhost:3000` (development)

3. Generate Prisma Client:
```bash
npm run db:generate
```

4. Push schema lên database:
```bash
npm run db:push
```

## Bước 4: Setup Supabase Storage

1. Vào Supabase Dashboard → Storage
2. Tạo bucket mới tên `submissions`
3. Set public: false (private bucket)
4. Set policies để users có thể upload:
   - Policy name: "Users can upload their own files"
   - Policy: `(bucket_id = 'submissions'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])`
   - Operation: INSERT

## Bước 5: Run Development Server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong browser.

## Bước 6: Tạo User Admin (Optional)

Có thể tạo user admin qua Prisma Studio:

```bash
npm run db:studio
```

Hoặc tạo qua API:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "name": "Admin User",
    "role": "admin"
  }'
```

## Troubleshooting

### Lỗi Prisma: "Can't reach database server"
- Kiểm tra DATABASE_URL trong `.env`
- Đảm bảo Supabase project đang active
- Kiểm tra firewall/network

### Lỗi Supabase Storage: "Permission denied"
- Kiểm tra Storage policies trong Supabase Dashboard
- Đảm bảo service role key được dùng đúng

### Lỗi OpenAI: "Invalid API key"
- Kiểm tra OPENAI_API_KEY trong `.env`
- Đảm bảo có credit trong OpenAI account

### Lỗi Resend: "Invalid API key"
- Kiểm tra RESEND_API_KEY trong `.env`
- Verify email domain trong Resend dashboard

## Next Steps

1. Tạo một số dữ liệu mẫu (grades, subjects, chapters, etc.)
2. Test các API endpoints
3. Customize UI theo nhu cầu
4. Deploy lên Vercel

## Deploy lên Vercel

1. Push code lên GitHub
2. Import project trong Vercel
3. Add tất cả environment variables từ `.env`
4. Deploy!

Vercel sẽ tự động:
- Build project
- Setup cron jobs từ `vercel.json`
- Deploy production

