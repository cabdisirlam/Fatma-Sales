/**
 * Settings Management Module
 * Handles: System settings, expense categories, business information
 */

/**
 * Get setting value by key
 */
function getSetting(key) {
  return getSettingValue(key);
}

/**
 * Update setting value
 */
function updateSetting(key, value, user) {
  try {
    setSettingValue(key, value);

    logAudit(
      user || 'SYSTEM',
      'Settings',
      'Update',
      'Setting updated: ' + key,
      '',
      '',
      value
    );

    return {
      success: true,
      message: 'Setting updated successfully'
    };

  } catch (error) {
    logError('updateSetting', error);
    throw new Error('Error updating setting: ' + error.message);
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
 */
function updateBusinessInfo(businessData, user) {
  try {
    for (let key in businessData) {
      if (businessData[key] !== undefined) {
        setSettingValue(key, businessData[key]);
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
      message: 'Business information updated successfully'
    };

  } catch (error) {
    logError('updateBusinessInfo', error);
    throw new Error('Error updating business information: ' + error.message);
  }
}
