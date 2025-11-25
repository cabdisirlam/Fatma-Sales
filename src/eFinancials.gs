/**
 * Financials Module
 * Handles: Cash, M-Pesa, Bank accounts, Expenses, Transfers, Reconciliation
 */

// =====================================================
// ACCOUNT FUNCTIONS
// =====================================================

/**
 * Get account balance (Cash, M-Pesa, Equity Bank)
 */
function getAccountBalance(accountName) {
  try {
    const financials = sheetToObjects('Financials');

    // Filter transactions for this account
    const accountTxns = financials.filter(txn => txn.Account === accountName);

    // Calculate balance: Credits - Debits
    let balance = 0;
    accountTxns.forEach(txn => {
      balance += (parseFloat(txn.Credit) || 0) - (parseFloat(txn.Debit) || 0);
    });

    return balance;

  } catch (error) {
    logError('getAccountBalance', error);
    return 0;
  }
}

/**
 * Get all account balances
 */
function getAllAccountBalances() {
  try {
    return {
      Cash: getAccountBalance('Cash'),
      'M-Pesa': getAccountBalance('M-Pesa'),
      'Equity Bank': getAccountBalance('Equity Bank')
    };
  } catch (error) {
    logError('getAllAccountBalances', error);
    return { Cash: 0, 'M-Pesa': 0, 'Equity Bank': 0 };
  }
}

/**
 * Update account balance (internal function)
 */
function updateAccountBalance(account, amount, user) {
  // Balance is calculated from transactions, this just logs the activity
  logAudit(
    user || 'SYSTEM',
    'Financials',
    'Balance Update',
    account + ' balance changed by ' + formatCurrency(amount),
    '',
    '',
    ''
  );
}

/**
 * Record expense
 */
function recordExpense(expenseData) {
  try {
    validateRequired(expenseData, ['Category', 'Account', 'Amount', 'Description', 'User']);

    const txnId = generateId('Financials', 'Transaction_ID', 'EXP');
    const sheet = getSheet('Financials');

    const txnRow = [
      txnId,
      new Date(),
      'Expense',
      '', // Customer_ID (not applicable)
      expenseData.Category,
      expenseData.Account, // Account (Cash/M-Pesa/Bank)
      expenseData.Description,
      parseFloat(expenseData.Amount),
      parseFloat(expenseData.Amount), // Debit (money out)
      0, // Credit
      0, // Balance
      expenseData.Account, // Payment_Method
      expenseData.Payee || '',
      expenseData.Receipt_No || '',
      expenseData.Reference || '',
      expenseData.Status || 'Approved',
      expenseData.Approved_By || expenseData.User,
      expenseData.User
    ];

    sheet.appendRow(txnRow);

    // Update account balance (decrease)
    updateAccountBalance(expenseData.Account, -parseFloat(expenseData.Amount), expenseData.User);

    logAudit(
      expenseData.User,
      'Financials',
      'Expense',
      'Expense recorded: ' + expenseData.Category + ' - ' + formatCurrency(expenseData.Amount),
      '',
      '',
      JSON.stringify({txnId, amount: expenseData.Amount, category: expenseData.Category})
    );

    return {
      success: true,
      txnId: txnId,
      message: 'Expense recorded successfully'
    };

  } catch (error) {
    logError('recordExpense', error);
    throw new Error('Error recording expense: ' + error.message);
  }
}

/**
 * Transfer between accounts
 */
function transferBetweenAccounts(transferData) {
  try {
    validateRequired(transferData, ['From_Account', 'To_Account', 'Amount', 'User']);

    if (transferData.From_Account === transferData.To_Account) {
      throw new Error('Cannot transfer to the same account');
    }

    const amount = parseFloat(transferData.Amount);
    const sheet = getSheet('Financials');
    const txnId = generateId('Financials', 'Transaction_ID', 'TRF');
    const date = new Date();

    // Debit from source account
    const debitRow = [
      txnId + '-OUT',
      date,
      'Transfer_Out',
      '',
      'Transfer',
      transferData.From_Account,
      'Transfer to ' + transferData.To_Account + ': ' + (transferData.Description || ''),
      amount,
      amount, // Debit
      0, // Credit
      0,
      'Transfer',
      '',
      txnId,
      txnId,
      'Approved',
      transferData.User,
      transferData.User
    ];

    // Credit to destination account
    const creditRow = [
      txnId + '-IN',
      date,
      'Transfer_In',
      '',
      'Transfer',
      transferData.To_Account,
      'Transfer from ' + transferData.From_Account + ': ' + (transferData.Description || ''),
      amount,
      0, // Debit
      amount, // Credit
      0,
      'Transfer',
      '',
      txnId,
      txnId,
      'Approved',
      transferData.User,
      transferData.User
    ];

    sheet.appendRow(debitRow);
    sheet.appendRow(creditRow);

    updateAccountBalance(transferData.From_Account, -amount, transferData.User);
    updateAccountBalance(transferData.To_Account, amount, transferData.User);

    logAudit(
      transferData.User,
      'Financials',
      'Transfer',
      'Transfer: ' + formatCurrency(amount) + ' from ' + transferData.From_Account + ' to ' + transferData.To_Account,
      '',
      '',
      JSON.stringify({txnId, amount, from: transferData.From_Account, to: transferData.To_Account})
    );

    return {
      success: true,
      txnId: txnId,
      message: 'Transfer completed successfully'
    };

  } catch (error) {
    logError('transferBetweenAccounts', error);
    throw new Error('Error transferring funds: ' + error.message);
  }
}

