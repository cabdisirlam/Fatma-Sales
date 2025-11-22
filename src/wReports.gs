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
