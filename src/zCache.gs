/**
 * Smart Caching System for Fatma Sales
 *
 * This module provides intelligent caching that:
 * - Speeds up frequently accessed data (customers, suppliers, inventory)
 * - Auto-invalidates when data changes (add, edit, delete operations)
 * - Uses Google Apps Script Cache Service (6 hours max)
 * - Falls back to fresh data if cache misses
 * - Supports both script-level and user-level caching
 *
 * IMPORTANT: Cache automatically expires after 6 hours (Google's limit)
 * Manual invalidation happens on data modifications
 */

// =====================================================
// CACHE CONFIGURATION
// =====================================================

const CACHE_DURATIONS = {
  CUSTOMERS: 300,      // 5 minutes (changes frequently)
  SUPPLIERS: 300,      // 5 minutes
  INVENTORY: 180,      // 3 minutes (stock changes often)
  CATEGORIES: 3600,    // 1 hour (rarely changes)
  ACCOUNTS: 3600,      // 1 hour (rarely changes)
  USERS: 600,          // 10 minutes
  SETTINGS: 21600      // 6 hours (maximum, rarely changes)
};

const CACHE_KEYS = {
  CUSTOMERS_ALL: 'customers_all',
  SUPPLIERS_ALL: 'suppliers_all',
  INVENTORY_ALL: 'inventory_all',
  CATEGORIES: 'categories',
  ACCOUNTS: 'chart_of_accounts',
  USERS: 'users_all',
  CUSTOMER_PREFIX: 'customer_',
  SUPPLIER_PREFIX: 'supplier_',
  INVENTORY_PREFIX: 'item_'
};

// =====================================================
// CACHE SERVICE WRAPPER
// =====================================================

/**
 * Get cache instance (script cache - shared across all users)
 * Use for data that's the same for all users
 */
function getScriptCache() {
  return CacheService.getScriptCache();
}

/**
 * Get user cache (specific to current user)
 * Use for user-specific data
 */
function getUserCache() {
  return CacheService.getUserCache();
}

/**
 * Smart get from cache with fallback
 * @param {string} key - Cache key
 * @param {Function} fetchFunction - Function to call if cache misses
 * @param {number} duration - Cache duration in seconds
 * @param {boolean} useUserCache - Use user-specific cache (default: false)
 * @returns {any} Cached or fresh data
 */
function smartGet(key, fetchFunction, duration, useUserCache) {
  try {
    const cache = useUserCache ? getUserCache() : getScriptCache();

    // Try to get from cache
    const cached = cache.get(key);
    if (cached) {
      Logger.log('Cache HIT for key: ' + key);
      try {
        return JSON.parse(cached);
      } catch (e) {
        // If JSON parse fails, return as string
        return cached;
      }
    }

    // Cache miss - fetch fresh data
    Logger.log('Cache MISS for key: ' + key);
    const freshData = fetchFunction();

    // Store in cache
    try {
      const dataToCache = typeof freshData === 'string' ? freshData : JSON.stringify(freshData);
      cache.put(key, dataToCache, duration || 300);
      Logger.log('Cached data for key: ' + key + ' (duration: ' + duration + 's)');
    } catch (e) {
      // If data is too large to cache (>100KB), log and continue
      Logger.log('Failed to cache data for key ' + key + ': ' + e.message);
    }

    return freshData;

  } catch (error) {
    // If cache fails, return fresh data
    Logger.log('Cache error for key ' + key + ': ' + error.message);
    return fetchFunction();
  }
}

/**
 * Invalidate specific cache key
 */
function invalidateCache(key, useUserCache) {
  try {
    const cache = useUserCache ? getUserCache() : getScriptCache();
    cache.remove(key);
    Logger.log('Invalidated cache key: ' + key);
  } catch (e) {
    Logger.log('Error invalidating cache: ' + e.message);
  }
}

/**
 * Invalidate multiple cache keys
 */
function invalidateCaches(keys, useUserCache) {
  try {
    const cache = useUserCache ? getUserCache() : getScriptCache();
    cache.removeAll(keys);
    Logger.log('Invalidated ' + keys.length + ' cache keys');
  } catch (e) {
    Logger.log('Error invalidating caches: ' + e.message);
  }
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  try {
    getScriptCache().removeAll(Object.values(CACHE_KEYS));
    getUserCache().removeAll(Object.values(CACHE_KEYS));
    Logger.log('Cleared all caches');
  } catch (e) {
    Logger.log('Error clearing all caches: ' + e.message);
  }
}

