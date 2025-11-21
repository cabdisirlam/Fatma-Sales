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
    return HtmlService.createHtmlOutputFromFile('nIndex')
      .setTitle('Fatma System')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    logError('doGet', error);
    return HtmlService.createHtmlOutput('<h3>Error loading application: ' + error.message + '</h3>');
  }
}

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Gets the main spreadsheet
 */
function getSpreadsheet() {
  try {
    // Use Script Properties to avoid circular dependency
    const scriptProperties = PropertiesService.getScriptProperties();
    const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

    if (spreadsheetId) {
      try {
        return SpreadsheetApp.openById(spreadsheetId);
      } catch (e) {
        // If can't open by ID, fall back to active spreadsheet
        return SpreadsheetApp.getActiveSpreadsheet();
      }
    }

    // Fallback to active spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Save the ID for future use
    if (ss) {
      scriptProperties.setProperty('SPREADSHEET_ID', ss.getId());
    }

    return ss;
  } catch (error) {
    throw new Error('Cannot access spreadsheet. Please check permissions and configuration.');
  }
}

/**
 * Gets a specific sheet by name
 */
function getSheet(sheetName) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    // If sheet doesn't exist, create it
    if (!sheet) {
      sheet = createSheet(sheetName);
    }

    return sheet;
  } catch (error) {
    throw new Error('Cannot access sheet: ' + sheetName + '. Error: ' + error.message);
  }
}

/**
 * Creates a new sheet with headers based on sheet name
 */
function createSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.insertSheet(sheetName);

  // Define headers for each sheet
  const headers = getSheetHeaders(sheetName);

  if (headers && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Returns headers for each sheet type
 */
function getSheetHeaders(sheetName) {
  const headerMap = {
    'Inventory': ['Item_ID', 'Item_Name', 'Category', 'Cost_Price', 'Selling_Price', 'Current_Qty', 'Reorder_Level', 'Supplier', 'Last_Updated', 'Updated_By'],
    'Sales_Data': ['Sale_ID', 'DateTime', 'Customer_ID', 'Customer_Name', 'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total', 'Payment_Mode', 'Sold_By', 'Location', 'KRA_PIN', 'Status'],
    'Sales_Items': ['Sale_ID', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total'],
    'Customers': ['Customer_ID', 'Customer_Name', 'Phone', 'Email', 'Location', 'KRA_PIN', 'Customer_Type', 'Credit_Limit', 'Current_Balance', 'Total_Purchases', 'Last_Purchase_Date', 'Loyalty_Points', 'Status', 'Created_Date', 'Created_By'],
    'Customer_Transactions': ['Transaction_ID', 'Customer_ID', 'Date', 'Type', 'Reference', 'Amount', 'Balance', 'Description', 'User'],
    'Quotations': ['Quote_ID', 'Date', 'Customer_ID', 'Customer_Name', 'Valid_Until', 'Subtotal', 'Delivery', 'Discount', 'Total', 'Status', 'Prepared_By', 'Converted_Sale_ID'],
    'Quotation_Items': ['Quote_ID', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total'],
    'Suppliers': ['Supplier_ID', 'Supplier_Name', 'Contact_Person', 'Phone', 'Email', 'Address', 'Total_Purchased', 'Total_Paid', 'Current_Balance', 'Payment_Terms', 'Status'],
    'Purchases': ['Purchase_ID', 'Date', 'Supplier_ID', 'Supplier_Name', 'Total_Amount', 'Payment_Status', 'Payment_Method', 'Paid_Amount', 'Balance', 'Recorded_By'],
    'Purchase_Items': ['Purchase_ID', 'Item_ID', 'Item_Name', 'Qty', 'Cost_Price', 'Line_Total'],
    'Financials': ['DateTime', 'Transaction_ID', 'Type', 'Account', 'Description', 'Debit', 'Credit', 'Balance', 'User', 'Reference'],
    'Expenses': ['Expense_ID', 'Date', 'Category', 'Description', 'Amount', 'Payment_Method', 'Account', 'Payee', 'Receipt_No', 'Status', 'Approved_By', 'Recorded_By'],
    'Expense_Categories': ['Category_ID', 'Category_Name', 'Monthly_Budget', 'Status'],
    'Users': ['User_ID', 'Username', 'PIN', 'Role', 'Email', 'Phone', 'Status', 'Created_Date'],
    'Audit_Trail': ['Timestamp', 'User', 'Module', 'Action', 'Details', 'Session_ID', 'Before_Value', 'After_Value'],
    'Settings': ['Setting_Key', 'Setting_Value']
  };

  return headerMap[sheetName] || [];
}

// =====================================================
// AUTHENTICATION
// =====================================================

/**
 * Authenticates a user with email and PIN
 * Enhanced with comprehensive error logging and diagnostics
 * CRITICAL: This function MUST always return an object with a 'success' property
 */
function authenticate(email, pin) {
  // Wrap everything in try-catch to ensure we ALWAYS return a result object
  try {
    const startTime = new Date();
    const logPrefix = '[AUTH ' + startTime.toISOString() + ']';

    try {
      Logger.log(logPrefix + ' Authentication attempt started');
      Logger.log(logPrefix + ' Email: ' + email);

      // Validate inputs are provided
      if (!email || !pin) {
        return {
          success: false,
          message: 'Email and PIN are required',
          debugInfo: 'Missing email or PIN'
        };
      }

      // Safely get PIN_LENGTH with fallback
      const pinLength = (typeof CONFIG !== 'undefined' && CONFIG.PIN_LENGTH) ? CONFIG.PIN_LENGTH : 4;

      // Validate PIN format (must be 4 digits)
      if (pin.toString().length !== pinLength) {
        const errorMsg = 'PIN must be exactly ' + pinLength + ' digits';
        Logger.log(logPrefix + ' FAILED: ' + errorMsg);
        try {
          logAction('SYSTEM', 'Authentication', 'Failed Login', 'Invalid PIN format for email: ' + email, '', '', '');
        } catch (e) {
          // Ignore audit logging errors during authentication
        }
        return {
          success: false,
          message: errorMsg,
          debugInfo: 'PIN validation failed'
        };
      }

    // Validate email is provided
    if (!email || email.trim() === '') {
      const errorMsg = 'Email is required';
      Logger.log(logPrefix + ' FAILED: ' + errorMsg);
      return {
        success: false,
        message: errorMsg,
        debugInfo: 'Email validation failed'
      };
    }

    // Try to get Users sheet
    Logger.log(logPrefix + ' Attempting to access Users sheet...');
    let sheet;
    try {
      sheet = getSheet('Users');
      Logger.log(logPrefix + ' Successfully accessed Users sheet');
    } catch (sheetError) {
      Logger.log(logPrefix + ' FAILED: Cannot access Users sheet - ' + sheetError.message);
      logError('authenticate - getSheet', sheetError);
      return {
        success: false,
        message: 'System configuration error: Cannot access Users sheet. Please contact administrator.',
        debugInfo: 'Users sheet not accessible: ' + sheetError.message,
        technicalDetails: sheetError.stack
      };
    }

    // Try to read data from sheet
    Logger.log(logPrefix + ' Reading user data from sheet...');
    let data;
    try {
      data = sheet.getDataRange().getValues();
      Logger.log(logPrefix + ' Successfully read ' + data.length + ' rows from Users sheet');
    } catch (readError) {
      Logger.log(logPrefix + ' FAILED: Cannot read Users sheet - ' + readError.message);
      logError('authenticate - getData', readError);
      return {
        success: false,
        message: 'System error: Cannot read user data. Please contact administrator.',
        debugInfo: 'Data read failed: ' + readError.message,
        technicalDetails: readError.stack
      };
    }

    // Check if sheet has headers
    if (data.length < 1) {
      Logger.log(logPrefix + ' FAILED: Users sheet is empty (no headers)');
      logAction('SYSTEM', 'Authentication', 'Failed Login', 'Users sheet is empty - no headers found', '', '', '');
      return {
        success: false,
        message: 'System not initialized: No user data found. Please run "Setup Fatma System" from the menu.',
        debugInfo: 'Users sheet has no data',
        recommendation: 'Run "🏪 Fatma System" > "⚡ Setup Fatma System" from the spreadsheet menu'
      };
    }

    const headers = data[0];
    Logger.log(logPrefix + ' Headers found: ' + headers.join(', '));

    // Find email, username, and PIN column indices
    const emailCol = headers.indexOf('Email');
    const usernameCol = headers.indexOf('Username');
    const pinCol = headers.indexOf('PIN');
    const statusCol = headers.indexOf('Status');
    const roleCol = headers.indexOf('Role');

    // Validate that all required columns exist
    if (emailCol === -1 || usernameCol === -1 || pinCol === -1 || statusCol === -1) {
      Logger.log(logPrefix + ' FAILED: Missing required columns in Users sheet');
      Logger.log(logPrefix + ' Email column: ' + emailCol + ', Username: ' + usernameCol + ', PIN: ' + pinCol + ', Status: ' + statusCol);
      return {
        success: false,
        message: 'System configuration error: Users sheet is missing required columns. Please run system setup.',
        debugInfo: 'Missing columns - Email: ' + emailCol + ', Username: ' + usernameCol + ', PIN: ' + pinCol + ', Status: ' + statusCol,
        recommendation: 'Run "🏪 Fatma System" > "⚡ Setup Fatma System" from the spreadsheet menu'
      };
    }

    Logger.log(logPrefix + ' All required columns found');
    Logger.log(logPrefix + ' Searching for user with email: ' + email);
    Logger.log(logPrefix + ' Total users in database: ' + (data.length - 1));

    // Check if there are any users
    if (data.length <= 1) {
      Logger.log(logPrefix + ' FAILED: No users in database');
      logAction('SYSTEM', 'Authentication', 'Failed Login', 'No users found in system for email: ' + email, '', '', '');
      return {
        success: false,
        message: 'No users found in system. Please run "Setup Fatma System" to create the default admin user.',
        debugInfo: 'Users sheet has headers but no data rows',
        recommendation: 'Run "🏪 Fatma System" > "⚡ Setup Fatma System" from the spreadsheet menu'
      };
    }

    // Search for user by email
    let userFound = false;
    let emailMatch = false;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Check if email matches
      if (row[emailCol] && row[emailCol].toLowerCase() === email.toLowerCase()) {
        emailMatch = true;
        Logger.log(logPrefix + ' Found user with matching email at row ' + (i + 1));

        // Check PIN
        if (row[pinCol].toString() === pin.toString()) {
          Logger.log(logPrefix + ' PIN matches');

          // Check status
          if (row[statusCol] !== 'Active') {
            Logger.log(logPrefix + ' FAILED: User account is inactive. Status: ' + row[statusCol]);
            logAction(email, 'Authentication', 'Failed Login', 'Attempted login with inactive account', '', '', '');
            return {
              success: false,
              message: 'User account is inactive. Please contact administrator.',
              debugInfo: 'User status: ' + row[statusCol]
            };
          }

          const username = row[usernameCol];
          Logger.log(logPrefix + ' User authenticated successfully: ' + username);

          // Generate session ID and token
          const sessionId = generateSessionId();
          const token = generateAuthToken(email);

          // Store session in cache (valid for 8 hours)
          try {
            const cache = CacheService.getUserCache();
            cache.put(token, JSON.stringify({
              username: username,
              email: email,
              sessionId: sessionId,
              loginTime: new Date().getTime()
            }), 28800); // 8 hours in seconds
            Logger.log(logPrefix + ' Session cached successfully');
          } catch (cacheError) {
            Logger.log(logPrefix + ' WARNING: Could not cache session - ' + cacheError.message);
            // Continue anyway, just log the warning
          }

          // Log successful login
          logAudit(username, 'Authentication', 'Login', 'User logged in successfully with email: ' + email, sessionId, '', '');

          // Return user data
          const userData = {};
          headers.forEach((header, index) => {
            if (header !== 'PIN') { // Don't send PIN back
              userData[header] = row[index];
            }
          });

          const duration = new Date() - startTime;
          Logger.log(logPrefix + ' SUCCESS: Authentication completed in ' + duration + 'ms');

          return {
            success: true,
            user: userData,
            sessionId: sessionId,
            token: token
          };
        } else {
          Logger.log(logPrefix + ' FAILED: PIN does not match for user');
          logAction(email, 'Authentication', 'Failed Login', 'Incorrect PIN attempt for email: ' + email, '', '', '');
        }
      }
    }

    // User not found or wrong credentials
    if (emailMatch) {
      Logger.log(logPrefix + ' FAILED: Email found but PIN incorrect');
      return {
        success: false,
        message: 'Invalid PIN',
        debugInfo: 'Email found in database but PIN does not match'
      };
    } else {
      Logger.log(logPrefix + ' FAILED: Email not found in database');
      Logger.log(logPrefix + ' Checked ' + (data.length - 1) + ' users');
      return {
        success: false,
        message: 'Email not registered in system',
        debugInfo: 'Email not found among ' + (data.length - 1) + ' registered users',
        recommendation: 'Check your email address or contact administrator to create an account'
      };
    }

    } catch (error) {
      const duration = new Date() - startTime;
      Logger.log(logPrefix + ' EXCEPTION after ' + duration + 'ms: ' + error.message);
      Logger.log(logPrefix + ' Stack trace: ' + error.stack);
      try {
        logError('authenticate', error);
        logAction('SYSTEM', 'Authentication', 'Error', 'Authentication exception for email: ' + email + ' - ' + error.message, '', '', error.stack);
      } catch (e) {
        // Ignore audit logging errors
      }

      return {
        success: false,
        message: 'Authentication system error. Please try again or contact administrator.',
        debugInfo: 'Exception: ' + error.message,
        technicalDetails: error.stack,
        recommendation: 'Try running "🔍 Check System Health" from the Fatma System menu'
      };
    }
  } catch (fatalError) {
    // Ultimate fallback - ensure we ALWAYS return an object even if everything fails
    Logger.log('FATAL ERROR in authenticate: ' + (fatalError.message || 'Unknown error'));
    return {
      success: false,
      message: 'Critical authentication error. Please refresh the page and try again.',
      debugInfo: 'Fatal error: ' + (fatalError.message || 'Unknown error'),
      technicalDetails: fatalError.stack || 'No stack trace available',
      recommendation: 'Refresh the page and try again. If the problem persists, contact administrator.'
    };
  }
}

/**
 * Gets all active users (for login dropdown)
 */
function getUsers() {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // No users exist, create default admin
      createDefaultAdmin();
      return getUsers(); // Recursive call after creating admin
    }

    const headers = data[0];
    const users = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const user = {};

      headers.forEach((header, index) => {
        if (header !== 'PIN') { // Don't send PIN
          user[header] = row[index];
        }
      });

      users.push(user);
    }

    return users;

  } catch (error) {
    logError('getUsers', error);
    throw new Error('Error loading users: ' + error.message);
  }
}

/**
 * Adds a new user with PIN validation
 */
function addUser(userData) {
  try {
    // Validate PIN is 4 digits
    if (!userData.PIN || userData.PIN.toString().length !== CONFIG.PIN_LENGTH) {
      throw new Error('PIN must be exactly ' + CONFIG.PIN_LENGTH + ' digits');
    }

    // Validate PIN is numeric
    if (!/^\d{4}$/.test(userData.PIN.toString())) {
      throw new Error('PIN must contain only numbers');
    }

    const sheet = getSheet('Users');
    const userId = generateId('Users', 'User_ID', 'USR');

    const newUser = [
      userId,
      userData.Username || '',
      userData.PIN,
      userData.Role || 'User',
      userData.Email || '',
      userData.Phone || '',
      userData.Status || 'Active',
      new Date()
    ];

    sheet.appendRow(newUser);

    logAudit(
      userData.CreatedBy || 'SYSTEM',
      'Users',
      'Create',
      'New user created: ' + userData.Username,
      '',
      '',
      JSON.stringify(newUser)
    );

    return {
      success: true,
      userId: userId,
      message: 'User created successfully'
    };

  } catch (error) {
    logError('addUser', error);
    throw new Error('Error adding user: ' + error.message);
  }
}

/**
 * Updates user PIN with validation
 */
