/**
 * Fatma Sales Management System
 * Workbook Manager - V3 System Initialization
 */

/**
 * Main setup and cleanup function for the V3 system.
 * - Enforces a single, hardcoded spreadsheet ID.
 * - Deletes any sheets not defined in the V3 schema.
 * - Creates missing V3 sheets.
 * - Adds missing columns to existing V3 sheets.
 * This is the primary function to run for a new installation or to force an update.
 */
function runV3Setup() {
  const SPREADSHEET_ID = '1m_IHBaz4PJZOo2sy5w4s27XQilQqGsFveMDRWt7tP-w';
  
  try {
    Logger.log('=== Starting Fatma System V3 Setup/Cleanup ===');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // --- Phase 1: Cleanup extraneous sheets ---
    const requiredSheetNames = new Set(Object.values(CONFIG.SHEETS));
    const allSheets = ss.getSheets();
    let deletedSheets = [];

    allSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      if (!requiredSheetNames.has(sheetName)) {
        ss.deleteSheet(sheet);
        deletedSheets.push(sheetName);
        Logger.log(`- Deleted extraneous sheet: "${sheetName}"`);
      }
    });

    if(deletedSheets.length > 0) {
        Logger.log(`Cleanup complete. Deleted ${deletedSheets.length} non-V3 sheets.`);
    } else {
        Logger.log('No extraneous sheets found to delete.');
    }

    // --- Phase 2: Initialize and verify all V3 sheets ---
    initializeSystemSheets(ss);

    // --- Phase 3: Finalization ---
    const usersSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
    if (usersSheet) ss.setActiveSheet(usersSheet);

    Logger.log('=== Fatma System V3 setup completed successfully! ===');
    
    try {
      let message = 'System setup complete. All sheets are aligned with the V3 schema.';
      if(deletedSheets.length > 0) {
          message += `\n\nDeleted non-V3 sheets: ${deletedSheets.join(', ')}.`;
      }
      SpreadsheetApp.getUi().alert('Setup Complete', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      Logger.log('UI context not available for final alert.');
    }

    return { success: true, spreadsheetUrl: ss.getUrl() };

  } catch (error) {
    Logger.log('ERROR in runV3Setup: ' + error.message);
    Logger.log(error.stack);
    try {
      SpreadsheetApp.getUi().alert('Setup Failed', 'An error occurred: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      Logger.log('UI context not available for error alert.');
    }
    return { success: false, message: error.message };
  }
}


/**
 * Master V3 Sheet Initializer
 * This function is the single source of truth for the system's sheet structure.
 * It creates missing sheets and safely adds missing columns to existing sheets.
 * @param {Spreadsheet} ss The spreadsheet object to initialize.
 */
function initializeSystemSheets(ss) {
  Logger.log('--- Running Master V3 Sheet Initializer ---');

  const v3Schema = {
    [CONFIG.SHEETS.USERS]: ['User_ID', 'Username', 'PIN', 'Role', 'Email', 'Phone', 'Status', 'Created_Date'],
    [CONFIG.SHEETS.SUPPLIERS]: ['Supplier_ID', 'Supplier_Name', 'Contact_Person', 'Phone', 'Email', 'Address', 'Opening_Balance', 'Total_Purchased', 'Total_Paid', 'Current_Balance', 'Payment_Terms', 'Status'],
    [CONFIG.SHEETS.CUSTOMERS]: ['Customer_ID', 'Customer_Name', 'Phone', 'Email', 'Location', 'KRA_PIN', 'Customer_Type', 'Credit_Limit', 'Current_Balance', 'Opening_Balance', 'Total_Paid', 'Total_Purchases', 'Last_Purchase_Date', 'Loyalty_Points', 'Status', 'Created_Date', 'Created_By'],
    [CONFIG.SHEETS.INVENTORY]: ['Item_ID', 'Item_Name', 'Category', 'Cost_Price', 'Selling_Price', 'Current_Qty', 'Reorder_Level', 'Supplier', 'Last_Updated', 'Updated_By', 'Batch_ID', 'Date_Received'],
    [CONFIG.SHEETS.SALES]: ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Customer_Name', 'Item_ID', 'Item_Name', 'Batch_ID', 'Qty', 'Unit_Price', 'Line_Total', 'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total', 'Payment_Mode', 'Sold_By', 'Location', 'KRA_PIN', 'Status', 'Valid_Until', 'Converted_Sale_ID'],
    [CONFIG.SHEETS.PURCHASES]: ['Purchase_ID', 'Date', 'Supplier_ID', 'Supplier_Name', 'Item_ID', 'Item_Name', 'Qty', 'Cost_Price', 'Line_Total', 'Total_Amount', 'Payment_Status', 'Payment_Method', 'Paid_Amount', 'Balance', 'Recorded_By'],
    [CONFIG.SHEETS.FINANCIALS]: ['Transaction_ID', 'DateTime', 'Type', 'Customer_ID', 'Category', 'Account', 'Description', 'Amount', 'Debit', 'Credit', 'Balance', 'Payment_Method', 'Payee', 'Receipt_No', 'Reference', 'Status', 'Approved_By', 'User'],
    [CONFIG.SHEETS.QUOTATIONS]: ['Quotation_ID', 'DateTime', 'Customer_ID', 'Customer_Name', 'Item_ID', 'Item_Name', 'Batch_ID', 'Qty', 'Unit_Price', 'Line_Total', 'Subtotal', 'Delivery_Charge', 'Discount', 'Grand_Total', 'Created_By', 'Location', 'KRA_PIN', 'Status', 'Valid_Until', 'Converted_Sale_ID'],
    [CONFIG.SHEETS.PURCHASE_ORDERS]: ['PO_ID', 'Date_Created', 'Supplier_ID', 'Supplier_Name', 'Expected_Date', 'Total_Amount', 'Status', 'Created_By', 'Notes', 'Goods_Received_Ref'],
    [CONFIG.SHEETS.CHART_OF_ACCOUNTS]: ['Account_Code', 'Account_Name', 'Type', 'Category', 'Description', 'Balance'],
    [CONFIG.SHEETS.AUDIT_TRAIL]: ['Timestamp', 'User', 'Module', 'Action', 'Details', 'Session_ID', 'Before_Value', 'After_Value'],
    [CONFIG.SHEETS.SETTINGS]: ['Setting_Key', 'Setting_Value'],
    [CONFIG.SHEETS.MASTER_DATA]: ['Master_ID', 'Item_Name', 'Category', 'Description', 'Status']
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
            .setBackground("#2c3e50") // Using hex from CONFIG as it might not be available
            .setFontColor('#FFFFFF')
            .setFontWeight('bold')
            .setHorizontalAlignment('center');
        sheet.setFrozenRows(1);
    } catch(e) {
        Logger.log(`Could not format header for sheet: ${sheet.getName()}. Error: ${e.message}`);
    }
}

