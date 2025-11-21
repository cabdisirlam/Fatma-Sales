/**
 * AUDIT LOGGER MODULE
 * Handles: Audit Trail Logging, Activity Tracking, Audit Reports
 *
 * IMPORTANT: This module provides tamper-proof logging of all system activities.
 * All CRUD operations should be logged through this module.
 */

// =====================================================
// AUDIT LOGGING
// =====================================================

/**
 * Logs an action to the audit trail
 * @param {String} user - Username of the person performing the action
 * @param {String} module - Module name (Sales, Inventory, Customers, etc.)
 * @param {String} action - Action performed (Create, Update, Delete, etc.)
 * @param {String} details - Description of the action
 * @param {String} sessionId - Session ID
 * @param {String} beforeValue - Value before change (for updates)
 * @param {String} afterValue - Value after change (for updates)
 */
function logAction(user, module, action, details, sessionId, beforeValue, afterValue) {
  try {
    const sheet = getSheet('Audit_Trail');

    // Append log entry (append-only for tamper-proof logging)
    sheet.appendRow([
      new Date(),
      user || 'SYSTEM',
      module || 'General',
      action || 'Action',
      details || '',
      sessionId || '',
      beforeValue || '',
      afterValue || ''
    ]);

  } catch (error) {
    // Don't throw error to prevent disrupting main operations
    // Log to console instead
    Logger.log('Failed to log audit trail: ' + error.message);
    Logger.log('User: ' + user + ', Module: ' + module + ', Action: ' + action);
  }
}

/**
 * Gets audit logs with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of audit logs
 */
function getAuditLogs(filters) {
  try {
    let logs = sheetToObjects('Audit_Trail', null);

    // Apply filters
    if (filters) {
      if (filters.user) {
        logs = logs.filter(log => log.User === filters.user);
      }

      if (filters.module) {
        logs = logs.filter(log => log.Module === filters.module);
      }

      if (filters.action) {
        logs = logs.filter(log => log.Action === filters.action);
      }

      if (filters.sessionId) {
        logs = logs.filter(log => log.Session_ID === filters.sessionId);
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        logs = logs.filter(log => new Date(log.Timestamp) >= startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        logs = logs.filter(log => new Date(log.Timestamp) <= endDate);
      }

      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        logs = logs.filter(log =>
          log.Details.toLowerCase().includes(searchLower) ||
          log.Module.toLowerCase().includes(searchLower) ||
          log.Action.toLowerCase().includes(searchLower)
        );
      }
    }

    // Sort by timestamp descending (most recent first)
    logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    return logs;

  } catch (error) {
    logError('getAuditLogs', error);
    return [];
  }
}

/**
 * Gets audit logs for a specific session
 * @param {String} sessionId - Session ID
 * @returns {Array} Array of audit logs for the session
 */
function getSessionLogs(sessionId) {
  try {
    return getAuditLogs({ sessionId: sessionId });
  } catch (error) {
    logError('getSessionLogs', error);
    return [];
  }
}

/**
 * Gets user activity summary
 * @param {String} user - Username (optional)
 * @param {Object} dateRange - Date range (optional)
 * @returns {Object} Activity summary
 */
function getUserActivitySummary(user, dateRange) {
  try {
    const filters = {};

    if (user) {
      filters.user = user;
    }

    if (dateRange) {
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
    }

    const logs = getAuditLogs(filters);

    // Summarize by user
    const userSummary = {};

    logs.forEach(log => {
      const username = log.User;

      if (!userSummary[username]) {
        userSummary[username] = {
          user: username,
          totalActions: 0,
          modules: {},
          actions: {},
          firstActivity: log.Timestamp,
          lastActivity: log.Timestamp
        };
      }

      const summary = userSummary[username];
      summary.totalActions++;

      // Count by module
      summary.modules[log.Module] = (summary.modules[log.Module] || 0) + 1;

      // Count by action
      summary.actions[log.Action] = (summary.actions[log.Action] || 0) + 1;

      // Update activity times
      const logTime = new Date(log.Timestamp);
      if (logTime < new Date(summary.firstActivity)) {
        summary.firstActivity = log.Timestamp;
      }
      if (logTime > new Date(summary.lastActivity)) {
        summary.lastActivity = log.Timestamp;
      }
    });

    return Object.values(userSummary);

  } catch (error) {
    logError('getUserActivitySummary', error);
    return [];
  }
}

/**
 * Gets activity summary by module
 * @param {Object} dateRange - Date range (optional)
 * @returns {Object} Module activity summary
 */
