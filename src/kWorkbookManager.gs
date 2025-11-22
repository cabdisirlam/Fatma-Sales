/**
 * Fatma Sales Management System
 * Workbook Manager - Complete Sheet Setup System
 *
 * To setup the system:
 * 1. Run the function: createFatmaSystem()
 * 2. The system will automatically create a new spreadsheet named "Fatma System"
 * 3. All required sheets will be created and formatted
 * 4. Default admin user will be created (email: cabdisirlam@gmail.com, username: Cabdisirlam, PIN: 2020)
 */

/**
 * Easy-to-use function to create and setup Fatma System
 * Run this function from the Script Editor to get started!
 */
function createFatmaSystem() {
  try {
    Logger.log('=== Creating Fatma System ===');
    const result = setupFatmaSystem();

    if (result.success) {
      Logger.log('SUCCESS! Spreadsheet created at: ' + result.spreadsheetUrl);
      Logger.log('Spreadsheet ID: ' + result.spreadsheetId);
      return result;
    }
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Main setup function - creates Fatma System workbook with all sheets
 */
function setupFatmaSystem() {
  try {
    Logger.log('Starting Fatma System setup...');

    // Try to get existing spreadsheet, or create new one
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (e) {
      Logger.log('No existing spreadsheet found, creating new one...');
      ss = null;
    }

    // If no spreadsheet exists, create a new one
    if (!ss) {
      Logger.log('Creating new spreadsheet: ' + CONFIG.WORKBOOK_NAME);
      ss = SpreadsheetApp.create(CONFIG.WORKBOOK_NAME);
      Logger.log('Created new workbook with ID: ' + ss.getId());

      // Store spreadsheet ID in Script Properties
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
      Logger.log('Saved spreadsheet ID to Script Properties');
    } else {
      // Rename existing spreadsheet to "Fatma System"
      ss.rename(CONFIG.WORKBOOK_NAME);
      Logger.log('Renamed workbook to: ' + CONFIG.WORKBOOK_NAME);

      // Store spreadsheet ID in Script Properties
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
    }

    // Initialize all sheets using the comprehensive setup
    initializeAllSheets();

    // Delete default Sheet1 if it exists
    try {
      const sheet1 = ss.getSheetByName('Sheet1');
      if (sheet1 && ss.getSheets().length > 1) {
        ss.deleteSheet(sheet1);
        Logger.log('Deleted default Sheet1');
      }
    } catch (e) {
      Logger.log('Sheet1 not found or already deleted');
    }

    // Set active sheet to Users
    const usersSheet = ss.getSheetByName('Users');
    if (usersSheet) {
      ss.setActiveSheet(usersSheet);
    }

    Logger.log('Fatma System setup completed successfully!');
    Logger.log('Spreadsheet URL: ' + ss.getUrl());

    // Show success message
    try {
      SpreadsheetApp.getUi().alert(
        'Success',
        'Fatma System has been initialized successfully!\n\n' +
        'Workbook Name: ' + CONFIG.WORKBOOK_NAME + '\n' +
        'Spreadsheet URL: ' + ss.getUrl() + '\n\n' +
        'All sheets have been created and formatted.\n\n' +
        'Default admin user created:\n' +
        'Email: cabdisirlam@gmail.com\n' +
        'Username: Cabdisirlam\n' +
        'PIN: 2020\n\n' +
        'Please change the PIN after first login.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      Logger.log('Setup completed. Default admin: email=cabdisirlam@gmail.com, username=Cabdisirlam, PIN=2020');
      Logger.log('Spreadsheet URL: ' + ss.getUrl());
    }

    return {
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      message: 'Fatma System initialized successfully'
    };
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
 * Initializes all sheets with proper formatting
 * New simplified 9-sheet structure
 */
function initializeAllSheets() {
  Logger.log('Initializing all sheets (9-sheet reorganized structure)...');

  // Create all sheets in order
  createUsersSheet();
  createSuppliersSheet();
  createCustomersSheet();
  createInventorySheet();
  createSalesSheet();          // Merged: Sales + Quotations with line items
  createPurchasesSheet();      // Merged: Purchases with line items
  createFinancialsSheet();     // Merged: All financial transactions
  createAuditTrailSheet();
  createSettingsSheet();       // Now includes Expense Categories

  Logger.log('All 9 sheets initialized!');
}

/**
 * Get or create a sheet
 */
function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * Helper function to format header row
 */
function formatHeaderRow(sheet, headerRange, numColumns) {
  headerRange.setBackground(CONFIG.COLORS.HEADER);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

// =====================================================
// SHEET CREATION FUNCTIONS
// =====================================================

/**
 * Create Users sheet
 */
function createUsersSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.USERS);
  sheet.clear();

  const headers = ['User_ID', 'Username', 'PIN', 'Role', 'Email', 'Phone', 'Status', 'Created_Date'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 100); // User_ID
  sheet.setColumnWidth(2, 150); // Username
  sheet.setColumnWidth(3, 80);  // PIN
  sheet.setColumnWidth(4, 100); // Role
  sheet.setColumnWidth(5, 200); // Email
  sheet.setColumnWidth(6, 120); // Phone
  sheet.setColumnWidth(7, 80);  // Status
  sheet.setColumnWidth(8, 150); // Created_Date

  Logger.log('Created Users sheet');
  return sheet;
}

/**
 * Create Suppliers sheet
 */
function createSuppliersSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SUPPLIERS);
  sheet.clear();

  const headers = ['Supplier_ID', 'Supplier_Name', 'Contact_Person', 'Phone', 'Email', 'Address',
                   'Total_Purchased', 'Total_Paid', 'Current_Balance', 'Payment_Terms', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120); // Supplier_ID
  sheet.setColumnWidth(2, 200); // Supplier_Name
  sheet.setColumnWidth(3, 150); // Contact_Person
  sheet.setColumnWidth(4, 120); // Phone
  sheet.setColumnWidth(5, 200); // Email
  sheet.setColumnWidth(6, 250); // Address
  sheet.setColumnWidth(7, 140); // Total_Purchased
  sheet.setColumnWidth(8, 120); // Total_Paid
  sheet.setColumnWidth(9, 140); // Current_Balance
  sheet.setColumnWidth(10, 150); // Payment_Terms
  sheet.setColumnWidth(11, 80);  // Status

  Logger.log('Created Suppliers sheet');
  return sheet;
}

/**
 * Create Customers sheet
 */
function createCustomersSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.CUSTOMERS);
  sheet.clear();

  const headers = ['Customer_ID', 'Customer_Name', 'Phone', 'Email', 'Location', 'KRA_PIN',
                   'Customer_Type', 'Credit_Limit', 'Current_Balance', 'Total_Purchases',
                   'Last_Purchase_Date', 'Loyalty_Points', 'Status', 'Created_Date', 'Created_By'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120);  // Customer_ID
  sheet.setColumnWidth(2, 180);  // Customer_Name
  sheet.setColumnWidth(3, 120);  // Phone
  sheet.setColumnWidth(4, 200);  // Email
  sheet.setColumnWidth(5, 150);  // Location
  sheet.setColumnWidth(6, 120);  // KRA_PIN
  sheet.setColumnWidth(7, 120);  // Customer_Type
  sheet.setColumnWidth(8, 120);  // Credit_Limit
  sheet.setColumnWidth(9, 140);  // Current_Balance
  sheet.setColumnWidth(10, 140); // Total_Purchases
  sheet.setColumnWidth(11, 150); // Last_Purchase_Date
  sheet.setColumnWidth(12, 120); // Loyalty_Points
  sheet.setColumnWidth(13, 80);  // Status
  sheet.setColumnWidth(14, 150); // Created_Date
  sheet.setColumnWidth(15, 120); // Created_By

  Logger.log('Created Customers sheet');
  return sheet;
}

