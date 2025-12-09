#!/usr/bin/env tsx
/**
 * Send Daily Activity Email to All Users Script
 * 
 * This script sends daily activity report emails to all active students with email addresses.
 * Usage: npx tsx scripts/send-daily-activity-email-all.ts
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
        Dưới đây là báo cáo hoạt động học tập của con bạn trong ngày hôm nay:
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
    
    // Calculate today's date (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

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

    // Get exercise attempts from today
    const exerciseAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: today,
          lte: todayEnd,
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

    // Group by subject and chapter, count total answers (not unique questions)
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

    // Track exercises per chapter to avoid duplicate details in summary
    const processedExercises = new Map<string, Set<number>>();

    exerciseAttempts.forEach((attempt) => {
      const subject = attempt.exercise.section.chapter.subject;
      const subjectName = subject.name;
      const chapter = attempt.exercise.section.chapter;
      const chapterName = chapter.name;
      const exerciseId = attempt.exerciseId;
      const questionCount = attempt.exercise.questions.length; // Total questions in this attempt

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
        processedExercises.set(chapterKey, new Set());
      }

      const chapterData = subjectData.chapters.get(chapterName)!;
      const chapterProcessedExercises = processedExercises.get(chapterKey)!;

      // Count total answers (each attempt counts all its questions)
      chapterData.questionCount += questionCount;
      subjectData.questionCount += questionCount;

      // Add detail for this exercise (only once per exercise in this chapter for summary)
      if (!chapterProcessedExercises.has(exerciseId)) {
        chapterProcessedExercises.add(exerciseId);
        
        const exerciseTitle = attempt.exercise.title;
        // Count total questions from all attempts of this exercise
        const totalQuestionCount = exerciseAttempts
          .filter(a => a.exerciseId === exerciseId)
          .reduce((sum, a) => sum + a.exercise.questions.length, 0);

        chapterData.details.push({
          exerciseTitle,
          questionCount: totalQuestionCount,
        });
      }
    });

    // Get AI conversation messages from today
    const aiMessages = await prisma.message.findMany({
      where: {
        conversation: {
          userId: user.id,
          type: 'free_chat',
        },
        role: 'user',
        createdAt: {
          gte: today,
          lte: todayEnd,
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
      date: today.toISOString(),
      studentName: user.displayName || user.username,
    };
  } catch (error) {
    console.error('Error getting daily activity stats:', error);
    return null;
  }
}

async function sendDailyActivityEmail(username: string, recipientEmail?: string) {
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
    return false;
  }

  // Get daily activity stats
  const stats = await getDailyActivityStats(username);

  if (!stats) {
    return false;
  }

  // Check if there's any activity
  const totalQuestions = stats.subjectStats.reduce((sum, s) => sum + s.questionCount, 0) + stats.aiQuestionCount;
  if (totalQuestions === 0) {
    return false;
  }

  // Generate email HTML
  const emailHTML = generateEmailHTML(stats, username);

  // Send email
  try {
    await sendEmail({
      to: email,
      subject: `Báo cáo hoạt động học tập - ${stats.studentName || username}`,
      html: emailHTML,
    });

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
  console.log('📧 Daily Activity Email Sender - All Users\n');
  console.log('='.repeat(50));

  // Dynamic import to ensure env is loaded first
  const { prisma } = await import('../lib/prisma');

  try {
    // Get all active users with email
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        email: {
          not: null,
        },
        role: 'student', // Only send to students
      },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        email: true,
      },
    });

    console.log(`📋 Found ${users.length} active students with email addresses\n`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      try {
        console.log(`📬 Processing: ${user.username} (${user.displayName || user.name || user.username})`);
        
        const success = await sendDailyActivityEmail(user.username, user.email || undefined);
        
        if (success) {
          successCount++;
          console.log(`   ✅ Email sent successfully\n`);
        } else {
          skippedCount++;
          console.log(`   ⚠️  No activity today or failed to send\n`);
        }

        // Add delay to avoid rate limiting (2 requests/second for Resend)
        await new Promise(resolve => setTimeout(resolve, 600)); // 600ms delay = ~1.67 requests/second
      } catch (error) {
        console.error(`   ❌ Failed to send email to ${user.username}:`, error);
        failCount++;
      }
    }

    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📋 Total: ${users.length}\n`);

    if (successCount > 0) {
      console.log('🎉 Daily activity emails sent successfully!');
    }
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main function
main()
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });

