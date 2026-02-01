/**
 * Database initialization and migration script
 * Run this to initialize or repair the database schema
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
console.log('[DB Init] Database path:', dbPath);

const db = new Database(dbPath);

try {
  // Initialize users table
  console.log('[DB Init] Setting up users table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Users table ready');

  // Initialize tasks table
  console.log('[DB Init] Setting up tasks table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      description TEXT,
      done BOOLEAN DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      category TEXT DEFAULT 'general',
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Tasks table ready');

  // Create indexes
  console.log('[DB Init] Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
  console.log('✅ Indexes created');

  // Verify schema
  console.log('[DB Init] Verifying schema...');
  const usersCols = db.prepare("PRAGMA table_info(users)").all();
  const tasksCols = db.prepare("PRAGMA table_info(tasks)").all();
  
  console.log('[DB Init] Users table columns:', usersCols.map(c => c.name).join(', '));
  console.log('[DB Init] Tasks table columns:', tasksCols.map(c => c.name).join(', '));

  console.log('\n✅ Database initialization complete');
  process.exit(0);
} catch (err) {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
} finally {
  db.close();
}