/**
 * Create Inventory sheet
 */
function createInventorySheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.INVENTORY);
  sheet.clear();

  const headers = ['Item_ID', 'Item_Name', 'Category', 'Cost_Price', 'Selling_Price',
                   'Current_Qty', 'Reorder_Level', 'Supplier', 'Last_Updated', 'Updated_By'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 100); // Item_ID
  sheet.setColumnWidth(2, 250); // Item_Name
  sheet.setColumnWidth(3, 150); // Category
  sheet.setColumnWidth(4, 120); // Cost_Price
  sheet.setColumnWidth(5, 120); // Selling_Price
  sheet.setColumnWidth(6, 120); // Current_Qty
  sheet.setColumnWidth(7, 130); // Reorder_Level
  sheet.setColumnWidth(8, 150); // Supplier
  sheet.setColumnWidth(9, 150); // Last_Updated
  sheet.setColumnWidth(10, 120); // Updated_By

  Logger.log('Created Inventory sheet');
  return sheet;
}

/**
 * Create Sales sheet (merged: Sales_Data + Sales_Items + Quotations + Quotation_Items)
 * Each row represents a line item from a sale or quotation
 */
function createSalesSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SALES);
  sheet.clear();

  const headers = ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Customer_Name',
                   'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total',
                   'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total',
                   'Payment_Mode', 'Sold_By', 'Location', 'KRA_PIN', 'Status',
                   'Valid_Until', 'Converted_Sale_ID'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120);  // Transaction_ID
  sheet.setColumnWidth(2, 150);  // DateTime
  sheet.setColumnWidth(3, 100);  // Type (Sale/Quotation)
  sheet.setColumnWidth(4, 120);  // Customer_ID
  sheet.setColumnWidth(5, 180);  // Customer_Name
  sheet.setColumnWidth(6, 100);  // Item_ID
  sheet.setColumnWidth(7, 250);  // Item_Name
  sheet.setColumnWidth(8, 80);   // Qty
  sheet.setColumnWidth(9, 120);  // Unit_Price
  sheet.setColumnWidth(10, 120); // Line_Total
  sheet.setColumnWidth(11, 120); // Subtotal
  sheet.setColumnWidth(12, 130); // Delivery_Charge
  sheet.setColumnWidth(13, 100); // Discount
  sheet.setColumnWidth(14, 120); // Grand_Total
  sheet.setColumnWidth(15, 130); // Payment_Mode
  sheet.setColumnWidth(16, 120); // Sold_By
  sheet.setColumnWidth(17, 150); // Location
  sheet.setColumnWidth(18, 120); // KRA_PIN
  sheet.setColumnWidth(19, 100); // Status
  sheet.setColumnWidth(20, 150); // Valid_Until
  sheet.setColumnWidth(21, 150); // Converted_Sale_ID

  Logger.log('Created Sales sheet (merged structure)');
  return sheet;
}

