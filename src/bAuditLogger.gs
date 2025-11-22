/**
 * Audit Logger - Logs all system actions to Audit_Trail sheet
 */

/**
 * Logs an action to the Audit Trail
 * @param {string} user - Username or email performing the action
 * @param {string} module - Module/section of the system
 * @param {string} action - Action performed (Login, Create, Update, Delete, etc.)
 * @param {string} details - Details of the action
 * @param {string} sessionId - Session ID if available
 * @param {string} oldValue - Previous value (for updates)
 * @param {string} newValue - New value (for updates)
 */
function logAction(user, module, action, details, sessionId, oldValue, newValue) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('Audit_Trail');

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('Audit_Trail');
      sheet.getRange(1, 1, 1, 8).setValues([[
        'Timestamp', 'User', 'Module', 'Action', 'Details', 'Session_ID', 'Before_Value', 'After_Value'
      ]]);
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Add audit entry
    sheet.appendRow([
      new Date(),
      user || 'SYSTEM',
      module || '',
      action || '',
      details || '',
      sessionId || '',
      oldValue || '',
      newValue || ''
    ]);

    return true;
  } catch (error) {
    Logger.log('AUDIT LOG ERROR: ' + error.message);
    Logger.log(error.stack);
    return false;
  }
}
