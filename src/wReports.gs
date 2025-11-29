/**
 * Reports Module
 * Comprehensive reporting for sales, inventory, financials, customers, suppliers
 */

/**
 * Generate sales report
 */
function generateSalesReport(startDate, endDate, groupBy) {
  try {
    const sales = sheetToObjects('Sales');

    // Filter sales in date range
    let filtered = sales.filter(s => {
      if (s.Type !== 'Sale') return false;
      const saleDate = new Date(s.DateTime);
      if (startDate && saleDate < new Date(startDate)) return false;
      if (endDate && saleDate > new Date(endDate)) return false;
      return true;
    });

    // Group results
    const grouped = {};
    filtered.forEach(sale => {
      let key = '';
      if (groupBy === 'daily') {
        key = Utilities.formatDate(new Date(sale.DateTime), 'GMT+3', 'yyyy-MM-dd');
      } else if (groupBy === 'product') {
        key = sale.Item_Name;
      } else if (groupBy === 'user') {
        key = sale.Sold_By;
      } else {
        key = sale.Transaction_ID;
      }

      if (!grouped[key]) {
        grouped[key] = {
          key: key,
          totalSales: 0,
          totalQty: 0,
          transactionCount: new Set()
        };
      }

      grouped[key].totalSales += parseFloat(sale.Grand_Total) || 0;
      grouped[key].totalQty += parseFloat(sale.Qty) || 0;
      grouped[key].transactionCount.add(sale.Transaction_ID);
    });

    return Object.values(grouped).map(g => ({
      ...g,
      transactionCount: g.transactionCount.size
    }));

  } catch (error) {
    logError('generateSalesReport', error);
    return [];
  }
}

/**
 * Generate inventory report
 */
function generateInventoryReport() {
  try {
    const inventory = getInventory();

    return inventory.map(item => ({
      Item_ID: item.Item_ID,
      Item_Name: item.Item_Name,
      Category: item.Category,
      Current_Qty: item.Current_Qty,
      Reorder_Level: item.Reorder_Level,
      Cost_Price: item.Cost_Price,
      Selling_Price: item.Selling_Price,
      Stock_Value: item.stock_value,
      Stock_Status: item.stock_status,
      Potential_Revenue: (item.Current_Qty || 0) * (item.Selling_Price || 0)
    }));

  } catch (error) {
    logError('generateInventoryReport', error);
    return [];
  }
}

/**
 * Generate profit/loss report
 */
function generateProfitLossReport(startDate, endDate) {
  try {
    const financialSummary = getFinancialSummary(startDate, endDate);
    const expensesByCategory = getExpensesByCategory(startDate, endDate);

    return {
      revenue: financialSummary.totalRevenue,
      costOfGoodsSold: financialSummary.totalPurchases,
      grossProfit: financialSummary.totalRevenue - financialSummary.totalPurchases,
      expenses: expensesByCategory,
      totalExpenses: financialSummary.totalExpenses,
      netProfit: financialSummary.profit,
      profitMargin: financialSummary.profitMargin
    };

  } catch (error) {
    logError('generateProfitLossReport', error);
    return null;
  }
}

/**
 * Generate customer debt report
 */
function generateCustomerDebtReport() {
  try {
    const customers = getCustomersWithDebt();

    return customers.map(c => ({
      Customer_ID: c.Customer_ID,
      Customer_Name: c.Customer_Name,
      Phone: c.Phone,
      Current_Balance: c.Current_Balance,
      Total_Purchases: c.Total_Purchases,
      Last_Purchase_Date: c.Last_Purchase_Date,
      Days_Outstanding: c.Last_Purchase_Date ?
        Math.floor((new Date() - new Date(c.Last_Purchase_Date)) / (1000 * 60 * 60 * 24)) : 0
    }));

  } catch (error) {
    logError('generateCustomerDebtReport', error);
    return [];
  }
}

/**
 * Generate top selling products report
 */
function generateTopSellingReport(startDate, endDate, limit) {
  try {
    const salesReport = generateSalesReport(startDate, endDate, 'product');

    // Sort by total sales descending
    salesReport.sort((a, b) => b.totalSales - a.totalSales);

    // Limit results
    return salesReport.slice(0, limit || 10);

  } catch (error) {
    logError('generateTopSellingReport', error);
    return [];
  }
}

/**
 * Generate user performance report
 */
function generateUserPerformanceReport(startDate, endDate) {
  try {
    const salesReport = generateSalesReport(startDate, endDate, 'user');

    // Sort by total sales descending
    salesReport.sort((a, b) => b.totalSales - a.totalSales);

    return salesReport;

  } catch (error) {
    logError('generateUserPerformanceReport', error);
    return [];
  }
}

// =====================================================
// V3.0 FINANCIAL STATEMENTS WITH RUNNING BALANCE
// =====================================================

