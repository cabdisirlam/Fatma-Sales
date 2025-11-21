/**
 * Fatma Sales Management System
 * Workbook Manager - Complete Sheet Setup System
 */

/**
 * Main setup function - creates Fatma System workbook with all sheets
 */
function setupFatmaSystem() {
  try {
    Logger.log('Starting Fatma System setup...');

    const ss = getSpreadsheet();

    if (!ss) {
      throw new Error('No active spreadsheet found. Please run this from a spreadsheet.');
    }

    // Rename spreadsheet to "Fatma System"
    ss.rename(CONFIG.WORKBOOK_NAME);
    Logger.log('Renamed workbook to: ' + CONFIG.WORKBOOK_NAME);

    // Store spreadsheet ID in Script Properties
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

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

    // Show success message
    try {
      SpreadsheetApp.getUi().alert(
        'Success',
        'Fatma System has been initialized successfully!\n\n' +
        'All sheets have been created and formatted.\n\n' +
        'Default admin user created:\n' +
        'Username: admin\n' +
        'PIN: 1234\n\n' +
        'Please change the PIN after first login.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
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
 * Initializes all sheets with proper formatting
 */
function initializeAllSheets() {
  Logger.log('Initializing all sheets...');

  // Create all sheets in order
  createUsersSheet();
  createSuppliersSheet();
  createCustomersSheet();
  createInventorySheet();
  createSalesDataSheet();
  createSalesItemsSheet();
  createPurchasesSheet();
  createPurchaseItemsSheet();
  createQuotationsSheet();
  createQuotationItemsSheet();
  createCustomerTransactionsSheet();
  createFinancialsSheet();
  createExpensesSheet();
  createExpenseCategoriesSheet();
  createAuditTrailSheet();
  createSettingsSheet();

  Logger.log('All sheets initialized!');
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
 * Create Sales_Data sheet
 */
function createSalesDataSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SALES_DATA);
  sheet.clear();

  const headers = ['Sale_ID', 'DateTime', 'Customer_ID', 'Customer_Name', 'Subtotal',
                   'Delivery_Charge', 'Discount', 'Grand_Total', 'Payment_Mode',
                   'Sold_By', 'Location', 'KRA_PIN', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 100);  // Sale_ID
  sheet.setColumnWidth(2, 150);  // DateTime
  sheet.setColumnWidth(3, 120);  // Customer_ID
  sheet.setColumnWidth(4, 180);  // Customer_Name
  sheet.setColumnWidth(5, 120);  // Subtotal
  sheet.setColumnWidth(6, 130);  // Delivery_Charge
  sheet.setColumnWidth(7, 100);  // Discount
  sheet.setColumnWidth(8, 120);  // Grand_Total
  sheet.setColumnWidth(9, 130);  // Payment_Mode
  sheet.setColumnWidth(10, 120); // Sold_By
  sheet.setColumnWidth(11, 150); // Location
  sheet.setColumnWidth(12, 120); // KRA_PIN
  sheet.setColumnWidth(13, 100); // Status

  Logger.log('Created Sales_Data sheet');
  return sheet;
}

/**
 * Create Sales_Items sheet
 */
function createSalesItemsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SALES_ITEMS);
  sheet.clear();

  const headers = ['Sale_ID', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 100); // Sale_ID
  sheet.setColumnWidth(2, 100); // Item_ID
  sheet.setColumnWidth(3, 250); // Item_Name
  sheet.setColumnWidth(4, 80);  // Qty
  sheet.setColumnWidth(5, 120); // Unit_Price
  sheet.setColumnWidth(6, 120); // Line_Total

  Logger.log('Created Sales_Items sheet');
  return sheet;
}

/**
 * Create Purchases sheet
 */
function createPurchasesSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.PURCHASES);
  sheet.clear();

  const headers = ['Purchase_ID', 'Date', 'Supplier_ID', 'Supplier_Name', 'Total_Amount',
                   'Payment_Status', 'Payment_Method', 'Paid_Amount', 'Balance', 'Recorded_By'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120);  // Purchase_ID
  sheet.setColumnWidth(2, 150);  // Date
  sheet.setColumnWidth(3, 120);  // Supplier_ID
  sheet.setColumnWidth(4, 200);  // Supplier_Name
  sheet.setColumnWidth(5, 130);  // Total_Amount
  sheet.setColumnWidth(6, 140);  // Payment_Status
  sheet.setColumnWidth(7, 140);  // Payment_Method
  sheet.setColumnWidth(8, 130);  // Paid_Amount
  sheet.setColumnWidth(9, 120);  // Balance
  sheet.setColumnWidth(10, 120); // Recorded_By

  Logger.log('Created Purchases sheet');
  return sheet;
}

