/**
 * Customer Management Module
 * Handles: Customer database, customer information, purchase history, balances
 */

// =====================================================
// CUSTOMER FUNCTIONS
// =====================================================

/**
 * Get all customers with optional filters
 */
function getCustomers(filters) {
  try {
    const sheet = getSheet('Customers');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const customers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const customer = {};

      headers.forEach((header, index) => {
        customer[header] = row[index];
      });

      // Apply filters if provided
      if (filters) {
        let matches = true;
        for (let key in filters) {
          if (customer[key] !== filters[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      customers.push(customer);
    }

    return customers;

  } catch (error) {
    logError('getCustomers', error);
    throw new Error('Error loading customers: ' + error.message);
  }
}

/**
 * Get customer by ID
 */
function getCustomerById(customerId) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found: ' + customerId);
    }
    return customer;
  } catch (error) {
    logError('getCustomerById', error);
    throw new Error('Error loading customer: ' + error.message);
  }
}

/**
 * Search customers by name, phone, or email
 */
function searchCustomers(query) {
  try {
    if (!query) {
      return getCustomers();
    }

    const customers = getCustomers();
    const lowerQuery = query.toLowerCase();

    return customers.filter(customer => {
      return (customer.Customer_ID && customer.Customer_ID.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (customer.Customer_Name && customer.Customer_Name.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (customer.Phone && customer.Phone.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (customer.Email && customer.Email.toLowerCase().indexOf(lowerQuery) !== -1);
    });

  } catch (error) {
    logError('searchCustomers', error);
    return [];
  }
}

/**
 * Add new customer
 */
function addCustomer(customerData) {
  try {
    validateRequired(customerData, ['Customer_Name', 'Phone']);

    const sheet = getSheet('Customers');
    const customerId = generateId('Customers', 'Customer_ID', 'CUST');

    const newCustomer = [
      customerId,
      customerData.Customer_Name || '',
      customerData.Phone || '',
      customerData.Email || '',
      customerData.Location || '',
      customerData.KRA_PIN || '',
      customerData.Customer_Type || 'Walk-in',
      parseFloat(customerData.Credit_Limit) || 0,
      0, // Current_Balance (starts at 0)
      0, // Total_Purchases (starts at 0)
      '', // Last_Purchase_Date (empty initially)
      0, // Loyalty_Points (starts at 0)
      'Active',
      new Date(),
      customerData.Created_By || 'SYSTEM'
    ];

    sheet.appendRow(newCustomer);

    logAudit(
      customerData.Created_By || 'SYSTEM',
      'Customers',
      'Create',
      'New customer added: ' + customerData.Customer_Name + ' (ID: ' + customerId + ')',
      '',
      '',
      JSON.stringify(newCustomer)
    );

    return {
      success: true,
      customerId: customerId,
      message: 'Customer added successfully'
    };

  } catch (error) {
    logError('addCustomer', error);
    throw new Error('Error adding customer: ' + error.message);
  }
}

/**
 * Update customer information
 */
function updateCustomer(customerId, customerData) {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Get current values for audit
    const currentCustomer = getCustomerById(customerId);

    // Update the customer
    const updates = {};
    if (customerData.Customer_Name !== undefined) updates.Customer_Name = customerData.Customer_Name;
    if (customerData.Phone !== undefined) updates.Phone = customerData.Phone;
    if (customerData.Email !== undefined) updates.Email = customerData.Email;
    if (customerData.Location !== undefined) updates.Location = customerData.Location;
    if (customerData.KRA_PIN !== undefined) updates.KRA_PIN = customerData.KRA_PIN;
    if (customerData.Customer_Type !== undefined) updates.Customer_Type = customerData.Customer_Type;
    if (customerData.Credit_Limit !== undefined) updates.Credit_Limit = parseFloat(customerData.Credit_Limit);
    if (customerData.Status !== undefined) updates.Status = customerData.Status;

    const result = updateRowById('Customers', 'Customer_ID', customerId, updates);

    logAudit(
      customerData.User || 'SYSTEM',
      'Customers',
      'Update',
      'Customer updated: ' + customerId,
      '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Customer updated successfully'
    };

  } catch (error) {
    logError('updateCustomer', error);
    throw new Error('Error updating customer: ' + error.message);
  }
}

/**
 * Delete customer
 */
function deleteCustomer(customerId, user) {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Get customer info before deleting
    const customer = getCustomerById(customerId);

    // Check if customer has outstanding balance
    if (parseFloat(customer.Current_Balance) > 0) {
      throw new Error('Cannot delete customer with outstanding balance: ' + formatCurrency(customer.Current_Balance));
    }

    const sheet = getSheet('Customers');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const customerIdIndex = headers.indexOf('Customer_ID');

    // Find and delete row
    for (let i = 1; i < data.length; i++) {
      if (data[i][customerIdIndex] === customerId) {
        sheet.deleteRow(i + 1);

        logAudit(
          user || 'SYSTEM',
          'Customers',
          'Delete',
          'Customer deleted: ' + customer.Customer_Name + ' (ID: ' + customerId + ')',
          '',
          JSON.stringify(customer),
          ''
        );

        return {
          success: true,
          message: 'Customer deleted successfully'
        };
      }
    }

    throw new Error('Customer not found');

  } catch (error) {
    logError('deleteCustomer', error);
    throw new Error('Error deleting customer: ' + error.message);
  }
}

/**
 * Update customer balance (after sale or payment)
 */
function updateCustomerBalance(customerId, amountChange, user) {
  try {
    const customer = getCustomerById(customerId);
    const currentBalance = parseFloat(customer.Current_Balance) || 0;
    const newBalance = currentBalance + parseFloat(amountChange);

    updateRowById('Customers', 'Customer_ID', customerId, {
      Current_Balance: newBalance
    });

    logAudit(
      user || 'SYSTEM',
      'Customers',
      'Balance Update',
      'Customer balance updated: ' + customer.Customer_Name + ' by ' + formatCurrency(amountChange),
      '',
      'Balance: ' + currentBalance,
      'Balance: ' + newBalance
    );

    return {
      success: true,
      oldBalance: currentBalance,
      newBalance: newBalance
    };

  } catch (error) {
    logError('updateCustomerBalance', error);
    throw error;
  }
}

/**
 * Update customer purchase stats (after sale)
 */
function updateCustomerPurchaseStats(customerId, amount, user) {
  try {
    const customer = getCustomerById(customerId);
    const totalPurchases = (parseFloat(customer.Total_Purchases) || 0) + parseFloat(amount);

    // Calculate loyalty points (1 point per 100 KES spent)
    const pointsEarned = Math.floor(parseFloat(amount) / 100);
    const totalPoints = (parseFloat(customer.Loyalty_Points) || 0) + pointsEarned;

    updateRowById('Customers', 'Customer_ID', customerId, {
      Total_Purchases: totalPurchases,
      Last_Purchase_Date: new Date(),
      Loyalty_Points: totalPoints
    });

    return {
      success: true,
      totalPurchases: totalPurchases,
      pointsEarned: pointsEarned,
      totalPoints: totalPoints
    };

  } catch (error) {
    logError('updateCustomerPurchaseStats', error);
    throw error;
  }
}

/**
 * Get customer purchase history
 */
function getCustomerPurchaseHistory(customerId) {
  try {
    const sales = sheetToObjects('Sales');

    // Filter sales for this customer (Type = 'Sale')
    const customerSales = sales.filter(sale => {
      return sale.Customer_ID === customerId && sale.Type === 'Sale';
    });

    // Group by Transaction_ID to get unique transactions
    const transactions = {};
    customerSales.forEach(sale => {
      if (!transactions[sale.Transaction_ID]) {
        transactions[sale.Transaction_ID] = {
          Transaction_ID: sale.Transaction_ID,
          DateTime: sale.DateTime,
          Grand_Total: sale.Grand_Total,
          Payment_Mode: sale.Payment_Mode,
          Sold_By: sale.Sold_By,
          items: []
        };
      }
      transactions[sale.Transaction_ID].items.push({
        Item_Name: sale.Item_Name,
        Qty: sale.Qty,
        Unit_Price: sale.Unit_Price,
        Line_Total: sale.Line_Total
      });
    });

    // Convert to array and sort by date descending
    const history = Object.values(transactions);
    history.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return history;

  } catch (error) {
    logError('getCustomerPurchaseHistory', error);
    return [];
  }
}

/**
 * Get customer payment history
 */
function getCustomerPaymentHistory(customerId) {
  try {
    const financials = sheetToObjects('Financials');

    // Filter for customer payments
    const payments = financials.filter(txn => {
      return txn.Customer_ID === customerId &&
             (txn.Type === 'Customer_Payment' || txn.Type === 'Sale_Payment');
    });

    // Sort by date descending
    payments.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return payments;

  } catch (error) {
    logError('getCustomerPaymentHistory', error);
    return [];
  }
}

/**
 * Get customers with outstanding balances
 */
function getCustomersWithDebt() {
  try {
    const customers = getCustomers();
    return customers.filter(customer => {
      return parseFloat(customer.Current_Balance) > 0;
    }).sort((a, b) => {
      return parseFloat(b.Current_Balance) - parseFloat(a.Current_Balance);
    });
  } catch (error) {
    logError('getCustomersWithDebt', error);
    return [];
  }
}

/**
 * Get customer statement (purchases + payments)
 */
function getCustomerStatement(customerId, startDate, endDate) {
  try {
    const customer = getCustomerById(customerId);
    const purchases = getCustomerPurchaseHistory(customerId);
    const payments = getCustomerPaymentHistory(customerId);

    // Combine and sort by date
    const transactions = [];

    purchases.forEach(purchase => {
      transactions.push({
        date: new Date(purchase.DateTime),
        type: 'Sale',
        description: 'Sale #' + purchase.Transaction_ID,
        debit: purchase.Grand_Total,
        credit: 0,
        reference: purchase.Transaction_ID
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
    let balance = 0;
    filteredTransactions.forEach(txn => {
      balance += (txn.debit - txn.credit);
      txn.balance = balance;
    });

    return {
      customer: customer,
      transactions: filteredTransactions,
      openingBalance: 0,
      closingBalance: balance,
      totalDebits: filteredTransactions.reduce((sum, t) => sum + t.debit, 0),
      totalCredits: filteredTransactions.reduce((sum, t) => sum + t.credit, 0)
    };

  } catch (error) {
    logError('getCustomerStatement', error);
    throw new Error('Error generating customer statement: ' + error.message);
  }
}

/**
 * Get or create walk-in customer
 */
function getOrCreateWalkInCustomer() {
  try {
    const customers = getCustomers();

    // Look for existing walk-in customer
    const walkIn = customers.find(c =>
      c.Customer_Name === 'Walk-in Customer' ||
      c.Customer_Type === 'Walk-in'
    );

    if (walkIn) {
      return walkIn;
    }

    // Create walk-in customer
    const result = addCustomer({
      Customer_Name: 'Walk-in Customer',
      Phone: 'N/A',
      Email: '',
      Location: '',
      KRA_PIN: '',
      Customer_Type: 'Walk-in',
      Credit_Limit: 0,
      Created_By: 'SYSTEM'
    });

    return getCustomerById(result.customerId);

  } catch (error) {
    logError('getOrCreateWalkInCustomer', error);
    throw new Error('Error getting walk-in customer: ' + error.message);
  }
}