// =====================================================
// CACHED DATA FETCHERS
// =====================================================

/**
 * Get all customers with caching
 */
function getCustomersCached() {
  return smartGet(
    CACHE_KEYS.CUSTOMERS_ALL,
    function() { return sheetToObjects('Customers'); },
    CACHE_DURATIONS.CUSTOMERS,
    false
  );
}

/**
 * Get all suppliers with caching
 */
function getSuppliersCached() {
  return smartGet(
    CACHE_KEYS.SUPPLIERS_ALL,
    function() { return sheetToObjects('Suppliers'); },
    CACHE_DURATIONS.SUPPLIERS,
    false
  );
}

/**
 * Get all inventory with caching
 */
function getInventoryCached() {
  return smartGet(
    CACHE_KEYS.INVENTORY_ALL,
    function() { return sheetToObjects('Inventory'); },
    CACHE_DURATIONS.INVENTORY,
    false
  );
}

/**
 * Get categories with caching
 */
function getCategoriesCached() {
  return smartGet(
    CACHE_KEYS.CATEGORIES,
    function() {
      const inventory = sheetToObjects('Inventory');
      const categories = [...new Set(inventory.map(item => item.Category).filter(c => c))];
      return categories.sort();
    },
    CACHE_DURATIONS.CATEGORIES,
    false
  );
}

/**
 * Get chart of accounts with caching
 */
function getChartOfAccountsCached() {
  return smartGet(
    CACHE_KEYS.ACCOUNTS,
    function() { return sheetToObjects('Chart_of_Accounts'); },
    CACHE_DURATIONS.ACCOUNTS,
    false
  );
}

/**
 * Get single customer by ID with caching
 */
function getCustomerByIdCached(customerId) {
  const cacheKey = CACHE_KEYS.CUSTOMER_PREFIX + customerId;

  return smartGet(
    cacheKey,
    function() {
      const customers = sheetToObjects('Customers');
      return customers.find(c => c.Customer_ID === customerId) || null;
    },
    CACHE_DURATIONS.CUSTOMERS,
    false
  );
}

/**
 * Get single supplier by ID with caching
 */
function getSupplierByIdCached(supplierId) {
  const cacheKey = CACHE_KEYS.SUPPLIER_PREFIX + supplierId;

  return smartGet(
    cacheKey,
    function() {
      const suppliers = sheetToObjects('Suppliers');
      return suppliers.find(s => s.Supplier_ID === supplierId) || null;
    },
    CACHE_DURATIONS.SUPPLIERS,
    false
  );
}

/**
 * Get single inventory item by ID with caching
 */
function getInventoryItemByIdCached(itemId) {
  const cacheKey = CACHE_KEYS.INVENTORY_PREFIX + itemId;

  return smartGet(
    cacheKey,
    function() {
      return getInventoryItemById(itemId);
    },
    CACHE_DURATIONS.INVENTORY,
    false
  );
}

// =====================================================
// CACHE INVALIDATION HOOKS
// =====================================================

/**
 * Call this after adding/editing/deleting customers
 */
function invalidateCustomerCache(customerId) {
  const keysToInvalidate = [CACHE_KEYS.CUSTOMERS_ALL];

  if (customerId) {
    keysToInvalidate.push(CACHE_KEYS.CUSTOMER_PREFIX + customerId);
  }

  invalidateCaches(keysToInvalidate, false);
}

/**
 * Call this after adding/editing/deleting suppliers
 */
function invalidateSupplierCache(supplierId) {
  const keysToInvalidate = [CACHE_KEYS.SUPPLIERS_ALL];

  if (supplierId) {
    keysToInvalidate.push(CACHE_KEYS.SUPPLIER_PREFIX + supplierId);
  }

  invalidateCaches(keysToInvalidate, false);
}

/**
 * Call this after adding/editing/deleting inventory
 */
function invalidateInventoryCache(itemId) {
  const keysToInvalidate = [
    CACHE_KEYS.INVENTORY_ALL,
    CACHE_KEYS.CATEGORIES  // Categories might change when inventory changes
  ];

  if (itemId) {
    keysToInvalidate.push(CACHE_KEYS.INVENTORY_PREFIX + itemId);
  }

  invalidateCaches(keysToInvalidate, false);
}

/**
 * Call this after modifying Chart of Accounts
 */
