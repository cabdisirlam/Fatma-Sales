/**
 * Financials Module
 * Handles: Financial transactions, Account balances, Expenses, Banking
 */

// =====================================================
// DATA FETCHING FOR UI
// =====================================================

/**
 * Get data needed for Financials UI (Accounts, Categories, Customers)
 */
function getFinancialUiData() {
  try {
    // 1. Get Accounts (Distinct values from 'Account' column in Financials + Defaults)
    const finSheet = getSheet('Financials');
    const finData = finSheet.getDataRange().getValues();
    const accountSet = new Set(['Cash', 'M-Pesa', 'Equity Bank']); // Defaults
    
    if (finData.length > 1) {
      const accCol = finData[0].indexOf('Account');
      if (accCol > -1) {
        for (let i = 1; i < finData.length; i++) {
          if (finData[i][accCol]) accountSet.add(finData[i][accCol]);
        }
      }
    }

    // 2. Get Expense Categories from Chart of Accounts (prefer 6000* expenses), fallback to provided list
    const fallbackCategories = ['Rent Expense', 'Salaries', 'Utilities', 'Marketing', 'Delivery', 'Maintenance', 'Other Expenses'];
    let categories = [];
    try {
      const coaSheet = getSheet('Chart_of_Accounts');
      const coaData = coaSheet.getDataRange().getValues();
      if (coaData.length > 1) {
        const headers = coaData[0];
        const codeCol = headers.indexOf('Account_Code');
        const nameCol = headers.indexOf('Account_Name');
        const typeCol = headers.indexOf('Account_Type');
        const catCol = headers.indexOf('Category');

        for (let i = 1; i < coaData.length; i++) {
          const code = codeCol > -1 ? coaData[i][codeCol] : '';
          const name = nameCol > -1 ? coaData[i][nameCol] : '';
          const type = typeCol > -1 ? coaData[i][typeCol] : '';
          const cat = catCol > -1 ? coaData[i][catCol] : '';

          const codeNum = parseInt(code, 10);
          const codeStr = code ? code.toString() : '';
          const typeStr = type ? type.toString().toLowerCase() : '';
          const catStr = cat ? cat.toString().toLowerCase() : '';

          // Treat expense if 6000-6999 range or labeled expense
          const isExpense = ((codeNum >= 6000 && codeNum <= 6999) || codeStr.startsWith('6000') || typeStr.includes('expense') || catStr.includes('expense'));
          if (isExpense) {
            const label = name || cat || codeStr;
            if (label) categories.push(label);
          }
        }
      }
    } catch (e) {
      logError('getFinancialUiData.expenseCategories', e);
    }

    // Deduplicate + fallback
    const categorySet = new Set(categories.filter(Boolean));
    if (categorySet.size === 0) {
      fallbackCategories.forEach(c => categorySet.add(c));
    }
    categories = Array.from(categorySet);

    // 3. Get Customers for "Receive Payment"
    const custSheet = getSheet('Customers');
    const custData = sheetToObjects('Customers');
    const customers = custData.map(c => ({
      id: c.Customer_ID,
      name: c.Customer_Name,
      balance: c.Current_Balance
    }));

    // 4. Suppliers for expense payments (optional)
    const supplierData = sheetToObjects('Suppliers');
    const suppliers = supplierData.map(s => ({
      id: s.Supplier_ID,
      name: s.Supplier_Name,
      balance: s.Current_Balance
    }));

    // 5. Filter bank/cash accounts for deposits (exclude inventory-like accounts)
    const depositAccounts = Array.from(accountSet).filter(acc => {
      const a = (acc || '').toString().toLowerCase();
      if (!a) return false;
      if (a.includes('inventory')) return false;
      return a.includes('cash') || a.includes('m-pesa') || a.includes('mpesa') || a.includes('bank');
    }).sort();

    return {
      accounts: Array.from(accountSet).sort(),
      depositAccounts: depositAccounts,
      categories: categories.sort(),
      customers: customers.sort((a, b) => a.name.localeCompare(b.name)),
      suppliers: suppliers.sort((a, b) => a.name.localeCompare(b.name))
    };

  } catch (e) {
    logError('getFinancialUiData', e);
    throw e;
  }
}

// =====================================================
// OPENING BALANCES
// =====================================================

/**
 * Fetch opening balances from Chart_of_Accounts if the column exists
 * Returns an object keyed by account name
 */
function getOpeningBalanceMap() {
  const balances = {};
  try {
    const sheet = getSheet('Chart_of_Accounts');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return balances;

    const headers = data[0];
    const nameCol = headers.indexOf('Account_Name');
    const openingCol = headers.indexOf('Opening_Balance');
    if (nameCol === -1 || openingCol === -1) return balances;

    for (let i = 1; i < data.length; i++) {
      const name = data[i][nameCol];
      if (!name) continue;
      balances[name.toString().trim()] = parseFloat(data[i][openingCol]) || 0;
    }
  } catch (e) {
    logError('getOpeningBalanceMap', e);
  }
  return balances;
}