function updateUserPIN(username, oldPIN, newPIN) {
  try {
    // Validate new PIN is 4 digits
    if (!newPIN || newPIN.toString().length !== CONFIG.PIN_LENGTH) {
      throw new Error('New PIN must be exactly ' + CONFIG.PIN_LENGTH + ' digits');
    }

    // Validate new PIN is numeric
    if (!/^\d{4}$/.test(newPIN.toString())) {
      throw new Error('PIN must contain only numbers');
    }

    // Authenticate with old PIN first
    const authResult = authenticate(username, oldPIN);
    if (!authResult.success) {
      throw new Error('Current PIN is incorrect');
    }

    // Update PIN
    const updateResult = updateRowById('Users', 'Username', username, { PIN: newPIN });

    logAudit(
      username,
      'Users',
      'Update PIN',
      'User changed their PIN',
      '',
      'PIN changed',
      'PIN changed'
    );

    return {
      success: true,
      message: 'PIN updated successfully'
    };

  } catch (error) {
    logError('updateUserPIN', error);
    throw new Error('Error updating PIN: ' + error.message);
  }
}

/**
 * Creates default admin user if no users exist
 */
function createDefaultAdmin() {
  try {
    const sheet = getSheet('Users');
    const userId = generateId('Users', 'User_ID', 'USR');

    const userData = [
      userId,
      'Cabdisirlam', // Username derived from email
      '1234', // Default PIN
      'Admin',
      'cabdisirlam@gmail.com',
      '',
      'Active',
      new Date()
    ];

    sheet.appendRow(userData);

    Logger.log('Default admin user created. Email: cabdisirlam@gmail.com, PIN: 1234');

  } catch (error) {
    logError('createDefaultAdmin', error);
  }
}

