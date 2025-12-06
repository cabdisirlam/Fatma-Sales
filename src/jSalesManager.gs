/**
 * Sales Manager - Handles reporting and history queries
 */

/**
 * Get overall sales metrics for dashboards
 */
function getSalesOverview() {
  try {
    const sales = sheetToObjects('Sales', null);
    const seenIds = new Set();

    let totalRevenue = 0;
    let creditCount = 0;
    let saleCount = 0;
    let todayRevenue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    sales.forEach(row => {
      const type = (row.Type || '').toString().trim().toLowerCase();
      if (type !== 'sale') return; // only count actual sales

      const txnId = row.Transaction_ID || '';
      if (txnId && seenIds.has(txnId)) return;
      if (txnId) seenIds.add(txnId);

      const total = parseFloat(row.Grand_Total) || 0;
      if (total <= 0) return;

      totalRevenue += total;
      saleCount += 1;

      const payMode = (row.Payment_Mode || '').toString().toLowerCase();
      if (payMode.includes('credit')) {
        creditCount += 1;
      }

      const saleDate = row.DateTime ? new Date(row.DateTime) : null;
      if (saleDate && !isNaN(saleDate.getTime())) {
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() === today.getTime()) {
          todayRevenue += total;
        }
      }
    });

    const averageOrder = saleCount === 0 ? 0 : totalRevenue / saleCount;

    return {
      totalRevenue,
      saleCount,
      creditCount,
      averageOrder,
      todayRevenue
    };
  } catch (error) {
    logError('getSalesOverview', error);
    throw new Error('Unable to load sales overview: ' + error.message);
  }
}

/**
 * Get recent sales transactions (unique by Transaction_ID) with enhanced filtering
 * @param {number} limit - Maximum number of records to return
 * @param {string} startDate - Start date filter (optional)
 * @param {string} endDate - End date filter (optional)
 * @param {string} customerName - Customer name filter (optional, partial match)
 * @returns {Array} Filtered sales transactions
 */
function getSalesHistory(limit, startDate, endDate, customerName) {
  try {
    const sales = sheetToObjects('Sales', null);
    const financials = sheetToObjects('Financials', null);
    const seenIds = new Set();
    const filtered = [];

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    // Prepare customer name filter (case-insensitive)
    const customerFilter = customerName ? customerName.toLowerCase().trim() : null;

    // Build payment map per Transaction_ID
    const paymentMap = {};
    financials.forEach(txn => {
      const type = txn.Type;
      if (type !== 'Sale_Payment' && type !== 'Customer_Payment') return;
      const ref = (txn.Reference || txn.Receipt_No || '').toString();
      if (!ref) return;
      const amt = parseFloat(txn.Amount) || parseFloat(txn.Credit) || 0;
      paymentMap[ref] = (paymentMap[ref] || 0) + amt;
    });

    for (const row of sales) {
      if (row.Type !== 'Sale') continue;
      if (seenIds.has(row.Transaction_ID)) continue;

      // Date filtering
      const saleDate = new Date(row.DateTime);
      if (start && saleDate < start) continue;
      if (end && saleDate > end) continue;

      // Customer name filtering (partial match)
      if (customerFilter) {
        const rowCustomerName = (row.Customer_Name || '').toLowerCase();
        if (!rowCustomerName.includes(customerFilter)) continue;
      }

      seenIds.add(row.Transaction_ID);
      const grandTotal = parseFloat(row.Grand_Total) || 0;
      const totalPaid = paymentMap[row.Transaction_ID] || 0;
      const balance = Math.max(0, grandTotal - totalPaid);
      filtered.push({
        Transaction_ID: row.Transaction_ID,
        DateTime: row.DateTime,
        Customer_ID: row.Customer_ID,
        Customer_Name: row.Customer_Name,
        Payment_Mode: row.Payment_Mode,
        Grand_Total: grandTotal,
        Total_Paid: totalPaid,
        Balance: balance,
        Status: row.Status || 'Completed',
        Delivery_Status: row.Delivery_Status || '',
        Type: row.Type,
        Location: row.Location,
        KRA_PIN: row.KRA_PIN
      });
    }

    // Sort by date descending (most recent first)
    filtered.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    // Apply limit
    return filtered.slice(0, limit || 50);
  } catch (error) {
    logError('getSalesHistory', error);
    throw new Error('Unable to load sales history: ' + error.message);
  }
}

/**
 * Get sales grouped by customer
 */
function getSalesByCustomer(customerId) {
  try {
    const history = getSalesHistory(null, null, null);
    if (!customerId) return history;
    return history.filter(sale => (sale.Customer_ID || '') === customerId || (sale.Customer_Name || '') === customerId);
  } catch (error) {
    logError('getSalesByCustomer', error);
    throw new Error('Unable to load customer sales: ' + error.message);
  }
}

/**
 * Get sales marked as returns
 */
function getSalesReturns() {
  try {
    const sales = sheetToObjects('Sales', null);
    const returns = [];

    for (const row of sales) {
      if (row.Status === 'Returned') {
        returns.push({
          Transaction_ID: row.Transaction_ID,
          DateTime: row.DateTime ? new Date(row.DateTime).toISOString() : null,
          Customer_Name: row.Customer_Name,
          Grand_Total: parseFloat(row.Grand_Total) || 0,
          Item_ID: row.Item_ID,
          Item_Name: row.Item_Name,
          Qty: row.Qty
        });
      }
    }

    returns.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));
    return returns;
  } catch (error) {
    logError('getSalesReturns', error);
    throw new Error('Unable to load sales returns: ' + error.message);
  }
}

/**
 * Lightweight sales report metrics
 */
function getSalesReport() {
  try {
    const overview = getSalesOverview();
    const last30 = getSalesHistory(null, new Date(Date.now() - (29 * 24 * 60 * 60 * 1000)), new Date());
    const revenue30 = last30.reduce((sum, sale) => sum + (parseFloat(sale.Grand_Total) || 0), 0);

    return {
      totalRevenue: overview.totalRevenue,
      totalSales: overview.saleCount,
      creditSales: overview.creditCount,
      averageOrder: overview.averageOrder,
      revenue30
    };
  } catch (error) {
    logError('getSalesReport', error);
    throw new Error('Unable to load sales report: ' + error.message);
  }
}

/**
 * Get recent transactions (Sales + Quotations) for Dashboard
 */
function getRecentTransactionsMixed() {
  try {
    const sales = sheetToObjects('Sales', null);
    const seenIds = new Set();
    const results = [];

    // Sort by date descending
    sales.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    for (const row of sales) {
      if (seenIds.has(row.Transaction_ID)) continue;
      seenIds.add(row.Transaction_ID);

      results.push({
        Transaction_ID: row.Transaction_ID,
        DateTime: row.DateTime,
        Customer_Name: row.Customer_Name,
        Grand_Total: row.Grand_Total,
        Type: row.Type, 
        Status: row.Status,
        Payment_Mode: row.Payment_Mode
      });

      if (results.length >= 15) break; 
    }
    return results;
  } catch (error) {
    logError('getRecentTransactionsMixed', error);
    return [];
  }
}

/**
 * Wrapper for frontend compatibility - getRecentSales
 * @param {number} limit - Maximum number of records
 * @param {string} startDate - Start date filter (optional)
 * @param {string} endDate - End date filter (optional)
 * @param {string} customerName - Customer name filter (optional)
 */
function getRecentSales(limit, startDate, endDate, customerName) {
  return getSalesHistory(limit || 50, startDate, endDate, customerName);
}