/**
 * Get account type from Chart of Accounts
 * Used to determine proper Debit/Credit handling
 */
function getAccountType(accountName) {
  try {
    const sheet = getSheet('Chart_of_Accounts');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('Chart_of_Accounts is empty - defaulting to Asset');
      return 'Asset'; // Default assumption
    }

    const headers = data[0];
    const accountNameCol = headers.indexOf('Account_Name');
    const typeCol = headers.indexOf('Type');

    if (accountNameCol === -1 || typeCol === -1) {
      Logger.log('Chart_of_Accounts missing required columns');
      return 'Asset';
    }

    // Find account (case-insensitive)
    const searchName = accountName.trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const acctName = data[i][accountNameCol];
      if (acctName && acctName.toString().trim().toLowerCase() === searchName) {
        return data[i][typeCol] || 'Asset';
      }
    }

    Logger.log('Account not found in Chart of Accounts: ' + accountName + ' - defaulting to Asset');
    return 'Asset';

  } catch (error) {
    logError('getAccountType', error);
    return 'Asset'; // Safe default
  }
}

/**
 * Get detailed account statement with running balance
 * V3.0: Enhanced with proper Debit/Credit handling based on account type
 *
 * @param {string} accountName - Account name (e.g., "Cash", "M-Pesa", "Equity Bank")
 * @param {Date|string} startDate - Start date for the statement
 * @param {Date|string} endDate - End date for the statement
 * @returns {Object} Statement with opening balance, transactions, and closing balance
 *
 * Accounting Rules:
 * - Assets (Cash, Bank, Inventory): Increase with Debit (In), Decrease with Credit (Out)
 * - Liabilities (Accounts Payable): Increase with Credit, Decrease with Debit
 * - Revenue (Sales): Increase with Credit
 * - Expenses (COGS, Rent): Increase with Debit
 */
function getAccountStatement(accountName, startDate, endDate) {
  try {
    // Get account type from Chart of Accounts
    const accountType = getAccountType(accountName);
    Logger.log('Account: ' + accountName + ', Type: ' + accountType);

    // Get all financial transactions
    const financials = sheetToObjects('Financials');

    // Filter transactions for this account
    const accountTransactions = financials.filter(txn =>
      txn.Account && txn.Account.toString().trim().toLowerCase() === accountName.toLowerCase()
    );

    // Sort by date
    accountTransactions.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));

    // Parse date range
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) {
      end.setHours(23, 59, 59, 999); // Include entire end date
    }

    // Calculate opening balance (all transactions before start date)
    let openingBalance = 0;
    const beforeStart = accountTransactions.filter(txn => {
      if (!start) return false;
      return new Date(txn.DateTime) < start;
    });

    // Calculate opening balance based on account type
    beforeStart.forEach(txn => {
      const debit = parseFloat(txn.Debit) || 0;
      const credit = parseFloat(txn.Credit) || 0;

      if (accountType === 'Asset') {
        // Assets: Debit increases, Credit decreases
        openingBalance += (debit - credit);
      } else if (accountType === 'Liability' || accountType === 'Revenue') {
        // Liabilities/Revenue: Credit increases, Debit decreases
        openingBalance += (credit - debit);
      } else if (accountType === 'Expense') {
        // Expenses: Debit increases (but typically we track accumulation)
        openingBalance += (debit - credit);
      }
    });

    // Filter transactions within date range
    const rangeTransactions = accountTransactions.filter(txn => {
      const txnDate = new Date(txn.DateTime);
      if (start && txnDate < start) return false;
      if (end && txnDate > end) return false;
      return true;
    });

    // Process transactions with running balance
    let runningBalance = openingBalance;
    let totalIn = 0;
    let totalOut = 0;

    const transactions = rangeTransactions.map(txn => {
      const debit = parseFloat(txn.Debit) || 0;
      const credit = parseFloat(txn.Credit) || 0;

      let inAmount = 0;
      let outAmount = 0;
      let balanceChange = 0;

      if (accountType === 'Asset') {
        // Assets: Debit = Money In, Credit = Money Out
        inAmount = debit;
        outAmount = credit;
        balanceChange = debit - credit;
      } else if (accountType === 'Liability' || accountType === 'Revenue') {
        // Liabilities/Revenue: Credit = Increase, Debit = Decrease
        inAmount = credit;
        outAmount = debit;
        balanceChange = credit - debit;
      } else if (accountType === 'Expense') {
        // Expenses: Debit = Expense Incurred
        inAmount = debit;
        outAmount = credit;
        balanceChange = debit - credit;
      }

      runningBalance += balanceChange;
      totalIn += inAmount;
      totalOut += outAmount;

      return {
        date: txn.DateTime,
        type: txn.Type,
        description: txn.Description || '',
        reference: txn.Reference || txn.Receipt_No || '',
        debit: debit,
        credit: credit,
        in: inAmount,
        out: outAmount,
        runningBalance: runningBalance,
        transactionId: txn.Transaction_ID
      };
    });

    const closingBalance = openingBalance + totalIn - totalOut;

    return {
      account: accountName,
      accountType: accountType,
      openingBalance: openingBalance,
      totalIn: totalIn,
      totalOut: totalOut,
      closingBalance: closingBalance,
      netMovement: totalIn - totalOut,
      transactionCount: transactions.length,
      transactions: transactions,
      period: {
        start: start ? start.toISOString() : 'Beginning',
        end: end ? end.toISOString() : 'Now'
      }
    };

  } catch (error) {
    logError('getAccountStatement', error);
    throw new Error('Error generating account statement: ' + error.message);
  }
}

