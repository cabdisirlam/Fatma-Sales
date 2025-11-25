# Automated Features Setup Guide

This guide will help you set up the automated email alerts and payment reminders for the Fatma Sales Management System.

## Features Overview

### 1. Low Stock Email Alerts
Automatically sends daily email notifications when inventory items are running low or out of stock.

### 2. Payment Reminder System
Automatically sends weekly email reminders to customers with outstanding balances.

---

## Prerequisites

Before setting up automation, make sure you have:

1. **Admin Email Configured**: Add `Admin_Email` to your Settings sheet with your email address
2. **Business Name Configured**: Add `Business_Name` to your Settings sheet with your business name
3. **Customer Emails**: Ensure customers have valid email addresses for payment reminders

### How to Add Settings

1. Open your Google Spreadsheet
2. Go to the **Settings** sheet
3. Add these rows:

| Setting_Key | Setting_Value |
|------------|---------------|
| Admin_Email | your-email@example.com |
| Business_Name | Fatma Sales |

---

## Setup Instructions

### 1. Low Stock Email Alerts Setup

This feature sends daily email alerts at 8:00 AM with a summary of low stock and out-of-stock items.

**To Enable:**

1. Open your Google Spreadsheet
2. Go to **Extensions** → **Apps Script**
3. In the Apps Script editor, find the function **`createLowStockAlertTrigger`** in `fInventory.gs`
4. Run this function once:
   - Select `createLowStockAlertTrigger` from the function dropdown
   - Click the **Run** button (▶️)
   - Authorize the script when prompted
5. The trigger is now active and will run daily at 8:00 AM

**Email Content:**
- Out of Stock items (red section)
- Low Stock items (yellow section)
- Item details: ID, Name, Category, Current Qty, Reorder Level, Supplier

**To Test:**
You can manually trigger an alert by running the `sendLowStockAlert()` function from Apps Script.

**To Disable:**
1. Go to **Extensions** → **Apps Script** → **Triggers** (clock icon)
2. Find the trigger for `sendLowStockAlert`
3. Click the three dots (⋮) and select **Delete trigger**

---

### 2. Payment Reminder System Setup

This feature sends weekly email reminders every Monday at 9:00 AM to customers with outstanding balances.

**To Enable:**

1. Open your Google Spreadsheet
2. Go to **Extensions** → **Apps Script**
3. In the Apps Script editor, find the function **`createPaymentReminderTrigger`** in `dCustomers.gs`
4. Run this function once:
   - Select `createPaymentReminderTrigger` from the function dropdown
   - Click the **Run** button (▶️)
   - Authorize the script when prompted
5. The trigger is now active and will run every Monday at 9:00 AM

**Email Content:**
- Professional payment reminder with outstanding balance in KSh
- Payment methods information (M-Pesa, Bank Transfer, Cash)
- Business branding

**Admin Summary Email:**
After sending reminders, an admin summary is sent to the Admin_Email with:
- Total customers with debt
- Number of reminders sent
- Failed/no email count
- Detailed status table

**Manual Reminder:**
You can send a reminder to a specific customer using:
```javascript
sendPaymentReminder('CUST-001');
```

**To Test:**
You can manually trigger reminders by running the `sendAllPaymentReminders()` function from Apps Script.

**To Disable:**
1. Go to **Extensions** → **Apps Script** → **Triggers** (clock icon)
2. Find the trigger for `sendAllPaymentReminders`
3. Click the three dots (⋮) and select **Delete trigger**

---

## Trigger Management

### View Active Triggers

1. Go to **Extensions** → **Apps Script**
2. Click the **Triggers** icon (clock) in the left sidebar
3. You'll see all active triggers for your project

### Modify Trigger Schedule

If you want to change the schedule (e.g., send reminders on Fridays instead of Mondays):

1. Delete the existing trigger using the steps above
2. Modify the trigger creation code in Apps Script:

**Example: Change payment reminders to Friday at 10 AM**
```javascript
ScriptApp.newTrigger('sendAllPaymentReminders')
  .timeBased()
  .onWeekDay(ScriptApp.WeekDay.FRIDAY)
  .atHour(10)
  .create();
```

3. Run the modified trigger creation function again

---

## Troubleshooting

### Emails Not Sending

**Check Authorization:**
1. Go to **Extensions** → **Apps Script**
2. Run the trigger creation function manually
3. Grant all requested permissions

