/**
 * Automated Backup Service
 * Creates daily backups of all system data to Google Drive
 * Retains backups for configurable period (default: 30 days)
 */

// =====================================================
// BACKUP CONFIGURATION
// =====================================================

const BACKUP_CONFIG = {
  ENABLED: true,
  BACKUP_FOLDER_NAME: 'Fatma System Backups',
  RETENTION_DAYS: 30,           // Keep backups for 30 days
  BACKUP_TIME_HOUR: 2,          // Run at 2 AM daily
  INCLUDE_AUDIT_TRAIL: false,   // Audit trail can be very large
  COMPRESSION_ENABLED: false,   // Future: ZIP compression

  // What to backup
  SHEETS_TO_BACKUP: [
    'Users',
    'Customers',
    'Suppliers',
    'Inventory',
    'Sales',
    'Purchases',
    'Financials',
    'Quotations',
    'Chart_of_Accounts',
    'Settings',
    'Master_Data'
    // 'Audit_Trail' - Optional, can be huge
  ]
};

// =====================================================
// BACKUP FUNCTIONS
// =====================================================

/**
 * Create a full backup of all system data
 * Call this manually or via time-based trigger
 *
 * @returns {object} Backup result with file ID and details
 */
function createBackup() {
  try {
    Logger.log('===== STARTING BACKUP =====');
    const startTime = new Date();

    if (!BACKUP_CONFIG.ENABLED) {
      return { success: false, message: 'Backups are disabled in configuration' };
    }

    // Get or create backup folder
    const backupFolder = getOrCreateBackupFolder();

    // Get source spreadsheet
    const ss = getSpreadsheet();
    const sourceId = ss.getId();

    // Create backup filename with timestamp
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HHmmss'
    );
    const backupName = `Fatma_Backup_${timestamp}`;

    // Copy entire spreadsheet to backup folder
    const backupFile = DriveApp.getFileById(sourceId).makeCopy(backupName, backupFolder);
    const backupId = backupFile.getId();

    // Add metadata description
    backupFile.setDescription(
      `Automated backup created on ${new Date().toLocaleString()}\n` +
      `Source: ${ss.getName()}\n` +
      `Sheets backed up: ${BACKUP_CONFIG.SHEETS_TO_BACKUP.length}`
    );

    // Log backup details
    const duration = (new Date() - startTime) / 1000;
    const fileSize = backupFile.getSize();
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    Logger.log(`✅ Backup created successfully`);
    Logger.log(`   File ID: ${backupId}`);
    Logger.log(`   Size: ${fileSizeMB} MB`);
    Logger.log(`   Duration: ${duration}s`);
    Logger.log(`   URL: ${backupFile.getUrl()}`);

    // Clean old backups
    cleanOldBackups(backupFolder);

    // Log to audit trail
    logAudit(
      'SYSTEM',
      'Backup',
      'Create',
      `Backup created: ${backupName} (${fileSizeMB} MB)`,
      '',
      '',
      backupId
    );

    const endTime = new Date();

    return {
      success: true,
      message: 'Backup created successfully',
      backupId: backupId,
      backupName: backupName,
      fileSize: fileSizeMB + ' MB',
      duration: duration + 's',
      url: backupFile.getUrl(),
      timestamp: endTime.toISOString()
    };

  } catch (error) {
    logError('createBackup', error);

    // Send alert email on backup failure
    try {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: '🚨 Backup Failed - ' + CONFIG.SHOP_NAME,
        body: `Backup failed at ${new Date().toLocaleString()}\n\nError: ${error.message}\n\nStack: ${error.stack}`
      });
    } catch (emailError) {
      Logger.log('Failed to send alert email: ' + emailError.message);
    }

    return {
      success: false,
      message: 'Backup failed: ' + error.message,
      error: error.stack
    };
  }
}

/**
 * Get or create the backup folder in Google Drive
 * @returns {Folder} Backup folder object
 */
function getOrCreateBackupFolder() {
  try {
    const folderName = BACKUP_CONFIG.BACKUP_FOLDER_NAME;

    // Search for existing folder
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      return folders.next();
    }

    // Create new folder
    const folder = DriveApp.createFolder(folderName);
    folder.setDescription('Automated backups for Fatma Sales System');

    Logger.log('Created backup folder: ' + folder.getId());
    return folder;

  } catch (error) {
    logError('getOrCreateBackupFolder', error);
    throw new Error('Failed to create backup folder: ' + error.message);
  }
}

/**
 * Clean up old backups based on retention policy
 * @param {Folder} backupFolder - The backup folder
 */
function cleanOldBackups(backupFolder) {
  try {
    const retentionDays = BACKUP_CONFIG.RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = backupFolder.getFiles();
    let deletedCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      const fileDate = file.getDateCreated();

      if (fileDate < cutoffDate) {
        Logger.log(`Deleting old backup: ${file.getName()} (${fileDate.toLocaleDateString()})`);
        file.setTrashed(true);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      Logger.log(`✅ Cleaned ${deletedCount} old backup(s)`);
    }

  } catch (error) {
    logError('cleanOldBackups', error);
    // Don't throw - backup is already created
  }
}

/**
 * List all available backups
 * @param {number} limit - Maximum number of backups to return (default: 10)
 * @returns {Array} Array of backup file objects
 */
function listBackups(limit) {
  try {
    const backupFolder = getOrCreateBackupFolder();
    const files = backupFolder.getFiles();
    const backups = [];

    const maxResults = limit || 10;
    let count = 0;

    while (files.hasNext() && count < maxResults) {
      const file = files.next();

      backups.push({
        id: file.getId(),
        name: file.getName(),
        created: file.getDateCreated().toISOString(),
        size: (file.getSize() / (1024 * 1024)).toFixed(2) + ' MB',
        url: file.getUrl(),
        description: file.getDescription()
      });

      count++;
    }

    // Sort by date descending (newest first)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));

    return backups;

  } catch (error) {
    logError('listBackups', error);
    return [];
  }
}

