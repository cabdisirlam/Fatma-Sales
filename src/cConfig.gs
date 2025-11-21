/**
 * BeiPoa Sales Management System
 * Configuration File
 */

const CONFIG = {
  // Shop Information
  SHOP_NAME: 'Fatma Sales',
  ADMIN_EMAIL: 'cabdisirlam@gmail.com',

  // Workbook Configuration
  WORKBOOK_NAME: 'Fatma System',

  // Sheet Names
  SHEETS: {
    USERS: 'Users',
    SUPPLIERS: 'Suppliers',
    CUSTOMERS: 'Customers',
    INVENTORY: 'Inventory',
    SALES_DATA: 'Sales_Data',
    SALES_ITEMS: 'Sales_Items',
    PURCHASES: 'Purchases',
    PURCHASE_ITEMS: 'Purchase_Items',
    QUOTATIONS: 'Quotations',
    QUOTATION_ITEMS: 'Quotation_Items',
    CUSTOMER_TRANSACTIONS: 'Customer_Transactions',
    FINANCIALS: 'Financials',
    EXPENSES: 'Expenses',
    EXPENSE_CATEGORIES: 'Expense_Categories',
    AUDIT_TRAIL: 'Audit_Trail',
    SETTINGS: 'Settings'
  },

  // Colors (Fatma Brand Colors)
  COLORS: {
    PRIMARY: '#4A90E2',
    SECONDARY: '#50C878',
    ACCENT: '#F5A623',
    HEADER: '#2C3E50',
    TEXT: '#34495E'
  },

  // Date Format
  DATE_FORMAT: 'yyyy-MM-dd HH:mm:ss',

  // Currency
  CURRENCY: 'KES',
  CURRENCY_SYMBOL: 'KES',

  // Authentication
  PIN_LENGTH: 4,
  USE_TOKEN_AUTH: true
};

/**
 * Get configuration value
 */
function getConfig(key) {
  return CONFIG[key];
}

/**
 * Get sheet name
 */
function getSheetName(sheetKey) {
  return CONFIG.SHEETS[sheetKey];
}
