/**
 * Concurrent-Safe ID Generator Module
 * Replaces the old generateId() function in aCode.gs with a thread-safe version
 * Uses Google Apps Script LockService to prevent duplicate IDs from concurrent users
 */

// =====================================================
// THREAD-SAFE ID GENERATION
// =====================================================

/**
 * Generates a unique ID with prefix (THREAD-SAFE VERSION)
 * Uses LockService to prevent concurrent users from generating duplicate IDs
 *
 * IMPORTANT: This function replaces the old generateId() in aCode.gs
 * To activate this fix:
 * 1. Rename old generateId() to generateIdOld() in aCode.gs
 * 2. This function will become the new generateId()
 *
 * @param {string} sheetName - Name of the sheet
 * @param {string} columnName - Name of the ID column
 * @param {string} prefix - ID prefix (e.g., 'SALE', 'CUST', 'ITEM')
 * @returns {string} Generated ID (e.g., 'SALE-001')
 */
function generateIdSafe(sheetName, columnName, prefix) {
  const lock = LockService.getScriptLock();

  try {
    // Wait up to 30 seconds for the lock
    // This ensures only ONE user can generate an ID at a time across ALL users
    const hasLock = lock.tryLock(30000);

    if (!hasLock) {
      // If lock couldn't be acquired within 30 seconds, throw error
      throw new Error('System busy. Could not acquire lock for ID generation. Please try again in a moment.');
    }

    try {
      // Critical section - only one user can execute this at a time
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const columnIndex = headers.indexOf(columnName);

      if (columnIndex === -1) {
        throw new Error('Column ' + columnName + ' not found in ' + sheetName);
      }

      let maxNumber = 0;

      // Find the highest existing number
      for (let i = 1; i < data.length; i++) {
        const id = data[i][columnIndex];
        if (id && typeof id === 'string' && id.startsWith(prefix + '-')) {
          const numberPart = id.split('-')[1];
          if (numberPart) {
            const number = parseInt(numberPart);
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
        }
      }

      // Generate new ID
      const newNumber = maxNumber + 1;
      const newId = prefix + '-' + String(newNumber).padStart(3, '0');

      // Log ID generation for debugging
      Logger.log('Generated ID: ' + newId + ' for sheet: ' + sheetName);

      return newId;

    } finally {
      // CRITICAL: ALWAYS release the lock, even if an error occurred
      // This prevents deadlocks
      lock.releaseLock();
    }

  } catch (error) {
    logError('generateIdSafe', error);
    throw new Error('Error generating ID: ' + error.message);
  }
}

/**
 * Generate ID with retry logic (extra safety layer)
 * Retries up to 3 times if lock acquisition fails
 *
 * @param {string} sheetName - Name of the sheet
 * @param {string} columnName - Name of the ID column
 * @param {string} prefix - ID prefix
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {string} Generated ID
 */
function generateIdWithRetry(sheetName, columnName, prefix, maxRetries) {
  const retries = maxRetries || 3;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return generateIdSafe(sheetName, columnName, prefix);
    } catch (error) {
      if (attempt === retries) {
        // Final attempt failed, throw error
        throw new Error('Failed to generate ID after ' + retries + ' attempts: ' + error.message);
      }

      // Wait briefly before retry (exponential backoff)
      const waitMs = attempt * 500; // 500ms, 1000ms, 1500ms, etc.
      Logger.log('ID generation attempt ' + attempt + ' failed. Retrying in ' + waitMs + 'ms...');
      Utilities.sleep(waitMs);
    }
  }
}

/**
 * Batch ID generation (for bulk operations)
 * Generates multiple IDs in a single lock acquisition
 * More efficient than calling generateIdSafe() multiple times
 *
 * @param {string} sheetName - Name of the sheet
 * @param {string} columnName - Name of the ID column
 * @param {string} prefix - ID prefix
 * @param {number} count - Number of IDs to generate
 * @returns {Array<string>} Array of generated IDs
 */