/**
 * Record customer payment
 */
function recordCustomerPayment(paymentData) {
  try {
    validateRequired(paymentData, ['Customer_ID', 'Amount', 'Account', 'User']);

    const customer = getCustomerById(paymentData.Customer_ID);
    const amount = parseFloat(paymentData.Amount);

    const txnId = generateId('Financials', 'Transaction_ID', 'PAY');
    const sheet = getSheet('Financials');

    const txnRow = [
      txnId,
      new Date(),
      'Customer_Payment',
      paymentData.Customer_ID,
      'Customer Payment',
      paymentData.Account,
      'Payment received from ' + customer.Customer_Name,
      amount,
      0, // Debit
      amount, // Credit (money in)
      0,
      paymentData.Account,
      customer.Customer_Name,
      paymentData.Receipt_No || txnId,
      paymentData.Reference || '',
      'Approved',
      paymentData.User,
      paymentData.User
    ];

    sheet.appendRow(txnRow);

    // Update account balance (increase)
    updateAccountBalance(paymentData.Account, amount, paymentData.User);

    // Update customer balance (decrease debt)
    updateCustomerBalance(paymentData.Customer_ID, -amount, paymentData.User);

    logAudit(
      paymentData.User,
      'Financials',
      'Customer Payment',
      'Payment received: ' + formatCurrency(amount) + ' from ' + customer.Customer_Name,
      '',
      '',
      JSON.stringify({txnId, amount, customer: paymentData.Customer_ID})
    );

    return {
      success: true,
      txnId: txnId,
      message: 'Payment recorded successfully'
    };

  } catch (error) {
    logError('recordCustomerPayment', error);
    throw new Error('Error recording payment: ' + error.message);
  }
}

/**
 * Get expenses by category
 */
function getExpensesByCategory(startDate, endDate) {
  try {
    const financials = sheetToObjects('Financials');

    // Filter for expenses
    let expenses = financials.filter(txn => txn.Type === 'Expense');

    // Filter by date if provided
    if (startDate) {
      expenses = expenses.filter(e => new Date(e.DateTime) >= new Date(startDate));
    }
    if (endDate) {
      expenses = expenses.filter(e => new Date(e.DateTime) <= new Date(endDate));
    }

    // Group by category
    const byCategory = {};
    expenses.forEach(exp => {
      const category = exp.Category || 'Other';
      if (!byCategory[category]) {
        byCategory[category] = { category: category, total: 0, count: 0 };
      }
      byCategory[category].total += parseFloat(exp.Amount) || 0;
      byCategory[category].count++;
    });

    return Object.values(byCategory);

  } catch (error) {
    logError('getExpensesByCategory', error);
    return [];
  }
}

/**
 * Get account transactions
 */
function getAccountTransactions(accountName, startDate, endDate, limit) {
  try {
    const financials = sheetToObjects('Financials');

    // Filter for this account
    let txns = financials.filter(txn => txn.Account === accountName);

    // Filter by date if provided
    if (startDate) {
      txns = txns.filter(t => new Date(t.DateTime) >= new Date(startDate));
    }
    if (endDate) {
      txns = txns.filter(t => new Date(t.DateTime) <= new Date(endDate));
    }

    // Sort by date descending
    txns.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    // Limit if provided
    if (limit) {
      txns = txns.slice(0, limit);
    }

    return txns;

  } catch (error) {
    logError('getAccountTransactions', error);
    return [];
  }
}

/**
 * Get financial summary
 */
function getFinancialSummary(startDate, endDate) {
  try {
    const financials = sheetToObjects('Financials');

    // Filter by date if provided
    let txns = financials;
    if (startDate) {
      txns = txns.filter(t => new Date(t.DateTime) >= new Date(startDate));
    }
    if (endDate) {
      txns = txns.filter(t => new Date(t.DateTime) <= new Date(endDate));
    }

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalSales = 0;
    let totalPurchases = 0;

    txns.forEach(txn => {
      const amount = parseFloat(txn.Amount) || 0;

      if (txn.Type === 'Sale_Payment') {
        totalRevenue += amount;
        totalSales += amount;
      } else if (txn.Type === 'Expense') {
        totalExpenses += amount;
      } else if (txn.Type === 'Purchase_Payment') {
        totalPurchases += amount;
      }
    });

    const profit = totalRevenue - totalExpenses - totalPurchases;

    return {
      totalRevenue: totalRevenue,
      totalExpenses: totalExpenses,
      totalSales: totalSales,
      totalPurchases: totalPurchases,
      profit: profit,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
    };

  } catch (error) {
    logError('getFinancialSummary', error);
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      totalSales: 0,
      totalPurchases: 0,
      profit: 0,
      profitMargin: 0
    };
  }
}

