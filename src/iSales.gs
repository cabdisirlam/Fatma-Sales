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
      const isManual = item.Is_Manual === true || (item.Item_ID && item.Item_ID.toString().startsWith('MANUAL'));

      if (isManual) {
        const manualId = item.Item_ID || ('MANUAL-' + new Date().getTime());
        const qty = parseFloat(item.Qty) || 0;
        const unitPrice = parseFloat(item.Unit_Price || item.Price || 0);
        if (qty <= 0) throw new Error('Invalid quantity for manual item');

        const lineTotal = qty * unitPrice;
        items.push({
          Item_ID: manualId,
          Item_Name: item.Item_Name || item.Name || 'Manual Item',
          Qty: qty,
          Unit_Price: unitPrice,
          Line_Total: lineTotal,
          Is_Manual: true
        });
        subtotal += lineTotal;
        continue;
      }

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
    const deliveryStatus = saleData.Delivery_Status ||
      (creditAmount > 0 ? 'Pending Release' : 'Ready for Pickup');

    // Decrease Stock first & Capture batch details (V3.0 FIFO)
    // âœ… FIXED: Added strict error handling for COGS calculation
    let totalCOGS = 0;
    const itemBatchMap = {}; // Map Item_ID to batch details

    for (const item of items) {
      if (item.Is_Manual) {
        continue; // No stock movement for manual items/services
      }

      const stockResult = decreaseStock(item.Item_ID, item.Qty, saleData.User);

      // Critical validation: Stock deduction must succeed
      if (!stockResult || !stockResult.success) {
        throw new Error('Failed to decrease stock for item: ' + item.Item_ID + '. Sale aborted.');
      }

      // Critical validation: COGS must be calculated
      if (stockResult.totalCOGS === undefined || stockResult.totalCOGS === null) {
        Logger.log('WARNING: COGS not calculated for ' + item.Item_ID + '. Using fallback.');
        // Fallback: Use cost price from product if COGS missing
        const product = getInventoryItemById(item.Item_ID);
        const fallbackCOGS = (parseFloat(product.Cost_Price) || 0) * parseFloat(item.Qty);
        totalCOGS += fallbackCOGS;
        Logger.log('Fallback COGS: ' + fallbackCOGS + ' for ' + item.Item_ID);
      } else {
        totalCOGS += stockResult.totalCOGS;
      }

      // Store batch details for this item
      itemBatchMap[item.Item_ID] = stockResult.batchDetails || [];
    }

    // âœ… IMPROVED: Batch write operations for better performance
    // Collect all sale rows first, then write in a single operation
    const saleRows = [];

    items.forEach(item => {
      const batchInfo = itemBatchMap[item.Item_ID] || [];

      // If multiple batches were used, create a row for each batch
      if (!item.Is_Manual && batchInfo.length > 0) {
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
          saleRows.push(saleRow);
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
          item.Is_Manual ? 'MANUAL' : 'UNKNOWN', // Batch_ID
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
        saleRows.push(saleRow);
      }
    });

    // âœ… BATCH WRITE: Write all rows at once (much faster than individual appendRow calls)
    if (saleRows.length > 0) {
      const lastRow = sheet.getLastRow();
      const startRow = lastRow + 1;
      const numRows = saleRows.length;
      const numCols = saleRows[0].length;

      sheet.getRange(startRow, 1, numRows, numCols).setValues(saleRows);
      Logger.log('Batch wrote ' + numRows + ' sale rows in single operation');
    }

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
      // Add to total purchases stats and automatic loyalty points (+10 per sale)
      updateCustomerPurchaseStats(saleData.Customer_ID, grandTotal, saleData.User);

      // If there is an outstanding balance, add to customer debt
      if (creditAmount > 0) {
        updateCustomerBalance(saleData.Customer_ID, creditAmount, saleData.User);
      }
    }

    logAudit(saleData.User, 'Sales', 'Create Sale', 'Sale ' + transactionId + ' created. Revenue: ' + grandTotal + ', COGS: ' + totalCOGS + ', Gross Profit: ' + (grandTotal - totalCOGS), '', '', '');

    // Sync delivery/payment status for fulfillment queue
    updateSalePaymentProgress(transactionId, saleData.User);

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

      // âœ… FIX: Canonicalize account name for consistency with financial statements
      const canonicalAccount = canonicalizeAccountName(payment.Account);

      // Record refund transaction
      const sheet = getSheet('Financials');
      const refundId = generateId('Financials', 'Transaction_ID', 'REF');
      sheet.appendRow([
        refundId, new Date(), 'Sale_Cancellation', sale.Customer_ID, 'Sales',
        canonicalAccount, 'Refund for cancelled sale ' + transactionId, // âœ… FIX: Use canonical account
        amount, amount, 0, 0, // Debit the account (money out)
        canonicalAccount, sale.Customer_Name, transactionId, transactionId, 'Approved', user, user // âœ… FIX: Payment method canonicalized
      ]);

      // Update account balance
      updateAccountBalance(canonicalAccount, -amount, user); // âœ… FIX: Use canonical account
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
 * Headers: Quotation_ID, DateTime, Customer_ID, Customer_Name, Item_ID, Item_Name, Qty, Batch_ID, Unit_Price, Line_Total, Subtotal, Delivery_Charge, Discount, Grand_Total, Created_By, Location, KRA_PIN, Status, Valid_Until, Converted_Sale_ID
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
        validUntil.setDate(validUntil.getDate() + 30); // Default: 30 days validity
    }

    let subtotal = 0;
    const items = [];
    for (const item of quotationData.items) {
      let product = null;

      // Allow service/manual items without throwing "Product not found"
      try {
        product = item.Item_ID ? getInventoryItemById(item.Item_ID) : null;
      } catch (e) {
        product = null;
      }

      const isManual = item.Is_Manual === true || !product || item.Type === 'Service' || (product && product.Type === 'Service');
      const qty = parseFloat(item.Qty) || 1;
      const unitPrice = parseFloat(item.Unit_Price || item.Price || (product ? product.Selling_Price : 0));
      const lineTotal = qty * unitPrice;

      // Generate a safe ID/name for service/manual items (use MANUAL-* so sales converter treats it as non-stock)
      const manualId = 'MANUAL-' + (item.Item_ID || 'SERVICE-' + new Date().getTime() + '-' + items.length);
      const itemId = isManual
        ? (item.Item_ID && item.Item_ID.toString().startsWith('MANUAL') ? item.Item_ID : manualId)
        : item.Item_ID;
      const itemName = item.Item_Name || item.Name || (product ? product.Item_Name : 'Service Item');

      items.push({
        Item_ID: itemId,
        Item_Name: itemName,
        Qty: qty,
        Unit_Price: unitPrice,
        Line_Total: lineTotal,
        Is_Manual: isManual
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
        'QUOT',                             // 8. Batch_ID (N/A for quotations)
        item.Unit_Price,                    // 9. Unit_Price
        item.Line_Total,                    // 10. Line_Total
        subtotal,                           // 11. Subtotal
        deliveryCharge,                     // 12. Delivery_Charge
        discount,                           // 13. Discount
        grandTotal,                         // 14. Grand_Total
        quotationData.User,                 // 15. Created_By
        quotationData.Location || '',       // 16. Location
        quotationData.KRA_PIN || '',        // 17. KRA_PIN
        'Pending',                          // 18. Status
        validUntil,                         // 19. Valid_Until
        ''                                  // 20. Converted_Sale_ID
      ];
      sheet.appendRow(quotRow);
    });

    logAudit(quotationData.User, 'Quotations', 'Create', 'Created quotation: ' + quotationId, '', '', '');

    return {
      success: true,
      quotationId: quotationId,
      transactionId: quotationId, // Alias for UI callers expecting transactionId
      message: 'Quotation created successfully'
    };
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

    // Helper to read compatible column names (with/without underscores)
    const pick = (row, keys) => {
      for (let k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
      }
      return '';
    };

    const parseNumber = (val) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      return isFinite(num) ? num : 0;
    };

    // Find all rows for this quotation
    const tid = (quotationId || '').toString().trim().toUpperCase();
    const quotRows = quotations.filter(q => {
      const qid = (q.Quotation_ID || q['Quotation ID'] || '').toString().trim().toUpperCase();
      const tidAlt = (q.Transaction_ID || q['Transaction ID'] || '').toString().trim().toUpperCase();
      return qid === tid || tidAlt === tid;
    });

    if (quotRows.length === 0) {
      return null;
    }

    // Use first row for header info
    const first = quotRows[0];

    // Collect items
    const items = quotRows.map(row => ({
      Item_ID: pick(row, ['Item_ID', 'Item ID', 'Item']),
      Item_Name: pick(row, ['Item_Name', 'Item Name', 'Item']),
      Qty: parseNumber(pick(row, ['Qty', 'Quantity'])),
      Unit_Price: parseNumber(pick(row, ['Unit_Price', 'Unit Price', 'Price'])),
      Line_Total: parseNumber(pick(row, ['Line_Total', 'Line Total', 'Amount', 'Total']))
    }));

    const subtotalFallback = items.reduce((s, it) => s + (parseFloat(it.Line_Total) || 0), 0);
    const rawSubtotal = parseNumber(pick(first, ['Subtotal']));
    const subtotal = isFinite(rawSubtotal) && rawSubtotal !== 0 ? rawSubtotal : subtotalFallback;
    const deliveryCharge = parseNumber(pick(first, ['Delivery_Charge', 'Delivery Charge']));
    const discount = parseNumber(pick(first, ['Discount']));
    const rawGrandTotal = parseNumber(pick(first, ['Grand_Total', 'Total_Amount', 'Total Amount']));
    const grandTotal = isFinite(rawGrandTotal) && rawGrandTotal !== 0
      ? rawGrandTotal
      : (subtotal + deliveryCharge - discount);

    const validUntilRaw = pick(first, ['Valid_Until', 'Valid Until']);
    const dateTimeRaw = pick(first, ['DateTime', 'Date', 'Date_Time']);

    return {
      Quotation_ID: pick(first, ['Quotation_ID', 'Quotation ID', 'Transaction_ID', 'Transaction ID']),
      DateTime: dateTimeRaw,
      Customer_ID: pick(first, ['Customer_ID', 'Customer ID']),
      Customer_Name: pick(first, ['Customer_Name', 'Customer Name']),
      Subtotal: subtotal,
      Delivery_Charge: deliveryCharge,
      Discount: discount,
      Grand_Total: grandTotal,
      Created_By: pick(first, ['Created_By', 'Created By', 'Sold_By', 'Sold By', 'User', 'Prepared_By', 'Prepared By']),
      Location: pick(first, ['Customer_Location', 'Customer Location', 'Location', 'Address']),
      KRA_PIN: pick(first, ['Customer_KRA_PIN', 'Customer KRA PIN', 'KRA_PIN', 'KRA PIN', 'KRA']),
      Status: pick(first, ['Status']),
      Valid_Until: validUntilRaw,
      Converted_Sale_ID: pick(first, ['Converted_Sale_ID', 'Converted Sale ID']),
      Payment_Mode: pick(first, ['Payment_Mode', 'Payment Mode', 'Payment']),
      Type: 'Quotation',
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
 * Delete quotation from 'Quotations' sheet (only if not converted)
 */
function deleteQuotationV3(quotationId, user) {
  try {
    if (!quotationId) throw new Error('Quotation ID is required');

    const quotation = getQuotationById(quotationId);
    if (!quotation) throw new Error('Quotation not found: ' + quotationId);
    if (quotation.Status === 'Converted') throw new Error('Cannot delete a converted quotation');

    const sheet = getSheet('Quotations');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('Quotation_ID');
    if (idCol === -1) throw new Error('Quotations sheet missing Quotation_ID column');

    let deleted = false;
    for (let i = data.length - 1; i >= 1; i--) {
      const rowId = (data[i][idCol] || '').toString().trim();
      if (rowId === quotationId.toString().trim()) {
        sheet.deleteRow(i + 1);
        deleted = true;
      }
    }

    if (!deleted) throw new Error('Quotation not found: ' + quotationId);

    logAudit(user || 'SYSTEM', 'Quotations', 'Delete', 'Deleted quotation: ' + quotationId, '', JSON.stringify(quotation), '');

    return { success: true, message: 'Quotation deleted successfully' };
  } catch (error) {
    logError('deleteQuotationV3', error);
    throw new Error('Error deleting quotation: ' + error.message);
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
 * Update/Edit an existing quotation
 * V3.0: Allows editing quotations that haven't been converted yet
 */
function updateQuotation(quotationId, quotationData) {
  try {
    // Validate quotation exists and can be edited
    const existingQuot = getQuotationById(quotationId);
    if (!existingQuot) {
      throw new Error('Quotation not found: ' + quotationId);
    }

    if (existingQuot.Status === 'Converted') {
      throw new Error('Cannot edit converted quotations');
    }

    validateRequired(quotationData, ['items', 'Customer_ID', 'User']);
    if (!quotationData.items || quotationData.items.length === 0) {
      throw new Error('Quotation must have at least one item');
    }

    const sheet = getSheet('Quotations');

    // Delete existing quotation rows
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const quotIdCol = headers.indexOf('Quotation_ID');

    if (quotIdCol === -1) {
      throw new Error('Quotation_ID column not found');
    }

    // Delete all rows for this quotation (in reverse to avoid index shifting)
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][quotIdCol] === quotationId) {
        sheet.deleteRow(i + 1);
      }
    }

    // Handle Date
    let dateTime = new Date();
    if (quotationData.DateTime) {
       dateTime = new Date(quotationData.DateTime);
       const now = new Date();
       dateTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    // Handle Valid_Until
    let validUntil = new Date();
    if (quotationData.Valid_Until) {
        validUntil = new Date(quotationData.Valid_Until);
    } else {
        validUntil.setDate(validUntil.getDate() + 30);
    }

    let subtotal = 0;
    const items = [];
    for (const item of quotationData.items) {
      let product = null;

      // Allow service/manual items without throwing "Product not found"
      try {
        product = item.Item_ID ? getInventoryItemById(item.Item_ID) : null;
      } catch (e) {
        product = null;
      }

      const isManual = item.Is_Manual === true || !product || item.Type === 'Service' || (product && product.Type === 'Service');
      const qty = parseFloat(item.Qty) || 1;
      const unitPrice = parseFloat(item.Unit_Price || item.Price || (product ? product.Selling_Price : 0));
      const lineTotal = qty * unitPrice;

      const manualId = 'MANUAL-' + (item.Item_ID || 'SERVICE-' + new Date().getTime() + '-' + items.length);
      const itemId = isManual
        ? (item.Item_ID && item.Item_ID.toString().startsWith('MANUAL') ? item.Item_ID : manualId)
        : item.Item_ID;
      const itemName = item.Item_Name || item.Name || (product ? product.Item_Name : 'Service Item');

      items.push({
        Item_ID: itemId,
        Item_Name: itemName,
        Qty: qty,
        Unit_Price: unitPrice,
        Line_Total: lineTotal,
        Is_Manual: isManual
      });
      subtotal += lineTotal;
    }

    const deliveryCharge = parseFloat(quotationData.Delivery_Charge) || 0;
    const discount = parseFloat(quotationData.Discount) || 0;
    const grandTotal = subtotal + deliveryCharge - discount;

    // Preserve existing status or use provided one
    const status = quotationData.Status || existingQuot.Status || 'Pending';

    // Append updated line items to Quotations sheet
    items.forEach(item => {
      const quotRow = [
        quotationId,                        // 1. Quotation_ID (keep same ID)
        dateTime,                           // 2. DateTime
        quotationData.Customer_ID,          // 3. Customer_ID
        quotationData.Customer_Name || '',  // 4. Customer_Name
        item.Item_ID,                       // 5. Item_ID
        item.Item_Name,                     // 6. Item_Name
        item.Qty,                           // 7. Qty
        'QUOT',                             // 8. Batch_ID (N/A for quotations)
        item.Unit_Price,                    // 9. Unit_Price
        item.Line_Total,                    // 10. Line_Total
        subtotal,                           // 11. Subtotal
        deliveryCharge,                     // 12. Delivery_Charge
        discount,                           // 13. Discount
        grandTotal,                         // 14. Grand_Total
        quotationData.User,                 // 15. Created_By
        quotationData.Location || '',       // 16. Location
        quotationData.KRA_PIN || '',        // 17. KRA_PIN
        status,                             // 18. Status
        validUntil,                         // 19. Valid_Until
        existingQuot.Converted_Sale_ID || '' // 20. Converted_Sale_ID (preserve if exists)
      ];
      sheet.appendRow(quotRow);
    });

    logAudit(quotationData.User, 'Quotations', 'Update', 'Updated quotation: ' + quotationId, '', '', '');

    return {
      success: true,
      quotationId: quotationId,
      message: 'Quotation updated successfully'
    };

  } catch (error) {
    logError('updateQuotation', error);
    throw new Error('Error updating quotation: ' + error.message);
  }
}

/**
 * Record sale payment in Financials
 * V3.0: Validates payment method against Chart of Accounts
 */
function recordSalePayment(transactionId, paymentMethod, amount, customerId, user, reference) {
  try {
    // バ. FIX: Canonicalize account name for consistency
    const canonicalAccount = canonicalizeAccountName(paymentMethod);

    // V3.0: Validate payment method exists in Chart of Accounts
    validateAccount(canonicalAccount);

    const financialTxnId = generateId('Financials', 'Transaction_ID', 'FIN');
    const sheet = getSheet('Financials');

    const txnRow = [
      financialTxnId,
      new Date(),
      'Sale_Payment',
      customerId || '',
      'Sales',
      canonicalAccount, // バ. FIX: Use canonical account name (Cash/M-Pesa/Equity Bank)
      'Payment for sale ' + transactionId,
      parseFloat(amount),
      0, // Debit
      parseFloat(amount), // Credit (money in)
      0, // Balance (calculated separately)
      canonicalAccount, // バ. FIX: Payment method also canonicalized
      '', // Payee
      transactionId, // Receipt_No
      reference || transactionId, // Reference (e.g., Paybill/Ref)
      'Approved',
      user,
      user
    ];

    sheet.appendRow(txnRow);

    // バ. FIX: Update account balance with canonical name
    updateAccountBalance(canonicalAccount, parseFloat(amount), user);

    // Update customer totals even for non-credit sales/payments
    if (customerId && customerId !== 'WALK-IN') {
      try {
        const customer = getCustomerById(customerId);
        const currentBalance = Math.max(0, parseFloat(customer.Current_Balance) || 0);
        const newBalance = Math.max(0, currentBalance - parseFloat(amount));
        const newTotalPaid = (parseFloat(customer.Total_Paid) || 0) + parseFloat(amount);
        updateRowById('Customers', 'Customer_ID', customerId, {
          Current_Balance: newBalance,
          Total_Paid: newTotalPaid
        });
      } catch (custErr) {
        logError('recordSalePayment.customerUpdate', custErr);
      }
    }

    // Update fulfillment/payment status based on latest payment
    updateSalePaymentProgress(transactionId, user);

  } catch (error) {
    logError('recordSalePayment', error);
    throw error;
  }
}

/**
 * Update delivery/payment status for a sale based on payments recorded in Financials.
 * Delivery_Status will be set to:
 *  - Pending Release (balance due) if payments are incomplete
 *  - Ready for Pickup if fully paid
 */
function updateSalePaymentProgress(transactionId, user) {
  try {
    if (!transactionId) {
      return { success: false, message: 'Transaction ID is required' };
    }

    const salesSheet = getSheet('Sales');
    const salesData = salesSheet.getDataRange().getValues();
    if (!salesData || salesData.length <= 1) {
      return { success: false, message: 'Sales sheet is empty' };
    }

    const headers = salesData[0];
    const idCol = headers.indexOf('Transaction_ID');
    const grandCol = headers.indexOf('Grand_Total');
    const statusCol = headers.indexOf('Delivery_Status');

    if (idCol === -1 || grandCol === -1 || statusCol === -1) {
      return { success: false, message: 'Sales sheet missing Transaction_ID, Grand_Total, or Delivery_Status columns' };
    }

    let grandTotal = 0;
    const matchingRows = [];

    for (let i = 1; i < salesData.length; i++) {
      const row = salesData[i];
      if (row[idCol] === transactionId) {
        matchingRows.push(i);
        if (!grandTotal) {
          grandTotal = parseFloat(row[grandCol]) || 0;
        }
      }
    }

    if (matchingRows.length === 0) {
      return { success: false, message: 'Sale not found: ' + transactionId };
    }

    // Sum payments tied to this sale (by reference/receipt/description)
    const financials = sheetToObjects('Financials');
    const totalPaid = financials
      .filter(txn => {
        const ref = (txn.Reference || '').toString();
        const receipt = (txn.Receipt_No || '').toString();
        const desc = (txn.Description || '').toString();
        const isPaymentType = (txn.Type === 'Sale_Payment' || txn.Type === 'Customer_Payment');
        return isPaymentType && (ref === transactionId || receipt === transactionId || desc.indexOf(transactionId) !== -1);
      })
      .reduce((sum, txn) => sum + (parseFloat(txn.Amount) || parseFloat(txn.Credit) || 0), 0);

    const remaining = Math.max(0, grandTotal - totalPaid);
    const statusLabel = remaining <= 0 ? 'Ready for Pickup' : ('Pending Release (' + formatCurrency(remaining) + ' due)');

    matchingRows.forEach(rowIdx => {
      salesSheet.getRange(rowIdx + 1, statusCol + 1).setValue(statusLabel);
    });

    logAudit(
      user || 'SYSTEM',
      'Sales',
      'Payment Status',
      'Sale ' + transactionId + ' status updated: ' + statusLabel,
      '',
      '',
      JSON.stringify({ totalPaid: totalPaid, remaining: remaining })
    );

    return { success: true, totalPaid: totalPaid, remaining: remaining, status: statusLabel };
  } catch (error) {
    logError('updateSalePaymentProgress', error);
    return { success: false, message: error.message };
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
      // Fallback: try quotations table so print/history works for quotations
      const quotation = getQuotationById(tid);
      if (!quotation) {
        return null;
      }

      return {
        Transaction_ID: quotation.Quotation_ID,
        DateTime: quotation.DateTime,
        Type: 'Quotation',
        Customer_ID: quotation.Customer_ID,
        Customer_Name: quotation.Customer_Name,
        Subtotal: quotation.Subtotal,
        Delivery_Charge: quotation.Delivery_Charge,
        Discount: quotation.Discount,
        Grand_Total: quotation.Grand_Total,
        Payment_Mode: quotation.Payment_Mode || '',
        Sold_By: quotation.Created_By || quotation.Sold_By || quotation.User || '',
        Location: quotation.Location,
        KRA_PIN: quotation.KRA_PIN,
        Paybill_Number: '',
        Status: quotation.Status,
        Valid_Until: quotation.Valid_Until,
        Converted_Sale_ID: quotation.Converted_Sale_ID,
        items: quotation.items || []
      };
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

    const pick = (row, keys) => {
      for (let k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
      }
      return '';
    };

    // Apply filters if provided
    let filteredQuots = quotations;
    if (filters) {
      for (let key in filters) {
        filteredQuots = filteredQuots.filter(q => q[key] === filters[key]);
      }
    }

    // Group by Quotation_ID and map to UI-friendly field names
    const groupedQuots = {};
    filteredQuots.forEach(quot => {
      const qId = pick(quot, ['Quotation_ID', 'Quotation ID', 'Transaction_ID', 'Transaction ID']);
      if (!groupedQuots[qId]) {
        const dateVal = pick(quot, ['DateTime', 'Date', 'Date_Time']);
        const grandTotal = parseFloat(pick(quot, ['Grand_Total', 'Total_Amount', 'Total Amount'])) || 0;
        groupedQuots[qId] = {
          Quotation_ID: qId,
          Transaction_ID: qId, // Alias for dashboard
          Date: dateVal,
          DateTime: dateVal,
          Customer_ID: pick(quot, ['Customer_ID', 'Customer ID']),
          Customer_Name: pick(quot, ['Customer_Name', 'Customer Name']),
          Grand_Total: grandTotal,
          Total_Amount: grandTotal, // Alias for dashboard totals
          Created_By: pick(quot, ['Created_By', 'Sold_By', 'User', 'Prepared_By']),
          Status: pick(quot, ['Status']),
          Valid_Until: pick(quot, ['Valid_Until', 'Valid Until']),
          Converted_Sale_ID: pick(quot, ['Converted_Sale_ID', 'Converted Sale ID']),
          itemCount: 0
        };
      }
      groupedQuots[qId].itemCount++;
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

    // âœ… FIX: Canonicalize account name for consistency with financial statements
    const canonicalAccount = canonicalizeAccountName(sale.Payment_Mode);

    const refundRow = [
      refundTxnId,
      new Date(),
      'Sale_Refund',
      sale.Customer_ID || '',
      'Sales',
      canonicalAccount, // âœ… FIX: Use canonical account name
      'Refund for sale ' + saleId + ': ' + reason,
      parseFloat(refundAmount),
      parseFloat(refundAmount), // Debit (money out)
      0, // Credit
      0, // Balance
      canonicalAccount, // âœ… FIX: Payment mode also canonicalized
      sale.Customer_Name,
      saleId, // Receipt_No
      saleId, // Reference
      'Approved',
      user,
      user
    ];

    financialSheet.appendRow(refundRow);

    // Update account balance (decrease)
    updateAccountBalance(canonicalAccount, -parseFloat(refundAmount), user); // âœ… FIX: Use canonical account

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

