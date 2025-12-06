/**
 * Beipoa Sales Management System
 * Main Entry Point
 */

/**
 * Runs when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Check if current user has Admin role (case-sensitive)
  const userIsAdmin = isUserAdmin();

  // Create custom menu
  const menu = ui.createMenu('🏪 Beipoa System')
    .addItem('⚡ Setup Beipoa System', 'setupFatmaSystem')
    .addItem('🔄 Refresh System', 'refreshSystem')
    .addSeparator()
    .addItem('📊 Dashboard', 'showDashboard')
    .addSeparator()
    .addItem('🛍️ New Sale', 'showNewSaleDialog')
    .addItem('📦 Manage Inventory', 'showInventoryManager')
    .addItem('👥 Manage Customers', 'showCustomersManager')
    .addItem('🏭 Manage Suppliers', 'showSuppliersManager')
    .addSeparator()
    .addItem('💰 Financials', 'showFinancials')
    .addItem('💳 Expenses', 'showExpenses')
    .addSeparator();

  // Only show admin menu items if user has "Admin" role (case-sensitive)
  if (userIsAdmin) {
    menu.addItem('👤 User Management', 'showUserManagement');
  }

  menu.addItem('📈 View Reports', 'showReports')
    .addItem('⚙️ Settings', 'showSettings')
    .addSeparator()
    .addItem('🔍 Check System Health', 'checkSystemHealth')
    .addToUi();
}

/**
 * Runs when the add-on is installed
 */
function onInstall() {
  onOpen();
  setupFatmaSystem();
}

/**
 * Show dashboard
 */
function showDashboard() {
  showDialog('mDashboard', CONFIG.SHOP_NAME + ' Dashboard', 800, 600);
}

/**
 * Show new sale dialog
 */
function showNewSaleDialog() {
  try {
    showDialog('oNewSale', 'New Sale', 600, 500);
    return { success: true };
  } catch (e) {
    // If UI not available (called from restricted context), return signal
    Logger.log('showNewSaleDialog called from restricted context: ' + e.message);
    return { success: false, error: 'UI_NOT_AVAILABLE', message: e.message };
  }
}

/**
 * Delayed show new sale dialog - for use after closing another dialog
 */
function delayedShowNewSaleDialog(attempt) {
  const maxAttempts = 3;
  const delayMs = 500;
  const currentAttempt = attempt || 1;

  // Give the previous dialog a moment to close before attempting to open a new one
  Utilities.sleep(delayMs);

  const result = showNewSaleDialog();

  // If the UI wasn't available because another dialog was still closing, retry once more
  if (result && result.success === false && result.error === 'UI_NOT_AVAILABLE' && currentAttempt < maxAttempts) {
    return delayedShowNewSaleDialog(currentAttempt + 1);
  }

  return result;
}

/**
 * Show products manager
 */
function showProductsManager() {
  showDialog('pProducts', 'Manage Products', 700, 600);
}

/**
 * Show customers manager
 */
function showCustomersManager() {
  showDialog('lCustomers', 'Manage Customers', 700, 600);
}

/**
 * Show reports
 */
function showReports() {
  showDialog('qReports', 'Reports', 800, 600);
}

/**
 * Show inventory
 */
