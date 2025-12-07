import { config } from 'dotenv';
import { sendEmail, sendDeadlineReminderEmail, sendGradeReleasedEmail } from '../lib/email';

// Load .env file
config();

async function testEmail() {
  console.log('🧪 Testing Email Service (Resend)...\n');

  // Check environment variables
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set in .env file');
    console.log('\n📝 Please add to .env:');
    console.log('RESEND_API_KEY="re_your-api-key-here"');
    console.log('RESEND_FROM_EMAIL="noreply@yourdomain.com"');
    process.exit(1);
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn('⚠️  RESEND_FROM_EMAIL is not set, using default');
  }

  // Get test email from command line or use default
  const testEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';

  console.log(`📧 Sending test email to: ${testEmail}`);
  console.log(`📤 From: ${process.env.RESEND_FROM_EMAIL || 'noreply@example.com'}\n`);

  try {
    // Test 1: Simple email
    console.log('1️⃣  Testing simple email...');
    const result1 = await sendEmail({
      to: testEmail,
      subject: '🧪 Test Email từ BaitapOnline',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ff6b35;">BaitapOnline - Test Email</h1>
          <p>Đây là email test từ hệ thống BaitapOnline.</p>
          <p>Nếu bạn nhận được email này, có nghĩa là email service đã hoạt động thành công! ✅</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            Thời gian: ${new Date().toLocaleString('vi-VN')}
          </p>
        </div>
      `,
    });
    console.log('   ✅ Simple email sent successfully!');
    console.log(`   📧 Email ID: ${result1?.id || 'N/A'}\n`);

    // Test 2: Deadline reminder email
    console.log('2️⃣  Testing deadline reminder email...');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1); // Tomorrow
    await sendDeadlineReminderEmail(
      testEmail,
      'Học Sinh Test',
      'Bài tập Toán - Chương 1',
      deadline
    );
    console.log('   ✅ Deadline reminder email sent successfully!\n');

    // Test 3: Grade released email
    console.log('3️⃣  Testing grade released email...');
    await sendGradeReleasedEmail(
      testEmail,
      'Học Sinh Test',
      'Bài tập Toán - Chương 1',
      8,
      10
    );
    console.log('   ✅ Grade released email sent successfully!\n');

    console.log('🎉 All email tests passed!');
    console.log('\n📊 Check your email inbox and Resend Dashboard:');
    console.log('   https://resend.com/emails');
  } catch (error) {
    console.error('\n❌ Email test failed:', error);
    
    if (error instanceof Error) {
      console.error('\nError details:');
      console.error('  Message:', error.message);
      
      // Common error messages
      if (error.message.includes('Invalid API key')) {
        console.error('\n💡 Solution: Check your RESEND_API_KEY in .env file');
      } else if (error.message.includes('Invalid `from`')) {
        console.error('\n💡 Solution: Verify your email domain in Resend Dashboard');
        console.error('   https://resend.com/domains');
      } else if (error.message.includes('rate limit')) {
        console.error('\n💡 Solution: You have reached the rate limit (100 emails/day for free tier)');
        console.error('   Wait 24 hours or upgrade your plan');
      }
    }
    
    process.exit(1);
  }
}

// Run test
testEmail()
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });



