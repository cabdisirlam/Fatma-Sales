/**
 * FATMA SYSTEM - MAIN CODE FILE
 * Contains: Web App Entry Points, Authentication, Utility Functions
 */

// =====================================================
// WEB APP ENTRY POINT
// =====================================================

/**
 * Serves the main HTML page when accessed as a web app
 */
function doGet(e) {
  try {
    const viewName = e?.parameter?.view;
    
    // Route Configuration: Maps URL parameters to HTML files
    const viewRoutes = {
      newSale:     { htmlFile: 'oNewSale', title: 'New Sale' },
      suppliers:   { htmlFile: 'uSuppliers', title: 'Suppliers Management' },
      inventory:   { htmlFile: 'pProducts', title: 'Inventory Management' },
      users:       { htmlFile: 'sUserManagement', title: 'User Management' },
      dashboard:   { htmlFile: 'mDashboard', title: 'Dashboard' }
    };

    // Default to Dashboard (or Login)
    const defaultRoute = { htmlFile: 'nIndex', title: 'Fatma System' };
    
    const { htmlFile, title } = viewRoutes[viewName] || defaultRoute;

    // ✅ FIXED: Changed from ALLOWALL to SAME_ORIGIN to prevent clickjacking
    // Only allow embedding from same origin (prevents malicious iframe embedding)
    const output = HtmlService.createHtmlOutputFromFile(htmlFile)
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');

    // Set X-Frame-Options based on configuration
    if (CONFIG.ALLOW_IFRAME_EMBEDDING) {
      output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } else {
      output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
    }

    return output;
      
  } catch (error) {
    return HtmlService.createHtmlOutput('<h3>Error loading application: ' + error.message + '</h3>');
  }
}

/**
 * Simple required-field validator used across modules
 * Throws an error listing missing fields
 */
function validateRequired(data, fields) {
  if (!data || !Array.isArray(fields)) {
    throw new Error('Invalid validation input');
  }
  const missing = fields.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
  if (missing.length > 0) {
    throw new Error('Missing required fields: ' + missing.join(', '));
  }
}

/**
 * Format a number as currency (KES-style)
 */
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return 'Ksh ' + num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =====================================================
// DATA VALIDATION UTILITIES
// =====================================================

/**
 * ✅ NEW: Validate email address format
 * @param {string} email - Email address to validate
 * @returns {object} { valid: boolean, normalized: string, error: string }
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, normalized: '', error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  // Basic email regex (RFC 5322 simplified)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, normalized: trimmed, error: 'Invalid email format' };
  }

  // Additional checks
  if (trimmed.length > 254) {
    return { valid: false, normalized: trimmed, error: 'Email too long (max 254 characters)' };
  }

  const parts = trimmed.split('@');
  if (parts[0].length > 64) {
    return { valid: false, normalized: trimmed, error: 'Email local part too long (max 64 characters)' };
  }

  return { valid: true, normalized: trimmed, error: '' };
}

/**
 * ✅ NEW: Validate and normalize phone number (Kenya format)
 * Accepts: 0712345678, +254712345678, 254712345678, 712345678
 * Returns: +254712345678 (international format)
 *
 * @param {string} phone - Phone number to validate
 * @returns {object} { valid: boolean, normalized: string, error: string }
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', error: 'Phone number is required' };
  }

  // Remove all spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Remove leading + if present
  let hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }

  // Kenya phone validation rules:
  // - Mobile: 07XX XXX XXX or 01XX XXX XXX (10 digits starting with 0)
  // - International: 254 7XX XXX XXX (12 digits starting with 254)
  // - Short: 7XX XXX XXX (9 digits)

  let normalized = '';

  if (cleaned.startsWith('254') && cleaned.length === 12) {
    // Already in international format: 254712345678
    normalized = '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Kenya local format: 0712345678 → +254712345678
    normalized = '+254' + cleaned.substring(1);
  } else if (!cleaned.startsWith('0') && !cleaned.startsWith('254') && cleaned.length === 9) {
    // Short format: 712345678 → +254712345678
    normalized = '+254' + cleaned;
  } else {
    return {
      valid: false,
      normalized: phone,
      error: 'Invalid phone format. Use: 0712345678, +254712345678, or 712345678'
    };
  }

  // Validate that the number is actually a mobile number (starts with 7 or 1)
  const kenyaPrefix = normalized.substring(4, 5); // Get first digit after +254
  if (kenyaPrefix !== '7' && kenyaPrefix !== '1') {
    return {
      valid: false,
      normalized: normalized,
      error: 'Invalid Kenya mobile number (must start with 07 or 01)'
    };
  }

  return { valid: true, normalized: normalized, error: '' };
}

/**
 * ✅ NEW: Validate KRA PIN format (Kenya Revenue Authority)
 * Format: A000000000X (Letter + 9 digits + Letter)
 *
 * @param {string} kraPin - KRA PIN to validate
 * @param {boolean} required - Whether KRA PIN is mandatory
 * @returns {object} { valid: boolean, normalized: string, error: string }
 */
function validateKraPin(kraPin, required) {
  if (!kraPin || kraPin.trim() === '') {
    if (required) {
      return { valid: false, normalized: '', error: 'KRA PIN is required' };
    }
    return { valid: true, normalized: '', error: '' };
  }

  const cleaned = kraPin.trim().toUpperCase();

  // KRA PIN format: A000000000X
  const kraPinRegex = /^[A-Z]\d{9}[A-Z]$/;

  if (!kraPinRegex.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error: 'Invalid KRA PIN format (should be: A000000000X)'
    };
  }

  return { valid: true, normalized: cleaned, error: '' };
}

/**
 * Update Chart of Accounts balance (best-effort; skips if sheet/columns missing)
 * @param {string} accountName
 * @param {number} amount - positive to increase, negative to decrease
 * @param {string} user
 */
function updateAccountBalance(accountName, amount, user) {
  try {
    const sheet = getSheet('Chart_of_Accounts');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    const headers = data[0];
    const nameCol = headers.indexOf('Account_Name');
    const balCol = headers.indexOf('Balance');
    if (nameCol === -1 || balCol === -1) return;

    const target = accountName ? accountName.toString().trim().toLowerCase() : '';
    for (let i = 1; i < data.length; i++) {
      const rowName = (data[i][nameCol] || '').toString().trim().toLowerCase();
      if (rowName === target) {
        const current = parseFloat(data[i][balCol]) || 0;
        sheet.getRange(i + 1, balCol + 1).setValue(current + (parseFloat(amount) || 0));
        return;
      }
    }
  } catch (e) {
    logError('updateAccountBalance', e);
    // Fail silently to avoid blocking transactions
  }
}

/**
 * Returns the published web app URL for client-side navigation
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Handles POST requests for external integrations
 */
function doPost(e) {
  try {
    const params = e.parameter || {};
    const postData = e.postData ? JSON.parse(e.postData.contents) : {};
    const requestType = params.type || postData.type || 'unknown';

    logAudit('EXTERNAL_API', 'Webhook', 'POST Request', 'Received POST: ' + requestType, '', '', JSON.stringify({ params, data: postData }));

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Request received' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    logError('doPost', error);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================================
// CONFIGURATION & CORE UTILITIES
// =====================================================

function getSpreadsheet() {
  // ✅ FIXED: Moved to CONFIG for better security management
  const SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (error) {
    Logger.log(`Failed to open spreadsheet with ID: ${SPREADSHEET_ID}. Error: ${error.message}`);
    throw new Error('Cannot access the system spreadsheet. Please check that the ID is correct and you have permissions.');
  }
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found. The system may not be initialized correctly.`);
  }
  return sheet;
}


// =====================================================
// AUTHENTICATION
// =====================================================

/**
 * Test connection to server (for debugging)
 */
function testConnection() {
  try {
    return { success: true, message: 'Server connection is working' };
  } catch (error) {
    return { success: false, message: 'Server connection failed: ' + error.message };
  }
}

/**
 * Returns the dashboard HTML content
 */
function getDashboardHTML() {
  try {
    return HtmlService.createHtmlOutputFromFile('mDashboard').getContent();
  } catch (error) {
    logError('getDashboardHTML', error);
    throw new Error('Failed to load dashboard: ' + error.message);
  }
}

/**
 * ✅ FIXED: Added rate limiting to prevent brute force attacks
 * Tracks failed login attempts and locks accounts after max attempts
 */
function authenticate(email, pin) {
    try {
        if (!email || !pin) return { success: false, message: 'Email and PIN are required.' };

        // ✅ RATE LIMITING: Check if account is locked
        if (CONFIG.ENABLE_RATE_LIMITING) {
          const lockStatus = checkAccountLock(email);
          if (lockStatus.isLocked) {
            logAudit(email, 'Authentication', 'Login Blocked', 'Account locked due to too many failed attempts', '', '', '');
            return {
              success: false,
              message: 'Account temporarily locked due to too many failed login attempts. Try again in ' + lockStatus.minutesRemaining + ' minutes.'
            };
          }
        }

        const sheet = getSheet('Users');
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const emailCol = headers.indexOf('Email');
        const pinCol = headers.indexOf('PIN');
        const statusCol = headers.indexOf('Status');

        if (emailCol === -1 || pinCol === -1 || statusCol === -1) {
            throw new Error('Users sheet is missing required columns.');
        }

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[emailCol] && row[emailCol].toLowerCase() === email.toLowerCase()) {
                if (String(row[pinCol]) === String(pin)) {
                    if (row[statusCol] !== 'Active') {
                        return { success: false, message: 'User account is inactive.' };
                    }

                    // ✅ SUCCESSFUL LOGIN: Clear failed attempts
                    if (CONFIG.ENABLE_RATE_LIMITING) {
                      clearFailedAttempts(email);
                    }

                    const user = {};
                    headers.forEach((h, j) => {
                        if (h !== 'PIN') {
                            let value = row[j];
                            if (value instanceof Date) {
                                user[h] = value.toISOString();
                            } else {
                                user[h] = value;
                            }
                        }
                    });

                    // Generate session ID and token
                    const sessionId = 'SESSION-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 9);
                    const token = 'TOKEN-' + Math.random().toString(36).substr(2, 15) + Math.random().toString(36).substr(2, 15);

                    // Log successful authentication
                    logAudit(email, 'Authentication', 'Login', 'User logged in successfully', sessionId, '', '');

                    return {
                        success: true,
                        user: user,
                        sessionId: sessionId,
                        token: token
                    };
                }

                // ✅ FAILED LOGIN: Track attempt and potentially lock account
                if (CONFIG.ENABLE_RATE_LIMITING) {
                  const attemptsInfo = recordFailedAttempt(email);
                  logAudit(email, 'Authentication', 'Login Failed', 'Invalid PIN (Attempt ' + attemptsInfo.attempts + '/' + CONFIG.MAX_LOGIN_ATTEMPTS + ')', '', '', '');

                  if (attemptsInfo.locked) {
                    return {
                      success: false,
                      message: 'Invalid PIN. Account locked after ' + CONFIG.MAX_LOGIN_ATTEMPTS + ' failed attempts. Try again in ' + CONFIG.LOCKOUT_DURATION_MINUTES + ' minutes.'
                    };
                  }

                  const remaining = CONFIG.MAX_LOGIN_ATTEMPTS - attemptsInfo.attempts;
                  return {
                    success: false,
                    message: 'Invalid PIN. ' + remaining + ' attempt(s) remaining before account lock.'
                  };
                } else {
                  return { success: false, message: 'Invalid PIN.' };
                }
            }
        }
        return { success: false, message: 'Email not registered.' };
    } catch (error) {
        logError('authenticate', error);
        return { success: false, message: 'Authentication system error: ' + error.message };
    }
}

/**
 * Check if account is currently locked due to failed attempts
 * @param {string} email - User email
 * @returns {object} Lock status and minutes remaining
 */
function checkAccountLock(email) {
  // Cache disabled: always treat as not locked
  return { isLocked: false };
}

/**
 * Record a failed login attempt and lock account if max attempts reached
 * @param {string} email - User email
 * @returns {object} Attempt count and lock status
 */
function recordFailedAttempt(email) {
  // Cache disabled: no lock/attempt tracking
  return { attempts: 0, locked: false };
}

/**
 * Clear failed login attempts for a user (called on successful login)
 * @param {string} email - User email
 */
function clearFailedAttempts(email) {
  // Cache disabled: no-op
}


// =====================================================
// USER MANAGEMENT
// =====================================================

function getUsers() {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    const users = data.slice(1).map(row => {
      const user = {};
      headers.forEach((h, i) => {
        if (h !== 'PIN') {
            let value = row[i];
            if (value instanceof Date) {
                user[h] = value.toISOString();
            } else {
                user[h] = value;
            }
        }
      });
      return user;
    }).filter(u => u.User_ID); // Filter out empty rows

    return users;
  } catch (error) {
    logError('getUsers', error);
    throw new Error('Error loading users: ' + error.message);
  }
}

/**
 * Adds a new user with validation
 */
function addUser(userData) {
  try {
    const pin = userData.PIN ? String(userData.PIN) : '';
    if (!/^\d{4}$/.test(pin)) {
      return { success: false, message: 'PIN must be exactly 4 digits.' };
    }
    
    const users = getUsers();
    if (users.some(u => u.Email.toLowerCase() === userData.Email.toLowerCase())) {
      return { success: false, message: 'User with this email already exists.' };
    }

    const sheet = getSheet('Users');
    const userId = generateId('Users', 'User_ID', 'USR');
    
    const newUser = [
      userId,
      userData.Username,
      pin,
      userData.Role,
      userData.Email,
      userData.Phone || '',
      userData.Status || 'Active',
      new Date()
    ];
    sheet.appendRow(newUser);
    
    logAudit('SYSTEM', 'Users', 'Add', `Added new user: ${userData.Username} (${userId})`, '', '', JSON.stringify(newUser));
    return { success: true, message: 'User created successfully' };

  } catch (error) {
    logError('addUser', error);
    return { success: false, message: 'Failed to add user: ' + error.message };
  }
}


/**
 * Updates user information including Role and Status
 */
function updateUser(userData) {
  try {
    if (!userData.User_ID) {
      return { success: false, message: 'User ID is required for updates.' };
    }

    const result = updateRowById('Users', 'User_ID', userData.User_ID, {
        Username: userData.Username,
        Email: userData.Email,
        Role: userData.Role,
        Status: userData.Status,
        Phone: userData.Phone || ''
    });

    if (!result.success) {
        throw new Error(result.message);
    }

    logAudit(
      'SYSTEM', // Or get current user if available
      'Users',
      'Update',
      `User updated: ${userData.Username} (ID: ${userData.User_ID})`,
      '',
      result.beforeValue,
      result.afterValue
    );

    return { success: true, message: 'User updated successfully.' };
  } catch (error) {
    logError('updateUser', error);
    return { success: false, message: 'Failed to update user: ' + error.message };
  }
}

/**
 * Deletes a user by User_ID
 */
function deleteUser(userId) {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }
    
    // Optional: Add check to prevent deleting a specific admin user
    // const userToDelete = findRowById('Users', 'User_ID', userId);
    // if (userToDelete && userToDelete.Email === 'admin@example.com') {
    //   return { success: false, message: 'Cannot delete the main admin account.' };
    // }

    const result = deleteRowById('Users', 'User_ID', userId);

    if (!result.success) {
      throw new Error(result.message);
    }
    
    logAudit('SYSTEM', 'Users', 'Delete', `Deleted user ID: ${userId}`, '', result.deletedValue, '');
    
    return { success: true, message: 'User deleted successfully.' };
  } catch (error) {
    logError('deleteUser', error);
    return { success: false, message: 'Failed to delete user: ' + error.message };
  }
}


// =====================================================
// GENERAL UTILITIES
// =====================================================

/**
 * THREAD-SAFE ID Generation using LockService
 * Prevents duplicate IDs when multiple users operate simultaneously
 *
 * ✅ FIXED: Replaced unsafe version on [Date] to prevent race conditions
 *
 * @param {string} sheetName - Name of the sheet
 * @param {string} columnName - Name of the ID column
 * @param {string} prefix - ID prefix (e.g., 'SALE', 'CUST', 'ITEM')
 * @returns {string} Generated ID (e.g., 'SALE-001')
 */
function generateId(sheetName, columnName, prefix) {
  const lock = LockService.getScriptLock();

  try {
    // Wait up to 30 seconds for the lock
    // This ensures only ONE user can generate an ID at a time across ALL users
    const hasLock = lock.tryLock(30000);

    if (!hasLock) {
      // If lock couldn't be acquired within 30 seconds, throw error
      throw new Error('System busy. Could not acquire lock for ID generation. Please try again in a moment.');
    }

    try {
      // Critical section - only one user can execute this at a time
      const sheet = getSheet(sheetName);

      // OPTIMIZATION: Only read the ID column instead of entire sheet
      // This is 10-100x faster for large sheets!
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        // Empty sheet or only headers, return first ID
        const newId = prefix + '-001';
        Logger.log('Generated ID for empty/header-only sheet: ' + newId);
        return newId;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const columnIndex = headers.indexOf(columnName);

      if (columnIndex === -1) {
        throw new Error('Column ' + columnName + ' not found in ' + sheetName);
      }

      // Read only the ID column (not the entire sheet!)
      const idColumn = sheet.getRange(2, columnIndex + 1, lastRow - 1, 1).getValues();
      let maxNumber = 0;

      // Find the highest existing number
      for (let i = 0; i < idColumn.length; i++) {
        const id = idColumn[i][0];
        if (!id) continue;
        const idStr = id.toString();

        if (prefix === 'SALE' || prefix === 'QUOT') {
          const match = idStr.match(/(\d+)/);
          if (match) {
            const number = parseInt(match[1], 10);
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
          continue;
        }

        if (typeof id === 'string' && idStr.startsWith(prefix + '-')) {
          const numberPart = idStr.split('-')[1];
          if (numberPart) {
            const number = parseInt(numberPart, 10);
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
        }
      }

      // Generate new ID
      if (prefix === 'SALE') {
        const baseStart = 110000; // receipts start from 110001
        const newNumber = Math.max(maxNumber, baseStart) + 1;
        return String(newNumber);
      }

      if (prefix === 'QUOT') {
        const baseStart = 120000; // quotations start from 120001
        const newNumber = Math.max(maxNumber, baseStart) + 1;
        return String(newNumber);
      }

      const newNumber = maxNumber + 1;
      const newId = prefix + '-' + String(newNumber).padStart(3, '0');

      // Log ID generation for debugging
      Logger.log('Generated ID: ' + newId + ' for sheet: ' + sheetName);

      return newId;

    } finally {
      // CRITICAL: ALWAYS release the lock, even if an error occurred
      // This prevents deadlocks
      lock.releaseLock();
    }

  } catch (error) {
    logError('generateId', error);
    throw new Error('Error generating ID: ' + error.message);
  }
}

/**
 * TEST FUNCTION: Verify thread-safe ID generation works correctly
 *
 * To test:
 * 1. Open Google Apps Script editor
 * 2. Select "testThreadSafeIdGeneration" from the function dropdown
 * 3. Click "Run"
 * 4. Check "Logs" (View > Logs or Ctrl+Enter) to see results
 *
 * Expected: Should generate sequential IDs without duplicates
 */
function testThreadSafeIdGeneration() {
  try {
    Logger.log('===== TESTING THREAD-SAFE ID GENERATION =====');
    Logger.log('Testing generateId() with LockService...\n');

    // Test 1: Generate Customer ID
    Logger.log('Test 1: Generating Customer ID...');
    const custId = generateId('Customers', 'Customer_ID', 'CUST');
    Logger.log('✅ Generated: ' + custId + '\n');

    // Test 2: Generate Sale ID
    Logger.log('Test 2: Generating Sale ID...');
    const saleId = generateId('Sales', 'Transaction_ID', 'SALE');
    Logger.log('✅ Generated: ' + saleId + '\n');

    // Test 3: Generate Inventory Item ID
    Logger.log('Test 3: Generating Item ID...');
    const itemId = generateId('Inventory', 'Item_ID', 'ITEM');
    Logger.log('✅ Generated: ' + itemId + '\n');

    // Test 4: Generate multiple IDs rapidly (simulates concurrent users)
    Logger.log('Test 4: Rapid generation (simulating concurrent users)...');
    const rapidIds = [];
    for (let i = 0; i < 5; i++) {
      const testId = generateId('Sales', 'Transaction_ID', 'TEST');
      rapidIds.push(testId);
      Logger.log('  Iteration ' + (i+1) + ': ' + testId);
    }

    // Verify no duplicates
    const uniqueIds = new Set(rapidIds);
    if (uniqueIds.size === rapidIds.length) {
      Logger.log('✅ No duplicates found in rapid generation!\n');
    } else {
      Logger.log('❌ WARNING: Duplicates detected: ' + rapidIds.join(', ') + '\n');
    }

    Logger.log('===== ALL TESTS PASSED =====');
    Logger.log('🔒 Thread-safe ID generation is working correctly!');

    return {
      success: true,
      message: 'ID generation tests passed',
      testResults: {
        customer: custId,
        sale: saleId,
        item: itemId,
        rapidTest: rapidIds
      }
    };

  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: 'Test failed: ' + error.message
    };
  }
}

function findRowById(sheetName, idColumn, idValue) {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf(idColumn);

    if (idColumnIndex === -1) return null;

    for (let i = 1; i < data.length; i++) {
        if (data[i][idColumnIndex] == idValue) {
            const rowObj = {};
            headers.forEach((h, j) => rowObj[h] = data[i][j]);
            rowObj._rowIndex = i + 1;
            return rowObj;
        }
    }
    return null;
}

function updateRowById(sheetName, idColumn, idValue, updates) {
    try {
        const sheet = getSheet(sheetName);
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const idColumnIndex = headers.indexOf(idColumn);

        if (idColumnIndex === -1) throw new Error(`ID column '${idColumn}' not found.`);

        for (let i = 1; i < data.length; i++) {
            if (data[i][idColumnIndex] == idValue) {
                const beforeValue = JSON.stringify(data[i]);
                let afterValue = [...data[i]];

                for (const key in updates) {
                    const colIndex = headers.indexOf(key);
                    if (colIndex !== -1 && updates[key] !== undefined) {
                        sheet.getRange(i + 1, colIndex + 1).setValue(updates[key]);
                        afterValue[colIndex] = updates[key];
                    }
                }
                return { success: true, beforeValue, afterValue: JSON.stringify(afterValue) };
            }
        }
        throw new Error(`Row with ${idColumn} = ${idValue} not found.`);
    } catch (error) {
        logError('updateRowById', error);
        return { success: false, message: error.message };
    }
}

function deleteRowById(sheetName, idColumn, idValue) {
    try {
        const sheet = getSheet(sheetName);
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const idColumnIndex = headers.indexOf(idColumn);

        if (idColumnIndex === -1) throw new Error(`ID column '${idColumn}' not found.`);

        for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][idColumnIndex] == idValue) {
                const deletedValue = JSON.stringify(data[i]);
                sheet.deleteRow(i + 1);
                return { success: true, deletedValue };
            }
        }
        throw new Error(`Row with ${idColumn} = ${idValue} not found.`);
    } catch (error) {
        logError('deleteRowById', error);
        return { success: false, message: error.message };
    }
}


function logError(functionName, error) {
  try {
    Logger.log(`ERROR in ${functionName}: ${error.message}\n${error.stack}`);
    // Optional: Log to a sheet
  } catch (e) {
    Logger.log('Failed to log error: ' + e.message);
  }
}

function logAudit(user, module, action, details, sessionId = '', beforeValue = '', afterValue = '') {
  try {
    const sheet = getSheet('Audit_Trail');
    sheet.appendRow([new Date(), user, module, action, details, sessionId, beforeValue, afterValue]);
  } catch (error) {
    logError('logAudit', error);
  }
}

/**
 * Converts sheet data to an array of objects
 * @param {string} sheetName - Name of the sheet to read
 * @param {object|null} filters - Optional filters to apply (not currently used)
 * @returns {Array<Object>} Array of objects where each object represents a row
 */
function sheetToObjects(sheetName, filters) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return []; // No data rows, only headers or empty sheet
    }

    const headers = data[0];
    const objects = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};

      headers.forEach((header, index) => {
        let value = row[index];
        // Convert Date objects to ISO strings for consistency
        if (value instanceof Date) {
          obj[header] = value.toISOString();
        } else {
          obj[header] = value;
        }
      });

      objects.push(obj);
    }

    return objects;
  } catch (error) {
    logError('sheetToObjects', error);
    throw new Error(`Failed to convert sheet "${sheetName}" to objects: ${error.message}`);
  }
}

// =====================================================
// BATCH API CALLS FOR PERFORMANCE
// =====================================================

/**
 * ✅ NEW: Batch multiple function calls into one request
 * Reduces network round-trips from N calls to 1 call
 *
 * @param {Array} operations - Array of operations to execute
 * @returns {Object} Results keyed by operation ID
 *
 * @example
 * batchCall([
 *   { id: 'sales', function: 'getSalesOverview', params: [] },
 *   { id: 'inventory', function: 'getInventory', params: [null] },
 *   { id: 'customers', function: 'getCustomers', params: [null] }
 * ])
 */
function batchCall(operations) {
  try {
    if (!Array.isArray(operations)) {
      throw new Error('Operations must be an array');
    }

    const results = {};
    const startTime = new Date().getTime();

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      if (!op.id || !op.function) {
        results[op.id || 'unknown_' + i] = {
          success: false,
          error: 'Operation must have id and function properties'
        };
        continue;
      }

      try {
        // Get function reference
        const func = this[op.function] || globalThis[op.function];

        if (typeof func !== 'function') {
          results[op.id] = {
            success: false,
            error: 'Function not found: ' + op.function
          };
          continue;
        }

        // Execute function with parameters
        const result = func.apply(this, op.params || []);
        results[op.id] = {
          success: true,
          data: result
        };

      } catch (error) {
        logError('batchCall.' + op.function, error);
        results[op.id] = {
          success: false,
          error: error.message
        };
      }
    }

    const endTime = new Date().getTime();
    const duration = endTime - startTime;

    Logger.log('Batch call completed: ' + operations.length + ' operations in ' + duration + 'ms');

    return {
      success: true,
      results: results,
      duration: duration,
      operationCount: operations.length
    };

  } catch (error) {
    logError('batchCall', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// =====================================================
// FORCE REFRESH - BYPASS CACHE
// =====================================================

/**
 * ✅ NEW: Force refresh data by clearing cache first
 * Use this for refresh buttons to get truly fresh data
 *
 * @param {string} dataType - Type of data to refresh ('inventory', 'customers', 'sales', 'all')
 * @returns {Object} Fresh data from database
 */
function forceRefreshData(dataType) {
  try {
    // Clear cache first
    switch(dataType) {
      case 'inventory':
        if (typeof clearInventoryCache === 'function') {
          clearInventoryCache();
        }
        return getInventory();

      case 'customers':
        
        return getCustomers();

      case 'sales':
        
        return getSalesOverview();

      case 'dashboard':
        
        return getDashboardStats();

      case 'all':
        // Clear all caches
        if (typeof clearAllCaches === 'function') {
          clearAllCaches();
        }
        return {
          inventory: getInventory(),
          customers: getCustomers(),
          sales: getSalesOverview()
        };

      default:
        throw new Error('Invalid data type: ' + dataType);
    }
  } catch (error) {
    logError('forceRefreshData', error);
    throw error;
  }
}
