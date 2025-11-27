/**
 * Sales Management Module
 * Handles: Sales, Quotations, Returns, Receipt generation
 */

// =====================================================
// SALES FUNCTIONS
// =====================================================

/**
 * Create a new sale with Part Payment support
 * @param saleData Object containing:
 *   - items: Array of {Item_ID, Qty, Unit_Price}
 *   - Customer_ID: Customer identifier
 *   - Customer_Name: Customer name
 *   - Location: Delivery location
 *   - KRA_PIN: Customer KRA PIN
 *   - Delivery_Charge: Delivery cost
 *   - Discount: Discount amount
 *   - Payment_Mode: Payment method (Cash/M-Pesa/Bank/Credit/Split)
 *   - Paid_Amount: Amount paid (for partial payments)
 *   - Split_Payments: For split payments [{method, amount}]
 *   - Delivery_Status: Status (Completed/Pending Pickup)
 *   - User: Username of seller
 */
function createSale(saleData) {
  try {
    validateRequired(saleData, ['items', 'Customer_ID', 'Payment_Mode', 'User']);
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    const sheet = getSheet('Sales');
    const transactionId = generateId('Sales', 'Transaction_ID', 'SALE');
    
    // --- UPDATED DATE HANDLING ---
    let dateTime = new Date();
    if (saleData.DateTime) {
      // Use the manual date selected by user
      dateTime = new Date(saleData.DateTime);
      // Set current time so reports don't get confused by 00:00:00
      const now = new Date();
      dateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }
    // -----------------------------

    // Calculate totals and validate stock
    let subtotal = 0;
    const items = [];

    for (const item of saleData.items) {
      const stockCheck = checkStock(item.Item_ID, item.Qty);
      if (!stockCheck.sufficient) {
        throw new Error('Insufficient stock for ' + item.Item_ID + '. Available: ' + stockCheck.available);
      }

      const product = getInventoryItemById(item.Item_ID);
      const unitPrice = item.Unit_Price || product.Selling_Price;
      const lineTotal = parseFloat(item.Qty) * parseFloat(unitPrice);

      items.push({
        Item_ID: item.Item_ID,
        Item_Name: product.Item_Name,
        Qty: parseFloat(item.Qty),
        Unit_Price: parseFloat(unitPrice),
        Line_Total: lineTotal
      });
      subtotal += lineTotal;
    }

    const deliveryCharge = parseFloat(saleData.Delivery_Charge) || 0;
    const discount = parseFloat(saleData.Discount) || 0;
    const grandTotal = subtotal + deliveryCharge - discount;

    // --- CALCULATE PAYMENT AMOUNT (WITHOUT RECORDING YET) ---
    let totalPaid = 0;

    // 1. Handle Split Payments
    if (saleData.Payment_Mode === 'Split' && saleData.Split_Payments) {
      for (const payment of saleData.Split_Payments) {
        if (payment.amount > 0) {
          totalPaid += parseFloat(payment.amount);
        }
      }
    }
    // 2. Handle Credit Sales (0 Payment)
    else if (saleData.Payment_Mode === 'Credit') {
      totalPaid = 0;
    }
    // 3. Handle Standard/Part Payments
    else {
      // Use provided Paid_Amount or default to Grand Total
      const amountToPay = (saleData.Paid_Amount !== undefined && saleData.Paid_Amount !== null)
                          ? parseFloat(saleData.Paid_Amount)
                          : grandTotal;

      if (amountToPay > 0) {
        totalPaid = amountToPay;
      }
    }

    // Calculate Balance/Credit
    const creditAmount = grandTotal - totalPaid;

    // Validate Credit for Walk-in Customers BEFORE recording any payments
    if (creditAmount > 0 && (!saleData.Customer_ID || saleData.Customer_ID === 'WALK-IN')) {
      throw new Error("Walk-in customers cannot have outstanding balances. Please register the customer.");
    }

    // --- NOW RECORD PAYMENTS (validation passed) ---
    totalPaid = 0; // Reset to track actual recorded payments

    // 1. Handle Split Payments
    if (saleData.Payment_Mode === 'Split' && saleData.Split_Payments) {
      for (const payment of saleData.Split_Payments) {
        if (payment.amount > 0) {
          recordSalePayment(transactionId, payment.method, payment.amount, saleData.Customer_ID, saleData.User);
          totalPaid += parseFloat(payment.amount);
        }
      }
    }
    // 2. Handle Credit Sales (0 Payment)
    else if (saleData.Payment_Mode === 'Credit') {
      totalPaid = 0;
    }
    // 3. Handle Standard/Part Payments
    else {
      // Use provided Paid_Amount or default to Grand Total
      const amountToPay = (saleData.Paid_Amount !== undefined && saleData.Paid_Amount !== null)
                          ? parseFloat(saleData.Paid_Amount)
                          : grandTotal;

      if (amountToPay > 0) {
        recordSalePayment(transactionId, saleData.Payment_Mode, amountToPay, saleData.Customer_ID, saleData.User);
        totalPaid += amountToPay;
      }
    }

    // Determine Delivery Status (for "Store until pickup")
    const deliveryStatus = saleData.Delivery_Status || 'Completed';

    // Add each line item to Sales sheet
    items.forEach(item => {
      const saleRow = [
        transactionId,
        dateTime,
        'Sale',
        saleData.Customer_ID,
        saleData.Customer_Name || '',
        item.Item_ID,
        item.Item_Name,
        item.Qty,
        item.Unit_Price,
        item.Line_Total,
        subtotal,
        deliveryCharge,
        discount,
        grandTotal,
        saleData.Payment_Mode,
        saleData.User,
        saleData.Location || '',
        saleData.KRA_PIN || '',
        deliveryStatus, // Status column now tracks Delivery/Pickup status
        '',
        ''
      ];
      sheet.appendRow(saleRow);
    });

    // Decrease Stock
    for (const item of items) {
      decreaseStock(item.Item_ID, item.Qty, saleData.User);
    }

    // Update Customer Stats & Debt
    if (saleData.Customer_ID && saleData.Customer_ID !== 'WALK-IN') {
      // Add to total purchases stats
      updateCustomerPurchaseStats(saleData.Customer_ID, grandTotal, saleData.User);

      // If there is an outstanding balance, add to customer debt
      if (creditAmount > 0) {
        updateCustomerBalance(saleData.Customer_ID, creditAmount, saleData.User);
      }
    }

    logAudit(saleData.User, 'Sales', 'Create Sale', 'Sale ' + transactionId + ' created. Paid: ' + totalPaid + ', Credit: ' + creditAmount, '', '', '');

    return {
      success: true,
      transactionId: transactionId,
      grandTotal: grandTotal,
      paidAmount: totalPaid,
      balance: creditAmount,
      message: creditAmount > 0 ? 'Sale recorded with partial payment.' : 'Sale completed successfully'
    };

  } catch (error) {
    logError('createSale', error);
    throw new Error('Error creating sale: ' + error.message);
  }
}

