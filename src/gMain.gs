/**
 * Fatma Sales Management System
 * Main Entry Point
 */

/**
 * Runs when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Create custom menu
  ui.createMenu('🏪 Fatma System')
    .addItem('⚡ Setup Fatma System', 'setupFatmaSystem')
    .addItem('🔄 Refresh System', 'refreshSystem')
    .addItem('🧹 Clear Cache & Reset Auth', 'clearAllCacheAndAuth')
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
    .addItem('📋 Quotations', 'showQuotations')
    .addSeparator()
    .addItem('👤 User Management', 'showUserManagement')
    .addItem('📈 View Reports', 'showReports')
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
  const html = HtmlService.createHtmlOutputFromFile('mDashboard')
    .setTitle(CONFIG.SHOP_NAME + ' Dashboard')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, CONFIG.SHOP_NAME + ' Dashboard');
}

/**
 * Show new sale dialog
 */
function showNewSaleDialog() {
  const html = HtmlService.createHtmlOutputFromFile('oNewSale')
    .setTitle('New Sale')
    .setWidth(600)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'New Sale');
}

/**
 * Show products manager
 */
function showProductsManager() {
  const html = HtmlService.createHtmlOutputFromFile('pProducts')
    .setTitle('Manage Products')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Products');
}

/**
 * Show customers manager
 */
function showCustomersManager() {
  const html = HtmlService.createHtmlOutputFromFile('lCustomers')
    .setTitle('Manage Customers')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Customers');
}

/**
 * Show reports
 */
function showReports() {
  const html = HtmlService.createHtmlOutputFromFile('qReports')
    .setTitle('Reports')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Reports');
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
  const html = HtmlService.createHtmlOutputFromFile('rSettings')
    .setTitle('Settings')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Settings');
}

/**
 * Get active user email
 */
function getActiveUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Check if user is admin
 */
function isAdmin() {
  const userEmail = getActiveUserEmail();
  return userEmail === CONFIG.ADMIN_EMAIL;
}

/**
 * Refresh System - Reconnects to spreadsheet and clears caches
 * This does NOT recreate sheets or delete data
 */
function refreshSystem() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Clear all caches
    CacheService.getUserCache().removeAll([]);
    CacheService.getScriptCache().removeAll([]);

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
      'Fatma System has been refreshed successfully.\n\n' +
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
 * Clear All Cache and Reset Authentication
 * This clears all caches, sessions, and forces reauthorization
 * NUCLEAR OPTION: Clears ALL cached data from Apps Script Properties Service
 */
