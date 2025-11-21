# Fatma Sales Management System - Setup Guide

This guide will walk you through the complete setup process for deploying the Fatma Sales Management System using Google Apps Script and Google Sheets.

## Prerequisites

- A Google account
- Basic understanding of Google Sheets
- Web browser (Chrome, Firefox, Safari, or Edge)

## Quick Start (Recommended)

The Fatma System now automatically creates and configures everything for you!

### Step 1: Set Up Google Apps Script

1. **Create a New Apps Script Project**
   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"
   - Rename it to "Fatma Sales System"

### Step 2: Add the Script Files

Copy all the files from the `src/` folder into your Apps Script project:

1. **Delete Default Code**
   - You'll see a file called "Code.gs" with some default code
   - Select all the code and delete it

2. **Add Script Files (.gs)**
   - Click "+" next to "Files" in the left sidebar → Select "Script"
   - Create and paste the following files:
     - `aCode.gs` (rename default Code.gs to this)
     - `bAuditLogger.gs`
     - `cConfig.gs`
     - `dCustomers.gs`
     - `eFinancials.gs`
     - `fInventory.gs`
     - `gMain.gs`
     - `hQuotations.gs`
     - `iSales.gs`
     - `jSalesManager.gs`
     - `kWorkbookManager.gs`

3. **Add HTML Files**
   - Click "+" next to "Files" → Select "HTML"
   - Create: `nIndex.html`

### Step 3: Run the Setup Function

This is the easiest part - just run one function and everything is created automatically!

1. **Save All Files**
   - Click the disk icon or press Ctrl+S (Cmd+S on Mac)

2. **Select the Setup Function**
   - In the function dropdown (at the top), select `createFatmaSystem`

3. **Run the Function**
   - Click the "Run" button (▶️ play icon)

4. **Grant Permissions**
   - You'll see a dialog asking for permissions
   - Click "Review Permissions"
   - Select your Google account
   - Click "Advanced" → "Go to Fatma Sales System (unsafe)"
   - Click "Allow"

5. **Wait for Completion**
   - The function will:
     - ✅ Create a new spreadsheet named "Fatma System"
     - ✅ Create all 16 required sheets with proper formatting
     - ✅ Set up headers and column widths
     - ✅ Create default admin user (Username: `admin`, PIN: `1234`)
     - ✅ Initialize expense categories
     - ✅ Initialize account balances

6. **Check the Execution Log**
   - Click "View" → "Logs" or "Execution log"
   - You should see: "SUCCESS! Spreadsheet created at: [URL]"
   - Copy the spreadsheet URL from the log

### Step 4: Open Your New Spreadsheet

1. **Click the Spreadsheet URL**
   - From the execution log, click or paste the spreadsheet URL
   - Your new "Fatma System" spreadsheet will open

2. **Verify All Sheets**
   - You should see 16 tabs at the bottom:
     - Users, Suppliers, Customers, Inventory
     - Sales_Data, Sales_Items
     - Purchases, Purchase_Items
     - Quotations, Quotation_Items
     - Customer_Transactions, Financials
     - Expenses, Expense_Categories
     - Audit_Trail, Settings

3. **Check Settings**
   - Click the "Settings" tab
   - All default settings are already configured!

### Step 5: Deploy as Web App

1. **Return to Apps Script Editor**
   - Go back to the Apps Script tab

2. **Create Deployment**
   - Click "Deploy" → "New deployment"
   - Click the gear icon ⚙️ next to "Select type"
   - Select "Web app"

3. **Configure Deployment**
   - **Description:** "Fatma Sales System v1.0"
   - **Execute as:** "Me (your email)"
   - **Who has access:** "Anyone" (or "Anyone with Google account" for more security)
   - Click "Deploy"

4. **Authorize (if needed)**
   - You may need to authorize again
   - Follow the same permission process as before

5. **Copy the Web App URL**
   - You'll see a "Web app" URL
   - Copy this URL - this is your application's URL
   - It looks like: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

### Step 6: Test the Application

1. **Open the Web App**
   - Paste the Web App URL in a new browser tab
   - You should see the Fatma Sales System login screen

2. **Login with Default Admin**
   - Username: `admin`
   - PIN: `1234`
   - Click "Login"

3. **Test Basic Functionality**
   - You should see the dashboard
   - All stat cards should show "KES 0.00" or "0"
   - Navigate through different sections using the sidebar

**🎉 Congratulations! Your Fatma Sales System is now ready to use!**

---

## Next Steps

### Add Sample Data (Optional)

