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
          recordSalePayment(transactionId, payment.method, payment.amount, saleData.Customer_ID, saleData.User, saleData.Paybill_Number || payment.reference);
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
        recordSalePayment(transactionId, saleData.Payment_Mode, amountToPay, saleData.Customer_ID, saleData.User, saleData.Paybill_Number);
        totalPaid += amountToPay;
      }
    }

    // Determine Delivery Status (for "Store until pickup")
    const deliveryStatus = saleData.Delivery_Status || 'Completed';

    // Decrease Stock first & Capture batch details (V3.0 FIFO)
    let totalCOGS = 0;
    const itemBatchMap = {}; // Map Item_ID to batch details

    for (const item of items) {
      const stockResult = decreaseStock(item.Item_ID, item.Qty, saleData.User);
      if (stockResult) {
        if (stockResult.totalCOGS !== undefined) {
          totalCOGS += stockResult.totalCOGS;
        }
        // Store batch details for this item
        itemBatchMap[item.Item_ID] = stockResult.batchDetails || [];
      }
    }

    // Add each line item to Sales sheet WITH batch information
    items.forEach(item => {
      const batchInfo = itemBatchMap[item.Item_ID] || [];

      // If multiple batches were used, create a row for each batch
      if (batchInfo.length > 0) {
        batchInfo.forEach(batch => {
          const saleRow = [
            transactionId,
            dateTime,
            'Sale',
            saleData.Customer_ID,
            saleData.Customer_Name || '',
            item.Item_ID,
            item.Item_Name,
            batch.batchId, // NEW: Batch_ID column
            batch.qtyDeducted, // Qty from this specific batch
            item.Unit_Price,
            batch.qtyDeducted * item.Unit_Price, // Line total for this batch
            subtotal,
            deliveryCharge,
            discount,
            grandTotal,
            saleData.Payment_Mode,
            saleData.User,
            saleData.Location || '',
            saleData.KRA_PIN || '',
            deliveryStatus,
            '', // Valid_Until (for quotations)
            '' // Converted_Sale_ID (for quotations)
          ];
          sheet.appendRow(saleRow);
        });
      } else {
        // Fallback if no batch info (shouldn't happen normally)
        const saleRow = [
          transactionId,
          dateTime,
          'Sale',
          saleData.Customer_ID,
          saleData.Customer_Name || '',
          item.Item_ID,
          item.Item_Name,
          'UNKNOWN', // Batch_ID
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
          deliveryStatus,
          '',
          ''
        ];
        sheet.appendRow(saleRow);
      }
    });

    // Record COGS Transaction in Financials (V3.0)
    if (totalCOGS > 0) {
      const cogsSheet = getSheet('Financials');
      const cogsTxnId = generateId('Financials', 'Transaction_ID', 'COGS');

      const cogsRow = [
        cogsTxnId,                                    // Transaction_ID
        dateTime,                                     // DateTime
        'COGS',                                       // Type
        saleData.Customer_ID || '',                   // Customer_ID
        'Cost of Goods Sold',                         // Category
        'Inventory Asset',                            // Account
        'Cost of goods for Sale ' + transactionId,    // Description
        totalCOGS,                                    // Amount
        totalCOGS,                                    // Debit (Expense)
        0,                                            // Credit
        0,                                            // Balance
        '',                                           // Payment_Method
        '',                                           // Payee
        transactionId,                                // Receipt_No
        transactionId,                                // Reference
        'Approved',                                   // Status
        saleData.User,                                // Approved_By
        saleData.User                                 // User
      ];

      cogsSheet.appendRow(cogsRow);

      Logger.log('COGS recorded: ' + totalCOGS + ' for sale ' + transactionId);
    }

    // Update Customer Stats & Debt
    if (saleData.Customer_ID && saleData.Customer_ID !== 'WALK-IN') {
      // Add to total purchases stats
      updateCustomerPurchaseStats(saleData.Customer_ID, grandTotal, saleData.User);

      // If there is an outstanding balance, add to customer debt
      if (creditAmount > 0) {
        updateCustomerBalance(saleData.Customer_ID, creditAmount, saleData.User);
      }

      // Add loyalty points manually entered from frontend (default 1 per purchase)
      try {
        const cust = getCustomerById(saleData.Customer_ID);
        const currentPoints = parseFloat(cust.Loyalty_Points) || 0;
        const addPoints = parseFloat(saleData.Loyalty_Points) || 0;
        if (addPoints > 0) {
          updateRowById('Customers', 'Customer_ID', saleData.Customer_ID, {
            Loyalty_Points: currentPoints + addPoints
          });
        }
      } catch (e) {
        logError('createSale_loyaltyUpdate', e);
      }
    }

    logAudit(saleData.User, 'Sales', 'Create Sale', 'Sale ' + transactionId + ' created. Revenue: ' + grandTotal + ', COGS: ' + totalCOGS + ', Gross Profit: ' + (grandTotal - totalCOGS), '', '', '');

    return {
      success: true,
      transactionId: transactionId,
      grandTotal: grandTotal,
      paidAmount: totalPaid,
      balance: creditAmount,
      totalCOGS: totalCOGS,
      grossProfit: grandTotal - totalCOGS,
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
 * V3.0: Writes to separate 'Quotations' sheet instead of 'Sales' sheet
 * Headers: Quotation_ID, DateTime, Customer_ID, Customer_Name, Item_ID, Item_Name, Qty, Unit_Price, Line_Total, Subtotal, Delivery_Charge, Discount, Grand_Total, Created_By, Location, KRA_PIN, Status, Valid_Until, Converted_Sale_ID
 */
function createQuotation(quotationData) {
  try {
    validateRequired(quotationData, ['items', 'Customer_ID', 'User']);
    if (!quotationData.items || quotationData.items.length === 0) {
      throw new Error('Quotation must have at least one item');
    }

    const sheet = getSheet('Quotations');
    const quotationId = generateId('Quotations', 'Quotation_ID', 'QUOT');

    // Handle Date (From form or default)
    let dateTime = new Date();
    if (quotationData.DateTime) {
       dateTime = new Date(quotationData.DateTime);
       const now = new Date();
       dateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    // Handle Valid_Until (Parse string properly)
    let validUntil = new Date();
    if (quotationData.Valid_Until) {
        validUntil = new Date(quotationData.Valid_Until);
    } else {
        validUntil.setDate(validUntil.getDate() + 14); // Default: 14 days validity
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

    // Append each line item to Quotations sheet
    items.forEach(item => {
      const quotRow = [
        quotationId,                        // 1. Quotation_ID
        dateTime,                           // 2. DateTime
        quotationData.Customer_ID,          // 3. Customer_ID
        quotationData.Customer_Name || '',  // 4. Customer_Name
        item.Item_ID,                       // 5. Item_ID
        item.Item_Name,                     // 6. Item_Name
        item.Qty,                           // 7. Qty
        item.Unit_Price,                    // 8. Unit_Price
        item.Line_Total,                    // 9. Line_Total
        subtotal,                           // 10. Subtotal
        deliveryCharge,                     // 11. Delivery_Charge
        discount,                           // 12. Discount
        grandTotal,                         // 13. Grand_Total
        quotationData.User,                 // 14. Created_By
        quotationData.Location || '',       // 15. Location
        quotationData.KRA_PIN || '',        // 16. KRA_PIN
        'Pending',                          // 17. Status
        validUntil,                         // 18. Valid_Until
        ''                                  // 19. Converted_Sale_ID
      ];
      sheet.appendRow(quotRow);
    });

    logAudit(quotationData.User, 'Quotations', 'Create', 'Created quotation: ' + quotationId, '', '', '');

    return { success: true, quotationId: quotationId, message: 'Quotation created successfully' };
  } catch (error) {
    logError('createQuotation', error);
    throw new Error('Error creating quotation: ' + error.message);
  }
}

/**
 * Get quotation by ID from Quotations sheet
 * V3.0: Reads from 'Quotations' sheet instead of 'Sales' sheet
 */
function getQuotationById(quotationId) {
  try {
    const quotations = sheetToObjects('Quotations');

    // Find all rows for this quotation
    const quotRows = quotations.filter(q => q.Quotation_ID === quotationId);

    if (quotRows.length === 0) {
      return null;
    }

    // Use first row for header info
    const first = quotRows[0];

    // Collect items
    const items = quotRows.map(row => ({
      Item_ID: row.Item_ID,
      Item_Name: row.Item_Name,
      Qty: row.Qty,
      Unit_Price: row.Unit_Price,
      Line_Total: row.Line_Total
    }));

    return {
      Quotation_ID: first.Quotation_ID,
      DateTime: first.DateTime,
      Customer_ID: first.Customer_ID,
      Customer_Name: first.Customer_Name,
      Subtotal: first.Subtotal,
      Delivery_Charge: first.Delivery_Charge,
      Discount: first.Discount,
      Grand_Total: first.Grand_Total,
      Created_By: first.Created_By,
      Location: first.Location,
      KRA_PIN: first.KRA_PIN,
      Status: first.Status,
      Valid_Until: first.Valid_Until,
      Converted_Sale_ID: first.Converted_Sale_ID,
      items: items
    };

  } catch (error) {
    logError('getQuotationById', error);
    return null;
  }
}

/**
 * Convert quotation to sale
 * V3.0: Fetches from 'Quotations' sheet and updates it after conversion
 */
function convertQuotationToSale(quotationId, paymentMode, user) {
  try {
    const quotation = getQuotationById(quotationId);

    if (!quotation) {
      throw new Error('Quotation not found: ' + quotationId);
    }

    if (quotation.Status !== 'Pending') {
      throw new Error('Quotation already processed (Status: ' + quotation.Status + ')');
    }

    // Check if quotation is still valid
    const validUntil = new Date(quotation.Valid_Until);
    if (validUntil < new Date()) {
      throw new Error('Quotation has expired on ' + validUntil.toDateString());
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

    // Update quotation status in Quotations sheet
    updateQuotationStatus(quotationId, 'Converted', saleResult.transactionId, user);

    logAudit(user, 'Quotations', 'Convert', 'Converted quotation ' + quotationId + ' to sale ' + saleResult.transactionId, '', '', '');

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
 * Update quotation status in Quotations sheet
 * V3.0: Updates 'Quotations' sheet instead of 'Sales' sheet
 */
function updateQuotationStatus(quotationId, status, convertedSaleId, user) {
  try {
    const sheet = getSheet('Quotations');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const quotIdCol = headers.indexOf('Quotation_ID');
    const statusCol = headers.indexOf('Status');
    const convertedCol = headers.indexOf('Converted_Sale_ID');

    if (quotIdCol === -1 || statusCol === -1) {
      throw new Error('Quotations sheet is missing required columns');
    }

    // Update all rows with this quotation ID
    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][quotIdCol] === quotationId) {
        sheet.getRange(i + 1, statusCol + 1).setValue(status);
        if (convertedSaleId && convertedCol !== -1) {
          sheet.getRange(i + 1, convertedCol + 1).setValue(convertedSaleId);
        }
        updated = true;
      }
    }

    if (!updated) {
      throw new Error('Quotation not found: ' + quotationId);
    }

    logAudit(
      user || 'SYSTEM',
      'Quotations',
      'Update Status',
      'Quotation ' + quotationId + ' status updated to: ' + status + (convertedSaleId ? ' (Sale: ' + convertedSaleId + ')' : ''),
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
 * V3.0: Validates payment method against Chart of Accounts
 */
function recordSalePayment(transactionId, paymentMethod, amount, customerId, user, reference) {
  try {
    // V3.0: Validate payment method exists in Chart of Accounts
    validateAccount(paymentMethod);

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
      reference || transactionId, // Reference (e.g., Paybill/Ref)
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
    const tid = (transactionId || '').toString().trim();

    // Find all rows for this transaction (trimmed match)
    let saleRows = sales.filter(s => (s.Transaction_ID || '').toString().trim() === tid);

    // Fallback: loose match ignoring case
    if (saleRows.length === 0) {
      saleRows = sales.filter(s => (s.Transaction_ID || '').toString().trim().toUpperCase() === tid.toUpperCase());
    }

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
      Paybill_Number: first.Paybill_Number || first.Reference || first[''] || '',
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
 * V3.0: Reads from 'Quotations' sheet instead of 'Sales' sheet
 */
function getQuotations(filters) {
  try {
    const quotations = sheetToObjects('Quotations');

    // Apply filters if provided
    let filteredQuots = quotations;
    if (filters) {
      for (let key in filters) {
        filteredQuots = filteredQuots.filter(q => q[key] === filters[key]);
      }
    }

    // Group by Quotation_ID
    const groupedQuots = {};
    filteredQuots.forEach(quot => {
      if (!groupedQuots[quot.Quotation_ID]) {
        groupedQuots[quot.Quotation_ID] = {
          Quotation_ID: quot.Quotation_ID,
          DateTime: quot.DateTime,
          Customer_Name: quot.Customer_Name,
          Grand_Total: quot.Grand_Total,
          Created_By: quot.Created_By,
          Status: quot.Status,
          Valid_Until: quot.Valid_Until,
          Converted_Sale_ID: quot.Converted_Sale_ID,
          itemCount: 0
        };
      }
      groupedQuots[quot.Quotation_ID].itemCount++;
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

      // Return stock to inventory - use ORIGINAL batch if available
      if (saleItem.Batch_ID && saleItem.Batch_ID !== 'UNKNOWN') {
        increaseStockSpecificBatch(returnItem.Item_ID, saleItem.Batch_ID, returnQty, user);
        Logger.log('Returned ' + returnQty + ' units of ' + saleItem.Item_Name + ' to batch ' + saleItem.Batch_ID);
      } else {
        // Fallback: create new batch if original batch info not available
        increaseStock(returnItem.Item_ID, returnQty, user);
        Logger.log('Returned ' + returnQty + ' units of ' + saleItem.Item_Name + ' (new batch created)');
      }
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

    // Update customer balance if customer is not walk-in
    // For credit sales, reduce customer debt (they owe less now)
    if (sale.Customer_ID && sale.Customer_ID !== 'WALK-IN') {
      try {
        updateCustomerBalance(sale.Customer_ID, -parseFloat(refundAmount), user);
        Logger.log('Updated customer balance for return: ' + sale.Customer_ID + ' reduced by ' + refundAmount);
      } catch (custError) {
        Logger.log('Warning: Could not update customer balance for ' + sale.Customer_ID + ': ' + custError.message);
        // Don't fail the whole return if customer balance update fails
      }
    }

    // Log audit
    logAudit(
      user,
      'Sales',
      'Return/Refund',
      'Return processed for sale ' + saleId + ': ' + formatCurrency(refundAmount) + ' - Reason: ' + reason,
      '',
      '',
      JSON.stringify({saleId, refundAmount, items, customerBalanceUpdated: sale.Customer_ID && sale.Customer_ID !== 'WALK-IN'})
    );

    return {
      success: true,
      refundAmount: refundAmount,
      refundTxnId: refundTxnId,
      message: 'Return processed successfully. Stock restored and customer balance updated.'
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