/**
 * Cancel a Sale (Reverses Inventory & Financials)
 */
function cancelSale(transactionId, reason, user) {
  try {
    const sale = getSaleById(transactionId);
    if (!sale) throw new Error('Sale not found');
    if (sale.Type !== 'Sale') throw new Error('Invalid transaction type');
    if (sale.Status === 'Cancelled') throw new Error('Sale is already cancelled');

    // 1. Reverse Inventory (Add stock back)
    sale.items.forEach(item => {
      increaseStock(item.Item_ID, item.Qty, user);
    });

    // 2. Find and Refund Payments
    const financials = sheetToObjects('Financials');
    const payments = financials.filter(f => f.Reference === transactionId && f.Type === 'Sale_Payment'); // Find sale payments (money in)

    let totalPaid = 0;
    payments.forEach(payment => {
      const amount = parseFloat(payment.Amount);
      totalPaid += amount;

      // Record refund transaction
      const sheet = getSheet('Financials');
      const refundId = generateId('Financials', 'Transaction_ID', 'REF');
      sheet.appendRow([
        refundId, new Date(), 'Sale_Cancellation', sale.Customer_ID, 'Sales',
        payment.Account, 'Refund for cancelled sale ' + transactionId,
        amount, amount, 0, 0, // Debit the account (money out)
        payment.Account, sale.Customer_Name, transactionId, transactionId, 'Approved', user, user
      ]);

      // Update account balance
      updateAccountBalance(payment.Account, -amount, user);
    });

    // 3. Reverse Customer Debt (if any)
    const grandTotal = parseFloat(sale.Grand_Total);
    const debtAmount = grandTotal - totalPaid;

    if (debtAmount > 0 && sale.Customer_ID !== 'WALK-IN') {
      // Reduce customer debt
      updateCustomerBalance(sale.Customer_ID, -debtAmount, user);
    }

    // 4. Reverse Customer Purchase Stats
    if (sale.Customer_ID !== 'WALK-IN') {
       updateCustomerPurchaseStats(sale.Customer_ID, -grandTotal, user);
    }

    // 5. Update Sale Status to Cancelled
    const sheet = getSheet('Sales');
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].indexOf('Transaction_ID');
    const statusCol = data[0].indexOf('Status');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === transactionId) {
        sheet.getRange(i + 1, statusCol + 1).setValue('Cancelled');
      }
    }

    logAudit(user, 'Sales', 'Cancel Sale', 'Cancelled sale ' + transactionId + '. Reason: ' + reason, '', '', '');

    return { success: true, message: 'Sale cancelled, inventory returned, and payments refunded.' };

  } catch (error) {
    logError('cancelSale', error);
    throw new Error('Error cancelling sale: ' + error.message);
  }
}

