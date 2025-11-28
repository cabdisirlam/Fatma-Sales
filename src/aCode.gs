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
 * Currently supports:
 * - Webhook endpoints for payment gateways (MPESA, etc.)
 * - External API callbacks
 * - Third-party service integrations
 */
function doPost(e) {
  try {
    // Log the incoming request for debugging
    Logger.log('doPost received: ' + JSON.stringify(e));

    // Parse request parameters
    const params = e.parameter || {};
    const postData = e.postData ? JSON.parse(e.postData.contents) : {};

    // Determine the type of request and route accordingly
    const requestType = params.type || postData.type || 'unknown';

    // Log the request to audit trail
    logAudit(
      'EXTERNAL_API',
      'Webhook',
      'POST Request',
      'Received POST request of type: ' + requestType,
      '',
      '',
      JSON.stringify({ params: params, data: postData })
    );

    // Return a success response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Request received',
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    logError('doPost', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Gets the main spreadsheet
 * CRITICAL: This function must work in both bound script and web app contexts
 */
function getSpreadsheet() {
  try {
    // ALWAYS try to use the active spreadsheet first
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      return activeSpreadsheet;
    }

    // Strategy 2: Try to use explicitly configured SPREADSHEET_ID from Script Properties
    const scriptProperties = PropertiesService.getScriptProperties();
    let spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

    // Strategy 3: If not in Script Properties, try hardcoded ID (for web app deployment)
    if (!spreadsheetId) {
      // IMPORTANT: Set this to your actual spreadsheet ID
      // You can find this in the URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
      spreadsheetId = '1m_IHBaz4PJZOo2sy5w4s27XQilQqGsFveMDRWt7tP-w';

      // Save it to Script Properties for future use
      try {
        scriptProperties.setProperty('SPREADSHEET_ID', spreadsheetId);
        Logger.log('Saved SPREADSHEET_ID to Script Properties: ' + spreadsheetId);
      } catch (e) {
        Logger.log('Could not save SPREADSHEET_ID to Script Properties: ' + e.message);
      }
    }

    // Strategy 4: Try to open by ID
    if (spreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        Logger.log('Successfully opened spreadsheet by ID: ' + spreadsheetId);
        return ss;
      } catch (e) {
        Logger.log('Cannot open spreadsheet by ID: ' + spreadsheetId + ' - Error: ' + e.message);
        // Don't throw yet, try fallback
      }
    }

    // If we got here, we couldn't access the spreadsheet
    throw new Error('SPREADSHEET_NOT_CONFIGURED: Cannot access spreadsheet. Please configure SPREADSHEET_ID in Script Properties or update the hardcoded ID in getSpreadsheet() function.');
  } catch (error) {
    // Enhanced error message for debugging
    const errorMsg = error.message || error.toString();
    Logger.log('FATAL: getSpreadsheet failed - ' + errorMsg);

    if (errorMsg.indexOf('SPREADSHEET_NOT_CONFIGURED') !== -1) {
      throw error; // Re-throw with our custom message
    }

    throw new Error('Cannot access spreadsheet: ' + errorMsg + '. Check permissions and configuration.');
  }
}

/**
 * Verifies that the spreadsheet is accessible and properly configured
 * Returns diagnostic information for debugging
 */
function verifySpreadsheetConfiguration() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  try {
    // Check 1: Script Properties
    diagnostics.checks.push({ name: 'Script Properties Access', status: 'CHECKING' });
    const scriptProperties = PropertiesService.getScriptProperties();
    const storedId = scriptProperties.getProperty('SPREADSHEET_ID');
    diagnostics.checks[0].status = 'OK';
    diagnostics.checks[0].details = 'Stored ID: ' + (storedId || 'NOT SET');

    // Check 2: Spreadsheet Access
    diagnostics.checks.push({ name: 'Spreadsheet Access', status: 'CHECKING' });
    const ss = getSpreadsheet();
    diagnostics.checks[1].status = 'OK';
    diagnostics.checks[1].details = 'Name: ' + ss.getName() + ', ID: ' + ss.getId();

    // Check 3: Users Sheet
    diagnostics.checks.push({ name: 'Users Sheet', status: 'CHECKING' });
    const usersSheet = ss.getSheetByName('Users');
    if (usersSheet) {
      const data = usersSheet.getDataRange().getValues();
      diagnostics.checks[2].status = 'OK';
      diagnostics.checks[2].details = 'Rows: ' + data.length + ', Users: ' + (data.length - 1);
    } else {
      diagnostics.checks[2].status = 'WARNING';
      diagnostics.checks[2].details = 'Users sheet not found - needs initialization';
    }

    diagnostics.overall = 'SUCCESS';
    diagnostics.message = 'Spreadsheet is properly configured and accessible';

    return diagnostics;

  } catch (error) {
    diagnostics.overall = 'FAILED';
    diagnostics.message = 'Configuration error: ' + error.message;
    diagnostics.error = error.toString();
    diagnostics.stack = error.stack;
    return diagnostics;
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
 * Updated for new 9-sheet reorganized structure
 */
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

/**
 * Authenticates a user with email and PIN
 * Enhanced with comprehensive error logging and diagnostics
 * CRITICAL: This function MUST always return an object with a 'success' property
 */
function authenticate(email, pin) {
  // First, verify that the function is executing and can return a response
  if (!email && !pin) {
    // Quick test to verify Google Apps Script can respond
    return {
      success: false,
      message: 'Email and PIN are required',
      debugInfo: 'Function executing, no credentials provided',
      timestamp: new Date().toISOString()
    };
  }

  // Wrap everything in try-catch to ensure we ALWAYS return a result object
  try {
    const startTime = new Date();
    const logPrefix = '[AUTH ' + startTime.toISOString() + ']';

    try {
      Logger.log(logPrefix + ' Authentication attempt started');
      Logger.log(logPrefix + ' Email: ' + email);

      // CRITICAL: Verify spreadsheet is accessible FIRST before proceeding
      Logger.log(logPrefix + ' Verifying spreadsheet configuration...');
      try {
        const diagnostics = verifySpreadsheetConfiguration();
        Logger.log(logPrefix + ' Spreadsheet verification: ' + diagnostics.overall);

        if (diagnostics.overall === 'FAILED') {
          Logger.log(logPrefix + ' FAILED: Spreadsheet not accessible');
          return {
            success: false,
            message: 'System configuration error: Cannot access spreadsheet',
            debugInfo: diagnostics.message,
            technicalDetails: JSON.stringify(diagnostics, null, 2),
            recommendation: 'The spreadsheet ID may not be configured correctly. Check that the SPREADSHEET_ID in aCode.gs matches your actual spreadsheet ID.',
            timestamp: new Date().toISOString()
          };
        }

        Logger.log(logPrefix + ' Spreadsheet accessible: ' + diagnostics.checks[1].details);
      } catch (verifyError) {
        Logger.log(logPrefix + ' WARNING: Could not verify spreadsheet: ' + verifyError.message);
        // Continue anyway, but this might be the root cause
      }

      // Validate inputs are provided
      if (!email || !pin) {
        Logger.log(logPrefix + ' Missing credentials');
        return {
          success: false,
          message: 'Email and PIN are required',
          debugInfo: 'Missing email or PIN',
          timestamp: new Date().toISOString()
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
          debugInfo: 'PIN validation failed',
          recommendation: 'Please enter a valid ' + pinLength + '-digit PIN',
          timestamp: new Date().toISOString()
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
      try {
        logError('authenticate - getSheet', sheetError);
      } catch (e) {
        // Ignore logging errors
      }

      // Determine if this is likely an OAuth/permission issue
      const isOAuthError = sheetError.message && (
        sheetError.message.indexOf('permission') !== -1 ||
        sheetError.message.indexOf('authorization') !== -1 ||
        sheetError.message.indexOf('Cannot access') !== -1
      );

      return {
        success: false,
        message: isOAuthError ?
          'Authorization required: Cannot access spreadsheet. Please check permissions.' :
          'System configuration error: Cannot access Users sheet.',
        debugInfo: 'Users sheet not accessible: ' + sheetError.message,
        technicalDetails: sheetError.stack,
        recommendation: isOAuthError ?
          'Try opening the spreadsheet directly and running any menu command to grant permissions, then try logging in again.' :
          'Contact administrator to check system configuration.',
        timestamp: new Date().toISOString()
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
      try {
        logError('authenticate - getData', readError);
      } catch (e) {
        // Ignore logging errors
      }
      return {
        success: false,
        message: 'System error: Cannot read user data. Please contact administrator.',
        debugInfo: 'Data read failed: ' + readError.message,
        technicalDetails: readError.stack,
        timestamp: new Date().toISOString()
      };
    }

    // Check if sheet has headers
    if (data.length < 1) {
      Logger.log(logPrefix + ' FAILED: Users sheet is empty (no headers)');
      try {
        logAction('SYSTEM', 'Authentication', 'Failed Login', 'Users sheet is empty - no headers found', '', '', '');
      } catch (e) {
        // Ignore logging errors
      }
      return {
        success: false,
        message: 'System not initialized: No user data found. Please run "Setup Fatma System" from the menu.',
        debugInfo: 'Users sheet has no data',
        recommendation: 'Run "🏪 Fatma System" > "⚡ Setup Fatma System" from the spreadsheet menu',
        timestamp: new Date().toISOString()
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
        recommendation: 'Run "🏪 Fatma System" > "⚡ Setup Fatma System" from the spreadsheet menu',
        timestamp: new Date().toISOString()
      };
    }

    Logger.log(logPrefix + ' All required columns found');
    Logger.log(logPrefix + ' Searching for user with email: ' + email);
    Logger.log(logPrefix + ' Total users in database: ' + (data.length - 1));

    // Check if there are any users
    if (data.length <= 1) {
      Logger.log(logPrefix + ' FAILED: No users in database');
      try {
        logAction('SYSTEM', 'Authentication', 'Failed Login', 'No users found in system for email: ' + email, '', '', '');
      } catch (e) {
        // Ignore logging errors
      }
      return {
        success: false,
        message: 'No users found in system. Please run "Setup Fatma System" to create the default admin user.',
        debugInfo: 'Users sheet has headers but no data rows',
        recommendation: 'Run "🏪 Fatma System" > "⚡ Setup Fatma System" from the spreadsheet menu',
        timestamp: new Date().toISOString()
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

        // Check PIN - handle both string and number types, trim whitespace
        const storedPin = row[pinCol] ? row[pinCol].toString().trim() : '';
        const enteredPin = pin ? pin.toString().trim() : '';

        Logger.log(logPrefix + ' Comparing PINs - Stored: "' + storedPin + '" (length: ' + storedPin.length + ', type: ' + typeof row[pinCol] + '), Entered: "' + enteredPin + '" (length: ' + enteredPin.length + ')');

        if (storedPin === enteredPin) {
          Logger.log(logPrefix + ' PIN matches');

          // Check status
          if (row[statusCol] !== 'Active') {
            Logger.log(logPrefix + ' FAILED: User account is inactive. Status: ' + row[statusCol]);
            try {
              logAction(email, 'Authentication', 'Failed Login', 'Attempted login with inactive account', '', '', '');
            } catch (e) {
              // Ignore logging errors
            }
            return {
              success: false,
              message: 'User account is inactive. Please contact administrator.',
              debugInfo: 'User status: ' + row[statusCol],
              timestamp: new Date().toISOString()
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

          // Return user data - ensure all values are serializable
          const userData = {};
          headers.forEach((header, index) => {
            if (header !== 'PIN') { // Don't send PIN back
              const value = row[index];
              // Convert dates to ISO strings, ensure all values are properly serializable
              if (value instanceof Date) {
                userData[header] = value.toISOString();
              } else if (value === null || value === undefined) {
                userData[header] = '';
              } else {
                userData[header] = value;
              }
            }
          });

          const duration = new Date() - startTime;
          Logger.log(logPrefix + ' SUCCESS: Authentication completed in ' + duration + 'ms');
          Logger.log(logPrefix + ' Returning user data: ' + JSON.stringify(userData));

          const result = {
            success: true,
            user: userData,
            sessionId: sessionId,
            token: token,
            timestamp: new Date().toISOString()
          };

          Logger.log(logPrefix + ' Final result object: ' + JSON.stringify(result));
          return result;
        } else {
          Logger.log(logPrefix + ' FAILED: PIN does not match for user');
          Logger.log(logPrefix + ' Expected PIN: "' + storedPin + '", Got PIN: "' + enteredPin + '"');
          try {
            logAction(email, 'Authentication', 'Failed Login', 'Incorrect PIN attempt for email: ' + email + ' (expected: ' + storedPin.length + ' chars, got: ' + enteredPin.length + ' chars)', '', '', '');
          } catch (e) {
            // Ignore logging errors
          }
          // Return immediately to prevent continuing loop
          return {
            success: false,
            message: 'Invalid PIN',
            debugInfo: 'Email found but PIN does not match. Expected length: ' + storedPin.length + ', Got length: ' + enteredPin.length,
            timestamp: new Date().toISOString()
          };
        }
      }
    }

    // User not found or wrong credentials
    if (emailMatch) {
      Logger.log(logPrefix + ' FAILED: Email found but PIN incorrect');
      return {
        success: false,
        message: 'Invalid PIN',
        debugInfo: 'Email found in database but PIN does not match',
        timestamp: new Date().toISOString()
      };
    } else {
      Logger.log(logPrefix + ' FAILED: Email not found in database');
      Logger.log(logPrefix + ' Checked ' + (data.length - 1) + ' users');
      return {
        success: false,
        message: 'Email not registered in system',
        debugInfo: 'Email not found among ' + (data.length - 1) + ' registered users',
        recommendation: 'Check your email address or contact administrator to create an account',
        timestamp: new Date().toISOString()
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
        recommendation: 'Try running "🔍 Check System Health" from the Fatma System menu',
        timestamp: new Date().toISOString()
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
      recommendation: 'Refresh the page and try again. If the problem persists, contact administrator.',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Returns the dashboard HTML content
 */
function getDashboardHTML() {
  try {
    return HtmlService.createHtmlOutputFromFile('mDashboard').getContent();
  } catch (error) {
    Logger.log('Error loading dashboard: ' + error.message);
    return '<html><body><h2>Error loading dashboard</h2><p>' + error.message + '</p></body></html>';
  }
}

/**
 * Gets all users (excluding PIN for security in the list view), including their creation date.
 */
function getUsers() {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();

    // If only headers exist, return empty list
    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const users = [];

    // Map headers to find column indexes dynamically
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Only push if User_ID exists to avoid empty rows
      if (row[colMap['User_ID']]) {

        // Handle Created_Date safely
        const createdDateRaw = row[colMap['Created_Date']];
        let createdDate = '';
        if (createdDateRaw) {
          const parsedDate = new Date(createdDateRaw);
          if (!isNaN(parsedDate)) {
            createdDate = parsedDate.toISOString(); // Convert to string for safe transfer
          }
        }

        users.push({
          User_ID: row[colMap['User_ID']],
          Username: row[colMap['Username']],
          Role: row[colMap['Role']],
          Email: row[colMap['Email']],
          Phone: row[colMap['Phone']],
          Status: row[colMap['Status']],
          Created_Date: createdDate
        });
      }
    }

    return users;

  } catch (error) {
    Logger.log('getUsers Error: ' + error.message);
    throw new Error('Error loading users: ' + error.message);
  }
}

/**
 * Adds a new user with the specific headers provided
 */
function addUser(userData) {
  try {
    // Validate PIN
    if (!userData.PIN || userData.PIN.toString().length !== 4) {
      throw new Error('PIN must be exactly 4 digits');
    }

    const sheet = getSheet('Users');
    const userId = generateId('Users', 'User_ID', 'USR'); // Ensure generateId exists in your utilities
    
    // Map data exactly to your headers: 
    // User_ID, Username, PIN, Role, Email, Phone, Status, Created_Date
    const newUser = [
      userId,
      userData.Username,
      userData.PIN,
      userData.Role,
      userData.Email,
      userData.Phone || '',
      userData.Status || 'Active',
      new Date()
    ];

    sheet.appendRow(newUser);

    return {
      success: true,
      message: 'User created successfully',
      userId: userId
    };
  } catch (error) {
    Logger.log('addUser Error: ' + error.message);
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
 * Updates user information (for admin)
 */
function updateUser(userData) {
  try {
    if (!userData.User_ID && !userData.Email) {
      throw new Error('User ID or Email is required to update user');
    }

    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find user row
    let userRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      const emailIndex = headers.indexOf('Email');
      const userIdIndex = headers.indexOf('User_ID');

      if ((userData.Email && data[i][emailIndex] === userData.Email) ||
          (userData.User_ID && data[i][userIdIndex] === userData.User_ID)) {
        userRowIndex = i;
        break;
      }
    }

    if (userRowIndex === -1) {
      throw new Error('User not found');
    }

    // Get old values for audit
    const oldValues = {};
    headers.forEach((header, index) => {
      oldValues[header] = data[userRowIndex][index];
    });

    // Update fields (preserve PIN and User_ID, Created_Date)
    const updateData = [];
    headers.forEach((header, index) => {
      if (header === 'PIN' || header === 'User_ID' || header === 'Created_Date') {
        updateData.push(data[userRowIndex][index]); // Keep original
      } else if (userData[header] !== undefined) {
        updateData.push(userData[header]); // Update with new value
      } else {
        updateData.push(data[userRowIndex][index]); // Keep original
      }
    });

    // Write updated row
    const range = sheet.getRange(userRowIndex + 1, 1, 1, headers.length);
    range.setValues([updateData]);

    logAudit(
      Session.getActiveUser().getEmail() || 'ADMIN',
      'Users',
      'Update',
      'User updated: ' + userData.Username,
      JSON.stringify(oldValues),
      JSON.stringify(userData),
      ''
    );

    return {
      success: true,
      message: 'User updated successfully'
    };

  } catch (error) {
    logError('updateUser', error);
    throw new Error('Error updating user: ' + error.message);
  }
}

/**
 * Deletes a user (admin only)
 */
function deleteUser(email) {
  try {
    if (!email) {
      throw new Error('Email is required to delete user');
    }

    // Don't allow deleting the default admin
    if (email === 'cabdisirlam@gmail.com') {
      throw new Error('Cannot delete the default admin account');
    }

    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    // Find user row
    let userRowIndex = -1;
    let userData = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === email) {
        userRowIndex = i;
        userData = data[i];
        break;
      }
    }

    if (userRowIndex === -1) {
      throw new Error('User not found');
    }

    // Delete the row
    sheet.deleteRow(userRowIndex + 1);

    logAudit(
      Session.getActiveUser().getEmail() || 'ADMIN',
      'Users',
      'Delete',
      'User deleted: ' + email,
      JSON.stringify(userData),
      '',
      ''
    );

    return {
      success: true,
      message: 'User deleted successfully'
    };

  } catch (error) {
    logError('deleteUser', error);
    throw new Error('Error deleting user: ' + error.message);
  }
}

/**
 * Resets user PIN (admin only, no old PIN required)
 */
function resetUserPin(email, newPin) {
  try {
    // Validate new PIN is 4 digits
    if (!newPin || newPin.toString().length !== CONFIG.PIN_LENGTH) {
      throw new Error('New PIN must be exactly ' + CONFIG.PIN_LENGTH + ' digits');
    }

    // Validate new PIN is numeric
    if (!/^\d{4}$/.test(newPin.toString())) {
      throw new Error('PIN must contain only numbers');
    }

    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');
    const pinIndex = headers.indexOf('PIN');

    // Find user row
    let userRowIndex = -1;
    let username = '';
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === email) {
        userRowIndex = i;
        username = data[i][headers.indexOf('Username')];
        break;
      }
    }

    if (userRowIndex === -1) {
      throw new Error('User not found');
    }

    // Update PIN
    sheet.getRange(userRowIndex + 1, pinIndex + 1).setValue(newPin);

    logAudit(
      Session.getActiveUser().getEmail() || 'ADMIN',
      'Users',
      'Reset PIN',
      'Admin reset PIN for user: ' + username,
      '',
      'PIN changed',
      ''
    );

    return {
      success: true,
      message: 'PIN reset successfully'
    };

  } catch (error) {
    logError('resetUserPin', error);
    throw new Error('Error resetting PIN: ' + error.message);
  }
}

/**
 * Creates default admin users if no users exist
 */
function createDefaultAdmin() {
  try {
    const sheet = getSheet('Users');

    // Create Cabdisirlam admin user
    const userId1 = generateId('Users', 'User_ID', 'USR');
    const userData1 = [
      userId1,
      'Cabdisirlam', // Username derived from email
      '2020', // Default PIN
      'Admin',
      'cabdisirlam@gmail.com',
      '',
      'Active',
      new Date()
    ];
    sheet.appendRow(userData1);
    Logger.log('Default admin user created. Email: cabdisirlam@gmail.com, PIN: 2020');

    // Create generic Admin user
    const userId2 = generateId('Users', 'User_ID', 'USR');
    const userData2 = [
      userId2,
      'Admin', // Generic admin username
      '1234', // Default PIN
      'Admin',
      'admin@fatma.com',
      '',
      'Active',
      new Date()
    ];
    sheet.appendRow(userData2);
    Logger.log('Admin user created. Email: admin@fatma.com, PIN: 1234');

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

/**
 * Simple test function to verify Google Apps Script is responding
 * This is the most basic test - if this returns null, there's a fundamental connection issue
 */
function testConnection() {
  try {
    const result = {
      success: true,
      message: 'Google Apps Script is responding',
      timestamp: new Date().toISOString(),
      test: 'ping',
      spreadsheetId: getSpreadsheet().getId(),
      spreadsheetName: getSpreadsheet().getName()
    };
    Logger.log('testConnection result: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    Logger.log('testConnection ERROR: ' + error.message);
    return {
      success: false,
      message: 'Error: ' + error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test authentication with debugging
 */
function testAuth(email, pin) {
  Logger.log('===== TEST AUTH START =====');
  Logger.log('Email: ' + email);
  Logger.log('PIN length: ' + (pin ? pin.toString().length : 0));

  try {
    const result = authenticate(email, pin);
    Logger.log('Authentication result: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    Logger.log('Authentication ERROR: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: 'Error: ' + error.message,
      stack: error.stack
    };
  }
}

/**
 * Comprehensive system health check
 * Tests all critical system components
 */
function checkSystemHealth() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Basic execution
  results.tests.push({
    name: 'Script Execution',
    status: 'OK',
    message: 'Google Apps Script is executing'
  });

  // Test 2: Spreadsheet configuration
  try {
    const diagnostics = verifySpreadsheetConfiguration();
    results.tests.push({
      name: 'Spreadsheet Access',
      status: diagnostics.overall === 'SUCCESS' ? 'OK' : 'FAILED',
      message: diagnostics.message,
      details: diagnostics
    });
  } catch (error) {
    results.tests.push({
      name: 'Spreadsheet Access',
      status: 'FAILED',
      message: error.message,
      error: error.toString()
    });
  }

  // Test 3: Users sheet
  try {
    const users = getUsers();
    results.tests.push({
      name: 'Users Data',
      status: 'OK',
      message: 'Found ' + users.length + ' users',
      userCount: users.length
    });
  } catch (error) {
    results.tests.push({
      name: 'Users Data',
      status: 'FAILED',
      message: error.message,
      error: error.toString()
    });
  }

  // Determine overall status
  const failedTests = results.tests.filter(t => t.status === 'FAILED');
  results.overall = failedTests.length === 0 ? 'HEALTHY' : 'UNHEALTHY';
  results.summary = failedTests.length === 0 ?
    'All systems operational' :
    failedTests.length + ' test(s) failed';

  return results;
}

/**
 * Checks OAuth authorization status
 * This function is used to verify that OAuth permissions are properly granted
 * Returns a simple object to confirm the system is accessible
 */
function checkOAuthStatus() {
  try {
    // Try to access basic services to verify OAuth is working
    const ss = getSpreadsheet();
    const ssName = ss.getName();
    const ssId = ss.getId();

    return {
      success: true,
      authorized: true,
      spreadsheetName: ssName,
      spreadsheetId: ssId,
      message: 'OAuth permissions are properly granted'
    };
  } catch (error) {
    Logger.log('OAuth check failed: ' + error.message);
    return {
      success: false,
      authorized: false,
      message: 'OAuth authorization required',
      error: error.message,
      recommendation: 'Please check your permissions and try again.'
    };
  }
}

/**
 * Diagnostic function to check user data in the spreadsheet
 * This helps troubleshoot login issues by showing exactly what's stored
 */
function checkUserData(email) {
  try {
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: false,
        message: 'No users found in the system',
        totalUsers: 0
      };
    }

    const headers = data[0];
    const emailCol = headers.indexOf('Email');
    const usernameCol = headers.indexOf('Username');
    const pinCol = headers.indexOf('PIN');
    const statusCol = headers.indexOf('Status');
    const roleCol = headers.indexOf('Role');

    // Find user by email
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[emailCol] && row[emailCol].toLowerCase() === email.toLowerCase()) {
        return {
          success: true,
          found: true,
          user: {
            email: row[emailCol],
            username: row[usernameCol],
            pinLength: row[pinCol] ? row[pinCol].toString().length : 0,
            pinType: typeof row[pinCol],
            status: row[statusCol],
            role: row[roleCol]
          },
          message: 'User found',
          headers: headers,
          rowNumber: i + 1
        };
      }
    }

    return {
      success: true,
      found: false,
      message: 'User with email ' + email + ' not found',
      totalUsers: data.length - 1,
      availableEmails: data.slice(1).map(row => row[emailCol]).filter(e => e)
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Error checking user data'
    };
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
 * Fixed to properly handle numeric 0 values
 */
function validateRequired(data, requiredFields) {
  const missing = [];

  requiredFields.forEach(field => {
    // Check if field is missing or empty string, but allow 0 (zero) as valid value
    if (data[field] === undefined || data[field] === null || data[field] === '') {
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
 * Updated for new Sales sheet structure (line items)
 */
function getTodaySales() {
  try {
    const sheet = getSheet('Sales');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const dateCol = headers.indexOf('DateTime');
    const totalCol = headers.indexOf('Grand_Total');
    const transIdCol = headers.indexOf('Transaction_ID');
    const typeCol = headers.indexOf('Type');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;
    const processedIds = new Set(); // Track unique transactions to avoid double counting

    for (let i = 1; i < data.length; i++) {
      const transId = data[i][transIdCol];
      const transType = data[i][typeCol];

      // Only count Sales (not Quotations) and only once per transaction ID
      if (transType === 'Sale' && !processedIds.has(transId)) {
        const saleDate = new Date(data[i][dateCol]);
        saleDate.setHours(0, 0, 0, 0);

        if (saleDate.getTime() === today.getTime()) {
          total += parseFloat(data[i][totalCol]) || 0;
          processedIds.add(transId);
        }
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
 * Updated for new Financials sheet structure
 */
function getTodayExpenses() {
  try {
    const sheet = getSheet('Financials');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const dateCol = headers.indexOf('DateTime');
    const amountCol = headers.indexOf('Amount');
    const statusCol = headers.indexOf('Status');
    const typeCol = headers.indexOf('Type');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;

    for (let i = 1; i < data.length; i++) {
      const transType = data[i][typeCol];

      // Only count Expense transactions
      if (transType === 'Expense') {
        const expenseDate = new Date(data[i][dateCol]);
        expenseDate.setHours(0, 0, 0, 0);

        if (expenseDate.getTime() === today.getTime() &&
            (data[i][statusCol] === 'Approved' || data[i][statusCol] === '')) {
          total += parseFloat(data[i][amountCol]) || 0;
        }
      }
    }

    return total;

  } catch (error) {
    logError('getTodayExpenses', error);
    return 0;
  }
}

/**
 * Gets recent sales, ensuring uniqueness and correct sorting.
 */
function getRecentSales(limit = 20) {
  try {
    const salesSheet = getSheet('Sales');
    const allData = salesSheet.getDataRange().getValues();
    const headers = allData[0];
    
    // Find column indices dynamically
    const typeCol = headers.indexOf('Type');
    const idCol = headers.indexOf('Transaction_ID');
    const dateCol = headers.indexOf('DateTime');
    const customerCol = headers.indexOf('Customer_Name');
    const totalCol = headers.indexOf('Grand_Total');
    const statusCol = headers.indexOf('Status');
    const paymentCol = headers.indexOf('Payment_Mode');

    if (typeCol === -1 || idCol === -1 || dateCol === -1) {
        throw new Error("One or more required columns (Type, Transaction_ID, DateTime) not found in Sales sheet.");
    }

    const uniqueSales = new Map();

    // Iterate backwards to get recent sales first
    for (let i = allData.length - 1; i > 0; i--) {
      const row = allData[i];
      const type = row[typeCol];
      const transactionId = row[idCol];

      // Process only 'Sale' types and only if we haven't seen this ID before
      if (type === 'Sale' && !uniqueSales.has(transactionId)) {
        uniqueSales.set(transactionId, {
          Transaction_ID: transactionId,
          DateTime: new Date(row[dateCol]),
          Customer_Name: row[customerCol],
          Grand_Total: parseFloat(row[totalCol]) || 0,
          Status: row[statusCol],
          Payment_Mode: row[paymentCol]
        });
      }
    }

    // Convert map values to an array, sort by date descending
    const sortedSales = Array.from(uniqueSales.values())
      .sort((a, b) => b.DateTime.getTime() - a.DateTime.getTime());

    // Return the top 'limit' results
    return sortedSales.slice(0, limit);

  } catch (error) {
    logError('getRecentSales', error);
    return []; // Return empty array on error
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
 * Updated: Expense categories are now stored in Settings sheet
 * This function is kept for backward compatibility but is now a no-op
 */
function initializeExpenseCategories() {
  // Expense categories are now initialized as part of the Settings sheet
  // See createSettingsSheet() in kWorkbookManager.gs
  Logger.log('Expense categories are now part of Settings sheet');
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

/**
 * Gets details for a specific customer.
 */
function getCustomerDetails(customerId) {
  if (!customerId || customerId === 'WALK-IN') {
    return null;
  }
  
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    
    if (!customer) {
      return null;
    }
    
    return {
      Phone: customer.Phone,
      Email: customer.Email,
      Current_Balance: parseFloat(customer.Current_Balance) || 0
    };
    
  } catch (error) {
    logError('getCustomerDetails', error);
    return null;
  }
}
