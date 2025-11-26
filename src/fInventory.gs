/**
 * Inventory Management Module
 * Handles: Product catalog, stock tracking, stock adjustments, low stock alerts
 */

// Cache key for inventory list (used when no filters are applied)
const INVENTORY_CACHE_KEY = 'inventory_cache_all';

// =====================================================
// INVENTORY FUNCTIONS
// =====================================================

/**
 * Get all inventory items with optional filters
 */
function getInventory(filters) {
  try {
    const useCache = !filters || Object.keys(filters).length === 0;

    if (useCache) {
      try {
        const cache = CacheService.getScriptCache();
        const cached = cache.get(INVENTORY_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (cacheError) {
        logError('getInventoryCache', cacheError);
      }
    }

    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const items = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const item = {};

      headers.forEach((header, index) => {
        item[header] = row[index];
      });

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

      // Add compatibility alias for frontend (Stock_Qty -> Current_Qty)
      item.Stock_Qty = item.Current_Qty;

      items.push(item);
    }

    if (useCache) {
      try {
        CacheService.getScriptCache().put(INVENTORY_CACHE_KEY, JSON.stringify(items), 300);
      } catch (cacheError) {
        logError('setInventoryCache', cacheError);
      }
    }

    return items;

  } catch (error) {
    logError('getInventory', error);
    throw new Error('Error loading inventory: ' + error.message);
  }
}

/**
 * Clear cached inventory data
 */
function clearInventoryCache() {
  try {
    CacheService.getScriptCache().remove(INVENTORY_CACHE_KEY);
  } catch (error) {
    logError('clearInventoryCache', error);
  }
}

/**
 * Get inventory item by ID
 */
function getInventoryItemById(itemId) {
  try {
    const item = findRowById('Inventory', 'Item_ID', itemId);
    if (!item) {
      throw new Error('Product not found: ' + itemId);
    }

    // Backwards compatibility: expose Stock_Qty for UIs expecting this field
    item.Stock_Qty = item.Current_Qty;

    item.stock_status = getStockStatus(item.Current_Qty, item.Reorder_Level);
    item.stock_value = (item.Current_Qty || 0) * (item.Cost_Price || 0);

    // Add compatibility alias for frontend (Stock_Qty -> Current_Qty)
    item.Stock_Qty = item.Current_Qty;

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
 * Add new product to inventory
 */
function addProduct(productData) {
  try {
    const stockSource = (productData.Stock_Source || 'opening').toLowerCase();
    const isPurchase = stockSource === 'purchase';

    // 1. Validation (Matches your form inputs)
    const requiredFields = ['Item_Name', 'Cost_Price', 'Current_Qty'];
    if (isPurchase) {
      requiredFields.push('Supplier');
    }

    validateRequired(productData, requiredFields);

    const sheet = getSheet('Inventory');
    const itemId = generateId('Inventory', 'Item_ID', 'ITEM');

    const purchaseQty = parseFloat(productData.Current_Qty) || 0;
    const startingQty = isPurchase ? 0 : purchaseQty;

    // 2. HARD-CODED MAPPING (Matches your Header String Exactly)
    // Headers: Item_ID, Item_Name, Category, Cost_Price, Selling_Price, Current_Qty, Reorder_Level, Supplier, Last_Updated, Updated_By
    const sellingPrice =
      productData.Selling_Price !== undefined && productData.Selling_Price !== ''
        ? parseFloat(productData.Selling_Price)
        : parseFloat(productData.Cost_Price) || 0;

    const newProduct = [
      itemId,                                  // 1. Item_ID
      productData.Item_Name || '',             // 2. Item_Name
      productData.Category || 'General',       // 3. Category
      parseFloat(productData.Cost_Price) || 0, // 4. Cost_Price
      sellingPrice,                            // 5. Selling_Price
      startingQty,                             // 6. Current_Qty
      parseFloat(productData.Reorder_Level)||10,// 7. Reorder_Level
      productData.Supplier || '',              // 8. Supplier
      new Date(),                              // 9. Last_Updated
      productData.User || 'SYSTEM'             // 10. Updated_By
    ];

    sheet.appendRow(newProduct);

    logAudit(
      productData.User || 'SYSTEM',
      'Inventory',
      'Create',
      'Added: ' + productData.Item_Name + ' via ' + (isPurchase ? 'Purchase' : 'Opening Balance'),
      '',
      '',
      JSON.stringify(newProduct)
    );

    // If this is a purchase, create a purchase record to update supplier balances and payments
    if (isPurchase && productData.Supplier) {
      const supplier = getSupplierById(productData.Supplier);
      const paidAmount = parseFloat(productData.Paid_Amount) || 0;

      createPurchase({
        Supplier_ID: productData.Supplier,
        Supplier_Name: supplier.Supplier_Name,
        items: [{ Item_ID: itemId, Qty: purchaseQty, Cost_Price: productData.Cost_Price }],
        Payment_Method: productData.Payment_Method || 'Cash',
        Paid_Amount: paidAmount,
        User: productData.User || 'SYSTEM'
      });
    }

    clearInventoryCache();
    return { success: true, itemId: itemId, message: 'Product added successfully' };

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
 */
function decreaseStock(itemId, qty, user) {
  try {
    const item = getInventoryItemById(itemId);
    const currentQty = parseFloat(item.Current_Qty) || 0;
    const newQty = currentQty - parseFloat(qty);

    if (newQty < 0) {
      throw new Error('Insufficient stock for ' + item.Item_Name + '. Available: ' + currentQty + ', Required: ' + qty);
    }

    updateRowById('Inventory', 'Item_ID', itemId, {
      Current_Qty: newQty,
      Last_Updated: new Date(),
      Updated_By: user || 'SYSTEM'
    });

    clearInventoryCache();

    return {
      success: true,
      oldQty: currentQty,
      newQty: newQty
    };

  } catch (error) {
    logError('decreaseStock', error);
    throw error;
  }
}

/**
 * Update stock after purchase (increase)
 */
function increaseStock(itemId, qty, user) {
  try {
    const item = getInventoryItemById(itemId);
    const currentQty = parseFloat(item.Current_Qty) || 0;
    const newQty = currentQty + parseFloat(qty);

    updateRowById('Inventory', 'Item_ID', itemId, {
      Current_Qty: newQty,
      Last_Updated: new Date(),
      Updated_By: user || 'SYSTEM'
    });

    clearInventoryCache();

    return {
      success: true,
      oldQty: currentQty,
      newQty: newQty
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
