/**
 * Status mapping utility for consistent display across frontend and backend
 */

export const STATUS_DISPLAY_MAP = {
  WIP: "WIP",
  IN_PROGRESS: "IN PROGRESS",
  RESOLVED: "RESOLVED",
  DONE: "DONE",
  PLANNED: "PLANNED",
  SHIPPED: "SHIPPED",
  DEPRECATED: "DEPRECATED",
  ON_HOLD: "ON HOLD",
  CANCELLED: "CANCELLED",
};

export const STATUS_DISPLAY_MAP_FRIENDLY = {
  WIP: "Work in Progress",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  DONE: "Done",
  PLANNED: "Planned",
  SHIPPED: "Shipped",
  DEPRECATED: "Deprecated",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

/**
 * Get display name for a status
 * @param {string} status - The status enum value
 * @param {boolean} friendly - Whether to return friendly name or short name
 * @returns {string} The display name
 */
export function getStatusDisplayName(status, friendly = false) {
  const map = friendly ? STATUS_DISPLAY_MAP_FRIENDLY : STATUS_DISPLAY_MAP;
  return map[status] || status;
}

/**
 * Get all valid statuses with their display names
 * @param {boolean} friendly - Whether to return friendly names or short names
 * @returns {Array} Array of status objects with value and label
 */
export function getAllStatuses(friendly = false) {
  const map = friendly ? STATUS_DISPLAY_MAP_FRIENDLY : STATUS_DISPLAY_MAP;
  return Object.entries(map).map(([value, label]) => ({
    value,
    label,
  }));
}
