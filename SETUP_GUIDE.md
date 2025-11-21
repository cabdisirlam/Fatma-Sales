# Inventory Management System - Setup Guide

This guide will walk you through the complete setup process for deploying the Inventory Management System using Google Apps Script and Google Sheets.

## Prerequisites

- A Google account
- Basic understanding of Google Sheets
- Web browser (Chrome, Firefox, Safari, or Edge)

## Step 1: Create the Google Spreadsheet

1. **Go to Google Sheets**
   - Navigate to [sheets.google.com](https://sheets.google.com)
   - Click on the "+" (Blank) to create a new spreadsheet

2. **Rename the Spreadsheet**
   - Click on "Untitled spreadsheet" at the top
   - Rename it to "Inventory Management System"

3. **Note the Spreadsheet ID**
   - Look at the URL in your browser
   - The URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the SPREADSHEET_ID (the long string between `/d/` and `/edit`)
   - Save this ID for later use

## Step 2: Create Sheet Tabs

Create the following 15 tabs (sheets) in your spreadsheet. You can create them manually or use the initialization script later.

**Required Tabs:**
1. Inventory
2. Sales_Data
3. Sales_Items
4. Customers
5. Customer_Transactions
6. Quotations
7. Quotation_Items
8. Suppliers
9. Purchases
10. Purchase_Items
11. Financials
12. Expenses
13. Expense_Categories
14. Users
15. Audit_Trail
16. Settings

**To create tabs manually:**
- Click the "+" button at the bottom left of the spreadsheet
- Rename each tab by right-clicking and selecting "Rename"

## Step 3: Set Up Google Apps Script

1. **Open Apps Script Editor**
   - In your spreadsheet, click on "Extensions" → "Apps Script"
   - This opens the Apps Script editor in a new tab

2. **Rename the Project**
   - Click on "Untitled project" at the top
   - Rename it to "Inventory Management System"

3. **Delete Default Code**
   - You'll see a file called "Code.gs" with some default code
   - Select all the code and delete it

## Step 4: Add the Script Files

Create the following files in Apps Script and paste the corresponding code:

### File 1: Code.gs
1. The default "Code.gs" file should already exist
2. Copy the entire content from `src/Code.gs`
3. Paste it into the Code.gs file in Apps Script editor

### File 2: Sales.gs
1. Click the "+" next to "Files" in the left sidebar
2. Select "Script"
3. Name it "Sales"
4. Copy the content from `src/Sales.gs` and paste it

### File 3: Inventory.gs
1. Click the "+" next to "Files"
2. Select "Script"
3. Name it "Inventory"
4. Copy the content from `src/Inventory.gs` and paste it

### File 4: Customers.gs
1. Create a new script file named "Customers"
2. Copy the content from `src/Customers.gs` and paste it

### File 5: Financials.gs
1. Create a new script file named "Financials"
2. Copy the content from `src/Financials.gs` and paste it

### File 6: Quotations.gs
1. Create a new script file named "Quotations"
2. Copy the content from `src/Quotations.gs` and paste it

### File 7: AuditLogger.gs
1. Create a new script file named "AuditLogger"
2. Copy the content from `src/AuditLogger.gs` and paste it

### File 8: Index.html
1. Click the "+" next to "Files"
2. Select "HTML"
3. Name it "Index"
4. Copy the entire content from `src/Index.html` and paste it

## Step 5: Save and Run Initialization

1. **Save All Files**
   - Click the disk icon or press Ctrl+S (Cmd+S on Mac)
   - Ensure all files are saved

2. **Run Initialization Function**
   - In the Apps Script editor, select "Code.gs" from the files list
   - In the function dropdown (next to the debug icon), select `initializeSheets`
   - Click the "Run" button (▶️ play icon)

3. **Grant Permissions**
   - You'll see a dialog asking for permissions
   - Click "Review Permissions"
   - Select your Google account
   - Click "Advanced" → "Go to Inventory Management System (unsafe)"
   - Click "Allow"

4. **Wait for Initialization**
   - The function will create all sheet tabs with headers
   - Create a default admin user (Username: `admin`, PIN: `1234`)
   - Initialize expense categories
   - Initialize account balances

5. **Check the Execution Log**
   - Click "Execution log" at the bottom
   - You should see messages like "Initialized sheet: Inventory"
   - If you see errors, check that all tabs are created correctly

## Step 6: Configure Business Settings

1. **Go to the Settings Tab**
   - Switch back to your spreadsheet
   - Click on the "Settings" tab

2. **Add Business Information**
   - Add the following rows (Setting_Key in column A, Setting_Value in column B):

   | Setting_Key | Setting_Value |
   |-------------|---------------|
   | BUSINESS_NAME | Your Business Name |
   | BUSINESS_KRA | P000000000A |
   | BUSINESS_LOCATION | Nairobi, Kenya |
   | BUSINESS_PHONE | +254 700 000000 |
   | BUSINESS_EMAIL | info@yourbusiness.com |
   | SPREADSHEET_ID | (Paste your Spreadsheet ID from Step 1) |

## Step 7: Deploy as Web App

1. **Return to Apps Script Editor**

2. **Click "Deploy" → "New deployment"**

3. **Configure Deployment**
   - Click the gear icon ⚙️ next to "Select type"
   - Select "Web app"

4. **Fill in Deployment Details**
   - **Description:** "Inventory Management System v1"
   - **Execute as:** "Me (your email)"
   - **Who has access:** "Anyone" (or "Anyone with Google account" for more security)

5. **Click "Deploy"**

6. **Authorize Again**
   - You may need to authorize again
   - Follow the same permission process as in Step 5

7. **Copy the Web App URL**
   - You'll see a "Web app" URL
   - Copy this URL - this is your application's URL
   - It looks like: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

## Step 8: Test the Application

1. **Open the Web App**
   - Paste the Web App URL in a new browser tab
   - You should see the login screen

2. **Login with Default Admin**
   - Username: `admin`
   - PIN: `1234`
   - Click "Login"

3. **Test Basic Functionality**
   - You should see the dashboard
   - All stat cards should show "KES 0.00" or "0"
   - Navigate through different sections using the sidebar

## Step 9: Add Sample Data (Optional)

Refer to `SAMPLE_DATA.md` for sample data you can add for testing.

## Step 10: Create Additional Users

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
