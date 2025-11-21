/**
 * Fatma Sales Management System
 * Workbook Manager
 */

/**
 * Main setup function - creates Fatma System workbook with all sheets
 */
function setupFatmaSystem() {
  try {
    Logger.log('Starting Fatma System setup...');

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Rename spreadsheet to "Fatma System"
    ss.rename(CONFIG.WORKBOOK_NAME);
    Logger.log('Renamed workbook to: ' + CONFIG.WORKBOOK_NAME);

    // Store spreadsheet ID in Script Properties
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

    // Initialize all sheets using the existing initializeSheets function
    initializeSheets();

    // Delete default Sheet1 if it exists
    try {
      const sheet1 = ss.getSheetByName('Sheet1');
      if (sheet1 && ss.getSheets().length > 1) {
        ss.deleteSheet(sheet1);
        Logger.log('Deleted default Sheet1');
      }
    } catch (e) {
      // Sheet1 might not exist
      Logger.log('Sheet1 not found or already deleted');
    }

    // Set active sheet to Users
    const usersSheet = ss.getSheetByName('Users');
    if (usersSheet) {
      ss.setActiveSheet(usersSheet);
    }

    Logger.log('Fatma System setup completed successfully!');

    // Show success message
    try {
      SpreadsheetApp.getUi().alert(
        'Success',
        'Fatma System has been initialized successfully!\n\n' +
        'Default admin user created:\n' +
        'Username: admin\n' +
        'PIN: 1234\n\n' +
        'Please change the PIN after first login.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      // UI not available (running from script editor)
      Logger.log('Setup completed. Default admin: username=admin, PIN=1234');
    }

    return true;
  } catch (error) {
    Logger.log('ERROR in setupFatmaSystem: ' + error.message);
    Logger.log(error.stack);

    try {
      SpreadsheetApp.getUi().alert(
        'Error',
        'Failed to setup Fatma System: ' + error.message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      // UI not available
    }

    return false;
  }
}

/**
 * Legacy function for backward compatibility
 */
function initializeWorkbook() {
  return setupFatmaSystem();
}

/**
 * Get or create a sheet
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * Create Sales sheet
 */
function createSalesSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SALES);

  // Clear existing content
  sheet.clear();

  // Set up headers
  const headers = [
    'Sale ID',
    'Date',
    'Customer Name',
    'Customer Email',
    'Product',
    'Quantity',
    'Unit Price',
    'Total',
    'Payment Method',
    'Status',
    'Notes'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 100); // Sale ID
  sheet.setColumnWidth(2, 150); // Date
  sheet.setColumnWidth(3, 150); // Customer Name
  sheet.setColumnWidth(4, 200); // Customer Email
  sheet.setColumnWidth(5, 150); // Product
  sheet.setColumnWidth(6, 80);  // Quantity
  sheet.setColumnWidth(7, 100); // Unit Price
  sheet.setColumnWidth(8, 100); // Total
  sheet.setColumnWidth(9, 120); // Payment Method
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 200); // Notes

  return sheet;
}

/**
 * Create Products sheet
 */
function createProductsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.PRODUCTS);

  // Clear existing content
  sheet.clear();

  // Set up headers
  const headers = [
    'Product ID',
    'Product Name',
    'Description',
    'Category',
    'Price',
    'Cost',
    'Stock Quantity',
    'Reorder Level',
    'Supplier',
    'Status',
    'Last Updated'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 100); // Product ID
  sheet.setColumnWidth(2, 200); // Product Name
  sheet.setColumnWidth(3, 250); // Description
  sheet.setColumnWidth(4, 120); // Category
  sheet.setColumnWidth(5, 100); // Price
  sheet.setColumnWidth(6, 100); // Cost
  sheet.setColumnWidth(7, 120); // Stock Quantity
  sheet.setColumnWidth(8, 120); // Reorder Level
  sheet.setColumnWidth(9, 150); // Supplier
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 150); // Last Updated

  return sheet;
}

/**
 * Create Customers sheet
 */
function createCustomersSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.CUSTOMERS);

  // Clear existing content
  sheet.clear();

  // Set up headers
  const headers = [
    'Customer ID',
    'Name',
    'Email',
    'Phone',
    'Address',
    'City',
    'Total Purchases',
    'Last Purchase Date',
    'Status',
    'Notes'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 120); // Customer ID
  sheet.setColumnWidth(2, 150); // Name
  sheet.setColumnWidth(3, 200); // Email
  sheet.setColumnWidth(4, 120); // Phone
  sheet.setColumnWidth(5, 200); // Address
  sheet.setColumnWidth(6, 120); // City
  sheet.setColumnWidth(7, 140); // Total Purchases
  sheet.setColumnWidth(8, 150); // Last Purchase Date
  sheet.setColumnWidth(9, 100); // Status
  sheet.setColumnWidth(10, 200); // Notes

  return sheet;
}

/**
 * Create Inventory sheet
 */
function createInventorySheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.INVENTORY);

  // Clear existing content
  sheet.clear();

  // Set up headers
  const headers = [
    'Product ID',
    'Product Name',
    'Current Stock',
    'Reorder Level',
    'Status',
    'Last Restocked',
    'Reorder Needed'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 100); // Product ID
  sheet.setColumnWidth(2, 200); // Product Name
  sheet.setColumnWidth(3, 120); // Current Stock
  sheet.setColumnWidth(4, 120); // Reorder Level
  sheet.setColumnWidth(5, 100); // Status
  sheet.setColumnWidth(6, 150); // Last Restocked
  sheet.setColumnWidth(7, 140); // Reorder Needed

  return sheet;
}

/**
 * Create Reports sheet
 */
function createReportsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.REPORTS);

  // Clear existing content
  sheet.clear();

  // Add title
  sheet.getRange('A1').setValue(CONFIG.SHOP_NAME + ' - Sales Reports');
  sheet.getRange('A1').setFontSize(16);
  sheet.getRange('A1').setFontWeight('bold');

  // Add report sections
  sheet.getRange('A3').setValue('Daily Sales Summary');
  sheet.getRange('A3').setFontWeight('bold');
  sheet.getRange('A3').setBackground(CONFIG.COLORS.PRIMARY);
  sheet.getRange('A3').setFontColor('#FFFFFF');

  sheet.getRange('A5').setValue('Weekly Sales Summary');
  sheet.getRange('A5').setFontWeight('bold');
  sheet.getRange('A5').setBackground(CONFIG.COLORS.SECONDARY);
  sheet.getRange('A5').setFontColor('#FFFFFF');

  sheet.getRange('A7').setValue('Monthly Sales Summary');
  sheet.getRange('A7').setFontWeight('bold');
  sheet.getRange('A7').setBackground(CONFIG.COLORS.ACCENT);
  sheet.getRange('A7').setFontColor('#FFFFFF');

  return sheet;
}

/**
 * Create Settings sheet
 */
function createSettingsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS);

  // Clear existing content
  sheet.clear();

  // Add settings
  const settings = [
    ['Setting', 'Value'],
    ['Shop Name', CONFIG.SHOP_NAME],
    ['Admin Email', CONFIG.ADMIN_EMAIL],
    ['Currency', CONFIG.CURRENCY],
    ['Currency Symbol', CONFIG.CURRENCY_SYMBOL],
    ['Date Format', CONFIG.DATE_FORMAT],
    ['Timezone', 'Africa/Mogadishu'],
    ['', ''],
    ['System Information', ''],
    ['Version', '1.0.0'],
    ['Last Updated', new Date()],
    ['Initialized By', CONFIG.ADMIN_EMAIL]
  ];

  sheet.getRange(1, 1, settings.length, 2).setValues(settings);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, 2);
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');

  // Set column widths
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);

  // Protect the sheet (only admin can edit)
  const protection = sheet.protect().setDescription('Settings Protection');
  protection.addEditor(CONFIG.ADMIN_EMAIL);
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }

  return sheet;
}
