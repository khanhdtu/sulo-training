# ⏰ Scheduled Jobs Solution cho Next.js + Supabase

## 1. Vấn Đề

Hệ thống cần các scheduled jobs để:
- ✅ Gửi thông báo deadline reminder (trước 1 ngày, 3 ngày)
- ✅ Gửi thông báo khi trễ deadline
- ✅ Tính toán lại level của user (hàng ngày/tuần)
- ✅ Gửi báo cáo tiến độ cho phụ huynh (hàng tuần/tháng)
- ✅ Cleanup old data, generate reports

---

## 2. Giải Pháp cho Next.js + Vercel

### **Option 1: Vercel Cron Jobs - RECOMMENDED ⭐**

#### **Tính Năng:**
- ✅ **Built-in**: Tích hợp sẵn trong Vercel
- ✅ **Free tier**: 2 cron jobs, unlimited executions
- ✅ **Easy setup**: Chỉ cần config trong `vercel.json`
- ✅ **Reliable**: Chạy trên Vercel infrastructure
- ✅ **Chi phí**: $0/month (free tier)

#### **Giới Hạn Free Tier:**
- Tối đa 2 cron jobs
- Execution time: 10s (Hobby plan), 60s (Pro plan)
- Không có giới hạn số lần chạy

#### **Setup:**

**1. Tạo API Route:**
```typescript
// app/api/cron/check-deadlines/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Verify cron secret để tránh abuse
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Logic check deadlines và gửi thông báo
  // ...

  return NextResponse.json({ success: true });
}
```

**2. Config trong `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-deadlines",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/calculate-levels",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule Format (Cron):**
- `0 9 * * *` = 9:00 AM mỗi ngày
- `0 */6 * * *` = Mỗi 6 giờ
- `0 0 * * 0` = Chủ nhật hàng tuần

**Pros:**
- ✅ Free
- ✅ Dễ setup
- ✅ Reliable
- ✅ Tích hợp sẵn

**Cons:**
- ⚠️ Chỉ 2 cron jobs (free tier)
- ⚠️ Execution time limit 10s (có thể không đủ cho batch processing lớn)

---

### **Option 2: Supabase Edge Functions + pg_cron - RECOMMENDED ⭐⭐**

#### **Tính Năng:**
- ✅ **Unlimited**: Không giới hạn số cron jobs
- ✅ **Powerful**: Có thể chạy SQL trực tiếp
- ✅ **Free tier**: Included trong Supabase
- ✅ **Chi phí**: $0/month (free tier)

#### **Setup:**

**1. Enable pg_cron extension trong Supabase:**
```sql
-- Chạy trong Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job để check deadlines
SELECT cron.schedule(
  'check-deadlines-daily',
  '0 9 * * *', -- 9 AM mỗi ngày
  $$
  -- SQL query để check deadlines và insert vào notifications table
  INSERT INTO notifications (user_id, type, title, message, channel)
  SELECT 
    a.user_id,
    'deadline_reminder',
    'Deadline sắp đến',
    'Bạn có bài tập deadline vào ' || a.deadline,
    'email'
  FROM assignments a
  WHERE a.deadline BETWEEN NOW() AND NOW() + INTERVAL '1 day'
    AND a.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.user_id = a.user_id 
      AND n.type = 'deadline_reminder'
      AND n.created_at > NOW() - INTERVAL '1 day'
    );
  $$
);
```

**2. Hoặc dùng Supabase Edge Functions:**
```typescript
// supabase/functions/check-deadlines/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Logic check deadlines
  // ...

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Schedule Edge Function với pg_cron:**
```sql
SELECT cron.schedule(
  'call-edge-function-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/check-deadlines',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

**Pros:**
- ✅ Unlimited cron jobs
- ✅ Chạy trực tiếp trong database (nhanh)
- ✅ Free
- ✅ Có thể dùng SQL hoặc Edge Functions

**Cons:**
- ⚠️ Setup phức tạp hơn một chút
- ⚠️ Cần hiểu SQL

---

### **Option 3: External Cron Service (Free)**

#### **Services:**
- **cron-job.org**: Free, unlimited jobs
- **EasyCron**: Free tier (1 job, 1 execution/day)
- **GitHub Actions**: Free với schedule

#### **Setup với cron-job.org:**

**1. Tạo API Route trong Next.js:**
```typescript
// app/api/cron/check-deadlines/route.ts
export async function GET(request: Request) {
  // Verify secret
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Your logic here
  return NextResponse.json({ success: true });
}
```

**2. Setup trong cron-job.org:**
- URL: `https://your-domain.vercel.app/api/cron/check-deadlines`
- Method: GET
- Header: `x-cron-secret: YOUR_SECRET`
- Schedule: `0 9 * * *`

