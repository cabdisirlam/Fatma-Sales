/**
 * Inventory Management Module
 * Handles: Product catalog, stock tracking, stock adjustments, low stock alerts
 */

// =====================================================
// INVENTORY FUNCTIONS
// =====================================================

/**
 * Get all inventory items with optional filters
 * V3.0: Aggregates batches by Item_ID (Batch-per-Row Architecture)
 * Returns one consolidated object per product with summed quantities
 */
function getInventory(filters) {
  try {
    Logger.log('getInventory called with filters: ' + JSON.stringify(filters));
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();
    Logger.log('Inventory sheet data length: ' + data.length);

    if (data.length <= 1) {
      Logger.log('Inventory sheet has no data.');
      return [];
    }

    const headers = data[0];
    Logger.log('Inventory headers: ' + JSON.stringify(headers));
    const batchesByItemId = {}; // Group batches by Item_ID

    // Step 1: Read all rows and group by Item_ID
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const batch = {};

      headers.forEach((header, index) => {
        batch[header] = row[index];
      });

      const itemId = batch.Item_ID;
      if (!itemId) continue; // Skip empty rows

      if (!batchesByItemId[itemId]) {
        batchesByItemId[itemId] = [];
      }

      batchesByItemId[itemId].push(batch);
    }
    Logger.log('Grouped batches by Item_ID. Number of unique items: ' + Object.keys(batchesByItemId).length);

    // Step 2: Aggregate batches into single items
    const items = [];

    for (const itemId in batchesByItemId) {
      const batches = batchesByItemId[itemId];

      // Sort batches by Date_Received (most recent first for display)
      batches.sort((a, b) => {
        const dateA = a.Date_Received ? new Date(a.Date_Received) : new Date(0);
        const dateB = b.Date_Received ? new Date(b.Date_Received) : new Date(0);
        return dateB - dateA;
      });

      const mostRecentBatch = batches[0]; // Use most recent batch for details

      // Sum quantities across all batches
      const totalQty = batches.reduce((sum, batch) => {
        return sum + (parseFloat(batch.Current_Qty) || 0);
      }, 0);

      // Create consolidated item
      const item = {
        Item_ID: mostRecentBatch.Item_ID,
        Item_Name: mostRecentBatch.Item_Name,
        Category: mostRecentBatch.Category,
        Cost_Price: parseFloat(mostRecentBatch.Cost_Price) || 0,
        Selling_Price: parseFloat(mostRecentBatch.Selling_Price) || 0,
        Current_Qty: totalQty,
        Reorder_Level: parseFloat(mostRecentBatch.Reorder_Level) || 0,
        Supplier_ID: mostRecentBatch.Supplier_ID || mostRecentBatch.Supplier || '',
        Supplier: mostRecentBatch.Supplier || mostRecentBatch.Supplier_ID || '',
        Unit: mostRecentBatch.Unit,
        Last_Updated: mostRecentBatch.Last_Updated instanceof Date ? mostRecentBatch.Last_Updated.toISOString() : mostRecentBatch.Last_Updated,
        Updated_By: mostRecentBatch.Updated_By
      };
      if (!item.Supplier && item.Supplier_ID) {
        const supplierName = resolveSupplierName(item.Supplier_ID);
        if (supplierName) item.Supplier = supplierName;
      }
      Logger.log('Simplified item: ' + JSON.stringify(item));

      // Backwards compatibility: expose Stock_Qty for UIs expecting this field
      item.Stock_Qty = item.Current_Qty;

      // Apply filters if provided
      if (filters) {
        let matches = true;
        for (let key in filters) {
          if (item[key] !== filters[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      // Add stock status
      item.stock_status = getStockStatus(item.Current_Qty, item.Reorder_Level);
      item.stock_value = (item.Current_Qty || 0) * (item.Cost_Price || 0);

      items.push(item);
    }
    Logger.log('Finished aggregating items. Total items returned: ' + items.length);

    return items;

  } catch (error) {
    logError('getInventory', error);
    // Failsafe: return empty array so UI doesn't freeze when inventory read fails
    return [];
  }
}

/**
 * Clear cached inventory data
 */
function clearInventoryCache() {
  // Cache disabled: no-op
}

// Helper: get category from Master_Data by item name
function getCategoryForItemName(itemName) {
  try {
    if (!itemName) return '';
    const rows = sheetToObjects('Master_Data');
    const nameLc = itemName.toString().trim().toLowerCase();
    const match = rows.find(r => (r.Item_Name || r.Item || '').toString().trim().toLowerCase() === nameLc);
    return match && match.Category ? match.Category : '';
  } catch (err) {
    Logger.log('getCategoryForItemName error: ' + err);
    return '';
  }
}

function resolveSupplierName(supplierId) {
  try {
    if (!supplierId) return '';
    const s = getSupplierById(supplierId);
    return (s && s.Supplier_Name) ? s.Supplier_Name : '';
  } catch (e) {
    Logger.log('resolveSupplierName error: ' + e);
    return '';
  }
}

/**
 * Get inventory item by ID
 * V3.0: Aggregates all batches for the item and returns consolidated quantity
 */
function getInventoryItemById(itemId) {
  try {
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      throw new Error('Product not found: ' + itemId);
    }

    const headers = data[0];
    const batches = [];

    // Find all batches for this Item_ID
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const batch = {};

      headers.forEach((header, index) => {
        batch[header] = row[index];
      });

      if (batch.Item_ID === itemId) {
        batches.push(batch);
      }
    }

    if (batches.length === 0) {
      throw new Error('Product not found: ' + itemId);
    }

    // Sort batches by Date_Received (most recent first)
    batches.sort((a, b) => {
      const dateA = a.Date_Received ? new Date(a.Date_Received) : new Date(0);
      const dateB = b.Date_Received ? new Date(b.Date_Received) : new Date(0);
      return dateB - dateA;
    });

    const mostRecentBatch = batches[0];

    // Sum quantities across all batches
    const totalQty = batches.reduce((sum, batch) => {
      return sum + (parseFloat(batch.Current_Qty) || 0);
    }, 0);

    // Create consolidated item
    const item = {
      Item_ID: mostRecentBatch.Item_ID,
      Item_Name: mostRecentBatch.Item_Name,
      Category: mostRecentBatch.Category,
      Cost_Price: mostRecentBatch.Cost_Price,
      Selling_Price: mostRecentBatch.Selling_Price,
      Current_Qty: totalQty,
      Reorder_Level: mostRecentBatch.Reorder_Level,
      Supplier: mostRecentBatch.Supplier,
      Last_Updated: mostRecentBatch.Last_Updated,
      Updated_By: mostRecentBatch.Updated_By
    };
    if (!item.Supplier && mostRecentBatch.Supplier_ID) {
      const supplierName = resolveSupplierName(mostRecentBatch.Supplier_ID);
      if (supplierName) item.Supplier = supplierName;
    }

    // Backwards compatibility: expose Stock_Qty for UIs expecting this field
    item.Stock_Qty = item.Current_Qty;

    item.stock_status = getStockStatus(item.Current_Qty, item.Reorder_Level);
    item.stock_value = (item.Current_Qty || 0) * (item.Cost_Price || 0);

    return item;
  } catch (error) {
    logError('getInventoryItemById', error);
    throw new Error('Error loading product: ' + error.message);
  }
}

/**
 * Get stock status (Low, Medium, High)
 */
function getStockStatus(currentQty, reorderLevel) {
  currentQty = parseFloat(currentQty) || 0;
  reorderLevel = parseFloat(reorderLevel) || 0;

  if (currentQty === 0) return 'Out of Stock';
  if (currentQty <= reorderLevel) return 'Low Stock';
  if (currentQty <= reorderLevel * 2) return 'Medium Stock';
  return 'In Stock';
}

/**
 * Get low stock items
 */
function getLowStockItems() {
  try {
    const items = getInventory();
    return items.filter(item => {
      const qty = parseFloat(item.Current_Qty) || 0;
      const reorder = parseFloat(item.Reorder_Level) || 0;
      return qty <= reorder;
    });
  } catch (error) {
    logError('getLowStockItems', error);
    return [];
  }
}

/**
 * Get out of stock items
 */
function getOutOfStockItems() {
  try {
    const items = getInventory();
    return items.filter(item => (parseFloat(item.Current_Qty) || 0) === 0);
  } catch (error) {
    logError('getOutOfStockItems', error);
    return [];
  }
}

/**
 * Get product categories
 */
function getProductCategories() {
  try {
    const items = getInventory();
    const categories = new Set();

    items.forEach(item => {
      if (item.Category) {
        categories.add(item.Category);
      }
    });

    return Array.from(categories).sort();
  } catch (error) {
    logError('getProductCategories', error);
    return [];
  }
}

/**
 * Get unique categories from Inventory sheet
 * V3.0: Helper function that reads directly from sheet and returns sorted unique categories
 */
function getUniqueCategories() {
  try {
    const sheet = getSheet('Master_Data');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const categoryIndex = headers.indexOf('Category');

    if (categoryIndex === -1) {
      return [];
    }

    const categories = new Set();

    for (let i = 1; i < data.length; i++) {
      const category = data[i][categoryIndex];
      if (category && category.toString().trim() !== '') {
        categories.add(category.toString().trim());
      }
    }

    return Array.from(categories).sort();
  } catch (error) {
    logError('getUniqueCategories from Master', error);
    return [];
  }
}

/**
 * Add new product to inventory
 */
function addProduct(productData) {
  try {
    const supplierId = productData.Supplier_ID || productData.Supplier || '';
    const stockSource = (productData.Stock_Source || (supplierId ? 'purchase' : 'opening')).toLowerCase();
    const isPurchase = stockSource === 'purchase';
    
    let supplierName = productData.Supplier_Name || productData.Supplier || '';
    if (supplierId && !supplierName) {
        const supplier = getSupplierById(supplierId);
        if(supplier) {
            supplierName = supplier.Supplier_Name;
        }
    }
    if (!supplierName && supplierId) {
      supplierName = resolveSupplierName(supplierId);
    }
    // Keep actual name when available; fall back to ID to avoid blanks
    supplierName = supplierName || supplierId || 'Unknown Supplier';

    // Resolve category: prefer provided, otherwise look up from Master_Data
    let category = productData.Category || '';
    if (!category) {
      category = getCategoryForItemName(productData.Item_Name);
    }
    category = category || 'General';

    // 1. Validation (Matches your form inputs)
    const requiredFields = ['Item_Name', 'Cost_Price', 'Current_Qty', 'Category', 'Reorder_Level'];
    if (isPurchase) {
      requiredFields.push('Supplier_ID');
    }

    validateRequired(productData, requiredFields);

    const sheet = getSheet('Inventory');
    const itemId = generateId('Inventory', 'Item_ID', 'ITEM');

    const purchaseQty = parseFloat(productData.Current_Qty) || 0;

    // 2. HARD-CODED MAPPING (Matches your Header String Exactly)
    // V3.0: We'll create the first batch row directly (only for opening stock)
    // Selling price is not captured on creation; default to 0 for sheet purposes
    const sellingPrice = 0;

    const costPrice = parseFloat(productData.Cost_Price) || 0;
    const timestamp = new Date().getTime();
    const batchId = 'BATCH-' + itemId + '-' + timestamp;
    const reorderLevel = productData.Reorder_Level !== undefined && productData.Reorder_Level !== ''
      ? parseFloat(productData.Reorder_Level)
      : 0;

    // V3.0: Create FIRST BATCH ROW (only if NOT a purchase, because createPurchase will handle that)
    if (!isPurchase && purchaseQty > 0) {
      // Headers: Item_ID, Item_Name, Category, Cost_Price, Selling_Price, Current_Qty, Reorder_Level, Supplier, Last_Updated, Updated_By, Batch_ID, Date_Received
    const newProduct = [
      itemId,                                  // 1. Item_ID
      productData.Item_Name || '',             // 2. Item_Name
      category,                                // 3. Category
      costPrice,                               // 4. Cost_Price
      sellingPrice,                            // 5. Selling_Price
      purchaseQty,                             // 6. Current_Qty (opening stock)
      reorderLevel,                            // 7. Reorder_Level
      supplierName,                            // 8. Supplier
      new Date(),                              // 9. Last_Updated
      productData.User || 'SYSTEM',            // 10. Updated_By
      batchId,                                 // 11. Batch_ID (V3.0)
      new Date()                               // 12. Date_Received (V3.0)
    ];

      sheet.appendRow(newProduct);

      logAudit(
        productData.User || 'SYSTEM',
        'Inventory',
        'Create',
        'Added: ' + productData.Item_Name + ' via Opening Balance (Batch: ' + batchId + ')',
        '',
        '',
        JSON.stringify({itemId, batchId, qty: purchaseQty})
      );
    }

    // If this is a purchase, create a purchase record to update supplier balances and payments
    if (isPurchase && supplierId) {
      const supplier = getSupplierById(supplierId);
      const paidAmount = parseFloat(productData.Paid_Amount) || 0;

      createPurchase({
        Supplier_ID: supplierId,
        Supplier_Name: supplierName || (supplier && supplier.Supplier_Name),
        items: [{ 
            Item_ID: itemId, 
            Item_Name: productData.Item_Name,
            Category: productData.Category,
            Qty: purchaseQty, 
            Cost_Price: costPrice,
            Reorder_Level: reorderLevel
        }],
        Payment_Method: productData.Payment_Method || 'Credit',
        Paid_Amount: paidAmount,
        User: productData.User || 'SYSTEM'
      });
    }

    clearInventoryCache();
    return { success: true, itemId: itemId, batchId: batchId, message: 'Product added successfully with batch tracking' };

  } catch (error) {
    logError('addProduct', error);
    throw new Error('Error adding product: ' + error.message);
  }
}

/**
 * Update product in inventory
 */
function updateProduct(itemId, productData) {
  try {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    // Get current values for audit
    const currentItem = getInventoryItemById(itemId);

    // Update the product
    const updates = {};
    if (productData.Item_Name !== undefined) updates.Item_Name = productData.Item_Name;
    if (productData.Category !== undefined) updates.Category = productData.Category;

    const hasCostPrice = productData.Cost_Price !== undefined && productData.Cost_Price !== '';
    if (hasCostPrice) {
      updates.Cost_Price = parseFloat(productData.Cost_Price);
    }

    const hasSellingPrice = productData.Selling_Price !== undefined && productData.Selling_Price !== '';
    if (hasSellingPrice) {
      updates.Selling_Price = parseFloat(productData.Selling_Price);
    }

    if (productData.Reorder_Level !== undefined && productData.Reorder_Level !== '') updates.Reorder_Level = parseFloat(productData.Reorder_Level);
    if (productData.Supplier !== undefined) updates.Supplier = productData.Supplier;

    // Always update Last_Updated and Updated_By
    updates.Last_Updated = new Date();
    updates.Updated_By = productData.User || 'SYSTEM';

    const result = updateRowById('Inventory', 'Item_ID', itemId, updates);

    logAudit(
      productData.User || 'SYSTEM',
      'Inventory',
      'Update',
      'Product updated: ' + itemId,
      '',
      result.beforeValue,
      result.afterValue
    );

    clearInventoryCache();

    return {
      success: true,
      message: 'Product updated successfully'
    };

  } catch (error) {
    logError('updateProduct', error);
    throw new Error('Error updating product: ' + error.message);
  }
}

/**
 * Delete product from inventory
 */
function deleteProduct(itemId, user) {
  try {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    // Get product info before deleting
    const item = getInventoryItemById(itemId);

    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const itemIdIndex = headers.indexOf('Item_ID');

    // Find and delete row
    for (let i = 1; i < data.length; i++) {
      if (data[i][itemIdIndex] === itemId) {
        sheet.deleteRow(i + 1);

        logAudit(
          user || 'SYSTEM',
          'Inventory',
          'Delete',
          'Product deleted: ' + item.Item_Name + ' (ID: ' + itemId + ')',
          '',
          JSON.stringify(item),
          ''
        );

        clearInventoryCache();

        return {
          success: true,
          message: 'Product deleted successfully'
        };
      }
    }

    throw new Error('Product not found');

  } catch (error) {
    logError('deleteProduct', error);
    throw new Error('Error deleting product: ' + error.message);
  }
}

/**
 * Adjust stock quantity (for manual adjustments, stock takes, etc.)
 */
function adjustStock(itemId, adjustmentQty, reason, user) {
  try {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    if (!adjustmentQty || adjustmentQty === 0) {
      throw new Error('Adjustment quantity must be non-zero');
    }

    if (!reason) {
      throw new Error('Reason is required for stock adjustment');
    }

    // Get current item
    const item = getInventoryItemById(itemId);
    const currentQty = parseFloat(item.Current_Qty) || 0;
    const newQty = currentQty + parseFloat(adjustmentQty);

    if (newQty < 0) {
      throw new Error('Insufficient stock. Current quantity: ' + currentQty);
    }

    // Update quantity
    const result = updateRowById('Inventory', 'Item_ID', itemId, {
      Current_Qty: newQty,
      Last_Updated: new Date(),
      Updated_By: user || 'SYSTEM'
    });

    // Log the adjustment
    logAudit(
      user || 'SYSTEM',
      'Inventory',
      'Stock Adjustment',
      'Stock adjusted for ' + item.Item_Name + ': ' + adjustmentQty + ' (' + reason + '). Old: ' + currentQty + ', New: ' + newQty,
      '',
      'Qty: ' + currentQty,
      'Qty: ' + newQty
    );

    clearInventoryCache();

    return {
      success: true,
      itemId: itemId,
      oldQty: currentQty,
      newQty: newQty,
      message: 'Stock adjusted successfully'
    };

  } catch (error) {
    logError('adjustStock', error);
    throw new Error('Error adjusting stock: ' + error.message);
  }
}

/**
 * Update stock after sale (decrease)
 * V3.0: FIFO DEDUCTION - Deducts from oldest batches first
 * CRITICAL: Calculates and returns totalCOGS based on actual batch costs
 */
function decreaseStock(itemId, qty, user) {
  try {
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      throw new Error('Product not found: ' + itemId);
    }

    const headers = data[0];
    const itemIdIndex = headers.indexOf('Item_ID');
    const qtyIndex = headers.indexOf('Current_Qty');
    const costPriceIndex = headers.indexOf('Cost_Price');
    const dateReceivedIndex = headers.indexOf('Date_Received');
    const batchIdIndex = headers.indexOf('Batch_ID');

    // Step 1: Find all batches for this item
    const batches = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[itemIdIndex] === itemId) {
        const batchQty = parseFloat(row[qtyIndex]) || 0;
        if (batchQty > 0) { // Only include batches with stock
          batches.push({
            rowIndex: i + 1, // Google Sheets is 1-indexed
            qty: batchQty,
            costPrice: parseFloat(row[costPriceIndex]) || 0,
            dateReceived: row[dateReceivedIndex] ? new Date(row[dateReceivedIndex]) : new Date(0),
            batchId: row[batchIdIndex] || 'UNKNOWN'
          });
        }
      }
    }

    if (batches.length === 0) {
      throw new Error('Product not found or out of stock: ' + itemId);
    }

    // Step 2: Sort batches by Date_Received (OLDEST FIRST for FIFO)
    batches.sort((a, b) => a.dateReceived - b.dateReceived);

    // Step 3: Calculate total available quantity
    const totalAvailable = batches.reduce((sum, batch) => sum + batch.qty, 0);

    if (totalAvailable < parseFloat(qty)) {
      throw new Error('Insufficient stock. Available: ' + totalAvailable + ', Required: ' + qty);
    }

    // Step 4: FIFO Deduction - Deduct from oldest batches first
    let remainingQtyToDeduct = parseFloat(qty);
    let totalCOGS = 0;
    const batchUpdates = [];

    for (const batch of batches) {
      if (remainingQtyToDeduct <= 0) break;

      const qtyToDeduct = Math.min(batch.qty, remainingQtyToDeduct);
      const newBatchQty = batch.qty - qtyToDeduct;

      // Calculate COGS for this batch
      totalCOGS += qtyToDeduct * batch.costPrice;

      batchUpdates.push({
        rowIndex: batch.rowIndex,
        newQty: newBatchQty,
        batchId: batch.batchId,
        qtyDeducted: qtyToDeduct
      });

      remainingQtyToDeduct -= qtyToDeduct;
    }

    // Step 5: Apply updates to sheet
    for (const update of batchUpdates) {
      if (update.newQty === 0) {
        // DELETE the row if fully consumed
        sheet.deleteRow(update.rowIndex);
        Logger.log('FIFO: Deleted fully consumed batch ' + update.batchId);

        // Adjust subsequent row indices after deletion
        batchUpdates.forEach(u => {
          if (u.rowIndex > update.rowIndex) {
            u.rowIndex--;
          }
        });
      } else {
        // UPDATE the row with new quantity
        sheet.getRange(update.rowIndex, qtyIndex + 1).setValue(update.newQty);
        Logger.log('FIFO: Reduced batch ' + update.batchId + ' by ' + update.qtyDeducted + ', new qty: ' + update.newQty);
      }
    }

    clearInventoryCache();

    return {
      success: true,
      qtyDeducted: parseFloat(qty),
      totalCOGS: totalCOGS,
      batchesUsed: batchUpdates.length,
      batchDetails: batchUpdates.map(u => ({
        batchId: u.batchId,
        qtyDeducted: u.qtyDeducted
      })),
      message: 'FIFO deduction completed'
    };

  } catch (error) {
    logError('decreaseStock', error);
    throw error;
  }
}

