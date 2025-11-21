/**
 * INVENTORY MANAGEMENT MODULE
 * Handles: Product Management, Stock Control, Purchase Recording
 */

// =====================================================
// PRODUCT MANAGEMENT
// =====================================================

/**
 * Adds a new product to inventory
 * @param {Object} productData - Product information
 * @returns {Object} Result with success status
 */
function addProduct(productData) {
  try {
    // Validate required fields
    validateRequired(productData, ['Item_Name', 'Category', 'Cost_Price', 'Selling_Price', 'Current_Qty', 'Reorder_Level']);

    // Generate Item ID
    const itemId = generateId('Inventory', 'Item_ID', 'ITEM');

    // Prepare data
    const sheet = getSheet('Inventory');
    const rowData = [
      itemId,
      productData.Item_Name,
      productData.Category,
      parseFloat(productData.Cost_Price),
      parseFloat(productData.Selling_Price),
      parseFloat(productData.Current_Qty),
      parseFloat(productData.Reorder_Level),
      productData.Supplier || '',
      new Date(),
      productData.User || 'SYSTEM'
    ];

    sheet.appendRow(rowData);

    // Log audit trail
    logAudit(
      productData.User || 'SYSTEM',
      'Inventory',
      'Add Product',
      'Product added: ' + itemId + ' - ' + productData.Item_Name,
      productData.Session_ID || '',
      '',
      JSON.stringify(rowData)
    );

    return {
      success: true,
      itemId: itemId,
      message: 'Product added successfully'
    };

  } catch (error) {
    logError('addProduct', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Updates an existing product
 * @param {String} itemId - Item ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Result with success status
 */
function updateProduct(itemId, updates) {
  try {
    // Verify product exists
    const product = findRowById('Inventory', 'Item_ID', itemId);
    if (!product) {
      throw new Error('Product not found: ' + itemId);
    }

    // Add update metadata
    updates.Last_Updated = new Date();
    if (updates.User) {
      updates.Updated_By = updates.User;
      delete updates.User;
    }

    // Update the row
    const result = updateRowById('Inventory', 'Item_ID', itemId, updates);

    // Log audit trail
    logAudit(
      updates.Updated_By || 'SYSTEM',
      'Inventory',
      'Update Product',
      'Product updated: ' + itemId,
      updates.Session_ID || '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Product updated successfully'
    };

  } catch (error) {
    logError('updateProduct', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Gets all products with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of products
 */
function getProducts(filters) {
  try {
    return sheetToObjects('Inventory', filters);
  } catch (error) {
    logError('getProducts', error);
    return {
      success: false,
      message: 'Error loading products: ' + error.message
    };
  }
}

/**
 * Gets a single product by ID
 * @param {String} itemId - Item ID
 * @returns {Object} Product data
 */
function getProductById(itemId) {
  try {
    const product = findRowById('Inventory', 'Item_ID', itemId);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  } catch (error) {
    logError('getProductById', error);
    throw new Error('Error loading product: ' + error.message);
  }
}

// =====================================================
// STOCK MANAGEMENT
// =====================================================

/**
 * Manually adjusts stock quantity (add or remove)
 * @param {String} itemId - Item ID
 * @param {Number} qtyChange - Quantity to add (positive) or remove (negative)
 * @param {String} reason - Reason for adjustment
 * @param {String} user - User making adjustment
 * @returns {Object} Result with success status
 */
function adjustStock(itemId, qtyChange, reason, user) {
  try {
    // Validate inputs
    if (!itemId || qtyChange === undefined || qtyChange === 0) {
      throw new Error('Invalid adjustment parameters');
    }

    // Get product
    const product = findRowById('Inventory', 'Item_ID', itemId);
    if (!product) {
      throw new Error('Product not found: ' + itemId);
    }

    const currentQty = parseFloat(product.Current_Qty) || 0;
    const newQty = currentQty + parseFloat(qtyChange);

    // Prevent negative stock
    if (newQty < 0) {
      throw new Error('Cannot adjust stock below zero. Current: ' + currentQty + ', Change: ' + qtyChange);
    }

    // Update quantity
    const updates = {
      Current_Qty: newQty,
      Last_Updated: new Date(),
      Updated_By: user
    };

    const result = updateRowById('Inventory', 'Item_ID', itemId, updates);

    // Log audit trail
    logAudit(
      user,
      'Inventory',
      'Adjust Stock',
      'Stock adjusted for ' + itemId + ' (' + product.Item_Name + '): ' + qtyChange + '. Reason: ' + reason,
      '',
      'Qty: ' + currentQty,
      'Qty: ' + newQty
    );

    return {
      success: true,
      newQty: newQty,
      message: 'Stock adjusted successfully'
    };

  } catch (error) {
    logError('adjustStock', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Gets items with low stock (below reorder level)
 * @returns {Array} Array of low stock items
 */
function getLowStockItems() {
  try {
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return [];

    const headers = data[0];
    const qtyCol = headers.indexOf('Current_Qty');
    const reorderCol = headers.indexOf('Reorder_Level');

    const lowStockItems = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const qty = parseFloat(row[qtyCol]) || 0;
      const reorder = parseFloat(row[reorderCol]) || 0;

      if (qty <= reorder) {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = row[index];
        });
        item.shortage = reorder - qty;
        lowStockItems.push(item);
      }
    }

    return lowStockItems;

  } catch (error) {
    logError('getLowStockItems', error);
    return [];
  }
}

/**
 * Gets inventory valuation (total value of stock)
 * @returns {Object} Valuation data
 */
function getInventoryValuation() {
  try {
    const sheet = getSheet('Inventory');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        totalItems: 0,
        totalUnits: 0,
        costValue: 0,
        sellingValue: 0,
        potentialProfit: 0
      };
    }

    const headers = data[0];
    const qtyCol = headers.indexOf('Current_Qty');
    const costCol = headers.indexOf('Cost_Price');
    const sellCol = headers.indexOf('Selling_Price');

    let totalItems = 0;
    let totalUnits = 0;
    let costValue = 0;
    let sellingValue = 0;

    for (let i = 1; i < data.length; i++) {
      const qty = parseFloat(data[i][qtyCol]) || 0;
      const cost = parseFloat(data[i][costCol]) || 0;
      const sell = parseFloat(data[i][sellCol]) || 0;

      totalItems++;
      totalUnits += qty;
      costValue += qty * cost;
      sellingValue += qty * sell;
    }

    return {
      totalItems: totalItems,
      totalUnits: totalUnits,
      costValue: costValue,
      sellingValue: sellingValue,
      potentialProfit: sellingValue - costValue
    };

  } catch (error) {
    logError('getInventoryValuation', error);
    return {
      totalItems: 0,
      totalUnits: 0,
      costValue: 0,
      sellingValue: 0,
      potentialProfit: 0
    };
  }
}

// =====================================================
// PURCHASE MANAGEMENT
// =====================================================

/**
 * Records a purchase from supplier
 * @param {Object} purchaseData - Purchase information
 * @returns {Object} Result with success status
 */
function recordPurchase(purchaseData) {
  try {
    // Validate required fields
    validateRequired(purchaseData, ['Supplier_ID', 'Items', 'Payment_Method', 'User']);

    if (!purchaseData.Items || purchaseData.Items.length === 0) {
      throw new Error('No items in purchase');
    }

    // Verify supplier exists
    const supplier = findRowById('Suppliers', 'Supplier_ID', purchaseData.Supplier_ID);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Generate Purchase ID
    const purchaseId = generateId('Purchases', 'Purchase_ID', 'PUR');

    // Calculate total
    const totalAmount = purchaseData.Items.reduce((sum, item) => sum + (item.Cost_Price * item.Qty), 0);

    // Determine payment status
    const paidAmount = parseFloat(purchaseData.Paid_Amount) || 0;
    const balance = totalAmount - paidAmount;
    const paymentStatus = balance === 0 ? 'Paid' : (paidAmount === 0 ? 'Unpaid' : 'Partial');

    // Insert purchase header
    const purchasesSheet = getSheet('Purchases');
    const purchaseRow = [
      purchaseId,
      new Date(),
      purchaseData.Supplier_ID,
      supplier.Supplier_Name,
      totalAmount,
      paymentStatus,
      purchaseData.Payment_Method,
      paidAmount,
      balance,
      purchaseData.User
    ];
    purchasesSheet.appendRow(purchaseRow);

    // Insert purchase items and update inventory
    const itemsSheet = getSheet('Purchase_Items');
    purchaseData.Items.forEach(item => {
      const lineTotal = item.Cost_Price * item.Qty;

      itemsSheet.appendRow([
        purchaseId,
        item.Item_ID,
        item.Item_Name,
        item.Qty,
        item.Cost_Price,
        lineTotal
      ]);

      // Update inventory
      addToInventory(item.Item_ID, item.Qty, item.Cost_Price, purchaseData.User);
    });

    // Update supplier balance
    updateSupplierAfterPurchase(purchaseData.Supplier_ID, totalAmount, paidAmount, purchaseData.Payment_Method, purchaseData.User);

    // Record financial transaction if paid
    if (paidAmount > 0) {
      recordPurchasePayment(purchaseId, paidAmount, purchaseData.Payment_Method, purchaseData.User);
    }

    // Log audit trail
    logAudit(
      purchaseData.User,
      'Purchases',
      'Record Purchase',
      'Purchase recorded: ' + purchaseId + ' - Amount: ' + totalAmount,
      purchaseData.Session_ID || '',
      '',
      JSON.stringify(purchaseRow)
    );

    return {
      success: true,
      purchaseId: purchaseId,
      message: 'Purchase recorded successfully'
    };

  } catch (error) {
    logError('recordPurchase', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Adds quantity to inventory (from purchase)
 */
function addToInventory(itemId, qty, costPrice, user) {
  try {
    const inventorySheet = getSheet('Inventory');
    const data = inventorySheet.getDataRange().getValues();
    const headers = data[0];

    const idCol = headers.indexOf('Item_ID');
    const qtyCol = headers.indexOf('Current_Qty');
    const costCol = headers.indexOf('Cost_Price');
    const updatedCol = headers.indexOf('Last_Updated');
    const updatedByCol = headers.indexOf('Updated_By');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === itemId) {
        const currentQty = parseFloat(data[i][qtyCol]) || 0;
        const newQty = currentQty + qty;

        inventorySheet.getRange(i + 1, qtyCol + 1).setValue(newQty);
        inventorySheet.getRange(i + 1, costCol + 1).setValue(costPrice); // Update cost price
        inventorySheet.getRange(i + 1, updatedCol + 1).setValue(new Date());
        inventorySheet.getRange(i + 1, updatedByCol + 1).setValue(user);

        return;
      }
    }

    throw new Error('Product not found in inventory: ' + itemId);

  } catch (error) {
    logError('addToInventory', error);
    throw error;
  }
}

/**
 * Updates supplier data after purchase
 */
function updateSupplierAfterPurchase(supplierId, totalAmount, paidAmount, paymentMethod, user) {
  try {
    const supplier = findRowById('Suppliers', 'Supplier_ID', supplierId);
    if (!supplier) return;

    const totalPurchased = parseFloat(supplier.Total_Purchased) || 0;
    const totalPaid = parseFloat(supplier.Total_Paid) || 0;
    const currentBalance = parseFloat(supplier.Current_Balance) || 0;

    const newTotalPurchased = totalPurchased + totalAmount;
    const newTotalPaid = totalPaid + paidAmount;
    const newBalance = currentBalance + (totalAmount - paidAmount);

    // Update supplier
    const updates = {
      Total_Purchased: newTotalPurchased,
      Total_Paid: newTotalPaid,
      Current_Balance: newBalance
    };

    updateRowById('Suppliers', 'Supplier_ID', supplierId, updates);

  } catch (error) {
    logError('updateSupplierAfterPurchase', error);
    throw error;
  }
}

/**
 * Records financial transaction for purchase payment
 */
function recordPurchasePayment(purchaseId, amount, paymentMethod, user) {
  try {
    // Determine account
    let account = 'Cash';
    if (paymentMethod === 'MPESA') {
      account = 'MPESA';
    } else if (paymentMethod === 'Bank') {
      account = 'Equity Bank';
    }

    // Get current balance
    const currentBalance = getAccountBalance(account);
    const newBalance = currentBalance - amount;

    // Record transaction (debit)
    const financialsSheet = getSheet('Financials');
    financialsSheet.appendRow([
      new Date(),
      purchaseId,
      'Purchase',
      account,
      'Purchase payment',
      amount, // Debit
      0, // Credit
      newBalance,
      user,
      purchaseId
    ]);

  } catch (error) {
    logError('recordPurchasePayment', error);
    throw error;
  }
}

/**
 * Gets all purchases with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of purchases
 */
function getPurchases(filters) {
  try {
    return sheetToObjects('Purchases', filters);
  } catch (error) {
    logError('getPurchases', error);
    throw new Error('Error loading purchases: ' + error.message);
  }
}

/**
 * Gets a single purchase by ID
 * @param {String} purchaseId - Purchase ID
 * @returns {Object} Purchase data with items
 */
function getPurchaseById(purchaseId) {
  try {
    const purchase = findRowById('Purchases', 'Purchase_ID', purchaseId);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Get items
    const items = sheetToObjects('Purchase_Items', { Purchase_ID: purchaseId });
    purchase.Items = items;

    return purchase;

  } catch (error) {
    logError('getPurchaseById', error);
    throw new Error('Error loading purchase: ' + error.message);
  }
}

// =====================================================
// INVENTORY REPORTS
// =====================================================

/**
 * Gets inventory movement report
 * @param {String} itemId - Item ID (optional, for specific item)
 * @param {Object} dateRange - Date range (optional)
 * @returns {Object} Movement report
 */
function getInventoryMovement(itemId, dateRange) {
  try {
    const movements = [];

    // Get sales (outgoing)
    const salesItems = sheetToObjects('Sales_Items', itemId ? { Item_ID: itemId } : null);
    const salesData = sheetToObjects('Sales_Data', null);

    salesItems.forEach(item => {
      const sale = salesData.find(s => s.Sale_ID === item.Sale_ID);
      if (sale) {
        // Filter by date if provided
        if (dateRange) {
          const saleDate = new Date(sale.DateTime);
          if (dateRange.start && saleDate < new Date(dateRange.start)) return;
          if (dateRange.end && saleDate > new Date(dateRange.end)) return;
        }

        movements.push({
          date: sale.DateTime,
          type: 'Sale',
          reference: item.Sale_ID,
          itemId: item.Item_ID,
          itemName: item.Item_Name,
          qtyChange: -item.Qty,
          reason: 'Sale to ' + sale.Customer_Name
        });
      }
    });

    // Get purchases (incoming)
    const purchaseItems = sheetToObjects('Purchase_Items', itemId ? { Item_ID: itemId } : null);
    const purchasesData = sheetToObjects('Purchases', null);

    purchaseItems.forEach(item => {
      const purchase = purchasesData.find(p => p.Purchase_ID === item.Purchase_ID);
      if (purchase) {
        // Filter by date if provided
        if (dateRange) {
          const purchaseDate = new Date(purchase.Date);
          if (dateRange.start && purchaseDate < new Date(dateRange.start)) return;
          if (dateRange.end && purchaseDate > new Date(dateRange.end)) return;
        }

        movements.push({
          date: purchase.Date,
          type: 'Purchase',
          reference: item.Purchase_ID,
          itemId: item.Item_ID,
          itemName: item.Item_Name,
          qtyChange: item.Qty,
          reason: 'Purchase from ' + purchase.Supplier_Name
        });
      }
    });

    // Sort by date
    movements.sort((a, b) => new Date(b.date) - new Date(a.date));

    return movements;

  } catch (error) {
    logError('getInventoryMovement', error);
    return [];
  }
}

/**
 * Gets products by category with summary
 * @returns {Object} Categories with products and summary
 */
function getProductsByCategory() {
  try {
    const products = getProducts(null);
    const categories = {};

    products.forEach(product => {
      const category = product.Category || 'Uncategorized';

      if (!categories[category]) {
        categories[category] = {
          name: category,
          products: [],
          totalItems: 0,
          totalUnits: 0,
          totalValue: 0
        };
      }

      categories[category].products.push(product);
      categories[category].totalItems++;
      categories[category].totalUnits += parseFloat(product.Current_Qty) || 0;
      categories[category].totalValue += (parseFloat(product.Current_Qty) || 0) * (parseFloat(product.Selling_Price) || 0);
    });

    return Object.values(categories);

  } catch (error) {
    logError('getProductsByCategory', error);
    return [];
  }
}
