/**
 * Smatika Kenya - Sales Management System
 * Configuration File
 */

const CONFIG = {
  // Shop Information
  SHOP_NAME: 'Smatika Kenya',
  ADMIN_EMAIL: 'cabdisirlam@gmail.com',

  // Workbook Configuration
  WORKBOOK_NAME: 'Smatika System',

  // Sheet Names - Reorganized to 9 sheets for simplified management
  SHEETS: {
    USERS: 'Users',
    SUPPLIERS: 'Suppliers',
    CUSTOMERS: 'Customers',
    INVENTORY: 'Inventory',
    SALES: 'Sales',
    PURCHASES: 'Purchases',
    FINANCIALS: 'Financials',
    QUOTATIONS: 'Quotations',
    PURCHASE_ORDERS: 'Purchase_Orders',
    CHART_OF_ACCOUNTS: 'Chart_of_Accounts',
    AUDIT_TRAIL: 'Audit_Trail',
    SETTINGS: 'Settings',
    MASTER_DATA: 'Master_Data'
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

  // Loyalty Points
  LOYALTY_POINTS_PER_SALE: 10, // 10 points per sale

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