**Pros:**
- ✅ Free
- ✅ Unlimited jobs (cron-job.org)
- ✅ Không phụ thuộc vào Vercel

**Cons:**
- ⚠️ Phụ thuộc vào service bên ngoài
- ⚠️ Cần verify secret cẩn thận

---

### **Option 4: GitHub Actions (Free)**

#### **Setup:**

**`.github/workflows/cron.yml`:**
```yaml
name: Scheduled Jobs

on:
  schedule:
    - cron: '0 9 * * *' # 9 AM mỗi ngày
  workflow_dispatch: # Cho phép chạy manual

jobs:
  check-deadlines:
    runs-on: ubuntu-latest
    steps:
      - name: Call API
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.vercel.app/api/cron/check-deadlines
```

**Pros:**
- ✅ Free
- ✅ Reliable (GitHub infrastructure)
- ✅ Có thể chạy manual

**Cons:**
- ⚠️ Phải public repo hoặc GitHub Pro (để private repo)
- ⚠️ Phức tạp hơn một chút

---

## 3. Recommended Solution (Kết Hợp)

### **Best Practice: Kết hợp cả 2**

#### **1. Vercel Cron Jobs** (cho jobs đơn giản, < 10s):
- Check deadlines hàng ngày
- Send reminder emails

#### **2. Supabase pg_cron** (cho jobs phức tạp, SQL-heavy):
- Calculate user levels (có thể cần nhiều queries)
- Generate reports
- Cleanup old data

### **Architecture:**

```
┌─────────────────┐
│  Vercel Cron    │ → Check deadlines (simple)
│  (2 jobs free)  │ → Send reminders
└─────────────────┘

┌─────────────────┐
│ Supabase pg_cron│ → Calculate levels (complex SQL)
│  (unlimited)    │ → Generate reports
└─────────────────┘
```

---

## 4. Implementation Example

### **Example 1: Check Deadlines với Vercel Cron**

