require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./db');
const { validateEmail, validatePassword } = require('./validation');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Register endpoint with field-specific validation
router.post('/register', async (req, res) => {
  console.log('[Register] POST /register called');
  
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
      const existingUserResult = await query(
        'SELECT id FROM users WHERE email = $1',
        [normalizedEmail]
      );
      
      console.log('[Register] Existing user check result:', existingUserResult.rows.length > 0 ? 'EXISTS' : 'NOT FOUND');
      
      if (existingUserResult.rows.length > 0) {
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
    console.log('[Register] Inserting user...');
    try {
      const result = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [normalizedEmail, hashedPassword]
      );
      
      const userId = result.rows[0].id;
      console.log('[Register] User inserted with ID:', userId);

      // Generate token
      console.log('[Register] Generating token...');
      const token = jwt.sign(
        { userId, email: normalizedEmail },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      console.log('[Register] Token generated successfully');

      console.log(`✓ User registered: ${normalizedEmail} (ID: ${userId})`);
      res.status(201).json({ token, email: normalizedEmail });
    } catch (insertErr) {
      console.error('[Register] Insert error:', insertErr);
      console.error('[Register] Insert error details:', {
        message: insertErr.message,
        code: insertErr.code
      });
      throw insertErr;
    }
  } catch (err) {
    console.error('❌ [Register] Caught error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login endpoint with field-specific validation
router.post('/login', async (req, res) => {
  console.log('[Login] POST /login called');
  console.log('[Login] Request body:', { email: req.body.email, password: req.body.password ? '***' : 'missing' });
  
  try {
    const { email, password } = req.body;

    console.log('[Login] Email:', email, 'Password length:', password?.length);

    // Check if email and password are provided
    if (!email || !password) {
      console.log('[Login] Missing email or password');
      return res.status(400).json({ 
        error: 'Email and password are required',
        field: email ? 'password' : 'email'
      });
    }

    // Validate email format
    console.log('[Login] Validating email...');
    const emailValidation = validateEmail(email);
    console.log('[Login] Email validation result:', emailValidation);
    if (!emailValidation.valid) {
      return res.status(400).json({ 
        error: emailValidation.error,
        field: 'email'
      });
    }

    // Validate password exists
    console.log('[Login] Validating password...');
    const passwordValidation = validatePassword(password);
    console.log('[Login] Password validation result:', passwordValidation);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: passwordValidation.error,
        field: 'password'
      });
    }

    // Find user
    const normalizedEmail = email.toLowerCase().trim();
    console.log('[Login] Looking up user:', normalizedEmail);
    
    try {
      const userResult = await query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [normalizedEmail]
      );
      
      console.log('[Login] User lookup result:', userResult.rows.length > 0 ? `Found (ID: ${userResult.rows[0].id})` : 'NOT FOUND');
      console.log('[Login] Query returned rows:', userResult.rows.length);
      
      if (userResult.rows.length === 0) {
        console.log('[Login] User not found in database');
        return res.status(401).json({ 
          error: 'Invalid email or password',
          field: 'email'
        });
      }

      const user = userResult.rows[0];
      console.log('[Login] User found:', { id: user.id, email: user.email, hasPasswordHash: !!user.password_hash });

      // Verify password
      console.log('[Login] Verifying password...');
      const validPassword = await bcrypt.compare(password, user.password_hash);
      console.log('[Login] Password verification result:', validPassword ? 'VALID' : 'INVALID');
      
      if (!validPassword) {
        console.log('[Login] Password mismatch for user:', user.email);
        return res.status(401).json({ 
          error: 'Invalid email or password',
          field: 'password'
        });
      }

      // Generate token
      console.log('[Login] Generating token...');
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      console.log('[Login] Token generated successfully');

      console.log(`✓ User logged in: ${user.email} (ID: ${user.id})`);
      res.json({ token, email: user.email });
    } catch (dbErr) {
      console.error('[Login] Database error:', dbErr.message);
      console.error('[Login] Database error code:', dbErr.code);
      console.error('[Login] Database error:', dbErr);
      throw dbErr;
    }
  } catch (err) {
    console.error('❌ [Login] Caught error:', err.message);
    console.error('❌ [Login] Full error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
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
