# 🚀 Tech Stack Recommendation - Chi Phí Thấp Nhất

## 1. Tổng Quan Chiến Lược

**Mục tiêu**: Xây dựng hệ thống với chi phí vận hành thấp nhất, nhưng vẫn đảm bảo hiệu năng và khả năng mở rộng.

---

## 2. Tech Stack Đề Xuất (Chi Phí Thấp)

### 2.1. Frontend

#### **Option 1: Next.js (React) - RECOMMENDED ⭐**
- ✅ **Free hosting**: Vercel (free tier rất tốt)
- ✅ **SSR/SSG**: Tốt cho SEO
- ✅ **Built-in API routes**: Không cần backend riêng cho một số endpoints
- ✅ **Image optimization**: Tự động optimize ảnh
- ✅ **Chi phí**: $0/month (free tier đủ cho MVP)
- 📦 **Tech**: React, TypeScript, TailwindCSS

**Vercel Free Tier:**
- 100GB bandwidth/month
- Unlimited requests
- Auto SSL
- Edge functions

#### **Option 2: Vue.js + Nuxt.js**
- ✅ **Free hosting**: Netlify/Vercel
- ✅ **Dễ học**: Vue.js dễ hơn React
- ✅ **Chi phí**: $0/month
- 📦 **Tech**: Vue 3, TypeScript, TailwindCSS

**Recommendation**: **Next.js** vì ecosystem lớn hơn, nhiều package hơn, và Vercel free tier tốt nhất.

---

### 2.2. Backend

#### **Option 1: Node.js + Express + TypeScript - RECOMMENDED ⭐**
- ✅ **Free hosting**: Railway.app (free $5 credit/month), Render.com (free tier)
- ✅ **Same language**: JavaScript/TypeScript cho cả frontend và backend
- ✅ **Rich ecosystem**: NPM packages phong phú
- ✅ **Chi phí**: $0-5/month (free tier đủ cho MVP)
- 📦 **Tech**: Node.js, Express, TypeScript, Prisma ORM

**Railway.app Free Tier:**
- $5 credit/month (đủ cho 1 small app)
- Auto-deploy từ GitHub
- PostgreSQL included

**Render.com Free Tier:**
- Free web services (sleeps after 15min inactivity)
- Free PostgreSQL database
- Auto SSL

#### **Option 2: Python + FastAPI**
- ✅ **Free hosting**: Railway.app, Render.com
- ✅ **AI/ML friendly**: Dễ tích hợp OpenAI, ML models
- ✅ **Chi phí**: $0-5/month
- 📦 **Tech**: Python 3.11+, FastAPI, SQLAlchemy, Pydantic

**Recommendation**: **Node.js + Express** vì:
- Cùng ngôn ngữ với frontend (TypeScript)
- Dễ maintain hơn
- Ecosystem lớn hơn cho web development

---

### 2.3. Database

#### **Option 1: PostgreSQL (Supabase) - RECOMMENDED ⭐**
- ✅ **Free tier**: 500MB database, 2GB file storage
- ✅ **Real-time**: Built-in real-time subscriptions
- ✅ **Auth**: Built-in authentication (có thể dùng hoặc tự build)
- ✅ **Storage**: File storage cho ảnh bài làm
- ✅ **Chi phí**: $0/month (free tier đủ cho MVP)
- 📦 **Service**: Supabase (PostgreSQL hosted)

**Supabase Free Tier:**
- 500MB database
- 2GB file storage
- 2GB bandwidth/month
- Unlimited API requests
- Real-time subscriptions

#### **Option 2: PostgreSQL (Railway/Render)**
- ✅ **Free tier**: Railway ($5 credit), Render (free PostgreSQL)
- ✅ **Chi phí**: $0-5/month
- 📦 **Service**: Railway.app hoặc Render.com

#### **Option 3: MySQL (PlanetScale)**
- ✅ **Free tier**: 1 database, 1GB storage
- ✅ **Serverless**: Auto-scaling
- ✅ **Chi phí**: $0/month
- 📦 **Service**: PlanetScale

**Recommendation**: **Supabase** vì:
- Free tier tốt nhất
- Có file storage built-in (tiết kiệm chi phí S3)
- Real-time features miễn phí
- Dashboard tốt

---

### 2.4. File Storage (Ảnh Bài Làm)

#### **Option 1: Supabase Storage - RECOMMENDED ⭐**
- ✅ **Free tier**: 2GB storage, 2GB bandwidth/month
- ✅ **CDN**: Built-in CDN
- ✅ **Chi phí**: $0/month (trong free tier của Supabase)
- 📦 **Service**: Supabase Storage

#### **Option 2: Cloudinary**
- ✅ **Free tier**: 25GB storage, 25GB bandwidth/month
- ✅ **Image optimization**: Auto resize, format conversion
- ✅ **Chi phí**: $0/month
- 📦 **Service**: Cloudinary

