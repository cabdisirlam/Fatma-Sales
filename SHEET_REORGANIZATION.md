# Sheet Reorganization - Version 2.0

## Overview

The Fatma Sales Management System has been reorganized from **16 sheets to 9 sheets** for simplified management and reduced complexity. This reorganization consolidates related data while maintaining all functionality.

## New Sheet Structure (9 Sheets)

### 1. **Users**
- User authentication and management
- No changes from previous version
- **Columns**: User_ID, Username, PIN, Role, Email, Phone, Status, Created_Date

### 2. **Suppliers**
- Supplier information and balances
- No changes from previous version
- **Columns**: Supplier_ID, Supplier_Name, Contact_Person, Phone, Email, Address, Total_Purchased, Total_Paid, Current_Balance, Payment_Terms, Status

### 3. **Customers**
- Customer database with credit tracking
- No changes from previous version
- **Columns**: Customer_ID, Customer_Name, Phone, Email, Location, KRA_PIN, Customer_Type, Credit_Limit, Current_Balance, Total_Purchases, Last_Purchase_Date, Loyalty_Points, Status, Created_Date, Created_By

### 4. **Inventory**
- Product inventory management
- No changes from previous version
- **Columns**: Item_ID, Item_Name, Category, Cost_Price, Selling_Price, Current_Qty, Reorder_Level, Supplier, Last_Updated, Updated_By

### 5. **Sales** ⭐ NEW MERGED SHEET
**Consolidates**: Sales_Data + Sales_Items + Quotations + Quotation_Items

- **Structure**: Each row represents a line item from a sale or quotation
- **Type field**: Distinguishes between "Sale" and "Quotation"
- **Columns**: Transaction_ID, DateTime, Type, Customer_ID, Customer_Name, Item_ID, Item_Name, Qty, Unit_Price, Line_Total, Subtotal, Delivery_Charge, Discount, Grand_Total, Payment_Mode, Sold_By, Location, KRA_PIN, Status, Valid_Until, Converted_Sale_ID

**Benefits**:
- Single sheet for all sales-related transactions
- Easier to query and analyze
- Reduced sheet count
- Quotations can be converted to sales seamlessly

### 6. **Purchases** ⭐ NEW MERGED SHEET
**Consolidates**: Purchases + Purchase_Items

- **Structure**: Each row represents a line item from a purchase order
- **Columns**: Purchase_ID, Date, Supplier_ID, Supplier_Name, Item_ID, Item_Name, Qty, Cost_Price, Line_Total, Total_Amount, Payment_Status, Payment_Method, Paid_Amount, Balance, Recorded_By

**Benefits**:
- All purchase information in one place
- Simplified purchase tracking
- Easier inventory updates

### 7. **Financials** ⭐ NEW MERGED SHEET
**Consolidates**: Customer_Transactions + Financials + Expenses + Expense_Categories

- **Structure**: Universal transaction sheet for all financial movements
- **Type field**: Customer_Payment, Cash_In, Cash_Out, Bank, M-PESA, Expense
- **Columns**: Transaction_ID, DateTime, Type, Customer_ID, Category, Account, Description, Amount, Debit, Credit, Balance, Payment_Method, Payee, Receipt_No, Reference, Status, Approved_By, User

**Benefits**:
- Complete financial audit trail in one sheet
- All money movements tracked centrally
- Easier reconciliation and reporting

**Note**: Expense categories are now stored in the Settings sheet as configuration values (Expense_Category_[Name])

### 8. **Audit_Trail**
- System audit logging
- No changes from previous version
- **Columns**: Timestamp, User, Module, Action, Details, Session_ID, Before_Value, After_Value

### 9. **Settings**
- System configuration and expense categories
- **Enhanced**: Now includes expense category definitions
- **Columns**: Setting_Key, Setting_Value

**New Expense Category Settings**:
- Expense_Category_Rent
- Expense_Category_Utilities
- Expense_Category_Salaries
- Expense_Category_Marketing
- Expense_Category_Supplies
- Expense_Category_Transport
- Expense_Category_Maintenance
- Expense_Category_Other

## Migration Path

### For Fresh Installations
1. Run `createFatmaSystem()` from kWorkbookManager.gs
2. The new 9-sheet structure will be created automatically
3. All sheets will be properly formatted and initialized

### For Existing Installations ⭐ USE THIS

**IMPORTANT**: This reorganization will delete old sheets. Your Users sheet will be preserved.

#### Step-by-Step Instructions:

1. **Backup your data first!**
   - File → Make a copy (save it as "Fatma System - Backup")
   - Or download as Excel/CSV files

