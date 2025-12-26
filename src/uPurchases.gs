/**
 * Purchases Management Module
 * Handles: Purchase orders, goods received, supplier invoices, stock updates
 */

/**
 * Ensure an inventory item exists for a purchase line.
 * If not found, auto-create a placeholder item so the purchase can proceed.
 *
 * OPTIMIZED: Skip expensive getInventoryItemById() call if item already has all required fields.
 * This prevents redundant full-sheet reads when adding new products.
 */
function ensurePurchaseItem(item, user) {
  // OPTIMIZATION: If item already has all required fields (new product from addProduct()),
  // skip the expensive getInventoryItemById() call that reads the entire Inventory sheet
  const hasRequiredFields = item.Item_ID && item.Item_Name && item.Cost_Price !== undefined;

  if (hasRequiredFields) {
    // Return item details directly without querying the sheet
    const cost = parseFloat(item.Cost_Price) || 0;
    const selling = (item.Selling_Price !== undefined && item.Selling_Price !== null && item.Selling_Price !== '')
      ? (parseFloat(item.Selling_Price) || cost)
      : cost;

    return {
      Item_ID: item.Item_ID,
      Item_Name: item.Item_Name,
      Category: item.Category || 'General',
      Cost_Price: cost,
      Selling_Price: selling,
      Reorder_Level: item.Reorder_Level !== undefined && item.Reorder_Level !== '' ? parseFloat(item.Reorder_Level) : 0,
      Supplier: item.Supplier || item.Supplier_ID || '',
      Current_Qty: 0,
      Stock_Qty: 0
    };
  }

  // Fallback: Try to fetch from sheet (for manual purchases of existing items)
  try {
    return getInventoryItemById(item.Item_ID);
  } catch (e) {
    // Item doesn't exist - return stub
    const itemId = (item.Item_ID && item.Item_ID.toString().trim() !== '') ? item.Item_ID : generateId('Inventory', 'Item_ID', 'ITEM');
    const cost = parseFloat(item.Cost_Price) || 0;
    const selling = (item.Selling_Price !== undefined && item.Selling_Price !== null && item.Selling_Price !== '')
      ? (parseFloat(item.Selling_Price) || cost)
      : cost;
    return {
      Item_ID: itemId,
      Item_Name: item.Item_Name || 'Manual Item',
      Category: item.Category || 'Manual',
      Cost_Price: cost,
      Selling_Price: selling,
      Reorder_Level: item.Reorder_Level !== undefined && item.Reorder_Level !== '' ? parseFloat(item.Reorder_Level) : 0,
      Supplier: item.Supplier || item.Supplier_ID || '',
      Current_Qty: 0,
      Stock_Qty: 0
    };
  }
}

/**
 * Create a new purchase order
 */