/**
 * Increase stock for a specific batch (for returns)
 * V3.0: Returns items to their ORIGINAL batch instead of creating a new one
 * Used when processing sales returns to maintain batch integrity
 */
function increaseStockSpecificBatch(itemId, batchId, qty, user) {
  try {
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // If no inventory exists, we can't return to a batch that doesn't exist
      // Fall back to creating a new batch
      Logger.log('WARNING: No inventory found for ' + itemId + ', creating new batch for return');
      return increaseStock(itemId, qty, user);
    }

    const headers = data[0];
    const itemIdIndex = headers.indexOf('Item_ID');
    const batchIdIndex = headers.indexOf('Batch_ID');
    const qtyIndex = headers.indexOf('Current_Qty');

    // Find the specific batch row
    let foundBatchRow = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[itemIdIndex] === itemId && row[batchIdIndex] === batchId) {
        foundBatchRow = {
          rowIndex: i + 1, // Google Sheets is 1-indexed
          currentQty: parseFloat(row[qtyIndex]) || 0
        };
        break;
      }
    }

    if (foundBatchRow) {
      // Batch exists - increase its quantity
      const newQty = foundBatchRow.currentQty + parseFloat(qty);
      sheet.getRange(foundBatchRow.rowIndex, qtyIndex + 1).setValue(newQty);
      Logger.log('Returned ' + qty + ' units to existing batch ' + batchId + ', new qty: ' + newQty);
    } else {
      // Batch doesn't exist (maybe it was fully consumed) - create new batch
      Logger.log('WARNING: Batch ' + batchId + ' not found, creating new batch for return');
      return increaseStock(itemId, qty, user);
    }

    clearInventoryCache();

    return {
      success: true,
      qtyAdded: parseFloat(qty),
      batchId: batchId,
      message: 'Stock returned to batch ' + batchId
    };

  } catch (error) {
    logError('increaseStockSpecificBatch', error);
    throw error;
  }
}