/**
 * Create Purchase_Items sheet
 */
function createPurchaseItemsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.PURCHASE_ITEMS);
  sheet.clear();

  const headers = ['Purchase_ID', 'Item_ID', 'Item_Name', 'Qty', 'Cost_Price', 'Line_Total'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120); // Purchase_ID
  sheet.setColumnWidth(2, 100); // Item_ID
  sheet.setColumnWidth(3, 250); // Item_Name
  sheet.setColumnWidth(4, 80);  // Qty
  sheet.setColumnWidth(5, 120); // Cost_Price
  sheet.setColumnWidth(6, 120); // Line_Total

  Logger.log('Created Purchase_Items sheet');
  return sheet;
}

/**
 * Create Quotations sheet
 */
function createQuotationsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.QUOTATIONS);
  sheet.clear();

  const headers = ['Quote_ID', 'Date', 'Customer_ID', 'Customer_Name', 'Valid_Until',
                   'Subtotal', 'Delivery', 'Discount', 'Total', 'Status',
                   'Prepared_By', 'Converted_Sale_ID'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 100);  // Quote_ID
  sheet.setColumnWidth(2, 150);  // Date
  sheet.setColumnWidth(3, 120);  // Customer_ID
  sheet.setColumnWidth(4, 180);  // Customer_Name
  sheet.setColumnWidth(5, 150);  // Valid_Until
  sheet.setColumnWidth(6, 120);  // Subtotal
  sheet.setColumnWidth(7, 100);  // Delivery
  sheet.setColumnWidth(8, 100);  // Discount
  sheet.setColumnWidth(9, 120);  // Total
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 120); // Prepared_By
  sheet.setColumnWidth(12, 150); // Converted_Sale_ID

  Logger.log('Created Quotations sheet');
  return sheet;
}

/**
 * Create Quotation_Items sheet
 */
function createQuotationItemsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.QUOTATION_ITEMS);
  sheet.clear();

  const headers = ['Quote_ID', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 100); // Quote_ID
  sheet.setColumnWidth(2, 100); // Item_ID
  sheet.setColumnWidth(3, 250); // Item_Name
  sheet.setColumnWidth(4, 80);  // Qty
  sheet.setColumnWidth(5, 120); // Unit_Price
  sheet.setColumnWidth(6, 120); // Line_Total

  Logger.log('Created Quotation_Items sheet');
  return sheet;
}

/**
 * Create Customer_Transactions sheet
 */
function createCustomerTransactionsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.CUSTOMER_TRANSACTIONS);
  sheet.clear();

  const headers = ['Transaction_ID', 'Customer_ID', 'Date', 'Type', 'Reference',
                   'Amount', 'Balance', 'Description', 'User'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 140); // Transaction_ID
  sheet.setColumnWidth(2, 120); // Customer_ID
  sheet.setColumnWidth(3, 150); // Date
  sheet.setColumnWidth(4, 120); // Type
  sheet.setColumnWidth(5, 120); // Reference
  sheet.setColumnWidth(6, 120); // Amount
  sheet.setColumnWidth(7, 120); // Balance
  sheet.setColumnWidth(8, 250); // Description
  sheet.setColumnWidth(9, 120); // User

  Logger.log('Created Customer_Transactions sheet');
  return sheet;
}

