require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const { validateEmail, validatePassword } = require('./validation');

const router = express.Router();
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('[Auth] Initializing database at:', dbPath);
const db = new Database(dbPath);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Initialize users table with correct schema
try {
  // Check if table exists and get schema
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  console.log('[Auth] Current users table schema:', tableInfo);
  
  if (tableInfo.length === 0) {
    // Table doesn't exist, create it
    console.log('[Auth] Creating users table...');
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created with password_hash column');
  } else {
    // Table exists, check if it has the password_hash column
    const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');
    const hasPassword = tableInfo.some(col => col.name === 'password');
    
    if (!hasPasswordHash && !hasPassword) {
      console.warn('[Auth] Table exists but has no password column, adding password_hash...');
      db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`);
      console.log('✅ Added password_hash column to users table');
    } else if (hasPassword && !hasPasswordHash) {
      console.log('[Auth] Found password column (legacy), using it');
    } else {
      console.log('[Auth] Users table schema is correct');
    }
  }
} catch (err) {
  console.error('[Auth] Table initialization error:', err);
  // Continue anyway - query will fail if schema is wrong
}

// Determine which password column to use
function getPasswordColumn() {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    if (tableInfo.some(col => col.name === 'password_hash')) {
      return 'password_hash';
    } else if (tableInfo.some(col => col.name === 'password')) {
      return 'password';
    }
  } catch (err) {
    console.warn('[Auth] Could not determine password column:', err);
  }
  return 'password_hash'; // Default to password_hash
}

const PASSWORD_COLUMN = getPasswordColumn();
console.log('[Auth] Using password column:', PASSWORD_COLUMN);

// Register endpoint - ALWAYS returns JSON
router.post('/register', async (req, res) => {
  console.log('[Register] POST /register called');
  console.log('[Register] Request body:', req.body);
  
  try {
    const { email, password } = req.body;

    console.log('[Register] Email:', email, 'Password length:', password?.length);

    // Check if email and password are provided
    if (!email || !password) {
      console.log('[Register] Missing email or password');
      return res.status(400).json({ 
        error: 'Email and password are required',
        field: email ? 'password' : 'email'
      });
    }

    // Validate email
    console.log('[Register] Validating email...');
    const emailValidation = validateEmail(email);
    console.log('[Register] Email validation result:', emailValidation);
    if (!emailValidation.valid) {
      return res.status(400).json({ 
        error: emailValidation.error,
        field: 'email'
      });
    }

    // Validate password
    console.log('[Register] Validating password...');
    const passwordValidation = validatePassword(password);
    console.log('[Register] Password validation result:', passwordValidation);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error,
        field: 'password'
      });
    }

    // Check if user exists
    const normalizedEmail = email.toLowerCase().trim();
    console.log('[Register] Checking if user exists:', normalizedEmail);
    
    try {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
      console.log('[Register] Existing user check result:', existingUser ? 'EXISTS' : 'NOT FOUND');
      
      if (existingUser) {
        console.log('[Register] User already exists');
        return res.status(400).json({ 
          error: 'This email is already registered',
          field: 'email'
        });
      }
    } catch (dbErr) {
      console.error('[Register] Database check error:', dbErr);
      throw dbErr;
    }

    // Hash password
    console.log('[Register] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[Register] Password hashed successfully');

    // Insert user
    console.log('[Register] Inserting user...')
    try {
      const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
        normalizedEmail,
        hashedPassword
      )
      console.log('[Register] User inserted, lastInsertRowid:', result.lastInsertRowid)

      // Generate token
      console.log('[Register] Generating token...')
      const token = jwt.sign(
        { userId: result.lastInsertRowid, email: normalizedEmail },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      )
      console.log('[Register] Token generated successfully')

      console.log(`✓ User registered: ${normalizedEmail} (ID: ${result.lastInsertRowid})`)
      res.status(201).json({ token, email: normalizedEmail })
    } catch (insertErr) {
      console.error('[Register] Insert error:', insertErr)
      console.error('[Register] Insert error details:', {
        message: insertErr.message,
        code: insertErr.code,
        sql: insertErr.sql
      })
      throw insertErr
    }
  } catch (err) {
    console.error('❌ [Register] Caught error:', err)
    console.error('❌ [Register] Error message:', err.message)
    console.error('❌ [Register] Error code:', err.code)
    console.error('❌ [Register] Full stack:', err.stack)
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
});

// Login endpoint - ALWAYS returns JSON
router.post('/login', async (req, res) => {
  console.log('[Login] POST /login called')
  console.log('[Login] Request body:', { email: req.body.email, password: req.body.password ? '***' : 'missing' })
  
  try {
    const { email, password } = req.body

    console.log('[Login] Email:', email, 'Password length:', password?.length)

    // Check if email and password are provided
    if (!email || !password) {
      console.log('[Login] Missing email or password')
      return res.status(400).json({ 
        error: 'Email and password are required',
        field: email ? 'password' : 'email'
      })
    }

    // Validate email format
    console.log('[Login] Validating email...')
    const emailValidation = validateEmail(email)
    console.log('[Login] Email validation result:', emailValidation)
    if (!emailValidation.valid) {
      return res.status(400).json({ 
        error: emailValidation.error,
        field: 'email'
      })
    }

    // Validate password exists
    console.log('[Login] Validating password...')
    const passwordValidation = validatePassword(password)
    console.log('[Login] Password validation result:', passwordValidation)
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error,
        field: 'password'
      })
    }

    // Find user
    const normalizedEmail = email.toLowerCase().trim()
    console.log('[Login] Looking up user:', normalizedEmail)
    
    try {
      const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(normalizedEmail)
      console.log('[Login] User lookup result:', user ? `Found (ID: ${user.id})` : 'NOT FOUND')
      
      if (!user) {
        console.log('[Login] User not found')
        return res.status(401).json({ 
          error: 'Invalid email or password',
          field: 'email'
        })
      }

      // Verify password
      console.log('[Login] Verifying password...')
      const validPassword = await bcrypt.compare(password, user.password_hash)
      console.log('[Login] Password verification result:', validPassword ? 'VALID' : 'INVALID')
      
      if (!validPassword) {
        console.log('[Login] Password mismatch')
        return res.status(401).json({ 
          error: 'Invalid email or password',
          field: 'password'
        })
      }

      // Generate token
      console.log('[Login] Generating token...')
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      )
      console.log('[Login] Token generated successfully')

      console.log(`✓ User logged in: ${user.email} (ID: ${user.id})`)
      res.json({ token, email: user.email })
    } catch (dbErr) {
      console.error('[Login] Database error:', dbErr)
      console.error('[Login] Database error details:', {
        message: dbErr.message,
        code: dbErr.code,
        sql: dbErr.sql
      })
      throw dbErr
    }
  } catch (err) {
    console.error('❌ [Login] Caught error:', err)
    console.error('❌ [Login] Error message:', err.message)
    console.error('❌ [Login] Error code:', err.code)
    console.error('❌ [Login] Full stack:', err.stack)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
});

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { 
      userId: decoded.userId, 
      email: decoded.email 
    };
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
