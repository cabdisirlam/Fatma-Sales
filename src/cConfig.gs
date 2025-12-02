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

  // ⚠️ SECURITY: Spreadsheet ID
  // NOTE: If sharing this code publicly, move this to a separate config file
  // and add that file to .gitignore to prevent exposure
  SPREADSHEET_ID: '1m_IHBaz4PJZOo2sy5w4s27XQilQqGsFveMDRWt7tP-w',

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
  LOYALTY_POINTS_PER_SALE: 50, // 50 points per sale

  // Authentication
  PIN_LENGTH: 4,
  USE_TOKEN_AUTH: true,
  SESSION_TIMEOUT_HOURS: 8, // Token expiry time
  MAX_LOGIN_ATTEMPTS: 5, // Lock account after 5 failed attempts
  LOCKOUT_DURATION_MINUTES: 15, // How long to lock account

  // Security Settings
  ALLOW_IFRAME_EMBEDDING: false, // Set to true only if you need iframe embedding
  ENABLE_RATE_LIMITING: true
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