/**
 * Get expense categories from settings
 */
function getExpenseCategories() {
  try {
    const settings = sheetToObjects('Settings');
    const categories = [];

    settings.forEach(setting => {
      if (setting.Setting_Key && setting.Setting_Key.indexOf('Expense_Category_') === 0) {
        const categoryName = setting.Setting_Key.replace('Expense_Category_', '');
        categories.push(categoryName);
      }
    });

    return categories.length > 0 ? categories : ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Supplies', 'Transport', 'Maintenance', 'Other'];

  } catch (error) {
    logError('getExpenseCategories', error);
    return ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Supplies', 'Transport', 'Maintenance', 'Other'];
  }
}

/**
 * Get financial transactions with optional filters
 */
function getFinancialTransactions(filters) {
  try {
    let transactions = sheetToObjects('Financials');

    // Apply filters if provided
    if (filters) {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        transactions = transactions.filter(t => new Date(t.DateTime) >= fromDate);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        transactions = transactions.filter(t => new Date(t.DateTime) <= toDate);
      }
      if (filters.account) {
        transactions = transactions.filter(t => t.Account === filters.account);
      }
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
 * Get detailed report for a specific account
 * Tracks Opening, Inflow, Outflow, and Closing for a date range
 */
function getAccountReport(accountName, startDate, endDate) {
  try {
    const financials = sheetToObjects('Financials');
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let openingBalance = 0;
    let totalCredits = 0; // Money In
    let totalDebits = 0;  // Money Out
    const transactions = [];

    // Sort transactions by date
    financials.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));

    financials.forEach(txn => {
      if (txn.Account !== accountName) return;

      const txnDate = new Date(txn.DateTime);
      const credit = parseFloat(txn.Credit) || 0;
      const debit = parseFloat(txn.Debit) || 0;

      // Calculate Opening Balance (transactions before start date)
      if (txnDate < start) {
        openingBalance += (credit - debit);
      }
      // Calculate Period Totals (transactions within range)
      else if (txnDate <= end) {
        totalCredits += credit;
        totalDebits += debit;

        transactions.push({
          date: txnDate,
          type: txn.Type,
          description: txn.Description,
          in: credit,
          out: debit,
          balance: openingBalance + totalCredits - totalDebits // Running balance
        });
      }
    });

    const closingBalance = openingBalance + totalCredits - totalDebits;

    return {
      account: accountName,
      period: { start: startDate, end: endDate },
      openingBalance: openingBalance,
      totalAdditions: totalCredits,
      totalPayments: totalDebits,
      closingBalance: closingBalance,
      transactions: transactions
    };

  } catch (error) {
    logError('getAccountReport', error);
    throw new Error('Error generating account report: ' + error.message);
  }
}

/**
 * Set Opening Balance for an Account
 * This should only be used once per account when setting up the system
 */
function setOpeningBalance(accountName, amount, user) {
  try {
    const sheet = getSheet('Financials');
    const data = sheet.getDataRange().getValues();

    // Check for existing opening balance
    const exists = data.some(row => row[5] === accountName && row[2] === 'Opening_Balance');
    if (exists) {
      return { success: false, message: "Opening balance already set for " + accountName };
    }

    const txnId = generateId('Financials', 'Transaction_ID', 'OPN');
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount < 0) {
      return { success: false, message: "Invalid amount. Must be a positive number." };
    }

    // Row Structure matches Financials sheet
    // [Transaction_ID, DateTime, Type, Customer_ID, Category, Account, Description,
    //  Amount, Debit, Credit, Balance, Payment_Method, Payee, Receipt_No, Reference,
    //  Status, Approved_By, Created_By]
    const row = [
      txnId,
      new Date(),
      'Opening_Balance',
      '', // Customer
      'Equity', // Category
      accountName, // Account (Cash, M-Pesa, Equity Bank)
      'Initial Opening Balance',
      numAmount,
      0, // Debit (Money Out)
      numAmount, // Credit (Money In)
      0, // Balance (will be calculated)
      'System', // Payment_Method
      '', // Payee
      '', // Receipt_No
      '', // Reference
      'Approved',
      user || 'SYSTEM',
      user || 'SYSTEM'
    ];

    sheet.appendRow(row);
    updateAccountBalance(accountName, numAmount, user || 'SYSTEM');

    logAudit(
      user || 'SYSTEM',
      'Financials',
      'Opening Balance',
      'Opening balance set for ' + accountName + ': ' + formatCurrency(numAmount),
      '',
      '',
      JSON.stringify({txnId, account: accountName, amount: numAmount})
    );

    return {
      success: true,
      message: "Opening balance set successfully for " + accountName,
      txnId: txnId,
      amount: numAmount
    };
  } catch(e) {
    logError('setOpeningBalance', e);
    return { success: false, message: e.message };
  }
}