**Check Email Quota:**
Google Apps Script has daily email quotas:
- Free Gmail: 100 emails/day
- Google Workspace: 1,500 emails/day

**Check Spam Folder:**
Automated emails might end up in spam. Add your script's email to contacts.

### Trigger Not Running

**Verify Trigger Exists:**
1. Go to **Triggers** in Apps Script
2. Confirm the trigger is listed and active

**Check Execution Log:**
1. In Apps Script, click **Executions** (list icon)
2. Review recent executions for errors
3. Click on any failed execution to see error details

### Customer Not Receiving Reminder

**Common Reasons:**
1. Customer has no email address in the system
2. Email address is invalid
3. Email is in customer's spam folder
4. Customer's email quota is full

**Check Admin Summary:**
The admin summary email shows which customers received reminders and which failed.

---

## Email Customization

### Customize Low Stock Alert Email

Edit the `sendLowStockAlert()` function in `fInventory.gs`:

1. Modify the `emailBody` variable to change the HTML content
2. Change colors, add your logo, or adjust the layout
3. Update the subject line

### Customize Payment Reminder Email

Edit the `sendPaymentReminder()` function in `dCustomers.gs`:

1. Modify the `emailBody` variable to change the message
2. Update payment methods section
3. Add additional business information
4. Customize subject line

---

## Best Practices

### Inventory Management
1. **Set Realistic Reorder Levels**: Configure appropriate reorder levels for each product
2. **Review Alerts Regularly**: Check daily emails and take action on low stock items
3. **Update Supplier Info**: Keep supplier information current for quick reordering

### Payment Reminders
1. **Maintain Customer Emails**: Ensure all customers have valid, up-to-date email addresses
2. **Set Credit Limits**: Configure appropriate credit limits for customers
3. **Follow Up Personally**: Use automated reminders as a starting point, follow up with phone calls for large balances
4. **Monitor Admin Summaries**: Review weekly summary emails to track payment reminder effectiveness

### Email Deliverability
1. **Avoid Spam Triggers**: Don't modify emails to include spam-like content
2. **Professional Tone**: Keep emails professional and friendly
3. **Clear Contact Info**: Include your business contact information in emails
4. **Unsubscribe Option**: Consider adding an opt-out option for automated emails

---

## Advanced Configuration

### Change Email Sending Time

You can configure different times for different time zones:

**Low Stock Alerts** (default: 8:00 AM):
```javascript
ScriptApp.newTrigger('sendLowStockAlert')
  .timeBased()
  .atHour(8)  // Change this number (0-23)
  .everyDays(1)
  .create();
```

**Payment Reminders** (default: Monday 9:00 AM):
```javascript
ScriptApp.newTrigger('sendAllPaymentReminders')
  .timeBased()
  .onWeekDay(ScriptApp.WeekDay.MONDAY)
  .atHour(9)  // Change this number (0-23)
  .create();
```

### Multiple Reminder Schedules

You can create multiple triggers for different frequencies:

**Example: Send reminders twice weekly (Monday and Thursday)**
```javascript
// Monday at 9 AM
ScriptApp.newTrigger('sendAllPaymentReminders')
  .timeBased()
  .onWeekDay(ScriptApp.WeekDay.MONDAY)
  .atHour(9)
  .create();

// Thursday at 9 AM
ScriptApp.newTrigger('sendAllPaymentReminders')
  .timeBased()
  .onWeekDay(ScriptApp.WeekDay.THURSDAY)
  .atHour(9)
  .create();
```

---

## Support

If you encounter issues:

1. Check the execution logs in Apps Script
2. Verify your settings in the Settings sheet
3. Review the troubleshooting section above
4. Test functions manually before setting up triggers

---

## Summary of Setup Steps

✅ **One-Time Setup:**
1. Add Admin_Email and Business_Name to Settings sheet
2. Run `createLowStockAlertTrigger()` once
3. Run `createPaymentReminderTrigger()` once

✅ **Ongoing:**
1. Monitor daily low stock emails
2. Review weekly payment reminder summaries
3. Keep customer emails updated
4. Adjust reorder levels as needed

✅ **Optional:**
1. Customize email templates
2. Modify trigger schedules
3. Add multiple reminder frequencies

---

**Last Updated:** 2025-11-25
**System Version:** Fatma Sales Management v2.0