/**
 * Update sale status
 */
function updateSaleStatus(transactionId, status, user) {
  try {
    const sheet = getSheet('Sales');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const transIdCol = headers.indexOf('Transaction_ID');
    const statusCol = headers.indexOf('Status');

    // Update all rows with this transaction ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][transIdCol] === transactionId) {
        sheet.getRange(i + 1, statusCol + 1).setValue(status);
      }
    }

    logAudit(
      user || 'SYSTEM',
      'Sales',
      'Update Sale',
      'Sale ' + transactionId + ' status updated to: ' + status,
      '',
      '',
      ''
    );

  } catch (error) {
    logError('updateSaleStatus', error);
    throw error;
  }
}

/**
 * Mark sale as picked up (change status from Pending Pickup to Completed)
 */
function markAsPickedUp(transactionId, user) {
  try {
    updateSaleStatus(transactionId, 'Completed', user);
    return { success: true, message: 'Sale marked as picked up' };
  } catch (error) {
    logError('markAsPickedUp', error);
    throw new Error('Error marking sale as picked up: ' + error.message);
  }
}

/**
 * Create a quotation
 */
function createQuotation(quotationData) {
  try {
    validateRequired(quotationData, ['items', 'Customer_ID', 'User']);
    if (!quotationData.items || quotationData.items.length === 0) throw new Error('Quotation must have at least one item');

    const sheet = getSheet('Sales');
    const transactionId = generateId('Sales', 'Transaction_ID', 'QUOT');
    
    // Handle Date (From form or default)
    let dateTime = new Date();
    if(quotationData.DateTime) {
       dateTime = new Date(quotationData.DateTime);
       const now = new Date();
       dateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    // Handle Valid_Until (Parse string properly)
    let validUntil = new Date();
    if (quotationData.Valid_Until) {
        validUntil = new Date(quotationData.Valid_Until); 
    } else {
        validUntil.setDate(validUntil.getDate() + 14);
    }

    let subtotal = 0;
    const items = [];
    for (const item of quotationData.items) {
      const product = getInventoryItemById(item.Item_ID);
      const unitPrice = item.Unit_Price || product.Selling_Price;
      const lineTotal = parseFloat(item.Qty) * parseFloat(unitPrice);
      items.push({
        Item_ID: item.Item_ID,
        Item_Name: product.Item_Name,
        Qty: parseFloat(item.Qty),
        Unit_Price: parseFloat(unitPrice),
        Line_Total: lineTotal
      });
      subtotal += lineTotal;
    }

    const deliveryCharge = parseFloat(quotationData.Delivery_Charge) || 0;
    const discount = parseFloat(quotationData.Discount) || 0;
    const grandTotal = subtotal + deliveryCharge - discount;

    items.forEach(item => {
      const quotRow = [
        transactionId,
        dateTime,
        'Quotation',
        quotationData.Customer_ID,
        quotationData.Customer_Name || '',
        item.Item_ID,
        item.Item_Name,
        item.Qty,
        item.Unit_Price,
        item.Line_Total,
        subtotal,
        deliveryCharge,
        discount,
        grandTotal,
        '', // Payment Mode
        quotationData.User,
        quotationData.Location || '',
        quotationData.KRA_PIN || '',
        'Pending',
        validUntil,
        ''
      ];
      sheet.appendRow(quotRow);
    });

    logAudit(quotationData.User, 'Sales', 'Create Quotation', 'Created ' + transactionId, '', '', '');
    
    return { success: true, transactionId: transactionId, message: 'Quotation created successfully' };
  } catch (error) {
    logError('createQuotation', error);
    throw new Error('Error creating quotation: ' + error.message);
  }
}

/**
 * Convert quotation to sale
 */
function convertQuotationToSale(quotationId, paymentMode, user) {
  try {
    const quotation = getSaleById(quotationId);

    if (!quotation || quotation.Type !== 'Quotation') {
      throw new Error('Invalid quotation');
    }

    if (quotation.Status !== 'Pending') {
      throw new Error('Quotation already processed');
    }

    // Check if quotation is still valid
    const validUntil = new Date(quotation.Valid_Until);
    if (validUntil < new Date()) {
      throw new Error('Quotation has expired');
    }

    // Create sale from quotation
    const saleData = {
      items: quotation.items,
      Customer_ID: quotation.Customer_ID,
      Customer_Name: quotation.Customer_Name,
      Location: quotation.Location,
      KRA_PIN: quotation.KRA_PIN,
      Delivery_Charge: quotation.Delivery_Charge,
      Discount: quotation.Discount,
      Payment_Mode: paymentMode,
      User: user
    };

    const saleResult = createSale(saleData);

    // Update quotation status
    updateQuotationStatus(quotationId, 'Converted', saleResult.transactionId, user);

    return {
      success: true,
      saleId: saleResult.transactionId,
      quotationId: quotationId,
      message: 'Quotation converted to sale successfully'
    };

  } catch (error) {
    logError('convertQuotationToSale', error);
    throw new Error('Error converting quotation: ' + error.message);
  }
}

/**
 * Update quotation status
 */
function updateQuotationStatus(quotationId, status, convertedSaleId, user) {
  try {
    const sheet = getSheet('Sales');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const transIdCol = headers.indexOf('Transaction_ID');
    const statusCol = headers.indexOf('Status');
    const convertedCol = headers.indexOf('Converted_Sale_ID');

    // Update all rows with this quotation ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][transIdCol] === quotationId) {
        sheet.getRange(i + 1, statusCol + 1).setValue(status);
        if (convertedSaleId) {
          sheet.getRange(i + 1, convertedCol + 1).setValue(convertedSaleId);
        }
      }
    }

    logAudit(
      user || 'SYSTEM',
      'Sales',
      'Update Quotation',
      'Quotation ' + quotationId + ' status updated to: ' + status,
      '',
      '',
      ''
    );

  } catch (error) {
    logError('updateQuotationStatus', error);
    throw error;
  }
}

