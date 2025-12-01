/**
 * Quotations Management Module
 * Handles: Quotation creation, management, conversion to sales, status tracking
 *
 * Note: This module delegates core operations to iSales.gs where quotations
 * are stored in the same Sales sheet with Type='Quotation'
 */

// =====================================================
// CORE QUOTATION FUNCTIONS
// =====================================================

/**
 * Get all quotations with optional filters
 * Delegates to iSales.gs getQuotations() which filters Sales sheet for Type='Quotation'
 */
function getQuotations(filters) {
  // This function is implemented in iSales.gs
  // We keep this as a reference/wrapper for clarity
  try {
    const sales = sheetToObjects('Sales');

    // Filter for Quotations only
    let quotations = sales.filter(s => s.Type === 'Quotation');

    // Apply additional filters
    if (filters) {
      for (let key in filters) {
        quotations = quotations.filter(q => q[key] === filters[key]);
      }
    }

    // Group by Transaction_ID to avoid duplicates from line items
    const groupedQuots = {};
    quotations.forEach(quot => {
      if (!groupedQuots[quot.Transaction_ID]) {
        groupedQuots[quot.Transaction_ID] = {
          Transaction_ID: quot.Transaction_ID,
          DateTime: quot.DateTime,
          Customer_ID: quot.Customer_ID,
          Customer_Name: quot.Customer_Name,
          Location: quot.Location,
          KRA_PIN: quot.KRA_PIN,
          Grand_Total: quot.Grand_Total,
          Subtotal: quot.Subtotal,
          Delivery_Charge: quot.Delivery_Charge,
          Discount: quot.Discount,
          Sold_By: quot.Sold_By,
          Status: quot.Status,
          Valid_Until: quot.Valid_Until,
          Converted_Sale_ID: quot.Converted_Sale_ID,
          itemCount: 0
        };
      }
      groupedQuots[quot.Transaction_ID].itemCount++;
    });

    return Object.values(groupedQuots);

  } catch (error) {
    logError('getQuotations', error);
    return [];
  }
}

/**
 * Get quotation by ID with all line items
 */
function getQuotationById(quotationId) {
  try {
    const quotations = sheetToObjects('Quotations');

    // Helper to read compatible column names (with/without underscores)
    const pick = (row, keys) => {
      for (let k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
      }
      return '';
    };

    const parseNumber = (val) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      const cleaned = val.toString().replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      return isFinite(num) ? num : 0;
    };

    // Find all rows for this quotation
    const quotRows = quotations.filter(q =>
      (q.Quotation_ID || q['Quotation ID']) === quotationId
    );

    if (quotRows.length === 0) {
      return null;
    }

    // Use first row for header info
    const first = quotRows[0];

    // Collect items
    const items = quotRows.map(row => ({
      Item_ID: pick(row, ['Item_ID', 'Item ID', 'Item']),
      Item_Name: pick(row, ['Item_Name', 'Item Name', 'Item']),
      Qty: parseNumber(pick(row, ['Qty', 'Quantity'])),
      Unit_Price: parseNumber(pick(row, ['Unit_Price', 'Unit Price', 'Price'])),
      Line_Total: parseNumber(pick(row, ['Line_Total', 'Line Total', 'Amount', 'Total']))
    }));

    const subtotalFallback = items.reduce((s, it) => s + (parseFloat(it.Line_Total) || 0), 0);
    const rawSubtotal = parseNumber(pick(first, ['Subtotal']));
    const subtotal = isFinite(rawSubtotal) && rawSubtotal !== 0 ? rawSubtotal : subtotalFallback;
    const deliveryCharge = parseNumber(pick(first, ['Delivery_Charge', 'Delivery Charge']));
    const discount = parseNumber(pick(first, ['Discount']));
    const rawGrandTotal = parseNumber(pick(first, ['Grand_Total', 'Total_Amount', 'Total Amount']));
    const grandTotal = isFinite(rawGrandTotal) && rawGrandTotal !== 0
      ? rawGrandTotal
      : (subtotal + deliveryCharge - discount);

    const validUntilRaw = pick(first, ['Valid_Until', 'Valid Until']);
    const dateTimeRaw = pick(first, ['DateTime', 'Date', 'Date_Time']);

    return {
      Quotation_ID: pick(first, ['Quotation_ID', 'Quotation ID', 'Transaction_ID', 'Transaction ID']),
      DateTime: dateTimeRaw,
      Customer_ID: pick(first, ['Customer_ID', 'Customer ID']),
      Customer_Name: pick(first, ['Customer_Name', 'Customer Name']),
      Subtotal: subtotal,
      Delivery_Charge: deliveryCharge,
      Discount: discount,
      Grand_Total: grandTotal,
      Created_By: pick(first, ['Created_By', 'Created By', 'Sold_By', 'Sold By', 'User', 'Prepared_By', 'Prepared By']),
      Location: pick(first, ['Customer_Location', 'Customer Location', 'Location', 'Address']),
      KRA_PIN: pick(first, ['Customer_KRA_PIN', 'Customer KRA PIN', 'KRA_PIN', 'KRA PIN', 'KRA']),
      Status: pick(first, ['Status']),
      Valid_Until: validUntilRaw,
      Converted_Sale_ID: pick(first, ['Converted_Sale_ID', 'Converted Sale ID']),
      Payment_Mode: pick(first, ['Payment_Mode', 'Payment Mode', 'Payment']),
      Type: 'Quotation',
      items: items
    };

  } catch (error) {
    logError('getQuotationById', error);
    return null;
  }
}

