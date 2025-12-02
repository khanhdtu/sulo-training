#!/usr/bin/env tsx
/**
 * Test Login Script
 * 
 * This script tests the login functionality with a user.
 * Usage: npx tsx scripts/test-login.ts <username> <password>
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env file manually
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z_]+)=(.+)$/);
        if (match) {
          const key = match[1];
          let value = match[2];
          value = value.replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

loadEnvFile();

async function testLogin(username: string, password: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${baseUrl}/api/auth/login`;

  console.log('🔐 Testing login...\n');
  console.log(`Username: ${username}`);
  console.log(`Password: ${'*'.repeat(password.length)}`);
  console.log(`URL: ${loginUrl}\n`);

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Login successful!\n');
      console.log('Response:');
      console.log(`  Token: ${data.token ? data.token.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`  User ID: ${data.user?.id || 'N/A'}`);
      console.log(`  Username: ${data.user?.username || 'N/A'}`);
      console.log(`  Name: ${data.user?.name || 'N/A'}`);
      console.log(`  Display Name: ${data.user?.displayName || 'N/A'}`);
      console.log(`  Role: ${data.user?.role || 'N/A'}`);
      console.log(`  Email: ${data.user?.email || 'N/A'}`);
      return true;
    } else {
      console.log('❌ Login failed!\n');
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${data.message || data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error during login test:');
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      if (error.message.includes('fetch')) {
        console.error('\n💡 Tip: Make sure the Next.js dev server is running:');
        console.error('   npm run dev');
      }
    } else {
      console.error('  Error:', error);
    }
    return false;
  }
}

// Get arguments from command line
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npx tsx scripts/test-login.ts <username> <password>');
  console.error('\nExample:');
  console.error('  npx tsx scripts/test-login.ts nhahan nhahan@123');
  process.exit(1);
}

const [username, password] = args;

// Test login
testLogin(username, password)
  .then((success) => {
    if (success) {
      console.log('\n🎉 Login test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Login test failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });

