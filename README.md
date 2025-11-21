# Fatma System - Sales Management System

A comprehensive Google Apps Script-based sales and inventory management system. This system uses a single Google Spreadsheet workbook named "Fatma System" to manage all operations including sales, inventory, customers, suppliers, financials, and more.

## Key Features

- **🔐 Secure Authentication**: 4-digit PIN authentication with token-based session management
- **📊 Dashboard**: View real-time business statistics and quick access to all features
- **🛍️ Sales Management**: Complete sales tracking with quotations and customer management
- **📦 Inventory Management**: Track inventory with automatic stock updates and low stock alerts
- **👥 Customer Management**: Manage customer information, credit limits, and transaction history
- **🏭 Supplier Management**: Track suppliers and purchase orders
- **💰 Financial Management**: Comprehensive financial tracking with multiple accounts (Cash, M-PESA, Bank)
- **💳 Expense Management**: Track and categorize business expenses with approval workflow
- **📋 Quotations**: Create and manage sales quotations that convert to sales
- **👤 User Management**: Multi-user system with role-based access control
- **📈 Reports & Analytics**: Generate comprehensive business reports
- **🔍 Audit Trail**: Complete audit logging of all system activities

## Project Structure

```
Fatma-Sales/
├── .clasp.json              # Clasp configuration with script ID
├── appsscript.json          # Google Apps Script manifest
├── .claspignore             # Files to ignore when pushing to GAS
├── .gitignore               # Git ignore rules
├── README.md                # This file
└── src/                     # Source code directory
    ├── Config.js            # Configuration and constants
    ├── Main.js              # Main entry point and menu functions
    ├── WorkbookManager.js   # Workbook initialization and sheet setup
    ├── SalesManager.js      # Sales, products, and customer operations
    ├── Dashboard.html       # Dashboard UI
    ├── NewSale.html         # New sale form
    ├── Products.html        # Product management UI
    ├── Customers.html       # Customer management UI
    ├── Reports.html         # Reports UI
    └── Settings.html        # Settings UI
```

## Setup Instructions

### Prerequisites