/**
 * Update stock after purchase (increase)
 * V3.0: Creates a NEW BATCH ROW instead of updating existing row
 * FIFO Architecture: Each purchase creates a separate batch for accurate cost tracking
 */
function increaseStock(itemId, qty, user, unitCost, baseItem) {
  try {
    let item;
    try {
      item = getInventoryItemById(itemId);
    } catch (e) {
      // If item doesn't exist, fall back to provided baseItem (used for first-time purchases)
      if (!baseItem) throw e;
      item = {
        Item_ID: itemId,
        Item_Name: baseItem.Item_Name || 'New Item',
        Category: baseItem.Category || getCategoryForItemName(baseItem.Item_Name) || 'General',
        Cost_Price: baseItem.Cost_Price || baseItem.unitCost || 0,
        Selling_Price: baseItem.Selling_Price || baseItem.Price || baseItem.Cost_Price || 0,
        Reorder_Level: baseItem.Reorder_Level !== undefined && baseItem.Reorder_Level !== '' ? baseItem.Reorder_Level : 0,
        Supplier: baseItem.Supplier || baseItem.Supplier_ID || resolveSupplierName(baseItem.Supplier_ID) || '',
        Last_Updated: new Date(),
        Updated_By: user || 'SYSTEM'
      };
    }

    // Generate unique Batch_ID
    const timestamp = new Date().getTime();
    const batchId = 'BATCH-' + itemId + '-' + timestamp;

    // Use provided unitCost or fallback to existing Cost_Price
    const costPrice = unitCost !== undefined ? parseFloat(unitCost) : parseFloat(item.Cost_Price || 0);

    const sheet = getSheet('Inventory');

    // Append NEW BATCH ROW
    // Headers: Item_ID, Item_Name, Category, Cost_Price, Selling_Price, Current_Qty, Reorder_Level, Supplier, Last_Updated, Updated_By, Batch_ID, Date_Received
    const itemReorderLevel = item.Reorder_Level !== undefined && item.Reorder_Level !== '' ? parseFloat(item.Reorder_Level) : 0;
    const newBatchRow = [
      itemId,
      item.Item_Name,
      item.Category,
      costPrice,
      item.Selling_Price,
      parseFloat(qty),
      itemReorderLevel,
      item.Supplier,
      new Date(),
      user || 'SYSTEM',
      batchId,
      new Date()
    ];

    sheet.appendRow(newBatchRow);

    clearInventoryCache();

    return {
      success: true,
      batchId: batchId,
      qty: parseFloat(qty),
      unitCost: costPrice,
      message: 'New batch created: ' + batchId
    };

  } catch (error) {
    logError('increaseStock', error);
    throw error;
  }
}

