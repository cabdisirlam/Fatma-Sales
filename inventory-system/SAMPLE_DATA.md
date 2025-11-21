# Sample Data for Testing

This document provides sample data that you can use to test the Inventory Management System. Copy and paste this data directly into the appropriate tabs in your Google Spreadsheet.

## Important Notes

- The system will auto-generate IDs for most records when you use the application
- This sample data is for manual entry to quickly populate the system for testing
- After adding this data, you can test all features of the system
- Dates should be adjusted to recent dates for realistic testing

---

## 1. Users Tab

Add these users for testing different roles:

| User_ID | Username | PIN  | Role  | Email              | Phone         | Status | Created_Date |
|---------|----------|------|-------|--------------------|---------------|--------|--------------|
| USR-001 | admin    | 1234 | Admin | admin@company.com  |               | Active | 2025-01-01   |
| USR-002 | john     | 5678 | Staff | john@company.com   | +254712345678 | Active | 2025-01-01   |
| USR-003 | mary     | 9012 | Staff | mary@company.com   | +254723456789 | Active | 2025-01-01   |
| USR-004 | peter    | 3456 | Staff | peter@company.com  | +254734567890 | Active | 2025-01-01   |

---

## 2. Suppliers Tab

| Supplier_ID | Supplier_Name        | Contact_Person | Phone         | Email                  | Address           | Total_Purchased | Total_Paid | Current_Balance | Payment_Terms | Status |
|-------------|----------------------|----------------|---------------|------------------------|-------------------|-----------------|------------|-----------------|---------------|--------|
| SUP-001     | ABC Wholesalers      | James Mwangi   | +254711111111 | james@abcwholesale.com | Nairobi           | 0               | 0          | 0               | Net 30        | Active |
| SUP-002     | XYZ Distributors     | Sarah Wanjiru  | +254722222222 | sarah@xyzdist.com      | Mombasa           | 0               | 0          | 0               | Cash          | Active |
| SUP-003     | Quality Supplies Ltd | John Kamau     | +254733333333 | john@qualitysup.com    | Kisumu            | 0               | 0          | 0               | Net 15        | Active |
| SUP-004     | Prime Imports        | Jane Akinyi    | +254744444444 | jane@primeimports.com  | Nakuru            | 0               | 0          | 0               | Cash          | Active |

---

## 3. Inventory Tab

Sample products across different categories:

| Item_ID  | Item_Name           | Category    | Cost_Price | Selling_Price | Current_Qty | Reorder_Level | Supplier | Last_Updated | Updated_By |
|----------|---------------------|-------------|------------|---------------|-------------|---------------|----------|--------------|------------|
| ITEM-001 | Rice 1kg            | Groceries   | 120        | 150           | 100         | 20            | SUP-001  | 2025-01-01   | admin      |
| ITEM-002 | Sugar 2kg           | Groceries   | 180        | 220           | 80          | 15            | SUP-001  | 2025-01-01   | admin      |
| ITEM-003 | Cooking Oil 1L      | Groceries   | 250        | 300           | 60          | 10            | SUP-002  | 2025-01-01   | admin      |
| ITEM-004 | Wheat Flour 2kg     | Groceries   | 160        | 200           | 90          | 20            | SUP-001  | 2025-01-01   | admin      |
| ITEM-005 | Maize Flour 2kg     | Groceries   | 130        | 170           | 70          | 15            | SUP-001  | 2025-01-01   | admin      |
| ITEM-006 | Milk 500ml          | Dairy       | 50         | 65            | 120         | 30            | SUP-002  | 2025-01-01   | admin      |
| ITEM-007 | Bread               | Bakery      | 40         | 55            | 50          | 10            | SUP-003  | 2025-01-01   | admin      |
| ITEM-008 | Eggs (Tray)         | Dairy       | 320        | 400           | 40          | 10            | SUP-002  | 2025-01-01   | admin      |
| ITEM-009 | Tomatoes 1kg        | Vegetables  | 60         | 80            | 150         | 30            | SUP-004  | 2025-01-01   | admin      |
| ITEM-010 | Onions 1kg          | Vegetables  | 70         | 90            | 120         | 25            | SUP-004  | 2025-01-01   | admin      |
| ITEM-011 | Potatoes 2kg        | Vegetables  | 100        | 130           | 100         | 20            | SUP-004  | 2025-01-01   | admin      |
| ITEM-012 | Soap Bar            | Household   | 25         | 35            | 200         | 50            | SUP-003  | 2025-01-01   | admin      |
| ITEM-013 | Washing Powder 1kg  | Household   | 180        | 230           | 60          | 15            | SUP-003  | 2025-01-01   | admin      |
| ITEM-014 | Tissue Paper        | Household   | 80         | 110           | 100         | 20            | SUP-003  | 2025-01-01   | admin      |
| ITEM-015 | Toothpaste          | Personal    | 90         | 120           | 80          | 15            | SUP-003  | 2025-01-01   | admin      |
| ITEM-016 | Shampoo 200ml       | Personal    | 150        | 200           | 50          | 10            | SUP-003  | 2025-01-01   | admin      |
| ITEM-017 | Coca Cola 500ml     | Beverages   | 35         | 50            | 200         | 50            | SUP-002  | 2025-01-01   | admin      |
| ITEM-018 | Mineral Water 500ml | Beverages   | 20         | 30            | 300         | 100           | SUP-002  | 2025-01-01   | admin      |
| ITEM-019 | Tea Leaves 250g     | Beverages   | 120        | 160           | 70          | 15            | SUP-001  | 2025-01-01   | admin      |
| ITEM-020 | Coffee 100g         | Beverages   | 180        | 240           | 50          | 10            | SUP-001  | 2025-01-01   | admin      |

