import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDeadlineReminderEmail, sendOverdueEmailToParent } from '@/lib/email';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get assignments with deadline in next 24 hours
    const upcomingAssignments = await prisma.assignment.findMany({
      where: {
        isActive: true,
        deadline: {
          gte: now,
          lte: tomorrow,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            parentEmail: true,
          },
        },
      },
    });

    // Get overdue assignments
    const overdueAssignments = await prisma.assignment.findMany({
      where: {
        isActive: true,
        deadline: {
          lt: now,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            parentEmail: true,
          },
        },
        submissions: {
          where: {
            status: {
              not: 'completed',
            },
          },
        },
      },
    });

    let remindersSent = 0;
    let overdueNoticesSent = 0;

    // Send reminder emails for upcoming deadlines
    for (const assignment of upcomingAssignments) {
      if (!assignment.student) continue;

      // Check if notification already sent today
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: assignment.student.id,
          type: 'deadline_reminder',
          createdAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
          },
        },
      });

      if (existingNotification) continue;

      // Send to student
      if (assignment.student.email) {
        try {
          await sendDeadlineReminderEmail(
            assignment.student.email,
            assignment.student.name,
            assignment.title,
            assignment.deadline
          );
          remindersSent++;
        } catch (error) {
          console.error('Failed to send reminder email:', error);
        }
      }

      // Create notification record
      await prisma.notification.create({
        data: {
          userId: assignment.student.id,
          type: 'deadline_reminder',
          title: 'Deadline sắp đến',
          message: `Bạn có deadline vào ${assignment.deadline.toLocaleString('vi-VN')}`,
          channel: 'email',
          isSent: true,
          sentAt: new Date(),
        },
      });
    }

    // Send overdue notices to parents
    for (const assignment of overdueAssignments) {
      if (!assignment.student) continue;

      // Check if student has submitted
      const hasSubmission = assignment.submissions.length > 0;
      if (hasSubmission) continue;

      // Check if notification already sent today
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: assignment.student.id,
          type: 'deadline_passed',
          createdAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
          },
        },
      });

      if (existingNotification) continue;

      // Send to parent
      if (assignment.student.parentEmail) {
        try {
          await sendOverdueEmailToParent(
            assignment.student.parentEmail,
            assignment.student.name,
            assignment.title,
            assignment.deadline
          );
          overdueNoticesSent++;
        } catch (error) {
          console.error('Failed to send overdue email:', error);
        }
      }

      // Create notification record
      await prisma.notification.create({
        data: {
          userId: assignment.student.id,
          type: 'deadline_passed',
          title: 'Đã trễ deadline',
          message: `Con bạn đã trễ deadline cho bài tập: ${assignment.title}`,
          channel: 'email',
          isSent: true,
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      remindersSent,
      overdueNoticesSent,
      processed: upcomingAssignments.length + overdueAssignments.length,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

