import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

interface WeeklyActivityStats {
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
  dateRange: {
    start: string;
    end: string;
  };
  studentName?: string;
}

function generateWeeklyEmailHTML(stats: WeeklyActivityStats, usernameParam?: string | null): string {
  const startDate = new Date(stats.dateRange.start);
  const endDate = new Date(stats.dateRange.end);
  const formattedStartDate = startDate.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
  });
  const formattedEndDate = endDate.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const username = usernameParam || '';
  
  const subjectItems = stats.subjectStats.map((subject) => {
    const detailUrl = username 
      ? `${baseUrl}/emailTemplatePreview?username=${encodeURIComponent(username)}&subject=${encodeURIComponent(subject.subjectName)}&date=${stats.dateRange.end}`
      : `${baseUrl}/emailTemplatePreview?subject=${encodeURIComponent(subject.subjectName)}&date=${stats.dateRange.end}`;
    
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
    ? `${baseUrl}/emailTemplatePreview?username=${encodeURIComponent(username)}&ai=true&date=${stats.dateRange.end}`
    : `${baseUrl}/emailTemplatePreview?ai=true&date=${stats.dateRange.end}`;
  const studentName = stats.studentName || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo hoạt động học tập tuần</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1f2937;">
        Báo cáo hoạt động học tập tuần
      </h1>
      ${studentName ? `<p style="margin: 8px 0 0 0; color: #374151; font-size: 16px; font-weight: 500;">
        Học viên: ${studentName}
      </p>` : ''}
      <p style="margin: ${studentName ? '8px' : '8px'} 0 0 0; color: #6b7280; font-size: 14px;">
        Tuần từ ${formattedStartDate} đến ${formattedEndDate}
      </p>
    </div>

    <!-- Content -->
    <div style="margin-bottom: 30px;">
      <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
        Kính gửi Quý phụ huynh,
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">
        Dưới đây là báo cáo hoạt động học tập của con bạn trong tuần vừa qua:
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

async function getWeeklyActivityStats(userId: number): Promise<WeeklyActivityStats | null> {
  try {
    // Calculate last week's date range (Monday to Sunday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get last Monday (start of last week)
    const lastMonday = new Date(today);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If today is Sunday, go back 6 days, else go back (dayOfWeek - 1) days
    lastMonday.setDate(today.getDate() - daysToLastMonday - 7); // Go back to last week's Monday
    lastMonday.setHours(0, 0, 0, 0);
    
    // Get last Sunday (end of last week)
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6); // Add 6 days to get Sunday
    lastSunday.setHours(23, 59, 59, 999);

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        displayName: true,
        username: true,
      },
    });

    if (!user) {
      return null;
    }

    // Get exercise attempts from last week
    const exerciseAttempts = await prisma.userExerciseAttempt.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: lastMonday,
          lte: lastSunday,
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

    // Get AI conversation messages from last week
    const aiMessages = await prisma.message.findMany({
      where: {
        conversation: {
          userId: user.id,
          type: 'free_chat',
        },
        role: 'user',
        createdAt: {
          gte: lastMonday,
          lte: lastSunday,
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
      dateRange: {
        start: lastMonday.toISOString(),
        end: lastSunday.toISOString(),
      },
      studentName: user.displayName || user.username,
    };
  } catch (error) {
    console.error('Error getting weekly activity stats:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

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

    console.log(`📋 Found ${users.length} active users with email addresses`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      try {
        // Get weekly activity stats
        const stats = await getWeeklyActivityStats(user.id);
        
        if (!stats) {
          skippedCount++;
          continue;
        }

        // Check if there's any activity
        const totalQuestions = stats.subjectStats.reduce((sum, s) => sum + s.questionCount, 0) + stats.aiQuestionCount;
        if (totalQuestions === 0) {
          skippedCount++;
          continue;
        }

        // Generate email HTML
        const emailHTML = generateWeeklyEmailHTML(stats, user.username);

        // Send email
        await sendEmail({
          to: user.email!,
          subject: `Báo cáo hoạt động học tập tuần - ${stats.studentName || user.username}`,
          html: emailHTML,
        });

        successCount++;

        // Add delay to avoid rate limiting (2 requests/second for Resend)
        await new Promise(resolve => setTimeout(resolve, 600)); // 600ms delay = ~1.67 requests/second
      } catch (error) {
        console.error(`Failed to send email to ${user.username}:`, error);
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        success: successCount,
        failed: failCount,
        skipped: skippedCount,
        total: users.length,
      },
    });
  } catch (error) {
    console.error('Weekly activity email cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

