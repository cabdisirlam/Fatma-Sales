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
    const currencySymbol = settings.Currency_Symbol || 'Ksh';
    const vatRate = 0.16;
    const grossTotal = Math.abs(parseFloat(sale.Grand_Total) || 0);
    const vatAmount = grossTotal - (grossTotal / (1 + vatRate));
    const itemsSummary = (sale.items && Array.isArray(sale.items))
      ? sale.items.slice(0, 4).map(i => `${i ? i.Item_Name : 'Item'} x${i ? i.Qty : 0}`).join('; ')
      : '';
    const extraCount = (sale.items && Array.isArray(sale.items) && sale.items.length > 4) ? sale.items.length - 4 : 0;
    const qrPayload = [
      `Receipt: ${sale.Transaction_ID}`,
      `Total: ${currencySymbol} ${formatNumber(grossTotal)}`,
      `Date: ${dateStr}`,
      `Customer: ${sale.Customer_Name || 'N/A'}`,
      itemsSummary ? `Items: ${itemsSummary}${extraCount ? '; +' + extraCount + ' more' : ''}` : ''
    ].filter(Boolean).join('\n');
    let qrDataUrl = '';
    try {
      // Force inclusion even if minified/optimized
      const charts = (typeof Charts !== 'undefined') ? Charts : null;
      if (charts) {
        const qrBlob = charts.newQrCode(qrPayload).setSize(140, 140).build().getAs('image/png');
        qrDataUrl = 'data:image/png;base64,' + Utilities.base64Encode(qrBlob.getBytes());
      }
    } catch (e) {
      // ignore and fall through
    }
    if (!qrDataUrl) {
      // fallback to external generator if Charts service fails or unavailable
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&color=000000&bgcolor=ffffff&data=' + encodeURIComponent(qrPayload);
      qrDataUrl = qrUrl;
    }
    
    // THERMAL PRINTER OPTIMIZED LAYOUT
    const html = `
      <html>
      <head>
        <style>
          @page { margin: 0; size: auto; }
          body { 
            font-family: 'monospace', 'Courier New', Courier, mono; 
            margin: 0; 
            padding: 4px 2px; 
            width: calc(100% - 4px);
            max-width: 292px; /* For 80mm paper with 2px allowance */
            font-size: 12px;
            line-height: 1.45;
            font-weight: 600;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 8px; font-size: 13px; }
          .shop-name { font-size: 16px; font-weight: 800; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .item-table { width: 100%; border-collapse: collapse; }
          .item-table th, .item-table td { padding: 2px 0; }
          .item-table .item-name { font-weight: bold; }
          .item-table .item-details { text-align: right; }
          .totals-table { width: 100%; margin-top: 8px; font-weight: bold; }
          .totals-table td { padding: 1px 0; }
          .footer { margin-top: 12px; text-align: center; font-size: 11px; font-weight: 700; }
          .customer-info { margin: 8px 0; font-size: 11px; font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 4px; }
          .qr { text-align: center; margin-top: 10px; }
          .qr img { width: 120px; height: 120px; }
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
            <tr><td>VAT (16% incl.):</td><td style="text-align:right;">${formatNumber(vatAmount)}</td></tr>
            <tr style="font-size: 16px;"><td><strong>TOTAL:</strong></td><td style="text-align:right;"><strong>${currencySymbol} ${formatNumber(grossTotal)}</strong></td></tr>
          </tbody>
        </table>

        ${sale.Customer_ID !== 'WALK-IN' ?
          `<div style="text-align:center; margin-top:5px; font-size:11px; border-top: 1px dashed #000; padding-top: 4px; font-weight:700;">
             <div>Previous Points: ${Math.max(0, customerPoints - (CONFIG.LOYALTY_POINTS_PER_SALE || 10))}</div>
             <div><strong>Earned This Sale: +${CONFIG.LOYALTY_POINTS_PER_SALE || 10}</strong></div>
             <div style="font-weight:bold; font-size:12px;">New Total: ${customerPoints} points</div>
             <div style="font-size:10px; color:#666; margin-top:2px;">Earn ${CONFIG.LOYALTY_POINTS_PER_SALE || 10} points per purchase!</div>
           </div>`
          : ''}
        
        <div class="qr">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="${qrPayload}" title="${qrPayload}" style="display:block;margin:0 auto;" />` : `<div style="font-size:10px;">${qrPayload}</div>`}
        </div>

        <div class="footer">
          <p>${settings.Receipt_Footer || 'Thank you!'}</p>
          <p style="font-size:10px; margin-top:2px;">All prices include 16% VAT.</p>
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
 * Generate quotation HTML (matches receipt format exactly)
 */
