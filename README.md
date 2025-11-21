# BeiPoa Sales Management System

A comprehensive Google Apps Script-based sales management system for BeiPoa shop. This system uses a single Google Spreadsheet workbook to manage all sales, products, customers, inventory, and reports.

## Features

- **📊 Dashboard**: View real-time sales statistics and quick access to all features
- **🛍️ Sales Management**: Track all sales transactions with detailed information
- **📦 Product Management**: Manage product catalog with pricing and inventory
- **👥 Customer Management**: Keep track of customer information and purchase history
- **📋 Inventory Tracking**: Monitor stock levels with automatic reorder alerts
- **📈 Reports**: Generate sales reports and analytics
- **⚙️ Settings**: Configure system settings and preferences

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

## Usage

### Initializing the Workbook

1. Open your Google Spreadsheet
2. Go to menu: **🏪 BeiPoa** > **🔄 Initialize Workbook**
3. The system will create all necessary sheets:
   - Sales
   - Products
   - Customers
   - Inventory
   - Reports
   - Settings

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

## Admin Settings

- **Admin Email**: cabdisirlam@gmail.com
- **Shop Name**: BeiPoa
- **Currency**: USD ($)
- **Timezone**: Africa/Mogadishu

The Settings sheet is protected and can only be edited by the admin email.

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

## License

This project is proprietary software for BeiPoa shop.

## Version

Current Version: 1.0.0

---

**BeiPoa Sales Management System** - Manage your shop efficiently with automated workflows and real-time insights.
