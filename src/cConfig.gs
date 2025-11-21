/**
 * BeiPoa Sales Management System
 * Configuration File
 */

const CONFIG = {
  // Shop Information
  SHOP_NAME: 'BeiPoa',
  ADMIN_EMAIL: 'cabdisirlam@gmail.com',

  // Workbook Configuration
  WORKBOOK_NAME: 'BeiPoa Sales Management',

  // Sheet Names
  SHEETS: {
    SALES: 'Sales',
    PRODUCTS: 'Products',
    CUSTOMERS: 'Customers',
    INVENTORY: 'Inventory',
    REPORTS: 'Reports',
    SETTINGS: 'Settings'
  },

  // Colors (BeiPoa Brand Colors)
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
  CURRENCY: 'USD',
  CURRENCY_SYMBOL: '$'
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