// =====================================================
// CHART OF ACCOUNTS VALIDATION
// =====================================================

/**
 * Validate that an account exists in Chart of Accounts
 * V3.0: Ensures only valid accounts are used in transactions
 * @param {string} accountName - The account name to validate
 * @throws {Error} if account is not found in Chart of Accounts
 */
function validateAccount(accountName) {
  try {
    if (!accountName || accountName.trim() === '') {
      throw new Error('Account name is required');
    }

    const sheet = getSheet('Chart_of_Accounts');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      throw new Error('Chart of Accounts is empty. Please run upgradeSystemToV3() first.');
    }

    const headers = data[0];
    const accountNameCol = headers.indexOf('Account_Name');

    if (accountNameCol === -1) {
      throw new Error('Chart_of_Accounts sheet is missing Account_Name column');
    }

    // Search for account (case-insensitive)
    const searchName = accountName.trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const acctName = data[i][accountNameCol];
      if (acctName && acctName.toString().trim().toLowerCase() === searchName) {
        return true; // Account found
      }
    }

    // Account not found - throw error with helpful message
    const validAccounts = [];
    for (let i = 1; i < data.length; i++) {
      const acctName = data[i][accountNameCol];
      if (acctName && acctName.toString().trim() !== '') {
        validAccounts.push(acctName.toString().trim());
      }
    }

    throw new Error(
      'Invalid account: "' + accountName + '". ' +
      'Valid accounts are: ' + validAccounts.join(', ')
    );

  } catch (error) {
    logError('validateAccount', error);
    throw error;
  }
}

// =====================================================
// TRANSACTION HANDLING
// =====================================================

/**
 * Master function to handle various financial transactions
 * Logic: Determines ID prefix based on Account (BANK, MPS, CASH)
 * V3.0: Validates account against Chart of Accounts
 */
function handleFinancialTransaction(data) {
  try {
    // V3.0: Validate account exists in Chart of Accounts
    if (data.account) {
      validateAccount(data.account);
    }

    const sheet = getSheet('Financials');
    const user = data.User || 'SYSTEM';
    const date = new Date();

    // 1. Determine ID Prefix based on Account Name
    let prefix = 'TXN';
    const accountName = (data.account || '').toLowerCase();
    
    if (accountName.includes('cash')) {
      prefix = 'CASH';
    } else if (accountName.includes('mpesa') || accountName.includes('m-pesa')) {
      prefix = 'MPS';
    } else {
      // Assume it's a Bank if not Cash or Mpesa
      prefix = 'BANK';
    }

    // 2. Generate Unique ID
    const txnId = generateId('Financials', 'Transaction_ID', prefix);

    // 3. Prepare Transaction Variables
    let type, desc, debit = 0, credit = 0;
    const amount = parseFloat(data.amount) || 0;
    
    // Mapping logic based on Transaction Type from Frontend
    switch (data.txnType) {
      case 'client_payment': // Money In
        type = 'Customer_Payment';
        desc = 'Payment from ' + data.customerName + (data.notes ? ': ' + data.notes : '');
        credit = amount;
        // Also update Customer Balance
        // Payment reduces what customer owes, so subtract from balance
        updateCustomerBalance(data.customerId, -amount, user);
        break;

      case 'expense': // Money Out
        type = 'Expense';
        desc = data.category + ': ' + (data.notes || '');
        debit = amount; 
        if (data.supplierId) {
          try {
            updateSupplierPayment(data.supplierId, amount, user);
          } catch (e) {
            // If supplier update fails, log but continue recording expense
            logError('handleFinancialTransaction.updateSupplierPayment', e);
          }
        }
        break;

      case 'bank_deposit': // Money In
        type = 'Deposit';
        desc = 'Deposit: ' + (data.notes || 'Cash Deposit');
        credit = amount;
        break;

      case 'bank_withdrawal': // Money Out
        type = 'Withdrawal';
        desc = 'Withdrawal: ' + (data.notes || 'Cash Withdrawal');
        debit = amount;
        break;

      case 'opening_balance': // Opening/Adjustment In (non-customer, non-supplier)
        type = 'Opening_Balance';
        desc = 'Opening/Adjustment: ' + (data.notes || data.account);
        credit = amount;
        break;
        
      case 'add_account': // Opening Balance (Money In)
         type = 'Opening_Balance';
         desc = 'Initial Balance for ' + data.account;
         credit = parseFloat(data.openingBal) || 0;
         break;
         
       default:
         throw new Error("Unknown transaction type");
    }

    // 4. Prepare Row Data (Matching 18 Columns Header Structure)
    // Headers: Transaction_ID, DateTime, Type, Customer_ID, Category, Account, Description, Amount, Debit, Credit, Balance, Payment_Method, Payee, Receipt_No, Reference, Status, Approved_By, User
    
    const row = [
      txnId,                            // Transaction_ID
      date,                             // DateTime
      type,                             // Type
      data.customerId || '',            // Customer_ID
      data.category || '',              // Category
      data.account,                     // Account
      desc,                             // Description
      (credit > 0 ? credit : debit),    // Amount (Absolute value)
      debit,                            // Debit
      credit,                           // Credit
      0,                                // Balance (Calculated by running total in report)
      data.method || data.account,      // Payment_Method
      data.payee || '',                 // Payee
      data.ref || '',                   // Receipt_No
      data.ref || '',                   // Reference
      'Approved',                       // Status
      user,                             // Approved_By
      user                              // User
    ];

    sheet.appendRow(row);

    // Log audit
    logAudit(user, 'Financials', 'Transaction', type + ' ' + prefix + ' amount ' + amount, '', '', JSON.stringify(row));

    return { success: true, message: 'Transaction recorded successfully!', txnId: txnId };

  } catch (error) {
    logError('handleFinancialTransaction', error);
    return { success: false, message: error.message };
  }
}