/**
 * Get customer statement with running balance
 * V3.0: Shows detailed customer transactions (invoices and payments)
 *
 * @param {string} customerId - Customer ID
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} Customer statement with running balance
 */
function getCustomerStatement(customerId, startDate, endDate) {
  try {
    // Get customer info
    const customer = getCustomerById(customerId);

    // Get all sales for this customer
    const sales = sheetToObjects('Sales');
    const customerSales = sales.filter(s =>
      s.Customer_ID === customerId && s.Type === 'Sale'
    );

    // Group sales by transaction ID
    const salesByTxn = {};
    customerSales.forEach(sale => {
      if (!salesByTxn[sale.Transaction_ID]) {
        salesByTxn[sale.Transaction_ID] = {
          Transaction_ID: sale.Transaction_ID,
          DateTime: sale.DateTime,
          Grand_Total: parseFloat(sale.Grand_Total) || 0,
          Type: 'Invoice'
        };
      }
    });

    // Get all payments for this customer
    const financials = sheetToObjects('Financials');
    const customerPayments = financials.filter(txn =>
      txn.Customer_ID === customerId &&
      (txn.Type === 'Sale_Payment' || txn.Type === 'Customer_Payment')
    );

    // Combine transactions
    const allTransactions = [
      ...Object.values(salesByTxn),
      ...customerPayments.map(pmt => ({
        Transaction_ID: pmt.Transaction_ID,
        DateTime: pmt.DateTime,
        Amount: parseFloat(pmt.Amount) || 0,
        Type: 'Payment',
        Reference: pmt.Reference
      }))
    ];

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));

    // Parse date range
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    // Calculate opening balance
    let openingBalance = 0;
    const beforeStart = allTransactions.filter(txn => {
      if (!start) return false;
      return new Date(txn.DateTime) < start;
    });

    beforeStart.forEach(txn => {
      if (txn.Type === 'Invoice') {
        // Invoice increases debt (negative balance)
        openingBalance -= txn.Grand_Total;
      } else if (txn.Type === 'Payment') {
        // Payment reduces debt (positive balance movement)
        openingBalance += txn.Amount;
      }
    });

    // Filter transactions in range
    const rangeTransactions = allTransactions.filter(txn => {
      const txnDate = new Date(txn.DateTime);
      if (start && txnDate < start) return false;
      if (end && txnDate > end) return false;
      return true;
    });

    // Process with running balance
    let runningBalance = openingBalance;
    let totalInvoiced = 0;
    let totalReceived = 0;

    const transactions = rangeTransactions.map(txn => {
      let debit = 0;
      let credit = 0;
      let description = '';

      if (txn.Type === 'Invoice') {
        debit = txn.Grand_Total;
        description = 'Sale Invoice #' + txn.Transaction_ID;
        totalInvoiced += debit;
        runningBalance -= debit; // Invoices increase debt (make balance more negative)
      } else if (txn.Type === 'Payment') {
        credit = txn.Amount;
        description = 'Payment Received' + (txn.Reference ? ' - Ref: ' + txn.Reference : '');
        totalReceived += credit;
        runningBalance += credit; // Payments reduce debt (make balance less negative)
      }

      return {
        date: txn.DateTime,
        type: txn.Type,
        description: description,
        reference: txn.Transaction_ID,
        debit: debit,     // Amount owed (Invoice)
        credit: credit,   // Amount paid (Payment)
        runningBalance: runningBalance
      };
    });

    const closingBalance = openingBalance - totalInvoiced + totalReceived;

    return {
      customer: {
        Customer_ID: customer.Customer_ID,
        Customer_Name: customer.Customer_Name,
        Phone: customer.Phone,
        Email: customer.Email
      },
      openingBalance: openingBalance,
      totalInvoiced: totalInvoiced,
      totalReceived: totalReceived,
      closingBalance: closingBalance,
      outstandingAmount: Math.abs(closingBalance < 0 ? closingBalance : 0),
      transactionCount: transactions.length,
      transactions: transactions,
      period: {
        start: start ? start.toISOString() : 'Beginning',
        end: end ? end.toISOString() : 'Now'
      }
    };

  } catch (error) {
    logError('getCustomerStatement', error);
    throw new Error('Error generating customer statement: ' + error.message);
  }
}