/**
 * Record sale payment in Financials
 */
function recordSalePayment(transactionId, paymentMethod, amount, customerId, user) {
  try {
    const financialTxnId = generateId('Financials', 'Transaction_ID', 'FIN');
    const sheet = getSheet('Financials');

    const txnRow = [
      financialTxnId,
      new Date(),
      'Sale_Payment',
      customerId || '',
      'Sales',
      paymentMethod, // Account (Cash/M-Pesa/Equity Bank)
      'Payment for sale ' + transactionId,
      parseFloat(amount),
      0, // Debit
      parseFloat(amount), // Credit (money in)
      0, // Balance (calculated separately)
      paymentMethod,
      '', // Payee
      transactionId, // Receipt_No
      transactionId, // Reference
      'Approved',
      user,
      user
    ];

    sheet.appendRow(txnRow);

    // Update account balance
    updateAccountBalance(paymentMethod, parseFloat(amount), user);

  } catch (error) {
    logError('recordSalePayment', error);
    throw error;
  }
}

/**
 * Get sale/quotation by ID
 */
function getSaleById(transactionId) {
  try {
    const sales = sheetToObjects('Sales');

    // Find all rows for this transaction
    const saleRows = sales.filter(s => s.Transaction_ID === transactionId);

    if (saleRows.length === 0) {
      return null;
    }

    // Use first row for header info
    const first = saleRows[0];

    // Collect items
    const items = saleRows.map(row => ({
      Item_ID: row.Item_ID,
      Item_Name: row.Item_Name,
      Qty: row.Qty,
      Unit_Price: row.Unit_Price,
      Line_Total: row.Line_Total
    }));

    return {
      Transaction_ID: first.Transaction_ID,
      DateTime: first.DateTime,
      Type: first.Type,
      Customer_ID: first.Customer_ID,
      Customer_Name: first.Customer_Name,
      Subtotal: first.Subtotal,
      Delivery_Charge: first.Delivery_Charge,
      Discount: first.Discount,
      Grand_Total: first.Grand_Total,
      Payment_Mode: first.Payment_Mode,
      Sold_By: first.Sold_By,
      Location: first.Location,
      KRA_PIN: first.KRA_PIN,
      Status: first.Status,
      Valid_Until: first.Valid_Until,
      Converted_Sale_ID: first.Converted_Sale_ID,
      items: items
    };

  } catch (error) {
    logError('getSaleById', error);
    return null;
  }
}