/**
 * Get inventory movement history for an item
 */
function getInventoryMovementHistory(itemId) {
  try {
    const auditData = sheetToObjects('Audit_Trail');

    // Filter for inventory movements for this item
    const movements = auditData.filter(log => {
      return log.Module === 'Inventory' &&
             (log.Action === 'Stock Adjustment' ||
              log.Action === 'Sale' ||
              log.Action === 'Purchase') &&
             log.Details.indexOf(itemId) !== -1;
    });

    // Sort by timestamp descending
    movements.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    return movements;

  } catch (error) {
    logError('getInventoryMovementHistory', error);
    return [];
  }
}

/**
 * Get inventory valuation (total value of all stock)
 */
function getInventoryValuation() {
  try {
    const items = getInventory();
    let totalCostValue = 0;
    let totalSellingValue = 0;

    items.forEach(item => {
      const qty = parseFloat(item.Current_Qty) || 0;
      const costPrice = parseFloat(item.Cost_Price) || 0;
      const sellingPrice = parseFloat(item.Selling_Price) || 0;

      totalCostValue += qty * costPrice;
      totalSellingValue += qty * sellingPrice;
    });

    return {
      totalCostValue: totalCostValue,
      totalSellingValue: totalSellingValue,
      potentialProfit: totalSellingValue - totalCostValue,
      itemCount: items.length
    };

  } catch (error) {
    logError('getInventoryValuation', error);
    return {
      totalCostValue: 0,
      totalSellingValue: 0,
      potentialProfit: 0,
      itemCount: 0
    };
  }
}

