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
  try {
    const activeSS = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSS) return activeSS;

    const scriptProperties = PropertiesService.getScriptProperties();
    let spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

    if (!spreadsheetId) {
      spreadsheetId = '1m_IHBaz4PJZOo2sy5w4s27XQilQqGsFveMDRWt7tP-w'; // Fallback ID
      scriptProperties.setProperty('SPREADSHEET_ID', spreadsheetId);
    }

    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    logError('getSpreadsheet', error);
    throw new Error('Cannot access spreadsheet. Check permissions and configuration.');
  }
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = createSheet(sheetName);
  }
  return sheet;
}

function createSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.insertSheet(sheetName);
  const headers = getSheetHeaders(sheetName);
  if (headers && headers.length > 0) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetHeaders(sheetName) {
  const headerMap = {
    'Users': ['User_ID', 'Username', 'PIN', 'Role', 'Email', 'Phone', 'Status', 'Created_Date'],
    'Suppliers': ['Supplier_ID', 'Supplier_Name', 'Contact_Person', 'Phone', 'Email', 'Address', 'Opening_Balance', 'Total_Purchased', 'Total_Paid', 'Current_Balance', 'Payment_Terms', 'Status'],
    'Customers': ['Customer_ID', 'Customer_Name', 'Phone', 'Email', 'Location', 'KRA_PIN', 'Customer_Type', 'Credit_Limit', 'Current_Balance', 'Total_Purchases', 'Last_Purchase_Date', 'Loyalty_Points', 'Status', 'Created_Date', 'Created_By'],
    'Inventory': ['Item_ID', 'Item_Name', 'Category', 'Cost_Price', 'Selling_Price', 'Current_Qty', 'Reorder_Level', 'Supplier', 'Last_Updated', 'Updated_By'],
    'Sales': ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Customer_Name', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total', 'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total', 'Payment_Mode', 'Sold_By', 'Location', 'KRA_PIN', 'Status', 'Valid_Until', 'Converted_Sale_ID'],
    'Purchases': ['Purchase_ID', 'Date', 'Supplier_ID', 'Supplier_Name', 'Item_ID', 'Item_Name', 'Qty', 'Cost_Price', 'Line_Total', 'Total_Amount', 'Payment_Status', 'Payment_Method', 'Paid_Amount', 'Balance', 'Recorded_By'],
    'Financials': ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Category', 'Account', 'Description', 'Amount', 'Debit', 'Credit', 'Balance', 'Payment_Method', 'Payee', 'Receipt_No', 'Reference', 'Status', 'Approved_By', 'User'],
    'Audit_Trail': ['Timestamp', 'User', 'Module', 'Action', 'Details', 'Session_ID', 'Before_Value', 'After_Value'],
    'Settings': ['Setting_Key', 'Setting_Value']
  };
  return headerMap[sheetName] || [];
}


// =====================================================
// AUTHENTICATION
// =====================================================
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
                    headers.forEach((h, j) => { if (h !== 'PIN') user[h] = row[j]; });
                    return { success: true, user };
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
      headers.forEach((h, i) => { if (h !== 'PIN') user[h] = row[i]; });
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
