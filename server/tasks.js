const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { validateTaskPayload } = require('./validation');

const router = express.Router();
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize tasks table
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

// Add index for user_id queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)
`);

console.log('✅ Tasks table ready');

// Get all tasks for authenticated user ONLY
router.get('/', (req, res) => {
  try {
    const tasks = db.prepare(`
      SELECT * FROM tasks 
      WHERE user_id = ? 
      ORDER BY 
        done ASC,
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at DESC
    `).all(req.user.userId);
    
    res.json(tasks.map(t => ({ ...t, done: Boolean(t.done) })));
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task statistics for authenticated user ONLY
router.get('/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN priority = 'high' AND done = 0 THEN 1 ELSE 0 END) as high_priority
      FROM tasks WHERE user_id = ?
    `).get(req.user.userId);

    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Create task - userId set SERVER-SIDE from auth context + strict validation
router.post('/', (req, res) => {
  const { text, description, priority, category, due_date } = req.body;
  
  // Strict validation
  const validation = validateTaskPayload(req.body, false);
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validation.errors 
    });
  }

  try {
    // SECURITY: userId comes from authenticated session, NOT from client
    const result = db.prepare(`
      INSERT INTO tasks (user_id, text, description, priority, category, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId,
      text.trim(),
      description?.trim() || null,
      priority || 'medium',
      category || 'general',
      due_date || null
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    console.log(`✓ Task created: "${text.trim()}" (ID: ${result.lastInsertRowid}, User: ${req.user.userId})`);
    res.status(201).json({ ...task, done: Boolean(task.done) });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task - VERIFY OWNERSHIP + strict validation
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { text, description, done, priority, category, due_date } = req.body;

  // Strict validation
  const validation = validateTaskPayload(req.body, true);
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validation.errors 
    });
  }

  try {
    // SECURITY: Verify task exists AND is owned by authenticated user
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update only if ownership verified
    db.prepare(`
      UPDATE tasks 
      SET text = ?, description = ?, done = ?, priority = ?, category = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      text !== undefined ? text.trim() : task.text,
      description !== undefined ? (description?.trim() || null) : task.description,
      done !== undefined ? (done ? 1 : 0) : task.done,
      priority !== undefined ? priority : task.priority,
      category !== undefined ? category : task.category,
      due_date !== undefined ? due_date : task.due_date,
      id,
      req.user.userId
    );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    console.log(`✓ Task updated: ID ${id} (User: ${req.user.userId})`);
    res.json({ ...updated, done: Boolean(updated.done) });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task - VERIFY OWNERSHIP
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  try {
    // SECURITY: Verify task exists AND is owned by authenticated user
    const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, req.user.userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`✓ Task deleted: ID ${id} (User: ${req.user.userId})`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Seed sample tasks - DISABLED IN PRODUCTION
router.post('/seed', (req, res) => {
  // PRODUCTION SAFETY: Disable seed endpoint in production
  if (NODE_ENV === 'production') {
    return res.status(403).json({ 
      error: 'Seed endpoint is disabled in production' 
    });
  }

  try {
    const existingTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(req.user.userId);
    
    if (existingTasks.count > 0) {
      return res.status(400).json({ error: 'User already has tasks' });
    }

    const sampleTasks = [
      { text: 'Review Q4 budget report', description: 'Check all department expenses and prepare summary', priority: 'high', category: 'work', due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Schedule team standup meetings', description: null, priority: 'medium', category: 'work', due_date: null },
      { text: 'Buy groceries for the week', description: 'Milk, eggs, bread, vegetables, chicken', priority: 'medium', category: 'shopping', due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Complete project documentation', description: 'Write API docs and user guide', priority: 'high', category: 'work', due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Book dentist appointment', description: null, priority: 'medium', category: 'health', due_date: null },
      { text: 'Renew gym membership', description: 'Check for annual discount offers', priority: 'low', category: 'health', due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Call mom', description: null, priority: 'medium', category: 'personal', due_date: null },
      { text: 'Fix leaking kitchen faucet', description: 'Buy replacement washer from hardware store', priority: 'high', category: 'personal', due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Prepare presentation slides', description: 'Product roadmap for Q1 stakeholder meeting', priority: 'high', category: 'work', due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Order birthday gift', description: 'Check wishlist and order from Amazon', priority: 'medium', category: 'shopping', due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Research vacation destinations', description: 'Compare prices for summer 2024 trips', priority: 'low', category: 'personal', due_date: null },
      { text: 'Update resume', description: null, priority: 'low', category: 'work', due_date: null },
      { text: 'Organize home office', description: 'File documents and clean desk area', priority: 'low', category: 'personal', due_date: null },
      { text: 'Review pull requests', description: 'Check team PRs and provide feedback', priority: 'high', category: 'work', due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Pay utility bills', description: 'Electricity, water, and internet', priority: 'high', category: 'general', due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    ];

    const insert = db.prepare(`
      INSERT INTO tasks (user_id, text, description, priority, category, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((tasks) => {
      for (const task of tasks) {
        insert.run(req.user.userId, task.text, task.description, task.priority, task.category, task.due_date);
      }
    });

    insertMany(sampleTasks);

    console.log(`✓ Seeded ${sampleTasks.length} sample tasks for user ${req.user.email} (ID: ${req.user.userId})`);
    res.json({ success: true, count: sampleTasks.length });
  } catch (err) {
    console.error('Seed tasks error:', err);
    res.status(500).json({ error: 'Failed to seed tasks' });
  }
});

module.exports = router;