/**
 * Get all sales (not quotations)
 */
function getSales(filters) {
  try {
    const sales = sheetToObjects('Sales');

    // Filter for Sales only (not quotations)
    let filteredSales = sales.filter(s => s.Type === 'Sale');

    // Apply additional filters if provided
    if (filters) {
      for (let key in filters) {
        filteredSales = filteredSales.filter(s => s[key] === filters[key]);
      }
    }

    // Group by Transaction_ID
    const groupedSales = {};
    filteredSales.forEach(sale => {
      if (!groupedSales[sale.Transaction_ID]) {
        groupedSales[sale.Transaction_ID] = {
          Transaction_ID: sale.Transaction_ID,
          DateTime: sale.DateTime,
          Customer_Name: sale.Customer_Name,
          Grand_Total: sale.Grand_Total,
          Payment_Mode: sale.Payment_Mode,
          Sold_By: sale.Sold_By,
          Status: sale.Status,
          itemCount: 0
        };
      }
      groupedSales[sale.Transaction_ID].itemCount++;
    });

    return Object.values(groupedSales);

  } catch (error) {
    logError('getSales', error);
    return [];
  }
}

/**
 * Get all quotations
 */
function getQuotations(filters) {
  try {
    const sales = sheetToObjects('Sales');

    // Filter for Quotations only
    let quotations = sales.filter(s => s.Type === 'Quotation');

    // Apply additional filters
    if (filters) {
      for (let key in filters) {
        quotations = quotations.filter(q => q[key] === filters[key]);
      }
    }

    // Group by Transaction_ID
    const groupedQuots = {};
    quotations.forEach(quot => {
      if (!groupedQuots[quot.Transaction_ID]) {
        groupedQuots[quot.Transaction_ID] = {
          Transaction_ID: quot.Transaction_ID,
          DateTime: quot.DateTime,
          Customer_Name: quot.Customer_Name,
          Grand_Total: quot.Grand_Total,
          Sold_By: quot.Sold_By,
          Status: quot.Status,
          Valid_Until: quot.Valid_Until,
          Converted_Sale_ID: quot.Converted_Sale_ID,
          itemCount: 0
        };
      }
      groupedQuots[quot.Transaction_ID].itemCount++;
    });

    return Object.values(groupedQuots);

  } catch (error) {
    logError('getQuotations', error);
    return [];
  }
}

