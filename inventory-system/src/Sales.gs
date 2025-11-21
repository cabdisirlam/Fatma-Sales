/**
 * SALES MANAGEMENT MODULE
 * Handles: Sales Processing, Receipt Generation, Sales Reports
 */

// =====================================================
// SALES PROCESSING
// =====================================================

/**
 * Creates a new sale
 * @param {Object} saleData - Sale information including items, customer, payment
 * @returns {Object} Result with success status and sale ID
 */
function createSale(saleData) {
  try {
    // Validate required fields
    validateRequired(saleData, ['Items', 'Payment_Mode', 'Sold_By']);

    if (!saleData.Items || saleData.Items.length === 0) {
      throw new Error('No items in sale');
    }

    // Generate Sale ID
    const saleId = generateId('Sales_Data', 'Sale_ID', 'INV');

    // Calculate totals
    const subtotal = saleData.Items.reduce((sum, item) => sum + (item.Unit_Price * item.qty), 0);
    const deliveryCharge = parseFloat(saleData.Delivery_Charge) || 0;
    const discount = parseFloat(saleData.Discount) || 0;
    const grandTotal = subtotal + deliveryCharge - discount;

    // Validate stock availability
    for (let item of saleData.Items) {
      const product = findRowById('Inventory', 'Item_ID', item.Item_ID);
      if (!product) {
        throw new Error('Product not found: ' + item.Item_ID);
      }
      if (product.Current_Qty < item.qty) {
        throw new Error('Insufficient stock for: ' + item.Item_Name + '. Available: ' + product.Current_Qty);
      }
    }

    // Check credit limit if credit sale
    if (saleData.Payment_Mode === 'Credit') {
      if (!saleData.Customer_ID) {
        throw new Error('Customer required for credit sales');
      }

      const customer = findRowById('Customers', 'Customer_ID', saleData.Customer_ID);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const newBalance = parseFloat(customer.Current_Balance) + grandTotal;
      if (newBalance > parseFloat(customer.Credit_Limit)) {
        throw new Error('Credit limit exceeded. Available credit: ' + (customer.Credit_Limit - customer.Current_Balance));
      }
    }

    // Get customer details
    let customerId = saleData.Customer_ID || '';
    let customerName = saleData.Customer_Name || 'Walk-in Customer';
    let customerLocation = '';
    let customerKRA = '';

    if (customerId) {
      const customer = findRowById('Customers', 'Customer_ID', customerId);
      if (customer) {
        customerLocation = customer.Location || '';
        customerKRA = customer.KRA_PIN || '';
      }
    }

    // Insert sale header
    const salesSheet = getSheet('Sales_Data');
    const saleRow = [
      saleId,
      new Date(),
      customerId,
      customerName,
      subtotal,
      deliveryCharge,
      discount,
      grandTotal,
      saleData.Payment_Mode,
      saleData.Sold_By,
      customerLocation,
      customerKRA,
      'Completed'
    ];
    salesSheet.appendRow(saleRow);

    // Insert sale items
    const itemsSheet = getSheet('Sales_Items');
    saleData.Items.forEach(item => {
      const lineTotal = item.Unit_Price * item.qty;
      itemsSheet.appendRow([
        saleId,
        item.Item_ID,
        item.Item_Name,
        item.qty,
        item.Unit_Price,
        lineTotal
      ]);

      // Deduct from inventory
      deductInventory(item.Item_ID, item.qty, saleData.Sold_By);
    });

    // Record financial transaction
    recordSaleTransaction(saleId, grandTotal, saleData.Payment_Mode, saleData.Sold_By);

    // Update customer data if applicable
    if (customerId) {
      updateCustomerAfterSale(customerId, grandTotal, saleData.Payment_Mode, saleId);
    }

    // Log audit trail
    logAudit(
      saleData.Sold_By,
      'Sales',
      'Create Sale',
      'Sale created: ' + saleId + ' - Amount: ' + grandTotal,
      saleData.Session_ID || '',
      '',
      JSON.stringify(saleRow)
    );

    return {
      success: true,
      saleId: saleId,
      message: 'Sale created successfully'
    };

  } catch (error) {
    logError('createSale', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Deducts quantity from inventory
 */
function deductInventory(itemId, qty, user) {
  try {
    const inventorySheet = getSheet('Inventory');
    const data = inventorySheet.getDataRange().getValues();
    const headers = data[0];

    const idCol = headers.indexOf('Item_ID');
    const qtyCol = headers.indexOf('Current_Qty');
    const updatedCol = headers.indexOf('Last_Updated');
    const updatedByCol = headers.indexOf('Updated_By');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === itemId) {
        const currentQty = parseFloat(data[i][qtyCol]) || 0;
        const newQty = currentQty - qty;

        inventorySheet.getRange(i + 1, qtyCol + 1).setValue(newQty);
        inventorySheet.getRange(i + 1, updatedCol + 1).setValue(new Date());
        inventorySheet.getRange(i + 1, updatedByCol + 1).setValue(user);

        return;
      }
    }

  } catch (error) {
    logError('deductInventory', error);
    throw error;
  }
}

/**
 * Records financial transaction for sale
 */
function recordSaleTransaction(saleId, amount, paymentMode, user) {
  try {
    // Determine account based on payment mode
    let account = 'Cash';
    if (paymentMode === 'MPESA') {
      account = 'MPESA';
    } else if (paymentMode === 'Bank') {
      account = 'Equity Bank';
    } else if (paymentMode === 'Credit') {
      // Credit sales don't immediately affect cash accounts
      // They're recorded in customer balance
      return;
    }

    // Get current balance
    const currentBalance = getAccountBalance(account);
    const newBalance = currentBalance + amount;

    // Record transaction
    const financialsSheet = getSheet('Financials');
    financialsSheet.appendRow([
      new Date(),
      saleId,
      'Sale',
      account,
      'Sale payment received',
      0, // Debit
      amount, // Credit
      newBalance,
      user,
      saleId
    ]);

  } catch (error) {
    logError('recordSaleTransaction', error);
    throw error;
  }
}

/**
 * Updates customer data after sale
 */
function updateCustomerAfterSale(customerId, amount, paymentMode, saleId) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) return;

    const currentBalance = parseFloat(customer.Current_Balance) || 0;
    const totalPurchases = parseFloat(customer.Total_Purchases) || 0;
    const loyaltyPoints = parseFloat(customer.Loyalty_Points) || 0;

    // Update balance if credit sale
    let newBalance = currentBalance;
    if (paymentMode === 'Credit') {
      newBalance = currentBalance + amount;
    }

    // Update total purchases
    const newTotalPurchases = totalPurchases + amount;

    // Calculate loyalty points (1 point per 100 KES)
    const pointsEarned = Math.floor(amount / 100);
    const newLoyaltyPoints = loyaltyPoints + pointsEarned;

    // Update customer
    const updates = {
      Current_Balance: newBalance,
      Total_Purchases: newTotalPurchases,
      Last_Purchase_Date: new Date(),
      Loyalty_Points: newLoyaltyPoints
    };

    updateRowById('Customers', 'Customer_ID', customerId, updates);

    // Record transaction in Customer_Transactions
    if (paymentMode === 'Credit') {
      const transId = generateId('Customer_Transactions', 'Transaction_ID', 'CTRANS');
      const transSheet = getSheet('Customer_Transactions');
      transSheet.appendRow([
        transId,
        customerId,
        new Date(),
        'Sale',
        saleId,
        amount,
        newBalance,
        'Credit sale',
        customer.Created_By || 'SYSTEM'
      ]);
    }

  } catch (error) {
    logError('updateCustomerAfterSale', error);
    throw error;
  }
}