**`app/api/cron/check-deadlines/route.ts`:**
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get assignments với deadline trong 24h tới
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        *,
        users!assignments_user_id_fkey (
          email,
          parent_email,
          name
        )
      `)
      .eq('is_active', true)
      .gte('deadline', new Date().toISOString())
      .lte('deadline', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    // Send notifications
    for (const assignment of assignments || []) {
      // Send to student
      if (assignment.users.email) {
        await resend.emails.send({
          from: 'noreply@yourdomain.com',
          to: assignment.users.email,
          subject: `Deadline sắp đến: ${assignment.title}`,
          html: `<p>Bạn có deadline vào ${new Date(assignment.deadline).toLocaleString('vi-VN')}</p>`,
        });
      }

      // Send to parent
      if (assignment.users.parent_email) {
        await resend.emails.send({
          from: 'noreply@yourdomain.com',
          to: assignment.users.parent_email,
          subject: `Con bạn có deadline sắp đến`,
          html: `<p>${assignment.users.name} có deadline vào ${new Date(assignment.deadline).toLocaleString('vi-VN')}</p>`,
        });
      }

      // Insert notification record
      await supabase.from('notifications').insert({
        user_id: assignment.user_id,
        type: 'deadline_reminder',
        title: 'Deadline sắp đến',
        message: `Bạn có deadline vào ${new Date(assignment.deadline).toLocaleString('vi-VN')}`,
        channel: 'email',
        is_sent: true,
        sent_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      processed: assignments?.length || 0 
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**`vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-deadlines",
      "schedule": "0 9 * * *"
    }
  ]
}
```

---

### **Example 2: Calculate User Levels với Supabase pg_cron**

**SQL trong Supabase:**
```sql
-- Schedule job để tính lại level mỗi đêm
SELECT cron.schedule(
  'calculate-user-levels',
  '0 2 * * *', -- 2 AM mỗi ngày
  $$
  -- Update user levels dựa trên lịch sử làm bài
  WITH user_stats AS (
    SELECT 
      s.user_id,
      e.section_id,
      sec.chapter_id,
      ch.subject_id,
      COUNT(*) as total_submissions,
      SUM(CASE WHEN s.score >= a.min_score THEN 1 ELSE 0 END) as correct_submissions,
      AVG(s.score) as avg_score
    FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN exercises e ON a.exercise_id = e.id
    JOIN sections sec ON e.section_id = sec.id
    JOIN chapters ch ON sec.chapter_id = ch.id
    WHERE s.status = 'graded'
      AND s.submitted_at > NOW() - INTERVAL '30 days'
    GROUP BY s.user_id, e.section_id, sec.chapter_id, ch.subject_id
  ),
  level_calculations AS (
    SELECT 
      user_id,
      subject_id,
      SUM(total_submissions) as total_exercises,
      SUM(correct_submissions) as correct_exercises,
      CASE 
        WHEN SUM(total_submissions) > 0 
        THEN (SUM(correct_submissions)::decimal / SUM(total_submissions) * 100)
        ELSE 0 
      END as accuracy_rate,
      AVG(avg_score) as level_score
    FROM user_stats
    GROUP BY user_id, subject_id
  )
  INSERT INTO user_levels (user_id, subject_id, level_score, total_exercises, correct_exercises, accuracy_rate, last_updated)
  SELECT 
    user_id,
    subject_id,
    level_score,
    total_exercises,
    correct_exercises,
    accuracy_rate,
    NOW()
  FROM level_calculations
  ON CONFLICT (user_id, subject_id) 
  DO UPDATE SET
    level_score = EXCLUDED.level_score,
    total_exercises = EXCLUDED.total_exercises,
    correct_exercises = EXCLUDED.correct_exercises,
    accuracy_rate = EXCLUDED.accuracy_rate,
    last_updated = NOW();
  $$
);
```

---

## 5. Summary & Recommendation

### ✅ **Recommended Approach:**

1. **Vercel Cron Jobs** (2 jobs free):
   - Check deadlines và gửi reminders
   - Send daily/weekly reports

2. **Supabase pg_cron** (unlimited):
   - Calculate user levels (complex SQL)
   - Generate reports
   - Cleanup old data

### 💰 **Cost: $0/month** (tất cả đều free!)

### 📋 **Schedule Jobs Cần Thiết:**

| Job | Frequency | Method | Purpose |
|-----|-----------|--------|---------|
| Check deadlines | Daily 9 AM | Vercel Cron | Gửi reminder trước deadline |
| Check overdue | Daily 9 AM | Vercel Cron | Gửi thông báo trễ deadline |
| Calculate levels | Daily 2 AM | Supabase pg_cron | Tính lại level của users |
| Weekly reports | Weekly Sunday | Vercel Cron | Gửi báo cáo tuần cho phụ huynh |
| Cleanup old data | Monthly | Supabase pg_cron | Xóa data cũ |

---

## 6. Security Best Practices

1. **Always verify cron secret** trong API routes
2. **Use service role key** cho Supabase (không dùng anon key)
3. **Rate limiting** nếu cần
4. **Error handling** và logging
5. **Monitor** execution time và failures

---

**Kết luận**: Next.js + Supabase hoàn toàn hỗ trợ scheduled jobs với **chi phí $0**! 🎉