1. Node.js and npm installed
2. Google account with access to Google Apps Script
3. Clasp CLI installed globally: `npm install -g @google/clasp`

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Fatma-Sales
   ```

2. **Login to clasp**:
   ```bash
   clasp login
   ```

3. **Push code to Google Apps Script**:
   ```bash
   clasp push
   ```

4. **Open the script in Google Apps Script Editor**:
   ```bash
   clasp open
   ```

5. **Create or open a Google Spreadsheet**:
   - Create a new Google Spreadsheet or open an existing one
   - The script will automatically initialize the workbook on first run

6. **Run the script**:
   - In the spreadsheet, refresh the page
   - You should see a "🏪 BeiPoa" menu appear
   - Click "🏪 BeiPoa" > "🔄 Initialize Workbook" to set up all sheets

## Quick Start

### Setting Up Fatma System (Automatic Setup)

The Fatma System now **automatically creates and configures everything** for you!

1. **Set up Google Apps Script** (see Installation above)
2. **Run the function**: `createFatmaSystem()` from the Apps Script editor
3. **The system will automatically**:
   - ✅ Create a new spreadsheet named "Fatma System"
   - ✅ Create all necessary sheets (Users, Suppliers, Customers, Inventory, Sales, etc.)
   - ✅ Set up proper formatting and headers
   - ✅ Create a default admin user with username `admin` and PIN `1234`
   - ✅ Initialize default settings and expense categories
   - ✅ Return the spreadsheet URL in the logs

4. **Open your new spreadsheet**:
   - Check the execution log for the spreadsheet URL
   - Open the spreadsheet to view all configured sheets

5. **Deploy as Web App** to access the full UI

6. **First Login**:
   - Username: `admin`
   - PIN: `1234`
   - **IMPORTANT**: Change the PIN after first login for security

For detailed step-by-step instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md).

### Authentication System

The Fatma System uses **secure token-based authentication** with the following features:

- **4-Digit PIN**: All users must use exactly 4 numeric digits for their PIN
- **Token Sessions**: After login, a secure token is generated valid for 8 hours
- **No Google OAuth**: The system uses its own authentication, not Google accounts
- **Session Management**: Automatic token validation and session expiry handling

### User Management

**Adding New Users**:
```javascript
addUser({
  Username: 'john',
  PIN: '5678',
  Role: 'Cashier',
  Email: 'john@example.com',
  Phone: '+254700000000',
  Status: 'Active'
});
```

**Changing PIN**:
```javascript
updateUserPIN('username', 'oldPIN', 'newPIN');
```

**User Roles**:
- **Admin**: Full system access
- **Manager**: Sales, inventory, and reporting access
- **Cashier**: Sales and customer management only
- **User**: Basic access

### System Sheets

The Fatma System workbook contains the following sheets:

1. **Users**: System users with PIN authentication
2. **Suppliers**: Supplier management with contact details and balances
3. **Customers**: Customer information, credit limits, and balances
4. **Inventory**: Product inventory with cost/selling prices
5. **Sales_Data**: Sales transaction headers
6. **Sales_Items**: Line items for each sale
7. **Purchases**: Purchase orders from suppliers
8. **Purchase_Items**: Line items for purchases
9. **Quotations**: Sales quotations
10. **Quotation_Items**: Line items for quotations
11. **Customer_Transactions**: Customer payment history
12. **Financials**: Financial transactions (Cash, M-PESA, Bank)
13. **Expenses**: Business expense tracking
14. **Expense_Categories**: Expense category definitions
15. **Audit_Trail**: Complete system audit log
16. **Settings**: System configuration settings

### Adding a New Sale

1. Go to menu: **🏪 BeiPoa** > **🛍️ New Sale**
2. Fill in the sale details:
   - Customer Name (required)
   - Customer Email (optional)
   - Product (required)
   - Quantity (required)
   - Unit Price (required)
   - Payment Method
   - Notes
3. Click "Add Sale"
4. The sale will be recorded and inventory will be automatically updated

### Managing Products

1. Go to menu: **🏪 BeiPoa** > **📦 Manage Products**
2. Fill in product details:
   - Product Name (required)
   - Description
   - Category
   - Price (required)
   - Cost
   - Stock Quantity (required)
   - Reorder Level
   - Supplier
3. Click "Add Product"

### Managing Customers

1. Go to menu: **🏪 BeiPoa** > **👥 Manage Customers**
2. Fill in customer details
3. Click "Add Customer"

### Viewing Reports

1. Go to menu: **🏪 BeiPoa** > **📈 View Reports**
2. See comprehensive sales statistics:
   - Total sales count
   - Total revenue
   - Today's sales
   - Today's revenue
   - Average sale value

### Dashboard

1. Go to menu: **🏪 BeiPoa** > **📊 Dashboard**
2. View at-a-glance statistics and quick action buttons

## Configuration

Edit `src/Config.js` to customize:

- Shop name
- Admin email
- Currency settings
- Date formats
- Color scheme
- Sheet names

## Configuration

Edit `src/cConfig.gs` to customize:

- **Shop Name**: Fatma Sales (default)
- **Admin Email**: cabdisirlam@gmail.com
- **Workbook Name**: Fatma System
- **Currency**: KES (Kenyan Shillings)
- **PIN Length**: 4 digits (mandatory)
- **Token Auth**: Enabled by default
- **Date Format**: yyyy-MM-dd HH:mm:ss
- **Color Scheme**: Configurable brand colors

### Security Settings

- **PIN_LENGTH**: 4 (enforced, cannot be changed)
- **USE_TOKEN_AUTH**: true (token-based sessions)
- **Session Duration**: 8 hours
- **PIN Requirements**: Must be exactly 4 numeric digits

## Sheets Description

### Sales Sheet
Records all sales transactions with:
- Sale ID, Date, Customer info
- Product, Quantity, Prices
- Payment method, Status, Notes

### Products Sheet
Manages product catalog with:
- Product ID, Name, Description
- Category, Pricing
- Stock levels, Reorder information
- Supplier details

### Customers Sheet
Tracks customer information:
- Customer ID, Contact details
- Address information
- Purchase history
- Status and notes

### Inventory Sheet
Monitors stock levels with:
- Current stock quantities
- Reorder alerts
- Stock status indicators
- Last restock dates

### Reports Sheet
Provides sales analytics:
- Daily summaries
- Weekly summaries
- Monthly summaries

### Settings Sheet
System configuration:
- Shop settings
- Currency and format settings
- System information
- Protected (admin-only access)

## Development

### Pushing Changes

```bash
clasp push
```

### Pulling from Google Apps Script

```bash
clasp pull
```

### Watching for Changes

```bash
clasp push --watch
```

### Opening in Browser

```bash
clasp open
```

## Script ID

This project is linked to Google Apps Script project:
- **Script ID**: `1jQNLyXn0RO5dpnp3EWFUY58nW4-_1ofBPryowijgU9bamW9O8QTDq9uJ`

## Features Highlights

### Automatic Workbook Creation
- Single command initializes all sheets
- Consistent formatting and structure
- Protected settings for data integrity

### Inventory Management
- Automatic stock updates on sales
- Low stock alerts
- Reorder level tracking

### User-Friendly Interface
- Modern, responsive HTML dialogs
- Intuitive forms with validation
- Real-time feedback and confirmations

### Data Protection
- Admin-only access to settings
- Structured data validation
- Error handling and logging

## Troubleshooting

### Menu doesn't appear
1. Refresh the spreadsheet
2. Check if script is authorized
3. Run "Initialize Workbook" manually from Script Editor

### Clasp push fails
1. Verify you're logged in: `clasp login`
2. Check .clasp.json has correct script ID
3. Ensure you have edit access to the script

### Sheets not created
1. Run "Initialize Workbook" from the menu
2. Check for error messages
3. Verify admin email matches your Google account

## Support

For issues or questions:
- Check the Google Apps Script logs: View > Logs
- Review the error messages in dialogs
- Contact admin: cabdisirlam@gmail.com

## Security Features

### Authentication
- ✅ Token-based authentication (no Google OAuth required)
- ✅ 4-digit PIN system for all users
- ✅ Secure session management with 8-hour expiry
- ✅ Automatic token validation

### Data Protection
- ✅ Complete audit trail logging
- ✅ User activity tracking
- ✅ Before/after value recording for changes
- ✅ Session ID tracking for all operations

### Access Control
- ✅ Role-based permissions
- ✅ User status management (Active/Inactive)
- ✅ Protected settings sheet

## API Functions

### Authentication
```javascript
// Login
authenticate(username, pin) // Returns: {success, user, sessionId, token}

