/**
 * Customer Management Module
 * Handles: Customer database, customer information, purchase history, balances
 */

// =====================================================
// CUSTOMER FUNCTIONS
// =====================================================

/**
 * Get all customers with optional filters and pagination
 * ✅ IMPROVED: Added pagination support for large datasets
 * FIXED: Sanitizes Date objects to prevent "Uncaught hz" errors
 *
 * @param {Object} filters - Optional filters to apply
 * @param {number} filters.limit - Maximum number of records to return (default: all)
 * @param {number} filters.offset - Number of records to skip (default: 0)
 * @param {string} filters.status - Filter by status (e.g., 'Active')
 * @param {string} filters.Customer_Type - Filter by customer type
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

    // Extract pagination parameters
    const limit = (filters && filters.limit) ? parseInt(filters.limit) : null;
    const offset = (filters && filters.offset) ? parseInt(filters.offset) : 0;

    let recordsProcessed = 0;
    let recordsSkipped = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const customer = {};

      headers.forEach((header, index) => {
        let value = row[index];

        // CRITICAL FIX: Convert Date objects to strings to prevent "hz" error
        if (value instanceof Date) {
          value = value.toISOString();
        }
        // Ensure no undefined/null values
        if (value === null || value === undefined) {
          value = "";
        }

        customer[header] = value;
      });

      // Apply filters if provided (excluding pagination params)
      if (filters) {
        let matches = true;
        for (let key in filters) {
          // Skip pagination parameters
          if (key === 'limit' || key === 'offset') continue;

          if (customer[key] !== filters[key]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }

      // ✅ NEW: Pagination logic
      // Skip records based on offset
      if (recordsSkipped < offset) {
        recordsSkipped++;
        continue;
      }

      // Add to results
      customers.push(customer);
      recordsProcessed++;

      // Stop if we've reached the limit
      if (limit && recordsProcessed >= limit) {
        break;
      }
    }

    return customers;
  } catch (error) {
    logError('getCustomers', error);
    // Return empty array instead of throwing to prevent UI freeze
    return [];
  }
}

/**
 * Get customer by ID
 */
function getCustomerById(customerId) {
  try {
    const customer = findRowById('Customers', 'Customer_ID', customerId);
    if (!customer) throw new Error('Customer not found: ' + customerId);
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
    const lowerQuery = String(query).toLowerCase();

    const normalizeField = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).toLowerCase();
    };

    return customers.filter(customer => {
      const customerId = normalizeField(customer.Customer_ID);
      const name = normalizeField(customer.Customer_Name);
      const phone = normalizeField(customer.Phone);
      const email = normalizeField(customer.Email);

      return customerId.indexOf(lowerQuery) !== -1 ||
             name.indexOf(lowerQuery) !== -1 ||
             phone.indexOf(lowerQuery) !== -1 ||
             email.indexOf(lowerQuery) !== -1;
    });

  } catch (error) {
    logError('searchCustomers', error);
    return [];
  }
}

/**
 * Add new customer
 * V3.0: Complete validation and column mapping
 * Headers: Customer_ID, Customer_Name, Phone, Email, Location, KRA_PIN, Customer_Type, Credit_Limit, Current_Balance, Total_Purchases, Last_Purchase_Date, Loyalty_Points, Status, Created_Date, Created_By
 */
function addCustomer(customerData) {
  try {
    // ✅ IMPROVED: Enhanced validation with normalization
    // Validation: Required fields
    if (!customerData || !customerData.Customer_Name) {
      throw new Error('Customer Name is required');
    }

    if (!customerData.Phone || customerData.Phone.trim() === '') {
      throw new Error('Phone number is required');
    }

    // ✅ NEW: Validate and normalize phone number
    const phoneValidation = validatePhone(customerData.Phone);
    if (!phoneValidation.valid) {
      throw new Error('Invalid phone number: ' + phoneValidation.error);
    }

    // ✅ NEW: Validate email if provided
    let normalizedEmail = '';
    if (customerData.Email && customerData.Email.trim() !== '') {
      const emailValidation = validateEmail(customerData.Email);
      if (!emailValidation.valid) {
        throw new Error('Invalid email: ' + emailValidation.error);
      }
      normalizedEmail = emailValidation.normalized;
    }

    // ✅ NEW: Validate KRA PIN if provided
    let normalizedKraPin = '';
    if (customerData.KRA_PIN && customerData.KRA_PIN.trim() !== '') {
      const kraPinValidation = validateKraPin(customerData.KRA_PIN, false);
      if (!kraPinValidation.valid) {
        throw new Error('Invalid KRA PIN: ' + kraPinValidation.error);
      }
      normalizedKraPin = kraPinValidation.normalized;
    }

    const sheet = getSheet('Customers');
    const customerId = generateId('Customers', 'Customer_ID', 'CUST');

    // Handle opening balance (positive means customer owes)
    let openingBalance = parseFloat(customerData.Opening_Balance || customerData.Current_Balance) || 0;

    const createdBy = customerData.User || 'SYSTEM';

    // HARD-CODED COLUMN MAPPING (matches createCustomersSheet exactly)
    const initialPoints = parseInt(customerData.Loyalty_Points) || 0;

    const newCustomer = [
      customerId,                                      // 1. Customer_ID
      customerData.Customer_Name.trim(),               // 2. Customer_Name
      phoneValidation.normalized,                      // 3. Phone (normalized to +254...)
      normalizedEmail,                                 // 4. Email (normalized)
      customerData.Location || '',                     // 5. Location
      normalizedKraPin,                                // 6. KRA_PIN (normalized)
      customerData.Customer_Type || 'Walk-in',         // 7. Customer_Type
      parseFloat(customerData.Credit_Limit) || 0,      // 8. Credit_Limit
      openingBalance,                                  // 9. Current_Balance
      openingBalance,                                  // 10. Opening_Balance
      0,                                               // 11. Total_Paid
      0,                                               // 12. Total_Purchases
      '',                                              // 13. Last_Purchase_Date
      initialPoints,                                   // 14. Loyalty_Points
      'Active',                                        // 15. Status
      new Date(),                                      // 16. Created_Date
      createdBy                                        // 17. Created_By
    ];

    sheet.appendRow(newCustomer);

    logAudit(
      createdBy,
      'Customers',
      'Create',
      'New customer: ' + customerData.Customer_Name + ' (Phone: ' + customerData.Phone + ')',
      '',
      '',
      JSON.stringify({customerId, name: customerData.Customer_Name})
    );

    return { success: true, customerId: customerId, message: 'Customer added successfully' };
  } catch (error) {
    logError('addCustomer', error);
    return { success: false, message: 'Error adding customer: ' + error.message };
  }
}

/**
 * Update customer information
 */