/**
 * Migration: Add Batch_ID column in correct position for Sales and Quotations
 * IMPORTANT: Run this ONCE after upgrading to batch tracking system
 * This function inserts Batch_ID column at position 8 (after Item_Name)
 */
function migrateBatchIDColumn() {
  try {
    const ss = getSpreadsheet();
    const sheetsToMigrate = ['Sales', 'Quotations'];
    const batchIDPosition = 8; // Column H (0-indexed: 7, but insertColumns uses 1-indexed: 8)
    const batchIDIndex = 7; // For checking existing data (0-indexed)

    Logger.log('=== Starting Batch_ID Column Migration ===');

    sheetsToMigrate.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`Sheet "${sheetName}" not found. Skipping.`);
        return;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const batchIDCol = headers.indexOf('Batch_ID');

      if (batchIDCol === batchIDIndex) {
        Logger.log(`✓ "${sheetName}": Batch_ID already in correct position (column ${batchIDPosition}).`);
        return;
      }

      if (batchIDCol > batchIDIndex) {
        // Batch_ID exists but in wrong position (probably at end)
        Logger.log(`"${sheetName}": Batch_ID found at wrong position (column ${batchIDCol + 1}). Fixing...`);

        // Delete the misplaced column
        sheet.deleteColumn(batchIDCol + 1);

        // Insert new column at correct position
        sheet.insertColumnBefore(batchIDPosition);
        sheet.getRange(1, batchIDPosition).setValue('Batch_ID');

        // Set default value for existing rows
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const defaultValues = Array(lastRow - 1).fill(['UNKNOWN']);
          sheet.getRange(2, batchIDPosition, lastRow - 1, 1).setValues(defaultValues);
        }

        Logger.log(`✓ "${sheetName}": Moved Batch_ID to correct position.`);
      } else if (batchIDCol === -1) {
        // Batch_ID doesn't exist, insert it
        Logger.log(`"${sheetName}": Batch_ID missing. Adding at position ${batchIDPosition}...`);

        sheet.insertColumnBefore(batchIDPosition);
        sheet.getRange(1, batchIDPosition).setValue('Batch_ID');

        // Set default value for existing rows
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const defaultValues = Array(lastRow - 1).fill(['UNKNOWN']);
          sheet.getRange(2, batchIDPosition, lastRow - 1, 1).setValues(defaultValues);
        }

        Logger.log(`✓ "${sheetName}": Added Batch_ID column.`);
      }

      // Reformat header
      const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
      formatHeader(sheet, headerRange);
    });

    Logger.log('=== Batch_ID Migration Complete ===');

    return {
      success: true,
      message: 'Batch_ID column migration completed successfully. Please refresh your browser.'
    };

  } catch (error) {
    logError('migrateBatchIDColumn', error);
    throw new Error('Migration failed: ' + error.message);
  }
}