/**
 * Generates a unique session ID
 */
function generateSessionId() {
  return 'SESSION_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generates an authentication token
 */
function generateAuthToken(username) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substr(2, 16);
  const hash = Utilities.base64Encode(username + ':' + timestamp + ':' + random);
  return 'TOKEN_' + hash.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Validates an authentication token
 */
function validateToken(token) {
  try {
    if (!token) {
      return { valid: false, message: 'No token provided' };
    }

    const cache = CacheService.getUserCache();
    const sessionData = cache.get(token);

    if (!sessionData) {
      return { valid: false, message: 'Token expired or invalid' };
    }

    const session = JSON.parse(sessionData);

    return {
      valid: true,
      username: session.username,
      sessionId: session.sessionId
    };
  } catch (error) {
    logError('validateToken', error);
    return { valid: false, message: 'Token validation error' };
  }
}

/**
 * Logs out a user by invalidating their token
 */
function logout(token) {
  try {
    const cache = CacheService.getUserCache();
    const sessionData = cache.get(token);

    if (sessionData) {
      const session = JSON.parse(sessionData);
      logAudit(session.username, 'Authentication', 'Logout', 'User logged out', session.sessionId, '', '');
    }

    cache.remove(token);

    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    logError('logout', error);
    return { success: false, message: 'Logout error: ' + error.message };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Generates a unique ID with prefix
 */
function generateId(sheetName, columnName, prefix) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const columnIndex = headers.indexOf(columnName);

    if (columnIndex === -1) {
      throw new Error('Column ' + columnName + ' not found in ' + sheetName);
    }

    let maxNumber = 0;

    // Find the highest existing number
    for (let i = 1; i < data.length; i++) {
      const id = data[i][columnIndex];
      if (id && typeof id === 'string' && id.startsWith(prefix + '-')) {
        const number = parseInt(id.split('-')[1]);
        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    }

    // Generate new ID
    const newNumber = maxNumber + 1;
    return prefix + '-' + String(newNumber).padStart(3, '0');

  } catch (error) {
    logError('generateId', error);
    throw new Error('Error generating ID: ' + error.message);
  }
}

/**
 * Gets current date/time formatted
 */
function getCurrentDateTime() {
  return new Date();
}

/**
 * Formats currency for display
 */
function formatCurrency(amount) {
  try {
    return 'KES ' + parseFloat(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (error) {
    return 'KES 0.00';
  }
}

/**
 * Converts sheet data to array of objects
 */
function sheetToObjects(sheetName, filters) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return []; // No data rows
    }

    const headers = data[0];
    const objects = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index];
      });

      // Apply filters if provided
      if (filters) {
        let matches = true;
        for (let key in filters) {
          if (obj[key] !== filters[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      objects.push(obj);
    }

    return objects;

  } catch (error) {
    logError('sheetToObjects', error);
    throw new Error('Error reading sheet data: ' + error.message);
  }
}

/**
 * Finds a row by ID
 */
function findRowById(sheetName, idColumn, idValue) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const columnIndex = headers.indexOf(idColumn);

    if (columnIndex === -1) {
      throw new Error('Column ' + idColumn + ' not found');
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][columnIndex] === idValue) {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = data[i][index];
        });
        obj._rowIndex = i + 1; // Store 1-based row index
        return obj;
      }
    }

    return null;

  } catch (error) {
    logError('findRowById', error);
    throw new Error('Error finding row: ' + error.message);
  }
}

