/**
 * Client-Side Caching System for Fatma Sales Dashboard
 *
 * This provides browser-side caching using localStorage to:
 * - Reduce server calls for frequently accessed reference data
 * - Provide instant UI loading for cached data
 * - Auto-refresh stale data in background
 * - Survive page reloads
 *
 * USAGE: Add this to mDashboard.html <script> section
 */

const ClientCache = (function() {
  'use strict';

  // Cache configuration
  const CONFIG = {
    PREFIX: 'fatma_cache_',
    VERSION: '1.0',
    DURATIONS: {
      CUSTOMERS: 5 * 60 * 1000,      // 5 minutes
      SUPPLIERS: 5 * 60 * 1000,      // 5 minutes
      INVENTORY: 3 * 60 * 1000,      // 3 minutes
      CATEGORIES: 60 * 60 * 1000,    // 1 hour
      ACCOUNTS: 60 * 60 * 1000,      // 1 hour
      USERS: 10 * 60 * 1000          // 10 minutes
    }
  };

  /**
   * Check if localStorage is available
   */
  function isLocalStorageAvailable() {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  const storageAvailable = isLocalStorageAvailable();

  /**
   * Generate cache key
   */
  function getCacheKey(key) {
    return CONFIG.PREFIX + CONFIG.VERSION + '_' + key;
  }

  /**
   * Get data from cache
   * @param {string} key - Cache key
   * @returns {object|null} Cached data or null if expired/missing
   */
  function get(key) {
    if (!storageAvailable) return null;

    try {
      const cacheKey = getCacheKey(key);
      const cached = localStorage.getItem(cacheKey);

      if (!cached) return null;

      const data = JSON.parse(cached);

      // Check if expired
      if (data.expiresAt && Date.now() > data.expiresAt) {
        localStorage.removeItem(cacheKey);
        console.log('Cache expired for:', key);
        return null;
      }

      console.log('Cache HIT (client) for:', key);
      return data.value;

    } catch (e) {
      console.error('Error reading from cache:', e);
      return null;
    }
  }

  /**
   * Store data in cache
   * @param {string} key - Cache key
   * @param {any} value - Data to cache
   * @param {number} duration - Duration in milliseconds (optional)
   */
  function set(key, value, duration) {
    if (!storageAvailable) return false;

    try {
      const cacheKey = getCacheKey(key);
      const expiresAt = duration ? Date.now() + duration : null;

      const cacheData = {
        value: value,
        cachedAt: Date.now(),
        expiresAt: expiresAt
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('Cached (client) for:', key, 'duration:', duration + 'ms');
      return true;

    } catch (e) {
      // Handle quota exceeded error
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old caches');
        clearOldCaches();
        // Try again
        try {
          localStorage.setItem(getCacheKey(key), JSON.stringify({
            value: value,
            cachedAt: Date.now(),
            expiresAt: duration ? Date.now() + duration : null
          }));
          return true;
        } catch (e2) {
          console.error('Still failed after clearing:', e2);
        }
      }
      console.error('Error writing to cache:', e);
      return false;
    }
  }

  /**
   * Remove specific cache entry
   */
  function remove(key) {
    if (!storageAvailable) return;

    try {
      localStorage.removeItem(getCacheKey(key));
      console.log('Removed cache for:', key);
    } catch (e) {
      console.error('Error removing cache:', e);
    }
  }

  /**
   * Clear all app caches
   */
  function clear() {
    if (!storageAvailable) return;

    try {
      const keys = Object.keys(localStorage);
      const prefix = CONFIG.PREFIX + CONFIG.VERSION + '_';

      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });

      console.log('Cleared all caches');
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  }

  /**
   * Clear old/expired caches to free up space
   */
  function clearOldCaches() {
    if (!storageAvailable) return;

    try {
      const keys = Object.keys(localStorage);
      const prefix = CONFIG.PREFIX + CONFIG.VERSION + '_';
      let cleared = 0;

      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data.expiresAt && Date.now() > data.expiresAt) {
              localStorage.removeItem(key);
              cleared++;
            }
          } catch (e) {
            // Invalid cache entry, remove it
            localStorage.removeItem(key);
            cleared++;
          }
        }
      });

      console.log('Cleared', cleared, 'old cache entries');
    } catch (e) {
      console.error('Error clearing old caches:', e);
    }
  }

  /**
   * Smart fetch with cache
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - google.script.run call
   * @param {number} duration - Cache duration in ms
   * @param {Function} successCallback - Callback for data
   */
  function smartFetch(key, fetchFunction, duration, successCallback) {
    // Try cache first
    const cached = get(key);

    if (cached) {
      // Return cached data immediately
      successCallback(cached);

      // Optionally refresh in background if more than half-expired
      const cacheKey = getCacheKey(key);
      const cacheData = JSON.parse(localStorage.getItem(cacheKey));
      const age = Date.now() - cacheData.cachedAt;

      if (age > duration / 2) {
        console.log('Background refresh for:', key);
        fetchFunction
          .withSuccessHandler(function(freshData) {
            set(key, freshData, duration);
          })
          .withFailureHandler(function(error) {
            console.error('Background refresh failed:', error);
          });
      }

      return;
    }

    // Cache miss - fetch fresh data
    console.log('Cache MISS (client) for:', key);
    fetchFunction
      .withSuccessHandler(function(data) {
        set(key, data, duration);
        successCallback(data);
      })
      .withFailureHandler(function(error) {
        console.error('Fetch error:', error);
        successCallback(null);
      });
  }

  // Public API
  return {
    get: get,
    set: set,
    remove: remove,
    clear: clear,
    clearOld: clearOldCaches,
    smartFetch: smartFetch,
    durations: CONFIG.DURATIONS
  };
})();

// =====================================================
// USAGE EXAMPLES FOR mDashboard.html
// =====================================================

/**
 * Example 1: Cache customers list
 *
 * OLD CODE (slow, no cache):
 *   google.script.run
 *     .withSuccessHandler(function(customers) {
 *       displayCustomers(customers);
 *     })
 *     .getCustomers({});
 *
 * NEW CODE (fast, with cache):
 *   ClientCache.smartFetch(
 *     'customers',
 *     google.script.run.getCustomers.bind(null, {}),
 *     ClientCache.durations.CUSTOMERS,
 *     function(customers) {
 *       displayCustomers(customers);
 *     }
 *   );
 */

/**
 * Example 2: Invalidate cache after adding customer
 *
 * After saving customer:
 *   google.script.run
 *     .withSuccessHandler(function(result) {
 *       if (result.success) {
 *         // Invalidate cache
 *         ClientCache.remove('customers');
 *         // Reload customer list
 *         loadCustomersList();
 *       }
 *     })
 *     .addCustomer(customerData);
 */

/**
 * Example 3: Load categories for dropdown
 *
 * ClientCache.smartFetch(
 *   'categories',
 *   google.script.run.getCategories,
 *   ClientCache.durations.CATEGORIES,
 *   function(categories) {
 *     populateCategoryDropdown(categories);
 *   }
 * );
 */

/**
 * Example 4: Clear all caches (for logout or reset)
 *
 * function logout() {
 *   ClientCache.clear();
 *   // ... rest of logout logic
 * }
 */

// Clear old caches on page load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', function() {
    ClientCache.clearOld();
  });
}
