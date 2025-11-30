/**
 * Receipt & Quotation Generation Module
 * Handles: Receipt generation, Quotation generation, PDF export
 */

/**
 * Generate receipt HTML for sale (Thermal Printer Optimized)
 */
function generateReceiptHTML(transactionId) {
  try {
    const sale = getSaleById(transactionId);
    if (!sale) throw new Error('Sale not found');

    // Fetch customer details if not walk-in
    let customerPoints = 0;
    let customerPhone = '';
    if (sale.Customer_ID && sale.Customer_ID !== 'WALK-IN') {
      try {
        const customer = getCustomerById(sale.Customer_ID);
        if (customer) {
          customerPoints = customer.Loyalty_Points || 0;
          customerPhone = customer.Phone || '';
        }
      } catch (e) {
        // ignore
      }
    }

    const settings = getAllSettings();
    const dateStr = Utilities.formatDate(new Date(sale.DateTime), 'GMT+3', 'dd/MM/yyyy HH:mm');
    
    // THERMAL PRINTER OPTIMIZED LAYOUT
    const html = `
      <html>
      <head>
        <style>
          @page { margin: 0; size: auto; }
          body { 
            font-family: 'monospace', 'Courier New', Courier, mono; 
            margin: 0; 
            padding: 5px; 
            width: 100%;
            max-width: 300px; /* For 80mm paper */
            font-size: 10px;
            line-height: 1.3;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 8px; }
          .shop-name { font-size: 14px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .item-table { width: 100%; border-collapse: collapse; }
          .item-table th, .item-table td { padding: 2px 0; }
          .item-table .item-name { font-weight: bold; }
          .item-table .item-details { text-align: right; }
          .totals-table { width: 100%; margin-top: 8px; font-weight: bold; }
          .totals-table td { padding: 1px 0; }
          .footer { margin-top: 12px; text-align: center; font-size: 9px; }
          .customer-info { margin: 8px 0; font-size: 9px; border-bottom: 1px dashed #000; padding-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${settings.Shop_Name || CONFIG.SHOP_NAME}</div>
          <div>${settings.Receipt_Header || ''}</div>
        </div>
        
        <div class="divider"></div>
        
        <div>Receipt #: ${sale.Transaction_ID}</div>
        <div>Date: ${dateStr}</div>
        <div>Served By: ${sale.Sold_By}</div>
        ${sale.Paybill_Number ? `<div>Paybill/Ref: ${sale.Paybill_Number}</div>` : ''}

        <div class="customer-info">
          <div>Customer: ${sale.Customer_Name}</div>
          ${customerPhone ? `<div>Phone: ${customerPhone}</div>` : ''}
          ${sale.KRA_PIN ? `<div>KRA PIN: ${sale.KRA_PIN}</div>` : ''}
          ${sale.Location ? `<div>Loc: ${sale.Location}</div>` : ''}
        </div>
        
        <div class="divider"></div>
        
        <table class="item-table">
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(sale.items && Array.isArray(sale.items)) ? sale.items.map(i => `
              <tr>
                <td colspan="2" class="item-name">${i ? i.Item_Name : 'N/A'}</td>
              </tr>
              <tr>
                <td>  ${i ? i.Qty : 0} x ${formatNumber(i ? i.Unit_Price : 0)}</td>
                <td class="item-details">${formatNumber(i ? i.Line_Total : 0)}</td>
              </tr>
            `).join('') : ''}
          </tbody>
        </table>

        <div class="divider"></div>

        <table class="totals-table">
          <tbody>
            <tr><td>Subtotal:</td><td style="text-align:right;">${formatNumber(Math.abs(parseFloat(sale.Subtotal) || 0))}</td></tr>
            ${(sale.Delivery_Charge && Math.abs(parseFloat(sale.Delivery_Charge)) > 0) ? `<tr><td>Delivery Charge:</td><td style="text-align:right;">+${formatNumber(Math.abs(parseFloat(sale.Delivery_Charge)))}</td></tr>` : ''}
            ${(sale.Discount && Math.abs(parseFloat(sale.Discount)) > 0) ? `<tr><td>Discount:</td><td style="text-align:right;">-${formatNumber(Math.abs(parseFloat(sale.Discount)))}</td></tr>` : ''}
            <tr style="font-size: 14px;"><td><strong>TOTAL:</strong></td><td style="text-align:right;"><strong>${settings.Currency_Symbol || 'Ksh'} ${formatNumber(Math.abs(parseFloat(sale.Grand_Total) || 0))}</strong></td></tr>
          </tbody>
        </table>

        ${sale.Customer_ID !== 'WALK-IN' ?
          `<div style="text-align:center; margin-top:5px; font-size:9px; border-top: 1px dashed #000; padding-top: 4px;">
             <div>Previous Points: ${Math.max(0, customerPoints - (CONFIG.LOYALTY_POINTS_PER_SALE || 10))}</div>
             <div><strong>Earned This Sale: +${CONFIG.LOYALTY_POINTS_PER_SALE || 10}</strong></div>
             <div style="font-weight:bold; font-size:10px;">New Total: ${customerPoints} points</div>
             <div style="font-size:8px; color:#666; margin-top:2px;">Earn ${CONFIG.LOYALTY_POINTS_PER_SALE || 10} points per purchase!</div>
           </div>`
          : ''}
        
        <div class="footer">
          <p>${settings.Receipt_Footer || 'Thank you!'}</p>
        </div>
      </body>
      </html>
    `;
    return html;
  } catch (error) {
    logError('generateReceiptHTML', error);
    return 'Error: ' + error.message;
  }
}

