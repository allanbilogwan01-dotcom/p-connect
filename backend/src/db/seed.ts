/**
 * Database Seeder
 * Creates default admin user and settings
 */

import bcrypt from 'bcryptjs';
import { pool, query } from './pool.js';
import { config } from 'dotenv';

config();

async function seed() {
  console.log('[Seed] Starting database seeding...');
  
  try {
    // Check if admin exists
    const { rows: existing } = await query(
      "SELECT id FROM users WHERE username = 'admin'"
    );
    
    if (existing.length === 0) {
      // Create default admin
      const passwordHash = await bcrypt.hash('admin123', 12);
      await query(
        `INSERT INTO users (username, password_hash, role, full_name, status)
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin', passwordHash, 'super_admin', 'System Administrator', 'active']
      );
      console.log('[Seed] Created default admin user (admin/admin123)');
    } else {
      console.log('[Seed] Admin user already exists');
    }
    
    // Create default settings
    const defaultSettings = [
      ['facility_name', 'WATCHGUARD FACILITY'],
      ['jail_name', ''],
      ['jail_region', ''],
      ['jail_address', ''],
      ['jail_email', ''],
      ['jail_contact', ''],
      ['immediate_family_limit', '-1'],
      ['legal_guardian_limit', '2'],
      ['close_friend_limit', '3'],
      ['face_recognition_threshold', '0.75'],
      ['face_recognition_margin', '0.15'],
      ['allow_guest_enrollment', 'false'],
      ['data_retention_days', '365'],
      ['conjugal_relationships', '["wife","husband","spouse","live_in_partner","common_law_partner"]'],
    ];
    
    for (const [key, value] of defaultSettings) {
      await query(
        `INSERT INTO app_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
    console.log('[Seed] Default settings initialized');
    
    console.log('[Seed] Seeding complete!');
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
