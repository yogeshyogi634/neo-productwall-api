/**
 * Date utility functions for feedback filtering
 */

/**
 * Parse and validate date string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseDate(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get start and end of day for a given date
 * @param {Date} date - The date to get boundaries for
 * @returns {Object} - Object with startOfDay and endOfDay
 */
function getDayBoundaries(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
}

/**
 * Build date filter for MongoDB queries
 * @param {string} startDate - Start date string (YYYY-MM-DD)
 * @param {string} endDate - End date string (YYYY-MM-DD)
 * @param {string} date - Single date string (YYYY-MM-DD)
 * @returns {Object|null} - MongoDB date filter object or null
 */
function buildDateFilter(startDate, endDate, date) {
  // Single date filter
  if (date) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return null;
    
    const { startOfDay, endOfDay } = getDayBoundaries(parsedDate);
    return {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    };
  }
  
  // Date range filter
  if (startDate || endDate) {
    const filter = { createdAt: {} };
    
    if (startDate) {
      const start = parseDate(startDate);
      if (start) {
        filter.createdAt.gte = getDayBoundaries(start).startOfDay;
      }
    }
    
    if (endDate) {
      const end = parseDate(endDate);
      if (end) {
        filter.createdAt.lte = getDayBoundaries(end).endOfDay;
      }
    }
    
    // Return filter only if we have at least one valid date
    return Object.keys(filter.createdAt).length > 0 ? filter : null;
  }
  
  return null;
}

/**
 * Generate date range for calendar month view
 * @param {string} monthString - Month string in YYYY-MM format
 * @returns {Object} - Object with start and end dates for the month
 */
function getMonthBoundaries(monthString) {
  if (!monthString || !/^\d{4}-\d{2}$/.test(monthString)) {
    return null;
  }
  
  const [year, month] = monthString.split('-').map(Number);
  
  const startOfMonth = new Date(year, month - 1, 1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const endOfMonth = new Date(year, month, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  return {
    startOfMonth,
    endOfMonth
  };
}

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDateString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate array of dates for a month (for calendar view)
 * @param {string} monthString - Month string in YYYY-MM format
 * @returns {Array} - Array of date strings in YYYY-MM-DD format
 */
function getMonthDates(monthString) {
  const boundaries = getMonthBoundaries(monthString);
  if (!boundaries) return [];
  
  const dates = [];
  const current = new Date(boundaries.startOfMonth);
  
  while (current <= boundaries.endOfMonth) {
    dates.push(formatDateString(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Validate date query parameters
 * @param {Object} query - Query parameters object
 * @returns {Object} - Validation result with isValid and errors
 */
function validateDateQuery(query) {
  const { startDate, endDate, date, month } = query;
  const errors = [];
  
  // Check for conflicting parameters
  if (date && (startDate || endDate)) {
    errors.push("Cannot use 'date' parameter with 'startDate' or 'endDate'");
  }
  
  // Validate date formats
  if (date && !parseDate(date)) {
    errors.push("Invalid date format. Use YYYY-MM-DD");
  }
  
  if (startDate && !parseDate(startDate)) {
    errors.push("Invalid startDate format. Use YYYY-MM-DD");
  }
  
  if (endDate && !parseDate(endDate)) {
    errors.push("Invalid endDate format. Use YYYY-MM-DD");
  }
  
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    errors.push("Invalid month format. Use YYYY-MM");
  }
  
  // Check date range logic
  if (startDate && endDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (start && end && start > end) {
      errors.push("startDate cannot be after endDate");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export {
  parseDate,
  getDayBoundaries,
  buildDateFilter,
  getMonthBoundaries,
  formatDateString,
  getMonthDates,
  validateDateQuery
};