#### **Option 3: AWS S3**
- ⚠️ **Free tier**: 5GB storage, 20,000 GET requests/month (chỉ 12 tháng đầu)
- ⚠️ **Chi phí**: ~$0.023/GB sau free tier
- 📦 **Service**: AWS S3

**Recommendation**: **Supabase Storage** vì đã có trong Supabase free tier, không cần service riêng.

---

### 2.5. AI/ML (Chấm Bài Tự Luận)

#### **OpenAI API - REQUIRED**
- ✅ **Model**: GPT-4 Vision hoặc GPT-4o (rẻ hơn)
- ✅ **Chi phí**: 
  - GPT-4o: $2.50/1M input tokens, $10/1M output tokens
  - GPT-4 Vision: $10/1M input tokens, $30/1M output tokens
- 📦 **Usage**: Chấm bài tự luận từ ảnh

**Cost Optimization:**
- Dùng GPT-4o thay vì GPT-4 Vision (rẻ hơn 4x)
- Cache responses khi có thể
- Batch processing nếu có nhiều bài

**Estimated Cost**: ~$10-50/month (tùy số lượng bài chấm)

---

### 2.6. Email Service

#### **Option 1: Resend - RECOMMENDED ⭐**
- ✅ **Free tier**: 3,000 emails/month, 100 emails/day
- ✅ **Developer friendly**: API đơn giản
- ✅ **Chi phí**: $0/month (free tier đủ cho MVP)
- 📦 **Service**: Resend

#### **Option 2: SendGrid**
- ✅ **Free tier**: 100 emails/day
- ✅ **Chi phí**: $0/month
- 📦 **Service**: SendGrid

#### **Option 3: AWS SES**
- ✅ **Free tier**: 62,000 emails/month (nếu chạy trên EC2)
- ⚠️ **Setup phức tạp hơn**: Cần verify domain
- 📦 **Service**: AWS SES

**Recommendation**: **Resend** vì free tier tốt và API đơn giản nhất.

---

### 2.7. SMS Service

#### **Option 1: Twilio - RECOMMENDED ⭐**
- ⚠️ **Free tier**: $15.50 credit (không có free tier thực sự)
- ✅ **Reliable**: Uptime cao
- ✅ **Global**: Hỗ trợ nhiều quốc gia
- 📦 **Cost**: ~$0.0075/SMS (VN)
- 📦 **Service**: Twilio

**Estimated Cost**: ~$5-20/month (tùy số lượng SMS)

#### **Option 2: Viettel/VNPT SMS Gateway**
- ✅ **Local**: Giá rẻ hơn cho VN
- ⚠️ **Setup**: Cần liên hệ trực tiếp
- 📦 **Cost**: ~500-1000 VND/SMS (~$0.02-0.04/SMS)

#### **Option 3: AWS SNS**
- ⚠️ **Free tier**: 100 SMS/month (chỉ US)
- ⚠️ **VN**: ~$0.00645/SMS
- 📦 **Service**: AWS SNS

**Recommendation**: 
- **MVP**: Bỏ qua SMS, chỉ dùng Email (tiết kiệm chi phí)
- **Production**: Twilio hoặc local SMS gateway

---

### 2.8. Real-time (Notifications)

#### **Option 1: Supabase Realtime - RECOMMENDED ⭐**
- ✅ **Free tier**: Included trong Supabase
- ✅ **WebSocket**: Real-time subscriptions
- ✅ **Chi phí**: $0/month
- 📦 **Service**: Supabase Realtime

#### **Option 2: Socket.io (Self-hosted)**
- ✅ **Free**: Open source
- ⚠️ **Hosting**: Cần server riêng
- 📦 **Tech**: Socket.io

**Recommendation**: **Supabase Realtime** vì free và không cần server riêng.

---

### 2.9. Authentication

#### **Option 1: Self-built với JWT - RECOMMENDED ⭐**
- ✅ **Free**: Không có chi phí
- ✅ **Control**: Full control
- ✅ **Chi phí**: $0/month
- 📦 **Tech**: JWT, bcrypt

#### **Option 2: Supabase Auth**
- ✅ **Free tier**: Included trong Supabase
- ✅ **Features**: Social login, magic links
- ✅ **Chi phí**: $0/month
- 📦 **Service**: Supabase Auth

**Recommendation**: **Self-built với JWT** vì:
- Đơn giản hơn (chỉ cần username/password)
- Không phụ thuộc vào service bên ngoài
- Free hoàn toàn

---

## 3. Tech Stack Tổng Hợp (Recommended)

### **Frontend**
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui hoặc Radix UI
- **State Management**: Zustand hoặc React Query
- **Hosting**: Vercel (Free)

### **Backend**
- **Runtime**: Node.js 20+
- **Framework**: Express.js hoặc Fastify
- **Language**: TypeScript
- **ORM**: Prisma
- **Validation**: Zod
- **Hosting**: Railway.app (Free $5/month) hoặc Render.com (Free)

### **Database**
- **Type**: PostgreSQL
- **Service**: Supabase (Free tier)
- **ORM**: Prisma (connect to Supabase)