function createPurchase(purchaseData) {
  try {
    validateRequired(purchaseData, ['Supplier_ID', 'items', 'User']);

    const sheet = getSheet('Purchases');
    const purchaseId = generateId('Purchases', 'Purchase_ID', 'PUR');
    const date = new Date();

    // Calculate totals
    let totalAmount = 0;
    const items = [];

    for (const item of purchaseData.items) {
      const product = ensurePurchaseItem(item, purchaseData.User);
      const costPrice = item.Cost_Price || product.Cost_Price;
      const lineTotal = parseFloat(item.Qty) * parseFloat(costPrice);

      const reorderLevelVal = item.Reorder_Level !== undefined && item.Reorder_Level !== ''
        ? parseFloat(item.Reorder_Level)
        : (product.Reorder_Level !== undefined && product.Reorder_Level !== '' ? parseFloat(product.Reorder_Level) : 0);

      items.push({
        Item_ID: item.Item_ID,
        Item_Name: product.Item_Name,
        Category: item.Category || product.Category || '',
        Supplier_ID: purchaseData.Supplier_ID,
        Supplier: purchaseData.Supplier_Name || purchaseData.Supplier_ID || '',
        Reorder_Level: reorderLevelVal,
        Qty: parseFloat(item.Qty),
        Cost_Price: parseFloat(costPrice),
        Line_Total: lineTotal
      });

      totalAmount += lineTotal;
    }

    const paidAmount = parseFloat(purchaseData.Paid_Amount) || 0;
    const balance = totalAmount - paidAmount;
    const paymentStatus = balance === 0 ? 'Paid' : (paidAmount === 0 ? 'Unpaid' : 'Partial');

    // Add each line item to Purchases sheet (preserve original columns)
    items.forEach(item => {
      const purchaseRow = [
        purchaseId,
        date,
        purchaseData.Supplier_ID,
        purchaseData.Supplier_Name || '',
        item.Item_ID,
        item.Item_Name,
        item.Qty,
        item.Cost_Price,
        item.Line_Total,
        totalAmount,
        paymentStatus,
        purchaseData.Payment_Method || 'Cash',
        paidAmount,
        balance,
        purchaseData.User
      ];

      sheet.appendRow(purchaseRow);
    });

    // Increase stock for each item (V3.0: Pass Cost_Price for batch tracking)
    for (const item of items) {
      increaseStock(item.Item_ID, item.Qty, purchaseData.User, item.Cost_Price, item);
    }

    // Update supplier totals
    const supplier = getSupplierById(purchaseData.Supplier_ID);
    updateSupplierPurchaseTotals(purchaseData.Supplier_ID, totalAmount, purchaseData.User);

    // Record payment if paid
    if (paidAmount > 0) {
      recordPurchasePayment(purchaseId, purchaseData.Supplier_ID, paidAmount, purchaseData.Payment_Method, purchaseData.User);
    }

    logAudit(
      purchaseData.User,
      'Purchases',
      'Create Purchase',
      'Purchase created: ' + purchaseId + ' for ' + formatCurrency(totalAmount),
      '',
      '',
      JSON.stringify({purchaseId, totalAmount, items: items.length})
    );

    return {
      success: true,
      purchaseId: purchaseId,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      balance: balance,
      items: items,
      message: 'Purchase created successfully'
    };

  } catch (error) {
    logError('createPurchase', error);
    throw new Error('Error creating purchase: ' + error.message);
  }
}

/**
 * Process a supplier return (send inventory back to supplier).
 * Decreases stock (FIFO), credits Inventory Asset, and debits either Accounts Payable (credit note) or cash/bank.
 */
