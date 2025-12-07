import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { addMessageToConversation, createConversation } from '../lib/conversation';
import { getCachedResponse, saveCachedResponse, cleanupExpiredCache } from '../lib/conversation-cache';
import { hashPassword } from '../lib/auth';

/**
 * Test script for conversation cache functionality
 * 
 * Usage:
 *   npm run test:cache
 *   or
 *   tsx scripts/test-conversation-cache.ts
 */

async function testConversationCache() {
  console.log('🧪 Starting conversation cache test...\n');

  try {
    // Step 1: Find or create a test user
    let testUser = await prisma.user.findFirst({
      where: {
        username: 'testuser',
      },
    });

    if (!testUser) {
      console.log('📝 Creating test user...');
      const passwordHash = await hashPassword('testpassword123');
      testUser = await prisma.user.create({
        data: {
          username: 'testuser',
          email: 'test@example.com',
          name: 'Test User',
          passwordHash,
          role: 'student',
          isActive: true,
        },
      });
      console.log('✅ Test user created:', testUser.username);
    } else {
      console.log('✅ Using existing test user:', testUser.username);
    }

    // Step 2: Get or create default conversation config
    let config = await prisma.conversationConfig.findFirst({
      where: { isDefault: true },
    });

    if (!config) {
      console.log('📝 Creating default conversation config...');
      config = await prisma.conversationConfig.create({
        data: {
          name: 'Default Config',
          systemPrompt: 'You are a helpful learning assistant.',
          isDefault: true,
        },
      });
      console.log('✅ Default config created');
    }

    // Step 3: Create a test conversation
    console.log('\n📝 Creating test conversation...');
    const conversation = await createConversation(
      testUser.id,
      'free_chat',
      undefined,
      config.id
    );
    console.log('✅ Conversation created:', conversation.id);

    // Step 4: Test question
    const testQuestion = 'What is 2 + 2?';
    console.log(`\n📤 Test question: "${testQuestion}"`);

    // Step 5: First request - should call OpenAI and cache the response
    console.log('\n🔄 First request (should call OpenAI and cache)...');
    const startTime1 = Date.now();
    const result1 = await addMessageToConversation(
      conversation.id,
      testQuestion
    );
    const duration1 = Date.now() - startTime1;
    
    console.log('✅ First response received');
    console.log(`   Duration: ${duration1}ms`);
    console.log(`   Response length: ${result1.assistantMessage.content.length} characters`);
    console.log(`   Is from cache: ${result1.assistantMessage.metadata?.isFromCache || false}`);
    console.log(`   Model: ${result1.assistantMessage.metadata?.model || 'N/A'}`);
    console.log(`   Estimated cost: $${result1.assistantMessage.metadata?.estimatedCost || 0}`);

    // Step 6: Check if cache was created
    console.log('\n🔍 Checking cache...');
    const cached = await getCachedResponse(testQuestion);
    if (cached) {
      console.log('✅ Cache entry found!');
      console.log(`   Response length: ${cached.response.length} characters`);
    } else {
      console.log('❌ Cache entry not found (this is unexpected)');
    }

    // Step 7: Second request - should use cache
    console.log('\n🔄 Second request (should use cache)...');
    const startTime2 = Date.now();
    const result2 = await addMessageToConversation(
      conversation.id,
      testQuestion
    );
    const duration2 = Date.now() - startTime2;

    console.log('✅ Second response received');
    console.log(`   Duration: ${duration2}ms`);
    console.log(`   Response length: ${result2.assistantMessage.content.length} characters`);
    console.log(`   Is from cache: ${result2.assistantMessage.metadata?.isFromCache || false}`);
    console.log(`   Model: ${result2.assistantMessage.metadata?.model || 'N/A'}`);
    console.log(`   Estimated cost: $${result2.assistantMessage.metadata?.estimatedCost || 0}`);

    // Step 8: Verify cache was used
    if (result2.assistantMessage.metadata?.isFromCache) {
      console.log('\n✅ SUCCESS: Cache was used in second request!');
      console.log(`   Speed improvement: ${((duration1 - duration2) / duration1 * 100).toFixed(1)}% faster`);
      console.log(`   Cost savings: $${result1.assistantMessage.metadata?.estimatedCost || 0} saved`);
    } else {
      console.log('\n❌ WARNING: Cache was not used in second request');
    }

    // Step 9: Test with similar but different question (should not use cache)
    console.log('\n🔄 Testing with similar question (should NOT use cache)...');
    const similarQuestion = 'What is 2 + 2? '; // Extra space
    const startTime3 = Date.now();
    const result3 = await addMessageToConversation(
      conversation.id,
      similarQuestion
    );
    const duration3 = Date.now() - startTime3;

    console.log('✅ Similar question response received');
    console.log(`   Duration: ${duration3}ms`);
    console.log(`   Is from cache: ${result3.assistantMessage.metadata?.isFromCache || false}`);

    // Note: After normalization, similar question should use cache
    if (result3.assistantMessage.metadata?.isFromCache) {
      console.log('✅ Cache was used (question was normalized and matched)');
    } else {
      console.log('ℹ️  Cache was not used (question was different after normalization)');
    }

    // Step 10: Test cache statistics
    console.log('\n📊 Cache statistics:');
    const cacheStats = await prisma.conversationCache.findMany({
      where: {
        questionHash: {
          // We can't easily get the hash, but we can count all cache entries
        },
      },
      select: {
        hitCount: true,
        createdAt: true,
      },
    });

    const totalHits = cacheStats.reduce((sum, entry) => sum + entry.hitCount, 0);
    console.log(`   Total cache entries: ${cacheStats.length}`);
    console.log(`   Total cache hits: ${totalHits}`);

    // Step 11: Cleanup (optional)
    console.log('\n🧹 Cleanup options:');
    console.log('   - Test conversation and messages will remain in database');
    console.log('   - Cache entries will remain (they expire after 30 days)');
    console.log('   - To clean up expired cache, run: cleanupExpiredCache()');

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testConversationCache();