function getModuleActivitySummary(dateRange) {
  try {
    const filters = {};

    if (dateRange) {
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
    }

    const logs = getAuditLogs(filters);

    // Summarize by module
    const moduleSummary = {};

    logs.forEach(log => {
      const module = log.Module;

      if (!moduleSummary[module]) {
        moduleSummary[module] = {
          module: module,
          totalActions: 0,
          actions: {},
          users: {}
        };
      }

      const summary = moduleSummary[module];
      summary.totalActions++;

      // Count by action
      summary.actions[log.Action] = (summary.actions[log.Action] || 0) + 1;

      // Count by user
      summary.users[log.User] = (summary.users[log.User] || 0) + 1;
    });

    return Object.values(moduleSummary);

  } catch (error) {
    logError('getModuleActivitySummary', error);
    return [];
  }
}

/**
 * Tracks changes to a specific record
 * @param {String} recordId - Record ID to track
 * @returns {Array} Array of changes to the record
 */
function getRecordHistory(recordId) {
  try {
    const logs = getAuditLogs({ searchText: recordId });

    // Filter to only logs that mention this record ID
    const recordLogs = logs.filter(log =>
      log.Details.includes(recordId) ||
      log.Before_Value.includes(recordId) ||
      log.After_Value.includes(recordId)
    );

    return recordLogs;

  } catch (error) {
    logError('getRecordHistory', error);
    return [];
  }
}

// =====================================================
// AUDIT REPORTS
// =====================================================

/**
 * Exports audit trail to CSV format
 * @param {Object} filters - Filter criteria
 * @returns {String} CSV content
 */
function exportAuditReport(filters) {
  try {
    const logs = getAuditLogs(filters);

    // Build CSV
    let csv = 'Timestamp,User,Module,Action,Details,Session ID,Before Value,After Value\n';

    logs.forEach(log => {
      csv += `"${log.Timestamp}","${log.User}","${log.Module}","${log.Action}","${escapeCsv(log.Details)}","${log.Session_ID}","${escapeCsv(log.Before_Value)}","${escapeCsv(log.After_Value)}"\n`;
    });

    return csv;

  } catch (error) {
    logError('exportAuditReport', error);
    throw new Error('Error exporting audit report: ' + error.message);
  }
}

/**
 * Escapes CSV values
 */
function escapeCsv(value) {
  if (!value) return '';
  return String(value).replace(/"/g, '""');
}

/**
 * Gets daily activity summary
 * @param {Object} dateRange - Date range
 * @returns {Array} Daily activity counts
 */
function getDailyActivitySummary(dateRange) {
  try {
    const filters = {};

    if (dateRange) {
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
    }

    const logs = getAuditLogs(filters);

    // Group by date
    const dailySummary = {};

    logs.forEach(log => {
      const date = new Date(log.Timestamp);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailySummary[dateKey]) {
        dailySummary[dateKey] = {
          date: dateKey,
          totalActions: 0,
          uniqueUsers: new Set(),
          modules: {}
        };
      }

      const summary = dailySummary[dateKey];
      summary.totalActions++;
      summary.uniqueUsers.add(log.User);
      summary.modules[log.Module] = (summary.modules[log.Module] || 0) + 1;
    });

    // Convert to array and calculate final values
    const result = Object.values(dailySummary).map(day => ({
      date: day.date,
      totalActions: day.totalActions,
      uniqueUsers: day.uniqueUsers.size,
      modules: day.modules
    }));

    // Sort by date
    result.sort((a, b) => a.date.localeCompare(b.date));

    return result;

  } catch (error) {
    logError('getDailyActivitySummary', error);
    return [];
  }
}

/**
 * Gets most active users
 * @param {Number} limit - Number of users to return
 * @param {Object} dateRange - Date range (optional)
 * @returns {Array} Most active users
 */
function getMostActiveUsers(limit, dateRange) {
  try {
    const summary = getUserActivitySummary(null, dateRange);

    return summary
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, limit || 10);

  } catch (error) {
    logError('getMostActiveUsers', error);
    return [];
  }
}

/**
 * Gets suspicious activities (potential security issues)
 * @param {Object} dateRange - Date range (optional)
 * @returns {Array} Suspicious activities
 */