/**
 * Get supplier statement with running balance
 * V3.0: Shows detailed supplier transactions (bills and payments)
 *
 * @param {string} supplierId - Supplier ID
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} Supplier statement with running balance
 */
function getSupplierStatement(supplierId, startDate, endDate) {
  try {
    // Get supplier info
    const supplier = getSupplierById(supplierId);

    // Get all purchases for this supplier
    const purchases = sheetToObjects('Purchases');
    const supplierPurchases = purchases.filter(p => p.Supplier_ID === supplierId);

    // Group purchases by Purchase_ID
    const purchasesByTxn = {};
    supplierPurchases.forEach(purchase => {
      if (!purchasesByTxn[purchase.Purchase_ID]) {
        purchasesByTxn[purchase.Purchase_ID] = {
          Purchase_ID: purchase.Purchase_ID,
          Date: purchase.Date,
          Total_Amount: parseFloat(purchase.Total_Amount) || 0,
          Type: 'Bill'
        };
      }
    });

    // Get all payments for this supplier
    const financials = sheetToObjects('Financials');
    const supplierPayments = financials.filter(txn => {
      return (txn.Type === 'Supplier_Payment' || txn.Type === 'Purchase_Payment') &&
             txn.Reference && txn.Reference.indexOf(supplierId) !== -1;
    });

    // Combine transactions
    const allTransactions = [
      ...Object.values(purchasesByTxn).map(p => ({
        Transaction_ID: p.Purchase_ID,
        DateTime: p.Date,
        Amount: p.Total_Amount,
        Type: 'Bill'
      })),
      ...supplierPayments.map(pmt => ({
        Transaction_ID: pmt.Transaction_ID,
        DateTime: pmt.DateTime,
        Amount: parseFloat(pmt.Amount) || 0,
        Type: 'Payment',
        Reference: pmt.Receipt_No
      }))
    ];

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));

    // Parse date range
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    // Calculate opening balance
    let openingBalance = 0;
    const beforeStart = allTransactions.filter(txn => {
      if (!start) return false;
      return new Date(txn.DateTime) < start;
    });

    beforeStart.forEach(txn => {
      if (txn.Type === 'Bill') {
        // Bill increases amount owed
        openingBalance += txn.Amount;
      } else if (txn.Type === 'Payment') {
        // Payment reduces amount owed
        openingBalance -= txn.Amount;
      }
    });

    // Filter transactions in range
    const rangeTransactions = allTransactions.filter(txn => {
      const txnDate = new Date(txn.DateTime);
      if (start && txnDate < start) return false;
      if (end && txnDate > end) return false;
      return true;
    });

    // Process with running balance
    let runningBalance = openingBalance;
    let totalBilled = 0;
    let totalPaid = 0;

    const transactions = rangeTransactions.map(txn => {
      let debit = 0;
      let credit = 0;
      let description = '';

      if (txn.Type === 'Bill') {
        debit = txn.Amount;
        description = 'Purchase Bill #' + txn.Transaction_ID;
        totalBilled += debit;
        runningBalance += debit; // Bills increase amount owed
      } else if (txn.Type === 'Payment') {
        credit = txn.Amount;
        description = 'Payment Made' + (txn.Reference ? ' - Ref: ' + txn.Reference : '');
        totalPaid += credit;
        runningBalance -= credit; // Payments reduce amount owed
      }

      return {
        date: txn.DateTime,
        type: txn.Type,
        description: description,
        reference: txn.Transaction_ID,
        debit: debit,     // Amount billed
        credit: credit,   // Amount paid
        runningBalance: runningBalance
      };
    });

    const closingBalance = openingBalance + totalBilled - totalPaid;

    return {
      supplier: {
        Supplier_ID: supplier.Supplier_ID,
        Supplier_Name: supplier.Supplier_Name,
        Contact_Person: supplier.Contact_Person,
        Phone: supplier.Phone,
        Email: supplier.Email
      },
      openingBalance: openingBalance,
      totalBilled: totalBilled,
      totalPaid: totalPaid,
      closingBalance: closingBalance,
      outstandingAmount: closingBalance > 0 ? closingBalance : 0,
      transactionCount: transactions.length,
      transactions: transactions,
      period: {
        start: start ? start.toISOString() : 'Beginning',
        end: end ? end.toISOString() : 'Now'
      }
    };

  } catch (error) {
    logError('getSupplierStatement', error);
    throw new Error('Error generating supplier statement: ' + error.message);
  }
}