// =====================================================
// RECEIPT GENERATION
// =====================================================

/**
 * Generates a printable receipt for a sale
 * @param {String} saleId - Sale ID
 * @returns {String} HTML receipt
 */
function generateReceipt(saleId) {
  try {
    // Get sale data
    const sale = findRowById('Sales_Data', 'Sale_ID', saleId);
    if (!sale) {
      throw new Error('Sale not found: ' + saleId);
    }

    // Get sale items
    const items = sheetToObjects('Sales_Items', { Sale_ID: saleId });

    // Get business settings
    const businessName = getSettingValue('BUSINESS_NAME') || 'Your Business Name';
    const businessKRA = getSettingValue('BUSINESS_KRA') || 'P000000000A';
    const businessLocation = getSettingValue('BUSINESS_LOCATION') || 'Nairobi, Kenya';
    const businessPhone = getSettingValue('BUSINESS_PHONE') || '+254 700 000000';

    // Build receipt HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Receipt ${saleId}</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            margin: 0 auto;
            padding: 10mm;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
        }
        .business-name {
            font-size: 20px;
            font-weight: bold;
        }
        .info {
            font-size: 12px;
        }
        .section {
            margin: 15px 0;
        }
        .items {
            width: 100%;
            margin: 15px 0;
        }
        .item-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
        .totals {
            border-top: 1px solid #000;
            padding-top: 10px;
            margin-top: 10px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
        .grand-total {
            font-size: 16px;
            font-weight: bold;
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-top: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            border-top: 2px dashed #000;
            padding-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="business-name">${businessName}</div>
        <div class="info">KRA PIN: ${businessKRA}</div>
        <div class="info">${businessLocation}</div>
        <div class="info">Tel: ${businessPhone}</div>
    </div>

    <div class="section">
        <div><strong>SALES RECEIPT</strong></div>
        <div>Receipt No: ${saleId}</div>
        <div>Date: ${formatDateTime(sale.DateTime)}</div>
    </div>

    <div class="section">
        <div><strong>Customer Details</strong></div>
        <div>Name: ${sale.Customer_Name}</div>
        ${sale.Location ? '<div>Location: ' + sale.Location + '</div>' : ''}
        ${sale.KRA_PIN ? '<div>KRA PIN: ' + sale.KRA_PIN + '</div>' : ''}
    </div>

    <div class="section">
        <div><strong>Items</strong></div>
        <div style="border-bottom: 1px solid #000; margin: 5px 0;"></div>
`;

    // Add items
    items.forEach(item => {
      html += `
        <div class="item-row">
            <div>${item.Item_Name}</div>
            <div></div>
        </div>
        <div class="item-row">
            <div style="margin-left: 10px;">${item.Qty} x ${formatCurrency(item.Unit_Price)}</div>
            <div>${formatCurrency(item.Line_Total)}</div>
        </div>
`;
    });

    html += `
        <div style="border-bottom: 1px solid #000; margin: 5px 0;"></div>
    </div>

    <div class="totals">
        <div class="total-row">
            <div>Subtotal:</div>
            <div>${formatCurrency(sale.Subtotal)}</div>
        </div>
        ${sale.Delivery_Charge > 0 ? `
        <div class="total-row">
            <div>Delivery:</div>
            <div>${formatCurrency(sale.Delivery_Charge)}</div>
        </div>
        ` : ''}
        ${sale.Discount > 0 ? `
        <div class="total-row">
            <div>Discount:</div>
            <div>(${formatCurrency(sale.Discount)})</div>
        </div>
        ` : ''}
        <div class="total-row grand-total">
            <div>TOTAL:</div>
            <div>${formatCurrency(sale.Grand_Total)}</div>
        </div>
    </div>

    <div class="section">
        <div>Payment Method: ${sale.Payment_Mode}</div>
        <div>Served by: ${sale.Sold_By}</div>
    </div>

    <div class="footer">
        <div><strong>Thank You for Your Business!</strong></div>
        <div>Goods once sold are not returnable</div>
    </div>
</body>
</html>
`;

    return html;

  } catch (error) {
    logError('generateReceipt', error);
    throw new Error('Error generating receipt: ' + error.message);
  }
}

/**
 * Formats date and time for receipt
 */
function formatDateTime(dateValue) {
  try {
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return dateValue;
  }
}

// =====================================================
// SALES QUERIES
// =====================================================

/**
 * Gets sales with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of sales
 */
function getSales(filters) {
  try {
    return sheetToObjects('Sales_Data', filters);
  } catch (error) {
    logError('getSales', error);
    throw new Error('Error loading sales: ' + error.message);
  }
}

/**
 * Gets a single sale by ID
 * @param {String} saleId - Sale ID
 * @returns {Object} Sale data with items
 */
function getSaleById(saleId) {
  try {
    const sale = findRowById('Sales_Data', 'Sale_ID', saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    // Get items
    const items = sheetToObjects('Sales_Items', { Sale_ID: saleId });
    sale.Items = items;

    return sale;

  } catch (error) {
    logError('getSaleById', error);
    throw new Error('Error loading sale: ' + error.message);
  }
}

// =====================================================
// SALES REPORTS
// =====================================================

/**
 * Gets sales report for a date range
 * @param {Object} dateRange - Start and end dates
 * @returns {Object} Sales report data
 */
function getSalesReport(dateRange) {
  try {
    const sheet = getSheet('Sales_Data');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        totalSales: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        paymentMethods: {},
        topCustomers: [],
        dailyBreakdown: []
      };
    }

    const headers = data[0];
    const dateCol = headers.indexOf('DateTime');
    const totalCol = headers.indexOf('Grand_Total');
    const customerCol = headers.indexOf('Customer_Name');
    const paymentCol = headers.indexOf('Payment_Mode');

    let totalSales = 0;
    let totalRevenue = 0;
    const paymentMethods = {};
    const customerSales = {};
    const dailySales = {};

    const startDate = dateRange && dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange && dateRange.end ? new Date(dateRange.end) : null;

    for (let i = 1; i < data.length; i++) {
      const saleDate = new Date(data[i][dateCol]);

      // Filter by date range if provided
      if (startDate && saleDate < startDate) continue;
      if (endDate && saleDate > endDate) continue;

      const amount = parseFloat(data[i][totalCol]) || 0;
      const customer = data[i][customerCol];
      const payment = data[i][paymentCol];

      totalSales++;
      totalRevenue += amount;

      // Payment methods
      paymentMethods[payment] = (paymentMethods[payment] || 0) + amount;

      // Customer sales
      customerSales[customer] = (customerSales[customer] || 0) + amount;

      // Daily breakdown
      const dateKey = saleDate.toISOString().split('T')[0];
      if (!dailySales[dateKey]) {
        dailySales[dateKey] = { date: dateKey, sales: 0, revenue: 0 };
      }
      dailySales[dateKey].sales++;
      dailySales[dateKey].revenue += amount;
    }

    // Calculate average
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Top customers
    const topCustomers = Object.keys(customerSales)
      .map(name => ({ name: name, total: customerSales[name] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Daily breakdown array
    const dailyBreakdown = Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSales: totalSales,
      totalRevenue: totalRevenue,
      averageOrderValue: averageOrderValue,
      paymentMethods: paymentMethods,
      topCustomers: topCustomers,
      dailyBreakdown: dailyBreakdown
    };

  } catch (error) {
    logError('getSalesReport', error);
    throw new Error('Error generating sales report: ' + error.message);
  }
}

/**
 * Gets top selling products
 * @param {Number} limit - Number of products to return
 * @returns {Array} Top selling products
 */
function getTopSellingProducts(limit) {
  try {
    const sheet = getSheet('Sales_Items');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return [];

    const headers = data[0];
    const itemNameCol = headers.indexOf('Item_Name');
    const qtyCol = headers.indexOf('Qty');
    const totalCol = headers.indexOf('Line_Total');

    const productSales = {};

    for (let i = 1; i < data.length; i++) {
      const name = data[i][itemNameCol];
      const qty = parseFloat(data[i][qtyCol]) || 0;
      const total = parseFloat(data[i][totalCol]) || 0;

      if (!productSales[name]) {
        productSales[name] = { name: name, quantity: 0, revenue: 0 };
      }

      productSales[name].quantity += qty;
      productSales[name].revenue += total;
    }

    // Convert to array and sort
    const products = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit || 10);

    return products;

  } catch (error) {
    logError('getTopSellingProducts', error);
    return [];
  }
}

/**
 * Gets sales by user (staff performance)
 * @param {Object} dateRange - Start and end dates
 * @returns {Array} Sales by user
 */
function getSalesByUser(dateRange) {
  try {
    const sheet = getSheet('Sales_Data');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return [];

    const headers = data[0];
    const dateCol = headers.indexOf('DateTime');
    const userCol = headers.indexOf('Sold_By');
    const totalCol = headers.indexOf('Grand_Total');

    const userSales = {};

    const startDate = dateRange && dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange && dateRange.end ? new Date(dateRange.end) : null;

    for (let i = 1; i < data.length; i++) {
      const saleDate = new Date(data[i][dateCol]);

      // Filter by date range if provided
      if (startDate && saleDate < startDate) continue;
      if (endDate && saleDate > endDate) continue;

      const user = data[i][userCol];
      const amount = parseFloat(data[i][totalCol]) || 0;

      if (!userSales[user]) {
        userSales[user] = { user: user, sales: 0, revenue: 0 };
      }

      userSales[user].sales++;
      userSales[user].revenue += amount;
    }

    // Convert to array and sort
    return Object.values(userSales).sort((a, b) => b.revenue - a.revenue);

  } catch (error) {
    logError('getSalesByUser', error);
    return [];
  }
}
