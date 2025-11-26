/**
 * Settings Management Module
 * Handles: System settings, expense categories, business information
 */

/**
 * List of allowed setting keys to prevent arbitrary key/value injection
 */
const ALLOWED_SETTINGS_KEYS = [
  'Shop_Name',
  'Admin_Email',
  'Currency',
  'Currency_Symbol',
  'Date_Format',
  'Timezone',
  'System_Version',
  'Tax_Rate',
  'Include_Shop_Logo',
  'Receipt_Header',
  'Receipt_Footer',
  'Low_Stock_Threshold',
  'Enable_SMS',
  'Enable_Email',
  'Backup_Enabled',
  'Auto_Backup_Days'
];

/**
 * Validate if a setting key is allowed
 */
function isValidSettingKey(key) {
  // Allow expense categories
  if (key && key.startsWith('Expense_Category_')) {
    return true;
  }
  return ALLOWED_SETTINGS_KEYS.includes(key);
}

/**
 * Get setting value by key
 */
function getSetting(key) {
  return getSettingValue(key);
}

/**
 * Get business information
 */
function getBusinessInfo() {
  try {
    return {
      Shop_Name: getSetting('Shop_Name') || CONFIG.SHOP_NAME,
      Admin_Email: getSetting('Admin_Email') || CONFIG.ADMIN_EMAIL,
      Currency: getSetting('Currency') || CONFIG.CURRENCY,
      Currency_Symbol: getSetting('Currency_Symbol') || CONFIG.CURRENCY_SYMBOL,
      Tax_Rate: getSetting('Tax_Rate') || 0,
      Receipt_Header: getSetting('Receipt_Header') || CONFIG.SHOP_NAME,
      Receipt_Footer: getSetting('Receipt_Footer') || 'Thank you for your business!',
      Include_Shop_Logo: getSetting('Include_Shop_Logo'),
      Date_Format: getSetting('Date_Format') || CONFIG.DATE_FORMAT,
      Timezone: getSetting('Timezone') || 'Africa/Mogadishu',
      System_Version: getSetting('System_Version') || '2.0.0'
    };
  } catch (error) {
    logError('getBusinessInfo', error);
    return {};
  }
}

/**
 * Update business information
 * DEBUGGED VERSION: Logs specific keys that fail
 */
function updateBusinessInfo(businessData, user) {
  try {
    Logger.log('Attempting to save settings: ' + JSON.stringify(businessData));

    const invalidKeys = [];

    for (let key in businessData) {
      // Skip undefined values
      if (businessData[key] === undefined) continue;

      if (!isValidSettingKey(key)) {
        invalidKeys.push(key);
        Logger.log('Blocked invalid setting key: ' + key);
      } else {
        // Valid key, save it
        let value = businessData[key];

        // Special handling for Logo boolean to ensure it saves correctly
        if (key === 'Include_Shop_Logo') {
          value = (value === true || value === 'true' || value === 'on');
        }

        setSettingValue(key, value);
      }
    }

    if (invalidKeys.length > 0) {
      Logger.log('Warning: Some settings were skipped: ' + invalidKeys.join(', '));
      // We don't throw error here to allow valid settings to save,
      // but we log it.
    }

    logAudit(
      user || 'SYSTEM',
      'Settings',
      'Update Business Info',
      'Business information updated',
      '',
      '',
      JSON.stringify(businessData)
    );

    return {
      success: true,
      message: 'Settings saved successfully'
    };
  } catch (error) {
    logError('updateBusinessInfo', error);
    throw new Error('Error updating business information: ' + error.message);
  }
}

/**
 * Add expense category
 */
function addExpenseCategory(categoryName, budget, user) {
  try {
    const key = 'Expense_Category_' + categoryName;
    setSettingValue(key, budget || 0);

    logAudit(
      user || 'SYSTEM',
      'Settings',
      'Add Expense Category',
      'New expense category added: ' + categoryName,
      '',
      '',
      budget
    );

    return {
      success: true,
      message: 'Expense category added successfully'
    };
  } catch (error) {
    logError('addExpenseCategory', error);
    throw new Error('Error adding expense category: ' + error.message);
  }
}

// Keep existing addExpenseCategory, getSettingValue, setSettingValue logic...
// If setSettingValue is missing in this file context, here it is again for safety:

function setSettingValue(key, value) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(); // Direct access
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    let found = false;

    // Look for existing key
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }

    // Key not found, add new row
    if (!found) {
      sheet.appendRow([key, value]);
    }
  } catch (error) {
    Logger.log('Error in setSettingValue: ' + error.message);
    throw error;
  }
}

function getSettingValue(key) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }
    return null;
  } catch (error) {
    Logger.log('Error in getSettingValue: ' + error.message);
    return null;
  }
}