### **File Storage**
- **Service**: Supabase Storage (Free 2GB)

### **AI/ML**
- **Service**: OpenAI API (GPT-4o)
- **Cost**: ~$10-50/month

### **Email**
- **Service**: Resend (Free 3,000 emails/month)

### **SMS** (Optional - có thể bỏ qua trong MVP)
- **Service**: Twilio hoặc Local SMS Gateway
- **Cost**: ~$5-20/month

### **Real-time**
- **Service**: Supabase Realtime (Free)

### **Authentication**
- **Method**: Self-built với JWT + bcrypt

---

## 4. Chi Phí Ước Tính (Monthly)

### **MVP Phase (Free Tier)**
- Frontend (Vercel): **$0**
- Backend (Railway/Render): **$0** (free tier)
- Database (Supabase): **$0** (free tier)
- File Storage (Supabase): **$0** (free tier)
- Email (Resend): **$0** (free tier)
- SMS: **$0** (bỏ qua trong MVP)
- OpenAI API: **~$10-50** (tùy usage)
- **TOTAL: ~$10-50/month**

### **Production Phase (Small Scale)**
- Frontend (Vercel Pro): **$20/month** (nếu cần)
- Backend (Railway): **~$5-10/month**
- Database (Supabase Pro): **$25/month** (nếu cần scale)
- File Storage: **~$5/month** (nếu vượt free tier)
- Email (Resend): **$0-20/month** (tùy usage)
- SMS: **~$10-30/month** (nếu dùng)
- OpenAI API: **~$50-200/month** (tùy usage)
- **TOTAL: ~$115-335/month**

---

## 5. Architecture Diagram

```
┌─────────────────┐
│   Next.js App   │  (Vercel - Free)
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│  Express API    │  (Railway/Render - Free)
│   (Backend)     │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬────────────┐
    │         │          │            │
┌───▼───┐ ┌──▼───┐ ┌────▼────┐ ┌────▼────┐
│Supabase│ │Resend│ │OpenAI   │ │Supabase │
│Postgres│ │Email │ │API      │ │Storage  │
│(Free)  │ │(Free)│ │($10-50) │ │(Free)   │
└────────┘ └──────┘ └─────────┘ └─────────┘
```

---

## 6. Migration Path (Khi Scale)

### **Khi nào cần upgrade:**

1. **Database**: Khi > 500MB data → Upgrade Supabase Pro ($25/month)
2. **File Storage**: Khi > 2GB → Upgrade Supabase Storage hoặc chuyển Cloudinary
3. **Backend**: Khi free tier không đủ → Railway Pro ($5-20/month)
4. **Frontend**: Khi > 100GB bandwidth → Vercel Pro ($20/month)
5. **Email**: Khi > 3,000 emails/month → Resend Pro ($20/month)

---

## 7. Development Tools (Free)

- **Version Control**: GitHub (Free)
- **CI/CD**: GitHub Actions (Free)
- **Monitoring**: Sentry (Free tier) hoặc Vercel Analytics
- **Error Tracking**: Sentry (Free tier)
- **API Testing**: Postman (Free)

---

## 8. Recommendations Summary

### ✅ **Best Choice cho Chi Phí Thấp:**

1. **Frontend**: Next.js + Vercel (Free)
2. **Backend**: Node.js + Express + Railway (Free $5/month)
3. **Database**: Supabase PostgreSQL (Free)
4. **Storage**: Supabase Storage (Free)
5. **Email**: Resend (Free)
6. **AI**: OpenAI GPT-4o (Pay as you go)
7. **SMS**: Bỏ qua trong MVP (tiết kiệm chi phí)

### 💰 **Total Cost MVP: ~$10-50/month**

### 🚀 **Next Steps:**

1. Setup Next.js project với TypeScript
2. Setup Supabase project (free)
3. Setup Railway/Render cho backend
4. Integrate OpenAI API
5. Deploy và test

---

## 9. Alternative: Full-Stack Next.js (Serverless)

Nếu muốn đơn giản hơn nữa, có thể dùng **Next.js API Routes** (serverless):

- **Frontend + Backend**: Next.js (Vercel)
- **Database**: Supabase
- **Storage**: Supabase Storage
- **Chi phí**: Chỉ trả OpenAI API (~$10-50/month)

**Pros**: Đơn giản hơn, ít services hơn
**Cons**: API routes có giới hạn execution time (10s trên free tier)

---

## 10. Câu Hỏi Cần Quyết Định

1. **Có cần SMS không?** → Nếu không → Tiết kiệm $10-30/month
2. **Số lượng users dự kiến?** → Để estimate chi phí chính xác hơn
3. **Số lượng bài chấm/ngày?** → Để estimate OpenAI cost
4. **Có cần mobile app không?** → Nếu có → Cần thêm React Native

---

**Kết luận**: Với tech stack này, mày có thể chạy MVP với chi phí **~$10-50/month**, chủ yếu là OpenAI API. Tất cả services khác đều free tier đủ dùng! 🎉