/**
 * Search products by name or ID
 */
function searchProducts(query) {
  try {
    if (!query) {
      return getInventory();
    }

    const items = getInventory();
    const lowerQuery = query.toLowerCase();

    return items.filter(item => {
      return (item.Item_ID && item.Item_ID.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (item.Item_Name && item.Item_Name.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (item.Category && item.Category.toLowerCase().indexOf(lowerQuery) !== -1);
    });

  } catch (error) {
    logError('searchProducts', error);
    return [];
  }
}

/**
 * Check if product has sufficient stock
 */
function checkStock(itemId, requiredQty) {
  try {
    const item = getInventoryItemById(itemId);
    const available = parseFloat(item.Current_Qty) || 0;

    return {
      available: available,
      required: parseFloat(requiredQty),
      sufficient: available >= parseFloat(requiredQty),
      shortage: available < parseFloat(requiredQty) ? (parseFloat(requiredQty) - available) : 0
    };

  } catch (error) {
    logError('checkStock', error);
    return {
      available: 0,
      required: parseFloat(requiredQty),
      sufficient: false,
      shortage: parseFloat(requiredQty)
    };
  }
}

// =====================================================
// MASTER DATA FUNCTIONS
// =====================================================

/**
 * Get all active master items from Master_Data sheet
 * Returns simplified format for dropdown: [{ Item_Name, Category }, ...]
 * @returns {Array} - Array of master items
 */
function getMasterItems() {
  try {
    const sheet = getSheet('Master_Data');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const rawHeaders = data[0];
    const expectedHeaders = ['Master_ID', 'Item_Name', 'Category', 'Description', 'Status'];
    const headers = Array.isArray(rawHeaders) && rawHeaders.length >= expectedHeaders.length
      ? rawHeaders
      : expectedHeaders;
    const masterItems = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const item = {};

      headers.forEach((header, index) => {
        item[header] = row[index];
      });

      const itemName = item.Item_Name || row[1];
      const category = item.Category || row[2] || '';
      const status = (item.Status || row[4] || 'Active').toString().toLowerCase();

      // Only return active items with Item_Name (treat blank status as active)
      if (itemName && (status === 'active' || status === '')) {
        masterItems.push({
          Item_Name: itemName,
          Category: category
        });
      }
    }

    // Sort alphabetically by Item_Name
    masterItems.sort((a, b) => {
      const nameA = (a.Item_Name || '').toLowerCase();
      const nameB = (b.Item_Name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return masterItems;

  } catch (error) {
    logError('getMasterItems', error);
    throw new Error('Error loading master items: ' + error.message);
  }
}

/**
 * Add new master item to Master_Data sheet
 * @param {string} name - Item name
 * @param {string} category - Category name
 * @param {string} user - Optional user name for audit
 * @returns {Object} - The newly created item { Item_Name, Category }
 */
function addMasterItem(name, category, description, status, user) {
  try {
    // Validation
    if (!name || name.trim() === '') {
      throw new Error('Item Name is required');
    }

    if (!category || category.trim() === '') {
      throw new Error('Category is required');
    }

    const sheet = getSheet('Master_Data');
    const itemName = name.trim();
    const itemCategory = category.trim();
    const itemDescription = description ? description.trim() : '';
    const statusValue = status ? status.trim() : 'Active';
    const itemStatus = (statusValue.toLowerCase() === 'inactive') ? 'Inactive' : 'Active';

    // Check for duplicates
    const existingItems = getMasterItems();
    const duplicate = existingItems.find(item =>
      item.Item_Name.toLowerCase() === itemName.toLowerCase() &&
      item.Category.toLowerCase() === itemCategory.toLowerCase()
    );

    if (duplicate) {
      throw new Error('This item already exists: ' + duplicate.Item_Name + ' (' + duplicate.Category + ')');
    }

    // Generate Master_ID
    const masterId = generateId('Master_Data', 'Master_ID', 'MASTER');

    // Prepare new row
    // Headers: Master_ID, Item_Name, Category, Description, Status
    const newMasterItem = [
      masterId,
      itemName,
      itemCategory,
      itemDescription,
      itemStatus
    ];

    sheet.appendRow(newMasterItem);

    logAudit(
      user || 'SYSTEM',
      'Master_Data',
      'Create',
      'Added master item: ' + itemName + ' (' + itemCategory + ')',
      '',
      '',
      JSON.stringify({ masterId, itemName, itemCategory, itemStatus })
    );

    // Return the new item in the expected format
    return {
      Master_ID: masterId,
      Item_Name: itemName,
      Category: itemCategory,
      Description: itemDescription,
      Status: itemStatus
    };

  } catch (error) {
    logError('addMasterItem', error);
    throw error;
  }
}

// =====================================================
// LOW STOCK ALERT FUNCTIONS
// =====================================================

/**
 * Send low stock email alert
 * This function should be triggered daily via a time-based trigger
 */
function sendLowStockAlert() {
  try {
    const lowStockItems = getLowStockItems();
    const outOfStockItems = lowStockItems.filter(item => (parseFloat(item.Current_Qty) || 0) === 0);

    if (lowStockItems.length === 0 && outOfStockItems.length === 0) {
      Logger.log('No low stock items found');
      return { success: true, message: 'No low stock items' };
    }

    // Get admin email from settings
    const settings = sheetToObjects('Settings');
    const adminEmailSetting = settings.find(s => s.Setting_Key === 'Admin_Email');
    const adminEmail = adminEmailSetting ? adminEmailSetting.Setting_Value : Session.getActiveUser().getEmail();

    // Build email content
    let emailBody = '<html><body style="font-family: Arial, sans-serif;">';
    emailBody += '<h2 style="color: #e74c3c;">📦 Inventory Alert - Low Stock Items</h2>';
    emailBody += '<p>The following items require your attention:</p>';

    // Out of Stock Section
    if (outOfStockItems.length > 0) {
      emailBody += '<h3 style="color: #c0392b;">🔴 Out of Stock (' + outOfStockItems.length + ' items)</h3>';
      emailBody += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
      emailBody += '<tr style="background-color: #f8d7da;">';
      emailBody += '<th>Item ID</th><th>Item Name</th><th>Category</th><th>Supplier</th><th>Reorder Level</th></tr>';

      outOfStockItems.forEach(item => {
        emailBody += '<tr>';
        emailBody += '<td>' + item.Item_ID + '</td>';
        emailBody += '<td><strong>' + item.Item_Name + '</strong></td>';
        emailBody += '<td>' + (item.Category || '') + '</td>';
        emailBody += '<td>' + (item.Supplier || '') + '</td>';
        emailBody += '<td>' + (item.Reorder_Level || 0) + '</td>';
        emailBody += '</tr>';
      });
      emailBody += '</table><br>';
    }

    // Low Stock Section
    if (lowStockItems.length > 0) {
      emailBody += '<h3 style="color: #e67e22;">⚠️ Low Stock (' + lowStockItems.length + ' items)</h3>';
      emailBody += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
      emailBody += '<tr style="background-color: #fff3cd;">';
      emailBody += '<th>Item ID</th><th>Item Name</th><th>Category</th><th>Current Qty</th><th>Reorder Level</th><th>Supplier</th></tr>';

      lowStockItems.forEach(item => {
        if (parseFloat(item.Current_Qty) > 0) { // Exclude out of stock items
          emailBody += '<tr>';
          emailBody += '<td>' + item.Item_ID + '</td>';
          emailBody += '<td><strong>' + item.Item_Name + '</strong></td>';
          emailBody += '<td>' + (item.Category || '') + '</td>';
          emailBody += '<td style="color: #e67e22;"><strong>' + item.Current_Qty + '</strong></td>';
          emailBody += '<td>' + (item.Reorder_Level || 0) + '</td>';
          emailBody += '<td>' + (item.Supplier || '') + '</td>';
          emailBody += '</tr>';
        }
      });
      emailBody += '</table>';
    }

    emailBody += '<br><p style="color: #7f8c8d; font-size: 12px;">This is an automated alert from Fatma Sales Management System.</p>';
    emailBody += '<p style="color: #7f8c8d; font-size: 12px;">Generated on: ' + new Date().toLocaleString() + '</p>';
    emailBody += '</body></html>';

    // Send email
    MailApp.sendEmail({
      to: adminEmail,
      subject: '🚨 Low Stock Alert - ' + (lowStockItems.length + outOfStockItems.length) + ' items need attention',
      htmlBody: emailBody
    });

    logAudit(
      'SYSTEM',
      'Inventory',
      'Low Stock Alert',
      'Alert sent for ' + (lowStockItems.length + outOfStockItems.length) + ' items to ' + adminEmail,
      '',
      '',
      ''
    );

    return {
      success: true,
      message: 'Alert sent to ' + adminEmail,
      itemCount: lowStockItems.length + outOfStockItems.length
    };

  } catch (error) {
    logError('sendLowStockAlert', error);
    throw new Error('Error sending low stock alert: ' + error.message);
  }
}

/**
 * Create time-based trigger for daily low stock alerts
 * Run this once to set up the daily alert at 8 AM
 */
function createLowStockAlertTrigger() {
  try {
    // Delete existing triggers for this function
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendLowStockAlert') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Create new trigger for 8 AM daily
    ScriptApp.newTrigger('sendLowStockAlert')
      .timeBased()
      .atHour(8)
      .everyDays(1)
      .create();

    return { success: true, message: 'Low stock alert trigger created for 8 AM daily' };

  } catch (error) {
    logError('createLowStockAlertTrigger', error);
    throw new Error('Error creating trigger: ' + error.message);
  }
}

// =====================================================
// DASHBOARD FUNCTIONS
// =====================================================

/**
 * Gets all data required for the Inventory Management dashboard.
 */
function getInventoryDashboardData() {
  try {
    // getInventory() already aggregates batches, which is perfect.
    const inventoryItems = getInventory(); 

    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };
    const pickCost = (item) => {
      return toNumber(
        item.Cost_Price ||
        item.Unit_Cost ||
        item.Purchase_Price ||
        item.Cost ||
        item.UnitPrice
      );
    };

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValue = 0;

    const formattedInventory = inventoryItems.map(item => {
      const stockLevel = toNumber(item.Current_Qty || item.Stock_Qty || item.Stock_Level || item.Qty || item.Quantity);
      const reorderLevel = toNumber(item.Reorder_Level);
      const costPrice = pickCost(item);
      const stockValue = toNumber(item.stock_value || item.Stock_Value || item.Inventory_Value) || (stockLevel * costPrice);

      let status = 'In Stock';
      if (stockLevel <= 0) {
        status = 'Out of Stock';
        outOfStockCount++;
      } else if (stockLevel <= reorderLevel) {
        status = 'Low Stock';
        lowStockCount++;
      }
      
      totalValue += stockValue;

      return {
        Item_ID: item.Item_ID,
        Item_Name: item.Item_Name,
        Category: item.Category || '',
        Supplier: item.Supplier || item.Supplier_ID || '',
        Stock_Level: stockLevel,
        Current_Qty: stockLevel,
        Stock_Qty: stockLevel,
        Reorder_Level: reorderLevel,
        Unit: item.Unit || 'Pcs', // Assuming 'Pcs' as a default unit
        Cost_Price: costPrice,
        Stock_Value: stockValue,
        Selling_Price: parseFloat(item.Selling_Price) || 0,
        Status: status
      };
    });

    const overview = {
      totalItems: inventoryItems.length,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      totalValue: totalValue
    };

    return {
      success: true,
      overview: overview,
      inventory: formattedInventory.sort((a,b) => (a.Item_ID || '').toString().localeCompare((b.Item_ID || '').toString()))
    };

  } catch (error) {
    logError('getInventoryDashboardData', error);
    return { success: false, message: 'Error loading inventory dashboard: ' + error.message };
  }
}