Refer to `SAMPLE_DATA.md` for sample data you can add for testing.

### Create Additional Users

1. **Navigate to Settings (Admin Only)**
   - Click "Settings" in the sidebar

2. **Go to Users Tab in Spreadsheet**
   - Switch to your spreadsheet
   - Click on the "Users" tab

3. **Add New Users Manually**
   - Add rows with the following columns:
     - User_ID: USR-002, USR-003, etc.
     - Username: Choose a username
     - PIN: 4-digit PIN
     - Role: Admin or Staff
     - Email: User's email
     - Phone: User's phone
     - Status: Active
     - Created_Date: Today's date

## Security Recommendations

### 1. Change Default Admin PIN
- Go to the Users tab
- Change the admin PIN from `1234` to a secure 4-digit PIN

### 2. Restrict Spreadsheet Access
- In Google Sheets, click "Share" button
- Ensure only authorized users have edit access
- Consider using "View only" for most users
- Only the system administrator should have edit access

### 3. Set Web App Access
- For production, change "Who has access" to "Anyone with Google account"
- This ensures only users with Google accounts can access
- You can further restrict to specific domains if needed

### 4. Regular Backups
- Make copies of your spreadsheet regularly
- File → Make a copy
- Store backups in a separate location

### 5. Monitor Audit Trail
- Regularly check the Audit_Trail tab
- Look for suspicious activities
- Use the audit reports to track user activities

## Updating the Application

When you need to update the code:

1. **Make Changes in Apps Script Editor**
   - Edit the relevant .gs or .html files
   - Save all changes

2. **Create New Deployment**
   - Click "Deploy" → "Manage deployments"
   - Click the pencil icon ✏️ next to your active deployment
   - Change "Version" to "New version"
   - Add a description of changes
   - Click "Deploy"

3. **Users Get Updates Automatically**
   - Users will get the update when they refresh the page
   - The Web App URL remains the same

## Troubleshooting

### Issue: "Script function not found: doGet"
**Solution:** Make sure all code files are saved and the Code.gs file contains the `doGet()` function.

### Issue: "You do not have permission to call..."
**Solution:** Re-run the authorization process from Step 5.3.

### Issue: Dashboard shows all zeros
**Solution:** This is normal for a fresh installation. Add some sample data or make test sales.

### Issue: Login not working
**Solution:**
- Check that the Users tab has at least one user
- Verify the username and PIN are correct
- Check the browser console for errors (F12 → Console)

### Issue: Web app not loading
**Solution:**
- Verify the deployment is active
- Check that all HTML and script files are saved
- Try redeploying the web app

### Issue: "Cannot access spreadsheet"
**Solution:**
- Verify SPREADSHEET_ID in Settings tab matches your actual spreadsheet ID
- Ensure the script is bound to the correct spreadsheet

## Performance Optimization

For better performance with large datasets:

1. **Limit Data Rows**
   - Archive old sales data periodically
   - Move historical data to separate sheets

2. **Use Filters**
   - Always use date filters when generating reports
   - Avoid loading all records at once

3. **Cache Frequently Used Data**
   - The system already caches some data
   - Consider adding more caching for large datasets

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Review audit trail for anomalies
   - Check low stock items
   - Verify account balances

2. **Monthly**
   - Generate financial reports
   - Review user access
   - Backup spreadsheet
   - Archive old data if needed

3. **Quarterly**
   - Review and update expense categories
   - Update credit limits for customers
   - Review supplier terms

### Getting Help

- Check the audit trail for error messages
- Review the execution log in Apps Script
- Check browser console for JavaScript errors
- Verify all required permissions are granted

## Advanced Configuration

### Custom Business Logo
To add a custom logo to receipts:
1. Upload logo to Google Drive
2. Get shareable link
3. Add to Settings tab as `BUSINESS_LOGO_URL`
4. Modify receipt HTML in Sales.gs to include the image

### Email Notifications
To enable email notifications:
1. Use Apps Script's MailApp service
2. Add email functions in Code.gs
3. Configure triggers for specific events

### SMS Integration
For SMS notifications (e.g., to customers):
1. Sign up for an SMS API service (e.g., Africa's Talking)
2. Add API credentials to Settings
3. Create SMS functions to send notifications

## Conclusion

Your Inventory Management System is now ready to use!

**Default Login Credentials:**
- Username: `admin`
- PIN: `1234`

**⚠️ IMPORTANT: Change the default PIN immediately after first login!**

For questions or issues, refer to the README.md file or check the troubleshooting section above.
