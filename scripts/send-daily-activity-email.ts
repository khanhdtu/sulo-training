#!/usr/bin/env tsx
/**
 * Send Daily Activity Email Script
 * 
 * This script sends daily activity report email to a user.
 * Usage: npx tsx scripts/send-daily-activity-email.ts <username> [email]
 * 
 * Example:
 *   npx tsx scripts/send-daily-activity-email.ts nhahan
 *   npx tsx scripts/send-daily-activity-email.ts nhahan parent@example.com
 */

import { config } from 'dotenv';

// Load .env file FIRST before any other imports
config();

interface DailyActivityStats {
  subjectStats: {
    subjectName: string;
    questionCount: number;
    chapters: Array<{
      chapterName: string;
      questionCount: number;
      details: Array<{
        exerciseTitle: string;
        questionCount: number;
      }>;
    }>;
  }[];
  aiQuestionCount: number;
  date: string;
  studentName?: string;
}

function generateEmailHTML(stats: DailyActivityStats, usernameParam?: string | null): string {
  const date = new Date(stats.date);
  const formattedDate = date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const username = usernameParam || '';
  
  const subjectItems = stats.subjectStats.map((subject) => {
    const detailUrl = username 
      ? `${baseUrl}/emailTemplatePreview?username=${encodeURIComponent(username)}&subject=${encodeURIComponent(subject.subjectName)}&date=${stats.date}`
      : `${baseUrl}/emailTemplatePreview?subject=${encodeURIComponent(subject.subjectName)}&date=${stats.date}`;
    
    const chapterRows = subject.chapters.map((chapter, index) => {
      const isLast = index === subject.chapters.length - 1;
      return `
        <tr>
          <td style="padding: 8px 12px 8px 40px; ${isLast ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: #4b5563; font-size: 14px; background-color: #f9fafb;">
            • ${chapter.chapterName}
          </td>
          <td style="padding: 8px 12px; ${isLast ? 'border-bottom: 1px solid #e5e7eb;' : ''} text-align: right; color: #6b7280; font-size: 14px; background-color: #f9fafb;">
            (${chapter.questionCount} câu)
          </td>
        </tr>
      `;
    }).join('');
    
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; border-top: 2px solid #e5e7eb; background-color: #ffffff;">
          <a href="${detailUrl}" style="color: #1f2937; text-decoration: none; font-weight: 600; font-size: 16px;">
            ${subject.subjectName}
          </a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280; border-top: 2px solid #e5e7eb; background-color: #ffffff;">
          (${subject.questionCount} câu)
        </td>
      </tr>
      ${chapterRows}
    `;
  }).join('');

  const aiDetailUrl = username
    ? `${baseUrl}/emailTemplatePreview?username=${encodeURIComponent(username)}&ai=true&date=${stats.date}`
    : `${baseUrl}/emailTemplatePreview?ai=true&date=${stats.date}`;
  const studentName = stats.studentName || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo hoạt động học tập</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1f2937;">
        Báo cáo hoạt động học tập
      </h1>
      ${studentName ? `<p style="margin: 8px 0 0 0; color: #374151; font-size: 16px; font-weight: 500;">
        Học viên: ${studentName}
      </p>` : ''}
      <p style="margin: ${studentName ? '8px' : '8px'} 0 0 0; color: #6b7280; font-size: 14px;">
        Ngày ${formattedDate}
      </p>
    </div>

    <!-- Content -->
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
        Kính gửi Quý phụ huynh,
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
        Dưới đây là báo cáo hoạt động học tập của con bạn trong ngày hôm qua:
      </p>
    </div>

    <!-- Activity Stats Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      ${subjectItems}
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${aiDetailUrl}" style="color: #1f2937; text-decoration: none; font-weight: 600; font-size: 16px;">
            Hỏi trợ lý AI
          </a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
          (${stats.aiQuestionCount} câu)
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Trân trọng,<br />
        Hệ thống BaitapOnline
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

async function getDailyActivityStats(username: string): Promise<DailyActivityStats | null> {
  try {
    // Dynamic import to ensure env is loaded first
    const { prisma } = await import('../lib/prisma');
    
    // Calculate yesterday's date (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: { 
        id: true,
        displayName: true,
        username: true,
      },
    });

    if (!user) {
      console.error(`❌ User with username "${username}" not found!`);
      return null;
    }

    // Get exercise attempts from yesterday
    const exerciseAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
      include: {
        exercise: {
          include: {
            section: {
              include: {
                chapter: {
                  include: {
                    subject: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            questions: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Group by subject and chapter, count unique questions
    const subjectMap = new Map<string, {
      subjectName: string;
      questionCount: number;
      chapters: Map<string, {
        chapterName: string;
        questionCount: number;
        details: Array<{
          exerciseTitle: string;
          questionCount: number;
        }>;
      }>;
    }>();

    // Track unique questions per chapter to avoid double counting
    const chapterQuestionSets = new Map<string, Set<number>>();
    // Track unique exercises per chapter to avoid duplicate details
    const processedExercises = new Map<string, Set<number>>();

    exerciseAttempts.forEach((attempt) => {
      const subject = attempt.exercise.section.chapter.subject;
      const subjectName = subject.name;
      const chapter = attempt.exercise.section.chapter;
      const chapterName = chapter.name;
      const exerciseId = attempt.exerciseId;
      const questionIds = attempt.exercise.questions.map((q) => q.id);

      // Create unique key for subject+chapter
      const chapterKey = `${subjectName}|${chapterName}`;

      // Initialize subject map if needed
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          subjectName,
          questionCount: 0,
          chapters: new Map(),
        });
      }

      const subjectData = subjectMap.get(subjectName)!;

      // Initialize chapter map if needed
      if (!subjectData.chapters.has(chapterName)) {
        subjectData.chapters.set(chapterName, {
          chapterName,
          questionCount: 0,
          details: [],
        });
        chapterQuestionSets.set(chapterKey, new Set());
        processedExercises.set(chapterKey, new Set());
      }

      const chapterData = subjectData.chapters.get(chapterName)!;
      const chapterQuestionSet = chapterQuestionSets.get(chapterKey)!;
      const chapterProcessedExercises = processedExercises.get(chapterKey)!;

      // Count unique questions for this chapter
      questionIds.forEach((qId) => {
        if (!chapterQuestionSet.has(qId)) {
          chapterQuestionSet.add(qId);
          chapterData.questionCount++;
          subjectData.questionCount++;
        }
      });

      // Add detail for this exercise (only once per exercise in this chapter)
      if (!chapterProcessedExercises.has(exerciseId)) {
        chapterProcessedExercises.add(exerciseId);
        
        const exerciseTitle = attempt.exercise.title;
        const uniqueQuestionCount = questionIds.length;

        chapterData.details.push({
          exerciseTitle,
          questionCount: uniqueQuestionCount,
        });
      }
    });

    // Get AI conversation messages from yesterday
    const aiMessages = await prisma.message.findMany({
      where: {
        conversation: {
          userId: user.id,
          type: 'free_chat',
        },
        role: 'user',
        createdAt: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
    });

    const aiQuestionCount = aiMessages.length;

    // Convert maps to arrays and sort
    const subjectStats = Array.from(subjectMap.values()).map((subject) => ({
      subjectName: subject.subjectName,
      questionCount: subject.questionCount,
      chapters: Array.from(subject.chapters.values()).sort((a, b) =>
        a.chapterName.localeCompare(b.chapterName)
      ),
    })).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );

    return {
      subjectStats,
      aiQuestionCount,
      date: yesterday.toISOString(),
      studentName: user.displayName || user.username,
    };
  } catch (error) {
    console.error('Error getting daily activity stats:', error);
    return null;
  }
}

async function sendDailyActivityEmail(username: string, recipientEmail?: string) {
  console.log(`\n📧 Sending daily activity email for user: ${username}\n`);

  // Dynamic import to ensure env is loaded first
  const { prisma } = await import('../lib/prisma');
  const { sendEmail } = await import('../lib/email');

  // Get user info
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      displayName: true,
      email: true,
    },
  });

  if (!user) {
    console.error(`❌ User with username "${username}" not found!`);
    return false;
  }

  // Determine recipient email
  const email = recipientEmail || user.email;
  if (!email) {
    console.error(`❌ No email address found for user "${username}"`);
    console.error('   Please provide email as second argument or set email in user profile');
    return false;
  }

  console.log(`📬 Recipient: ${email}`);
  console.log(`👤 Student: ${user.displayName || user.name || user.username}\n`);

  // Get daily activity stats
  console.log('📊 Fetching daily activity stats...');
  const stats = await getDailyActivityStats(username);

  if (!stats) {
    console.error('❌ Failed to get daily activity stats');
    return false;
  }

  // Check if there's any activity
  const totalQuestions = stats.subjectStats.reduce((sum, s) => sum + s.questionCount, 0) + stats.aiQuestionCount;
  if (totalQuestions === 0) {
    console.log('⚠️  No activity found for yesterday. Email not sent.');
    return false;
  }

  console.log(`✅ Found activity:`);
  console.log(`   Subjects: ${stats.subjectStats.length}`);
  console.log(`   Total questions: ${totalQuestions}`);
  console.log(`   AI questions: ${stats.aiQuestionCount}\n`);

  // Generate email HTML
  const emailHTML = generateEmailHTML(stats, username);

  // Send email
  try {
    console.log('📤 Sending email...');
    const result = await sendEmail({
      to: email,
      subject: `Báo cáo hoạt động học tập - ${stats.studentName || username}`,
      html: emailHTML,
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Email ID: ${result?.id || 'N/A'}\n`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: npx tsx scripts/send-daily-activity-email.ts <username> [email]');
    console.error('\nExample:');
    console.error('  npx tsx scripts/send-daily-activity-email.ts nhahan');
    console.error('  npx tsx scripts/send-daily-activity-email.ts nhahan parent@example.com');
    process.exit(1);
  }

  const [username, recipientEmail] = args;

  console.log('📧 Daily Activity Email Sender\n');
  console.log('='.repeat(50));
  console.log(`Username: ${username}`);
  if (recipientEmail) {
    console.log(`Recipient Email: ${recipientEmail}`);
  }
  console.log('='.repeat(50));

  const success = await sendDailyActivityEmail(username, recipientEmail);

  if (success) {
    console.log('🎉 Email sent successfully!');
    process.exit(0);
  } else {
    console.log('❌ Failed to send email');
    process.exit(1);
  }
}

// Run main function
main()
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  })
  .finally(async () => {
    // Dynamic import to ensure env is loaded first
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  });

