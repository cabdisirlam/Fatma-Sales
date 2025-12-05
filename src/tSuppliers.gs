/**
 * Supplier Management Module
 * Handles: Supplier database, purchase tracking, payment tracking, supplier statements
 */

// =====================================================
// SUPPLIER FUNCTIONS
// =====================================================

/**
 * Get all suppliers with optional filters
 */
function getSuppliers(filters) {
  try {
    const sheet = getSheet('Suppliers');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const suppliers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const supplier = {};

      headers.forEach((header, index) => {
        supplier[header] = row[index];
      });

      // Apply filters if provided
      if (filters) {
        let matches = true;
        for (let key in filters) {
          if (supplier[key] !== filters[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      suppliers.push(supplier);
    }

    return suppliers;

  } catch (error) {
    logError('getSuppliers', error);
    throw new Error('Error loading suppliers: ' + error.message);
  }
}

/**
 * Get supplier by ID
 */
function getSupplierById(supplierId) {
  try {
    const supplier = findRowById('Suppliers', 'Supplier_ID', supplierId);
    if (!supplier) {
      throw new Error('Supplier not found: ' + supplierId);
    }
    return supplier;
  } catch (error) {
    logError('getSupplierById', error);
    throw new Error('Error loading supplier: ' + error.message);
  }
}

/**
 * Search suppliers by name or contact
 */
function searchSuppliers(query) {
  try {
    if (!query) {
      return getSuppliers();
    }

    const suppliers = getSuppliers();
    const lowerQuery = query.toLowerCase();

    return suppliers.filter(supplier => {
      return (supplier.Supplier_ID && supplier.Supplier_ID.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (supplier.Supplier_Name && supplier.Supplier_Name.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (supplier.Contact_Person && supplier.Contact_Person.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (supplier.Phone && supplier.Phone.toLowerCase().indexOf(lowerQuery) !== -1);
    });

  } catch (error) {
    logError('searchSuppliers', error);
    return [];
  }
}

/**
 * Add new supplier
 * V3.0: Complete validation and column mapping
 * Headers: Supplier_ID, Supplier_Name, Contact_Person, Phone, Email, Address, Opening_Balance, Total_Purchased, Total_Paid, Current_Balance, Payment_Terms, Status
 */
function addSupplier(supplierData) {
  try {
    // Validation: Required fields
    if (!supplierData || !supplierData.Supplier_Name) {
      throw new Error('Supplier Name is required');
    }

    if (!supplierData.Phone || supplierData.Phone.trim() === '') {
      throw new Error('Phone number is required');
    }

    const sheet = getSheet('Suppliers');
    const supplierId = generateId('Suppliers', 'Supplier_ID', 'SUP');

    const openingBalance = parseFloat(supplierData.Opening_Balance || supplierData.Current_Balance) || 0;
    const createdBy = supplierData.User || 'SYSTEM';

    // HARD-CODED COLUMN MAPPING (matches createSuppliersSheet exactly)
    const newSupplier = [
      supplierId,                                          // 1. Supplier_ID
      supplierData.Supplier_Name.trim(),                   // 2. Supplier_Name
      supplierData.Contact_Person || '',                   // 3. Contact_Person
      supplierData.Phone.trim(),                           // 4. Phone
      supplierData.Email ? supplierData.Email.trim() : '', // 5. Email
      supplierData.Address || '',                          // 6. Address
      openingBalance,                                      // 7. Opening_Balance
      openingBalance,                                      // 8. Total_Purchased (starts with opening balance)
      0,                                                   // 9. Total_Paid
      openingBalance,                                      // 10. Current_Balance (starts with opening balance)
      supplierData.Payment_Terms || 'Cash',                // 11. Payment_Terms
      'Active'                                             // 12. Status
    ];

    sheet.appendRow(newSupplier);

    logAudit(
      createdBy,
      'Suppliers',
      'Create',
      'New supplier: ' + supplierData.Supplier_Name + ' (Phone: ' + supplierData.Phone + ')',
      '',
      '',
      JSON.stringify({supplierId, name: supplierData.Supplier_Name})
    );

    return { success: true, supplierId: supplierId, message: 'Supplier added successfully' };

  } catch (error) {
    logError('addSupplier', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update supplier information
 */
function updateSupplier(supplierId, supplierData) {
  try {
    if (!supplierId) {
      throw new Error('Supplier ID is required');
    }

    // Get current values for audit
    const currentSupplier = getSupplierById(supplierId);

    // Update the supplier
    const updates = {};
    if (supplierData.Supplier_Name !== undefined) updates.Supplier_Name = supplierData.Supplier_Name;
    if (supplierData.Contact_Person !== undefined) updates.Contact_Person = supplierData.Contact_Person;
    if (supplierData.Phone !== undefined) updates.Phone = supplierData.Phone;
    if (supplierData.Email !== undefined) updates.Email = supplierData.Email;
    if (supplierData.Address !== undefined) updates.Address = supplierData.Address;
    const openingBalanceInput = supplierData.Opening_Balance !== undefined ? supplierData.Opening_Balance : supplierData.Current_Balance;
    if (openingBalanceInput !== undefined) {
      const sheet = getSheet('Suppliers');
      const headers = sheet.getDataRange().getValues()[0];
      const hasOpeningColumn = headers.indexOf('Opening_Balance') !== -1;

      const newOpening = parseFloat(openingBalanceInput) || 0;
      const existingOpening = parseFloat(currentSupplier.Opening_Balance !== undefined ? currentSupplier.Opening_Balance : currentSupplier.Current_Balance) || 0;
      const delta = newOpening - existingOpening;

      if (hasOpeningColumn) {
        updates.Opening_Balance = newOpening;
      }
      updates.Total_Purchased = (parseFloat(currentSupplier.Total_Purchased) || 0) + delta;
      updates.Current_Balance = (parseFloat(currentSupplier.Current_Balance) || 0) + delta;
    }
    if (supplierData.Payment_Terms !== undefined) updates.Payment_Terms = supplierData.Payment_Terms;
    if (supplierData.Status !== undefined) updates.Status = supplierData.Status;

    const result = updateRowById('Suppliers', 'Supplier_ID', supplierId, updates);

    logAudit(
      supplierData.User || 'SYSTEM',
      'Suppliers',
      'Update',
      'Supplier updated: ' + supplierId,
      '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Supplier updated successfully'
    };

  } catch (error) {
    logError('updateSupplier', error);
    throw new Error('Error updating supplier: ' + error.message);
  }
}

/**
 * Delete supplier
 */
function deleteSupplier(supplierId, user) {
  try {
    if (!supplierId) {
      throw new Error('Supplier ID is required');
    }

    // Get supplier info before deleting
    const supplier = getSupplierById(supplierId);

    // Check if supplier has outstanding balance
    if (parseFloat(supplier.Current_Balance) > 0) {
      throw new Error('Cannot delete supplier with outstanding balance: ' + formatCurrency(supplier.Current_Balance));
    }

    const sheet = getSheet('Suppliers');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const supplierIdIndex = headers.indexOf('Supplier_ID');

    // Find and delete row
    for (let i = 1; i < data.length; i++) {
      if (data[i][supplierIdIndex] === supplierId) {
        sheet.deleteRow(i + 1);

        logAudit(
          user || 'SYSTEM',
          'Suppliers',
          'Delete',
          'Supplier deleted: ' + supplier.Supplier_Name + ' (ID: ' + supplierId + ')',
          '',
          JSON.stringify(supplier),
          ''
        );

        return {
          success: true,
          message: 'Supplier deleted successfully'
        };
      }
    }

    throw new Error('Supplier not found');

  } catch (error) {
    logError('deleteSupplier', error);
    throw new Error('Error deleting supplier: ' + error.message);
  }
}

/**
 * Update supplier purchase totals (after purchase)
 */
function updateSupplierPurchaseTotals(supplierId, purchaseAmount, user) {
  try {
    const supplier = getSupplierById(supplierId);
    const totalPurchased = (parseFloat(supplier.Total_Purchased) || 0) + parseFloat(purchaseAmount);
    const currentBalance = (parseFloat(supplier.Current_Balance) || 0) + parseFloat(purchaseAmount);

    updateRowById('Suppliers', 'Supplier_ID', supplierId, {
      Total_Purchased: totalPurchased,
      Current_Balance: currentBalance
    });

    return {
      success: true,
      totalPurchased: totalPurchased,
      currentBalance: currentBalance
    };

  } catch (error) {
    logError('updateSupplierPurchaseTotals', error);
    throw error;
  }
}

/**
 * Update supplier payment totals (after payment)
 */
function updateSupplierPayment(supplierId, paymentAmount, user) {
  try {
    const supplier = getSupplierById(supplierId);
    const oldBalance = parseFloat(supplier.Current_Balance) || 0;
    const totalPaid = (parseFloat(supplier.Total_Paid) || 0) + parseFloat(paymentAmount);
    const currentBalance = Math.max(0, oldBalance - parseFloat(paymentAmount));

    updateRowById('Suppliers', 'Supplier_ID', supplierId, {
      Total_Paid: totalPaid,
      Current_Balance: currentBalance
    });

    logAudit(
      user || 'SYSTEM',
      'Suppliers',
      'Payment',
      'Payment made to ' + supplier.Supplier_Name + ': ' + formatCurrency(paymentAmount),
      '',
      'Balance: ' + oldBalance,
      'Balance: ' + currentBalance
    );

    return {
      success: true,
      totalPaid: totalPaid,
      currentBalance: currentBalance
    };

  } catch (error) {
    logError('updateSupplierPayment', error);
    throw error;
  }
}

/**
 * Apply an opening balance to a supplier without recording a purchase transaction
 */
function applySupplierOpeningBalance(supplierId, amount, user) {
  try {
    const openingAmount = parseFloat(amount) || 0;
    if (openingAmount <= 0) {
      return { success: false, message: 'Opening balance must be greater than zero' };
    }

    const supplier = getSupplierById(supplierId);
    const totalPurchased = (parseFloat(supplier.Total_Purchased) || 0) + openingAmount;
    const currentBalance = (parseFloat(supplier.Current_Balance) || 0) + openingAmount;

    const updates = {
      Total_Purchased: totalPurchased,
      Current_Balance: currentBalance
    };

    updateRowById('Suppliers', 'Supplier_ID', supplierId, updates);

    logAudit(
      user || 'SYSTEM',
      'Suppliers',
      'Opening Balance',
      'Opening balance set for ' + supplier.Supplier_Name + ': ' + formatCurrency(openingAmount),
      '',
      '',
      JSON.stringify(updates)
    );

    return {
      success: true,
      currentBalance: currentBalance,
      totalPurchased: totalPurchased,
      openingBalance: openingAmount
    };
  } catch (error) {
    logError('applySupplierOpeningBalance', error);
    throw new Error('Error setting opening balance: ' + error.message);
  }
}

/**
 * Get supplier purchase history
 */
function getSupplierPurchaseHistory(supplierId) {
  try {
    const purchases = sheetToObjects('Purchases');

    // Filter purchases for this supplier
    const supplierPurchases = purchases.filter(purchase => {
      return purchase.Supplier_ID === supplierId;
    });

    // Group by Purchase_ID to get unique purchase orders
    const orders = {};
    supplierPurchases.forEach(purchase => {
      if (!orders[purchase.Purchase_ID]) {
        orders[purchase.Purchase_ID] = {
          Purchase_ID: purchase.Purchase_ID,
          Date: purchase.Date,
          Total_Amount: purchase.Total_Amount,
          Payment_Status: purchase.Payment_Status,
          Paid_Amount: purchase.Paid_Amount,
          Balance: purchase.Balance,
          Recorded_By: purchase.Recorded_By,
          items: []
        };
      }
      orders[purchase.Purchase_ID].items.push({
        Item_Name: purchase.Item_Name,
        Qty: purchase.Qty,
        Cost_Price: purchase.Cost_Price,
        Line_Total: purchase.Line_Total
      });
    });

    // Convert to array and sort by date descending
    const history = Object.values(orders);
    history.sort((a, b) => new Date(b.Date) - new Date(a.Date));

    return history;

  } catch (error) {
    logError('getSupplierPurchaseHistory', error);
    return [];
  }
}

/**
 * Get supplier payment history
 */
function getSupplierPaymentHistory(supplierId) {
  try {
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const financials = sheetToObjects('Financials');

    // Include normal payments and supplier returns/credit notes
    const payments = financials.filter(txn => {
      const type = (txn.Type || '').toString();
      const isSupplierType = (
        type === 'Supplier_Payment' ||
        type === 'Purchase_Payment' ||
        type === 'Supplier_Credit_Note' ||
        type === 'Supplier_Refund'
      );
      if (!isSupplierType) return false;

      const desc = (txn.Description || '').toString();
      const payee = (txn.Payee || '').toString();
      const reference = (txn.Reference || '').toString();
      return desc.indexOf(supplierId) !== -1 || payee.indexOf(supplierId) !== -1 || reference.indexOf(supplierId) !== -1;
    }).map(txn => {
      // Normalize amount so credit notes/refunds reduce balance (treat as payment)
      const debit = toNumber(txn.Debit);
      const credit = toNumber(txn.Credit);
      const amount = debit || credit || toNumber(txn.Amount);
      return {
        ...txn,
        Amount: amount,
        Debit: debit,
        Credit: credit
      };
    });

    // Sort by date descending
    payments.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return payments;

  } catch (error) {
    logError('getSupplierPaymentHistory', error);
    return [];
  }
}

/**
 * Get suppliers with outstanding balances
 */
function getSuppliersWithDebt() {
  try {
    const suppliers = getSuppliers();
    return suppliers.filter(supplier => {
      return parseFloat(supplier.Current_Balance) > 0;
    }).sort((a, b) => {
      return parseFloat(b.Current_Balance) - parseFloat(a.Current_Balance);
    });
  } catch (error) {
    logError('getSuppliersWithDebt', error);
    return [];
  }
}

/**
 * Record a direct payment to supplier (not linked to specific purchase)
 */
function recordSupplierPayment(supplierId, amount, paymentMethod, reference, notes, user) {
  try {
    validateRequired({supplierId, amount, paymentMethod, user}, ['supplierId', 'amount', 'paymentMethod', 'user']);

    const supplier = getSupplierById(supplierId);
    const paymentAmount = parseFloat(amount);

    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const currentBalance = parseFloat(supplier.Current_Balance) || 0;
    if (paymentAmount > currentBalance) {
      // Allow overpayment but warn
      Logger.log('Warning: Payment amount exceeds current balance');
    }

    // Create transaction in Financials sheet
    const txnId = generateId('Financials', 'Transaction_ID', 'SPY');
    const sheet = getSheet('Financials');

    // ✅ FIX: Canonicalize account name for consistency with financial statements
    const canonicalAccount = canonicalizeAccountName(paymentMethod);

    const description = 'Payment to ' + supplier.Supplier_Name +
                       (notes ? ' - ' + notes : '') +
                       (reference ? ' [Ref: ' + reference + ']' : '');

    const txnRow = [
      txnId,
      new Date(),
      'Supplier_Payment',
      '', // Customer_ID (not applicable)
      'Purchases',
      canonicalAccount, // ✅ FIX: Use canonical account name
      description,
      paymentAmount,
      0, // Debit
      paymentAmount, // ✅ FIX: Credit cash (asset decreases when paying supplier)
      0, // Balance (calculated separately)
      canonicalAccount, // ✅ FIX: Payment method canonicalized
      supplierId, // Payee
      reference || '', // Receipt_No
      'Supplier: ' + supplierId, // Reference (for filtering)
      'Approved',
      user,
      user
    ];

    sheet.appendRow(txnRow);

    // Update account balance (decrease)
    updateAccountBalance(canonicalAccount, -paymentAmount, user); // ✅ FIX: Use canonical account

    // Update supplier totals directly to allow overpayment
    const oldBalance = parseFloat(supplier.Current_Balance) || 0;
    const totalPaid = (parseFloat(supplier.Total_Paid) || 0) + paymentAmount;
    const newSupplierBalance = Math.max(0, oldBalance - paymentAmount);

    updateRowById('Suppliers', 'Supplier_ID', supplierId, {
      Total_Paid: totalPaid,
      Current_Balance: newSupplierBalance
    });

    logAudit(
      user,
      'Suppliers',
      'Payment',
      'Payment made to ' + supplier.Supplier_Name + ': ' + formatCurrency(paymentAmount),
      '',
      'Balance: ' + oldBalance,
      'Balance: ' + newSupplierBalance
    );

    return {
      success: true,
      txnId: txnId,
      amount: paymentAmount,
      newBalance: newSupplierBalance,
      message: 'Payment recorded successfully'
    };

  } catch (error) {
    logError('recordSupplierPayment', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get supplier statement (purchases + payments)
 */
function getSupplierStatement(supplierId, startDate, endDate) {
  try {
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const supplier = getSupplierById(supplierId);
    const purchases = getSupplierPurchaseHistory(supplierId);
    const payments = getSupplierPaymentHistory(supplierId);

    // Combine and sort by date (debit = purchases, credit = payments)
    const transactions = [];

    purchases.forEach(purchase => {
      transactions.push({
        date: new Date(purchase.Date),
        type: 'Purchase',
        description: 'Purchase #' + purchase.Purchase_ID,
        debit: toNumber(purchase.Total_Amount),
        credit: 0,
        reference: purchase.Purchase_ID
      });
    });

    payments.forEach(payment => {
      transactions.push({
        date: new Date(payment.DateTime),
        type: 'Payment',
        description: payment.Description || 'Payment',
        debit: 0,
        credit: toNumber(payment.Amount),
        reference: payment.Transaction_ID
      });
    });

    // Sort by date ascending
    transactions.sort((a, b) => a.date - b.date);

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    // Determine base opening balance using recorded opening or deriving from current balance
    const movementAll = transactions.reduce((sum, t) => sum + (toNumber(t.debit) - toNumber(t.credit)), 0);
    const hasOpening = supplier.Opening_Balance !== undefined && supplier.Opening_Balance !== '' && !isNaN(parseFloat(supplier.Opening_Balance));
    const openingFromSupplier = hasOpening ? Math.max(0, toNumber(supplier.Opening_Balance)) : 0;
    const baseOpening = hasOpening ? openingFromSupplier : Math.max(0, (toNumber(supplier.Current_Balance) - movementAll));

    const movementBeforeStart = start
      ? transactions
          .filter(t => t.date < start)
          .reduce((sum, t) => sum + (toNumber(t.debit) - toNumber(t.credit)), 0)
      : 0;

    const openingBalance = Math.max(0, baseOpening + movementBeforeStart);

    // Filter by date range if provided
    const filteredTransactions = transactions.filter(t => {
      if (start && t.date < start) return false;
      if (end && t.date > end) return false;
      return true;
    });

    // Calculate running balance
    let running = openingBalance;
    const transactionsForDisplay = [{
      date: start || (transactions.length ? transactions[0].date : new Date()),
      type: 'Opening Balance',
      description: 'Balance brought forward',
      debit: openingBalance,
      credit: 0,
      reference: 'OPENING',
      runningBalance: openingBalance
    }];

    filteredTransactions.forEach(txn => {
      running += (toNumber(txn.debit) - toNumber(txn.credit));
      if (running < 0) running = 0; // Prevent negative balances
      txn.runningBalance = running;
      transactionsForDisplay.push(txn);
    });

    const totalDebits = filteredTransactions.reduce((sum, t) => sum + toNumber(t.debit), 0);
    const totalCredits = filteredTransactions.reduce((sum, t) => sum + toNumber(t.credit), 0);
    const closingBalance = running;

    return {
      supplier: supplier,
      transactions: transactionsForDisplay,
      openingBalance: openingBalance,
      closingBalance: closingBalance,
      totalDebits: totalDebits,
      totalCredits: totalCredits
    };

  } catch (error) {
    logError('getSupplierStatement', error);
    throw new Error('Error generating supplier statement: ' + error.message);
  }
}

// =====================================================
// DASHBOARD FUNCTIONS
// =====================================================

/**
 * Gets all data required for the Supplier Management dashboard.
 * This is the single entry point for the frontend to reduce server calls.
 */
function getSupplierDashboardData() {
  try {
    const suppliers = sheetToObjects('Suppliers');
    const purchases = sheetToObjects('Purchases');
    
    const overview = getSupplierOverviewStats(suppliers, purchases);
    const supplierList = getSupplierList(suppliers);

    return {
      success: true,
      overview: overview,
      suppliers: supplierList
    };
  } catch (error) {
    logError('getSupplierDashboardData', error);
    return { success: false, message: 'Error loading supplier dashboard: ' + error.message };
  }
}

/**
 * Generates the overview statistics for the summary cards.
 * @param {Array<Object>} suppliers - The array of supplier objects.
 * @param {Array<Object>} purchases - The array of purchase objects.
 * @returns {Object} An object containing overview stats.
 */
function getSupplierOverviewStats(suppliers, purchases) {
    let activeSuppliers = 0;
    let totalPayable = 0;

    suppliers.forEach(supplier => {
        if (supplier.Status === 'Active') {
            activeSuppliers++;
        }
        const balance = parseFloat(supplier.Current_Balance) || 0;
        if (balance > 0) {
            totalPayable += balance;
        }
    });

    const pendingOrders = purchases.filter(p => p.Payment_Status === 'Pending' || p.Payment_Status === 'Partial').length;

    return {
        totalSuppliers: suppliers.length,
        activeSuppliers: activeSuppliers,
        pendingOrders: pendingOrders,
        totalPayable: totalPayable
    };
}

/**
 * Formats the raw supplier data for table display.
 * @param {Array<Object>} suppliers - The array of supplier objects.
 * @returns {Array<Object>} A formatted array of suppliers for the UI.
 */
function getSupplierList(suppliers) {
    return suppliers.map(s => {
        return {
            Supplier_ID: s.Supplier_ID,
            Name: s.Supplier_Name,
            Contact_Person: s.Contact_Person,
            Phone: s.Phone,
            Email: s.Email,
            Balance: s.Current_Balance,
            Payment_Terms: s.Payment_Terms,
            Status: s.Status
        };
    }).sort((a, b) => a.Name.localeCompare(b.Name));
}