---

## 4. Customers Tab

Sample customers with different credit limits:

| Customer_ID | Customer_Name        | Phone         | Email                  | Location      | KRA_PIN      | Customer_Type | Credit_Limit | Current_Balance | Total_Purchases | Last_Purchase_Date | Loyalty_Points | Status | Created_Date | Created_By |
|-------------|----------------------|---------------|------------------------|---------------|--------------|---------------|--------------|-----------------|-----------------|-------------------|----------------|--------|--------------|------------|
| CUST-001    | Acme Corporation     | +254720111111 | info@acme.co.ke        | Nairobi       | A000111111K  | Corporate     | 100000       | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-002    | Jane Doe             | +254720222222 | jane.doe@email.com     | Westlands     | A000222222L  | Regular       | 20000        | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-003    | John Smith           | +254720333333 | john.smith@email.com   | Karen         | A000333333M  | Regular       | 15000        | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-004    | Best Restaurant      | +254720444444 | best@restaurant.co.ke  | CBD           | A000444444N  | Corporate     | 50000        | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-005    | Mary Johnson         | +254720555555 | mary.j@email.com       | Kileleshwa    | A000555555P  | Regular       | 10000        | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-006    | Tech Solutions Ltd   | +254720666666 | info@techsolutions.com | Upperhill     | A000666666Q  | Corporate     | 75000        | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-007    | Peter Odhiambo       | +254720777777 | peter.o@email.com      | South B       | A000777777R  | Regular       | 5000         | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |
| CUST-008    | Grace Muthoni        | +254720888888 | grace.m@email.com      | Langata       | A000888888S  | Regular       | 8000         | 0               | 0               |                   | 0              | Active | 2025-01-01   | admin      |

---

## 5. Expense_Categories Tab

Default expense categories (already created by initialization):

| Category_ID | Category_Name | Monthly_Budget | Status |
|-------------|---------------|----------------|--------|
| CAT-001     | Rent          | 50000          | Active |
| CAT-002     | Utilities     | 10000          | Active |
| CAT-003     | Salaries      | 150000         | Active |
| CAT-004     | Transport     | 20000          | Active |
| CAT-005     | Marketing     | 15000          | Active |
| CAT-006     | Supplies      | 25000          | Active |
| CAT-007     | Maintenance   | 10000          | Active |
| CAT-008     | Other         | 10000          | Active |

---

## 6. Settings Tab

Business configuration (adjust to your business):

| Setting_Key         | Setting_Value                                      |
|---------------------|----------------------------------------------------|
| BUSINESS_NAME       | Fatma General Store                                |
| BUSINESS_KRA        | P051234567A                                        |
| BUSINESS_LOCATION   | Tom Mboya Street, Nairobi, Kenya                   |
| BUSINESS_PHONE      | +254 712 345 678                                   |
| BUSINESS_EMAIL      | info@fatmastore.co.ke                              |
| SPREADSHEET_ID      | (Your actual spreadsheet ID)                       |

