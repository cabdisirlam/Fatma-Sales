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
// TRANSACTION HANDLING
// =====================================================

/**
 * Master function to handle various financial transactions
 * types: 'income', 'expense', 'transfer', 'deposit', 'withdrawal'
 */
function handleFinancialTransaction(data) {
  try {
    const sheet = getSheet('Financials');
    const user = data.User || 'SYSTEM';
    const date = new Date();
    
    // 1. Generate IDs and Basics
    let txnId, type, desc, debit = 0, credit = 0;
    const amount = parseFloat(data.amount);
    
    // Mapping logic based on Transaction Type
    switch (data.txnType) {
      case 'client_payment':
        txnId = generateId('Financials', 'Transaction_ID', 'CPY');
        type = 'Customer_Payment';
        desc = 'Payment from ' + data.customerName + (data.notes ? ': ' + data.notes : '');
        credit = amount; // Money In
        // Also update Customer Balance
        updateCustomerBalance(data.customerId, amount, user);
        break;

      case 'expense':
        txnId = generateId('Financials', 'Transaction_ID', 'EXP');
        type = 'Expense';
        desc = data.category + ': ' + (data.notes || '');
        debit = amount; // Money Out
        break;

      case 'bank_deposit':
        txnId = generateId('Financials', 'Transaction_ID', 'DEP');
        type = 'Bank_Deposit'; // Treated as Money In (Capital/Other) or Transfer if implemented
        desc = 'Deposit: ' + (data.notes || 'Cash Deposit');
        credit = amount;
        break;

      case 'bank_withdrawal':
        txnId = generateId('Financials', 'Transaction_ID', 'WTH');
        type = 'Bank_Withdrawal';
        desc = 'Withdrawal: ' + (data.notes || 'Cash Withdrawal');
        debit = amount;
        break;
        
      case 'add_account':
         // Just a dummy transaction to initialize an account
         txnId = generateId('Financials', 'Transaction_ID', 'ACC');
         type = 'Account_Created';
         desc = 'New Account Added: ' + data.account;
         credit = parseFloat(data.openingBal) || 0;
         break;
    }

    // 2. Prepare Row Data (Matching 18 Columns)
    // Headers: Transaction_ID, DateTime, Type, Customer_ID, Category, Account, Description, Amount, Debit, Credit, Balance, Payment_Method, Payee, Receipt_No, Reference, Status, Approved_By, User
    
    const row = [
      txnId,                            // Transaction_ID
      date,                             // DateTime
      type,                             // Type
      data.customerId || '',            // Customer_ID
      data.category || 'General',       // Category
      data.account,                     // Account (Bank/Cash/Mpesa)
      desc,                             // Description
      amount,                           // Amount
      debit,                            // Debit
      credit,                           // Credit
      0,                                // Balance (Calculated later or via formula)
      data.method || data.account,      // Payment_Method
      data.payee || '',                 // Payee
      data.ref || '',                   // Receipt_No
      data.ref || '',                   // Reference
      'Approved',                       // Status
      user,                             // Approved_By
      user                              // User
    ];

    sheet.appendRow(row);

    // 3. Update Account Balance (if keeping a separate running total is desired, otherwise calculated on fly)
    // This system seems to calculate on fly in reports, but we can log it.
    
    logAudit(user, 'Financials', 'Transaction', type + ' of ' + amount, '', '', JSON.stringify(row));

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
      const amt = parseFloat(txn.Amount) || 0;
      const debit = parseFloat(txn.Debit) || 0;
      const credit = parseFloat(txn.Credit) || 0;
      const acc = txn.Account || 'Unknown';

      if (!accountBalances[acc]) accountBalances[acc] = 0;
      accountBalances[acc] += (credit - debit); // Credit is In, Debit is Out

      if (txn.Type === 'Sale_Payment' || txn.Type === 'Customer_Payment' || txn.Type === 'Income') {
        totalRevenue += (credit - debit);
      } else if (txn.Type === 'Expense' || txn.Type === 'Bank_Withdrawal' || txn.Type === 'Purchase_Payment') {
        totalExpenses += debit;
      }
    });

    // Calculate total system balance
    const currentBalance = Object.values(accountBalances).reduce((a, b) => a + b, 0);

    return {
      totalRevenue: totalRevenue,
      totalExpenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      currentBalance: currentBalance,
      accountBalances: accountBalances // Return breakdown
    };

  } catch (error) {
    logError('getFinancialSummary', error);
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0, currentBalance: 0 };
  }
}

function getAccountReport(accountName, startDate, endDate) {
  // Existing logic... reusing getFinancialSummary logic is better but keeping structure
   try {
    const financials = sheetToObjects('Financials');
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let openingBalance = 0;
    let totalCredits = 0; 
    let totalDebits = 0;
    const transactions = [];
    
    // Sort transactions
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