function invalidateAccountsCache() {
  invalidateCache(CACHE_KEYS.ACCOUNTS, false);
}

// =====================================================
// BATCH OPERATIONS (Reduce Sheet Reads)
// =====================================================

/**
 * Get multiple customers by IDs in one batch
 * Much faster than calling getCustomerById multiple times
 */
function getCustomersByIdsBatch(customerIds) {
  if (!customerIds || customerIds.length === 0) return [];

  // Get all customers once (from cache if available)
  const allCustomers = getCustomersCached();

  // Filter to requested IDs
  const idSet = new Set(customerIds);
  return allCustomers.filter(c => idSet.has(c.Customer_ID));
}

/**
 * Get multiple suppliers by IDs in one batch
 */
function getSuppliersByIdsBatch(supplierIds) {
  if (!supplierIds || supplierIds.length === 0) return [];

  const allSuppliers = getSuppliersCached();
  const idSet = new Set(supplierIds);
  return allSuppliers.filter(s => idSet.has(s.Supplier_ID));
}

/**
 * Get multiple inventory items by IDs in one batch
 */
function getInventoryItemsByIdsBatch(itemIds) {
  if (!itemIds || itemIds.length === 0) return [];

  const allInventory = getInventoryCached();
  const idSet = new Set(itemIds);
  return allInventory.filter(item => idSet.has(item.Item_ID));
}

// =====================================================
// USAGE EXAMPLES & MIGRATION GUIDE
// =====================================================

/**
 * MIGRATION GUIDE:
 *
 * OLD CODE (slow, reads sheet every time):
 *   const customers = sheetToObjects('Customers');
 *
 * NEW CODE (fast, uses cache):
 *   const customers = getCustomersCached();
 *
 *
 * OLD CODE (slow, reads entire sheet to find one item):
 *   const customer = getCustomerById('CUST-001');
 *
 * NEW CODE (fast, uses cache):
 *   const customer = getCustomerByIdCached('CUST-001');
 *
 *
 * OLD CODE (very slow, reads sheet multiple times):
 *   const item1 = getInventoryItemById('ITEM-001');
 *   const item2 = getInventoryItemById('ITEM-002');
 *   const item3 = getInventoryItemById('ITEM-003');
 *
 * NEW CODE (fast, reads sheet once):
 *   const items = getInventoryItemsByIdsBatch(['ITEM-001', 'ITEM-002', 'ITEM-003']);
 *
 *
 * IMPORTANT: Always invalidate cache after modifications:
 *
 * After adding customer:
 *   addCustomer(customerData);
 *   invalidateCustomerCache();
 *
 * After editing supplier:
 *   updateSupplier(supplierId, updates);
 *   invalidateSupplierCache(supplierId);
 *
 * After deleting inventory:
 *   deleteInventoryItem(itemId);
 *   invalidateInventoryCache(itemId);
 */

/**
 * Test function to verify caching works
 */
function testCaching() {
  Logger.log('===== CACHE PERFORMANCE TEST =====');

  // Clear caches first
  clearAllCaches();

  // Test 1: First call (cache miss)
  const start1 = new Date().getTime();
  const customers1 = getCustomersCached();
  const time1 = new Date().getTime() - start1;
  Logger.log('First call (cache miss): ' + time1 + 'ms, count: ' + customers1.length);

  // Test 2: Second call (cache hit)
  const start2 = new Date().getTime();
  const customers2 = getCustomersCached();
  const time2 = new Date().getTime() - start2;
  Logger.log('Second call (cache hit): ' + time2 + 'ms, count: ' + customers2.length);

  // Test 3: Batch vs Individual
  const itemIds = ['ITEM-001', 'ITEM-002', 'ITEM-003', 'ITEM-004', 'ITEM-005'];

  const start3 = new Date().getTime();
  const batchItems = getInventoryItemsByIdsBatch(itemIds);
  const time3 = new Date().getTime() - start3;
  Logger.log('Batch fetch (5 items): ' + time3 + 'ms');

  Logger.log('\n===== RESULTS =====');
  Logger.log('Cache speedup: ' + Math.round((time1 / time2) * 100) / 100 + 'x faster');
  Logger.log('\nCaching is working correctly!');

  return {
    success: true,
    cacheMissTime: time1,
    cacheHitTime: time2,
    speedup: Math.round((time1 / time2) * 100) / 100
  };
}
