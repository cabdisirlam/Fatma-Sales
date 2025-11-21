# Inventory Management System

A comprehensive, production-ready web-based inventory, sales, and financial management system built with Google Apps Script and Google Sheets.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-green.svg)
![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [User Guide](#user-guide)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This Inventory Management System is a complete business solution designed for small to medium-sized businesses in Kenya and other African markets. It handles inventory tracking, point-of-sale transactions, customer management, supplier relationships, financial accounting, and comprehensive reporting.

### Why This System?

- **Zero Cost Infrastructure** - Runs entirely on Google's free tier
- **No Installation Required** - Web-based, accessible from any device
- **Cloud-Based** - Automatic backups and data security via Google
- **Multi-User Support** - Role-based access control
- **Real-Time Updates** - All users see changes instantly
- **Mobile-Friendly** - Responsive design works on phones and tablets
- **Audit Trail** - Complete tamper-proof activity logging
- **Kenyan Business Ready** - KRA PIN support, KES currency

## ✨ Features

### 📦 Inventory Management
- Real-time stock tracking
- Low stock alerts
- Automatic reorder notifications
- Product categorization
- Cost and selling price management
- Inventory valuation reports
- Stock movement history
- Manual stock adjustments

### 💰 Point of Sale (POS)
- Fast, intuitive checkout interface
- Product search with autocomplete
- Shopping cart functionality
- Delivery charge management
- Discount application
- Multiple payment methods (Cash, MPESA, Bank, Credit)
- Split payment support
- Instant receipt printing
- Real-time stock validation

### 👥 Customer Management
- Customer database with detailed profiles
- Credit limit management
- Outstanding balance tracking
- Customer purchase history
- Payment recording and tracking
- Customer statements generation
- Loyalty points system
- Aging reports
- Credit control and alerts

### 🚚 Supplier Management
- Supplier database
- Purchase order recording
- Supplier payment tracking
- Outstanding balances
- Supplier statements
- Purchase history
- Payment terms management

### 📝 Quotation System
- Create professional quotations
- Track quotation status (Draft, Sent, Accepted, Rejected)
- Validity period management
- One-click conversion to sales
- PDF generation
- Customer quotation history

### 💵 Financial Management
- Three-account system (Cash, MPESA, Bank)
- Real-time account balances
- Inter-account transfers
- Transaction logging
- Profit & Loss statements
- Cash flow reports
- Account reconciliation

### 💳 Expense Management
- Category-based expense tracking
- Approval workflow for large expenses
- Budget vs actual comparison
- Multiple payment methods
- Receipt tracking
- Monthly expense reports

### 📊 Reports & Analytics
- Sales reports (daily, weekly, monthly)
- Inventory valuation
- Financial statements (P&L, Cash Flow)
- Customer statements
- Supplier statements
- Top customers/products
- User performance reports
- Expense reports by category

### 🔐 Security & Audit
- User authentication with PIN
- Role-based access control (Admin vs Staff)
- Session management
- Complete audit trail
- Tamper-proof logging
- Activity monitoring
- Suspicious activity detection
- Compliance reports

## 🛠 Technology Stack

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with custom properties
- **Bootstrap 5** - Responsive UI framework
- **Bootstrap Icons** - Icon library
- **JavaScript (ES6+)** - Client-side logic

### Backend
- **Google Apps Script** - Server-side JavaScript runtime
- **Google Sheets API** - Database operations

### Database
- **Google Sheets** - 15 normalized tables
- Structured as a relational database
- Real-time synchronization

## 🏗 System Architecture

### File Structure

```
inventory-system/
├── src/
│   ├── Code.gs              # Main entry point, auth, utilities
│   ├── Sales.gs             # Sales processing and receipts
│   ├── Inventory.gs         # Inventory and purchase management
│   ├── Customers.gs         # Customer and credit management
│   ├── Financials.gs        # Financial tracking and reports
│   ├── Quotations.gs        # Quotations and suppliers
│   ├── AuditLogger.gs       # Audit trail and compliance
│   └── Index.html           # Web application UI
├── SETUP_GUIDE.md           # Detailed setup instructions
├── SAMPLE_DATA.md           # Sample data for testing
└── README.md                # This file
```

### Database Schema

**15 Tables (Sheets):**

1. **Inventory** - Product catalog and stock levels
2. **Sales_Data** - Master sales transactions
3. **Sales_Items** - Line items for each sale
4. **Customers** - Customer information
5. **Customer_Transactions** - Customer payment history
6. **Quotations** - Quotation headers
7. **Quotation_Items** - Quotation line items
8. **Suppliers** - Supplier information
9. **Purchases** - Purchase transactions
10. **Purchase_Items** - Purchase line items
11. **Financials** - General ledger
12. **Expenses** - Expense records
13. **Expense_Categories** - Expense categories
14. **Users** - System users
15. **Audit_Trail** - Activity logs
16. **Settings** - System configuration

### Data Flow

```
User Interface (HTML/JS)
    ↓
Google Apps Script API
    ↓
Business Logic (.gs files)
    ↓
Google Sheets (Database)
    ↓
Audit Logger (Automatic)
```

## 🚀 Getting Started

### Prerequisites

- Google account
- Modern web browser
- Basic understanding of Google Sheets

### Installation

Follow the comprehensive [SETUP_GUIDE.md](SETUP_GUIDE.md) for step-by-step installation instructions.

**Quick Start:**

1. Create a new Google Spreadsheet
2. Open Apps Script editor (Extensions → Apps Script)
3. Copy all `.gs` and `.html` files from `src/` folder
4. Run `initializeSheets()` function
5. Deploy as web app
6. Access your application URL

### Default Login

- **Username:** `admin`
- **PIN:** `1234`

⚠️ **IMPORTANT:** Change the default PIN immediately after first login!

## 📱 User Guide

### For Staff Users

#### Making a Sale
1. Navigate to **Sales (POS)**
2. Select customer or leave as "Walk-in"
3. Search and add products to cart
4. Adjust quantities as needed
5. Add delivery charge if applicable
6. Apply discount if applicable
7. Select payment method
8. Click **Checkout**
9. Print receipt

#### Recording Customer Payment
1. Navigate to **Customers**
2. Find customer with outstanding balance
3. Click the cash icon (💰)
4. Enter payment amount
5. Select payment method
6. Confirm payment

#### Checking Stock Levels
1. Navigate to **Inventory**
2. View current stock levels
3. Red indicators show low stock items
4. Use search to find specific products

### For Admin Users

#### Adding New Products
1. Navigate to **Inventory**
2. Click **Add Product**
3. Fill in product details:
   - Name, Category
   - Cost Price, Selling Price
   - Initial Quantity
   - Reorder Level
   - Supplier
4. Submit

#### Recording Purchases
1. Navigate to **Inventory**
2. Click **Record Purchase**
3. Select supplier
4. Add items with quantities and costs
5. Enter payment details
6. Submit purchase
7. Inventory automatically updates

#### Adding Customers
1. Navigate to **Customers**
2. Click **Add Customer**
3. Fill in details:
   - Name, Phone, Email
   - Location, KRA PIN
   - Customer Type
   - Credit Limit
4. Submit

#### Managing Expenses
1. Navigate to **Expenses**
2. Click **Record Expense**
3. Fill in details:
   - Category, Description
   - Amount
   - Payment Method
   - Receipt Number
4. Submit
5. Large expenses (>10,000) require approval

#### Generating Reports
1. Navigate to **Reports**
2. Select report type:
   - Sales Reports
   - Inventory Reports
   - Financial Reports
   - Customer/Supplier Statements
3. Set date range if applicable
4. Generate report
5. Export or print as needed

## 🔌 API Documentation

### Main Functions

#### Authentication

```javascript
authenticate(username, pin)
```
Authenticates a user and creates a session.

**Parameters:**
- `username` (String): Username
- `pin` (String): 4-digit PIN

**Returns:**
```javascript
{
  success: Boolean,
  user: Object,
  sessionId: String,
  message: String
}
```

#### Sales

```javascript
createSale(saleData)
```
Creates a new sale transaction.

**Parameters:**
```javascript
{
  Customer_ID: String,
  Customer_Name: String,
  Items: Array,
  Delivery_Charge: Number,
  Discount: Number,
  Payment_Mode: String,
  Sold_By: String,
  Session_ID: String
}
```

**Returns:**
```javascript
{
  success: Boolean,
  saleId: String,
  message: String
}
```

#### Inventory

```javascript
addProduct(productData)
updateProduct(itemId, updates)
adjustStock(itemId, qtyChange, reason, user)
getLowStockItems()
```

#### Customers

```javascript
addCustomer(customerData)
recordCustomerPayment(paymentData)
checkCreditLimit(customerId, amount)
getCustomerStatement(customerId, dateRange)
```

#### Financial

```javascript
getAccountBalance(account)
transferFunds(transferData)
recordExpense(expenseData)
getProfitAndLoss(dateRange)
```

### Error Handling

All functions return error messages in a consistent format:

```javascript
{
  success: false,
  message: "Error description"
}
```

## 🔒 Security

### Access Control

- **Authentication:** PIN-based user authentication
- **Authorization:** Role-based access (Admin/Staff)
- **Session Management:** Unique session IDs for tracking

### Data Protection

- **Audit Trail:** All actions logged with user, timestamp, and details
- **Tamper-Proof:** Append-only audit log prevents deletion
- **Data Validation:** Input validation on all forms
- **SQL Injection Protection:** Not applicable (no SQL database)

### Best Practices

1. **Change Default Credentials** immediately
2. **Use Strong PINs** for all users
3. **Limit Spreadsheet Access** to administrators only
4. **Regular Backups** - Copy spreadsheet weekly
5. **Monitor Audit Trail** for suspicious activities
6. **Review User Access** quarterly
7. **Use HTTPS** (automatic with Google)

### Compliance

- **KRA PIN Support** for Kenyan tax compliance
- **Audit Trail** for financial audits
- **Data Retention** policies can be implemented
- **GDPR Considerations** - Customer data protection

## 🎨 Customization

### Branding

Edit the `Index.html` file to customize:
- Color scheme (CSS variables)
- Logo and business name
- Receipt format

### Business Rules

Edit `.gs` files to customize:
- Credit limit checks
- Discount rules
- Loyalty points calculation
- Approval workflows
- Reorder level calculations

### Reports

Add custom reports by:
1. Creating new functions in `.gs` files
2. Adding report UI in `Index.html`
3. Connecting with Google Apps Script

## 🐛 Troubleshooting

### Common Issues

**Dashboard shows zeros**
- Solution: This is normal for new installations. Add sample data.

**Can't login**
- Solution: Verify Users tab has active users with correct PINs.

**Receipt not printing**
- Solution: Check browser popup blocker settings.

**Changes not reflecting**
- Solution: Refresh the page. Check audit trail for errors.

**"Permission denied" errors**
- Solution: Re-authorize the script in Apps Script settings.

For more troubleshooting, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

## 📈 Performance

### Optimization Tips

- Archive old sales data annually
- Use date filters on reports
- Limit concurrent users to 10-15
- Regular spreadsheet cleanup
- Consider Google Sheets API quotas

### Scalability

**Current Capacity:**
- Up to 5,000 products
- Up to 10,000 customers
- Up to 100,000 sales transactions
- 15-20 concurrent users

For larger deployments, consider:
- Moving to Google Cloud SQL
- Implementing caching layer
- Using Google Cloud Functions

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Bugs** - Open an issue with details
2. **Suggest Features** - Describe the use case
3. **Submit Pull Requests** - Follow coding standards
4. **Improve Documentation** - Fix typos, add examples
5. **Share Feedback** - Let us know how you use it

### Development Setup

1. Fork the repository
2. Create a test Google Sheet
3. Set up Apps Script project
4. Make changes
5. Test thoroughly
6. Submit pull request

### Coding Standards

- Use clear, descriptive variable names
- Add comments for complex logic
- Follow existing code style
- Write error handling for all functions
- Log all CRUD operations to audit trail

## 📄 License

This project is licensed under the MIT License - see below:

```
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgments

- **Bootstrap Team** - For the excellent UI framework
- **Google** - For Apps Script platform
- **Community Contributors** - For feedback and improvements

## 📞 Support

### Documentation

- [Setup Guide](SETUP_GUIDE.md) - Installation instructions
- [Sample Data](SAMPLE_DATA.md) - Test data for development

### Contact

For questions, issues, or support:
- Open an issue on GitHub
- Email: support@yourcompany.com
- Phone: +254 700 000000

## 🗺 Roadmap

### Version 2.0 (Planned)

- [ ] Mobile app (Android/iOS)
- [ ] Barcode scanning support
- [ ] Email notifications
- [ ] SMS integration (Africa's Talking)
- [ ] Multi-currency support
- [ ] Advanced analytics dashboard
- [ ] Inventory forecasting
- [ ] Automated reordering
- [ ] Employee time tracking
- [ ] Multi-location support

### Version 1.1 (In Progress)

- [ ] Export to Excel
- [ ] Custom report builder
- [ ] Batch product import
- [ ] Enhanced receipt design
- [ ] Customer portal
- [ ] Supplier portal

## 📊 Project Stats

- **Lines of Code:** ~5,000+
- **Files:** 8 core files
- **Database Tables:** 15
- **Functions:** 100+
- **Supported Users:** Unlimited
- **Supported Transactions:** 100,000+

---

**Built with ❤️ for small businesses in Kenya and beyond.**

**Version:** 1.0.0
**Last Updated:** January 2025
**Status:** Production Ready

---

### Quick Links

- [🚀 Setup Guide](SETUP_GUIDE.md)
- [📝 Sample Data](SAMPLE_DATA.md)
- [🐛 Report Issues](#)
- [💬 Discussions](#)

**Start building your business today! 🎉**
