/**
 * Admin Management Tools
 * Utilities for system administrators to manage and monitor the system
 */

// =====================================================
// SYSTEM HEALTH & MONITORING
// =====================================================

/**
 * Get comprehensive system health report
 * @returns {object} Complete system status
 */
function getSystemHealth() {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      overall: 'HEALTHY',
      issues: [],

      // Database stats
      database: getDatabaseStats(),

      // Cache stats
      cache: getCacheStats(),

      // Backup status
      backup: getBackupStatus(),

      // Authentication stats
      auth: getAuthStats(),

      // Performance metrics
      performance: getPerformanceMetrics(),

      // Configuration
      config: {
        shop: CONFIG.SHOP_NAME,
        version: '2.1.0',
        timezone: Session.getScriptTimeZone(),
        cacheEnabled: true,
        rateLimitingEnabled: CONFIG.ENABLE_RATE_LIMITING,
        backupEnabled: BACKUP_CONFIG.ENABLED
      }
    };

    // Check for issues
    if (health.database.totalRecords > 50000) {
      health.issues.push('⚠️ Large dataset: Consider archiving old data');
      health.overall = 'WARNING';
    }

    if (!health.backup.automated) {
      health.issues.push('⚠️ Automated backups not enabled');
      health.overall = 'WARNING';
    }

    if (health.issues.length === 0) {
      health.issues.push('✅ No issues detected');
    }

    return health;

  } catch (error) {
    logError('getSystemHealth', error);
    return {
      overall: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Get database statistics
 */
function getDatabaseStats() {
  try {
    const stats = {
      sheets: {},
      totalRecords: 0,
      totalSize: 0
    };

    Object.entries(CONFIG.SHEETS).forEach(([key, sheetName]) => {
      try {
        const sheet = getSheet(sheetName);
        const lastRow = sheet.getLastRow();
        const recordCount = lastRow > 1 ? lastRow - 1 : 0; // Exclude header

        stats.sheets[sheetName] = {
          records: recordCount,
          columns: sheet.getLastColumn(),
          lastUpdated: sheet.getRange(lastRow, 1).getCell(1, 1).getValue()
        };

        stats.totalRecords += recordCount;

      } catch (error) {
        stats.sheets[sheetName] = { error: error.message };
      }
    });

    return stats;

  } catch (error) {
    logError('getDatabaseStats', error);
    return { error: error.message };
  }
}

/**
 * Get authentication statistics
 */
function getAuthStats() {
  try {
    // Get audit trail for authentication events
    const auditSheet = getSheet('Audit_Trail');
    const data = auditSheet.getDataRange().getValues();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayLogins = 0;
    let todayFailures = 0;
    let todayLockouts = 0;

    // Count from audit trail (recent 1000 records for performance)
    const recentRecords = data.slice(-1000);

    recentRecords.forEach(row => {
      const timestamp = new Date(row[0]); // Assuming first column is timestamp
      const action = row[2]; // Assuming action column

      if (timestamp >= today) {
        if (action && action.toLowerCase().includes('login')) {
          if (action.includes('successful')) todayLogins++;
          if (action.includes('failed')) todayFailures++;
          if (action.includes('blocked') || action.includes('locked')) todayLockouts++;
        }
      }
    });

    return {
      today: {
        logins: todayLogins,
        failures: todayFailures,
        lockouts: todayLockouts
      },
      rateLimitingEnabled: CONFIG.ENABLE_RATE_LIMITING,
      maxAttempts: CONFIG.MAX_LOGIN_ATTEMPTS,
      lockoutDuration: CONFIG.LOCKOUT_DURATION_MINUTES + ' minutes'
    };

  } catch (error) {
    logError('getAuthStats', error);
    return { error: error.message };
  }
}

/**
 * Get performance metrics
 */
function getPerformanceMetrics() {
  try {
    const ss = getSpreadsheet();

    return {
      spreadsheetId: ss.getId(),
      totalSheets: ss.getSheets().length,
      scriptQuota: {
        emailQuotaRemaining: MailApp.getRemainingDailyQuota(),
        timezone: Session.getScriptTimeZone()
      },
      cacheEnabled: true,
      batchWriteEnabled: true
    };

  } catch (error) {
    logError('getPerformanceMetrics', error);
    return { error: error.message };
  }
}

// =====================================================
// DATA MANAGEMENT TOOLS
// =====================================================

/**
 * Clean duplicate records
 * ⚠️ Use with caution!
 *
 * @param {string} sheetName - Sheet to clean
 * @param {string} uniqueColumn - Column that should be unique
 * @returns {object} Cleanup result
 */
function cleanDuplicates(sheetName, uniqueColumn) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const columnIndex = headers.indexOf(uniqueColumn);
    if (columnIndex === -1) {
      throw new Error('Column not found: ' + uniqueColumn);
    }

    const seen = new Set();
    const duplicateRows = [];

    // Find duplicates (keep first occurrence)
    for (let i = 1; i < data.length; i++) {
      const value = data[i][columnIndex];

      if (seen.has(value)) {
        duplicateRows.push(i + 1); // +1 for 1-indexed rows
      } else {
        seen.add(value);
      }
    }

    if (duplicateRows.length === 0) {
      return {
        success: true,
        message: 'No duplicates found',
        duplicatesRemoved: 0
      };
    }

    // Soft delete duplicates instead of hard delete
    duplicateRows.forEach(rowNum => {
      const statusIndex = headers.indexOf('Status');
      if (statusIndex !== -1) {
        sheet.getRange(rowNum, statusIndex + 1).setValue('Duplicate');
      }
    });

    logAudit(
      'SYSTEM',
      sheetName,
      'Clean Duplicates',
      `Marked ${duplicateRows.length} duplicate records`,
      '',
      '',
      uniqueColumn
    );

    return {
      success: true,
      message: `Marked ${duplicateRows.length} duplicates`,
      duplicatesRemoved: duplicateRows.length
    };

  } catch (error) {
    logError('cleanDuplicates', error);
    return {
      success: false,
      message: 'Cleanup failed: ' + error.message
    };
  }
}

