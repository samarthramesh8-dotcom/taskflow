/**
 * Strict validation for task payloads and auth
 */

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_CATEGORIES = ['general', 'work', 'personal', 'shopping', 'health'];
const MAX_TEXT_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2000;

function validateTaskPayload(body, isUpdate = false) {
  const errors = [];

  // Text validation (required for create, optional for update)
  if (!isUpdate || body.text !== undefined) {
    if (!body.text || typeof body.text !== 'string') {
      if (!isUpdate) {
        errors.push('Task text is required');
      }
    } else {
      const trimmedText = body.text.trim();
      if (trimmedText.length === 0) {
        errors.push('Task text cannot be empty');
      } else if (trimmedText.length > MAX_TEXT_LENGTH) {
        errors.push(`Task text must not exceed ${MAX_TEXT_LENGTH} characters`);
      }
    }
  }

  // Description validation (optional)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be a string');
    } else if (body.description.trim().length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }

  // Priority validation
  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.priority)) {
      errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
  }

  // Category validation
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(body.category)) {
      errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
  }

  // Done validation
  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') {
      errors.push('Done must be a boolean');
    }
  }

  // Due date validation
  if (body.due_date !== undefined && body.due_date !== null) {
    if (typeof body.due_date !== 'string') {
      errors.push('Due date must be a string in YYYY-MM-DD format');
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.due_date)) {
        errors.push('Due date must be in YYYY-MM-DD format');
      } else {
        const date = new Date(body.due_date);
        if (isNaN(date.getTime())) {
          errors.push('Due date must be a valid date');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long (max 254 characters)' };
  }
  
  if (!trimmed.includes('@') || trimmed.split('@').length !== 2) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  const [localPart, domain] = trimmed.split('@');
  if (!localPart || localPart.length === 0) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  if (!domain || domain.length === 0 || !domain.includes('.')) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  return { valid: true };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }
  
  return { valid: true };
}

module.exports = {
  validateTaskPayload,
  validateEmail,
  validatePassword,
  VALID_PRIORITIES,
  VALID_CATEGORIES,
  MAX_TEXT_LENGTH,
  MAX_DESCRIPTION_LENGTH
};
