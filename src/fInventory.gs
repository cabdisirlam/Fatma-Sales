/**
 * Inventory Management Module
 * Handles: Product catalog, stock tracking, stock adjustments, low stock alerts
 */

// =====================================================
// INVENTORY FUNCTIONS
// =====================================================

/**
 * Get all inventory items with optional filters
 */
function getInventory(filters) {
  try {
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

    return items;

  } catch (error) {
    logError('getInventory', error);
    throw new Error('Error loading inventory: ' + error.message);
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
 * Add new product to inventory
 */
function addProduct(productData) {
  try {
    validateRequired(productData, ['Item_Name', 'Cost_Price', 'Selling_Price', 'Current_Qty']);

    const sheet = getSheet('Inventory');
    const itemId = generateId('Inventory', 'Item_ID', 'ITEM');

    const newProduct = [
      itemId,
      productData.Item_Name || '',
      productData.Category || 'General',
      parseFloat(productData.Cost_Price) || 0,
      parseFloat(productData.Selling_Price) || 0,
      parseFloat(productData.Current_Qty) || 0,
      parseFloat(productData.Reorder_Level) || 10,
      productData.Supplier || '',
      new Date(),
      productData.User || 'SYSTEM'
    ];

    sheet.appendRow(newProduct);

    logAudit(
      productData.User || 'SYSTEM',
      'Inventory',
      'Create',
      'New product added: ' + productData.Item_Name + ' (ID: ' + itemId + ')',
      '',
      '',
      JSON.stringify(newProduct)
    );

    return {
      success: true,
      itemId: itemId,
      message: 'Product added successfully'
    };

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
    if (productData.Cost_Price !== undefined) updates.Cost_Price = parseFloat(productData.Cost_Price);
    if (productData.Selling_Price !== undefined) updates.Selling_Price = parseFloat(productData.Selling_Price);
    if (productData.Reorder_Level !== undefined) updates.Reorder_Level = parseFloat(productData.Reorder_Level);
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