/**
 * Rebuild all caches
 * Useful after data changes or corruption
 */
function rebuildAllCaches() {
  try {
    Logger.log('===== REBUILDING ALL CACHES =====');

    // Clear all existing caches
    clearAllCaches();

    // Warm up caches
    const result = warmUpCaches();

    Logger.log('✅ Cache rebuild complete');

    return {
      success: true,
      message: 'All caches rebuilt successfully',
      details: result
    };

  } catch (error) {
    logError('rebuildAllCaches', error);
    return {
      success: false,
      message: 'Cache rebuild failed: ' + error.message
    };
  }
}

/**
 * Reset user login attempts (unlock account)
 * @param {string} email - User email to unlock
 */
function unlockUserAccount(email) {
  try {
    clearFailedAttempts(email);

    logAudit(
      'ADMIN',
      'Authentication',
      'Unlock Account',
      `Account manually unlocked: ${email}`,
      '',
      '',
      ''
    );

    return {
      success: true,
      message: `Account unlocked: ${email}`
    };

  } catch (error) {
    logError('unlockUserAccount', error);
    return {
      success: false,
      message: 'Unlock failed: ' + error.message
    };
  }
}

/**
 * Get system logs (recent errors and warnings)
 * @param {number} limit - Max records to return (default: 50)
 */
function getSystemLogs(limit) {
  try {
    const auditSheet = getSheet('Audit_Trail');
    const data = auditSheet.getDataRange().getValues();

    const maxRecords = limit || 50;
    const recentData = data.slice(-maxRecords);

    const logs = recentData.map(row => ({
      timestamp: row[0],
      user: row[1],
      module: row[2],
      action: row[3],
      details: row[4],
      sessionId: row[5]
    }));

    return logs.reverse(); // Most recent first

  } catch (error) {
    logError('getSystemLogs', error);
    return [];
  }
}

/**
 * Export all data to JSON
 * Useful for migrations or backups
 */
function exportAllDataToJSON() {
  try {
    const allData = {};

    Object.values(CONFIG.SHEETS).forEach(sheetName => {
      try {
        const sheet = getSheet(sheetName);
        const data = sheet.getDataRange().getValues();

        if (data.length > 1) {
          const headers = data[0];
          const records = [];

          for (let i = 1; i < data.length; i++) {
            const record = {};
            headers.forEach((header, idx) => {
              let value = data[i][idx];
              if (value instanceof Date) {
                value = value.toISOString();
              }
              record[header] = value;
            });
            records.push(record);
          }

          allData[sheetName] = records;
        }

      } catch (error) {
        allData[sheetName] = { error: error.message };
      }
    });

    // Save to Drive
    const backupFolder = getOrCreateBackupFolder();
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
    const fileName = `FullExport_${timestamp}.json`;

    const json = JSON.stringify(allData, null, 2);
    const file = backupFolder.createFile(fileName, json, MimeType.PLAIN_TEXT);

    Logger.log('✅ Exported all data to JSON: ' + file.getUrl());

    return {
      success: true,
      fileName: fileName,
      url: file.getUrl(),
      size: (file.getSize() / (1024 * 1024)).toFixed(2) + ' MB'
    };

  } catch (error) {
    logError('exportAllDataToJSON', error);
    return {
      success: false,
      message: 'Export failed: ' + error.message
    };
  }
}

