/**
 * Fatma Sales Management System
 * Workbook Manager - V3 System Initialization
 */

/**
 * Main setup function - creates or updates the Fatma System workbook.
 * This is the primary function to run for a new installation.
 */
function setupFatmaSystem() {
  try {
    Logger.log('=== Starting Fatma System Setup/Update ===');
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Store or verify spreadsheet ID
    const scriptProperties = PropertiesService.getScriptProperties();
    if (!scriptProperties.getProperty('SPREADSHEET_ID')) {
        scriptProperties.setProperty('SPREADSHEET_ID', ss.getId());
    }
    
    ss.rename(CONFIG.WORKBOOK_NAME);
    Logger.log('Workbook name set to: ' + CONFIG.WORKBOOK_NAME);

    // Initialize all sheets using the master V3 function
    initializeSystemSheets();

    // Clean up default "Sheet1" if it exists
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
      Logger.log('Removed default "Sheet1".');
    }

    // Set active sheet to Dashboard or Users for better user experience
    const usersSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
    if (usersSheet) ss.setActiveSheet(usersSheet);

    Logger.log('=== Fatma System setup completed successfully! ===');
    Logger.log('Spreadsheet URL: ' + ss.getUrl());

    SpreadsheetApp.getUi().alert(
        'Setup Complete',
        'Fatma System has been successfully initialized or updated to the V3 schema.',
        SpreadsheetApp.getUi().ButtonSet.OK
    );

    return { success: true, spreadsheetUrl: ss.getUrl() };
  } catch (error) {
    Logger.log('ERROR in setupFatmaSystem: ' + error.message);
    Logger.log(error.stack);
    SpreadsheetApp.getUi().alert('Setup Failed', 'An error occurred: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, message: error.message };
  }
}

/**
 * Master V3 Sheet Initializer
 * This function is the single source of truth for the system's sheet structure.
 * It creates missing sheets and safely adds missing columns to existing sheets.
 */
function initializeSystemSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('--- Running Master V3 Sheet Initializer ---');

  const v3Schema = {
    [CONFIG.SHEETS.USERS]: ['User_ID', 'Username', 'PIN', 'Role', 'Email', 'Phone', 'Status', 'Created_Date'],
    [CONFIG.SHEETS.SUPPLIERS]: ['Supplier_ID', 'Supplier_Name', 'Contact_Person', 'Phone', 'Email', 'Address', 'Opening_Balance', 'Total_Purchased', 'Total_Paid', 'Current_Balance', 'Payment_Terms', 'Status'],
    [CONFIG.SHEETS.CUSTOMERS]: ['Customer_ID', 'Customer_Name', 'Phone', 'Email', 'Location', 'KRA_PIN', 'Customer_Type', 'Credit_Limit', 'Current_Balance', 'Total_Purchases', 'Last_Purchase_Date', 'Loyalty_Points', 'Status', 'Created_Date', 'Created_By'],
    [CONFIG.SHEETS.INVENTORY]: ['Item_ID', 'Item_Name', 'Category', 'Cost_Price', 'Selling_Price', 'Current_Qty', 'Reorder_Level', 'Supplier', 'Last_Updated', 'Updated_By', 'Batch_ID', 'Date_Received'],
    [CONFIG.SHEETS.SALES]: ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Customer_Name', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total', 'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total', 'Payment_Mode', 'Sold_By', 'Location', 'KRA_PIN', 'Status', 'Valid_Until', 'Converted_Sale_ID'],
    [CONFIG.SHEETS.PURCHASES]: ['Purchase_ID', 'Date', 'Supplier_ID', 'Supplier_Name', 'Item_ID', 'Item_Name', 'Qty', 'Cost_Price', 'Line_Total', 'Total_Amount', 'Payment_Status', 'Payment_Method', 'Paid_Amount', 'Balance', 'Recorded_By'],
    [CONFIG.SHEETS.FINANCIALS]: ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Category', 'Account', 'Description', 'Amount', 'Debit', 'Credit', 'Balance', 'Payment_Method', 'Payee', 'Receipt_No', 'Reference', 'Status', 'Approved_By', 'User'],
    [CONFIG.SHEETS.QUOTATIONS]: ['Quotation_ID', 'DateTime', 'Customer_ID', 'Customer_Name', 'Item_ID', 'Item_Name', 'Qty', 'Unit_Price', 'Line_Total', 'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total', 'Created_By', 'Location', 'KRA_PIN', 'Status', 'Valid_Until', 'Converted_Sale_ID'],
    [CONFIG.SHEETS.PURCHASE_ORDERS]: ['PO_ID', 'Date_Created', 'Supplier_ID', 'Supplier_Name', 'Expected_Date', 'Total_Amount', 'Status', 'Created_By', 'Notes', 'Goods_Received_Ref'],
    [CONFIG.SHEETS.CHART_OF_ACCOUNTS]: ['Account_Code', 'Account_Name', 'Type', 'Category', 'Description', 'Balance'],
    [CONFIG.SHEETS.AUDIT_TRAIL]: ['Timestamp', 'User', 'Module', 'Action', 'Details', 'Session_ID', 'Before_Value', 'After_Value'],
    [CONFIG.SHEETS.SETTINGS]: ['Setting_Key', 'Setting_Value']
  };

  for (const sheetName in v3Schema) {
    const requiredHeaders = v3Schema[sheetName];
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // 1. Sheet is missing: Create it and set headers
      Logger.log(`"${sheetName}" sheet not found. Creating it...`);
      sheet = ss.insertSheet(sheetName);
      const headerRange = sheet.getRange(1, 1, 1, requiredHeaders.length);
      headerRange.setValues([requiredHeaders]);
      formatHeader(sheet, headerRange);
      Logger.log(`✓ Created "${sheetName}" with ${requiredHeaders.length} columns.`);
    } else {
      // 2. Sheet exists: Check and add missing columns
      Logger.log(`"${sheetName}" sheet found. Verifying columns...`);
      const lastCol = sheet.getLastColumn();
      const currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      const currentHeaderSet = new Set(currentHeaders);
      let added = false;
      
      requiredHeaders.forEach(header => {
        if (!currentHeaderSet.has(header)) {
          Logger.log(`  -> Missing column in "${sheetName}": ${header}. Adding it...`);
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          added = true;
        }
      });
      
      if (added) {
          const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
          formatHeader(sheet, headerRange);
          Logger.log(`✓ Updated "${sheetName}" with missing columns.`);
      } else {
          Logger.log(`  ✓ "${sheetName}" is already up to date.`);
      }
    }
  }
}

/**
 * Helper function to apply standard formatting to a header row.
 */
function formatHeader(sheet, headerRange) {
    try {
        headerRange
            .setBackground(CONFIG.COLORS.HEADER)
            .setFontColor('#FFFFFF')
            .setFontWeight('bold')
            .setHorizontalAlignment('center');
        sheet.setFrozenRows(1);
    } catch(e) {
        Logger.log(`Could not format header for sheet: ${sheet.getName()}. Error: ${e.message}`);
    }
}
