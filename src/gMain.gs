/**
 * Fatma Sales Management System
 * Main Entry Point
 */

/**
 * Runs when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Create custom menu
  ui.createMenu('🏪 Fatma System')
    .addItem('⚡ Setup Fatma System', 'setupFatmaSystem')
    .addSeparator()
    .addItem('📊 Dashboard', 'showDashboard')
    .addSeparator()
    .addItem('🛍️ New Sale', 'showNewSaleDialog')
    .addItem('📦 Manage Inventory', 'showInventoryManager')
    .addItem('👥 Manage Customers', 'showCustomersManager')
    .addItem('🏭 Manage Suppliers', 'showSuppliersManager')
    .addSeparator()
    .addItem('💰 Financials', 'showFinancials')
    .addItem('💳 Expenses', 'showExpenses')
    .addItem('📋 Quotations', 'showQuotations')
    .addSeparator()
    .addItem('👤 User Management', 'showUserManagement')
    .addItem('📈 View Reports', 'showReports')
    .addItem('⚙️ Settings', 'showSettings')
    .addToUi();
}

/**
 * Runs when the add-on is installed
 */
function onInstall() {
  onOpen();
  setupFatmaSystem();
}

/**
 * Show dashboard
 */
function showDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('mDashboard')
    .setTitle(CONFIG.SHOP_NAME + ' Dashboard')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, CONFIG.SHOP_NAME + ' Dashboard');
}

/**
 * Show new sale dialog
 */
function showNewSaleDialog() {
  const html = HtmlService.createHtmlOutputFromFile('oNewSale')
    .setTitle('New Sale')
    .setWidth(600)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'New Sale');
}

/**
 * Show products manager
 */
function showProductsManager() {
  const html = HtmlService.createHtmlOutputFromFile('pProducts')
    .setTitle('Manage Products')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Products');
}

/**
 * Show customers manager
 */
function showCustomersManager() {
  const html = HtmlService.createHtmlOutputFromFile('lCustomers')
    .setTitle('Manage Customers')
    .setWidth(700)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manage Customers');
}

/**
 * Show reports
 */
function showReports() {
  const html = HtmlService.createHtmlOutputFromFile('qReports')
    .setTitle('Reports')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Reports');
}

/**
 * Show inventory
 */
function showInventory() {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.INVENTORY);
  SpreadsheetApp.setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('Inventory', 'Showing inventory sheet', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Show settings
 */
function showSettings() {
  const html = HtmlService.createHtmlOutputFromFile('rSettings')
    .setTitle('Settings')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Settings');
}

/**
 * Get active user email
 */
function getActiveUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Check if user is admin
 */
function isAdmin() {
  const userEmail = getActiveUserEmail();
  return userEmail === CONFIG.ADMIN_EMAIL;
}
