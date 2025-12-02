import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * Send deadline reminder email
 */
export async function sendDeadlineReminderEmail(
  to: string,
  studentName: string,
  assignmentTitle: string,
  deadline: Date
) {
  const deadlineStr = deadline.toLocaleString('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return sendEmail({
    to,
    subject: `Deadline sắp đến: ${assignmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thông báo Deadline</h2>
        <p>Xin chào ${studentName},</p>
        <p>Bạn có một bài tập với deadline sắp đến:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Bài tập:</strong> ${assignmentTitle}</p>
          <p><strong>Deadline:</strong> ${deadlineStr}</p>
        </div>
        <p>Vui lòng hoàn thành bài tập trước deadline.</p>
        <p>Trân trọng,<br>Hệ thống Sulo Training</p>
      </div>
    `,
  });
}

/**
 * Send overdue deadline email to parent
 */
export async function sendOverdueEmailToParent(
  parentEmail: string,
  studentName: string,
  assignmentTitle: string,
  deadline: Date
) {
  const deadlineStr = deadline.toLocaleString('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return sendEmail({
    to: parentEmail,
    subject: `Con bạn đã trễ deadline: ${assignmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thông báo Trễ Deadline</h2>
        <p>Kính gửi Phụ huynh,</p>
        <p>Chúng tôi thông báo rằng con bạn <strong>${studentName}</strong> đã trễ deadline cho bài tập sau:</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p><strong>Bài tập:</strong> ${assignmentTitle}</p>
          <p><strong>Deadline:</strong> ${deadlineStr}</p>
        </div>
        <p>Vui lòng nhắc nhở con bạn hoàn thành bài tập sớm nhất có thể.</p>
        <p>Trân trọng,<br>Hệ thống Sulo Training</p>
      </div>
    `,
  });
}

/**
 * Send grade released email
 */
export async function sendGradeReleasedEmail(
  to: string,
  studentName: string,
  assignmentTitle: string,
  score: number,
  maxScore: number
) {
  return sendEmail({
    to,
    subject: `Kết quả bài tập: ${assignmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Kết quả Bài tập</h2>
        <p>Xin chào ${studentName},</p>
        <p>Bài tập của bạn đã được chấm điểm:</p>
        <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Bài tập:</strong> ${assignmentTitle}</p>
          <p><strong>Điểm số:</strong> ${score}/${maxScore}</p>
        </div>
        <p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và nhận xét.</p>
        <p>Trân trọng,<br>Hệ thống Sulo Training</p>
      </div>
    `,
  });
}