/**
 * Create Financials sheet
 */
function createFinancialsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.FINANCIALS);
  sheet.clear();

  const headers = ['DateTime', 'Transaction_ID', 'Type', 'Account', 'Description',
                   'Debit', 'Credit', 'Balance', 'User', 'Reference'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 150);  // DateTime
  sheet.setColumnWidth(2, 140);  // Transaction_ID
  sheet.setColumnWidth(3, 120);  // Type
  sheet.setColumnWidth(4, 120);  // Account
  sheet.setColumnWidth(5, 250);  // Description
  sheet.setColumnWidth(6, 120);  // Debit
  sheet.setColumnWidth(7, 120);  // Credit
  sheet.setColumnWidth(8, 120);  // Balance
  sheet.setColumnWidth(9, 120);  // User
  sheet.setColumnWidth(10, 140); // Reference

  Logger.log('Created Financials sheet');
  return sheet;
}

/**
 * Create Expenses sheet
 */
function createExpensesSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.EXPENSES);
  sheet.clear();

  const headers = ['Expense_ID', 'Date', 'Category', 'Description', 'Amount',
                   'Payment_Method', 'Account', 'Payee', 'Receipt_No', 'Status',
                   'Approved_By', 'Recorded_By'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120);  // Expense_ID
  sheet.setColumnWidth(2, 150);  // Date
  sheet.setColumnWidth(3, 150);  // Category
  sheet.setColumnWidth(4, 250);  // Description
  sheet.setColumnWidth(5, 120);  // Amount
  sheet.setColumnWidth(6, 140);  // Payment_Method
  sheet.setColumnWidth(7, 120);  // Account
  sheet.setColumnWidth(8, 150);  // Payee
  sheet.setColumnWidth(9, 120);  // Receipt_No
  sheet.setColumnWidth(10, 100); // Status
  sheet.setColumnWidth(11, 120); // Approved_By
  sheet.setColumnWidth(12, 120); // Recorded_By

  Logger.log('Created Expenses sheet');
  return sheet;
}

/**
 * Create Expense_Categories sheet
 */
function createExpenseCategoriesSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.EXPENSE_CATEGORIES);
  sheet.clear();

  const headers = ['Category_ID', 'Category_Name', 'Monthly_Budget', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 120); // Category_ID
  sheet.setColumnWidth(2, 200); // Category_Name
  sheet.setColumnWidth(3, 150); // Monthly_Budget
  sheet.setColumnWidth(4, 100); // Status

  Logger.log('Created Expense_Categories sheet');
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
 * Create Settings sheet
 */
function createSettingsSheet() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS);
  sheet.clear();

  const headers = ['Setting_Key', 'Setting_Value'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  formatHeaderRow(sheet, sheet.getRange(1, 1, 1, headers.length), headers.length);

  sheet.setColumnWidth(1, 250); // Setting_Key
  sheet.setColumnWidth(2, 350); // Setting_Value

  // Add default settings
  const settings = [
    ['Shop_Name', CONFIG.SHOP_NAME],
    ['Admin_Email', CONFIG.ADMIN_EMAIL],
    ['Currency', CONFIG.CURRENCY],
    ['Currency_Symbol', CONFIG.CURRENCY_SYMBOL],
    ['Date_Format', CONFIG.DATE_FORMAT],
    ['Timezone', 'Africa/Mogadishu'],
    ['PIN_Length', CONFIG.PIN_LENGTH],
    ['Use_Token_Auth', CONFIG.USE_TOKEN_AUTH],
    ['System_Version', '1.0.0'],
    ['Last_Updated', new Date()],
    ['Initialized_By', CONFIG.ADMIN_EMAIL]
  ];

  if (sheet.getLastRow() === 1) {
    sheet.getRange(2, 1, settings.length, 2).setValues(settings);
  }

  Logger.log('Created Settings sheet');
  return sheet;
}
