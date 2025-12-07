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
            const acc = canonicalizeAccountName(finData[i][accCol]);
            if (acc) accountSet.add(acc);
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
  // Preferred approach: use recorded opening/adjustment transactions instead of Chart_of_Accounts to avoid double counting.
  // Return empty map (zero) so balances rely on movement + opening inflow entries.
  return {};
}

/**
 * Get account type from Chart of Accounts
 * Returns: 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense', or null
 */
function getAccountType(accountName) {
  try {
    const sheet = getSheet('Chart_of_Accounts');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const headers = data[0];
    const nameCol = headers.indexOf('Account_Name');
    const typeCol = headers.indexOf('Account_Type');

    if (nameCol === -1 || typeCol === -1) return null;

    const searchName = (accountName || '').toString().trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const acctName = (data[i][nameCol] || '').toString().trim().toLowerCase();
      if (acctName === searchName) {
        return data[i][typeCol] || null;
      }
    }
    return null;
  } catch (e) {
    return null;
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

/**
 * Ensure required accounts for returns/credit notes exist in Chart_of_Accounts.
 * Adds if missing: Accounts Receivable (asset) and Sales Returns (contra-revenue).
 */
function ensureReturnAccountsInitialized() {
  try {
    const sheet = getSheet('Chart_of_Accounts');
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, added: [] };

    const headers = data[0];
    const nameCol = headers.indexOf('Account_Name');
    const codeCol = headers.indexOf('Account_Code');
    const typeCol = headers.indexOf('Type');
    const categoryCol = headers.indexOf('Category');
    const descCol = headers.indexOf('Description');
    const balCol = headers.indexOf('Balance');

    if (nameCol === -1) {
      return { success: false, message: 'Chart_of_Accounts missing Account_Name column' };
    }

    const existing = new Set();
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][nameCol] || '').toString().trim().toLowerCase();
      if (name) existing.add(name);
    }

    const requiredAccounts = [
      {
        code: '01300',
        name: 'Accounts Receivable',
        type: 'Asset',
        category: 'Current Asset',
        description: 'Customer balances (credit sales)',
        balance: 0
      },
      {
        code: '04050',
        name: 'Sales Returns',
        type: 'Revenue',
        category: 'Income',
        description: 'Contra revenue for returned sales',
        balance: 0
      },
      {
        code: '02100',
        name: 'Accounts Payable',
        type: 'Liability',
        category: 'Current Liability',
        description: 'Supplier balances (credit purchases)',
        balance: 0
      }
    ];

    const added = [];
    requiredAccounts.forEach(acc => {
      if (!existing.has(acc.name.toLowerCase())) {
        const row = [];
        row[codeCol] = acc.code;
        row[nameCol] = acc.name;
        if (typeCol !== -1) row[typeCol] = acc.type;
        if (categoryCol !== -1) row[categoryCol] = acc.category;
        if (descCol !== -1) row[descCol] = acc.description;
        if (balCol !== -1) row[balCol] = acc.balance;
        sheet.appendRow(row);
        existing.add(acc.name.toLowerCase());
        added.push(acc.name);
      }
    });

    return { success: true, added: added };
  } catch (error) {
    logError('ensureReturnAccountsInitialized', error);
    return { success: false, message: error.message };
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
        debit = amount;
        // Also update Customer Balance
        // Payment reduces what customer owes, so subtract from balance
        if (data.customerId) {
          updateCustomerBalance(data.customerId, -amount, user);
        }
        break;

      case 'expense': // Money Out (generic expense)
        type = 'Expense';
        desc = data.category + ': ' + (data.notes || '');
        credit = amount; 
        if (data.supplierId) {
          try {
            updateSupplierPayment(data.supplierId, amount, user);
          } catch (e) {
            // If supplier update fails, log but continue recording expense
            logError('handleFinancialTransaction.updateSupplierPayment', e);
          }
        }
        break;

      case 'supplier_payment': // Dedicated supplier payment
        type = 'Supplier_Payment';
        desc = 'Payment to ' + (data.payee || data.supplierId || data.category || 'Supplier');
        if (data.supplierId) {
          desc += ' (Supplier: ' + data.supplierId + ')';
        }
        credit = amount;
        if (data.supplierId) {
          try {
            updateSupplierPayment(data.supplierId, amount, user);
          } catch (e) {
            logError('handleFinancialTransaction.updateSupplierPayment', e);
          }
        }
        break;

      case 'bank_deposit': // Money In
        type = 'Deposit';
        desc = 'Deposit: ' + (data.notes || 'Cash Deposit');
        debit = amount;
        break;

      case 'bank_withdrawal': // Money Out
        type = 'Withdrawal';
        desc = 'Withdrawal: ' + (data.notes || 'Cash Withdrawal');
        credit = amount;
        break;

      case 'opening_balance': // Opening/Adjustment In (non-customer, non-supplier)
        type = 'Opening_Balance';
        desc = 'Opening/Adjustment: ' + (data.notes || data.account);
        debit = amount;
        break;
        
      case 'add_account': // Opening Balance (Money In)
         type = 'Opening_Balance';
         desc = 'Initial Balance for ' + data.account;
         debit = parseFloat(data.openingBal) || 0;
         break;
         
       default:
         throw new Error("Unknown transaction type");
    }

    // 3b. Normalize account name before storage
    const accountDisplay = canonicalizeAccountName(data.account);
    data.account = accountDisplay;

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
    
    if (startDate) {
      const start = parseTxnDate(startDate);
      txns = txns.filter(t => parseTxnDate(t.DateTime) >= start);
    }
    if (endDate) {
      const end = parseTxnDate(endDate);
      txns = txns.filter(t => parseTxnDate(t.DateTime) <= end);
    }

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
      const amount = parseFloat(txn.Amount) || Math.max(debit, credit, 0);
      const acc = canonicalizeAccountName(txn.Account || 'Unknown');

      accountSet.add(acc);

      accountCredits[acc] = (accountCredits[acc] || 0) + credit;
      accountDebits[acc] = (accountDebits[acc] || 0) + debit;

      if (txn.Type === 'Sale_Payment' || txn.Type === 'Customer_Payment') {
        totalRevenue += amount;
      } else if (txn.Type === 'Expense') {
        totalExpenses += amount;
      }
    });

    const accountBreakdown = Array.from(accountSet).map(acc => {
      const opening = openingBalances[acc] || 0;
      const debits = accountDebits[acc] || 0;
      const credits = accountCredits[acc] || 0;

      // Get account type to determine balance calculation logic
      let accountType = getAccountType(acc);

      // ✅ SAFEGUARD: Ensure default cash accounts are ALWAYS treated as Assets
      // This overrides any misconfiguration in Chart of Accounts
      const defaultAssets = ['Cash', 'M-Pesa', 'Equity Bank'];
      if (defaultAssets.indexOf(acc) !== -1) {
        accountType = 'Asset';  // Force asset type regardless of Chart of Accounts
      }

      let balance, inflow, outflow;

      // ✅ FIX: Apply correct accounting logic based on account type
      if (accountType === 'Liability' || accountType === 'Equity' || accountType === 'Revenue') {
        // Liabilities, Equity, Revenue: Credit increases (normal credit balance)
        inflow = credits;   // CR increases
        outflow = debits;   // DR decreases
        balance = opening + credits - debits;
      } else {
        // Assets, Expenses: Debit increases (normal debit balance)
        inflow = debits;    // DR increases
        outflow = credits;  // CR decreases
        balance = opening + debits - credits;
      }

      accountBalances[acc] = balance;
      return {
        name: acc,
        accountType: accountType,
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

// =====================================================
// NET WORTH SNAPSHOT + HISTORY
// =====================================================

/**
 * Compute current net worth components.
 * Net Worth = Cash/Bank + Receivables + Inventory - Supplier Balances
 */
function computeNetWorthSnapshot(asOfDate) {
  try {
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const date = asOfDate ? new Date(asOfDate) : new Date();
    const summary = getFinancialSummary();
    const accountBreakdown = summary.accountBreakdown || [];

    // Treat any cash/bank/mpesa accounts as liquid funds
    const bankCash = accountBreakdown
      .filter(a => a && a.name && /cash|m-?pesa|bank/i.test(a.name))
      .reduce((sum, a) => sum + toNumber(a.balance), 0);

    const receivables = sheetToObjects('Customers')
      .reduce((sum, c) => sum + toNumber(c.Current_Balance), 0);

    const inventory = getInventory()
      .reduce((sum, item) => {
        // Prefer precomputed stock_value when available
        const stockValue = toNumber(item.stock_value);
        if (stockValue) return sum + stockValue;
        const qty = toNumber(item.Current_Qty);
        const cost = toNumber(item.Cost_Price);
        return sum + (qty * cost);
      }, 0);

    const payables = sheetToObjects('Suppliers')
      .reduce((sum, s) => sum + toNumber(s.Current_Balance), 0);

    const netWorth = bankCash + receivables + inventory - payables;

    return {
      date: date.toISOString(),
      bankCash: bankCash,
      receivables: receivables,
      inventory: inventory,
      payables: payables,
      netWorth: netWorth
    };
  } catch (error) {
    logError('computeNetWorthSnapshot', error);
    throw error;
  }
}

/**
 * Ensure the Net_Worth_Log sheet exists with headers.
 */
function ensureNetWorthLogSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Net_Worth_Log');
  if (!sheet) {
    sheet = ss.insertSheet('Net_Worth_Log');
    sheet.appendRow(['Date', 'Cash_Bank', 'Receivables', 'Inventory', 'Suppliers', 'Net_Worth', 'Change']);
  }
  return sheet;
}

/**
 * Record today's net worth snapshot (updates existing row for the day).
 * Returns the snapshot plus calculated change vs previous day.
 */
function recordNetWorthSnapshot() {
  const snap = computeNetWorthSnapshot();
  const sheet = ensureNetWorthLogSheet();
  const data = sheet.getDataRange().getValues(); // includes header
  const snapDate = new Date(snap.date);
  snapDate.setHours(0, 0, 0, 0);

  let existingRowIndex = null; // zero-based within data array
  let previousNet = 0;

  // Walk from bottom to find existing row for today and previous distinct day net worth
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = data[i][0];
    if (!rowDate) continue;
    const normalized = new Date(rowDate);
    normalized.setHours(0, 0, 0, 0);
    if (existingRowIndex === null && normalized.getTime() === snapDate.getTime()) {
      existingRowIndex = i;
      continue;
    }
    if (previousNet === 0 && normalized.getTime() !== snapDate.getTime()) {
      previousNet = parseFloat(data[i][5]) || 0; // Net_Worth column
      break;
    }
  }

  const change = snap.netWorth - previousNet;
  const rowValues = [
    snapDate,
    snap.bankCash,
    snap.receivables,
    snap.inventory,
    snap.payables,
    snap.netWorth,
    change
  ];

  if (existingRowIndex !== null) {
    const rowNumber = existingRowIndex + 1; // convert to 1-based
    sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return {
    snapshot: snap,
    change: change,
    previousNetWorth: previousNet
  };
}

/**
 * Read net worth history (most recent first).
 */
function getNetWorthHistory(limit) {
  const sheet = ensureNetWorthLogSheet();
  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  // Drop header, normalize ordering by date desc
  const rows = data.slice(1).filter(r => r[0]);
  rows.sort((a, b) => new Date(b[0]) - new Date(a[0]));

  const trimmed = limit ? rows.slice(0, limit) : rows;

  return trimmed.map(r => ({
    date: r[0],
    bankCash: parseFloat(r[1]) || 0,
    receivables: parseFloat(r[2]) || 0,
    inventory: parseFloat(r[3]) || 0,
    payables: parseFloat(r[4]) || 0,
    netWorth: parseFloat(r[5]) || 0,
    change: parseFloat(r[6]) || 0
  }));
}

/**
 * Combined endpoint for Reports UI.
 */
function getNetWorthReport() {
  try {
    const result = recordNetWorthSnapshot();
    const history = getNetWorthHistory();
    return {
      snapshot: result.snapshot,
      change: result.change,
      previousNetWorth: result.previousNetWorth,
      history: history
    };
  } catch (error) {
    logError('getNetWorthReport', error);
    throw error;
  }
}

/**
 * Install a daily trigger to record net worth snapshot at 10 PM Africa/Nairobi (19:00 UTC).
 */
function ensureNetWorthDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const hasTrigger = triggers.some(t => t.getHandlerFunction && t.getHandlerFunction() === 'recordNetWorthSnapshot');
  if (hasTrigger) return;
  ScriptApp.newTrigger('recordNetWorthSnapshot')
    .timeBased()
    .everyDays(1)
    .atHour(19) // 19:00 UTC ~= 22:00 Africa/Nairobi
    .create();
}

/**
 * Get detailed account statement with running balance
 * Handles date filters and normalizes account naming
 */
function getAccountStatement(accountName, startDate, endDate) {
  try {
    if (!accountName) {
      throw new Error('Account name is required');
    }

    const financials = sheetToObjects('Financials');
    const openingBalances = getOpeningBalanceMap();
    const hasStart = !!startDate;
    const hasEnd = !!endDate;
    const start = hasStart ? parseTxnDate(startDate) : new Date(0);
    const end = hasEnd ? parseTxnDate(endDate) : new Date('2999-12-31T23:59:59Z');

    const target = canonicalizeAccountName(accountName || '').toLowerCase();

    let openingBalance = openingBalances[accountName] || 0;
    let runningBalance = openingBalance;
    let totalCredits = 0;
    let totalDebits = 0;
    const transactions = [];

    const sorted = financials
      .map(txn => ({
        raw: txn,
        acc: canonicalizeAccountName(txn.Account || '').toLowerCase(),
        date: parseTxnDate(txn.DateTime),
        credit: parseFloat(txn.Credit) || 0,
        debit: parseFloat(txn.Debit) || 0
      }))
      .filter(t => t.acc === target)
      .sort((a, b) => a.date - b.date);

    sorted.forEach(t => {
      if (t.date < start) {
        runningBalance += (t.debit - t.credit);
        return;
      }

      if (t.date > end) {
        return;
      }

      if (transactions.length === 0) {
        // Effective balance at the start of the requested window
        openingBalance = runningBalance;
      }

      runningBalance += (t.debit - t.credit);
      totalCredits += t.credit; // CR = outflow for assets
      totalDebits += t.debit;   // DR = inflow for assets
      transactions.push({
        date: t.date.toISOString(),
        type: t.raw.Type,
        description: t.raw.Description,
        in: t.debit,
        out: t.credit,
        runningBalance: runningBalance
      });
    });

    if (transactions.length === 0) {
      openingBalance = runningBalance;
    }

    return {
      account: accountName,
      openingBalance: openingBalance,
      totalAdditions: totalDebits,  // DR = additions for assets
      totalPayments: totalCredits,  // CR = reductions for assets
      closingBalance: runningBalance,
      transactions: transactions
    };
  } catch (error) {
    logError('getAccountStatement', error);
    throw error;
  }
}

/**
 * Wrapper to preserve legacy API while using the detailed statement logic
 */
function getAccountReport(accountName, startDate, endDate) {
  try {
    const statement = getAccountStatement(accountName, startDate, endDate);
    return {
      ...statement,
      transactions: statement.transactions.map(t => ({
        ...t,
        balance: t.runningBalance // compatibility for existing UI expectations
      }))
    };
  } catch (error) {
    logError('getAccountReport', error);
    throw error;
  }
}

/**
 * Robust DateTime parser for Financials DateTime values.
 * Handles Date objects, date strings, and Google Sheets serial numbers.
 */
function parseTxnDate(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number' && !isNaN(value)) {
    // Google Sheets stores dates as days since 1899-12-30
    const ms = (value - 25569) * 86400000; // convert to ms from Unix epoch
    return new Date(ms);
  }
  if (typeof value === 'string') {
    const str = value.trim();
    // ISO or RFC-like
    let parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    // Try YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
    const isoLike = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (isoLike) {
      const [, y, m, d, hh = '0', mm = '0', ss = '0'] = isoLike;
      parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Try MM/DD/YYYY or MM/DD/YYYY HH:MM:SS
    const usLike = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (usLike) {
      const [, m, d, y, hh = '0', mm = '0', ss = '0'] = usLike;
      parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  const fallback = new Date(value);
  if (!isNaN(fallback.getTime())) return fallback;
  return new Date(0); // ultimate fallback
}

/**
 * Normalize account names for consistency across UI/storage.
 */
function canonicalizeAccountName(name) {
  if (!name) return '';
  const raw = name.toString().trim();
  const lower = raw.toLowerCase();
  if (lower.includes('mpesa') || lower.includes('m-pesa')) return 'M-Pesa';
  if (lower.includes('cash')) return 'Cash';
  if (lower.includes('equity')) return 'Equity Bank';
  return raw;
}

/**
 * 🔧 ONE-TIME CLEANUP: Canonicalize all existing account names in Financials sheet
 *
 * This function fixes all existing transactions to use canonical account names:
 * - Converts "mpesa", "m-pesa", etc. → "M-Pesa"
 * - Converts "cash", "CASH", etc. → "Cash"
 * - Converts "equity", "equity bank", etc. → "Equity Bank"
 *
 * Run this ONCE in the Apps Script editor after deployment.
 *
 * @returns {object} Summary of changes made
 */
function cleanupFinancialAccountNames() {
  try {
    Logger.log('===== STARTING FINANCIAL ACCOUNT CLEANUP =====');

    const sheet = getSheet('Financials');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return { success: true, message: 'No data to cleanup', updatedRows: 0 };
    }

    const headers = data[0];
    const accountCol = headers.indexOf('Account');
    const paymentMethodCol = headers.indexOf('Payment_Method');

    if (accountCol === -1) {
      throw new Error('Account column not found in Financials sheet');
    }

    let updatedRows = 0;
    const changes = {
      accountChanges: 0,
      paymentMethodChanges: 0,
      details: []
    };

    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      let rowChanged = false;
      const rowNum = i + 1;

      // Fix Account column
      if (accountCol !== -1 && data[i][accountCol]) {
        const originalAccount = data[i][accountCol];
        const canonicalAccount = canonicalizeAccountName(originalAccount);

        if (originalAccount !== canonicalAccount) {
          sheet.getRange(rowNum, accountCol + 1).setValue(canonicalAccount);
          changes.accountChanges++;
          rowChanged = true;

          Logger.log(`Row ${rowNum}: Account "${originalAccount}" → "${canonicalAccount}"`);
        }
      }

      // Fix Payment_Method column
      if (paymentMethodCol !== -1 && data[i][paymentMethodCol]) {
        const originalMethod = data[i][paymentMethodCol];
        const canonicalMethod = canonicalizeAccountName(originalMethod);

        if (originalMethod !== canonicalMethod) {
          sheet.getRange(rowNum, paymentMethodCol + 1).setValue(canonicalMethod);
          changes.paymentMethodChanges++;
          rowChanged = true;

          Logger.log(`Row ${rowNum}: Payment_Method "${originalMethod}" → "${canonicalMethod}"`);
        }
      }

      if (rowChanged) {
        updatedRows++;
      }
    }

    // Log summary
    Logger.log('===== CLEANUP COMPLETE =====');
    Logger.log(`Total rows updated: ${updatedRows}`);
    Logger.log(`Account column changes: ${changes.accountChanges}`);
    Logger.log(`Payment_Method column changes: ${changes.paymentMethodChanges}`);

    // Log audit trail
    logAudit(
      'SYSTEM',
      'Financials',
      'Cleanup',
      'Canonicalized account names in existing transactions',
      '',
      '',
      `Updated ${updatedRows} rows`
    );

    return {
      success: true,
      message: 'Cleanup completed successfully',
      updatedRows: updatedRows,
      accountChanges: changes.accountChanges,
      paymentMethodChanges: changes.paymentMethodChanges
    };

  } catch (error) {
    logError('cleanupFinancialAccountNames', error);
    return {
      success: false,
      message: 'Cleanup failed: ' + error.message,
      error: error.stack
    };
  }
}
