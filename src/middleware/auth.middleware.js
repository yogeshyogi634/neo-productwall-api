import { verifyToken } from "../utils/jwt.js";
import { error } from "../utils/response.js";
import prisma from "../utils/prisma.js";

/**
 * Protect routes — verifies JWT from cookie or Authorization header
 */
async function protect(req, res, next) {
  try {
    let token;

    // 1. Check Authorization header first
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. Fallback to cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    // 3. Verify token
    const decoded = verifyToken(token);

    // 4. Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return error(res, "User no longer exists.", 401);
    }

    // 5. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return error(res, "Invalid token.", 401);
    }
    if (err.name === "TokenExpiredError") {
      return error(res, "Token expired. Please login again.", 401);
    }
    return error(res, "Authentication failed.", 401);
  }
}

/**
 * Restrict to specific roles
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    // Debug log for permission failures
    console.log(`[RestrictTo] Checking permission for user ${req.user?.email} (${req.user?.role}) against required roles: ${roles.join(", ")}`);
    
    // Normalize user role and allowed roles to uppercase for comparison
    const userRole = req.user.role ? req.user.role.toUpperCase() : "";
    const allowedRoles = roles.map(r => r.toUpperCase());

    // MASTER OVERRIDE: madhav@neokred.tech always has permission
    if (req.user.email === "madhav@neokred.tech") {
        console.log(`[RestrictTo] MASTER OVERRIDE for ${req.user.email}`);
        return next();
    }

    if (!allowedRoles.includes(userRole)) {
       console.log(`[RestrictTo] ACCESS DENIED. User role: '${req.user.role}' | Allowed: '${roles.join(", ")}'`);
      return error(
        res,
        "You do not have permission to perform this action.",
        403,
      );
    }
    next();
  };
}

/**
 * Validate that email belongs to allowed domain
 */
function validateDomain(email) {
  const allowedDomain = process.env.ALLOWED_DOMAIN;
  if (!allowedDomain) return true; // skip if not configured

  const domain = email.split("@")[1];
  return domain === allowedDomain;
}

export { protect, restrictTo, validateDomain };