function processSupplierReturn(supplierId, items, reason, paymentMethod, user) {
  try {
    if (!supplierId) throw new Error('Supplier_ID is required');
    if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Items are required');
    if (!reason) throw new Error('Reason is required');

    // Ensure accounts exist
    if (typeof ensureReturnAccountsInitialized === 'function') {
      ensureReturnAccountsInitialized();
    }

    const supplier = getSupplierById(supplierId);
    const date = new Date();
    let totalReturnCost = 0;
    
    // V3.1: Create negative purchase entries for returns
    const purchasesSheet = getSheet('Purchases');
    const returnId = generateId('Purchases', 'Purchase_ID', 'SRN');
    const returnItemsForPurchaseSheet = [];

    // Step 1: Pre-fetch item details before stock levels change
    for (const item of items) {
      const inventoryItem = getInventoryItemById(item.Item_ID);
      item.Item_Name = inventoryItem.Item_Name; // Add name to the item object for later use
    }

    // Step 2: Decrease stock using FIFO and prepare purchase sheet entries
    for (const item of items) {
      const qty = parseFloat(item.Qty) || 0;
      if (!item.Item_ID || qty <= 0) {
        throw new Error('Invalid item/quantity for return');
      }

      const stockResult = decreaseStock(item.Item_ID, qty, user || 'SYSTEM');
      if (!stockResult || !stockResult.success) {
        throw new Error('Failed to decrease stock for item ' + item.Item_ID);
      }
      
      const itemReturnCost = stockResult.totalCOGS || 0;
      totalReturnCost += itemReturnCost;
      const averageCost = itemReturnCost / qty;

      // Prepare a line for the negative purchase entry
      returnItemsForPurchaseSheet.push({
        Item_ID: item.Item_ID,
        Item_Name: item.Item_Name,
        Qty: -qty,
        Cost_Price: averageCost,
        Line_Total: -itemReturnCost
      });

      // Append audit trail entry for each item return
      logAudit(
        user || 'SYSTEM',
        'Inventory',
        'Supplier Return',
        'Returned ' + qty + ' of item ' + item.Item_ID + ' to supplier ' + supplierId,
        '',
        '',
        JSON.stringify({ itemId: item.Item_ID, qty: qty, reason: reason, cost: itemReturnCost })
      );
    }
    
    // Step 3: Write the negative purchase entries to the Purchases sheet
    const purchaseRows = returnItemsForPurchaseSheet.map(returnLine => ([
      returnId,
      date,
      supplierId,
      supplier.Supplier_Name,
      returnLine.Item_ID,
      returnLine.Item_Name,
      returnLine.Qty,
      returnLine.Cost_Price,
      returnLine.Line_Total,
      -totalReturnCost, // Total amount for the entire return transaction
      'Returned',       // Payment_Status
      'Credit Note',    // Payment_Method
      0,                // Paid_Amount
      0,                // Balance
      user || 'SYSTEM'
    ]));

    if (purchaseRows.length === 0) {
      throw new Error('No return lines generated for Purchases sheet.');
    }

    const startRow = purchasesSheet.getLastRow() + 1;
    purchasesSheet
      .getRange(startRow, 1, purchaseRows.length, purchaseRows[0].length)
      .setValues(purchaseRows);

    // Step 4: Financial entries (existing logic)
    const financialSheet = getSheet('Financials');
    const canonicalPayment = canonicalizeAccountName(paymentMethod);
    const isCreditNote = (paymentMethod || '').toString().toLowerCase() === 'credit';
    const debitAccount = isCreditNote ? 'Accounts Payable' : canonicalPayment || 'Cash';

    const debitTxnId = generateId('Financials', 'Transaction_ID', isCreditNote ? 'SUPCRN' : 'SUPRF');
    const debitRow = [
      debitTxnId,
      date,
      isCreditNote ? 'Supplier_Credit_Note' : 'Supplier_Refund',
      '', // Customer_ID
      'Purchases Return',
      debitAccount,
      (isCreditNote ? 'Credit note ' : 'Refund ') + 'for supplier return: ' + reason + ' [Ref: ' + returnId + ']',
      totalReturnCost,
      totalReturnCost, // Debit
      0, // Credit
      0,
      isCreditNote ? 'Credit' : canonicalPayment,
      supplier.Supplier_Name,
      returnId, // Receipt_No
      supplierId,
      'Approved',
      user,
      user
    ];
    financialSheet.appendRow(debitRow);

    const creditTxnId = generateId('Financials', 'Transaction_ID', 'INVRET');
    const creditRow = [
      creditTxnId,
      date,
      'Inventory_Return_To_Supplier',
      '', // Customer_ID
      'Inventory',
      'Inventory Asset',
      'Inventory returned to supplier: ' + reason + ' [Ref: ' + returnId + ']',
      totalReturnCost,
      0,
      totalReturnCost, // Credit (reduce asset)
      0,
      '',
      supplier.Supplier_Name,
      returnId, // Receipt_No
      supplierId,
      'Approved',
      user,
      user
    ];
    financialSheet.appendRow(creditRow);

    // Step 5: Update supplier balances (reduce purchases and balance)
    const currentBalance = parseFloat(supplier.Current_Balance) || 0;
    const totalPurchased = parseFloat(supplier.Total_Purchased) || 0;
    const newBalance = Math.max(0, currentBalance - totalReturnCost);
    const newTotalPurchased = Math.max(0, totalPurchased - totalReturnCost);
    updateRowById('Suppliers', 'Supplier_ID', supplierId, {
      Current_Balance: newBalance,
      Total_Purchased: newTotalPurchased
    });

    // Audit log
    logAudit(
      user || 'SYSTEM',
      'Purchases',
      'Supplier Return',
      'Returned goods to supplier ' + supplier.Supplier_Name + ' amount: ' + formatCurrency(totalReturnCost) + ' Reason: ' + reason,
      '',
      '',
      JSON.stringify({ supplierId, items, totalReturnCost, paymentMethod, returnId })
    );

    // Clear caches that depend on inventory/suppliers
    try { clearInventoryCache(); } catch (e) {}

    return {
      success: true,
      supplierId: supplierId,
      totalReturnCost: totalReturnCost,
      debitTxnId: debitTxnId,
      creditTxnId: creditTxnId,
      returnId: returnId,
      message: 'Supplier return processed successfully'
    };

  } catch (error) {
    logError('processSupplierReturn', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Record purchase payment
 * V3.0: Validates payment method against Chart of Accounts
 */
function recordPurchasePayment(purchaseId, supplierId, amount, paymentMethod, user) {
  try {
    // ✅ FIX: Canonicalize account name for consistency with financial statements
    const canonicalAccount = canonicalizeAccountName(paymentMethod);

    // V3.0: Validate payment method exists in Chart of Accounts
    validateAccount(canonicalAccount);

    const financialTxnId = generateId('Financials', 'Transaction_ID', 'FIN');
    const sheet = getSheet('Financials');

    const txnRow = [
      financialTxnId,
      new Date(),
      'Purchase_Payment',
      '', // Customer_ID (not applicable)
      'Purchases',
      canonicalAccount, // ✅ FIX: Use canonical account name
      'Payment for purchase ' + purchaseId,
      parseFloat(amount),
      0, // Debit
      parseFloat(amount), // ✅ FIX: Credit cash (asset decreases when paying for purchase)
      0, // Balance
      canonicalAccount, // ✅ FIX: Payment method canonicalized
      supplierId, // Payee
      purchaseId, // Receipt_No
      purchaseId, // Reference
      'Approved',
      user,
      user
    ];

    sheet.appendRow(txnRow);

    // Update account balance (decrease)
    updateAccountBalance(canonicalAccount, -parseFloat(amount), user); // ✅ FIX: Use canonical account

    // Update supplier payment
    updateSupplierPayment(supplierId, parseFloat(amount), user);

  } catch (error) {
    logError('recordPurchasePayment', error);
    throw error;
  }
}

/**
 * Get purchase by ID
 */
function getPurchaseById(purchaseId) {
  try {
    const purchases = sheetToObjects('Purchases');
    const purchaseRows = purchases.filter(p => p.Purchase_ID === purchaseId);

    if (purchaseRows.length === 0) return null;

    const first = purchaseRows[0];
    const items = purchaseRows.map(row => ({
      Item_ID: row.Item_ID,
      Item_Name: row.Item_Name,
      Qty: row.Qty,
      Cost_Price: row.Cost_Price,
      Line_Total: row.Line_Total
    }));

    return {
      Purchase_ID: first.Purchase_ID,
      Date: first.Date,
      Supplier_ID: first.Supplier_ID,
      Supplier_Name: first.Supplier_Name,
      Total_Amount: first.Total_Amount,
      Payment_Status: first.Payment_Status,
      Payment_Method: first.Payment_Method,
      Paid_Amount: first.Paid_Amount,
      Balance: first.Balance,
      Recorded_By: first.Recorded_By,
      items: items
    };

  } catch (error) {
    logError('getPurchaseById', error);
    return null;
  }
}

/**
 * Get all purchases
 */
function getPurchases(filters) {
  try {
    const purchases = sheetToObjects('Purchases');
    let filtered = purchases;

    if (filters) {
      for (let key in filters) {
        filtered = filtered.filter(p => p[key] === filters[key]);
      }
    }

    // Group by Purchase_ID
    const grouped = {};
    filtered.forEach(purchase => {
      if (!grouped[purchase.Purchase_ID]) {
        grouped[purchase.Purchase_ID] = {
          Purchase_ID: purchase.Purchase_ID,
          Date: purchase.Date,
          Supplier_Name: purchase.Supplier_Name,
          Total_Amount: purchase.Total_Amount,
          Payment_Status: purchase.Payment_Status,
          Paid_Amount: purchase.Paid_Amount,
          Balance: purchase.Balance,
          itemCount: 0
        };
      }
      grouped[purchase.Purchase_ID].itemCount++;
    });

    return Object.values(grouped);

  } catch (error) {
    logError('getPurchases', error);
    return [];
  }
}