2. **Open the Script Editor**
   - In your Google Sheet: Extensions → Apps Script

3. **Run the reorganization function**
   - In the Script Editor, find the file: `kWorkbookManager.gs`
   - Locate the function: `reorganizeExistingSheetsToV2()`
   - Click the "Run" button (▶️) at the top
   - Authorize the script if prompted

4. **Confirm the reorganization**
   - A dialog will appear showing what will be kept/deleted
   - Click "Yes" to proceed
   - The script will:
     - ✅ Keep your Users sheet (with existing data)
     - ✅ Keep Suppliers, Customers, Inventory (if they have data)
     - ✅ Create new Sales, Purchases, Financials sheets
     - ❌ Delete old sheets: Sales_Data, Sales_Items, Purchase_Items, Quotations, Quotation_Items, Customer_Transactions, Expenses, Expense_Categories

5. **Verify the results**
   - You should now have exactly 9 sheets
   - Your Users data is preserved
   - New empty sheets are ready for data

6. **What happens to old data?**
   - Users sheet: **Data preserved**
   - Suppliers, Customers, Inventory: **Preserved if they have data**
   - All other sheets: **Deleted** (that's why backup is important!)

#### After Reorganization

The new sheets (Sales, Purchases, Financials) will be **empty**. You'll need to:
- Start fresh with new data, OR
- Manually migrate data from your backup if needed

## Code Changes

### Updated Functions

1. **getTodaySales()**: Now handles line items and deduplicates by Transaction_ID
2. **getTodayExpenses()**: Now queries Financials sheet with Type='Expense'
3. **getRecentSales()**: Deduplicates line items for display
4. **getSheetHeaders()**: Updated to reflect new sheet structures
5. **initializeAllSheets()**: Creates 9 sheets instead of 16
6. **checkSystemHealth()**: Validates 9 required sheets

### Removed Functions
- **createSalesDataSheet()**: Replaced by createSalesSheet()
- **createSalesItemsSheet()**: Merged into createSalesSheet()
- **createPurchaseItemsSheet()**: Merged into createPurchasesSheet()
- **createQuotationsSheet()**: Merged into createSalesSheet()
- **createQuotationItemsSheet()**: Merged into createSalesSheet()
- **createCustomerTransactionsSheet()**: Merged into createFinancialsSheet()
- **createExpensesSheet()**: Merged into createFinancialsSheet()
- **createExpenseCategoriesSheet()**: Now part of createSettingsSheet()

### Configuration Changes

**cConfig.gs**: Updated CONFIG.SHEETS object to include only 9 sheets:
```javascript
SHEETS: {
  USERS: 'Users',
  SUPPLIERS: 'Suppliers',
  CUSTOMERS: 'Customers',
  INVENTORY: 'Inventory',
  SALES: 'Sales',              // Merged
  PURCHASES: 'Purchases',      // Merged
  FINANCIALS: 'Financials',    // Merged
  AUDIT_TRAIL: 'Audit_Trail',
  SETTINGS: 'Settings'
}
```

## Benefits of Reorganization

1. **Reduced Complexity**: 44% fewer sheets (16 → 9)
2. **Easier Navigation**: Users see fewer tabs
3. **Simplified Queries**: Related data in single sheets
4. **Better Performance**: Fewer sheet references in formulas
5. **Logical Grouping**: Line items with their headers
6. **Unified Financials**: All money movements in one place
7. **Easier Reporting**: Less JOIN operations needed

## Query Examples

### Get today's sales total (handles line items)
```javascript
const sales = sheetToObjects('Sales', null);
const uniqueSales = sales.filter((s, i, arr) =>
  s.Type === 'Sale' &&
  arr.findIndex(x => x.Transaction_ID === s.Transaction_ID) === i
);
```

### Get all expenses for a date range
```javascript
const financials = sheetToObjects('Financials', null);
const expenses = financials.filter(f =>
  f.Type === 'Expense' &&
  f.DateTime >= startDate &&
  f.DateTime <= endDate
);
```

### Get items from a specific purchase
```javascript
const purchases = sheetToObjects('Purchases', null);
const purchaseItems = purchases.filter(p => p.Purchase_ID === 'PO-12345');
```

## Version History

- **v1.0**: Original 16-sheet structure
- **v2.0**: Reorganized to 9-sheet structure (current)

## Support

For issues or questions about the reorganization, contact:
- Email: cabdisirlam@gmail.com
- GitHub: https://github.com/cabdisirlam/Fatma-Sales

---

**Last Updated**: 2025-11-22
**System Version**: 2.0.0