function generateQuotationHTML(transactionId) {
  try {
    const quotation = getSaleById(transactionId);
    if (!quotation || quotation.Type !== 'Quotation') {
      throw new Error('Quotation not found');
    }

    // Fetch customer details if not walk-in
    let customerPhone = '';
    let customerLocation = '';
    let customerKraPin = '';

    if (quotation.Customer_ID && quotation.Customer_ID !== 'WALK-IN') {
      try {
        const customer = getCustomerById(quotation.Customer_ID);
        if (customer) {
          customerPhone = customer.Phone || '';
          customerLocation = customer.Location || '';
          customerKraPin = customer.KRA_PIN || '';
        }
      } catch (e) {
        // ignore
      }
    }

    const settings = getAllSettings();
    const dateStr = Utilities.formatDate(new Date(quotation.DateTime), 'GMT+3', 'dd/MM/yyyy HH:mm');

    // Parse Valid_Until date
    let validUntilStr = '';
    try {
      const validUntilDate = quotation.Valid_Until ? new Date(quotation.Valid_Until) : null;
      if (validUntilDate && !isNaN(validUntilDate.getTime())) {
        validUntilStr = Utilities.formatDate(validUntilDate, 'GMT+3', 'dd/MM/yyyy');
      }
    } catch (e) {
      // ignore
    }

    const currencySymbol = settings.Currency_Symbol || 'Ksh';
    const vatRate = 0.16;
    const grossTotal = Math.abs(parseFloat(quotation.Grand_Total) || 0);
    const vatAmount = grossTotal - (grossTotal / (1 + vatRate));
    const itemsSummary = (quotation.items && Array.isArray(quotation.items))
      ? quotation.items.slice(0, 4).map(i => `${i ? i.Item_Name : 'Item'} x${i ? i.Qty : 0}`).join('; ')
      : '';
    const extraCount = (quotation.items && Array.isArray(quotation.items) && quotation.items.length > 4) ? quotation.items.length - 4 : 0;
    const qrPayload = [
      `Quotation: ${quotation.Transaction_ID}`,
      `Total: ${currencySymbol} ${formatNumber(grossTotal)}`,
      `Date: ${dateStr}`,
      validUntilStr ? `Valid Until: ${validUntilStr}` : '',
      `Customer: ${quotation.Customer_Name || 'N/A'}`,
      itemsSummary ? `Items: ${itemsSummary}${extraCount ? '; +' + extraCount + ' more' : ''}` : ''
    ].filter(Boolean).join('\n');
    let qrDataUrl = '';
    try {
      // Force inclusion even if minified/optimized
      const charts = (typeof Charts !== 'undefined') ? Charts : null;
      if (charts) {
        const qrBlob = charts.newQrCode(qrPayload).setSize(140, 140).build().getAs('image/png');
        qrDataUrl = 'data:image/png;base64,' + Utilities.base64Encode(qrBlob.getBytes());
      }
    } catch (e) {
      // ignore and fall through
    }
    if (!qrDataUrl) {
      // fallback to external generator if Charts service fails or unavailable
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&color=000000&bgcolor=ffffff&data=' + encodeURIComponent(qrPayload);
      qrDataUrl = qrUrl;
    }

    // THERMAL PRINTER OPTIMIZED LAYOUT (SAME AS RECEIPT)
    const html = `
      <html>
      <head>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'monospace', 'Courier New', Courier, mono;
            margin: 0;
            padding: 4px 2px;
            width: calc(100% - 4px);
            max-width: 292px; /* For 80mm paper with 2px allowance */
            font-size: 12px;
            line-height: 1.45;
            font-weight: 600;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 8px; font-size: 13px; }
          .shop-name { font-size: 16px; font-weight: 800; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .item-table { width: 100%; border-collapse: collapse; }
          .item-table th, .item-table td { padding: 2px 0; }
          .item-table .item-name { font-weight: bold; }
          .item-table .item-details { text-align: right; }
          .totals-table { width: 100%; margin-top: 8px; font-weight: bold; }
          .totals-table td { padding: 1px 0; }
          .footer { margin-top: 12px; text-align: center; font-size: 11px; font-weight: 700; }
          .customer-info { margin: 8px 0; font-size: 11px; font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 4px; }
          .qr { text-align: center; margin-top: 10px; }
          .qr img { width: 120px; height: 120px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${settings.Shop_Name || CONFIG.SHOP_NAME}</div>
          <div>${settings.Receipt_Header || ''}</div>
        </div>

        <div class="divider"></div>

        <div>Quotation #: ${quotation.Transaction_ID}</div>
        <div>Date: ${dateStr}</div>
        ${validUntilStr ? `<div>Valid Until: ${validUntilStr}</div>` : ''}
        <div>Prepared By: ${quotation.Created_By || quotation.Sold_By || 'SYSTEM'}</div>

        <div class="customer-info">
          <div>Customer: ${quotation.Customer_Name}</div>
          ${customerPhone ? `<div>Phone: ${customerPhone}</div>` : ''}
          ${customerKraPin ? `<div>KRA PIN: ${customerKraPin}</div>` : ''}
          ${customerLocation ? `<div>Loc: ${customerLocation}</div>` : ''}
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
            ${(quotation.items && Array.isArray(quotation.items)) ? quotation.items.map(i => `
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
            <tr><td>Subtotal:</td><td style="text-align:right;">${currencySymbol} ${formatNumber(Math.abs(parseFloat(quotation.Subtotal) || 0))}</td></tr>
            <tr><td>VAT (16% incl.):</td><td style="text-align:right;">${currencySymbol} ${formatNumber(vatAmount)}</td></tr>
            <tr style="font-size: 16px;"><td><strong>TOTAL:</strong></td><td style="text-align:right;"><strong>${currencySymbol} ${formatNumber(grossTotal)}</strong></td></tr>
          </tbody>
        </table>

        ${validUntilStr ? `<div style="text-align:center; margin-top:8px; font-size:11px; font-weight:700; border-top: 1px dashed #000; padding-top: 4px;">
          <div><strong>Valid Until: ${validUntilStr}</strong></div>
          <div style="font-size:10px; color:#666; margin-top:2px;">Prices subject to change after this date</div>
        </div>` : ''}

        <div class="qr">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="${qrPayload}" title="${qrPayload}" style="display:block;margin:0 auto;" />` : `<div style="font-size:10px;">${qrPayload}</div>`}
        </div>

        <div class="footer">
          <p>${settings.Receipt_Footer || 'Thank you!'}</p>
          <p style="font-size:10px; margin-top:2px;">All prices include 16% VAT.</p>
        </div>
      </body>
      </html>
    `;
    return html;
  } catch (error) {
    logError('generateQuotationHTML', error);
    return 'Error: ' + error.message;
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

/**
 * Get quotation HTML for printing (returns HTML string)
 */
function getQuotationHTML(transactionId) {
  try {
    const html = generateQuotationHTML(transactionId);
    return {
      success: true,
      html: html
    };
  } catch (error) {
    logError('getQuotationHTML', error);
    return {
      success: false,
      message: error.message
    };
  }
}
