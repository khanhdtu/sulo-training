# Sulo Training - Hệ Thống Dạy Học và Quản Lý Việc Học

Hệ thống quản lý giáo dục từ lớp 1 đến lớp 12 với các tính năng:
- Quản lý chương trình học theo từng lớp và môn học
- Tạo và phân phối bài giảng, bài tập
- Đánh giá và theo dõi tiến độ học tập
- Giao nhiệm vụ và thông báo phụ huynh
- AI-powered essay grading với OpenAI

## Tech Stack

- **Frontend + Backend**: Next.js 14+ (App Router) + TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **AI**: OpenAI GPT-4o
- **Email**: Resend
- **Hosting**: Vercel (Free tier)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string (from Supabase)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `JWT_SECRET`: Secret key for JWT tokens
- `OPENAI_API_KEY`: OpenAI API key
- `RESEND_API_KEY`: Resend API key
- `RESEND_FROM_EMAIL`: Email address to send from
- `CRON_SECRET`: Secret for cron job authentication

### 3. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (if using Prisma migrations)
npx prisma migrate dev

# Or push schema directly to database
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
sulo-training/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── submissions/   # Submission endpoints
│   │   └── cron/          # Scheduled jobs
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── lib/                   # Utility libraries
│   ├── auth.ts           # Authentication helpers
│   ├── prisma.ts         # Prisma client
│   ├── supabase.ts       # Supabase clients
│   ├── openai.ts         # OpenAI integration
│   └── email.ts          # Email service
├── prisma/
│   └── schema.prisma     # Database schema
└── vercel.json           # Vercel configuration (cron jobs)
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires auth)

### Submissions
- `POST /api/submissions` - Create submission
- `GET /api/submissions` - Get user submissions

### Cron Jobs
- `GET /api/cron/check-deadlines` - Check deadlines and send notifications (requires cron secret)

## Features

### ✅ Implemented
- User authentication (JWT)
- User registration/login
- Database schema (Prisma)
- Submission creation and grading
- Multiple choice auto-grading
- Essay grading with OpenAI
- Email notifications (deadline reminders, overdue notices)
- Scheduled cron jobs (Vercel)

### 🚧 TODO
- Frontend UI components
- Assignment management
- User level calculation
- Dashboard
- File upload for essay images
- More API endpoints

## Database Schema

See `prisma/schema.prisma` for full schema definition.

Main entities:
- Users (students, teachers, parents, admins)
- Grades, Subjects, Chapters, Sections
- Lessons, Exercises, ExerciseQuestions
- Assignments, Submissions
- Notifications
- UserLevels (for adaptive learning)

## Scheduled Jobs

Cron jobs run automatically on Vercel:
- **Check Deadlines**: Daily at 9 AM
  - Sends reminder emails for upcoming deadlines
  - Sends overdue notices to parents

To add more cron jobs, edit `vercel.json`.

## Development

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio

# Push schema changes to database
npx prisma db push

# Create migration
npx prisma migrate dev --name migration_name
```

### Environment Variables

Make sure all required environment variables are set in `.env` file.

## Deployment

### Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Vercel will automatically:
- Run `npm run build`
- Deploy to production
- Setup cron jobs from `vercel.json`

## License

Private project
