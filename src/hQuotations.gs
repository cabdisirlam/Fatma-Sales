/**
 * QUOTATIONS & SUPPLIERS MODULE
 * Handles: Quotation Management, Quotation to Sale Conversion, Supplier Management
 */

// =====================================================
// QUOTATION MANAGEMENT
// =====================================================

/**
 * Creates a new quotation
 * @param {Object} quoteData - Quotation information
 * @returns {Object} Result with success status
 */
function createQuotation(quoteData) {
  try {
    // Validate required fields
    validateRequired(quoteData, ['Customer_ID', 'Items', 'Valid_Until', 'User']);

    if (!quoteData.Items || quoteData.Items.length === 0) {
      throw new Error('No items in quotation');
    }

    // Verify customer exists
    const customer = findRowById('Customers', 'Customer_ID', quoteData.Customer_ID);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Generate Quote ID
    const quoteId = generateId('Quotations', 'Quote_ID', 'QT');

    // Calculate totals
    const subtotal = quoteData.Items.reduce((sum, item) => sum + (item.Unit_Price * item.Qty), 0);
    const delivery = parseFloat(quoteData.Delivery) || 0;
    const discount = parseFloat(quoteData.Discount) || 0;
    const total = subtotal + delivery - discount;

    // Insert quotation header
    const quotesSheet = getSheet('Quotations');
    const quoteRow = [
      quoteId,
      new Date(),
      quoteData.Customer_ID,
      customer.Customer_Name,
      quoteData.Valid_Until,
      subtotal,
      delivery,
      discount,
      total,
      'Draft',
      quoteData.User,
      '' // Converted_Sale_ID
    ];
    quotesSheet.appendRow(quoteRow);

    // Insert quotation items
    const itemsSheet = getSheet('Quotation_Items');
    quoteData.Items.forEach(item => {
      const lineTotal = item.Unit_Price * item.Qty;
      itemsSheet.appendRow([
        quoteId,
        item.Item_ID,
        item.Item_Name,
        item.Qty,
        item.Unit_Price,
        lineTotal
      ]);
    });

    // Log audit trail
    logAudit(
      quoteData.User,
      'Quotations',
      'Create Quotation',
      'Quotation created: ' + quoteId + ' for ' + customer.Customer_Name,
      quoteData.Session_ID || '',
      '',
      JSON.stringify(quoteRow)
    );

    return {
      success: true,
      quoteId: quoteId,
      message: 'Quotation created successfully'
    };

  } catch (error) {
    logError('createQuotation', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Updates an existing quotation
 * @param {String} quoteId - Quote ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Result with success status
 */
function updateQuotation(quoteId, updates) {
  try {
    // Verify quotation exists
    const quote = findRowById('Quotations', 'Quote_ID', quoteId);
    if (!quote) {
      throw new Error('Quotation not found: ' + quoteId);
    }

    // Can't update converted quotations
    if (quote.Converted_Sale_ID) {
      throw new Error('Cannot update a converted quotation');
    }

    // Update the row
    const result = updateRowById('Quotations', 'Quote_ID', quoteId, updates);

    // Log audit trail
    logAudit(
      updates.User || 'SYSTEM',
      'Quotations',
      'Update Quotation',
      'Quotation updated: ' + quoteId,
      updates.Session_ID || '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Quotation updated successfully'
    };

  } catch (error) {
    logError('updateQuotation', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Gets all quotations with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of quotations
 */
function getQuotations(filters) {
  try {
    return sheetToObjects('Quotations', filters);
  } catch (error) {
    logError('getQuotations', error);
    return {
      success: false,
      message: 'Error loading quotations: ' + error.message
    };
  }
}

/**
 * Gets a single quotation by ID
 * @param {String} quoteId - Quote ID
 * @returns {Object} Quotation data with items
 */
function getQuotationById(quoteId) {
  try {
    const quote = findRowById('Quotations', 'Quote_ID', quoteId);
    if (!quote) {
      throw new Error('Quotation not found');
    }

    // Get items
    const items = sheetToObjects('Quotation_Items', { Quote_ID: quoteId });
    quote.Items = items;

    return quote;

  } catch (error) {
    logError('getQuotationById', error);
    throw new Error('Error loading quotation: ' + error.message);
  }
}

/**
 * Converts an accepted quotation to a sale
 * @param {String} quoteId - Quote ID
 * @param {String} user - User converting
 * @returns {Object} Result with success status and sale ID
 */
function convertQuotationToSale(quoteId, user) {
  try {
    // Get quotation
    const quote = getQuotationById(quoteId);

    if (!quote) {
      throw new Error('Quotation not found');
    }

    if (quote.Status !== 'Accepted') {
      throw new Error('Only accepted quotations can be converted to sales');
    }

    if (quote.Converted_Sale_ID) {
      throw new Error('Quotation has already been converted. Sale ID: ' + quote.Converted_Sale_ID);
    }

    // Check if quotation is still valid
    const validUntil = new Date(quote.Valid_Until);
    if (validUntil < new Date()) {
      throw new Error('Quotation has expired');
    }

    // Prepare sale data
    const saleData = {
      Customer_ID: quote.Customer_ID,
      Customer_Name: quote.Customer_Name,
      Items: quote.Items.map(item => ({
        Item_ID: item.Item_ID,
        Item_Name: item.Item_Name,
        qty: item.Qty,
        Unit_Price: item.Unit_Price
      })),
      Delivery_Charge: quote.Delivery,
      Discount: quote.Discount,
      Payment_Mode: 'Credit', // Default to credit, can be changed
      Sold_By: user,
      Session_ID: ''
    };

    // Create sale
    const saleResult = createSale(saleData);

    if (!saleResult.success) {
      throw new Error('Failed to create sale: ' + saleResult.message);
    }

    // Update quotation with sale ID
    updateRowById('Quotations', 'Quote_ID', quoteId, {
      Converted_Sale_ID: saleResult.saleId,
      Status: 'Converted'
    });

    // Log audit trail
    logAudit(
      user,
      'Quotations',
      'Convert to Sale',
      'Quotation ' + quoteId + ' converted to sale ' + saleResult.saleId,
      '',
      'Status: Accepted',
      'Status: Converted, Sale: ' + saleResult.saleId
    );

    return {
      success: true,
      saleId: saleResult.saleId,
      message: 'Quotation converted to sale successfully'
    };

  } catch (error) {
    logError('convertQuotationToSale', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Generates quotation PDF/HTML
 * @param {String} quoteId - Quote ID
 * @returns {String} HTML quotation
 */
function generateQuotePDF(quoteId) {
  try {
    // Get quotation
    const quote = getQuotationById(quoteId);

    // Get business settings
    const businessName = getSettingValue('BUSINESS_NAME') || 'Your Business Name';
    const businessKRA = getSettingValue('BUSINESS_KRA') || 'P000000000A';
    const businessLocation = getSettingValue('BUSINESS_LOCATION') || 'Nairobi, Kenya';
    const businessPhone = getSettingValue('BUSINESS_PHONE') || '+254 700 000000';
    const businessEmail = getSettingValue('BUSINESS_EMAIL') || 'info@business.com';

    // Build quotation HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Quotation ${quoteId}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .business-name {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        .quotation-title {
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin: 20px 0;
        }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
        }
        .info-box {
            flex: 1;
        }
        .info-label {
            font-weight: bold;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th {
            background: #2c3e50;
            color: white;
            padding: 12px;
            text-align: left;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        .totals {
            margin-top: 20px;
            text-align: right;
        }
        .total-row {
            padding: 8px;
            font-size: 14px;
        }
        .grand-total {
            font-size: 20px;
            font-weight: bold;
            color: #2c3e50;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
        }
        .validity {
            background: #fff3cd;
            padding: 10px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="business-name">${businessName}</div>
        <div>${businessLocation}</div>
        <div>Tel: ${businessPhone} | Email: ${businessEmail}</div>
        <div>KRA PIN: ${businessKRA}</div>
    </div>

    <div class="quotation-title">QUOTATION</div>

    <div class="info-section">
        <div class="info-box">
            <div><span class="info-label">Quotation No:</span> ${quote.Quote_ID}</div>
            <div><span class="info-label">Date:</span> ${formatDate(quote.Date)}</div>
            <div><span class="info-label">Prepared By:</span> ${quote.Prepared_By}</div>
        </div>
        <div class="info-box">
            <div><span class="info-label">Customer:</span> ${quote.Customer_Name}</div>
            <div><span class="info-label">Customer ID:</span> ${quote.Customer_ID}</div>
        </div>
    </div>

    <div class="validity">
        <strong>Valid Until:</strong> ${formatDate(quote.Valid_Until)}
    </div>

    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
`;

    // Add items
    quote.Items.forEach(item => {
      html += `
            <tr>
                <td>${item.Item_Name}</td>
                <td style="text-align: center;">${item.Qty}</td>
                <td style="text-align: right;">${formatCurrency(item.Unit_Price)}</td>
                <td style="text-align: right;">${formatCurrency(item.Line_Total)}</td>
            </tr>
`;
    });

    html += `
        </tbody>
    </table>

    <div class="totals">
        <div class="total-row">
            <span>Subtotal: </span>
            <strong>${formatCurrency(quote.Subtotal)}</strong>
        </div>
`;

    if (quote.Delivery > 0) {
      html += `
        <div class="total-row">
            <span>Delivery Charge: </span>
            <strong>${formatCurrency(quote.Delivery)}</strong>
        </div>
`;
    }

    if (quote.Discount > 0) {
      html += `
        <div class="total-row">
            <span>Discount: </span>
            <strong>(${formatCurrency(quote.Discount)})</strong>
        </div>
`;
    }

    html += `
        <div class="total-row grand-total">
            <span>TOTAL: </span>
            <span>${formatCurrency(quote.Total)}</span>
        </div>
    </div>

    <div class="footer">
        <p><strong>Terms and Conditions</strong></p>
        <p>1. This quotation is valid until the date specified above.</p>
        <p>2. Prices are subject to change without notice after expiry.</p>
        <p>3. Payment terms to be agreed upon acceptance.</p>
        <p style="margin-top: 30px;">Thank you for your business!</p>
    </div>
</body>
</html>
`;

    return html;

  } catch (error) {
    logError('generateQuotePDF', error);
    throw new Error('Error generating quotation: ' + error.message);
  }
}

/**
 * Formats date for display
 */
function formatDate(dateValue) {
  try {
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateValue;
  }
}

// =====================================================
// SUPPLIER MANAGEMENT
// =====================================================

/**
 * Adds a new supplier
 * @param {Object} supplierData - Supplier information
 * @returns {Object} Result with success status
 */
function addSupplier(supplierData) {
  try {
    // Validate required fields
    validateRequired(supplierData, ['Supplier_Name', 'Contact_Person', 'Phone']);

    // Generate Supplier ID
    const supplierId = generateId('Suppliers', 'Supplier_ID', 'SUP');

    // Prepare data
    const sheet = getSheet('Suppliers');
    const rowData = [
      supplierId,
      supplierData.Supplier_Name,
      supplierData.Contact_Person,
      supplierData.Phone,
      supplierData.Email || '',
      supplierData.Address || '',
      0, // Total_Purchased
      0, // Total_Paid
      0, // Current_Balance
      supplierData.Payment_Terms || 'Cash',
      'Active'
    ];

    sheet.appendRow(rowData);

    // Log audit trail
    logAudit(
      supplierData.User || 'SYSTEM',
      'Suppliers',
      'Add Supplier',
      'Supplier added: ' + supplierId + ' - ' + supplierData.Supplier_Name,
      supplierData.Session_ID || '',
      '',
      JSON.stringify(rowData)
    );

    return {
      success: true,
      supplierId: supplierId,
      message: 'Supplier added successfully'
    };

  } catch (error) {
    logError('addSupplier', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Updates an existing supplier
 * @param {String} supplierId - Supplier ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Result with success status
 */
function updateSupplier(supplierId, updates) {
  try {
    // Verify supplier exists
    const supplier = findRowById('Suppliers', 'Supplier_ID', supplierId);
    if (!supplier) {
      throw new Error('Supplier not found: ' + supplierId);
    }

    // Don't allow updating certain fields directly
    const protectedFields = ['Supplier_ID', 'Total_Purchased', 'Total_Paid', 'Current_Balance'];
    protectedFields.forEach(field => {
      if (updates[field] !== undefined) {
        delete updates[field];
      }
    });

    // Update the row
    const result = updateRowById('Suppliers', 'Supplier_ID', supplierId, updates);

    // Log audit trail
    logAudit(
      updates.User || 'SYSTEM',
      'Suppliers',
      'Update Supplier',
      'Supplier updated: ' + supplierId,
      updates.Session_ID || '',
      result.beforeValue,
      result.afterValue
    );

    return {
      success: true,
      message: 'Supplier updated successfully'
    };

  } catch (error) {
    logError('updateSupplier', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Gets all suppliers with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of suppliers
 */
function getSuppliers(filters) {
  try {
    return sheetToObjects('Suppliers', filters);
  } catch (error) {
    logError('getSuppliers', error);
    return {
      success: false,
      message: 'Error loading suppliers: ' + error.message
    };
  }
}

/**
 * Gets a single supplier by ID
 * @param {String} supplierId - Supplier ID
 * @returns {Object} Supplier data
 */
function getSupplierById(supplierId) {
  try {
    const supplier = findRowById('Suppliers', 'Supplier_ID', supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    return supplier;
  } catch (error) {
    logError('getSupplierById', error);
    throw new Error('Error loading supplier: ' + error.message);
  }
}

/**
 * Gets supplier statement (purchase and payment history)
 * @param {String} supplierId - Supplier ID
 * @param {Object} dateRange - Start and end dates (optional)
 * @returns {Object} Statement data
 */
function getSupplierStatement(supplierId, dateRange) {
  try {
    // Get supplier
    const supplier = findRowById('Suppliers', 'Supplier_ID', supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Get purchases
    let purchases = sheetToObjects('Purchases', { Supplier_ID: supplierId });

    // Filter by date range if provided
    if (dateRange) {
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      purchases = purchases.filter(purchase => {
        const purchaseDate = new Date(purchase.Date);
        if (startDate && purchaseDate < startDate) return false;
        if (endDate && purchaseDate > endDate) return false;
        return true;
      });
    }

    // Sort by date
    purchases.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    return {
      supplier: supplier,
      purchases: purchases,
      currentBalance: parseFloat(supplier.Current_Balance) || 0,
      totalPurchased: parseFloat(supplier.Total_Purchased) || 0,
      totalPaid: parseFloat(supplier.Total_Paid) || 0,
      dateRange: dateRange
    };

  } catch (error) {
    logError('getSupplierStatement', error);
    throw new Error('Error generating statement: ' + error.message);
  }
}

/**
 * Gets top suppliers by purchase value
 * @param {Number} limit - Number of suppliers to return
 * @returns {Array} Top suppliers
 */
function getTopSuppliers(limit) {
  try {
    const suppliers = getSuppliers({ Status: 'Active' });

    return suppliers
      .sort((a, b) => (parseFloat(b.Total_Purchased) || 0) - (parseFloat(a.Total_Purchased) || 0))
      .slice(0, limit || 10);

  } catch (error) {
    logError('getTopSuppliers', error);
    return [];
  }
}
