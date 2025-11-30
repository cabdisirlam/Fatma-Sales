/**
 * Soft Delete Service
 * Provides safe deletion by marking records as deleted instead of removing them
 * Allows recovery of accidentally deleted data
 */

// =====================================================
// SOFT DELETE CONFIGURATION
// =====================================================

const SOFT_DELETE_CONFIG = {
  ENABLED: true,  // Set to false to use hard deletes (not recommended)
  AUTO_PURGE_DAYS: 90,  // Permanently delete after 90 days
  STATUS_COLUMN: 'Status',  // Column name for status tracking
  DELETED_STATUS: 'Deleted',
  ACTIVE_STATUS: 'Active',
  DELETED_BY_COLUMN: 'Deleted_By',  // Track who deleted
  DELETED_DATE_COLUMN: 'Deleted_Date'  // Track when deleted
};

// =====================================================
// SOFT DELETE FUNCTIONS
// =====================================================

/**
 * Soft delete a record by marking it as deleted
 * ✅ SAFE: Can be recovered later
 *
 * @param {string} sheetName - Name of the sheet
 * @param {string} idColumn - Name of the ID column
 * @param {string} idValue - ID value of record to delete
 * @param {string} user - User performing the deletion
 * @returns {object} Result of deletion
 */
function softDelete(sheetName, idColumn, idValue, user) {
  try {
    if (!SOFT_DELETE_CONFIG.ENABLED) {
      return {
        success: false,
        message: 'Soft delete is disabled. Use hardDelete() instead.'
      };
    }

    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const idIndex = headers.indexOf(idColumn);
    const statusIndex = headers.indexOf(SOFT_DELETE_CONFIG.STATUS_COLUMN);

    if (idIndex === -1) {
      throw new Error(`Column '${idColumn}' not found in ${sheetName}`);
    }

    if (statusIndex === -1) {
      throw new Error(`Status column not found in ${sheetName}. Soft delete requires a 'Status' column.`);
    }

    // Find the record
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === idValue) {
        const currentStatus = data[i][statusIndex];

        // Check if already deleted
        if (currentStatus === SOFT_DELETE_CONFIG.DELETED_STATUS) {
          return {
            success: false,
            message: 'Record is already deleted'
          };
        }

        // Get record details before deleting
        const record = {};
        headers.forEach((header, idx) => {
          record[header] = data[i][idx];
        });

        // Mark as deleted
        const rowNum = i + 1;
        sheet.getRange(rowNum, statusIndex + 1).setValue(SOFT_DELETE_CONFIG.DELETED_STATUS);

        // Update additional tracking columns if they exist
        const deletedByIndex = headers.indexOf(SOFT_DELETE_CONFIG.DELETED_BY_COLUMN);
        const deletedDateIndex = headers.indexOf(SOFT_DELETE_CONFIG.DELETED_DATE_COLUMN);

        if (deletedByIndex !== -1) {
          sheet.getRange(rowNum, deletedByIndex + 1).setValue(user || 'SYSTEM');
        }

        if (deletedDateIndex !== -1) {
          sheet.getRange(rowNum, deletedDateIndex + 1).setValue(new Date());
        }

        // Log audit
        logAudit(
          user || 'SYSTEM',
          sheetName,
          'Soft Delete',
          `Record soft-deleted: ${idValue}`,
          '',
          JSON.stringify(record),
          'Status: ' + SOFT_DELETE_CONFIG.DELETED_STATUS
        );

        Logger.log(`✅ Soft deleted: ${sheetName}.${idValue}`);

        return {
          success: true,
          message: 'Record marked as deleted (can be recovered)',
          deletedId: idValue,
          deletedBy: user,
          deletedDate: new Date().toISOString()
        };
      }
    }

    return {
      success: false,
      message: 'Record not found: ' + idValue
    };

  } catch (error) {
    logError('softDelete', error);
    return {
      success: false,
      message: 'Soft delete failed: ' + error.message
    };
  }
}

/**
 * Restore a soft-deleted record
 *
 * @param {string} sheetName - Name of the sheet
 * @param {string} idColumn - Name of the ID column
 * @param {string} idValue - ID value of record to restore
 * @param {string} user - User performing the restoration
 * @returns {object} Result of restoration
 */