/**
 * Restore from a backup
 * ⚠️ WARNING: This will overwrite current data!
 *
 * @param {string} backupId - Drive file ID of backup to restore
 * @returns {object} Restoration result
 */
function restoreFromBackup(backupId) {
  try {
    // Safety check: Require explicit confirmation
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      '⚠️ RESTORE FROM BACKUP',
      'This will OVERWRITE all current data with backup data.\n\n' +
      'Are you ABSOLUTELY SURE you want to continue?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return { success: false, message: 'Restore cancelled by user' };
    }

    Logger.log('===== STARTING RESTORE =====');

    // Get backup file
    const backupFile = DriveApp.getFileById(backupId);
    const backupSS = SpreadsheetApp.open(backupFile);

    // Get current spreadsheet
    const currentSS = getSpreadsheet();

    // For each sheet in backup, restore to current
    const sheetsToRestore = BACKUP_CONFIG.SHEETS_TO_BACKUP;
    let restoredCount = 0;

    sheetsToRestore.forEach(sheetName => {
      try {
        const backupSheet = backupSS.getSheetByName(sheetName);
        const currentSheet = currentSS.getSheetByName(sheetName);

        if (backupSheet && currentSheet) {
          // Clear current sheet
          currentSheet.clear();

          // Copy data from backup
          const data = backupSheet.getDataRange().getValues();
          if (data.length > 0) {
            currentSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
          }

          restoredCount++;
          Logger.log(`✅ Restored: ${sheetName}`);
        }
      } catch (sheetError) {
        Logger.log(`❌ Failed to restore ${sheetName}: ${sheetError.message}`);
      }
    });

    // Log restoration
    logAudit(
      Session.getActiveUser().getEmail() || 'SYSTEM',
      'Backup',
      'Restore',
      `Restored from backup: ${backupFile.getName()}`,
      '',
      '',
      backupId
    );

    Logger.log(`✅ Restore complete: ${restoredCount}/${sheetsToRestore.length} sheets`);

    return {
      success: true,
      message: `Successfully restored ${restoredCount} sheets`,
      sheetsRestored: restoredCount,
      backupName: backupFile.getName()
    };

  } catch (error) {
    logError('restoreFromBackup', error);
    return {
      success: false,
      message: 'Restore failed: ' + error.message
    };
  }
}

/**
 * Export specific sheet to CSV
 * @param {string} sheetName - Name of sheet to export
 * @returns {object} Export result with file URL
 */
function exportSheetToCSV(sheetName) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }

    // Get data
    const data = sheet.getDataRange().getValues();

    // Convert to CSV
    const csv = data.map(row => {
      return row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',');
    }).join('\n');

    // Create file in backup folder
    const backupFolder = getOrCreateBackupFolder();
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
    const fileName = `${sheetName}_${timestamp}.csv`;

    const file = backupFolder.createFile(fileName, csv, MimeType.CSV);

    Logger.log(`✅ Exported ${sheetName} to CSV: ${file.getUrl()}`);

    return {
      success: true,
      fileName: fileName,
      url: file.getUrl(),
      rows: data.length,
      size: (file.getSize() / 1024).toFixed(2) + ' KB'
    };

  } catch (error) {
    logError('exportSheetToCSV', error);
    return {
      success: false,
      message: 'Export failed: ' + error.message
    };
  }
}

// =====================================================
// AUTOMATED BACKUP TRIGGER SETUP
// =====================================================

/**
 * Setup daily automated backups
 * Run this once to enable automatic backups at 2 AM daily
 */
function setupAutomatedBackups() {
  try {
    // Delete existing backup triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'createBackup') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Create new daily trigger at configured hour
    ScriptApp.newTrigger('createBackup')
      .timeBased()
      .atHour(BACKUP_CONFIG.BACKUP_TIME_HOUR)
      .everyDays(1)
      .create();

    Logger.log(`✅ Automated backups enabled: Daily at ${BACKUP_CONFIG.BACKUP_TIME_HOUR}:00 AM`);

    return {
      success: true,
      message: `Automated backups scheduled for ${BACKUP_CONFIG.BACKUP_TIME_HOUR}:00 AM daily`
    };

  } catch (error) {
    logError('setupAutomatedBackups', error);
    return {
      success: false,
      message: 'Failed to setup automated backups: ' + error.message
    };
  }
}

/**
 * Disable automated backups
 */
function disableAutomatedBackups() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'createBackup') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });

    Logger.log(`✅ Disabled ${deletedCount} backup trigger(s)`);

    return {
      success: true,
      message: `Automated backups disabled (${deletedCount} triggers removed)`
    };

  } catch (error) {
    logError('disableAutomatedBackups', error);
    return {
      success: false,
      message: 'Failed to disable backups: ' + error.message
    };
  }
}

/**
 * Get backup system status
 * @returns {object} Status information
 */
function getBackupStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const backupTriggers = triggers.filter(t => t.getHandlerFunction() === 'createBackup');

    const backups = listBackups(5); // Get last 5 backups

    return {
      enabled: BACKUP_CONFIG.ENABLED,
      automated: backupTriggers.length > 0,
      schedule: backupTriggers.length > 0 ? `Daily at ${BACKUP_CONFIG.BACKUP_TIME_HOUR}:00 AM` : 'Not scheduled',
      retentionDays: BACKUP_CONFIG.RETENTION_DAYS,
      lastBackups: backups,
      totalBackups: backups.length
    };

  } catch (error) {
    logError('getBackupStatus', error);
    return { error: error.message };
  }
}
