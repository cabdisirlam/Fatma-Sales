/**
 * Centralized Caching Service Module
 * Provides caching utilities for improved performance
 * Uses Google Apps Script Cache Service with configurable TTL
 */

// =====================================================
// CACHE CONFIGURATION
// =====================================================

const CACHE_CONFIG = {
  // Cache TTL in seconds
  DEFAULT_TTL: 300,        // 5 minutes
  INVENTORY_TTL: 300,      // 5 minutes
  CUSTOMERS_TTL: 600,      // 10 minutes
  SUPPLIERS_TTL: 600,      // 10 minutes
  SALES_TTL: 180,          // 3 minutes
  FINANCIALS_TTL: 180,     // 3 minutes

  // Cache keys
  KEYS: {
    INVENTORY_ALL: 'cache_inventory_all',
    CUSTOMERS_ALL: 'cache_customers_all',
    SUPPLIERS_ALL: 'cache_suppliers_all',
    SALES_RECENT: 'cache_sales_recent',
    DASHBOARD_DATA: 'cache_dashboard_data',
    LOW_STOCK: 'cache_low_stock_items',
    CUSTOMER_DEBT: 'cache_customer_debt'
  }
};

// =====================================================
// CORE CACHE FUNCTIONS
// =====================================================

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {*} Cached data or null if not found/expired
 */
function getCachedData(key) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(key);

    if (!cached) {
      return null;
    }

    // Parse and validate
    try {
      const parsed = JSON.parse(cached);
      return parsed;
    } catch (parseError) {
      // Invalid cache data, remove it
      cache.remove(key);
      return null;
    }
  } catch (error) {
    logError('getCachedData', error);
    return null;
  }
}

/**
 * Set data in cache with TTL
 * @param {string} key - Cache key
 * @param {*} data - Data to cache (will be JSON.stringify'd)
 * @param {number} ttl - Time to live in seconds (optional, uses default)
 * @returns {boolean} Success status
 */
function setCachedData(key, data, ttl) {
  try {
    const cache = CacheService.getScriptCache();
    const ttlSeconds = ttl || CACHE_CONFIG.DEFAULT_TTL;

    // Validate data is serializable
    if (data === undefined || data === null) {
      return false;
    }

    const serialized = JSON.stringify(data);
    cache.put(key, serialized, ttlSeconds);

    return true;
  } catch (error) {
    logError('setCachedData', error);
    return false;
  }
}

/**
 * Remove specific cache entry
 * @param {string} key - Cache key to remove
 */
function clearCachedData(key) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(key);
  } catch (error) {
    logError('clearCachedData', error);
  }
}

/**
 * Clear multiple cache entries
 * @param {Array<string>} keys - Array of cache keys to remove
 */
function clearMultipleCaches(keys) {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(keys);
  } catch (error) {
    logError('clearMultipleCaches', error);
  }
}

/**
 * Clear all caches (use sparingly)
 */
function clearAllCaches() {
  try {
    const cache = CacheService.getScriptCache();

    // Clear all known cache keys
    const allKeys = Object.values(CACHE_CONFIG.KEYS);
    cache.removeAll(allKeys);

    Logger.log('All caches cleared: ' + allKeys.length + ' keys');
  } catch (error) {
    logError('clearAllCaches', error);
  }
}

// =====================================================
// MODULE-SPECIFIC CACHE FUNCTIONS
// =====================================================

/**
 * Get or fetch inventory data with caching
 * @param {Function} fetchFunction - Function to fetch data if not cached
 * @returns {Array} Inventory items
 */
function getInventoryWithCache(fetchFunction) {
  try {
    // Try cache first
    let data = getCachedData(CACHE_CONFIG.KEYS.INVENTORY_ALL);

    if (data && Array.isArray(data)) {
      return data;
    }

    // Cache miss - fetch fresh data
    data = fetchFunction();

    // Cache it
    if (data && Array.isArray(data)) {
      setCachedData(CACHE_CONFIG.KEYS.INVENTORY_ALL, data, CACHE_CONFIG.INVENTORY_TTL);
    }

    return data;
  } catch (error) {
    logError('getInventoryWithCache', error);
    // Fallback to direct fetch
    return fetchFunction();
  }
}