/**
 * Process sale return/refund
 */
function processSaleReturn(saleId, items, reason, user) {
  try {
    const sale = getSaleById(saleId);

    if (!sale || sale.Type !== 'Sale') {
      throw new Error('Invalid sale');
    }

    let refundAmount = 0;

    // Process each returned item
    for (const returnItem of items) {
      const saleItem = sale.items.find(i => i.Item_ID === returnItem.Item_ID);

      if (!saleItem) {
        throw new Error('Item not found in sale: ' + returnItem.Item_ID);
      }

      const returnQty = parseFloat(returnItem.Qty);

      if (returnQty > saleItem.Qty) {
        throw new Error('Return quantity exceeds sold quantity for ' + saleItem.Item_Name);
      }

      const itemRefund = returnQty * saleItem.Unit_Price;
      refundAmount += itemRefund;

      // Return stock to inventory
      increaseStock(returnItem.Item_ID, returnQty, user);
    }

    // Record refund in Financials
    const refundTxnId = generateId('Financials', 'Transaction_ID', 'REF');
    const financialSheet = getSheet('Financials');

    const refundRow = [
      refundTxnId,
      new Date(),
      'Sale_Refund',
      sale.Customer_ID || '',
      'Sales',
      sale.Payment_Mode, // Account
      'Refund for sale ' + saleId + ': ' + reason,
      parseFloat(refundAmount),
      parseFloat(refundAmount), // Debit (money out)
      0, // Credit
      0, // Balance
      sale.Payment_Mode,
      sale.Customer_Name,
      saleId, // Receipt_No
      saleId, // Reference
      'Approved',
      user,
      user
    ];

    financialSheet.appendRow(refundRow);

    // Update account balance (decrease)
    updateAccountBalance(sale.Payment_Mode, -parseFloat(refundAmount), user);

    // Log audit
    logAudit(
      user,
      'Sales',
      'Return/Refund',
      'Return processed for sale ' + saleId + ': ' + formatCurrency(refundAmount) + ' - Reason: ' + reason,
      '',
      '',
      JSON.stringify({saleId, refundAmount, items})
    );

    return {
      success: true,
      refundAmount: refundAmount,
      refundTxnId: refundTxnId,
      message: 'Return processed successfully'
    };

  } catch (error) {
    logError('processSaleReturn', error);
    throw new Error('Error processing return: ' + error.message);
  }
}

/**
 * Get sales report for date range
 */
function getSalesReport(startDate, endDate) {
  try {
    const sales = sheetToObjects('Sales');

    // Filter for Sales only in date range
    let filteredSales = sales.filter(s => {
      if (s.Type !== 'Sale') return false;

      const saleDate = new Date(s.DateTime);

      if (startDate && saleDate < new Date(startDate)) return false;
      if (endDate && saleDate > new Date(endDate)) return false;

      return true;
    });

    // Group by Transaction_ID and calculate totals
    const transactions = {};
    let totalSales = 0;
    let totalItems = 0;

    filteredSales.forEach(sale => {
      if (!transactions[sale.Transaction_ID]) {
        transactions[sale.Transaction_ID] = {
          Transaction_ID: sale.Transaction_ID,
          DateTime: sale.DateTime,
          Grand_Total: parseFloat(sale.Grand_Total) || 0,
          Payment_Mode: sale.Payment_Mode
        };
        totalSales += parseFloat(sale.Grand_Total) || 0;
      }
      totalItems += parseFloat(sale.Qty) || 0;
    });

    return {
      transactions: Object.values(transactions),
      totalTransactions: Object.keys(transactions).length,
      totalSales: totalSales,
      totalItems: totalItems,
      averageTransactionValue: Object.keys(transactions).length > 0 ? totalSales / Object.keys(transactions).length : 0
    };

  } catch (error) {
    logError('getSalesReport', error);
    return {
      transactions: [],
      totalTransactions: 0,
      totalSales: 0,
      totalItems: 0,
      averageTransactionValue: 0
    };
  }
}