function updateCustomer(customerId, customerData) {
  try {
    if (!customerId) return { success: false, message: 'Customer ID is required' };

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
    logAudit(customerData.User || 'SYSTEM', 'Customers', 'Update', 'Customer updated: ' + customerId, '', result.beforeValue, result.afterValue);

    return { success: true, message: 'Customer updated successfully' };
  } catch (error) {
    logError('updateCustomer', error);
    return { success: false, message: 'Error updating customer: ' + error.message };
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
    if (parseFloat(customer.Current_Balance) !== 0) {
      // Prevent deleting if balance is not zero (either debt or credit)
      throw new Error('Cannot delete customer with non-zero balance: ' + formatCurrency(customer.Current_Balance));
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
 * V4.0: Automatic loyalty points - 10 points per sale
 */
function updateCustomerPurchaseStats(customerId, amount, user) {
  try {
    const customer = getCustomerById(customerId);
    const totalPurchases = (parseFloat(customer.Total_Purchases) || 0) + parseFloat(amount);

    // Automatic loyalty points: +10 for sales, -10 for returns
    const isReturn = parseFloat(amount) < 0;
    const pointsChange = isReturn ? -(CONFIG.LOYALTY_POINTS_PER_SALE || 10) : (CONFIG.LOYALTY_POINTS_PER_SALE || 10);
    const totalPoints = Math.max(0, (parseFloat(customer.Loyalty_Points) || 0) + pointsChange);

    updateRowById('Customers', 'Customer_ID', customerId, {
      Total_Purchases: totalPurchases,
      Last_Purchase_Date: new Date(),
      Loyalty_Points: totalPoints
    });

    Logger.log('Loyalty Points: Customer ' + customer.Customer_Name + ' ' + (isReturn ? 'lost' : 'earned') + ' ' + Math.abs(pointsChange) + ' points. Total: ' + totalPoints);

    return {
      success: true,
      totalPurchases: totalPurchases,
      pointsEarned: pointsChange,
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
    // In this system, negative balance means Debt
    return customers.filter(customer => {
      return parseFloat(customer.Current_Balance) < 0;
    }).sort((a, b) => {
      return parseFloat(a.Current_Balance) - parseFloat(b.Current_Balance);
    });
  } catch (error) {
    logError('getCustomersWithDebt', error);
    return [];
  }
}

/**
 * Record a direct payment from customer (reduces customer balance)
 */
function recordCustomerPayment(paymentData) {
  try {
    validateRequired(paymentData, ['Customer_ID', 'Amount', 'Account', 'User']);
    const customerId = paymentData.Customer_ID;
    const customer = getCustomerById(customerId);
    const paymentAmount = parseFloat(paymentData.Amount);

    if (paymentAmount <= 0) throw new Error('Payment amount must be greater than zero');

    // ✅ FIX: Canonicalize account name for consistency with financial statements
    const canonicalAccount = canonicalizeAccountName(paymentData.Account);

    const txnId = generateId('Financials', 'Transaction_ID', 'CPY');
    const sheet = getSheet('Financials');

    const description = 'Payment from ' + customer.Customer_Name +
                       (paymentData.Reference ? ' [Ref: ' + paymentData.Reference + ']' : '');

    const txnRow = [
      txnId, new Date(), 'Customer_Payment', customerId, 'Sales',
      canonicalAccount, description, paymentAmount, // ✅ FIX: Use canonical account
      0, paymentAmount, 0,
      canonicalAccount, customer.Customer_Name, // ✅ FIX: Payment method canonicalized
      paymentData.Reference || '', 'Customer: ' + customerId,
      'Approved', paymentData.User, paymentData.User
    ];

    sheet.appendRow(txnRow);

    // ✅ FIX: Update account balance (customer payment increases account balance)
    updateAccountBalance(canonicalAccount, paymentAmount, paymentData.User);

    // Update customer balance (positive balance means customer owes)
    const currentBalance = parseFloat(customer.Current_Balance) || 0;
    const newCustomerBalance = currentBalance - paymentAmount;
    const newTotalPaid = (parseFloat(customer.Total_Paid) || 0) + paymentAmount;
    updateRowById('Customers', 'Customer_ID', customerId, { Current_Balance: newCustomerBalance, Total_Paid: newTotalPaid });

    return { success: true, message: 'Payment recorded successfully' };
  } catch (error) {
    logError('recordCustomerPayment', error);
    return { success: false, message: error.message };
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
        debit: purchase.Grand_Total, // Debit increases what they owe (makes balance more negative if we track debt as pos, but here we track money movement)
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
        credit: payment.Amount, // Credit reduces what they owe
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
    // Start from 0 for the statement view
    let balance = 0;
    filteredTransactions.forEach(txn => {
      // In statement: Debit (Sale) increases debt (negative balance), Credit (Payment) reduces debt
      // Balance = Credit - Debit (if we stick to Negative = Debt)
      // Or Balance = Debit - Credit (if we show Debt as positive on statement)
      // Let's stick to system logic: Balance is typically Credit - Debit.
      // Sale (Debit 1000) -> Balance -1000. Payment (Credit 1000) -> Balance 0.
      balance += (txn.credit - txn.debit);
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
 */
function sendPaymentReminder(customerId, businessName) {
  try {
    const customer = getCustomerById(customerId);
    const balance = parseFloat(customer.Current_Balance) || 0;

    // Only send if balance is negative (Debt)
    if (balance >= 0) {
      return { success: false, message: 'Customer has no outstanding debt' };
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

    const debtAmount = Math.abs(balance);

    // Build email content
    let emailBody = `<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
<h2 style="margin: 0;">💳 Payment Reminder</h2>
</div>
<div style="padding: 30px; background: #f9f9f9;">
<p>Dear <strong>${customer.Customer_Name}</strong>,</p>
<p>This is a friendly reminder that you have an outstanding balance with ${businessName}.</p>
<div style="background: white; padding: 20px; border-left: 4px solid #e74c3c; margin: 20px 0;">
<h3 style="color: #e74c3c; margin-top: 0;">Outstanding Balance</h3>
<p style="font-size: 28px; font-weight: bold; color: #2c3e50; margin: 10px 0;">KSh ${debtAmount.toLocaleString('en-KE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
</div>
<p>Please arrange to settle this amount at your earliest convenience.</p>
<div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">
<h4 style="color: #667eea; margin-top: 0;">Payment Methods</h4>
<ul style="list-style: none; padding: 0;">
<li style="padding: 5px 0;">📱 <strong>M-Pesa:</strong> Pay via M-Pesa</li>
<li style="padding: 5px 0;">🏦 <strong>Bank Transfer:</strong> Equity Bank</li>
<li style="padding: 5px 0;">💵 <strong>Cash:</strong> Visit our location</li>
</ul>
</div>
<p>If you have any questions or concerns regarding this balance, please don\'t hesitate to contact us.</p>
<p style="margin-top: 30px;">Thank you for your business!</p>
<p><strong>${businessName}</strong></p>
</div>
<div style="background: #2c3e50; color: #bdc3c7; padding: 20px; text-align: center; font-size: 12px;">
<p style="margin: 5px 0;">This is an automated reminder from ${businessName}</p>
<p style="margin: 5px 0;">Generated on: ${new Date().toLocaleString()}</p>
</div>
</body></html>`;

    // Send email
    MailApp.sendEmail({
      to: customer.Email,
      subject: `💳 Payment Reminder - Outstanding Balance KSh ${debtAmount.toLocaleString('en-KE')}`,
      htmlBody: emailBody
    });

    logAudit(
      'SYSTEM',
      'Customers',
      'Payment Reminder',
      `Reminder sent to ${customer.Customer_Name} for KSh ${debtAmount.toLocaleString('en-KE')}`,
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
    let summaryEmail = `<html><body style="font-family: Arial, sans-serif;">
<h2 style="color: #667eea;">📧 Payment Reminders Summary</h2>
<p><strong>Total customers with debt:</strong> ${customersWithDebt.length}</p>
<p><strong>Reminders sent:</strong> ${sentCount}</p>
<p><strong>Failed/No email:</strong> ${failedCount}</p>
<hr>
<h3>Details:</h3>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
<tr style="background-color: #f0f0f0;"><th>Customer</th><th>Balance (KSh)</th><th>Status</th></tr>
${results.map(r => {
      const status = r.result ? (r.result.success ? '✅ Sent' : `❌ ${r.result.message}`) : `❌ ${r.error}`;
      return `<tr>
<td>${r.customerName}</td>
<td>KSh ${Math.abs(parseFloat(r.balance)).toLocaleString('en-KE', {minimumFractionDigits: 2})}</td>
<td>${status}</td>
</tr>`;
    }).join('')}
</table>
<br><p style="color: #7f8c8d; font-size: 12px;">Generated on: ${new Date().toLocaleString()}</p>
</body></html>`;

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