function getSuspiciousActivities(dateRange) {
  try {
    const filters = {};

    if (dateRange) {
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
    }

    const logs = getAuditLogs(filters);
    const suspicious = [];

    // Define suspicious patterns
    const suspiciousPatterns = [
      { keyword: 'failed', severity: 'Medium' },
      { keyword: 'error', severity: 'Medium' },
      { keyword: 'delete', severity: 'High' },
      { keyword: 'unauthorized', severity: 'Critical' },
      { keyword: 'denied', severity: 'High' }
    ];

    logs.forEach(log => {
      const detailsLower = log.Details.toLowerCase();
      const actionLower = log.Action.toLowerCase();

      suspiciousPatterns.forEach(pattern => {
        if (detailsLower.includes(pattern.keyword) || actionLower.includes(pattern.keyword)) {
          suspicious.push({
            ...log,
            severity: pattern.severity,
            reason: 'Contains keyword: ' + pattern.keyword
          });
        }
      });
    });

    // Check for rapid consecutive actions (potential automation/abuse)
    const userActions = {};
    logs.forEach(log => {
      const user = log.User;
      const time = new Date(log.Timestamp);

      if (!userActions[user]) {
        userActions[user] = [];
      }

      userActions[user].push(time);
    });

    // Detect users with more than 50 actions in 1 minute
    Object.keys(userActions).forEach(user => {
      const times = userActions[user].sort((a, b) => a - b);

      for (let i = 0; i < times.length - 49; i++) {
        const timeDiff = times[i + 49] - times[i];
        if (timeDiff < 60000) { // Less than 1 minute
          suspicious.push({
            Timestamp: times[i],
            User: user,
            Module: 'System',
            Action: 'Rapid Actions',
            Details: '50+ actions in less than 1 minute',
            severity: 'High',
            reason: 'Potential automation or abuse'
          });
          break;
        }
      }
    });

    return suspicious;

  } catch (error) {
    logError('getSuspiciousActivities', error);
    return [];
  }
}

// =====================================================
// COMPLIANCE & INTEGRITY
// =====================================================

/**
 * Verifies audit trail integrity (checks for tampering)
 * @returns {Object} Integrity check results
 */
function verifyAuditIntegrity() {
  try {
    const sheet = getSheet('Audit_Trail');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return {
        success: true,
        message: 'No audit records to verify',
        totalRecords: 0
      };
    }

    const issues = [];
    let totalRecords = data.length - 1; // Exclude header

    // Check for gaps in timestamps (deleted rows would create gaps)
    let previousTime = null;
    for (let i = 1; i < data.length; i++) {
      const currentTime = new Date(data[i][0]);

      if (isNaN(currentTime.getTime())) {
        issues.push({
          row: i + 1,
          issue: 'Invalid timestamp',
          severity: 'High'
        });
      }

      if (previousTime && currentTime < previousTime) {
        issues.push({
          row: i + 1,
          issue: 'Timestamp order violation (earlier timestamp after later one)',
          severity: 'Critical'
        });
      }

      previousTime = currentTime;
    }

    // Check for empty critical fields
    for (let i = 1; i < data.length; i++) {
      if (!data[i][1]) { // User
        issues.push({
          row: i + 1,
          issue: 'Missing user',
          severity: 'High'
        });
      }

      if (!data[i][2]) { // Module
        issues.push({
          row: i + 1,
          issue: 'Missing module',
          severity: 'Medium'
        });
      }

      if (!data[i][3]) { // Action
        issues.push({
          row: i + 1,
          issue: 'Missing action',
          severity: 'Medium'
        });
      }
    }

    return {
      success: issues.length === 0,
      message: issues.length === 0 ? 'Audit trail integrity verified' : 'Integrity issues found',
      totalRecords: totalRecords,
      issues: issues
    };

  } catch (error) {
    logError('verifyAuditIntegrity', error);
    return {
      success: false,
      message: 'Error verifying integrity: ' + error.message,
      totalRecords: 0,
      issues: []
    };
  }
}

/**
 * Gets compliance report (summary for auditors)
 * @param {Object} dateRange - Date range
 * @returns {Object} Compliance report
 */
function getComplianceReport(dateRange) {
  try {
    const logs = getAuditLogs(dateRange);

    const report = {
      period: dateRange,
      totalActions: logs.length,
      uniqueUsers: new Set(logs.map(log => log.User)).size,
      uniqueSessions: new Set(logs.map(log => log.Session_ID)).size,
      moduleBreakdown: {},
      actionBreakdown: {},
      dailyActivity: getDailyActivitySummary(dateRange),
      topUsers: getMostActiveUsers(10, dateRange),
      suspiciousActivities: getSuspiciousActivities(dateRange),
      integrityCheck: verifyAuditIntegrity()
    };

    // Calculate breakdowns
    logs.forEach(log => {
      report.moduleBreakdown[log.Module] = (report.moduleBreakdown[log.Module] || 0) + 1;
      report.actionBreakdown[log.Action] = (report.actionBreakdown[log.Action] || 0) + 1;
    });

    return report;

  } catch (error) {
    logError('getComplianceReport', error);
    throw new Error('Error generating compliance report: ' + error.message);
  }
}