/**
 * Create new quotation
 * Delegates to createQuotation() in iSales.gs
 */
function addQuotation(quotationData) {
  try {
    // Validate required fields
    validateRequired(quotationData, ['items', 'Customer_ID', 'User']);

    if (!quotationData.items || quotationData.items.length === 0) {
      throw new Error('Quotation must have at least one item');
    }

    // Use the createQuotation function from iSales.gs
    return createQuotation(quotationData);

  } catch (error) {
    logError('addQuotation', error);
    throw new Error('Error creating quotation: ' + error.message);
  }
}

/**
 * Update existing quotation
 * Delegates to updateQuotation() in iSales.gs for full quotation editing
 * NOTE: This is a wrapper function - the actual implementation is in iSales.gs
 */
function editQuotation(quotationId, quotationData) {
  try {
    // This delegates to the comprehensive updateQuotation function in iSales.gs
    // which handles deleting old quotation rows and creating new ones with updated data
    return updateQuotation(quotationId, quotationData);
  } catch (error) {
    logError('editQuotation', error);
    throw new Error('Error updating quotation: ' + error.message);
  }
}

/**
 * Delete quotation (only if not converted)
 */
function deleteQuotation(quotationId, user) {
  try {
    if (!quotationId) {
      throw new Error('Quotation ID is required');
    }

    // Get quotation to check status
    const quotation = getQuotationById(quotationId);

    // Cannot delete if already converted
    if (quotation.Status === 'Converted') {
      throw new Error('Cannot delete converted quotation. Converted to sale: ' + quotation.Converted_Sale_ID);
    }

    const sheet = getSheet('Quotations');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const transIdCol = headers.indexOf('Quotation_ID');

    // Delete all rows with this quotation ID (line items)
    // Loop backwards to avoid index issues
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][transIdCol] === quotationId) {
        sheet.deleteRow(i + 1);
      }
    }

    logAudit(
      user || 'SYSTEM',
      'Sales',
      'Delete Quotation',
      'Quotation deleted: ' + quotationId,
      '',
      JSON.stringify(quotation),
      ''
    );

    return {
      success: true,
      message: 'Quotation deleted successfully'
    };

  } catch (error) {
    logError('deleteQuotation', error);
    throw new Error('Error deleting quotation: ' + error.message);
  }
}

/**
 * Convert quotation to sale
 * Delegates to convertQuotationToSale() in iSales.gs
 */
function convertQuotationToSale(quotationId, paymentMode, user) {
  try {
    // Use the existing function from iSales.gs
    return convertQuotationToSale(quotationId, paymentMode || 'Cash', user);

  } catch (error) {
    logError('convertQuotationToSale', error);
    throw new Error('Error converting quotation: ' + error.message);
  }
}

