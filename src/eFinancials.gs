/**
 * FINANCIALS MODULE
 * Handles: Financial Transactions, Account Management, Expense Management, Financial Reports
 */

// =====================================================
// ACCOUNT MANAGEMENT
// =====================================================

/**
 * Gets the current balance of an account
 * @param {String} account - Account name (Cash, MPESA, Equity Bank)
 * @returns {Number} Current balance
 */
function getAccountBalance(account) {
  try {
    const sheet = getSheet('Financials');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return 0;

    const headers = data[0];
    const accountCol = headers.indexOf('Account');
    const balanceCol = headers.indexOf('Balance');

    // Find the most recent transaction for this account
    let balance = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][accountCol] === account) {
        balance = parseFloat(data[i][balanceCol]) || 0;
        break;
      }
    }

    return balance;

  } catch (error) {
    logError('getAccountBalance', error);
    return 0;
  }
}

/**
 * Gets balances for all accounts
 * @returns {Object} Balances for all accounts
 */
function getAllAccountBalances() {
  try {
    return {
      Cash: getAccountBalance('Cash'),
      MPESA: getAccountBalance('MPESA'),
      'Equity Bank': getAccountBalance('Equity Bank')
    };
  } catch (error) {
    logError('getAllAccountBalances', error);
    return {
      Cash: 0,
      MPESA: 0,
      'Equity Bank': 0
    };
  }
}

/**
 * Transfers funds between accounts
 * @param {Object} transferData - Transfer information
 * @returns {Object} Result with success status
 */
