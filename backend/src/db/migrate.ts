/**
 * Database Migration Runner
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('[Migrate] Starting database migrations...');
  
  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get applied migrations
    const { rows: applied } = await pool.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id'
    );
    const appliedNames = new Set(applied.map(r => r.name));
    
    // Read migration files
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // Apply pending migrations
    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`[Migrate] Skipping ${file} (already applied)`);
        continue;
      }
      
      console.log(`[Migrate] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      await pool.query(sql);
      await pool.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [file]
      );
      
      console.log(`[Migrate] Applied ${file}`);
    }
    
    console.log('[Migrate] All migrations complete!');
  } catch (error) {
    console.error('[Migrate] Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