---

## Testing Workflow

After adding the sample data above, you can test the system with this workflow:

### 1. Test Login
- Login as `admin` with PIN `1234`
- Verify dashboard loads correctly

### 2. Test Sales (POS)
1. Navigate to Sales (POS)
2. Select customer: Jane Doe (CUST-002)
3. Add items to cart:
   - Rice 1kg (Qty: 2)
   - Sugar 2kg (Qty: 1)
   - Cooking Oil 1L (Qty: 1)
4. Add delivery charge: 100
5. Select payment method: Cash
6. Click Checkout
7. Verify receipt is generated
8. Check that inventory quantities decreased

### 3. Test Purchase Recording
1. Navigate to Inventory
2. Click "Record Purchase"
3. Select supplier: ABC Wholesalers
4. Add items:
   - Rice 1kg (Qty: 50, Cost: 120)
   - Sugar 2kg (Qty: 30, Cost: 180)
5. Set payment method: Cash
6. Set paid amount: 10400 (full payment)
7. Submit purchase
8. Verify inventory quantities increased

### 4. Test Customer Payment
1. First, make a credit sale to a customer
2. Navigate to Customers
3. Find the customer with a balance
4. Click the cash icon to record payment
5. Enter payment amount
6. Select payment method
7. Verify balance is reduced

### 5. Test Quotation
1. Navigate to Quotations
2. Click "New Quotation"
3. Select customer
4. Add items
5. Set valid until date (future date)
6. Submit quotation
7. Update status to "Accepted"
8. Convert to sale

### 6. Test Expense Recording
1. Navigate to Expenses
2. Click "Record Expense"
3. Select category: Utilities
4. Enter description: "Electricity Bill - January"
5. Enter amount: 5000
6. Select payment method: Cash
7. Submit
8. If user is Staff and amount > 10000, verify status is "Pending"
9. If user is Admin, verify status is "Approved"

### 7. Test Reports
1. Navigate to Reports
2. Generate Sales Report
3. Generate Inventory Report
4. Generate Financial Report
5. Generate Customer Statement (select a customer)

### 8. Test Dashboard
1. Go back to Dashboard
2. Verify all stat cards show correct values:
   - Cash Balance should reflect sales and expenses
   - Today's Sales should show the test sale
   - Low Stock should show items below reorder level

---

## Additional Sample Sales

To populate more realistic data, create additional sales manually or through the POS:

**Sample Sale 1:**
- Customer: Walk-in
- Items: Bread (2), Milk (4), Eggs (1)
- Payment: Cash
- Total: ~600 KES

**Sample Sale 2:**
- Customer: CUST-003 (John Smith)
- Items: Rice (3), Oil (2), Sugar (2)
- Payment: Credit
- Total: ~1340 KES

**Sample Sale 3:**
- Customer: CUST-004 (Best Restaurant)
- Items: Tomatoes (10), Onions (8), Potatoes (5)
- Delivery: 200
- Payment: MPESA
- Total: ~2170 KES

---

## Data Verification Checklist

After adding sample data and making test transactions:

- [ ] All users can login successfully
- [ ] Dashboard shows correct balances
- [ ] Sales reduce inventory quantities
- [ ] Purchases increase inventory quantities
- [ ] Customer credit sales increase customer balance
- [ ] Customer payments reduce customer balance
- [ ] Expenses reduce account balances
- [ ] Financial transactions are recorded correctly
- [ ] Receipts print with correct information
- [ ] Quotations can be converted to sales
- [ ] Audit trail logs all activities
- [ ] Reports generate without errors

---

## Notes

- All monetary values are in Kenyan Shillings (KES)
- Phone numbers use Kenya format (+254)
- Dates should be in YYYY-MM-DD format or use your local format
- Adjust quantities and prices to match your actual business
- Test with small quantities first before using in production

## Resetting Data

To reset and start fresh:

1. Delete all data rows (keep headers) from all tabs
2. Run `initializeSheets()` function again from Apps Script
3. Re-add the sample data or start with real data

---

**Happy Testing!**

For any issues, refer to the SETUP_GUIDE.md troubleshooting section.