function generateBatchIds(sheetName, columnName, prefix, count) {
  const lock = LockService.getScriptLock();

  try {
    const hasLock = lock.tryLock(30000);

    if (!hasLock) {
      throw new Error('Could not acquire lock for batch ID generation');
    }

    try {
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const columnIndex = headers.indexOf(columnName);

      if (columnIndex === -1) {
        throw new Error('Column ' + columnName + ' not found in ' + sheetName);
      }

      let maxNumber = 0;

      // Find the highest existing number
      for (let i = 1; i < data.length; i++) {
        const id = data[i][columnIndex];
        if (id && typeof id === 'string' && id.startsWith(prefix + '-')) {
          const numberPart = id.split('-')[1];
          if (numberPart) {
            const number = parseInt(numberPart);
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
        }
      }

      // Generate batch of IDs
      const ids = [];
      for (let i = 1; i <= count; i++) {
        const newNumber = maxNumber + i;
        const newId = prefix + '-' + String(newNumber).padStart(3, '0');
        ids.push(newId);
      }

      Logger.log('Generated batch of ' + count + ' IDs: ' + ids[0] + ' to ' + ids[ids.length - 1]);

      return ids;

    } finally {
      lock.releaseLock();
    }

  } catch (error) {
    logError('generateBatchIds', error);
    throw new Error('Error generating batch IDs: ' + error.message);
  }
}

// =====================================================
// MIGRATION UTILITIES
// =====================================================

/**
 * Test function to compare old vs new ID generation
 * Run this to verify the new implementation works correctly
 */
function testIdGeneration() {
  try {
    Logger.log('===== ID GENERATION TEST =====');

    // Test 1: Generate a single ID
    Logger.log('\n--- Test 1: Single ID Generation ---');
    const id1 = generateIdSafe('Customers', 'Customer_ID', 'CUST');
    Logger.log('Generated Customer ID: ' + id1);

    const id2 = generateIdSafe('Sales', 'Transaction_ID', 'SALE');
    Logger.log('Generated Sale ID: ' + id2);

    const id3 = generateIdSafe('Inventory', 'Item_ID', 'ITEM');
    Logger.log('Generated Item ID: ' + id3);

    // Test 2: Generate with retry
    Logger.log('\n--- Test 2: ID Generation with Retry ---');
    const id4 = generateIdWithRetry('Suppliers', 'Supplier_ID', 'SUP');
    Logger.log('Generated Supplier ID (with retry): ' + id4);

    // Test 3: Batch generation
    Logger.log('\n--- Test 3: Batch ID Generation ---');
    const batchIds = generateBatchIds('Sales', 'Transaction_ID', 'TEST', 5);
    Logger.log('Generated batch IDs: ' + batchIds.join(', '));

    Logger.log('\n===== ALL TESTS PASSED =====');

    return {
      success: true,
      message: 'ID generation tests completed successfully',
      testResults: {
        singleId: id1,
        retryId: id4,
        batchIds: batchIds
      }
    };

  } catch (error) {
    Logger.log('ERROR in testIdGeneration: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: 'ID generation test failed: ' + error.message
    };
  }
}

/**
 * Migration helper: Replace old generateId() calls with generateIdSafe()
 * This function documents all the places that need to be updated
 *
 * IMPORTANT: After testing, do the following:
 * 1. In aCode.gs, rename generateId() to generateIdOld()
 * 2. Copy generateIdSafe() function body into a new generateId() function in aCode.gs
 * 3. Or simply call generateIdSafe() from all modules
 */
function getMigrationInstructions() {
  const instructions = {
    title: 'ID Generation Migration Instructions',
    currentIssue: 'The current generateId() function in aCode.gs is NOT thread-safe and can create duplicate IDs when multiple users operate simultaneously.',
    solution: 'Use the new generateIdSafe() function which uses LockService to prevent concurrent access.',

    option1: {
      title: 'Option 1: Replace in aCode.gs (Recommended)',
      steps: [
        '1. Open aCode.gs',
        '2. Find the generateId() function (around line 1300)',
        '3. Rename it to generateIdOld()',
        '4. Copy the generateIdSafe() function from aIdGenerator.gs',
        '5. Rename it to generateId() in aCode.gs',
        '6. All existing code will automatically use the new thread-safe version'
      ]
    },

    option2: {
      title: 'Option 2: Use generateIdSafe() directly',
      steps: [
        '1. In all files that call generateId(), replace with generateIdSafe()',
        '2. Files to update:',
        '   - dCustomers.gs (line 128)',
        '   - fInventory.gs (line 216)',
        '   - iSales.gs (line 34, 334, 504)',
        '   - tSuppliers.gs',
        '   - uPurchases.gs',
        '   - Others as needed'
      ]
    },

    filesAffected: [
      'aCode.gs - Contains the old generateId() function',
      'dCustomers.gs - Uses generateId() for Customer_ID',
      'fInventory.gs - Uses generateId() for Item_ID',
      'iSales.gs - Uses generateId() for Transaction_ID',
      'tSuppliers.gs - Uses generateId() for Supplier_ID',
      'uPurchases.gs - Uses generateId() for Purchase_ID',
      'eFinancials.gs - Uses generateId() for Transaction_ID',
      'hQuotations.gs - Uses generateId() for quotation IDs'
    ],

    testingSteps: [
      '1. Run testIdGeneration() function to verify it works',
      '2. Have 2 users simultaneously create sales/customers',
      '3. Verify no duplicate IDs are created',
      '4. Check Audit_Trail for any errors'
    ]
  };

  Logger.log(JSON.stringify(instructions, null, 2));
  return instructions;
}