/**
 * Updates a row by ID
 */
function updateRowById(sheetName, idColumn, idValue, updates) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf(idColumn);

    if (idColumnIndex === -1) {
      throw new Error('Column ' + idColumn + ' not found');
    }

    // Find row
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === idValue) {
        // Store before value for audit
        const beforeValue = JSON.stringify(data[i]);

        // Update columns
        for (let key in updates) {
          const columnIndex = headers.indexOf(key);
          if (columnIndex !== -1) {
            sheet.getRange(i + 1, columnIndex + 1).setValue(updates[key]);
          }
        }

        // Get after value
        const updatedRow = sheet.getRange(i + 1, 1, 1, headers.length).getValues()[0];
        const afterValue = JSON.stringify(updatedRow);

        return {
          success: true,
          rowIndex: i + 1,
          beforeValue: beforeValue,
          afterValue: afterValue
        };
      }
    }

    throw new Error('Row with ' + idColumn + ' = ' + idValue + ' not found');

  } catch (error) {
    logError('updateRowById', error);
    throw new Error('Error updating row: ' + error.message);
  }
}

/**
 * Gets a setting value
 */
function getSettingValue(key) {
  try {
    const sheet = getSheet('Settings');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }

    return null;

  } catch (error) {
    logError('getSettingValue', error);
    return null;
  }
}

/**
 * Sets a setting value
 */
function setSettingValue(key, value) {
  try {
    const sheet = getSheet('Settings');
    const data = sheet.getDataRange().getValues();

    // Look for existing key
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        return;
      }
    }

    // Key not found, add new row
    sheet.appendRow([key, value]);

  } catch (error) {
    logError('setSettingValue', error);
    throw new Error('Error setting value: ' + error.message);
  }
}

/**
 * Validates required fields
 */
function validateRequired(data, requiredFields) {
  const missing = [];

  requiredFields.forEach(field => {
    if (!data[field] || data[field] === '') {
      missing.push(field);
    }
  });

  if (missing.length > 0) {
    throw new Error('Missing required fields: ' + missing.join(', '));
  }
}

/**
 * Logs errors to console and audit trail
 */
function logError(functionName, error) {
  try {
    Logger.log('ERROR in ' + functionName + ': ' + error.message);
    Logger.log(error.stack);

    // Log to audit trail
    const sheet = getSheet('Audit_Trail');
    sheet.appendRow([
      new Date(),
      'SYSTEM',
      functionName,
      'ERROR',
      error.message,
      '',
      '',
      error.stack || ''
    ]);
  } catch (e) {
    Logger.log('Failed to log error: ' + e.message);
  }
}

/**
 * Logs audit trail - delegates to AuditLogger.gs
 */
function logAudit(user, module, action, details, sessionId, beforeValue, afterValue) {
  try {
    logAction(user, module, action, details, sessionId, beforeValue, afterValue);
  } catch (error) {
    Logger.log('Failed to log audit: ' + error.message);
  }
}

// =====================================================
// DASHBOARD DATA
// =====================================================

/**
 * Gets dashboard summary data
 */
function getDashboardData() {
  try {
    const data = {
      cashBalance: getAccountBalance('Cash'),
      mpesaBalance: getAccountBalance('MPESA'),
      bankBalance: getAccountBalance('Equity Bank'),
      todaySales: getTodaySales(),
      customerDebt: getTotalCustomerDebt(),
      supplierDebt: getTotalSupplierDebt(),
      lowStockCount: getLowStockCount(),
      todayExpenses: getTodayExpenses(),
      recentSales: getRecentSales(10)
    };

    return data;

  } catch (error) {
    logError('getDashboardData', error);
    throw new Error('Error loading dashboard: ' + error.message);
  }
}

/**
 * Gets today's sales total
 */
function getTodaySales() {
  try {
    const sheet = getSheet('Sales_Data');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const dateCol = headers.indexOf('DateTime');
    const totalCol = headers.indexOf('Grand_Total');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      const saleDate = new Date(data[i][dateCol]);
      saleDate.setHours(0, 0, 0, 0);

      if (saleDate.getTime() === today.getTime()) {
        total += parseFloat(data[i][totalCol]) || 0;
      }
    }

    return total;

  } catch (error) {
    logError('getTodaySales', error);
    return 0;
  }
}

/**
 * Gets total customer debt
 */