function restoreSoftDeleted(sheetName, idColumn, idValue, user) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const idIndex = headers.indexOf(idColumn);
    const statusIndex = headers.indexOf(SOFT_DELETE_CONFIG.STATUS_COLUMN);

    if (idIndex === -1 || statusIndex === -1) {
      throw new Error('Required columns not found');
    }

    // Find the deleted record
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === idValue) {
        const currentStatus = data[i][statusIndex];

        // Check if actually deleted
        if (currentStatus !== SOFT_DELETE_CONFIG.DELETED_STATUS) {
          return {
            success: false,
            message: 'Record is not deleted (Status: ' + currentStatus + ')'
          };
        }

        // Restore by setting status to Active
        const rowNum = i + 1;
        sheet.getRange(rowNum, statusIndex + 1).setValue(SOFT_DELETE_CONFIG.ACTIVE_STATUS);

        // Clear deletion tracking columns
        const deletedByIndex = headers.indexOf(SOFT_DELETE_CONFIG.DELETED_BY_COLUMN);
        const deletedDateIndex = headers.indexOf(SOFT_DELETE_CONFIG.DELETED_DATE_COLUMN);

        if (deletedByIndex !== -1) {
          sheet.getRange(rowNum, deletedByIndex + 1).setValue('');
        }

        if (deletedDateIndex !== -1) {
          sheet.getRange(rowNum, deletedDateIndex + 1).setValue('');
        }

        // Log audit
        logAudit(
          user || 'SYSTEM',
          sheetName,
          'Restore',
          `Record restored: ${idValue}`,
          '',
          'Status: ' + SOFT_DELETE_CONFIG.DELETED_STATUS,
          'Status: ' + SOFT_DELETE_CONFIG.ACTIVE_STATUS
        );

        Logger.log(`✅ Restored: ${sheetName}.${idValue}`);

        return {
          success: true,
          message: 'Record restored successfully',
          restoredId: idValue,
          restoredBy: user,
          restoredDate: new Date().toISOString()
        };
      }
    }

    return {
      success: false,
      message: 'Record not found: ' + idValue
    };

  } catch (error) {
    logError('restoreSoftDeleted', error);
    return {
      success: false,
      message: 'Restore failed: ' + error.message
    };
  }
}

/**
 * Get all soft-deleted records from a sheet
 *
 * @param {string} sheetName - Name of the sheet
 * @returns {Array} Array of deleted records
 */
function getSoftDeletedRecords(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const statusIndex = headers.indexOf(SOFT_DELETE_CONFIG.STATUS_COLUMN);

    if (statusIndex === -1) {
      return [];
    }

    const deletedRecords = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][statusIndex] === SOFT_DELETE_CONFIG.DELETED_STATUS) {
        const record = {};
        headers.forEach((header, idx) => {
          let value = data[i][idx];
          if (value instanceof Date) {
            value = value.toISOString();
          }
          record[header] = value;
        });
        deletedRecords.push(record);
      }
    }

    return deletedRecords;

  } catch (error) {
    logError('getSoftDeletedRecords', error);
    return [];
  }
}

/**
 * Permanently delete old soft-deleted records
 * ⚠️ WARNING: This cannot be undone!
 *
 * @param {string} sheetName - Name of the sheet
 * @param {number} daysOld - Delete records older than this many days (default: 90)
 * @returns {object} Result with count of purged records
 */
function purgeOldDeletedRecords(sheetName, daysOld) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const statusIndex = headers.indexOf(SOFT_DELETE_CONFIG.STATUS_COLUMN);
    const deletedDateIndex = headers.indexOf(SOFT_DELETE_CONFIG.DELETED_DATE_COLUMN);

    if (statusIndex === -1) {
      return { success: false, message: 'Status column not found' };
    }

    const cutoffDays = daysOld || SOFT_DELETE_CONFIG.AUTO_PURGE_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

    let purgedCount = 0;
    const rowsToDelete = [];

    // Find rows to delete (iterate backwards to maintain indices)
    for (let i = data.length - 1; i >= 1; i--) {
      const status = data[i][statusIndex];

      if (status === SOFT_DELETE_CONFIG.DELETED_STATUS) {
        let shouldPurge = false;

        if (deletedDateIndex !== -1 && data[i][deletedDateIndex]) {
          const deletedDate = new Date(data[i][deletedDateIndex]);
          shouldPurge = deletedDate < cutoffDate;
        } else {
          // No deleted date tracked, purge if older than cutoff
          shouldPurge = true;
        }

        if (shouldPurge) {
          rowsToDelete.push(i + 1); // +1 because sheet rows are 1-indexed
        }
      }
    }

    // Delete rows
    rowsToDelete.forEach(rowNum => {
      sheet.deleteRow(rowNum);
      purgedCount++;
    });

    if (purgedCount > 0) {
      logAudit(
        'SYSTEM',
        sheetName,
        'Purge',
        `Purged ${purgedCount} old deleted records (older than ${cutoffDays} days)`,
        '',
        '',
        ''
      );

      Logger.log(`✅ Purged ${purgedCount} old deleted records from ${sheetName}`);
    }

    return {
      success: true,
      message: `Purged ${purgedCount} record(s)`,
      purgedCount: purgedCount,
      cutoffDate: cutoffDate.toISOString()
    };

  } catch (error) {
    logError('purgeOldDeletedRecords', error);
    return {
      success: false,
      message: 'Purge failed: ' + error.message
    };
  }
}