/**
 * Get or fetch customers data with caching
 * @param {Function} fetchFunction - Function to fetch data if not cached
 * @returns {Array} Customer records
 */
function getCustomersWithCache(fetchFunction) {
  try {
    // Try cache first
    let data = getCachedData(CACHE_CONFIG.KEYS.CUSTOMERS_ALL);

    if (data && Array.isArray(data)) {
      return data;
    }

    // Cache miss - fetch fresh data
    data = fetchFunction();

    // Cache it
    if (data && Array.isArray(data)) {
      setCachedData(CACHE_CONFIG.KEYS.CUSTOMERS_ALL, data, CACHE_CONFIG.CUSTOMERS_TTL);
    }

    return data;
  } catch (error) {
    logError('getCustomersWithCache', error);
    return fetchFunction();
  }
}

/**
 * Get or fetch suppliers data with caching
 * @param {Function} fetchFunction - Function to fetch data if not cached
 * @returns {Array} Supplier records
 */
function getSuppliersWithCache(fetchFunction) {
  try {
    // Try cache first
    let data = getCachedData(CACHE_CONFIG.KEYS.SUPPLIERS_ALL);

    if (data && Array.isArray(data)) {
      return data;
    }

    // Cache miss - fetch fresh data
    data = fetchFunction();

    // Cache it
    if (data && Array.isArray(data)) {
      setCachedData(CACHE_CONFIG.KEYS.SUPPLIERS_ALL, data, CACHE_CONFIG.SUPPLIERS_TTL);
    }

    return data;
  } catch (error) {
    logError('getSuppliersWithCache', error);
    return fetchFunction();
  }
}

/**
 * Get or fetch recent sales with caching
 * @param {Function} fetchFunction - Function to fetch data if not cached
 * @returns {Array} Recent sales
 */
function getRecentSalesWithCache(fetchFunction) {
  try {
    // Try cache first
    let data = getCachedData(CACHE_CONFIG.KEYS.SALES_RECENT);

    if (data && Array.isArray(data)) {
      return data;
    }

    // Cache miss - fetch fresh data
    data = fetchFunction();

    // Cache it
    if (data && Array.isArray(data)) {
      setCachedData(CACHE_CONFIG.KEYS.SALES_RECENT, data, CACHE_CONFIG.SALES_TTL);
    }

    return data;
  } catch (error) {
    logError('getRecentSalesWithCache', error);
    return fetchFunction();
  }
}

/**
 * Get or fetch dashboard data with caching
 * @param {Function} fetchFunction - Function to fetch data if not cached
 * @returns {Object} Dashboard metrics
 */
function getDashboardDataWithCache(fetchFunction) {
  try {
    // Try cache first
    let data = getCachedData(CACHE_CONFIG.KEYS.DASHBOARD_DATA);

    if (data && typeof data === 'object') {
      return data;
    }

    // Cache miss - fetch fresh data
    data = fetchFunction();

    // Cache it
    if (data && typeof data === 'object') {
      setCachedData(CACHE_CONFIG.KEYS.DASHBOARD_DATA, data, CACHE_CONFIG.SALES_TTL);
    }

    return data;
  } catch (error) {
    logError('getDashboardDataWithCache', error);
    return fetchFunction();
  }
}

// =====================================================
// CACHE INVALIDATION HELPERS
// =====================================================

/**
 * Invalidate inventory-related caches
 * Call this after any inventory modification
 */
function invalidateInventoryCaches() {
  clearMultipleCaches([
    CACHE_CONFIG.KEYS.INVENTORY_ALL,
    CACHE_CONFIG.KEYS.LOW_STOCK,
    CACHE_CONFIG.KEYS.DASHBOARD_DATA
  ]);
}

/**
 * Invalidate customer-related caches
 * Call this after any customer modification
 */
