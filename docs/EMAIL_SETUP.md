# Email Service Setup - Resend

## Tổng quan

Dự án sử dụng **Resend** làm email service provider. Resend là lựa chọn tốt nhất cho Next.js vì:

- ✅ **Miễn phí**: 3,000 emails/tháng, 100 emails/ngày
- ✅ **API đơn giản**: Dễ tích hợp với Next.js
- ✅ **UI đẹp**: Dashboard để xem email logs
- ✅ **Reliable**: Uptime cao, deliverability tốt
- ✅ **Developer friendly**: Documentation tốt

## So sánh với các provider khác

| Provider | Free Tier | Setup | Recommendation |
|----------|-----------|-------|----------------|
| **Resend** ⭐ | 3,000 emails/tháng | Dễ | **Khuyên dùng** |
| SendGrid | 100 emails/ngày | Trung bình | Tốt |
| Mailgun | 5,000 emails/tháng (3 tháng đầu) | Trung bình | Tốt |
| AWS SES | 62,000 emails/tháng (với EC2) | Phức tạp | Phức tạp |
| Nodemailer + Gmail | Miễn phí | Dễ nhưng giới hạn | Không khuyên dùng |

## Setup Instructions

### Bước 1: Tạo tài khoản Resend

1. Truy cập: https://resend.com
2. Đăng ký tài khoản miễn phí
3. Xác thực email của bạn

### Bước 2: Lấy API Key

1. Vào Dashboard > API Keys
2. Click "Create API Key"
3. Đặt tên: `BaitapOnline Production` (hoặc `Development`)
4. Copy API key (bắt đầu với `re_`)

### Bước 3: Verify Domain (Production)

**Quan trọng**: Để gửi email từ domain của bạn (ví dụ: `noreply@yourdomain.com`):

1. Vào Dashboard > Domains
2. Click "Add Domain"
3. Nhập domain của bạn (ví dụ: `yourdomain.com`)
4. Thêm DNS records vào domain provider:
   - SPF record
   - DKIM records
   - DMARC record (optional)
5. Đợi verification (thường mất vài phút)

**Lưu ý**: Nếu chưa có domain, bạn có thể dùng domain test của Resend:
- `onboarding@resend.dev` (chỉ để test, không dùng production)

### Bước 4: Cấu hình Environment Variables

Thêm vào file `.env`:

```env
# Resend API Key
RESEND_API_KEY="re_your-api-key-here"

# Email sender (phải là email đã verify trong Resend)
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

### Bước 5: Test Email Service

Chạy script test:

```bash
npm run email:test
```

Hoặc test thủ công trong code:

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
  to: 'your-email@example.com',
  subject: 'Test Email',
  html: '<h1>Hello from BaitapOnline!</h1>',
});
```

## Email Templates

Dự án đã có các email templates sẵn:

1. **Deadline Reminder** - Nhắc nhở deadline sắp đến
2. **Overdue Notice** - Thông báo trễ deadline cho phụ huynh
3. **Grade Released** - Thông báo điểm số

Xem chi tiết trong `lib/email.ts`

## Usage Examples

### Gửi email đơn giản

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
  to: 'student@example.com',
  subject: 'Chào mừng đến với BaitapOnline',
  html: '<h1>Xin chào!</h1><p>Chúc mừng bạn đã đăng ký thành công.</p>',
});
```

### Gửi email cho nhiều người

```typescript
await sendEmail({
  to: ['student1@example.com', 'student2@example.com'],
  subject: 'Thông báo chung',
  html: '<p>Thông báo cho tất cả học sinh...</p>',
});
```

### Gửi email với custom sender

```typescript
await sendEmail({
  to: 'student@example.com',
  subject: 'Email từ giáo viên',
  from: 'teacher@yourdomain.com',
  html: '<p>Nội dung email...</p>',
});
```

## Monitoring & Logs

1. Vào Resend Dashboard > Emails
2. Xem tất cả emails đã gửi
3. Xem delivery status (delivered, bounced, etc.)
4. Xem error logs nếu có

## Troubleshooting

### Email không được gửi

1. **Kiểm tra API Key**: Đảm bảo `RESEND_API_KEY` đúng
2. **Kiểm tra From Email**: Phải là email đã verify
3. **Kiểm tra Rate Limit**: Free tier giới hạn 100 emails/ngày
4. **Xem Logs**: Check Resend Dashboard > Emails

### Email vào Spam

1. **Verify Domain**: Phải verify domain và thêm DNS records
2. **SPF Record**: Đảm bảo SPF record đúng
3. **DKIM Records**: Thêm DKIM records
4. **Warm up**: Gửi ít email ban đầu để "warm up" domain

### Error: "Invalid API Key"

- Kiểm tra lại API key trong `.env`
- Đảm bảo không có khoảng trắng
- Regenerate API key nếu cần

## Cost

- **Free Tier**: 3,000 emails/tháng, 100 emails/ngày
- **Paid Plans**: Bắt đầu từ $20/tháng cho 50,000 emails

**Ước tính chi phí cho MVP**:
- 100 học sinh × 10 emails/tháng = 1,000 emails/tháng
- **Chi phí: $0** (nằm trong free tier)

## Best Practices

1. **Always verify domain** cho production
2. **Use templates** để maintain consistency
3. **Monitor delivery rates** trong Resend Dashboard
4. **Handle errors gracefully** trong code
5. **Rate limiting**: Không gửi quá 100 emails/ngày (free tier)
6. **Unsubscribe**: Thêm unsubscribe link nếu cần

## Resources

- Resend Documentation: https://resend.com/docs
- Resend Dashboard: https://resend.com/emails
- API Reference: https://resend.com/docs/api-reference/emails/send-email