// =====================================================
// SEARCH AND FILTER FUNCTIONS
// =====================================================

/**
 * Search quotations by customer name, ID, or transaction ID
 */
function searchQuotations(query) {
  try {
    if (!query) {
      return getQuotations(null);
    }

    const quotations = getQuotations(null);
    const lowerQuery = query.toLowerCase();

    return quotations.filter(quot => {
      return (quot.Transaction_ID && quot.Transaction_ID.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (quot.Customer_ID && quot.Customer_ID.toLowerCase().indexOf(lowerQuery) !== -1) ||
             (quot.Customer_Name && quot.Customer_Name.toLowerCase().indexOf(lowerQuery) !== -1);
    });

  } catch (error) {
    logError('searchQuotations', error);
    return [];
  }
}

/**
 * Get quotations by customer
 */
function getQuotationsByCustomer(customerId) {
  try {
    return getQuotations({ Customer_ID: customerId });
  } catch (error) {
    logError('getQuotationsByCustomer', error);
    return [];
  }
}

/**
 * Get quotations by status
 * Status options: Pending, Converted, Expired, Rejected, Accepted
 */
function getQuotationsByStatus(status) {
  try {
    const quotations = getQuotations(null);

    // For Expired status, we need to check the Valid_Until date
    if (status === 'Expired') {
      const now = new Date();
      return quotations.filter(quot => {
        const validUntil = new Date(quot.Valid_Until);
        return validUntil < now && quot.Status !== 'Converted';
      });
    }

    return quotations.filter(quot => quot.Status === status);

  } catch (error) {
    logError('getQuotationsByStatus', error);
    return [];
  }
}

/**
 * Get expired quotations (past Valid_Until date and not converted)
 */
function getExpiredQuotations() {
  try {
    return getQuotationsByStatus('Expired');
  } catch (error) {
    logError('getExpiredQuotations', error);
    return [];
  }
}

/**
 * Get pending quotations (awaiting conversion)
 */
function getPendingQuotations() {
  try {
    return getQuotationsByStatus('Pending');
  } catch (error) {
    logError('getPendingQuotations', error);
    return [];
  }
}

/**
 * Get recent quotations
 */
function getRecentQuotations(limit) {
  try {
    const quotations = getQuotations(null);

    // Sort by date descending
    quotations.sort((a, b) => new Date(b.DateTime) - new Date(a.DateTime));

    return quotations.slice(0, limit || 10);

  } catch (error) {
    logError('getRecentQuotations', error);
    return [];
  }
}

// =====================================================
// STATUS MANAGEMENT
// =====================================================

/**
 * Update quotation status
 * Delegates to updateQuotationStatus() in iSales.gs
 */
function updateQuotationStatus(quotationId, status, user) {
  try {
    // Valid statuses: Pending, Accepted, Rejected, Converted
    const validStatuses = ['Pending', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Converted', 'Expired'];

    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Valid options: ' + validStatuses.join(', '));
    }

    // Use the function from iSales.gs
    updateQuotationStatus(quotationId, status, null, user);

    return {
      success: true,
      message: 'Quotation status updated to: ' + status
    };

  } catch (error) {
    logError('updateQuotationStatus', error);
    throw new Error('Error updating status: ' + error.message);
  }
}

/**
 * Mark quotation as sent
 */
function markQuotationAsSent(quotationId, user) {
  try {
    return updateQuotationStatus(quotationId, 'Sent', user);
  } catch (error) {
    logError('markQuotationAsSent', error);
    throw error;
  }
}

/**
 * Mark quotation as accepted
 */
function markQuotationAsAccepted(quotationId, user) {
  try {
    return updateQuotationStatus(quotationId, 'Accepted', user);
  } catch (error) {
    logError('markQuotationAsAccepted', error);
    throw error;
  }
}

/**
 * Mark quotation as rejected
 */
function markQuotationAsRejected(quotationId, user) {
  try {
    return updateQuotationStatus(quotationId, 'Rejected', user);
  } catch (error) {
    logError('markQuotationAsRejected', error);
    throw error;
  }
}

// =====================================================
// STATISTICS AND REPORTS
// =====================================================

/**
 * Get quotation statistics
 */
function getQuotationStatistics() {
  try {
    const quotations = getQuotations(null);

    let totalQuotations = quotations.length;
    let pendingCount = 0;
    let convertedCount = 0;
    let rejectedCount = 0;
    let expiredCount = 0;
    let totalValue = 0;
    let convertedValue = 0;

    const now = new Date();

    quotations.forEach(quot => {
      totalValue += parseFloat(quot.Grand_Total) || 0;

      if (quot.Status === 'Converted') {
        convertedCount++;
        convertedValue += parseFloat(quot.Grand_Total) || 0;
      } else if (quot.Status === 'Rejected') {
        rejectedCount++;
      } else if (quot.Status === 'Pending' || quot.Status === 'Sent') {
        // Check if expired
        const validUntil = new Date(quot.Valid_Until);
        if (validUntil < now) {
          expiredCount++;
        } else {
          pendingCount++;
        }
      }
    });

    const conversionRate = totalQuotations > 0 ? (convertedCount / totalQuotations * 100) : 0;

    return {
      totalQuotations: totalQuotations,
      pendingCount: pendingCount,
      convertedCount: convertedCount,
      rejectedCount: rejectedCount,
      expiredCount: expiredCount,
      totalValue: totalValue,
      convertedValue: convertedValue,
      conversionRate: conversionRate.toFixed(2) + '%',
      averageValue: totalQuotations > 0 ? (totalValue / totalQuotations) : 0
    };

  } catch (error) {
    logError('getQuotationStatistics', error);
    return {
      totalQuotations: 0,
      pendingCount: 0,
      convertedCount: 0,
      rejectedCount: 0,
      expiredCount: 0,
      totalValue: 0,
      convertedValue: 0,
      conversionRate: '0%',
      averageValue: 0
    };
  }
}

/**
 * Generate quotation receipt/PDF
 * Delegates to generateQuotationHTML() in vReceipts.gs
 */
function generateQuotationReceipt(quotationId) {
  try {
    // Use the existing function from vReceipts.gs
    return generateQuotationHTML(quotationId);
  } catch (error) {
    logError('generateQuotationReceipt', error);
    throw new Error('Error generating quotation receipt: ' + error.message);
  }
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Check if quotation is still valid
 */
function isQuotationValid(quotationId) {
  try {
    const quotation = getQuotationById(quotationId);
    const validUntil = new Date(quotation.Valid_Until);
    const now = new Date();

    return validUntil >= now;

  } catch (error) {
    logError('isQuotationValid', error);
    return false;
  }
}

/**
 * Check if quotation can be converted
 */
function canConvertQuotation(quotationId) {
  try {
    const quotation = getQuotationById(quotationId);

    // Must be pending or accepted
    if (quotation.Status !== 'Pending' && quotation.Status !== 'Accepted') {
      return { can: false, reason: 'Quotation status must be Pending or Accepted' };
    }

    // Must not be expired
    if (!isQuotationValid(quotationId)) {
      return { can: false, reason: 'Quotation has expired' };
    }

    // Must not already be converted
    if (quotation.Converted_Sale_ID) {
      return { can: false, reason: 'Quotation already converted to sale: ' + quotation.Converted_Sale_ID };
    }

    return { can: true, reason: 'Quotation can be converted' };

  } catch (error) {
    logError('canConvertQuotation', error);
    return { can: false, reason: 'Error checking quotation: ' + error.message };
  }
}

/**
 * Get quotations expiring soon (within specified days)
 */
function getQuotationsExpiringSoon(daysAhead) {
  try {
    const days = daysAhead || 7; // Default 7 days
    const quotations = getPendingQuotations();

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return quotations.filter(quot => {
      const validUntil = new Date(quot.Valid_Until);
      return validUntil >= now && validUntil <= futureDate;
    });

  } catch (error) {
    logError('getQuotationsExpiringSoon', error);
    return [];
  }
}
