#!/usr/bin/env tsx
/**
 * Supabase Connection Check Script
 * 
 * This script checks the Supabase connection and displays connection status.
 * Usage: npm run supabase:check
 */

import { createClient } from '@supabase/supabase-js';

// Support multiple Supabase URL formats
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL;

// Support multiple Supabase Anon Key formats
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY;

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSupabaseConnection() {
  console.log('🔍 Checking Supabase connection...\n');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!\n');
    console.error('Required variables (one of each):');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
    console.error('\nPlease check your .env file.\n');
    process.exit(1);
  }

  try {
    // Test 1: Create client
    console.log('📡 Test 1: Create Supabase Client');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log(`✅ Client created successfully!`);
    console.log(`   URL: ${supabaseUrl}\n`);

    // Test 2: Health check
    console.log('🏥 Test 2: Health Check');
    const { data: healthData, error: healthError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (healthError && healthError.code !== 'PGRST116') {
      // PGRST116 means table doesn't exist, which is OK for initial setup
      throw healthError;
    }
    console.log('✅ Supabase connection successful!\n');

    // Test 3: Service role client (if available)
    if (supabaseServiceKey) {
      console.log('🔐 Test 3: Service Role Client');
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('users')
        .select('count')
        .limit(1);
      
      if (adminError && adminError.code !== 'PGRST116') {
        throw adminError;
      }
      console.log('✅ Service role client working!\n');
    } else {
      console.log('⚠️  Test 3: Service Role Client');
      console.log('   Skipped (SUPABASE_SERVICE_ROLE_KEY not set)\n');
    }

    // Test 4: Storage check (if bucket exists)
    console.log('📦 Test 4: Storage Check');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log(`⚠️  Storage check failed: ${bucketsError.message}`);
    } else {
      const submissionBucket = buckets?.find(b => b.name === 'submissions');
      if (submissionBucket) {
        console.log(`✅ Storage bucket 'submissions' exists`);
      } else {
        console.log(`⚠️  Storage bucket 'submissions' not found`);
        console.log(`   Available buckets: ${buckets?.map(b => b.name).join(', ') || 'none'}`);
        console.log(`   Please create the 'submissions' bucket in Supabase Dashboard`);
      }
    }
    console.log('');

    // Test 5: Realtime check
    console.log('⚡ Test 5: Realtime Check');
    const channel = supabase.channel('test-channel');
    const subscribeResult = await channel.subscribe();
    
    if (subscribeResult === 'SUBSCRIBED') {
      console.log('✅ Realtime connection successful!');
      await channel.unsubscribe();
    } else {
      console.log('⚠️  Realtime subscription status:', subscribeResult);
    }
    console.log('');

    console.log('🎉 All Supabase checks passed!');
    console.log('✅ Supabase is ready to use.\n');

    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed!\n');
    console.error('Error details:');
    
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      console.error(`  Name: ${error.name}`);
      
      // Check for common Supabase errors
      if (error.message.includes('Invalid API key')) {
        console.error('\n💡 Tip: Invalid API key.');
        console.error('   - Check NEXT_PUBLIC_SUPABASE_ANON_KEY in .env file');
        console.error('   - Verify the key in Supabase Dashboard > Settings > API');
      } else if (error.message.includes('Invalid URL')) {
        console.error('\n💡 Tip: Invalid Supabase URL.');
        console.error('   - Check NEXT_PUBLIC_SUPABASE_URL in .env file');
        console.error('   - URL should be: https://your-project.supabase.co');
      } else if (error.message.includes('Network')) {
        console.error('\n💡 Tip: Network error.');
        console.error('   - Check your internet connection');
        console.error('   - Verify Supabase project is active');
      }
    } else {
      console.error('  Unknown error:', error);
    }
    
    console.error('\n');
    return false;
  }
}

// Run the check
checkSupabaseConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

