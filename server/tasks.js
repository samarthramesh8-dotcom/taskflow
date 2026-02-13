const express = require('express');
const { query } = require('./db');
const { validateTaskPayload } = require('./validation');

const router = express.Router();
const NODE_ENV = process.env.NODE_ENV || 'development';

// Get all tasks for authenticated user ONLY
router.get('/', async (req, res) => {
  try {
    console.log('[Tasks GET /] User:', req.user.userId);
    
    const result = await query(
      `SELECT id, user_id, text, description, done, priority, category, due_date, due_at, created_at, updated_at
       FROM tasks 
       WHERE user_id = $1 
       ORDER BY 
         due_at ASC NULLS LAST,
         created_at DESC`,
      [req.user.userId]
    );
    
    console.log('[Tasks GET /] Found', result.rows.length, 'tasks');
    res.json(result.rows);
  } catch (err) {
    console.error('[Tasks GET /] ERROR:', err.message);
    console.error('[Tasks GET /] Stack:', err.stack);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task statistics for authenticated user ONLY
router.get('/stats', async (req, res) => {
  try {
    console.log('[Tasks STATS] User ID:', req.user.userId);
    
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN done = true THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN done = false THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN priority = 'high' AND done = false THEN 1 ELSE 0 END) as high_priority
       FROM tasks WHERE user_id = $1`,
      [req.user.userId]
    );

    const stats = result.rows[0];
    res.json({
      total: parseInt(stats.total) || 0,
      completed: parseInt(stats.completed) || 0,
      pending: parseInt(stats.pending) || 0,
      high_priority: parseInt(stats.high_priority) || 0
    });
  } catch (err) {
    console.error('[Tasks STATS] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Create task - userId set SERVER-SIDE from auth context
router.post('/', async (req, res) => {
  const { text, description, priority, category, due_date, due_at } = req.body;
  
  console.log('[Tasks POST] Request received:', { text, description, priority, category, due_date, due_at });
  console.log('[Tasks POST] User:', { userId: req.user.userId, email: req.user.email });
  
  // Strict validation
  const validation = validateTaskPayload(req.body, false);
  if (!validation.valid) {
    console.log('[Tasks POST] Validation failed:', validation.errors);
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validation.errors 
    });
  }

  try {
    const insertQuery = `INSERT INTO tasks (user_id, text, description, priority, category, done, due_date, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, text, description, done, priority, category, due_date, due_at, created_at, updated_at`;
    
    const insertValues = [
      req.user.userId,
      text.trim(),
      description?.trim() || null,
      priority || 'medium',
      category || 'general',
      false,
      due_date || null,
      due_at || null
    ];
    
    console.log('[Tasks POST] Executing query:', insertQuery);
    console.log('[Tasks POST] With values:', insertValues);
    
    const result = await query(insertQuery, insertValues);
    
    console.log('[Tasks POST] Insert successful, rows:', result.rows.length);
    const task = result.rows[0];
    console.log(`✓ hereted: ID ${task.id}`);
    res.status(201).json(task);
  } catch (err) {
    console.error('[Tasks POST] ERROR caught');
    console.error('[Tasks POST] Error message:', err.message);
    console.error('[Tasks POST] Error code:', err.code);
    console.error('[Tasks POST] Error detail:', err.detail);
    console.error('[Tasks POST] Error hint:', err.hint);
    console.error('[Tasks POST] Full error:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task - VERIFY OWNERSHIP before allowing update
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { text, description, done, priority, category, due_date, due_at } = req.body;

  console.log('[Tasks PUT] Updating task:', { id, userId: req.user.userId });

  // Strict validation
  const validation = validateTaskPayload(req.body, true);
  if (!validation.valid) {
    console.log('[Tasks PUT] Validation failed:', validation.errors);
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validation.errors 
    });
  }

  try {
    // SECURITY: Verify task exists AND is owned by authenticated user
    const taskResult = await query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (taskResult.rows.length === 0) {
      console.log('[Tasks PUT] Task not found:', { id, userId: req.user.userId });
      return res.status(404).json({ error: 'Task not found' });
    }

    const currentTask = taskResult.rows[0];

    // Update only if ownership verified
    const updateResult = await query(
      `UPDATE tasks 
       SET text = COALESCE($1, text),
           description = COALESCE($2, description),
           done = COALESCE($3, done),
           priority = COALESCE($4, priority),
           category = COALESCE($5, category),
           due_date = COALESCE($6, due_date),
           due_at = COALESCE($7, due_at),
           updated_at = now()
       WHERE id = $8 AND user_id = $9
       RETURNING id, user_id, text, description, done, priority, category, due_date, due_at, created_at, updated_at`,
      [
        text !== undefined ? text.trim() : null,
        description !== undefined ? (description?.trim() || null) : null,
        done !== undefined ? done : null,
        priority !== undefined ? priority : null,
        category !== undefined ? category : null,
        due_date !== undefined ? due_date : null,
        due_at !== undefined ? due_at : null,
        id,
        req.user.userId
      ]
    );

    const updated = updateResult.rows[0];
    console.log(`✓ Task updated: ID ${id} (User: ${req.user.userId})`);
    res.json(updated);
  } catch (err) {
    console.error('[Tasks PUT] Error:', err.message);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task - VERIFY OWNERSHIP before allowing delete
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  console.log('[Tasks DELETE] Deleting task:', { id, userId: req.user.userId });

  try {
    // SECURITY: Verify task exists AND is owned by authenticated user
    const taskResult = await query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (taskResult.rows.length === 0) {
      console.log('[Tasks DELETE] Task not found:', { id, userId: req.user.userId });
      return res.status(404).json({ error: 'Task not found' });
    }

    // Delete only if ownership verified
    await query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );

    console.log(`✓ Task deleted: ID ${id} (User: ${req.user.userId})`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Tasks DELETE] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Seed sample tasks - DEV/DEMO ONLY
router.post('/seed', async (req, res) => {
  // PRODUCTION SAFETY: Disable seed endpoint in production
  if (NODE_ENV === 'production') {
    return res.status(403).json({ 
      error: 'Seed endpoint is disabled in production' 
    });
  }

  try {
    const existingResult = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (parseInt(existingResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'User already has tasks' });
    }

    const sampleTasks = [
      { text: 'Review Q4 budget report', description: 'Check all department expenses and prepare summary', priority: 'high', category: 'work', due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Schedule team standup meetings', description: null, priority: 'medium', category: 'work', due_date: null },
      { text: 'Buy groceries for the week', description: 'Milk, eggs, bread, vegetables, chicken', priority: 'medium', category: 'shopping', due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Complete project documentation', description: 'Write API docs and user guide', priority: 'high', category: 'work', due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { text: 'Book dentist appointment', description: null, priority: 'medium', category: 'health', due_date: null },
    ];

    for (const task of sampleTasks) {
      await query(
        `INSERT INTO tasks (user_id, text, description, priority, category, done, due_date, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.user.userId,
          task.text,
          task.description,
          task.priority,
          task.category,
          task.due_date,
          null
        ]
      );
    }

    console.log(`✓ Seeded ${sampleTasks.length} sample tasks for user ${req.user.email} (ID: ${req.user.userId})`);
    res.json({ success: true, count: sampleTasks.length });
  } catch (err) {
    console.error('[Tasks SEED] Error:', err.message);
    res.status(500).json({ error: 'Failed to seed tasks' });
  }
});

module.exports = router;