function getTotalCustomerDebt() {
  try {
    const sheet = getSheet('Customers');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const balanceCol = headers.indexOf('Current_Balance');

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      total += parseFloat(data[i][balanceCol]) || 0;
    }

    return total;

  } catch (error) {
    logError('getTotalCustomerDebt', error);
    return 0;
  }
}

/**
 * Gets total supplier debt
 */
function getTotalSupplierDebt() {
  try {
    const sheet = getSheet('Suppliers');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const balanceCol = headers.indexOf('Current_Balance');

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      total += parseFloat(data[i][balanceCol]) || 0;
    }

    return total;

  } catch (error) {
    logError('getTotalSupplierDebt', error);
    return 0;
  }
}

/**
 * Gets count of low stock items
 */
function getLowStockCount() {
  try {
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const qtyCol = headers.indexOf('Current_Qty');
    const reorderCol = headers.indexOf('Reorder_Level');

    let count = 0;

    for (let i = 1; i < data.length; i++) {
      const qty = parseFloat(data[i][qtyCol]) || 0;
      const reorder = parseFloat(data[i][reorderCol]) || 0;

      if (qty <= reorder) {
        count++;
      }
    }

    return count;

  } catch (error) {
    logError('getLowStockCount', error);
    return 0;
  }
}

/**
 * Gets today's expenses total
 */
function getTodayExpenses() {
  try {
    const sheet = getSheet('Expenses');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const dateCol = headers.indexOf('Date');
    const amountCol = headers.indexOf('Amount');
    const statusCol = headers.indexOf('Status');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      const expenseDate = new Date(data[i][dateCol]);
      expenseDate.setHours(0, 0, 0, 0);

      if (expenseDate.getTime() === today.getTime() && data[i][statusCol] === 'Approved') {
        total += parseFloat(data[i][amountCol]) || 0;
      }
    }

    return total;

  } catch (error) {
    logError('getTodayExpenses', error);
    return 0;
  }
}

/**
 * Gets recent sales
 */
function getRecentSales(limit) {
  try {
    const sales = sheetToObjects('Sales_Data', null);

    // Sort by date descending
    sales.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    // Return limited results
    return sales.slice(0, limit || 10);

  } catch (error) {
    logError('getRecentSales', error);
    return [];
  }
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initializes all sheets with headers (run once during setup)
 * Delegates to WorkbookManager for comprehensive setup
 */
function initializeSheets() {
  // Call the comprehensive sheet setup from WorkbookManager
  initializeAllSheets();

  // Create default admin if no users exist
  createDefaultAdmin();

  // Initialize default expense categories
  initializeExpenseCategories();

  // Initialize account balances
  initializeAccounts();

  Logger.log('All sheets initialized successfully!');
}

/**
 * Initializes default expense categories
 */
function initializeExpenseCategories() {
  try {
    const sheet = getSheet('Expense_Categories');
    const data = sheet.getDataRange().getValues();

    if (data.length > 1) return; // Already have categories

    const categories = [
      ['CAT-001', 'Rent', 0, 'Active'],
      ['CAT-002', 'Utilities', 0, 'Active'],
      ['CAT-003', 'Salaries', 0, 'Active'],
      ['CAT-004', 'Transport', 0, 'Active'],
      ['CAT-005', 'Marketing', 0, 'Active'],
      ['CAT-006', 'Supplies', 0, 'Active'],
      ['CAT-007', 'Maintenance', 0, 'Active'],
      ['CAT-008', 'Other', 0, 'Active']
    ];

    categories.forEach(cat => sheet.appendRow(cat));

  } catch (error) {
    logError('initializeExpenseCategories', error);
  }
}

/**
 * Initializes account balances in Financials
 */
function initializeAccounts() {
  try {
    const sheet = getSheet('Financials');
    const data = sheet.getDataRange().getValues();

    if (data.length > 1) return; // Already have transactions

    // Initialize with zero balances
    const accounts = ['Cash', 'MPESA', 'Equity Bank'];
    accounts.forEach(account => {
      sheet.appendRow([
        new Date(),
        'INIT-001',
        'Opening Balance',
        account,
        'Initial account setup',
        0,
        0,
        0,
        'SYSTEM',
        'INITIALIZATION'
      ]);
    });

  } catch (error) {
    logError('initializeAccounts', error);
  }
}
