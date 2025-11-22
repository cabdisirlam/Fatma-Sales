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
      if (row.Type !== 'Sale') return;
      if (seenIds.has(row.Transaction_ID)) return;
      seenIds.add(row.Transaction_ID);

      const total = parseFloat(row.Grand_Total) || 0;
      totalRevenue += total;
      saleCount += 1;

      if (row.Payment_Mode === 'Credit') {
        creditCount += 1;
      }

      const saleDate = new Date(row.DateTime);
      saleDate.setHours(0, 0, 0, 0);
      if (saleDate.getTime() === today.getTime()) {
        todayRevenue += total;
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
 * Get recent sales transactions (unique by Transaction_ID)
 */
function getSalesHistory(limit, startDate, endDate) {
  try {
    const sales = sheetToObjects('Sales', null);
    const seenIds = new Set();
    const filtered = [];

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    for (const row of sales) {
      if (row.Type !== 'Sale') continue;
      if (seenIds.has(row.Transaction_ID)) continue;

      const saleDate = new Date(row.DateTime);
      if (start && saleDate < start) continue;
      if (end && saleDate > end) continue;

      seenIds.add(row.Transaction_ID);
      filtered.push({
        Transaction_ID: row.Transaction_ID,
        DateTime: row.DateTime,
        Customer_Name: row.Customer_Name,
        Payment_Mode: row.Payment_Mode,
        Grand_Total: parseFloat(row.Grand_Total) || 0,
        Status: row.Status || 'Completed'
      });
    }

    filtered.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));
    return filtered.slice(0, limit || 25);
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
          DateTime: row.DateTime,
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
