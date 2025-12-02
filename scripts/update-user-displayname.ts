#!/usr/bin/env tsx
/**
 * Update User Display Name Script
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

loadEnvFile();

let databaseUrl = 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.POSTGRES_URL_NON_POOLING || 
  process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

if (databaseUrl.includes('supabase.com') && !databaseUrl.includes('sslmode')) {
  databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

const url = new URL(databaseUrl.replace(/^postgres:\/\//, 'https://'));
const poolConfig: any = {
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1) || 'postgres',
  user: url.username,
  password: url.password,
};

if (databaseUrl.includes('supabase.com')) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
    require: true,
  };
}

const pool = new Pool(poolConfig);

async function updateDisplayName() {
  const client = await pool.connect();
  
  try {
    // Update display_name for user nhahan
    const result = await client.query(
      `UPDATE users 
       SET display_name = 'Trần Nhã Hân' 
       WHERE username = 'nhahan' 
       RETURNING id, username, name, display_name`
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Display name updated!');
      console.log(`  Username: ${user.username}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Display Name: ${user.display_name}`);
    } else {
      console.log('❌ User not found!');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

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

updateDisplayName();