// =====================================================
// EXISTING FUNCTIONS (Kept for compatibility)
// =====================================================

function getFinancialSummary(startDate, endDate) {
  try {
    const financials = sheetToObjects('Financials');
    const openingBalances = getOpeningBalanceMap();
    const defaultAccounts = ['Equity Bank', 'M-Pesa', 'Cash'];
    let txns = financials;
    
    if (startDate) txns = txns.filter(t => new Date(t.DateTime) >= new Date(startDate));
    if (endDate) txns = txns.filter(t => new Date(t.DateTime) <= new Date(endDate));

    let totalRevenue = 0;
    let totalExpenses = 0;
    // Calculate Balance per account
    const accountBalances = {};
    const accountCredits = {};
    const accountDebits = {};
    const accountSet = new Set(defaultAccounts);

    txns.forEach(txn => {
      const debit = parseFloat(txn.Debit) || 0;
      const credit = parseFloat(txn.Credit) || 0;
      const acc = txn.Account || 'Unknown';

      accountSet.add(acc);

      accountCredits[acc] = (accountCredits[acc] || 0) + credit;
      accountDebits[acc] = (accountDebits[acc] || 0) + debit;

      if (txn.Type === 'Sale_Payment' || txn.Type === 'Customer_Payment') {
        totalRevenue += credit;
      } else if (txn.Type === 'Expense') {
        totalExpenses += debit;
      }
    });

    const accountBreakdown = Array.from(accountSet).map(acc => {
      const opening = openingBalances[acc] || 0;
      const inflow = accountCredits[acc] || 0;
      const outflow = accountDebits[acc] || 0;
      const balance = opening + inflow - outflow;
      accountBalances[acc] = balance;
      return {
        name: acc,
        openingBalance: opening,
        inflow: inflow,
        outflow: outflow,
        balance: balance
      };
    });

    const currentBalance = accountBreakdown.reduce((a, b) => a + b.balance, 0);

    return {
      totalRevenue: totalRevenue,
      totalExpenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      currentBalance: currentBalance,
      accountBalances: accountBalances,
      accountBreakdown: accountBreakdown
    };

  } catch (error) {
    logError('getFinancialSummary', error);
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0, currentBalance: 0, accountBreakdown: [] };
  }
}

/**
 * Convenience wrapper for dashboard (summary + UI dropdown data)
 */
function getFinancialDashboardData() {
  try {
    return {
      summary: getFinancialSummary(),
      ui: getFinancialUiData()
    };
  } catch (e) {
    logError('getFinancialDashboardData', e);
    throw e;
  }
}

function getAccountReport(accountName, startDate, endDate) {
  try {
    const financials = sheetToObjects('Financials');
    const openingBalances = getOpeningBalanceMap();
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const target = (accountName || '').toString().trim().toLowerCase();

    let openingBalance = openingBalances[accountName] || 0;
    let totalCredits = 0; 
    let totalDebits = 0;
    const transactions = [];
    
    // Sort safely even if DateTime missing/invalid
    financials.sort((a, b) => {
      const da = new Date(a.DateTime);
      const db = new Date(b.DateTime);
      return da - db;
    });
    
    financials.forEach(txn => {
      const acc = (txn.Account || '').toString().trim().toLowerCase();
      if (acc !== target) return;

      const txnDateRaw = txn.DateTime ? new Date(txn.DateTime) : new Date();
      const txnDate = isNaN(txnDateRaw.getTime()) ? new Date() : txnDateRaw;
      const credit = parseFloat(txn.Credit) || 0;
      const debit = parseFloat(txn.Debit) || 0;

      if (txnDate < start) {
        openingBalance += (credit - debit);
      } else if (txnDate <= end) {
        totalCredits += credit;
        totalDebits += debit;
        transactions.push({
          date: txnDate,
          type: txn.Type,
          description: txn.Description,
          in: credit,
          out: debit,
          balance: openingBalance + totalCredits - totalDebits
        });
      }
    });

    return {
      account: accountName,
      openingBalance: openingBalance,
      totalAdditions: totalCredits,
      totalPayments: totalDebits,
      closingBalance: openingBalance + totalCredits - totalDebits,
      transactions: transactions
    };
  } catch (error) {
    logError('getAccountReport', error);
    throw error;
  }
}
