/**
 * BeiPoa Sales Management System
 * Sales Manager
 */

/**
 * Generate unique Sale ID
 */
function generateSaleId() {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return 'SALE-' + timestamp + '-' + random;
}

/**
 * Add a new sale
 */
function addSale(saleData) {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.SALES);

    const saleId = generateSaleId();
    const date = new Date();
    const total = saleData.quantity * saleData.unitPrice;

    const row = [
      saleId,
      date,
      saleData.customerName || '',
      saleData.customerEmail || '',
      saleData.product || '',
      saleData.quantity || 0,
      saleData.unitPrice || 0,
      total,
      saleData.paymentMethod || 'Cash',
      'Completed',
      saleData.notes || ''
    ];

    sheet.appendRow(row);

    // Update inventory
    updateInventoryOnSale(saleData.product, saleData.quantity);

    return {
      success: true,
      saleId: saleId,
      message: 'Sale added successfully!'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error adding sale: ' + error.message
    };
  }
}

/**
 * Get all sales
 */
function getAllSales() {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.SALES);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const sales = [];

    for (let i = 1; i < data.length; i++) {
      const sale = {};
      for (let j = 0; j < headers.length; j++) {
        sale[headers[j]] = data[i][j];
      }
      sales.push(sale);
    }

    return sales;
  } catch (error) {
    Logger.log('Error getting sales: ' + error.message);
    return [];
  }
}

/**
 * Update inventory on sale
 */
function updateInventoryOnSale(productName, quantity) {
  try {
    const productsSheet = getOrCreateSheet(CONFIG.SHEETS.PRODUCTS);
    const inventorySheet = getOrCreateSheet(CONFIG.SHEETS.INVENTORY);

    const productsData = productsSheet.getDataRange().getValues();

    for (let i = 1; i < productsData.length; i++) {
      if (productsData[i][1] === productName) { // Product Name is column 2
        const currentStock = productsData[i][6] || 0; // Stock Quantity is column 7
        const newStock = currentStock - quantity;

        // Update Products sheet
        productsSheet.getRange(i + 1, 7).setValue(newStock);
        productsSheet.getRange(i + 1, 11).setValue(new Date()); // Last Updated

        // Update Inventory sheet
        updateInventorySheet();

        break;
      }
    }
  } catch (error) {
    Logger.log('Error updating inventory: ' + error.message);
  }
}

/**
 * Update inventory sheet with current stock levels
 */
function updateInventorySheet() {
  try {
    const productsSheet = getOrCreateSheet(CONFIG.SHEETS.PRODUCTS);
    const inventorySheet = getOrCreateSheet(CONFIG.SHEETS.INVENTORY);

    const productsData = productsSheet.getDataRange().getValues();

    // Clear inventory sheet except header
    if (inventorySheet.getLastRow() > 1) {
      inventorySheet.getRange(2, 1, inventorySheet.getLastRow() - 1, inventorySheet.getLastColumn()).clear();
    }

    // Populate inventory sheet
    for (let i = 1; i < productsData.length; i++) {
      const productId = productsData[i][0];
      const productName = productsData[i][1];
      const currentStock = productsData[i][6] || 0;
      const reorderLevel = productsData[i][7] || 10;
      const lastUpdated = productsData[i][10] || '';

      let status = 'In Stock';
      let reorderNeeded = 'No';

      if (currentStock <= 0) {
        status = 'Out of Stock';
        reorderNeeded = 'Yes';
      } else if (currentStock <= reorderLevel) {
        status = 'Low Stock';
        reorderNeeded = 'Yes';
      }

      const row = [
        productId,
        productName,
        currentStock,
        reorderLevel,
        status,
        lastUpdated,
        reorderNeeded
      ];

      inventorySheet.appendRow(row);
    }
  } catch (error) {
    Logger.log('Error updating inventory sheet: ' + error.message);
  }
}

/**
 * Add a new product
 */
function addProduct(productData) {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.PRODUCTS);

    const productId = 'PROD-' + new Date().getTime();

    const row = [
      productId,
      productData.name || '',
      productData.description || '',
      productData.category || '',
      productData.price || 0,
      productData.cost || 0,
      productData.stockQuantity || 0,
      productData.reorderLevel || 10,
      productData.supplier || '',
      'Active',
      new Date()
    ];

    sheet.appendRow(row);

    // Update inventory sheet
    updateInventorySheet();

    return {
      success: true,
      productId: productId,
      message: 'Product added successfully!'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error adding product: ' + error.message
    };
  }
}

/**
 * Get all products
 */
function getAllProducts() {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.PRODUCTS);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const products = [];

    for (let i = 1; i < data.length; i++) {
      const product = {};
      for (let j = 0; j < headers.length; j++) {
        product[headers[j]] = data[i][j];
      }
      products.push(product);
    }

    return products;
  } catch (error) {
    Logger.log('Error getting products: ' + error.message);
    return [];
  }
}

/**
 * Add a new customer
 */
function addCustomer(customerData) {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.CUSTOMERS);

    const customerId = 'CUST-' + new Date().getTime();

    const row = [
      customerId,
      customerData.name || '',
      customerData.email || '',
      customerData.phone || '',
      customerData.address || '',
      customerData.city || '',
      0, // Total Purchases
      '', // Last Purchase Date
      'Active',
      customerData.notes || ''
    ];

    sheet.appendRow(row);

    return {
      success: true,
      customerId: customerId,
      message: 'Customer added successfully!'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error adding customer: ' + error.message
    };
  }
}

/**
 * Get all customers
 */
function getAllCustomers() {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.CUSTOMERS);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const customers = [];

    for (let i = 1; i < data.length; i++) {
      const customer = {};
      for (let j = 0; j < headers.length; j++) {
        customer[headers[j]] = data[i][j];
      }
      customers.push(customer);
    }

    return customers;
  } catch (error) {
    Logger.log('Error getting customers: ' + error.message);
    return [];
  }
}

/**
 * Get sales summary
 */
function getSalesSummary() {
  try {
    const sales = getAllSales();

    let totalSales = 0;
    let totalRevenue = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todaySales = 0;
    let todayRevenue = 0;

    sales.forEach(sale => {
      const saleDate = new Date(sale['Date']);
      const total = parseFloat(sale['Total']) || 0;

      totalRevenue += total;
      totalSales++;

      if (saleDate >= today) {
        todayRevenue += total;
        todaySales++;
      }
    });

    return {
      totalSales: totalSales,
      totalRevenue: totalRevenue,
      todaySales: todaySales,
      todayRevenue: todayRevenue,
      averageSale: totalSales > 0 ? totalRevenue / totalSales : 0
    };
  } catch (error) {
    Logger.log('Error getting sales summary: ' + error.message);
    return {
      totalSales: 0,
      totalRevenue: 0,
      todaySales: 0,
      todayRevenue: 0,
      averageSale: 0
    };
  }
}
