# How to Reorganize Your Existing Workbook to 9 Sheets

## Quick Start Guide

### ⚠️ BEFORE YOU START

**BACKUP YOUR DATA!** This will delete old sheets.
- File → Make a copy (name it "Fatma System - Backup")

### Steps to Reorganize

1. **Open Google Sheets Apps Script**
   - In your spreadsheet: Extensions → Apps Script

2. **Find the reorganization function**
   - Open file: `kWorkbookManager.gs`
   - Find function: `reorganizeExistingSheetsToV2()`

3. **Run the function**
   - Click Run (▶️) button
   - Authorize if prompted
   - Confirm when dialog appears

4. **Done!**
   - You now have 9 sheets instead of 16
   - Your Users data is preserved
   - Ready to start fresh

### What Gets Kept?

✅ **Users** - Your user data is preserved
✅ **Suppliers** - Kept if has data
✅ **Customers** - Kept if has data
✅ **Inventory** - Kept if has data
✅ **Audit_Trail** - Kept if has data

### What Gets Created?

🆕 **Sales** - New merged sheet (empty)
🆕 **Purchases** - New merged sheet (empty)
🆕 **Financials** - New merged sheet (empty)
🆕 **Settings** - Recreated with expense categories

### What Gets Deleted?

❌ Sales_Data
❌ Sales_Items
❌ Purchase_Items
❌ Quotations
❌ Quotation_Items
❌ Customer_Transactions
❌ Expenses
❌ Expense_Categories

### New Sheet Structure

**Sales Sheet** - Each row = one item sold or quoted
- Columns: Transaction_ID, DateTime, Type, Customer_ID, Customer_Name, Item_ID, Item_Name, Qty, Unit_Price, Line_Total, Subtotal, Delivery_Charge, Discount, Grand_Total, Payment_Mode, Sold_By, Location, KRA_PIN, Status, Valid_Until, Converted_Sale_ID

**Purchases Sheet** - Each row = one item purchased
- Columns: Purchase_ID, Date, Supplier_ID, Supplier_Name, Item_ID, Item_Name, Qty, Cost_Price, Line_Total, Total_Amount, Payment_Status, Payment_Method, Paid_Amount, Balance, Recorded_By

**Financials Sheet** - All financial transactions
- Columns: Transaction_ID, DateTime, Type, Customer_ID, Category, Account, Description, Amount, Debit, Credit, Balance, Payment_Method, Payee, Receipt_No, Reference, Status, Approved_By, User

### After Reorganization

The new merged sheets will be **empty**. You can:
1. Start fresh with new data (recommended)
2. Manually copy data from your backup if needed

### Need Help?

See `SHEET_REORGANIZATION.md` for complete documentation.

---

**System Version**: 2.0.0
**Last Updated**: 2025-11-22
