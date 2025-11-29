/**
 * Settings Management Module
 * Handles: System settings, business information configuration
 */

const ALLOWED_SETTINGS_KEYS = [
  'Shop_Name',
  'Admin_Email',
  'Currency',
  'Currency_Symbol',
  'Currency_Rounding', // Added for rounding feature
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

function isValidSettingKey(key) {
  // We removed expense categories from UI, but keeping backend logic safe
  if (key && key.startsWith('Expense_Category_')) {
    return true;
  }
  return ALLOWED_SETTINGS_KEYS.includes(key);
}

function getSetting(key) {
  return getSettingValue(key);
}

/**
 * Get business information for the Settings UI
 */
function getBusinessInfo() {
  try {
    const includeLogo = getSetting('Include_Shop_Logo');
    const rounding = getSetting('Currency_Rounding');
    
    return {
      Shop_Name: getSetting('Shop_Name') || CONFIG.SHOP_NAME,
      Admin_Email: getSetting('Admin_Email') || CONFIG.ADMIN_EMAIL,
      Currency: getSetting('Currency') || 'KES',
      Currency_Symbol: getSetting('Currency_Symbol') || 'Ksh',
      Currency_Rounding: rounding === true || rounding === 'true' || rounding === 'TRUE',
      Tax_Rate: getSetting('Tax_Rate') || 0,
      Receipt_Header: getSetting('Receipt_Header') || 'Beipoa Kenya',
      Receipt_Footer: getSetting('Receipt_Footer') || 'Pata Kila Kitu Na Bei Poa',
      Include_Shop_Logo: includeLogo === true || includeLogo === 'true' || includeLogo === 'TRUE',
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
 * Update business information from the Settings UI
 */
function updateBusinessInfo(businessData, user) {
  try {
    // 1. Strictly enforce currency for this system version
    businessData.Currency = 'KES';
    businessData.Currency_Symbol = 'Ksh';
    
    // Log for debugging
    Logger.log('Saving Settings: ' + JSON.stringify(businessData));

    for (let key in businessData) {
      // Skip undefined, but allow empty strings (to clear a setting)
      if (businessData[key] === undefined) continue;

      if (!isValidSettingKey(key)) {
        Logger.log('Blocked invalid setting key: ' + key);
      } else {
        // Coerce boolean for rounding before saving
        if (key === 'Currency_Rounding') {
            const valueToSave = businessData[key] === true || String(businessData[key]).toLowerCase() === 'true';
            setSettingValue(key, valueToSave);
        } else {
            setSettingValue(key, businessData[key]);
        }
      }
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

// ==========================================
// LOW LEVEL DB FUNCTIONS
// ==========================================

function setSettingValue(key, value) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) throw new Error("Settings sheet not found");

    const data = sheet.getDataRange().getValues();
    let found = false;

    // Look for existing key (Skip header row)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        // Row is i+1
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
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    // Skip header row 0
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