// Validate token
validateToken(token) // Returns: {valid, username, sessionId}

// Logout
logout(token) // Returns: {success, message}
```

### User Management
```javascript
// Add user
addUser({Username, PIN, Role, Email, Phone, Status})

// Update PIN
updateUserPIN(username, oldPIN, newPIN)

// Get users
getUsers() // Returns array of users (without PINs)
```

## Troubleshooting

### Circular Dependency Error Fixed
The system previously had a circular dependency between `getSpreadsheet()` and `getSettingValue()` which has been resolved by using Script Properties instead of Settings sheet for storing the spreadsheet ID.

### PIN Validation
- PINs must be exactly 4 digits
- Only numeric characters allowed
- Validated on user creation and PIN change
- Enforced during authentication

### Token Management
- Tokens are stored in Cache Service
- Automatically expire after 8 hours
- Can be manually invalidated via logout
- Each login generates a new token

## License

This project is proprietary software for Fatma Sales.

## Version

Current Version: 2.0.0

**Major Changes in v2.0.0**:
- Fixed circular dependency in core functions
- Implemented token-based authentication
- Enforced 4-digit PIN for all users
- Renamed system to "Fatma System"
- Added comprehensive user management
- Enhanced security with session management

---

**Fatma System** - Complete business management solution with secure authentication and comprehensive tracking.
