# Backend Functions Status - Dashboard Data Loading

## ✅ Functions That Exist and Work

### Sales (iSales.gs, jSalesManager.gs)
- ✅ `getSalesOverview()` - Returns sales metrics
- ✅ `getSalesHistory(limit)` - Returns recent sales
- ✅ `getRecentSales(limit)` - **NEW WRAPPER** - Calls getSalesHistory()
- ✅ `getSalesReturns()` - Returns returned items
- ✅ `getSalesReport()` - Returns sales report data
- ✅ `getSales(filters)` - Get filtered sales

### Inventory (fInventory.gs)
- ✅ `getInventory(filters)` - Returns all inventory items
- ✅ `getInventoryItemById(itemId)` - Get specific item

### Customers (dCustomers.gs)
- ✅ `getCustomers(filters)` - Returns all customers
- ✅ `getCustomersWithDebt()` - Returns customers with outstanding balance

### Suppliers (tSuppliers.gs)
- ✅ `getSuppliers(filters)` - Returns all suppliers
- ✅ `getSuppliersOverview()` - Returns supplier metrics
- ✅ `getSuppliersWithDebt()` - Returns suppliers owed money

### Users (aCode.gs)
- ✅ `getUsers()` - Returns all system users

### Financial (eFinancials.gs)
- ✅ Financial functions available

## 🎯 How Frontend Calls Backend

The mDashboard.html makes calls like:
```javascript
google.script.run
  .withSuccessHandler(function(data) {
    // Handle data
  })
  .withFailureHandler(function(error) {
    // Handle error
  })
  .getFunctionName();
```

## 🔍 Testing Backend Functions

From Google Sheets:
1. Open Tools → Script Editor
2. Select function from dropdown
3. Click Run
4. Check Execution log

## 📝 Common Issues

1. **Permission Errors**: User needs authorization
2. **Empty Data**: Sheets might not have data yet
3. **Function Not Found**: Name mismatch between frontend/backend
4. **Timeout**: Large datasets need optimization