function clearAllCacheAndAuth() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Confirm action
    const response = ui.alert(
      'Clear ALL Apps Script Cache & Auth',
      '⚠️ NUCLEAR CACHE CLEAR ⚠️\n\n' +
      'This will clear EVERYTHING cached in Apps Script:\n' +
      '• ALL CacheService data (user, script, document)\n' +
      '• ALL Script Properties (stored configurations)\n' +
      '• ALL User Properties (user-specific settings)\n' +
      '• ALL authentication tokens\n' +
      '• Force complete reauthorization\n\n' +
      '✓ Sheet data is preserved (not affected)\n' +
      '✓ Spreadsheet connection will be re-established\n\n' +
      'This solves issues where old cached data persists\n' +
      'even after deploying new versions.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    let clearedItems = [];

    // 1. Clear ALL CacheService caches
    try {
      CacheService.getUserCache().removeAll([]);
      clearedItems.push('✓ User cache');
      Logger.log('User cache cleared');
    } catch (e) {
      Logger.log('Error clearing user cache: ' + e.message);
      clearedItems.push('✗ User cache: ' + e.message);
    }

    try {
      CacheService.getScriptCache().removeAll([]);
      clearedItems.push('✓ Script cache');
      Logger.log('Script cache cleared');
    } catch (e) {
      Logger.log('Error clearing script cache: ' + e.message);
      clearedItems.push('✗ Script cache: ' + e.message);
    }

    try {
      CacheService.getDocumentCache().removeAll([]);
      clearedItems.push('✓ Document cache');
      Logger.log('Document cache cleared');
    } catch (e) {
      Logger.log('Error clearing document cache: ' + e.message);
      clearedItems.push('✗ Document cache: ' + e.message);
    }

    // 2. Clear ALL Script Properties (and log what we're clearing)
    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      const allProperties = scriptProperties.getProperties();
      const propertyKeys = Object.keys(allProperties);

      if (propertyKeys.length > 0) {
        Logger.log('Clearing ALL Script Properties: ' + propertyKeys.join(', '));

        // Delete ALL properties
        scriptProperties.deleteAllProperties();

        clearedItems.push('✓ ALL Script Properties (' + propertyKeys.length + ' items)');
        Logger.log('Cleared ' + propertyKeys.length + ' script properties: ' + propertyKeys.join(', '));

        // Re-establish spreadsheet connection
        try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          scriptProperties.setProperty('SPREADSHEET_ID', ss.getId());
          clearedItems.push('✓ Spreadsheet reconnected');
          Logger.log('Spreadsheet ID re-established: ' + ss.getId());
        } catch (e) {
          Logger.log('Warning: Could not re-establish spreadsheet ID: ' + e.message);
        }
      } else {
        clearedItems.push('ℹ Script Properties were already empty');
      }
    } catch (e) {
      Logger.log('Error clearing script properties: ' + e.message);
      clearedItems.push('✗ Script Properties: ' + e.message);
    }

    // 3. Clear ALL User Properties
    try {
      const userProps = PropertiesService.getUserProperties();
      const allUserProps = userProps.getProperties();
      const userPropKeys = Object.keys(allUserProps);

      if (userPropKeys.length > 0) {
        Logger.log('Clearing ALL User Properties: ' + userPropKeys.join(', '));
        userProps.deleteAllProperties();
        clearedItems.push('✓ ALL User Properties (' + userPropKeys.length + ' items)');
        Logger.log('Cleared ' + userPropKeys.length + ' user properties');
      } else {
        clearedItems.push('ℹ User Properties were already empty');
      }
    } catch (e) {
      Logger.log('Error clearing user properties: ' + e.message);
      clearedItems.push('✗ User Properties: ' + e.message);
    }

    // Log the action
    try {
      logAction(
        getActiveUserEmail(),
        'System',
        'NuclearCacheClear',
        'NUCLEAR: All Apps Script caches and properties cleared',
        '',
        '',
        clearedItems.join('\n')
      );
    } catch (e) {
      Logger.log('Could not log action (expected if audit trail has issues): ' + e.message);
    }

    // Show detailed results
    ui.alert(
      '🧹 Apps Script Cache Completely Cleared',
      'CLEARED FROM APPS SCRIPT:\n' +
      clearedItems.join('\n') + '\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'NEXT STEPS:\n\n' +
      '1️⃣ DEPLOY NEW VERSION:\n' +
      '   • In Apps Script Editor\n' +
      '   • Click "Deploy" > "Manage deployments"\n' +
      '   • Edit your web app deployment\n' +
      '   • Select "NEW VERSION"\n' +
      '   • Click "Deploy"\n\n' +
      '2️⃣ USERS MUST:\n' +
      '   • Close ALL browser tabs with the app\n' +
      '   • Clear browser cache (Ctrl+Shift+Delete)\n' +
      '   • Use the NEW deployment URL\n' +
      '   • Log in again (reauthorize)\n\n' +
      '3️⃣ If still having issues:\n' +
      '   • Wait 5-10 minutes for Google servers to sync\n' +
      '   • Try in Incognito/Private browsing mode',
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log('CRITICAL ERROR in clearAllCacheAndAuth: ' + error.message);
    Logger.log(error.stack);

    try {
      SpreadsheetApp.getUi().alert(
        'Clear Cache Error',
        'Error clearing cache: ' + error.message + '\n\n' +
        'Check Execution Log (View > Logs) for details.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      Logger.log('Could not show error alert: ' + e.message);
    }
  }
}

/**
 * Check System Health - Diagnostic tool to identify issues
 */
function checkSystemHealth() {
  try {
    const ui = SpreadsheetApp.getUi();
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

    // 2. Check all required sheets exist
    const requiredSheets = [
      'Users', 'Customers', 'Suppliers', 'Inventory',
      'Sales_Data', 'Sales_Items', 'Purchases', 'Purchase_Items',
      'Quotations', 'Quotation_Items', 'Customer_Transactions',
      'Financials', 'Expenses', 'Expense_Categories',
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
        warnings.push('⚠ No users found. Run "Setup Fatma System" to create default admin.');
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

    // 5. Check cache service
    try {
      const cache = CacheService.getUserCache();
      cache.put('health_check_test', 'ok', 60);
      const testValue = cache.get('health_check_test');
      if (testValue === 'ok') {
        info.push('✓ Cache Service: Working correctly');
      } else {
        warnings.push('⚠ Cache Service: Not responding as expected');
      }
    } catch (e) {
      warnings.push('⚠ Cache Service: ' + e.message);
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
    let report = '=== FATMA SYSTEM HEALTH CHECK ===\n\n';

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
      report += '• Run "Setup Fatma System" to fix critical issues\n';
    }
    if (missingSheets.length > 0) {
      report += '• Run "Setup Fatma System" to create missing sheets\n';
    }
    if (warnings.length === 0 && issues.length === 0) {
      report += '• System is healthy! No action needed.\n';
    }

    report += '\n💡 TIP: Check the Execution Log for detailed error messages\n';
    report += '(View > Execution log in Apps Script Editor)';

    // Log the health check
    logAction(
      getActiveUserEmail(),
      'System',
      'Health Check',
      'System health check performed. Issues: ' + issues.length + ', Warnings: ' + warnings.length,
      '',
      '',
      report
    );

    // Show the report
    ui.alert(
      'System Health Check',
      report,
      ui.ButtonSet.OK
    );

  } catch (error) {
    logError('checkSystemHealth', error);
    SpreadsheetApp.getUi().alert(
      'Health Check Error',
      'Error performing health check: ' + error.message + '\n\n' +
      'This might indicate a serious system issue. Please check the execution log.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