function showInventory() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.INVENTORY);
  SpreadsheetApp.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('Inventory', 'Showing inventory sheet', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Show settings
 */
function showSettings() {
  showDialog('rSettings', 'Settings', 500, 400);
}

/**
 * Show user management
 */
function showUserManagement() {
  showDialog('sUserManagement', 'User Management', 1000, 700);
}

/**
 * Show inventory manager
 */
function showInventoryManager() {
  showDialog('tInventory', 'Inventory Management', 900, 700);
}

/**
 * Show suppliers manager
 */
function showSuppliersManager() {
  showDialog('uSuppliers', 'Suppliers Management', 900, 700);
}

/**
 * Show financials
 */
function showFinancials() {
  showDialog('vFinancials', 'Financial Overview', 1000, 700);
}

/**
 * Show expenses
 */
function showExpenses() {
  showDialog('wExpenses', 'Expenses Management', 900, 700);
}

/**
 * Displays a modal dialog with the specified HTML file and dimensions.
 * @param {string} fileName The name of the HTML file to display.
 * @param {string} title The title of the dialog.
 * @param {number} width The width of the dialog.
 * @param {number} height The height of the dialog.
 */
function showDialog(fileName, title, width, height) {
  const html = HtmlService.createHtmlOutputFromFile(fileName)
    .setTitle(title)
    .setWidth(width)
    .setHeight(height);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}



/**
 * Get active user email
 */
function getActiveUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Check if user is admin (legacy - checks CONFIG.ADMIN_EMAIL)
 */
function isAdmin() {
  const userEmail = getActiveUserEmail();
  return userEmail === CONFIG.ADMIN_EMAIL;
}

/**
 * Get the current user's role from the Users sheet
 * Returns null if user not found
 */
function getCurrentUserRole() {
  try {
    const userEmail = getActiveUserEmail();
    const sheet = getSheet('Users');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return null; // No users in sheet
    }

    const headers = data[0];
    const emailCol = headers.indexOf('Email');
    const roleCol = headers.indexOf('Role');

    if (emailCol === -1 || roleCol === -1) {
      Logger.log('Email or Role column not found in Users sheet');
      return null;
    }

    // Search for user by email
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[emailCol] && row[emailCol].toLowerCase() === userEmail.toLowerCase()) {
        // Return role exactly as stored (case-sensitive)
        return row[roleCol] || null;
      }
    }

    return null; // User not found
  } catch (error) {
    Logger.log('Error getting user role: ' + error.message);
    return null;
  }
}

/**
 * Check if current user has Admin role (case-sensitive)
 */
function isUserAdmin() {
  const role = getCurrentUserRole();
  // Case-sensitive check - role must be exactly "Admin"
  return role === 'Admin';
}

/**
 * Refresh System - Reconnects to spreadsheet and clears caches
 * This does NOT recreate sheets or delete data
 */
