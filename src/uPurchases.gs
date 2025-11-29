/**
 * Purchases Management Module
 * Handles: Purchase orders, goods received, supplier invoices, stock updates
 */

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
      const product = getInventoryItemById(item.Item_ID);
      const costPrice = item.Cost_Price || product.Cost_Price;
      const lineTotal = parseFloat(item.Qty) * parseFloat(costPrice);

      items.push({
        Item_ID: item.Item_ID,
        Item_Name: product.Item_Name,
        Qty: parseFloat(item.Qty),
        Cost_Price: parseFloat(costPrice),
        Line_Total: lineTotal
      });

      totalAmount += lineTotal;
    }

    const paidAmount = parseFloat(purchaseData.Paid_Amount) || 0;
    const balance = totalAmount - paidAmount;
    const paymentStatus = balance === 0 ? 'Paid' : (paidAmount === 0 ? 'Unpaid' : 'Partial');

    // Add each line item to Purchases sheet
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
      increaseStock(item.Item_ID, item.Qty, purchaseData.User, item.Cost_Price);
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
 * Record purchase payment
 * V3.0: Validates payment method against Chart of Accounts
 */
function recordPurchasePayment(purchaseId, supplierId, amount, paymentMethod, user) {
  try {
    // V3.0: Validate payment method exists in Chart of Accounts
    validateAccount(paymentMethod);

    const financialTxnId = generateId('Financials', 'Transaction_ID', 'FIN');
    const sheet = getSheet('Financials');

    const txnRow = [
      financialTxnId,
      new Date(),
      'Purchase_Payment',
      '', // Customer_ID (not applicable)
      'Purchases',
      paymentMethod, // Account
      'Payment for purchase ' + purchaseId,
      parseFloat(amount),
      parseFloat(amount), // Debit (money out)
      0, // Credit
      0, // Balance
      paymentMethod,
      supplierId, // Payee
      purchaseId, // Receipt_No
      purchaseId, // Reference
      'Approved',
      user,
      user
    ];

    sheet.appendRow(txnRow);

    // Update account balance (decrease)
    updateAccountBalance(paymentMethod, -parseFloat(amount), user);

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
