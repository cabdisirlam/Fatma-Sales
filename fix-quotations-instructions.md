# Fix Quotations Column Mismatch

## Problem
The Quotations sheet was missing the Batch_ID column, causing all data to shift and appear in the wrong columns.

## What Was Fixed
- Updated the `createQuotation()` function to include the Batch_ID column
- New quotations will now be created correctly

## How to Fix Existing Data

### Option 1: Run V3 System Setup (Recommended)
1. Open your Google Sheets workbook
2. Go to **Extensions** > **Apps Script**
3. In the script editor, find the function `runV3Setup`
4. Click **Run** ▶️
5. This will:
   - Verify all sheet structures
   - Add any missing columns (including Batch_ID)
   - Preserve your existing data

### Option 2: Manual Fix for Quotations Sheet
If you only want to fix the Quotations sheet:

1. Open the **Quotations** sheet
2. Verify the column headers match this exact order:
   ```
   Quotation_ID | DateTime | Customer_ID | Customer_Name | Item_ID | Item_Name | Batch_ID | Qty | Unit_Price | Line_Total | Subtotal | Delivery_Charge | Discount | Grand_Total | Created_By | Location | KRA_PIN | Status | Valid_Until | Converted_Sale_ID
   ```
3. If **Batch_ID** is missing:
   - Insert a new column after "Item_Name" (column G)
   - Name it "Batch_ID"
   - Fill existing rows with "QUOT" or "N/A"

4. Your specific quotation (A004304841K) should show:
   - **Location**: (actual location like "Nairobi", not a Customer ID)
   - **KRA PIN**: (actual KRA PIN or empty, not "Pending")
   - **Prepared By**: (username, not location)

### Option 3: Contact Support
If you're unsure about making these changes, please backup your sheet first or contact support.

## Verification
After running the fix, create a new test quotation and verify:
- Location shows the correct location
- KRA PIN shows the correct PIN or is empty
- Prepared By shows the username

## Changes Made to Code
- File: `iSales.gs`
- Function: `createQuotation()`
- Line: 538
- Added: Batch_ID column to quotation row data
