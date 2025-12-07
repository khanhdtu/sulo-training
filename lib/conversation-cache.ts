import { prisma } from './prisma';
import crypto from 'crypto';

/**
 * Normalize question text for consistent hashing
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Trim
 */
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Generate hash for a question
 */
function hashQuestion(question: string): string {
  const normalized = normalizeQuestion(question);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check if a cached response exists for a question
 * Returns cached response if found, null otherwise
 */
export async function getCachedResponse(
  question: string
): Promise<{ response: string; metadata: any } | null> {
  try {
    const questionHash = hashQuestion(question);

    const cache = await prisma.conversationCache.findUnique({
      where: { questionHash },
    });

    // Check if cache exists and is not expired
    if (!cache) {
      return null;
    }

    // Check expiration
    if (cache.expiresAt && cache.expiresAt < new Date()) {
      // Cache expired, delete it
      await prisma.conversationCache.delete({
        where: { questionHash },
      });
      return null;
    }

    // Update hit count
    await prisma.conversationCache.update({
      where: { questionHash },
      data: {
        hitCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return {
      response: cache.response,
      metadata: cache.metadata || {},
    };
  } catch (error) {
    console.error('Error getting cached response:', error);
    // On error, return null to allow fallback to OpenAI
    return null;
  }
}

/**
 * Save a response to cache
 */
export async function saveCachedResponse(
  question: string,
  response: string,
  metadata?: {
    model?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    finishReason?: string;
    estimatedCost?: number;
  }
): Promise<void> {
  try {
    const questionHash = hashQuestion(question);
    const normalizedQuestion = normalizeQuestion(question);

    // Set expiration to 30 days from now (optional, can be configured)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.conversationCache.upsert({
      where: { questionHash },
      create: {
        questionHash,
        question: normalizedQuestion,
        response,
        metadata: metadata || null,
        expiresAt,
        hitCount: 0,
      },
      update: {
        response,
        metadata: metadata || null,
        updatedAt: new Date(),
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Error saving cached response:', error);
    // Don't throw error, caching is optional
  }
}

/**
 * Clean up expired cache entries
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await prisma.conversationCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired cache:', error);
    return 0;
  }
}