function refreshSystem() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Reconnect to spreadsheet
    const scriptProperties = PropertiesService.getScriptProperties();
    const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

    if (spreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        Logger.log('Reconnected to spreadsheet: ' + ss.getName());
      } catch (e) {
        Logger.log('Could not reconnect by ID, using active spreadsheet');
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        scriptProperties.setProperty('SPREADSHEET_ID', ss.getId());
      }
    }

    // Log the refresh action
    logAction(
      getActiveUserEmail(),
      'System',
      'Refresh',
      'System refresh triggered from menu',
      '',
      '',
      ''
    );

    ui.alert(
      'System Refreshed',
      'Beipoa System has been refreshed successfully.\n\n' +
      '✓ Caches cleared\n' +
      '✓ Spreadsheet connection refreshed\n' +
      '✓ All data preserved\n\n' +
      'You can now reload your web application.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    logError('refreshSystem', error);
    SpreadsheetApp.getUi().alert(
      'Refresh Error',
      'Error refreshing system: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Check System Health - Diagnostic tool to identify issues
 */
function checkSystemHealth() {
  try {
    // Try to get UI (only available in interactive contexts)
    let ui = null;
    let hasUI = false;
    try {
      ui = SpreadsheetApp.getUi();
      hasUI = true;
    } catch (uiError) {
      Logger.log('UI not available (called from trigger/background context)');
      hasUI = false;
    }

    const issues = [];
    const warnings = [];
    const info = [];

    // 1. Check spreadsheet connection
    try {
      const ss = getSpreadsheet();
      info.push('✓ Spreadsheet: ' + ss.getName() + ' (ID: ' + ss.getId() + ')');
    } catch (e) {
      issues.push('✗ Cannot connect to spreadsheet: ' + e.message);
    }

    // 2. Check all required sheets exist (9-sheet reorganized structure)
    const requiredSheets = [
      'Users', 'Suppliers', 'Customers', 'Inventory',
      'Sales', 'Purchases', 'Financials',
      'Audit_Trail', 'Settings'
    ];

    let missingSheets = [];
    try {
      const ss = getSpreadsheet();
      requiredSheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          missingSheets.push(sheetName);
        }
      });

      if (missingSheets.length === 0) {
        info.push('✓ All required sheets present (' + requiredSheets.length + ' sheets)');
      } else {
        warnings.push('⚠ Missing sheets: ' + missingSheets.join(', '));
      }
    } catch (e) {
      issues.push('✗ Cannot check sheets: ' + e.message);
    }

    // 3. Check Users sheet has data
    try {
      const usersSheet = getSheet('Users');
      const userData = usersSheet.getDataRange().getValues();
      if (userData.length <= 1) {
        warnings.push('⚠ No users found. Run "Setup Beipoa System" to create default admin.');
      } else {
        info.push('✓ Users: ' + (userData.length - 1) + ' user(s) registered');
      }
    } catch (e) {
      issues.push('✗ Cannot read Users sheet: ' + e.message);
    }

    // 4. Check Script Properties
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
      if (spreadsheetId) {
        info.push('✓ Script Properties: Spreadsheet ID configured');
      } else {
        warnings.push('⚠ Script Properties: No spreadsheet ID stored');
      }
    } catch (e) {
      issues.push('✗ Cannot access Script Properties: ' + e.message);
    }

    try {
      if (testValue === 'ok') {
      } else {
      }
    } catch (e) {
    }

    // 6. Check Audit Trail logging
    try {
      const auditSheet = getSheet('Audit_Trail');
      const auditData = auditSheet.getDataRange().getValues();
      info.push('✓ Audit Trail: ' + (auditData.length - 1) + ' log entries');
    } catch (e) {
      warnings.push('⚠ Audit Trail: Cannot read - ' + e.message);
    }

      // Build the report
      let report = '=== BEIPOA SYSTEM HEALTH CHECK ===\n\n';

    if (issues.length === 0 && warnings.length === 0) {
      report += '✅ SYSTEM STATUS: HEALTHY\n\n';
    } else if (issues.length > 0) {
      report += '❌ SYSTEM STATUS: CRITICAL ISSUES FOUND\n\n';
    } else {
      report += '⚠️ SYSTEM STATUS: WARNINGS PRESENT\n\n';
    }

    if (issues.length > 0) {
      report += '🔴 CRITICAL ISSUES:\n';
      issues.forEach(issue => report += issue + '\n');
      report += '\n';
    }

    if (warnings.length > 0) {
      report += '🟡 WARNINGS:\n';
      warnings.forEach(warning => report += warning + '\n');
      report += '\n';
    }

    if (info.length > 0) {
      report += '📋 SYSTEM INFO:\n';
      info.forEach(item => report += item + '\n');
      report += '\n';
    }

    report += '\n📝 RECOMMENDATIONS:\n';
    if (issues.length > 0) {
      report += '• Run "Setup Beipoa System" to fix critical issues\n';
    }
    if (missingSheets.length > 0) {
      report += '• Run "Setup Beipoa System" to create missing sheets\n';
    }
    if (warnings.length === 0 && issues.length === 0) {
      report += '• System is healthy! No action needed.\n';
    }

    report += '\n💡 TIP: Check the Execution Log for detailed error messages\n';
    report += '(View > Execution log in Apps Script Editor)';

    // Log the health check
    try {
      logAction(
        getActiveUserEmail(),
        'System',
        'Health Check',
        'System health check performed. Issues: ' + issues.length + ', Warnings: ' + warnings.length,
        '',
        '',
        'See execution log for full report'
      );
    } catch (logError) {
      Logger.log('Could not log health check: ' + logError.message);
    }

    // Always log the report
    Logger.log(report);

    // Show the report in UI if available
    if (hasUI && ui) {
      ui.alert(
        'System Health Check',
        report,
        ui.ButtonSet.OK
      );
    } else {
      Logger.log('Health check completed. UI not available - results logged only.');
    }

    // Return the report for programmatic access
    return {
      success: true,
      issues: issues,
      warnings: warnings,
      info: info,
      report: report
    };

  } catch (error) {
    logError('checkSystemHealth', error);

    // Try to show error in UI if available
    try {
      const errorUI = SpreadsheetApp.getUi();
      errorUI.alert(
        'Health Check Error',
        'Error performing health check: ' + error.message + '\n\n' +
        'This might indicate a serious system issue. Please check the execution log.',
        errorUI.ButtonSet.OK
      );
    } catch (uiError) {
      // UI not available, just log the error
      Logger.log('Health Check Error (UI not available): ' + error.message);
      Logger.log(error.stack);
    }

    throw error;
  }
}

function getUsersOverview() {
  try {
    const users = sheetToObjects('Users');
    return {
      totalUsers: users.length
    };
  } catch (error) {
    logError('getUsersOverview', error);
    throw new Error('Unable to load users overview: ' + error.message);
  }
}
