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

    // 2. Get Expense Categories from Settings
    const settings = sheetToObjects('Settings');
    const categories = [];
    settings.forEach(s => {
      if (s.Setting_Key && s.Setting_Key.startsWith('Expense_Category_')) {
        categories.push(s.Setting_Key.replace('Expense_Category_', ''));
      }
    });
    if (categories.length === 0) categories.push('Rent', 'Utilities', 'Salaries', 'Other');

    // 3. Get Customers for "Receive Payment"
    const custSheet = getSheet('Customers');
    const custData = sheetToObjects('Customers');
    const customers = custData.map(c => ({
      id: c.Customer_ID,
      name: c.Customer_Name,
      balance: c.Current_Balance
    }));

    return {
      accounts: Array.from(accountSet).sort(),
      categories: categories.sort(),
      customers: customers.sort((a, b) => a.name.localeCompare(b.name))
    };

  } catch (e) {
    logError('getFinancialUiData', e);
    throw e;
  }
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
        updateCustomerBalance(data.customerId, amount, user);
        break;

      case 'expense': // Money Out
        type = 'Expense';
        desc = data.category + ': ' + (data.notes || '');
        debit = amount; 
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
    let txns = financials;
    
    if (startDate) txns = txns.filter(t => new Date(t.DateTime) >= new Date(startDate));
    if (endDate) txns = txns.filter(t => new Date(t.DateTime) <= new Date(endDate));

    let totalRevenue = 0;
    let totalExpenses = 0;
    // Calculate Balance per account
    const accountBalances = {};

    txns.forEach(txn => {
      const debit = parseFloat(txn.Debit) || 0;
      const credit = parseFloat(txn.Credit) || 0;
      const acc = txn.Account || 'Unknown';

      if (!accountBalances[acc]) accountBalances[acc] = 0;
      accountBalances[acc] += (credit - debit); // Credit is In, Debit is Out

      if (txn.Type === 'Sale_Payment' || txn.Type === 'Customer_Payment') {
        totalRevenue += credit;
      } else if (txn.Type === 'Expense') {
        totalExpenses += debit;
      }
    });

    const currentBalance = Object.values(accountBalances).reduce((a, b) => a + b, 0);

    return {
      totalRevenue: totalRevenue,
      totalExpenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      currentBalance: currentBalance,
      accountBalances: accountBalances
    };

  } catch (error) {
    logError('getFinancialSummary', error);
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0, currentBalance: 0 };
  }
}

function getAccountReport(accountName, startDate, endDate) {
  try {
    const financials = sheetToObjects('Financials');
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let openingBalance = 0;
    let totalCredits = 0; 
    let totalDebits = 0;
    const transactions = [];
    
    financials.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));
    
    financials.forEach(txn => {
      if (txn.Account !== accountName) return;

      const txnDate = new Date(txn.DateTime);
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