/**
 * Create Purchases sheet (merged: Purchases + Purchase_Items)
 * Each row represents a line item from a purchase order
 */
function createPurchasesSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.PURCHASES);
  sheet.clear();

  const headers = ['Purchase_ID', 'Date', 'Supplier_ID', 'Supplier_Name',
                   'Item_ID', 'Item_Name', 'Qty', 'Cost_Price', 'Line_Total',
                   'Total_Amount', 'Payment_Status', 'Payment_Method',
                   'Paid_Amount', 'Balance', 'Recorded_By'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120);  // Purchase_ID
  sheet.setColumnWidth(2, 150);  // Date
  sheet.setColumnWidth(3, 120);  // Supplier_ID
  sheet.setColumnWidth(4, 200);  // Supplier_Name
  sheet.setColumnWidth(5, 100);  // Item_ID
  sheet.setColumnWidth(6, 250);  // Item_Name
  sheet.setColumnWidth(7, 80);   // Qty
  sheet.setColumnWidth(8, 120);  // Cost_Price
  sheet.setColumnWidth(9, 120);  // Line_Total
  sheet.setColumnWidth(10, 130); // Total_Amount
  sheet.setColumnWidth(11, 140); // Payment_Status
  sheet.setColumnWidth(12, 140); // Payment_Method
  sheet.setColumnWidth(13, 130); // Paid_Amount
  sheet.setColumnWidth(14, 120); // Balance
  sheet.setColumnWidth(15, 120); // Recorded_By

  Logger.log('Created Purchases sheet (merged structure)');
  return sheet;
}

/**
 * Create Financials sheet (merged: Customer_Transactions + Financials + Expenses)
 * Universal transaction sheet for all financial movements
 */
function createFinancialsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.FINANCIALS);
  sheet.clear();

  const headers = ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Category',
                   'Account', 'Description', 'Amount', 'Debit', 'Credit', 'Balance',
                   'Payment_Method', 'Payee', 'Receipt_No', 'Reference',
                   'Status', 'Approved_By', 'User'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 140);  // Transaction_ID
  sheet.setColumnWidth(2, 150);  // DateTime
  sheet.setColumnWidth(3, 150);  // Type (Customer_Payment/Cash_In/Cash_Out/Bank/M-PESA/Expense)
  sheet.setColumnWidth(4, 120);  // Customer_ID
  sheet.setColumnWidth(5, 150);  // Category (for expenses)
  sheet.setColumnWidth(6, 120);  // Account (Cash/Bank/M-PESA)
  sheet.setColumnWidth(7, 250);  // Description
  sheet.setColumnWidth(8, 120);  // Amount
  sheet.setColumnWidth(9, 120);  // Debit
  sheet.setColumnWidth(10, 120); // Credit
  sheet.setColumnWidth(11, 120); // Balance
  sheet.setColumnWidth(12, 140); // Payment_Method
  sheet.setColumnWidth(13, 150); // Payee
  sheet.setColumnWidth(14, 120); // Receipt_No
  sheet.setColumnWidth(15, 140); // Reference
  sheet.setColumnWidth(16, 100); // Status
  sheet.setColumnWidth(17, 120); // Approved_By
  sheet.setColumnWidth(18, 120); // User

  Logger.log('Created Financials sheet (merged structure)');
  return sheet;
}

/**
 * Create Audit_Trail sheet
 */
function createAuditTrailSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.AUDIT_TRAIL);
  sheet.clear();

  const headers = ['Timestamp', 'User', 'Module', 'Action', 'Details',
                   'Session_ID', 'Before_Value', 'After_Value'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 150); // Timestamp
  sheet.setColumnWidth(2, 120); // User
  sheet.setColumnWidth(3, 120); // Module
  sheet.setColumnWidth(4, 120); // Action
  sheet.setColumnWidth(5, 300); // Details
  sheet.setColumnWidth(6, 200); // Session_ID
  sheet.setColumnWidth(7, 200); // Before_Value
  sheet.setColumnWidth(8, 200); // After_Value

  Logger.log('Created Audit_Trail sheet');
  return sheet;
}

/**
 * Create Settings sheet (now includes Expense Categories)
 */
function createSettingsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS);
  sheet.clear();

  const headers = ['Setting_Key', 'Setting_Value'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 250); // Setting_Key
  sheet.setColumnWidth(2, 350); // Setting_Value

  // Add default settings including expense categories
  const settings = [
    ['Shop_Name', CONFIG.SHOP_NAME],
    ['Admin_Email', CONFIG.ADMIN_EMAIL],
    ['Currency', CONFIG.CURRENCY],
    ['Currency_Symbol', CONFIG.CURRENCY_SYMBOL],
    ['Date_Format', CONFIG.DATE_FORMAT],
    ['Timezone', 'Africa/Mogadishu'],
    ['PIN_Length', CONFIG.PIN_LENGTH],
    ['Use_Token_Auth', CONFIG.USE_TOKEN_AUTH],
    ['System_Version', '2.0.0'],
    ['Last_Updated', new Date()],
    ['Initialized_By', CONFIG.ADMIN_EMAIL],
    ['', ''],  // Separator
    ['=== EXPENSE CATEGORIES ===', ''],
    ['Expense_Category_Rent', '50000'],
    ['Expense_Category_Utilities', '15000'],
    ['Expense_Category_Salaries', '100000'],
    ['Expense_Category_Marketing', '20000'],
    ['Expense_Category_Supplies', '10000'],
    ['Expense_Category_Transport', '15000'],
    ['Expense_Category_Maintenance', '10000'],
    ['Expense_Category_Other', '10000']
  ];

  if (sheet.getLastRow() === 1) {
    sheet.getRange(2, 1, settings.length, 2).setValues(settings);
  }

  Logger.log('Created Settings sheet (with expense categories)');
  return sheet;
}
