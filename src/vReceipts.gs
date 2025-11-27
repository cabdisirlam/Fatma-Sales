/**
 * Receipt & Quotation Generation Module
 * Handles: Receipt generation, Quotation generation, PDF export
 */

/**
 * Generate receipt HTML for sale
 */
function generateReceiptHTML(transactionId) {
  try {
    const sale = getSaleById(transactionId);
    if (!sale) throw new Error('Sale not found');

    const settings = getAllSettings();
    const dateStr = Utilities.formatDate(new Date(sale.DateTime), 'GMT+3', 'dd/MM/yyyy HH:mm');

    const html = `
      <html>
      <body style="font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px;">
          <h2 style="margin: 0;">${settings.Shop_Name || CONFIG.SHOP_NAME}</h2>
          <p style="margin: 5px 0;">${settings.Receipt_Header || ''}</p>
        </div>
        
        <div style="margin: 10px 0;">
          <div><strong>Date:</strong> ${dateStr}</div>
          <div><strong>Receipt #:</strong> ${sale.Transaction_ID}</div>
          <div><strong>Customer:</strong> ${sale.Customer_Name}</div>
          ${sale.Location ? `<div><strong>Location:</strong> ${sale.Location}</div>` : ''}
          ${sale.KRA_PIN ? `<div><strong>KRA PIN:</strong> ${sale.KRA_PIN}</div>` : ''}
          <div><strong>Served By:</strong> ${sale.Sold_By}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
          <tr style="border-bottom: 1px solid black;">
            <th style="text-align: left;">Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Total</th>
          </tr>
          ${sale.items.map(i => `
            <tr>
              <td>${i.Item_Name}</td>
              <td style="text-align: center;">${i.Qty}</td>
              <td style="text-align: right;">${formatNumber(i.Line_Total)}</td>
            </tr>
          `).join('')}
        </table>

        <div style="border-top: 1px dashed black; padding-top: 5px;">
          <div style="display: flex; justify-content: space-between;">
            <strong>TOTAL:</strong>
            <strong>${settings.Currency_Symbol || 'Ksh'} ${formatNumber(sale.Grand_Total)}</strong>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 12px;">
          <p>${settings.Receipt_Footer || 'Thank you!'}</p>
        </div>
      </body>
      </html>
    `;
    return html;
  } catch (error) {
    logError('generateReceiptHTML', error);
    return 'Error generating receipt';
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
    <div class="row"><span>Subtotal:</span> <span>${currency} ${formatNumber(quotation.Subtotal)}</span></div>
    ${quotation.Delivery_Charge > 0 ? '<div class="row"><span>Delivery Charge:</span> <span>' + currency + ' ' + formatNumber(quotation.Delivery_Charge) + '</span></div>' : ''}
    ${quotation.Discount > 0 ? '<div class="row"><span>Discount:</span> <span>-' + currency + ' ' + formatNumber(quotation.Discount) + '</span></div>' : ''}
    <div class="row grand-total"><span>GRAND TOTAL:</span> <span>${currency} ${formatNumber(quotation.Grand_Total)}</span></div>
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