/**
 * Setup automated purge trigger (runs monthly)
 * Automatically removes deleted records older than 90 days
 */
function setupAutoPurge() {
  try {
    // Delete existing purge triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'runMonthlyPurge') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Create monthly trigger on 1st of each month at 3 AM
    ScriptApp.newTrigger('runMonthlyPurge')
      .timeBased()
      .onMonthDay(1)
      .atHour(3)
      .create();

    Logger.log('✅ Auto-purge enabled: Monthly on 1st at 3:00 AM');

    return {
      success: true,
      message: 'Auto-purge scheduled for monthly execution'
    };

  } catch (error) {
    logError('setupAutoPurge', error);
    return {
      success: false,
      message: 'Failed to setup auto-purge: ' + error.message
    };
  }
}

/**
 * Monthly purge function (called by trigger)
 * Purges old deleted records from all sheets
 */
function runMonthlyPurge() {
  try {
    Logger.log('===== STARTING MONTHLY PURGE =====');

    const sheetsToProcess = Object.values(CONFIG.SHEETS);
    let totalPurged = 0;
    const results = [];

    sheetsToProcess.forEach(sheetName => {
      try {
        const result = purgeOldDeletedRecords(sheetName);
        if (result.success && result.purgedCount > 0) {
          totalPurged += result.purgedCount;
          results.push({
            sheet: sheetName,
            purged: result.purgedCount
          });
        }
      } catch (error) {
        Logger.log(`Error purging ${sheetName}: ${error.message}`);
      }
    });

    Logger.log(`✅ Monthly purge complete: ${totalPurged} total records purged`);

    // Send summary email to admin
    if (totalPurged > 0) {
      const summary = results.map(r => `${r.sheet}: ${r.purged} records`).join('\n');

      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `📊 Monthly Purge Summary - ${CONFIG.SHOP_NAME}`,
        body: `Monthly purge completed on ${new Date().toLocaleDateString()}\n\n` +
              `Total records purged: ${totalPurged}\n\n` +
              `Details:\n${summary}\n\n` +
              `These were soft-deleted records older than ${SOFT_DELETE_CONFIG.AUTO_PURGE_DAYS} days.`
      });
    }

    return {
      success: true,
      totalPurged: totalPurged,
      results: results
    };

  } catch (error) {
    logError('runMonthlyPurge', error);
    return {
      success: false,
      message: 'Monthly purge failed: ' + error.message
    };
  }
}

// =====================================================
// WRAPPER FUNCTIONS FOR EASY MIGRATION
// =====================================================

/**
 * Safe delete customer (soft delete)
 */
function safeDeleteCustomer(customerId, user) {
  return softDelete('Customers', 'Customer_ID', customerId, user);
}

/**
 * Safe delete supplier (soft delete)
 */
function safeDeleteSupplier(supplierId, user) {
  return softDelete('Suppliers', 'Supplier_ID', supplierId, user);
}

/**
 * Safe delete inventory item (soft delete)
 */
function safeDeleteInventoryItem(itemId, user) {
  return softDelete('Inventory', 'Item_ID', itemId, user);
}

/**
 * Restore deleted customer
 */
function restoreCustomer(customerId, user) {
  return restoreSoftDeleted('Customers', 'Customer_ID', customerId, user);
}

/**
 * Restore deleted supplier
 */
function restoreSupplier(supplierId, user) {
  return restoreSoftDeleted('Suppliers', 'Supplier_ID', supplierId, user);
}

/**
 * Get all deleted customers
 */
function getDeletedCustomers() {
  return getSoftDeletedRecords('Customers');
}

/**
 * Get all deleted suppliers
 */
function getDeletedSuppliers() {
  return getSoftDeletedRecords('Suppliers');
}
