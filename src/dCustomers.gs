/**
 * Customer Management Module
 * Handles: Customer database, customer information, purchase history, balances
 */

// =====================================================
// CUSTOMER FUNCTIONS
// =====================================================

/**
 * Get all customers with optional filters
 */
function getCustomers(filters) {
  try {
    const sheet = getSheet('Customers');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    const headers = data[0];
    const customers = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const customer = {};

      headers.forEach((header, index) => {
        customer[header] = row[index];
      });

      // Apply filters if provided
      if (filters) {
        let matches = true;
        for (let key in filters) {
          if (customer[key] !== filters[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      customers.push(customer);
    }

    return customers;

  } catch (error) {
    logError('getCustomers', error);
    throw new Error('Error loading customers: ' + error.message);
  }
}

/**
 * Get customer by ID
 */
function getCustomerById(customerId) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) {
      throw new Error('Customer not found: ' + customerId);
    }
    return customer;
  } catch (error) {
    logError('getCustomerById', error);
    throw new Error('Error loading customer: ' + error.message);
  }
}

/**
 * Search customers by name, phone, or email
 */
function searchCustomers(query) {
  try {
    if (!query) {
      return getCustomers();
    }

    const customers = getCustomers();
    const lowerQuery = query.toLowerCase();

    return customers.filter(customer => {
      return (customer.Customer_ID && customer.Customer_ID.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (customer.Customer_Name && customer.Customer_Name.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (customer.Phone && customer.Phone.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (customer.Email && customer.Email.toLowerCase().indexOf(lowerQuery) !== -1);
    });

  } catch (error) {
    logError('searchCustomers', error);
    return [];
  }
}

/**
 * Add new customer
 */
function addCustomer(customerData) {
  try {
    validateRequired(customerData, ['Customer_Name', 'Phone']);

    const sheet = getSheet('Customers');
    const customerId = generateId('Customers', 'Customer_ID', 'CUST');

    const newCustomer = [
      customerId,
      customerData.Customer_Name || '',
      customerData.Phone || '',
      customerData.Email || '',
      customerData.Location || '',
      customerData.KRA_PIN || '',
      customerData.Customer_Type || 'Walk-in',
      parseFloat(customerData.Credit_Limit) || 0,
      0, // Current_Balance (starts at 0)
      0, // Total_Purchases (starts at 0)
      '', // Last_Purchase_Date (empty initially)
      0, // Loyalty_Points (starts at 0)
      'Active',
      new Date(),
      customerData.Created_By || 'SYSTEM'
    ];

    sheet.appendRow(newCustomer);

    logAudit(
      customerData.Created_By || 'SYSTEM',
      'Customers',
      'Create',
      'New customer added: ' + customerData.Customer_Name + ' (ID: ' + customerId + ')',
      '',
      '',
      JSON.stringify(newCustomer)
    );

    return {
      success: true,
      customerId: customerId,
      message: 'Customer added successfully'
    };

  } catch (error) {
    logError('addCustomer', error);
    throw new Error('Error adding customer: ' + error.message);
  }
}

/**
 * Update customer information
 */
function updateCustomer(customerId, customerData) {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Get current values for audit
    const currentCustomer = getCustomerById(customerId);

    // Update the customer
    const updates = {};
    if (customerData.Customer_Name !== undefined) updates.Customer_Name = customerData.Customer_Name;
    if (customerData.Phone !== undefined) updates.Phone = customerData.Phone;
    if (customerData.Email !== undefined) updates.Email = customerData.Email;
    if (customerData.Location !== undefined) updates.Location = customerData.Location;
    if (customerData.KRA_PIN !== undefined) updates.KRA_PIN = customerData.KRA_PIN;
    if (customerData.Customer_Type !== undefined) updates.Customer_Type = customerData.Customer_Type;
    if (customerData.Credit_Limit !== undefined) updates.Credit_Limit = parseFloat(customerData.Credit_Limit);
    if (customerData.Status !== undefined) updates.Status = customerData.Status;

    const result = updateRowById('Customers', 'Customer_ID', customerId, updates);

    logAudit(
      customerData.User || 'SYSTEM',
      'Customers',
      'Update',
      'Customer updated: ' + customerId,
      '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Customer updated successfully'
    };

  } catch (error) {
    logError('updateCustomer', error);
    throw new Error('Error updating customer: ' + error.message);
  }
}

/**
 * Delete customer
 */
function deleteCustomer(customerId, user) {
  try {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Get customer info before deleting
    const customer = getCustomerById(customerId);

    // Check if customer has outstanding balance
    if (parseFloat(customer.Current_Balance) > 0) {
      throw new Error('Cannot delete customer with outstanding balance: ' + formatCurrency(customer.Current_Balance));
    }

    const sheet = getSheet('Customers');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const customerIdIndex = headers.indexOf('Customer_ID');

    // Find and delete row
    for (let i = 1; i < data.length; i++) {
      if (data[i][customerIdIndex] === customerId) {
        sheet.deleteRow(i + 1);

        logAudit(
          user || 'SYSTEM',
          'Customers',
          'Delete',
          'Customer deleted: ' + customer.Customer_Name + ' (ID: ' + customerId + ')',
          '',
          JSON.stringify(customer),
          ''
        );

        return {
          success: true,
          message: 'Customer deleted successfully'
        };
      }
    }

    throw new Error('Customer not found');

  } catch (error) {
    logError('deleteCustomer', error);
    throw new Error('Error deleting customer: ' + error.message);
  }
}

/**
 * Update customer balance (after sale or payment)
 */
function updateCustomerBalance(customerId, amountChange, user) {
  try {
    const customer = getCustomerById(customerId);
    const currentBalance = parseFloat(customer.Current_Balance) || 0;
    const newBalance = currentBalance + parseFloat(amountChange);

    updateRowById('Customers', 'Customer_ID', customerId, {
      Current_Balance: newBalance
    });

    logAudit(
      user || 'SYSTEM',
      'Customers',
      'Balance Update',
      'Customer balance updated: ' + customer.Customer_Name + ' by ' + formatCurrency(amountChange),
      '',
      'Balance: ' + currentBalance,
      'Balance: ' + newBalance
    );

    return {
      success: true,
      oldBalance: currentBalance,
      newBalance: newBalance
    };

  } catch (error) {
    logError('updateCustomerBalance', error);
    throw error;
  }
}

/**
 * Update customer purchase stats (after sale)
 */
function updateCustomerPurchaseStats(customerId, amount, user) {
  try {
    const customer = getCustomerById(customerId);
    const totalPurchases = (parseFloat(customer.Total_Purchases) || 0) + parseFloat(amount);

    // Calculate loyalty points (1 point per 100 KES spent)
    const pointsEarned = Math.floor(parseFloat(amount) / 100);
    const totalPoints = (parseFloat(customer.Loyalty_Points) || 0) + pointsEarned;

    updateRowById('Customers', 'Customer_ID', customerId, {
      Total_Purchases: totalPurchases,
      Last_Purchase_Date: new Date(),
      Loyalty_Points: totalPoints
    });

    return {
      success: true,
      totalPurchases: totalPurchases,
      pointsEarned: pointsEarned,
      totalPoints: totalPoints
    };

  } catch (error) {
    logError('updateCustomerPurchaseStats', error);
    throw error;
  }
}

/**
 * Get customer purchase history
 */
function getCustomerPurchaseHistory(customerId) {
  try {
    const sales = sheetToObjects('Sales');

    // Filter sales for this customer (Type = 'Sale')
    const customerSales = sales.filter(sale => {
      return sale.Customer_ID === customerId && sale.Type === 'Sale';
    });

    // Group by Transaction_ID to get unique transactions
    const transactions = {};
    customerSales.forEach(sale => {
      if (!transactions[sale.Transaction_ID]) {
        transactions[sale.Transaction_ID] = {
          Transaction_ID: sale.Transaction_ID,
          DateTime: sale.DateTime,
          Grand_Total: sale.Grand_Total,
          Payment_Mode: sale.Payment_Mode,
          Sold_By: sale.Sold_By,
          items: []
        };
      }
      transactions[sale.Transaction_ID].items.push({
        Item_Name: sale.Item_Name,
        Qty: sale.Qty,
        Unit_Price: sale.Unit_Price,
        Line_Total: sale.Line_Total
      });
    });

    // Convert to array and sort by date descending
    const history = Object.values(transactions);
    history.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return history;

  } catch (error) {
    logError('getCustomerPurchaseHistory', error);
    return [];
  }
}

/**
 * Get customer payment history
 */
function getCustomerPaymentHistory(customerId) {
  try {
    const financials = sheetToObjects('Financials');

    // Filter for customer payments
    const payments = financials.filter(txn => {
      return txn.Customer_ID === customerId &&
             (txn.Type === 'Customer_Payment' || txn.Type === 'Sale_Payment');
    });

    // Sort by date descending
    payments.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return payments;

  } catch (error) {
    logError('getCustomerPaymentHistory', error);
    return [];
  }
}

/**
 * Get customers with outstanding balances
 */
function getCustomersWithDebt() {
  try {
    const customers = getCustomers();
    return customers.filter(customer => {
      return parseFloat(customer.Current_Balance) > 0;
    }).sort((a, b) => {
      return parseFloat(b.Current_Balance) - parseFloat(a.Current_Balance);
    });
  } catch (error) {
    logError('getCustomersWithDebt', error);
    return [];
  }
}

/**
 * Get customer statement (purchases + payments)
 */
function getCustomerStatement(customerId, startDate, endDate) {
  try {
    const customer = getCustomerById(customerId);
    const purchases = getCustomerPurchaseHistory(customerId);
    const payments = getCustomerPaymentHistory(customerId);

    // Combine and sort by date
    const transactions = [];

    purchases.forEach(purchase => {
      transactions.push({
        date: new Date(purchase.DateTime),
        type: 'Sale',
        description: 'Sale #' + purchase.Transaction_ID,
        debit: purchase.Grand_Total,
        credit: 0,
        reference: purchase.Transaction_ID
      });
    });

    payments.forEach(payment => {
      transactions.push({
        date: new Date(payment.DateTime),
        type: 'Payment',
        description: payment.Description || 'Payment',
        debit: 0,
        credit: payment.Amount,
        reference: payment.Transaction_ID
      });
    });

    // Filter by date range if provided
    let filteredTransactions = transactions;
    if (startDate) {
      const start = new Date(startDate);
      filteredTransactions = filteredTransactions.filter(t => t.date >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      filteredTransactions = filteredTransactions.filter(t => t.date <= end);
    }

    // Sort by date ascending
    filteredTransactions.sort((a, b) => a.date - b.date);

    // Calculate running balance
    let balance = 0;
    filteredTransactions.forEach(txn => {
      balance += (txn.debit - txn.credit);
      txn.balance = balance;
    });

    return {
      customer: customer,
      transactions: filteredTransactions,
      openingBalance: 0,
      closingBalance: balance,
      totalDebits: filteredTransactions.reduce((sum, t) => sum + t.debit, 0),
      totalCredits: filteredTransactions.reduce((sum, t) => sum + t.credit, 0)
    };

  } catch (error) {
    logError('getCustomerStatement', error);
    throw new Error('Error generating customer statement: ' + error.message);
  }
}

/**
 * Get or create walk-in customer
 */
function getOrCreateWalkInCustomer() {
  try {
    const customers = getCustomers();

    // Look for existing walk-in customer
    const walkIn = customers.find(c =>
      c.Customer_Name === 'Walk-in Customer' ||
      c.Customer_Type === 'Walk-in'
    );

    if (walkIn) {
      return walkIn;
    }

    // Create walk-in customer
    const result = addCustomer({
      Customer_Name: 'Walk-in Customer',
      Phone: 'N/A',
      Email: '',
      Location: '',
      KRA_PIN: '',
      Customer_Type: 'Walk-in',
      Credit_Limit: 0,
      Created_By: 'SYSTEM'
    });

    return getCustomerById(result.customerId);

  } catch (error) {
    logError('getOrCreateWalkInCustomer', error);
    throw new Error('Error getting walk-in customer: ' + error.message);
  }
}

// =====================================================
// PAYMENT REMINDER FUNCTIONS
// =====================================================

/**
 * Send payment reminder to a specific customer
 * @param {string} customerId - Customer ID
 * @param {string} businessName - Optional business name (to avoid repeated Settings reads)
 */
function sendPaymentReminder(customerId, businessName) {
  try {
    const customer = getCustomerById(customerId);
    const balance = parseFloat(customer.Current_Balance) || 0;

    if (balance <= 0) {
      return { success: false, message: 'Customer has no outstanding balance' };
    }

    // Check if customer has email
    if (!customer.Email || customer.Email === '') {
      return { success: false, message: 'Customer has no email address' };
    }

    // Get business name from settings if not provided
    if (!businessName) {
      const settings = sheetToObjects('Settings');
      const businessNameSetting = settings.find(s => s.Setting_Key === 'Business_Name');
      businessName = businessNameSetting ? businessNameSetting.Setting_Value : 'Fatma Sales';
    }

    // Build email content
    let emailBody = '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
    emailBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">';
    emailBody += '<h2 style="margin: 0;">💳 Payment Reminder</h2>';
    emailBody += '</div>';
    emailBody += '<div style="padding: 30px; background: #f9f9f9;">';
    emailBody += '<p>Dear <strong>' + customer.Customer_Name + '</strong>,</p>';
    emailBody += '<p>This is a friendly reminder that you have an outstanding balance with ' + businessName + '.</p>';
    emailBody += '<div style="background: white; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0;">';
    emailBody += '<h3 style="color: #e74c3c; margin-top: 0;">Outstanding Balance</h3>';
    emailBody += '<p style="font-size: 28px; font-weight: bold; color: #2c3e50; margin: 10px 0;">KSh ' + balance.toLocaleString('en-KE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</p>';
    emailBody += '</div>';

    emailBody += '<p>Please arrange to settle this amount at your earliest convenience.</p>';

    // Payment methods section
    emailBody += '<div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">';
    emailBody += '<h4 style="color: #667eea; margin-top: 0;">Payment Methods</h4>';
    emailBody += '<ul style="list-style: none; padding: 0;">';
    emailBody += '<li style="padding: 5px 0;">📱 <strong>M-Pesa:</strong> Pay via M-Pesa</li>';
    emailBody += '<li style="padding: 5px 0;">🏦 <strong>Bank Transfer:</strong> Equity Bank</li>';
    emailBody += '<li style="padding: 5px 0;">💵 <strong>Cash:</strong> Visit our location</li>';
    emailBody += '</ul>';
    emailBody += '</div>';

    emailBody += '<p>If you have any questions or concerns regarding this balance, please don\'t hesitate to contact us.</p>';
    emailBody += '<p style="margin-top: 30px;">Thank you for your business!</p>';
    emailBody += '<p><strong>' + businessName + '</strong></p>';
    emailBody += '</div>';
    emailBody += '<div style="background: #2c3e50; color: #bdc3c7; padding: 20px; text-align: center; font-size: 12px;">';
    emailBody += '<p style="margin: 5px 0;">This is an automated reminder from ' + businessName + '</p>';
    emailBody += '<p style="margin: 5px 0;">Generated on: ' + new Date().toLocaleString() + '</p>';
    emailBody += '</div>';
    emailBody += '</body></html>';

    // Send email
    MailApp.sendEmail({
      to: customer.Email,
      subject: '💳 Payment Reminder - Outstanding Balance KSh ' + balance.toLocaleString('en-KE'),
      htmlBody: emailBody
    });

    logAudit(
      'SYSTEM',
      'Customers',
      'Payment Reminder',
      'Reminder sent to ' + customer.Customer_Name + ' for KSh ' + balance.toLocaleString('en-KE'),
      '',
      '',
      customer.Customer_ID
    );

    return {
      success: true,
      message: 'Payment reminder sent to ' + customer.Email,
      balance: balance
    };

  } catch (error) {
    logError('sendPaymentReminder', error);
    throw new Error('Error sending payment reminder: ' + error.message);
  }
}

/**
 * Send payment reminders to all customers with outstanding balances
 * This function should be triggered weekly via a time-based trigger
 */
function sendAllPaymentReminders() {
  try {
    const customersWithDebt = getCustomersWithDebt();

    if (customersWithDebt.length === 0) {
      Logger.log('No customers with outstanding balances');
      return { success: true, message: 'No customers with debt', count: 0 };
    }

    // Read settings once for efficiency
    const settings = sheetToObjects('Settings');
    const businessNameSetting = settings.find(s => s.Setting_Key === 'Business_Name');
    const businessName = businessNameSetting ? businessNameSetting.Setting_Value : 'Fatma Sales';
    const adminEmailSetting = settings.find(s => s.Setting_Key === 'Admin_Email');
    const adminEmail = adminEmailSetting ? adminEmailSetting.Setting_Value : Session.getActiveUser().getEmail();

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    customersWithDebt.forEach(customer => {
      // Only send to customers with email addresses
      if (customer.Email && customer.Email !== '') {
        try {
          const result = sendPaymentReminder(customer.Customer_ID, businessName);
          if (result.success) {
            sentCount++;
          } else {
            failedCount++;
          }
          results.push({
            customerId: customer.Customer_ID,
            customerName: customer.Customer_Name,
            balance: customer.Current_Balance,
            result: result
          });
        } catch (error) {
          failedCount++;
          results.push({
            customerId: customer.Customer_ID,
            customerName: customer.Customer_Name,
            balance: customer.Current_Balance,
            error: error.message
          });
        }
      }
    });

    // Send summary to admin

    let summaryEmail = '<html><body style="font-family: Arial, sans-serif;">';
    summaryEmail += '<h2 style="color: #667eea;">📧 Payment Reminders Summary</h2>';
    summaryEmail += '<p><strong>Total customers with debt:</strong> ' + customersWithDebt.length + '</p>';
    summaryEmail += '<p><strong>Reminders sent:</strong> ' + sentCount + '</p>';
    summaryEmail += '<p><strong>Failed/No email:</strong> ' + failedCount + '</p>';
    summaryEmail += '<hr>';
    summaryEmail += '<h3>Details:</h3>';
    summaryEmail += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
    summaryEmail += '<tr style="background-color: #f0f0f0;"><th>Customer</th><th>Balance (KSh)</th><th>Status</th></tr>';

    results.forEach(r => {
      const status = r.result ? (r.result.success ? '✅ Sent' : '❌ ' + r.result.message) : '❌ ' + r.error;
      summaryEmail += '<tr>';
      summaryEmail += '<td>' + r.customerName + '</td>';
      summaryEmail += '<td>KSh ' + parseFloat(r.balance).toLocaleString('en-KE', {minimumFractionDigits: 2}) + '</td>';
      summaryEmail += '<td>' + status + '</td>';
      summaryEmail += '</tr>';
    });

    summaryEmail += '</table>';
    summaryEmail += '<br><p style="color: #7f8c8d; font-size: 12px;">Generated on: ' + new Date().toLocaleString() + '</p>';
    summaryEmail += '</body></html>';

    MailApp.sendEmail({
      to: adminEmail,
      subject: '📧 Payment Reminders Summary - ' + sentCount + ' sent',
      htmlBody: summaryEmail
    });

    return {
      success: true,
      message: 'Sent ' + sentCount + ' reminders',
      sent: sentCount,
      failed: failedCount,
      total: customersWithDebt.length,
      results: results
    };

  } catch (error) {
    logError('sendAllPaymentReminders', error);
    throw new Error('Error sending payment reminders: ' + error.message);
  }
}

/**
 * Create time-based trigger for weekly payment reminders
 * Run this once to set up weekly reminders on Monday at 9 AM
 */
function createPaymentReminderTrigger() {
  try {
    // Delete existing triggers for this function
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendAllPaymentReminders') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Create new trigger for Monday at 9 AM weekly
    ScriptApp.newTrigger('sendAllPaymentReminders')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(9)
      .create();

    return { success: true, message: 'Payment reminder trigger created for Mondays at 9 AM' };

  } catch (error) {
    logError('createPaymentReminderTrigger', error);
    throw new Error('Error creating trigger: ' + error.message);
  }
}
