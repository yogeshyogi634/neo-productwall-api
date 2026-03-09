import { error } from "../utils/response.js";
import { hasPermission } from "../utils/roleAssignment.js";

/**
 * Middleware to restrict access based on user roles
 * @param {...string} allowedRoles - Roles that can access this endpoint
 * @returns {Function} Express middleware function
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Ensure user is authenticated (should be set by protect middleware)
    if (!req.user) {
      return error(res, "Authentication required.", 401);
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      const action = getActionFromRequest(req);
      return error(res, getPermissionErrorMessage(action, req.user.role), 403);
    }

    next();
  };
}

/**
 * Middleware to check specific permissions
 * @param {string} action - Action to check permission for
 * @returns {Function} Express middleware function
 */
function requirePermission(action) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, "Authentication required.", 401);
    }

    if (!hasPermission(req.user.role, action)) {
      return error(res, getPermissionErrorMessage(action, req.user.role), 403);
    }

    next();
  };
}

/**
 * Get action type from request
 * @param {Object} req - Express request object
 * @returns {string} Action type
 */
function getActionFromRequest(req) {
  const { method, path, startUrl } = req;
  
  if (method === "POST" && (path === "/" || path === "")) return startUrl?.includes("updates") ? "CREATE_UPDATE" : "UNKNOWN";
  
  return "UNKNOWN_ACTION";
}

/**
 * Get appropriate error message based on action and user role
 * @param {string} action - Action being attempted
 * @param {string} userRole - User's current role
 * @returns {string} Error message
 */
function getPermissionErrorMessage(action, userRole) {
  const messages = {
    CREATE_UPDATE: {
      EMPLOYEE: "Access denied. Only management can create product updates. Contact your administrator for elevated permissions.",
      default: "Access denied. Insufficient permissions to create updates."
    },
    CREATE_REPLY: {
      EMPLOYEE: "Access denied. Only management can reply to feedback. Contact your administrator for elevated permissions.",
      default: "Access denied. Insufficient permissions to reply to feedback."
    },
    CREATE_FEEDBACK: {
      default: "Access denied. All authenticated users should be able to create feedback."
    },
    UNKNOWN_ACTION: {
      default: "Access denied. Insufficient permissions for this action."
    }
  };

  const actionMessages = messages[action] || messages.UNKNOWN_ACTION;
  return actionMessages[userRole] || actionMessages.default;
}

/**
 * Middleware to allow management and admin roles only
 */
const requireManagement = requireRole("ADMIN", "MANAGEMENT");

/**
 * Middleware to allow admin role only
 */
const requireAdmin = requireRole("ADMIN");

export { 
  requireRole, 
  requirePermission, 
  requireManagement, 
  requireAdmin,
  getPermissionErrorMessage 
};