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
 * Add new supplier with Hard-Coded Header Mapping
 */
function addSupplier(supplierData) {
  try {
    // 1. Validation: Ensure we have the minimum required data
    // Matches the "required" fields in the HTML
    validateRequired(supplierData, ['Supplier_Name', 'Phone']);

    const sheet = getSheet('Suppliers');
    const supplierId = generateId('Suppliers', 'Supplier_ID', 'SUP');
    const openingBalance = parseFloat(supplierData.Opening_Balance) || 0;

    // 2. Hard-Coded Data Mapping (must match sheet columns)
    const newSupplier = [
      supplierId,                            // Column 1: Supplier_ID
      supplierData.Supplier_Name || '',      // Column 2: Supplier_Name
      supplierData.Contact_Person || '',     // Column 3: Contact_Person
      supplierData.Phone || '',              // Column 4: Phone
      supplierData.Email || '',              // Column 5: Email
      supplierData.Address || '',            // Column 6: Address
      openingBalance,                        // Column 7: Opening_Balance
      openingBalance,                        // Column 8: Total_Purchased
      0,                                     // Column 9: Total_Paid
      openingBalance,                        // Column 10: Current_Balance
      supplierData.Payment_Terms || 'Cash',  // Column 11: Payment_Terms
      'Active'                               // Column 12: Status
    ];

    sheet.appendRow(newSupplier);

    logAudit(
      supplierData.User || 'SYSTEM',
      'Suppliers',
      'Create',
      'New supplier added: ' + supplierData.Supplier_Name,
      '',
      '',
      JSON.stringify(newSupplier)
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
    if (supplierData.Opening_Balance !== undefined) {
      const newOpening = parseFloat(supplierData.Opening_Balance) || 0;
      const existingOpening = parseFloat(currentSupplier.Opening_Balance) || 0;
      const delta = newOpening - existingOpening;

      updates.Opening_Balance = newOpening;
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
    const totalPaid = (parseFloat(supplier.Total_Paid) || 0) + parseFloat(paymentAmount);
    const currentBalance = (parseFloat(supplier.Current_Balance) || 0) - parseFloat(paymentAmount);

    if (currentBalance < 0) {
      throw new Error('Payment exceeds outstanding balance');
    }

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
      'Balance: ' + (currentBalance + paymentAmount),
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

    const sheet = getSheet('Suppliers');
    const headers = sheet.getDataRange().getValues()[0];
    const hasOpeningColumn = headers.indexOf('Opening_Balance') !== -1;

    const updates = {
      Total_Purchased: totalPurchased,
      Current_Balance: currentBalance
    };

    if (hasOpeningColumn) {
      updates.Opening_Balance = (parseFloat(supplier.Opening_Balance) || 0) + openingAmount;
    }

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
      openingBalance: hasOpeningColumn ? updates.Opening_Balance : openingAmount
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
    const financials = sheetToObjects('Financials');

    // Filter for supplier payments
    const payments = financials.filter(txn => {
      return (txn.Type === 'Supplier_Payment' || txn.Type === 'Purchase_Payment') &&
             txn.Description && txn.Description.indexOf(supplierId) !== -1;
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
 * Get supplier statement (purchases + payments)
 */
function getSupplierStatement(supplierId, startDate, endDate) {
  try {
    const supplier = getSupplierById(supplierId);
    const purchases = getSupplierPurchaseHistory(supplierId);
    const payments = getSupplierPaymentHistory(supplierId);
    const openingBalance = parseFloat(supplier.Opening_Balance) || 0;

    // Combine and sort by date
    const transactions = [];

    if (openingBalance > 0) {
      transactions.push({
        date: supplier.Created_At ? new Date(supplier.Created_At) : new Date(),
        type: 'Opening Balance',
        description: 'Opening balance carried forward',
        debit: openingBalance,
        credit: 0,
        reference: 'OPENING'
      });
    }

    purchases.forEach(purchase => {
      transactions.push({
        date: new Date(purchase.Date),
        type: 'Purchase',
        description: 'Purchase #' + purchase.Purchase_ID,
        debit: purchase.Total_Amount,
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
        credit: payment.Amount,
        reference: payment.Transaction_ID
      });
    });

    // Filter by date range if provided
    let filteredTransactions = transactions;
    if (startDate) {
      const start = new Date(startDate);
      filteredTransactions = filteredTransactions.filter(t => t.date >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      filteredTransactions = filteredTransactions.filter(t => t.date <= end);
    }

    // Sort by date ascending
    filteredTransactions.sort((a, b) => a.date - b.date);

    // Calculate running balance
    let balance = openingBalance;
    filteredTransactions.forEach(txn => {
      balance += (txn.debit - txn.credit);
      txn.balance = balance;
    });

    return {
      supplier: supplier,
      transactions: filteredTransactions,
      openingBalance: openingBalance,
      closingBalance: balance,
      totalDebits: filteredTransactions.reduce((sum, t) => sum + t.debit, 0),
      totalCredits: filteredTransactions.reduce((sum, t) => sum + t.credit, 0)
    };

  } catch (error) {
    logError('getSupplierStatement', error);
    throw new Error('Error generating supplier statement: ' + error.message);
  }
}