/**
 * Generate quotation HTML
 */
function generateQuotationHTML(transactionId) {
  try {
    const quotation = getSaleById(transactionId);
    if (!quotation || quotation.Type !== 'Quotation') {
      throw new Error('Quotation not found');
    }

    // Fetch customer phone if available
    let customerPhone = '';
    if (quotation.Customer_ID && quotation.Customer_ID !== 'WALK-IN') {
      try {
        const customer = getCustomerById(quotation.Customer_ID);
        if (customer) {
          customerPhone = customer.Phone || '';
        }
      } catch (e) {
        // ignore
      }
    }

    const settings = getAllSettings();
    const shopName = settings.Shop_Name || CONFIG.SHOP_NAME;
    const currency = settings.Currency_Symbol || CONFIG.CURRENCY_SYMBOL;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #333; padding-bottom: 15px; }
    .header h1 { font-size: 32px; margin-bottom: 5px; color: #333; }
    .header p { font-size: 14px; color: #666; }
    .quotation-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .info-box { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .info-box h3 { font-size: 14px; margin-bottom: 10px; color: #666; text-transform: uppercase; }
    .info-box p { margin: 5px 0; }
    .items table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .items th { background: #333; color: white; text-align: left; padding: 12px; }
    .items td { padding: 12px; border-bottom: 1px solid #ddd; }
    .items tr:hover { background: #f9f9f9; }
    .totals { margin-top: 20px; text-align: right; }
    .totals .row { padding: 8px 0; font-size: 16px; }
    .grand-total { font-size: 24px; font-weight: bold; color: #333; border-top: 2px solid #333; padding-top: 15px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }
    .valid-until { background: #fffbcc; padding: 10px; border-left: 4px solid #f0ad4e; margin: 20px 0; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${shopName}</h1>
    <p>QUOTATION</p>
  </div>

  <div class="quotation-info">
    <div class="info-box">
      <h3>Quotation Details</h3>
      <p><strong>Quotation #:</strong> ${quotation.Transaction_ID}</p>
      <p><strong>Date:</strong> ${Utilities.formatDate(new Date(quotation.DateTime), 'GMT+3', 'dd MMM yyyy')}</p>
      <p><strong>Valid Until:</strong> ${Utilities.formatDate(new Date(quotation.Valid_Until), 'GMT+3', 'dd MMM yyyy')}</p>
      <p><strong>Prepared By:</strong> ${quotation.Sold_By}</p>
    </div>
    <div class="info-box">
      <h3>Customer Details</h3>
      <p><strong>Name:</strong> ${quotation.Customer_Name}</p>
      ${customerPhone ? '<p><strong>Phone:</strong> ' + customerPhone + '</p>' : ''}
      ${quotation.Location ? '<p><strong>Location:</strong> ' + quotation.Location + '</p>' : ''}
      ${quotation.KRA_PIN ? '<p><strong>KRA PIN:</strong> ' + quotation.KRA_PIN + '</p>' : ''}
    </div>
  </div>

  <div class="valid-until">
    <strong>Note:</strong> This quotation is valid until ${Utilities.formatDate(new Date(quotation.Valid_Until), 'GMT+3', 'dd MMM yyyy')}. Prices are subject to change after this date.
  </div>

  <div class="items">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item Description</th>
          <th style="text-align:center">Quantity</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${quotation.items.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${item.Item_Name}</td>
            <td style="text-align:center">${item.Qty}</td>
            <td style="text-align:right">${currency} ${formatNumber(item.Unit_Price)}</td>
            <td style="text-align:right">${currency} ${formatNumber(item.Line_Total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div class="row"><span>Subtotal:</span> <span>${currency} ${formatNumber(Math.abs(parseFloat(quotation.Subtotal) || 0))}</span></div>
    ${(quotation.Delivery_Charge && Math.abs(parseFloat(quotation.Delivery_Charge)) > 0) ? '<div class="row"><span>Delivery Charge:</span> <span>+' + currency + ' ' + formatNumber(Math.abs(parseFloat(quotation.Delivery_Charge))) + '</span></div>' : ''}
    ${(quotation.Discount && Math.abs(parseFloat(quotation.Discount)) > 0) ? '<div class="row"><span>Discount:</span> <span>-' + currency + ' ' + formatNumber(Math.abs(parseFloat(quotation.Discount))) + '</span></div>' : ''}
    <div class="row grand-total"><span>GRAND TOTAL:</span> <span>${currency} ${formatNumber(Math.abs(parseFloat(quotation.Grand_Total) || 0))}</span></div>
  </div>

  <div class="footer">
    <p>Thank you for considering our quotation.</p>
    <p>Terms & Conditions: Prices are subject to change. Payment terms as agreed.</p>
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()">Print Quotation</button>
  </div>
</body>
</html>
    `;

    return html;

  } catch (error) {
    logError('generateQuotationHTML', error);
    throw new Error('Error generating quotation: ' + error.message);
  }
}

/**
 * Helper function to format numbers
 */
function formatNumber(num) {
  return parseFloat(num).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Get all settings as object
 */
function getAllSettings() {
  try {
    const settings = sheetToObjects('Settings');
    const settingsObj = {};

    settings.forEach(setting => {
      if (setting.Setting_Key) {
        settingsObj[setting.Setting_Key] = setting.Setting_Value;
      }
    });

    return settingsObj;
  } catch (error) {
    logError('getAllSettings', error);
    return {};
  }
}

/**
 * Show receipt in dialog
 */
function showReceipt(transactionId) {
  try {
    const html = generateReceiptHTML(transactionId);
    const output = HtmlService.createHtmlOutput(html)
      .setWidth(450)
      .setHeight(600);

    SpreadsheetApp.getUi().showModalDialog(output, 'Receipt - ' + transactionId);

  } catch (error) {
    logError('showReceipt', error);
    SpreadsheetApp.getUi().alert('Error showing receipt: ' + error.message);
  }
}

/**
 * Show quotation in dialog
 */
function showQuotation(transactionId) {
  try {
    const html = generateQuotationHTML(transactionId);
    const output = HtmlService.createHtmlOutput(html)
      .setWidth(800)
      .setHeight(700);

    SpreadsheetApp.getUi().showModalDialog(output, 'Quotation - ' + transactionId);

  } catch (error) {
    logError('showQuotation', error);
    SpreadsheetApp.getUi().alert('Error showing quotation: ' + error.message);
  }
}