// =====================================================
// MAINTENANCE TASKS
// =====================================================

/**
 * Run daily maintenance tasks
 * Setup as a daily trigger
 */
function runDailyMaintenance() {
  try {
    Logger.log('===== DAILY MAINTENANCE START =====');

    const results = {
      timestamp: new Date().toISOString(),
      tasks: []
    };

    // Task 1: Clear expired cache entries (automatic)
    results.tasks.push({ task: 'Cache cleanup', status: 'Automatic' });

    // Task 2: Check backup status
    const backupStatus = getBackupStatus();
    if (backupStatus.lastBackups && backupStatus.lastBackups.length > 0) {
      results.tasks.push({ task: 'Backup check', status: '✅ OK' });
    } else {
      results.tasks.push({ task: 'Backup check', status: '⚠️ No recent backups' });
    }

    // Task 3: Get database stats
    const dbStats = getDatabaseStats();
    results.tasks.push({
      task: 'Database stats',
      status: '✅ ' + dbStats.totalRecords + ' records'
    });

    // Task 4: Check for system health issues
    const health = getSystemHealth();
    results.tasks.push({
      task: 'System health',
      status: health.overall
    });

    Logger.log('✅ Daily maintenance complete');
    Logger.log(JSON.stringify(results, null, 2));

    // Email summary to admin if there are warnings
    if (health.overall !== 'HEALTHY') {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: '⚠️ System Health Alert - ' + CONFIG.SHOP_NAME,
        body: `Daily maintenance report: ${new Date().toLocaleDateString()}\n\n` +
              `System Status: ${health.overall}\n\n` +
              `Issues:\n${health.issues.join('\n')}\n\n` +
              `Total Records: ${dbStats.totalRecords}`
      });
    }

    return results;

  } catch (error) {
    logError('runDailyMaintenance', error);
    return { error: error.message };
  }
}

/**
 * Setup daily maintenance trigger
 */
function setupDailyMaintenance() {
  try {
    // Delete existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'runDailyMaintenance') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Create new trigger at 1 AM daily
    ScriptApp.newTrigger('runDailyMaintenance')
      .timeBased()
      .atHour(1)
      .everyDays(1)
      .create();

    Logger.log('✅ Daily maintenance enabled: Every day at 1:00 AM');

    return {
      success: true,
      message: 'Daily maintenance scheduled'
    };

  } catch (error) {
    logError('setupDailyMaintenance', error);
    return {
      success: false,
      message: 'Setup failed: ' + error.message
    };
  }
}

// =====================================================
// QUICK ACCESS ADMIN FUNCTIONS
// =====================================================

/**
 * Admin dashboard - one function to get all key info
 */
function getAdminDashboard() {
  return {
    health: getSystemHealth(),
    recentLogs: getSystemLogs(20),
    backupStatus: getBackupStatus(),
    databaseStats: getDatabaseStats()
  };
}

/**
 * Emergency system reset (clear all caches, rebuild)
 * ⚠️ Use only if system is malfunctioning
 */
function emergencySystemReset() {
  try {
    Logger.log('===== EMERGENCY SYSTEM RESET =====');

    // Clear all caches
    clearAllCaches();

    // Rebuild caches
    warmUpCaches();

    // Clear any stuck locks (if implemented)
    // Note: LockService locks auto-expire

    logAudit(
      'ADMIN',
      'System',
      'Emergency Reset',
      'Emergency system reset executed',
      '',
      '',
      ''
    );

    return {
      success: true,
      message: 'System reset complete. Caches rebuilt.'
    };

  } catch (error) {
    logError('emergencySystemReset', error);
    return {
      success: false,
      message: 'Reset failed: ' + error.message
    };
  }
}

// =====================================================
// ACCOUNTING UTILITIES
// =====================================================

/**
 * One-click Chart of Accounts update for returns/credit notes.
 * Adds missing Accounts Receivable and Sales Returns accounts if absent.
 */
function upgradeChartOfAccountsForReturns() {
  try {
    const result = ensureReturnAccountsInitialized();
    return {
      success: result && result.success !== false,
      added: (result && result.added) || [],
      message: result && result.message ? result.message : 'Chart of Accounts checked/updated'
    };
  } catch (error) {
    logError('upgradeChartOfAccountsForReturns', error);
    return { success: false, message: error.message };
  }
}
