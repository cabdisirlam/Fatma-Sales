/**
 * Beipoa Kenya - Sales Management System
 * Configuration File
 */

const CONFIG = {
  // Shop Information
  SHOP_NAME: 'Beipoa Kenya',
  ADMIN_EMAIL: 'cabdisirlam@gmail.com',

  // Workbook Configuration
  WORKBOOK_NAME: 'Beipoa System',

  // Sheet Names - Reorganized to 9 sheets for simplified management
  SHEETS: {
    USERS: 'Users',
    SUPPLIERS: 'Suppliers',
    CUSTOMERS: 'Customers',
    INVENTORY: 'Inventory',
    SALES: 'Sales',              // Merged: Sales_Data + Sales_Items + Quotations + Quotation_Items
    PURCHASES: 'Purchases',      // Merged: Purchases + Purchase_Items
    FINANCIALS: 'Financials',    // Merged: Customer_Transactions + Financials + Expenses
    AUDIT_TRAIL: 'Audit_Trail',
    SETTINGS: 'Settings'         // Now includes Expense_Categories as settings
  },

  // Colors (Brand Colors)
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
  CURRENCY_SYMBOL: 'Ksh',

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
