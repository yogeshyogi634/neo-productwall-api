// Hardcoded management email addresses (fallback)
const MANAGEMENT_EMAILS = [
  "cto@neokred.tech", 
  "manager1@neokred.tech",
  "manager2@neokred.tech",
  "lead@neokred.tech",
  "teamlead@neokred.tech",
  "hr@neokred.tech",
  "operations@neokred.tech"
];

// Publicly available departments for selection/validation
const PUBLIC_DEPARTMENTS = [
  "Product Manager",
  "Engineer",
  "Designer", 
  "QA",
  "Finance",
  "HR",
  "Marketing",
  "Other"
];

// Department-based role mapping
const DEPARTMENT_ROLE_MAP = {
  // Public mappings
  "Product Manager": "MANAGEMENT",
  "Engineer": "MANAGEMENT",
  "Designer": "MANAGEMENT", 
  "QA": "MANAGEMENT",
  "Finance": "EMPLOYEE",
  "HR": "MANAGEMENT",
  "Marketing": "EMPLOYEE",
  "Other": "EMPLOYEE",
  
  // Legacy/Internal mappings (keeping for existing records/admins)
  "ADMIN": "ADMIN",
  "CEO Office": "ADMIN",
  "Management": "MANAGEMENT",
  "Leadership": "ADMIN",
  "Admin": "ADMIN",
};

/**
 * Assign role based on email and department (for initial user creation only)
 * NOTE: Once a user exists in the database, their role should be read from the database,
 * not recalculated using this function.
 * @param {string} email - User's email address
 * @param {string} department - User's department (optional)
 * @returns {string} Role - "ADMIN", "MANAGEMENT", or "EMPLOYEE"
 */
function assignRole(email, department = null) {
  // Admin has full access (specific admin emails)
  if (email === "madhav@neokred.tech") {
    return "ADMIN";
  }
  
  // For all other users, default to EMPLOYEE
  // Admin will assign roles through the admin panel
  return "EMPLOYEE";
}

/**
 * Check if user has permission for a specific action
 * @param {string} userRole - User's role
 * @param {string} action - Action to check ("CREATE_UPDATE", "CREATE_REPLY", "CREATE_FEEDBACK")
 * @returns {boolean} True if user has permission
 */
function hasPermission(userRole, action) {
  const permissions = {
    ADMIN: ["CREATE_UPDATE", "CREATE_REPLY", "CREATE_FEEDBACK", "DELETE_ANY", "EDIT_ANY"],
    MANAGEMENT: ["CREATE_UPDATE", "CREATE_REPLY", "CREATE_FEEDBACK"],
    EMPLOYEE: ["CREATE_FEEDBACK"]
  };
  
  return permissions[userRole]?.includes(action) || false;
}

/**
 * Get all available departments
 * @returns {Array} List of available public departments
 */
function getAvailableDepartments() {
  return PUBLIC_DEPARTMENTS.sort();
}

/**
 * Get department role mapping for frontend display
 * @returns {Object} Department to role mapping
 */
function getDepartmentRoleMap() {
  return { ...DEPARTMENT_ROLE_MAP };
}

export { 
  assignRole, 
  hasPermission, 
  getAvailableDepartments, 
  getDepartmentRoleMap,
  MANAGEMENT_EMAILS,
  DEPARTMENT_ROLE_MAP 
};