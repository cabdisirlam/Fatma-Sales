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

    return HtmlService.createHtmlOutputFromFile(htmlFile)
      .setTitle(title)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      
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
  const SPREADSHEET_ID = '1m_IHBaz4PJZOo2sy5w4s27XQilQqGsFveMDRWt7tP-w';
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

function authenticate(email, pin) {
    try {
        if (!email || !pin) return { success: false, message: 'Email and PIN are required.' };

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
                return { success: false, message: 'Invalid PIN.' };
            }
        }
        return { success: false, message: 'Email not registered.' };
    } catch (error) {
        logError('authenticate', error);
        return { success: false, message: 'Authentication system error: ' + error.message };
    }
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

function generateId(sheetName, columnName, prefix) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const columnIndex = headers.indexOf(columnName);

    if (columnIndex === -1) throw new Error(`Column '${columnName}' not found in '${sheetName}'`);

    let maxNumber = 0;
    for (let i = 1; i < data.length; i++) {
      const id = data[i][columnIndex];
      if (id && typeof id === 'string' && id.startsWith(prefix + '-')) {
        const number = parseInt(id.split('-')[1], 10);
        if (number > maxNumber) maxNumber = number;
      }
    }
    return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
  } catch (error) {
    logError('generateId', error);
    throw error;
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
