/**
 * CUSTOMER MANAGEMENT MODULE
 * Handles: Customer Management, Credit Control, Payment Processing, Statements
 */

// =====================================================
// CUSTOMER MANAGEMENT
// =====================================================

/**
 * Adds a new customer
 * @param {Object} customerData - Customer information
 * @returns {Object} Result with success status
 */
function addCustomer(customerData) {
  try {
    // Validate required fields
    validateRequired(customerData, ['Customer_Name', 'Phone']);

    // Generate Customer ID
    const customerId = generateId('Customers', 'Customer_ID', 'CUST');

    // Prepare data
    const sheet = getSheet('Customers');
    const rowData = [
      customerId,
      customerData.Customer_Name,
      customerData.Phone,
      customerData.Email || '',
      customerData.Location || '',
      customerData.KRA_PIN || '',
      customerData.Customer_Type || 'Regular',
      parseFloat(customerData.Credit_Limit) || 0,
      0, // Current_Balance
      0, // Total_Purchases
      '', // Last_Purchase_Date
      0, // Loyalty_Points
      'Active',
      new Date(),
      customerData.User || 'SYSTEM'
    ];

    sheet.appendRow(rowData);

    // Log audit trail
    logAudit(
      customerData.User || 'SYSTEM',
      'Customers',
      'Add Customer',
      'Customer added: ' + customerId + ' - ' + customerData.Customer_Name,
      customerData.Session_ID || '',
      '',
      JSON.stringify(rowData)
    );

    return {
      success: true,
      customerId: customerId,
      message: 'Customer added successfully'
    };

  } catch (error) {
    logError('addCustomer', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Updates an existing customer
 * @param {String} customerId - Customer ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Result with success status
 */
function updateCustomer(customerId, updates) {
  try {
    // Verify customer exists
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found: ' + customerId);
    }

    // Don't allow updating certain fields directly
    const protectedFields = ['Customer_ID', 'Current_Balance', 'Total_Purchases', 'Loyalty_Points', 'Created_Date', 'Created_By'];
    protectedFields.forEach(field => {
      if (updates[field] !== undefined) {
        delete updates[field];
      }
    });

    // Update the row
    const result = updateRowById('Customers', 'Customer_ID', customerId, updates);

    // Log audit trail
    logAudit(
      updates.User || 'SYSTEM',
      'Customers',
      'Update Customer',
      'Customer updated: ' + customerId,
      updates.Session_ID || '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Customer updated successfully'
    };

  } catch (error) {
    logError('updateCustomer', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Gets all customers with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of customers
 */
function getCustomers(filters) {
  try {
    return sheetToObjects('Customers', filters);
  } catch (error) {
    logError('getCustomers', error);
    throw new Error('Error loading customers: ' + error.message);
  }
}

/**
 * Gets a single customer by ID
 * @param {String} customerId - Customer ID
 * @returns {Object} Customer data
 */
function getCustomerById(customerId) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  } catch (error) {
    logError('getCustomerById', error);
    throw new Error('Error loading customer: ' + error.message);
  }
}

// =====================================================
// CREDIT CONTROL
// =====================================================

/**
 * Checks if customer can make a credit purchase
 * @param {String} customerId - Customer ID
 * @param {Number} amount - Purchase amount
 * @returns {Object} Result with success status and available credit
 */
function checkCreditLimit(customerId, amount) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.Status !== 'Active') {
      return {
        success: false,
        message: 'Customer account is inactive'
      };
    }

    const creditLimit = parseFloat(customer.Credit_Limit) || 0;
    const currentBalance = parseFloat(customer.Current_Balance) || 0;
    const availableCredit = creditLimit - currentBalance;
    const newBalance = currentBalance + amount;

    if (newBalance > creditLimit) {
      return {
        success: false,
        message: 'Credit limit exceeded',
        creditLimit: creditLimit,
        currentBalance: currentBalance,
        availableCredit: availableCredit,
        requestedAmount: amount
      };
    }

    return {
      success: true,
      message: 'Credit available',
      creditLimit: creditLimit,
      currentBalance: currentBalance,
      availableCredit: availableCredit,
      requestedAmount: amount,
      newBalance: newBalance
    };

  } catch (error) {
    logError('checkCreditLimit', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Gets customers with overdue balances
 * @param {Number} days - Days overdue threshold
 * @returns {Array} Array of customers with overdue balances
 */
function getOverdueCustomers(days) {
  try {
    const customers = getCustomers({ Status: 'Active' });
    const overdueCustomers = [];

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - (days || 30));

    customers.forEach(customer => {
      const balance = parseFloat(customer.Current_Balance) || 0;
      if (balance > 0) {
        const lastPurchase = customer.Last_Purchase_Date ? new Date(customer.Last_Purchase_Date) : null;
        if (lastPurchase && lastPurchase < threshold) {
          overdueCustomers.push({
            ...customer,
            daysOverdue: Math.floor((new Date() - lastPurchase) / (1000 * 60 * 60 * 24))
          });
        }
      }
    });

    return overdueCustomers.sort((a, b) => b.daysOverdue - a.daysOverdue);

  } catch (error) {
    logError('getOverdueCustomers', error);
    return [];
  }
}

// =====================================================
// PAYMENT PROCESSING
// =====================================================

/**
 * Records a payment from customer
 * @param {Object} paymentData - Payment information
 * @returns {Object} Result with success status
 */
function recordCustomerPayment(paymentData) {
  try {
    // Validate required fields
    validateRequired(paymentData, ['Customer_ID', 'Amount', 'Payment_Method', 'User']);

    const amount = parseFloat(paymentData.Amount);
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Get customer
    const customer = findRowById('Customers', 'Customer_ID', paymentData.Customer_ID);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const currentBalance = parseFloat(customer.Current_Balance) || 0;

    // Cannot pay more than balance
    if (amount > currentBalance) {
      throw new Error('Payment amount exceeds outstanding balance. Balance: ' + currentBalance);
    }

    const newBalance = currentBalance - amount;

    // Update customer balance
    updateRowById('Customers', 'Customer_ID', paymentData.Customer_ID, {
      Current_Balance: newBalance
    });

    // Generate transaction ID
    const transId = generateId('Customer_Transactions', 'Transaction_ID', 'CTRANS');

    // Record transaction
    const transSheet = getSheet('Customer_Transactions');
    transSheet.appendRow([
      transId,
      paymentData.Customer_ID,
      new Date(),
      'Payment',
      paymentData.Reference || '',
      -amount, // Negative because it reduces balance
      newBalance,
      paymentData.Description || 'Payment received',
      paymentData.User
    ]);

    // Record in financials
    recordCustomerPaymentToFinancials(transId, amount, paymentData.Payment_Method, paymentData.User, customer.Customer_Name);

    // Log audit trail
    logAudit(
      paymentData.User,
      'Customers',
      'Record Payment',
      'Payment received from ' + customer.Customer_Name + ': ' + amount,
      paymentData.Session_ID || '',
      'Balance: ' + currentBalance,
      'Balance: ' + newBalance
    );

    return {
      success: true,
      transactionId: transId,
      newBalance: newBalance,
      message: 'Payment recorded successfully'
    };

  } catch (error) {
    logError('recordCustomerPayment', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Records customer payment in financials
 */
function recordCustomerPaymentToFinancials(transId, amount, paymentMethod, user, customerName) {
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
    const newBalance = currentBalance + amount;

    // Record transaction (credit)
    const financialsSheet = getSheet('Financials');
    financialsSheet.appendRow([
      new Date(),
      transId,
      'Customer Payment',
      account,
      'Payment from ' + customerName,
      0, // Debit
      amount, // Credit
      newBalance,
      user,
      transId
    ]);

  } catch (error) {
    logError('recordCustomerPaymentToFinancials', error);
    throw error;
  }
}

// =====================================================
// CUSTOMER STATEMENTS
// =====================================================

/**
 * Generates customer account statement
 * @param {String} customerId - Customer ID
 * @param {Object} dateRange - Start and end dates (optional)
 * @returns {Object} Statement data
 */
function getCustomerStatement(customerId, dateRange) {
  try {
    // Get customer
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get transactions
    let transactions = sheetToObjects('Customer_Transactions', { Customer_ID: customerId });

    // Filter by date range if provided
    if (dateRange) {
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      transactions = transactions.filter(trans => {
        const transDate = new Date(trans.Date);
        if (startDate && transDate < startDate) return false;
        if (endDate && transDate > endDate) return false;
        return true;
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // Calculate opening balance
    let openingBalance = 0;
    if (dateRange && dateRange.start) {
      const allTransactions = sheetToObjects('Customer_Transactions', { Customer_ID: customerId });
      allTransactions.forEach(trans => {
        if (new Date(trans.Date) < new Date(dateRange.start)) {
          openingBalance += parseFloat(trans.Amount) || 0;
        }
      });
    }

    return {
      customer: customer,
      openingBalance: openingBalance,
      transactions: transactions,
      closingBalance: parseFloat(customer.Current_Balance) || 0,
      dateRange: dateRange
    };

  } catch (error) {
    logError('getCustomerStatement', error);
    throw new Error('Error generating statement: ' + error.message);
  }
}

/**
 * Gets customer purchase history
 * @param {String} customerId - Customer ID
 * @param {Object} dateRange - Start and end dates (optional)
 * @returns {Array} Array of purchases
 */
function getCustomerPurchaseHistory(customerId, dateRange) {
  try {
    // Get all sales for customer
    let sales = sheetToObjects('Sales_Data', { Customer_ID: customerId });

    // Filter by date range if provided
    if (dateRange) {
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      sales = sales.filter(sale => {
        const saleDate = new Date(sale.DateTime);
        if (startDate && saleDate < startDate) return false;
        if (endDate && saleDate > endDate) return false;
        return true;
      });
    }

    // Sort by date descending
    sales.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    // Get items for each sale
    sales.forEach(sale => {
      sale.Items = sheetToObjects('Sales_Items', { Sale_ID: sale.Sale_ID });
    });

    return sales;

  } catch (error) {
    logError('getCustomerPurchaseHistory', error);
    return [];
  }
}

// =====================================================
// LOYALTY POINTS
// =====================================================

/**
 * Updates customer loyalty points
 * @param {String} customerId - Customer ID
 * @param {Number} saleAmount - Sale amount (to calculate points)
 * @returns {Object} Result with points earned
 */
function updateLoyaltyPoints(customerId, saleAmount) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) return { success: false, message: 'Customer not found' };

    const currentPoints = parseFloat(customer.Loyalty_Points) || 0;

    // 1 point per 100 KES
    const pointsEarned = Math.floor(saleAmount / 100);
    const newPoints = currentPoints + pointsEarned;

    // Update points
    updateRowById('Customers', 'Customer_ID', customerId, {
      Loyalty_Points: newPoints
    });

    return {
      success: true,
      pointsEarned: pointsEarned,
      totalPoints: newPoints
    };

  } catch (error) {
    logError('updateLoyaltyPoints', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Redeems loyalty points
 * @param {String} customerId - Customer ID
 * @param {Number} points - Points to redeem
 * @returns {Object} Result with discount amount
 */
function redeemLoyaltyPoints(customerId, points) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const currentPoints = parseFloat(customer.Loyalty_Points) || 0;

    if (points > currentPoints) {
      throw new Error('Insufficient loyalty points. Available: ' + currentPoints);
    }

    // 100 points = 10 KES discount
    const discountAmount = (points / 100) * 10;
    const newPoints = currentPoints - points;

    // Update points
    updateRowById('Customers', 'Customer_ID', customerId, {
      Loyalty_Points: newPoints
    });

    return {
      success: true,
      pointsRedeemed: points,
      discountAmount: discountAmount,
      remainingPoints: newPoints
    };

  } catch (error) {
    logError('redeemLoyaltyPoints', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// =====================================================
// CUSTOMER REPORTS
// =====================================================

/**
 * Gets top customers by purchase value
 * @param {Number} limit - Number of customers to return
 * @param {Object} dateRange - Date range (optional)
 * @returns {Array} Top customers
 */
function getTopCustomers(limit, dateRange) {
  try {
    const customers = getCustomers({ Status: 'Active' });

    // If no date range, use Total_Purchases
    if (!dateRange) {
      return customers
        .sort((a, b) => (parseFloat(b.Total_Purchases) || 0) - (parseFloat(a.Total_Purchases) || 0))
        .slice(0, limit || 10);
    }

    // Calculate purchases within date range
    const sales = sheetToObjects('Sales_Data', null);
    const customerSales = {};

    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    sales.forEach(sale => {
      const saleDate = new Date(sale.DateTime);
      if (startDate && saleDate < startDate) return;
      if (endDate && saleDate > endDate) return;

      const customerId = sale.Customer_ID;
      if (customerId) {
        customerSales[customerId] = (customerSales[customerId] || 0) + (parseFloat(sale.Grand_Total) || 0);
      }
    });

    // Match with customer data
    const topCustomers = customers.map(customer => {
      return {
        ...customer,
        periodPurchases: customerSales[customer.Customer_ID] || 0
      };
    })
      .filter(c => c.periodPurchases > 0)
      .sort((a, b) => b.periodPurchases - a.periodPurchases)
      .slice(0, limit || 10);

    return topCustomers;

  } catch (error) {
    logError('getTopCustomers', error);
    return [];
  }
}

/**
 * Gets customer aging report (outstanding balances by age)
 * @returns {Object} Aging report
 */
function getCustomerAgingReport() {
  try {
    const customers = getCustomers({ Status: 'Active' });
    const aging = {
      current: [], // 0-30 days
      days30to60: [], // 31-60 days
      days60to90: [], // 61-90 days
      over90: [] // 90+ days
    };

    const today = new Date();

    customers.forEach(customer => {
      const balance = parseFloat(customer.Current_Balance) || 0;
      if (balance <= 0) return;

      const lastPurchase = customer.Last_Purchase_Date ? new Date(customer.Last_Purchase_Date) : null;
      if (!lastPurchase) return;

      const daysDiff = Math.floor((today - lastPurchase) / (1000 * 60 * 60 * 24));

      const customerData = {
        customerId: customer.Customer_ID,
        customerName: customer.Customer_Name,
        phone: customer.Phone,
        balance: balance,
        daysOutstanding: daysDiff,
        lastPurchase: lastPurchase
      };

      if (daysDiff <= 30) {
        aging.current.push(customerData);
      } else if (daysDiff <= 60) {
        aging.days30to60.push(customerData);
      } else if (daysDiff <= 90) {
        aging.days60to90.push(customerData);
      } else {
        aging.over90.push(customerData);
      }
    });

    // Calculate totals
    aging.totalCurrent = aging.current.reduce((sum, c) => sum + c.balance, 0);
    aging.total30to60 = aging.days30to60.reduce((sum, c) => sum + c.balance, 0);
    aging.total60to90 = aging.days60to90.reduce((sum, c) => sum + c.balance, 0);
    aging.totalOver90 = aging.over90.reduce((sum, c) => sum + c.balance, 0);
    aging.grandTotal = aging.totalCurrent + aging.total30to60 + aging.total60to90 + aging.totalOver90;

    return aging;

  } catch (error) {
    logError('getCustomerAgingReport', error);
    return {
      current: [],
      days30to60: [],
      days60to90: [],
      over90: [],
      totalCurrent: 0,
      total30to60: 0,
      total60to90: 0,
      totalOver90: 0,
      grandTotal: 0
    };
  }
}