function invalidateCustomerCaches() {
  clearMultipleCaches([
    CACHE_CONFIG.KEYS.CUSTOMERS_ALL,
    CACHE_CONFIG.KEYS.CUSTOMER_DEBT,
    CACHE_CONFIG.KEYS.DASHBOARD_DATA
  ]);
}

/**
 * Invalidate supplier-related caches
 * Call this after any supplier modification
 */
function invalidateSupplierCaches() {
  clearMultipleCaches([
    CACHE_CONFIG.KEYS.SUPPLIERS_ALL,
    CACHE_CONFIG.KEYS.DASHBOARD_DATA
  ]);
}

/**
 * Invalidate sales-related caches
 * Call this after any sale/quotation modification
 */
function invalidateSalesCaches() {
  clearMultipleCaches([
    CACHE_CONFIG.KEYS.SALES_RECENT,
    CACHE_CONFIG.KEYS.DASHBOARD_DATA,
    CACHE_CONFIG.KEYS.INVENTORY_ALL
  ]);
}

/**
 * Invalidate financial-related caches
 * Call this after any financial transaction
 */
function invalidateFinancialCaches() {
  clearMultipleCaches([
    CACHE_CONFIG.KEYS.DASHBOARD_DATA,
    CACHE_CONFIG.KEYS.CUSTOMER_DEBT
  ]);
}

// =====================================================
// CACHE STATISTICS & MONITORING
// =====================================================

/**
 * Get cache statistics for monitoring
 * @returns {Object} Cache status information
 */
function getCacheStats() {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      caches: {}
    };

    // Check each cache key
    Object.entries(CACHE_CONFIG.KEYS).forEach(([name, key]) => {
      const cached = getCachedData(key);
      stats.caches[name] = {
        key: key,
        status: cached ? 'HIT' : 'MISS',
        size: cached ? JSON.stringify(cached).length : 0,
        type: cached ? (Array.isArray(cached) ? 'Array' : typeof cached) : 'N/A',
        count: Array.isArray(cached) ? cached.length : 'N/A'
      };
    });

    return stats;
  } catch (error) {
    logError('getCacheStats', error);
    return { error: error.message };
  }
}

/**
 * Warm up all caches (pre-load frequently accessed data)
 * Run this periodically or after system restart
 */
function warmUpCaches() {
  try {
    Logger.log('Starting cache warm-up...');

    // Inventory
    try {
      const inventory = getInventory();
      setCachedData(CACHE_CONFIG.KEYS.INVENTORY_ALL, inventory, CACHE_CONFIG.INVENTORY_TTL);
      Logger.log('Cached ' + inventory.length + ' inventory items');
    } catch (e) {
      Logger.log('Failed to cache inventory: ' + e.message);
    }

    // Customers
    try {
      const customers = getCustomers();
      setCachedData(CACHE_CONFIG.KEYS.CUSTOMERS_ALL, customers, CACHE_CONFIG.CUSTOMERS_TTL);
      Logger.log('Cached ' + customers.length + ' customers');
    } catch (e) {
      Logger.log('Failed to cache customers: ' + e.message);
    }

    // Suppliers
    try {
      const suppliers = getSuppliers();
      setCachedData(CACHE_CONFIG.KEYS.SUPPLIERS_ALL, suppliers, CACHE_CONFIG.SUPPLIERS_TTL);
      Logger.log('Cached ' + suppliers.length + ' suppliers');
    } catch (e) {
      Logger.log('Failed to cache suppliers: ' + e.message);
    }

    // Recent Sales
    try {
      const recentSales = getRecentSales(20);
      setCachedData(CACHE_CONFIG.KEYS.SALES_RECENT, recentSales, CACHE_CONFIG.SALES_TTL);
      Logger.log('Cached ' + recentSales.length + ' recent sales');
    } catch (e) {
      Logger.log('Failed to cache recent sales: ' + e.message);
    }

    Logger.log('Cache warm-up completed');

    return {
      success: true,
      message: 'Caches warmed up successfully'
    };
  } catch (error) {
    logError('warmUpCaches', error);
    return {
      success: false,
      message: 'Cache warm-up failed: ' + error.message
    };
  }
}
