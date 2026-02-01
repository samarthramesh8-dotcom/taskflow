require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Connecting to database...');
    
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', '001_auth.sql'), 'utf8');
    
    console.log('Running migration...');
    await pool.query(sql);
    
    console.log('✓ Migration completed successfully!');
    console.log('✓ Users table created');
    console.log('✓ user_id column added to tasks table');
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
