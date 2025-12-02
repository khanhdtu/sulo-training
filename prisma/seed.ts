import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default conversation configs
  const essayReviewConfig = await prisma.conversationConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Essay Review - Default',
      systemPrompt: `You are a helpful teacher assistant. Your role is to:
1. Review the student's essay submission carefully
2. Provide constructive feedback on their work
3. Explain concepts they might not understand
4. Answer questions until the student fully understands the topic
5. Be encouraging and supportive

Always respond in Vietnamese. Be patient and clear in your explanations.`,
      responseFormat: {
        type: 'text',
      },
      isDefault: true,
      metadata: {
        model: 'gpt-4o',
        maxTokens: 2000,
        temperature: 0.7,
      },
    },
  });

  const freeChatConfig = await prisma.conversationConfig.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'Free Chat - Default',
      systemPrompt: `You are a helpful AI assistant for students. You can help with:
- Answering questions about any subject
- Explaining concepts
- Providing study tips
- General conversation

Always respond in Vietnamese. Be friendly, helpful, and educational.`,
      responseFormat: {
        type: 'text',
      },
      isDefault: false,
      metadata: {
        model: 'gpt-4o',
        maxTokens: 2000,
        temperature: 0.8,
      },
    },
  });

  console.log('Created conversation configs:', {
    essayReview: essayReviewConfig.name,
    freeChat: freeChatConfig.name,
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