function transferFunds(transferData) {
  try {
    // Validate required fields
    validateRequired(transferData, ['From_Account', 'To_Account', 'Amount', 'User']);

    const amount = parseFloat(transferData.Amount);
    if (amount <= 0) {
      throw new Error('Transfer amount must be greater than zero');
    }

    const fromAccount = transferData.From_Account;
    const toAccount = transferData.To_Account;

    if (fromAccount === toAccount) {
      throw new Error('Cannot transfer to the same account');
    }

    // Check sufficient balance in source account
    const fromBalance = getAccountBalance(fromAccount);
    if (fromBalance < amount) {
      throw new Error('Insufficient funds in ' + fromAccount + '. Available: ' + fromBalance);
    }

    // Generate transaction ID
    const transId = generateId('Financials', 'Transaction_ID', 'TRANS');

    const financialsSheet = getSheet('Financials');
    const timestamp = new Date();

    // Debit from source account
    const newFromBalance = fromBalance - amount;
    financialsSheet.appendRow([
      timestamp,
      transId,
      'Transfer Out',
      fromAccount,
      'Transfer to ' + toAccount,
      amount, // Debit
      0, // Credit
      newFromBalance,
      transferData.User,
      transId
    ]);

    // Credit to destination account
    const toBalance = getAccountBalance(toAccount);
    const newToBalance = toBalance + amount;
    financialsSheet.appendRow([
      timestamp,
      transId,
      'Transfer In',
      toAccount,
      'Transfer from ' + fromAccount,
      0, // Debit
      amount, // Credit
      newToBalance,
      transferData.User,
      transId
    ]);

    // Log audit trail
    logAudit(
      transferData.User,
      'Financials',
      'Transfer Funds',
      'Transfer: ' + amount + ' from ' + fromAccount + ' to ' + toAccount,
      transferData.Session_ID || '',
      fromAccount + ': ' + fromBalance + ', ' + toAccount + ': ' + toBalance,
      fromAccount + ': ' + newFromBalance + ', ' + toAccount + ': ' + newToBalance
    );

    return {
      success: true,
      transactionId: transId,
      message: 'Transfer completed successfully'
    };

  } catch (error) {
    logError('transferFunds', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Records a general financial transaction
 * @param {Object} transactionData - Transaction information
 * @returns {Object} Result with success status
 */
function recordTransaction(transactionData) {
  try {
    // Validate required fields
    validateRequired(transactionData, ['Type', 'Account', 'Description', 'User']);

    const debit = parseFloat(transactionData.Debit) || 0;
    const credit = parseFloat(transactionData.Credit) || 0;

    if (debit === 0 && credit === 0) {
      throw new Error('Either Debit or Credit must be greater than zero');
    }

    if (debit > 0 && credit > 0) {
      throw new Error('Cannot have both Debit and Credit in the same transaction');
    }

    // Get current balance
    const currentBalance = getAccountBalance(transactionData.Account);

    // Calculate new balance
    const newBalance = currentBalance - debit + credit;

    // Check for negative balance
    if (newBalance < 0 && !transactionData.AllowNegative) {
      throw new Error('Transaction would result in negative balance');
    }

    // Generate transaction ID
    const transId = transactionData.Transaction_ID || generateId('Financials', 'Transaction_ID', 'TRANS');

    // Record transaction
    const financialsSheet = getSheet('Financials');
    financialsSheet.appendRow([
      new Date(),
      transId,
      transactionData.Type,
      transactionData.Account,
      transactionData.Description,
      debit,
      credit,
      newBalance,
      transactionData.User,
      transactionData.Reference || ''
    ]);

    return {
      success: true,
      transactionId: transId,
      newBalance: newBalance,
      message: 'Transaction recorded successfully'
    };

  } catch (error) {
    logError('recordTransaction', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// =====================================================
// EXPENSE MANAGEMENT
// =====================================================

/**
 * Records a new expense
 * @param {Object} expenseData - Expense information
 * @returns {Object} Result with success status
 */
function recordExpense(expenseData) {
  try {
    // Validate required fields
    validateRequired(expenseData, ['Category', 'Description', 'Amount', 'Payment_Method', 'User']);

    const amount = parseFloat(expenseData.Amount);
    if (amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }

    // Determine if approval is needed (amounts > 10,000 need admin approval)
    let status = 'Approved';
    if (amount > 10000 && expenseData.User_Role !== 'Admin') {
      status = 'Pending';
    }

    // Generate Expense ID
    const expenseId = generateId('Expenses', 'Expense_ID', 'EXP');

    // Determine account
    let account = 'Cash';
    if (expenseData.Payment_Method === 'MPESA') {
      account = 'MPESA';
    } else if (expenseData.Payment_Method === 'Bank') {
      account = 'Equity Bank';
    }

    // Prepare data
    const sheet = getSheet('Expenses');
    const rowData = [
      expenseId,
      new Date(),
      expenseData.Category,
      expenseData.Description,
      amount,
      expenseData.Payment_Method,
      account,
      expenseData.Payee || '',
      expenseData.Receipt_No || '',
      status,
      status === 'Approved' ? expenseData.User : '',
      expenseData.User
    ];

    sheet.appendRow(rowData);

    // If approved, record in financials immediately
    if (status === 'Approved') {
      recordExpenseToFinancials(expenseId, amount, account, expenseData.Description, expenseData.User);
    }

    // Log audit trail
    logAudit(
      expenseData.User,
      'Expenses',
      'Record Expense',
      'Expense recorded: ' + expenseId + ' - ' + amount + ' (' + status + ')',
      expenseData.Session_ID || '',
      '',
      JSON.stringify(rowData)
    );

    return {
      success: true,
      expenseId: expenseId,
      status: status,
      message: status === 'Pending' ? 'Expense submitted for approval' : 'Expense recorded successfully'
    };

  } catch (error) {
    logError('recordExpense', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Approves a pending expense
 * @param {String} expenseId - Expense ID
 * @param {String} approver - User approving
 * @returns {Object} Result with success status
 */
function approveExpense(expenseId, approver) {
  try {
    // Get expense
    const expense = findRowById('Expenses', 'Expense_ID', expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    if (expense.Status !== 'Pending') {
      throw new Error('Expense is not pending approval');
    }

    // Update status
    updateRowById('Expenses', 'Expense_ID', expenseId, {
      Status: 'Approved',
      Approved_By: approver
    });

    // Record in financials
    recordExpenseToFinancials(expenseId, expense.Amount, expense.Account, expense.Description, approver);

    // Log audit trail
    logAudit(
      approver,
      'Expenses',
      'Approve Expense',
      'Expense approved: ' + expenseId,
      '',
      'Status: Pending',
      'Status: Approved'
    );

    return {
      success: true,
      message: 'Expense approved successfully'
    };

  } catch (error) {
    logError('approveExpense', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Rejects a pending expense
 * @param {String} expenseId - Expense ID
 * @param {String} rejector - User rejecting
 * @returns {Object} Result with success status
 */
function rejectExpense(expenseId, rejector) {
  try {
    // Get expense
    const expense = findRowById('Expenses', 'Expense_ID', expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    if (expense.Status !== 'Pending') {
      throw new Error('Expense is not pending approval');
    }

    // Update status
    updateRowById('Expenses', 'Expense_ID', expenseId, {
      Status: 'Rejected',
      Approved_By: rejector
    });

    // Log audit trail
    logAudit(
      rejector,
      'Expenses',
      'Reject Expense',
      'Expense rejected: ' + expenseId,
      '',
      'Status: Pending',
      'Status: Rejected'
    );

    return {
      success: true,
      message: 'Expense rejected'
    };

  } catch (error) {
    logError('rejectExpense', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Records expense in financials
 */
function recordExpenseToFinancials(expenseId, amount, account, description, user) {
  try {
    // Get current balance
    const currentBalance = getAccountBalance(account);
    const newBalance = currentBalance - amount;

    // Record transaction (debit)
    const financialsSheet = getSheet('Financials');
    financialsSheet.appendRow([
      new Date(),
      expenseId,
      'Expense',
      account,
      description,
      amount, // Debit
      0, // Credit
      newBalance,
      user,
      expenseId
    ]);

  } catch (error) {
    logError('recordExpenseToFinancials', error);
    throw error;
  }
}

/**
 * Gets all expenses with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of expenses
 */
function getExpenses(filters) {
  try {
    return sheetToObjects('Expenses', filters);
  } catch (error) {
    logError('getExpenses', error);
    return {
      success: false,
      message: 'Error loading expenses: ' + error.message
    };
  }
}

/**
 * Gets expense categories
 * @returns {Array} Array of expense categories
 */
function getExpenseCategories() {
  try {
    return sheetToObjects('Expense_Categories', { Status: 'Active' });
  } catch (error) {
    logError('getExpenseCategories', error);
    return [];
  }
}

// =====================================================
// SUPPLIER PAYMENTS
// =====================================================

/**
 * Processes payment to supplier
 * @param {Object} paymentData - Payment information
 * @returns {Object} Result with success status
 */
function paySupplier(paymentData) {
  try {
    // Validate required fields
    validateRequired(paymentData, ['Supplier_ID', 'Amount', 'Payment_Method', 'User']);

    const amount = parseFloat(paymentData.Amount);
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Get supplier
    const supplier = findRowById('Suppliers', 'Supplier_ID', paymentData.Supplier_ID);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const currentBalance = parseFloat(supplier.Current_Balance) || 0;

    // Cannot pay more than balance
    if (amount > currentBalance) {
      throw new Error('Payment amount exceeds outstanding balance. Balance: ' + currentBalance);
    }

    // Determine account
    let account = 'Cash';
    if (paymentData.Payment_Method === 'MPESA') {
      account = 'MPESA';
    } else if (paymentData.Payment_Method === 'Bank') {
      account = 'Equity Bank';
    }

    // Check sufficient funds
    const accountBalance = getAccountBalance(account);
    if (accountBalance < amount) {
      throw new Error('Insufficient funds in ' + account + '. Available: ' + accountBalance);
    }

    // Generate transaction ID
    const transId = generateId('Financials', 'Transaction_ID', 'SPTRANS');

    // Update supplier balance
    const newBalance = currentBalance - amount;
    const totalPaid = parseFloat(supplier.Total_Paid) + amount;

    updateRowById('Suppliers', 'Supplier_ID', paymentData.Supplier_ID, {
      Current_Balance: newBalance,
      Total_Paid: totalPaid
    });

    // Record in financials (debit)
    const newAccountBalance = accountBalance - amount;
    const financialsSheet = getSheet('Financials');
    financialsSheet.appendRow([
      new Date(),
      transId,
      'Supplier Payment',
      account,
      'Payment to ' + supplier.Supplier_Name,
      amount, // Debit
      0, // Credit
      newAccountBalance,
      paymentData.User,
      transId
    ]);

    // Log audit trail
    logAudit(
      paymentData.User,
      'Suppliers',
      'Payment',
      'Payment to supplier ' + supplier.Supplier_Name + ': ' + amount,
      paymentData.Session_ID || '',
      'Balance: ' + currentBalance,
      'Balance: ' + newBalance
    );

    return {
      success: true,
      transactionId: transId,
      newBalance: newBalance,
      message: 'Payment processed successfully'
    };

  } catch (error) {
    logError('paySupplier', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// =====================================================
// FINANCIAL REPORTS
// =====================================================

/**
 * Generates Profit & Loss statement
 * @param {Object} dateRange - Start and end dates
 * @returns {Object} P&L statement data
 */
function getProfitAndLoss(dateRange) {
  try {
    const startDate = dateRange && dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange && dateRange.end ? new Date(dateRange.end) : null;

    // Calculate revenue from sales
    const sales = sheetToObjects('Sales_Data', null);
    let totalRevenue = 0;
    let costOfGoodsSold = 0;

    sales.forEach(sale => {
      const saleDate = new Date(sale.DateTime);
      if (startDate && saleDate < startDate) return;
      if (endDate && saleDate > endDate) return;

      totalRevenue += parseFloat(sale.Grand_Total) || 0;

      // Calculate COGS
      const items = sheetToObjects('Sales_Items', { Sale_ID: sale.Sale_ID });
      items.forEach(item => {
        const product = findRowById('Inventory', 'Item_ID', item.Item_ID);
        if (product) {
          costOfGoodsSold += (parseFloat(product.Cost_Price) || 0) * (parseFloat(item.Qty) || 0);
        }
      });
    });

    const grossProfit = totalRevenue - costOfGoodsSold;

    // Calculate expenses
    const expenses = sheetToObjects('Expenses', { Status: 'Approved' });
    const expensesByCategory = {};
    let totalExpenses = 0;

    expenses.forEach(expense => {
      const expenseDate = new Date(expense.Date);
      if (startDate && expenseDate < startDate) return;
      if (endDate && expenseDate > endDate) return;

      const amount = parseFloat(expense.Amount) || 0;
      const category = expense.Category;

      expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
      totalExpenses += amount;
    });

    const netProfit = grossProfit - totalExpenses;

    return {
      revenue: totalRevenue,
      costOfGoodsSold: costOfGoodsSold,
      grossProfit: grossProfit,
      grossProfitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      expensesByCategory: expensesByCategory,
      totalExpenses: totalExpenses,
      netProfit: netProfit,
      netProfitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      dateRange: dateRange
    };

  } catch (error) {
    logError('getProfitAndLoss', error);
    throw new Error('Error generating P&L: ' + error.message);
  }
}

/**
 * Generates cash flow statement
 * @param {Object} dateRange - Start and end dates
 * @returns {Object} Cash flow statement data
 */
function getCashFlow(dateRange) {
  try {
    const startDate = dateRange && dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange && dateRange.end ? new Date(dateRange.end) : null;

    const financials = sheetToObjects('Financials', null);

    const cashFlow = {
      operating: {
        salesRevenue: 0,
        customerPayments: 0,
        supplierPayments: 0,
        expenses: 0,
        total: 0
      },
      investing: {
        total: 0
      },
      financing: {
        total: 0
      }
    };

    let openingBalance = 0;

    financials.forEach(trans => {
      const transDate = new Date(trans.DateTime);

      // Calculate opening balance (before start date)
      if (startDate && transDate < startDate) {
        openingBalance += (parseFloat(trans.Credit) || 0) - (parseFloat(trans.Debit) || 0);
        return;
      }

      if (endDate && transDate > endDate) return;

      const debit = parseFloat(trans.Debit) || 0;
      const credit = parseFloat(trans.Credit) || 0;
      const type = trans.Type;

      // Operating activities
      if (type === 'Sale') {
        cashFlow.operating.salesRevenue += credit;
      } else if (type === 'Customer Payment') {
        cashFlow.operating.customerPayments += credit;
      } else if (type === 'Purchase' || type === 'Supplier Payment') {
        cashFlow.operating.supplierPayments += debit;
      } else if (type === 'Expense') {
        cashFlow.operating.expenses += debit;
      }
    });

    cashFlow.operating.total =
      cashFlow.operating.salesRevenue +
      cashFlow.operating.customerPayments -
      cashFlow.operating.supplierPayments -
      cashFlow.operating.expenses;

    const totalCashFlow = cashFlow.operating.total + cashFlow.investing.total + cashFlow.financing.total;
    const closingBalance = openingBalance + totalCashFlow;

    return {
      openingBalance: openingBalance,
      cashFlow: cashFlow,
      totalCashFlow: totalCashFlow,
      closingBalance: closingBalance,
      dateRange: dateRange
    };

  } catch (error) {
    logError('getCashFlow', error);
    throw new Error('Error generating cash flow: ' + error.message);
  }
}

/**
 * Gets financial transactions for a date range
 * @param {Object} dateRange - Start and end dates
 * @param {String} account - Specific account (optional)
 * @returns {Array} Array of transactions
 */
function getFinancialTransactions(dateRange, account) {
  try {
    let transactions = sheetToObjects('Financials', account ? { Account: account } : null);

    // Filter by date range if provided
    if (dateRange) {
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      transactions = transactions.filter(trans => {
        const transDate = new Date(trans.DateTime);
        if (startDate && transDate < startDate) return false;
        if (endDate && transDate > endDate) return false;
        return true;
      });
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return transactions;

  } catch (error) {
    logError('getFinancialTransactions', error);
    return [];
  }
}

/**
 * Gets expense report by category
 * @param {Object} dateRange - Start and end dates
 * @returns {Object} Expense report data
 */
function getExpenseReport(dateRange) {
  try {
    const expenses = sheetToObjects('Expenses', { Status: 'Approved' });
    const categories = sheetToObjects('Expense_Categories', { Status: 'Active' });

    const startDate = dateRange && dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange && dateRange.end ? new Date(dateRange.end) : null;

    const categoryTotals = {};
    let grandTotal = 0;

    // Initialize categories
    categories.forEach(cat => {
      categoryTotals[cat.Category_Name] = {
        budget: parseFloat(cat.Monthly_Budget) || 0,
        actual: 0,
        variance: 0
      };
    });

    // Calculate actuals
    expenses.forEach(expense => {
      const expenseDate = new Date(expense.Date);
      if (startDate && expenseDate < startDate) return;
      if (endDate && expenseDate > endDate) return;

      const amount = parseFloat(expense.Amount) || 0;
      const category = expense.Category;

      if (!categoryTotals[category]) {
        categoryTotals[category] = { budget: 0, actual: 0, variance: 0 };
      }

      categoryTotals[category].actual += amount;
      grandTotal += amount;
    });

    // Calculate variances
    Object.keys(categoryTotals).forEach(category => {
      const data = categoryTotals[category];
      data.variance = data.budget - data.actual;
      data.percentUsed = data.budget > 0 ? (data.actual / data.budget) * 100 : 0;
    });

    return {
      categoryTotals: categoryTotals,
      grandTotal: grandTotal,
      dateRange: dateRange
    };

  } catch (error) {
    logError('getExpenseReport', error);
    throw new Error('Error generating expense report: ' + error.message);
  }
}
