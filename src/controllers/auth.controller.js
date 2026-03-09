console.log("🔥 AUTH CONTROLLER LOADED - NEW VERSION 🔥");
import prisma from "../utils/prisma.js";
import { signToken } from "../utils/jwt.js";
import { success, error } from "../utils/response.js";
import { validateDomain } from "../middleware/auth.middleware.js";
import {
  assignRole,
  getAvailableDepartments,
} from "../utils/roleAssignment.js";
import { compare, hash } from "bcryptjs";
import { sendWelcomeEmail, sendApprovalEmail, sendRejectionEmail } from "../utils/emailService.js";

/**
 * POST /api/auth/signup
 * Register a new user with OTP verification
 * Body: { name, email, password, department, otp }
 */
async function signup(req, res, next) {
  try {
    const { name, email, password, department, otp } = req.body;

    // Validation
    if (!name || !email || !password || !department || !otp) {
      return error(res, "All fields are required.", 400);
    }

    const normalizedDepartment = department.trim();
    const availableDepartments = getAvailableDepartments();
    if (!availableDepartments.includes(normalizedDepartment)) {
      return error(
        res,
        `Invalid department. Available departments: ${availableDepartments.join(", ")}`,
        400,
      );
    }

    if (password.length < 6) {
      return error(res, "Password must be at least 6 characters.", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify OTP
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: normalizedEmail,
        code: otp,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return error(res, "Invalid or expired OTP.", 400);
    }

    // 2. Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return error(res, "User already exists.", 400);
    }

    // 3. Mark OTP as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // 4. Hash password
    const hashedPassword = await hash(password, 10);

    // 5. Create User
    // Auto-verify only if it's the specific admin email
    const shouldAutoVerify = normalizedEmail === "madhav@neokred.tech";

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        department: normalizedDepartment,
        role: assignRole(normalizedEmail, normalizedDepartment),
        isVerified: shouldAutoVerify,
      },
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(
        normalizedEmail,
        name.trim(),
        normalizedDepartment,
      );
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the signup if email fails
    }

    // Don't auto-login users who need approval
    if (shouldAutoVerify) {
      // 6. Generate Token (only for admin)
      const token = signToken(user);

      // 7. Set Cookie (only for admin)
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(res, {
        message: "Admin user registered and logged in successfully.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          isVerified: user.isVerified,
        },
        token,
      });
    }

    return success(res, {
      message: "User registered successfully. Please sign in to continue.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/signin
 * Login with Email and Password
 * Body: { email, password }
 */
async function signin(req, res, next) {
  try {
    console.log("🔥 SIGNIN REQUEST RECEIVED 🔥");
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, "Email and password are required.", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ─── HARDCODED ADMIN BACKDOOR (User Requested) ───
    if (
      normalizedEmail === "madhav@neokred.tech" &&
      password === "Madhav@0123"
    ) {
      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        // Determine Role & Department
        // Use a default admin department if none exists for this email
        const dept = "ADMIN";
        const role = "ADMIN";

        // Create the user if they don't exist
        const hashedPassword = await hash(password, 10);

        user = await prisma.user.create({
          data: {
            name: "Madhav",
            email: normalizedEmail,
            password: hashedPassword,
            department: dept,
            role: role,
            isVerified: true,
          },
        });
      } else {
        // FORCE UPDATE ROLE TO ADMIN
        // This ensures that even if the user existed with a different role,
        // using the hardcoded credentials keeps them as ADMIN.
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: "ADMIN",
            department: "ADMIN", // Optional: sync department too
            isVerified: true, // Ensure admin is always verified
          },
        });
      }

      // Generate Token
      const token = signToken(user);

      // Set Cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(res, {
        message: "Login successful (Admin Bypass).",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          avatarUrl: user.avatarUrl,
          isVerified: user.isVerified,
        },
        token,
      });
    }
    // ────────────────────────────────────────────────

    // 1. Find User
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return error(res, "Invalid credentials.", 401);
    }

    // 2. Check Password
    if (!user.password) {
      return error(
        res,
        "Please login with your previous method (Google/OTP) or reset your password.",
        400,
      );
    }

    const isMatch = await compare(password, user.password);

    if (!isMatch) {
      return error(res, "Invalid credentials.", 401);
    }

    // 2.5 Check if user is verified
    if (!user.isVerified) {
      return error(
        res,
        "Your account is pending approval. Please wait for admin verification.",
        403,
      );
    }

    // 3. Generate Token
    const token = signToken(user);

    // 4. Set Cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return success(res, {
      message: "Login successful [VERIFIED].",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatarUrl,
        isVerified: true,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Get current logged-in user
 */
async function getMe(req, res) {
  return success(res, { user: req.user });
}

/**
 * POST /api/auth/logout
 * Clear auth cookie
 */
async function logout(req, res) {
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });
  return success(res, { message: "Logged out successfully." });
}

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
async function getAllUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true, // Now required by frontend
        department: true,
        isVerified: true, // Now required by frontend
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return success(res, { users });
  } catch (err) {
    next(err);
  }
}

// ─── DEV ONLY: Login without Google (for testing) ───
async function devLogin(req, res, next) {
  try {
    if (process.env.NODE_ENV === "production") {
      return error(res, "Dev login is not available in production.", 403);
    }

    const { email } = req.body;

    if (!email) {
      return error(res, "Email is required.", 400);
    }

    if (!validateDomain(email)) {
      return error(
        res,
        `Only @${process.env.ALLOWED_DOMAIN} email addresses are allowed.`,
        403,
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
          role: assignRole(email),
          department: "Engineering",
          isVerified: true,
        },
      });
    }

    const token = signToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return success(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isVerified: true,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

// ─── ADMIN ONLY: Update User ───
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { role, department, isVerified } = req.body;

    // STRICT RESTRICTION: Only madhav@neokred.tech can approve (verify) users
    // If isVerified is being set to true (or changed at all), check email
    if (isVerified === true) {
      if (req.user.email !== "madhav@neokred.tech") {
        return error(
          res,
          "Only the Super Admin (madhav@neokred.tech) can approve users.",
          403,
        );
      }
    }

    // Validation for department
    if (department) {
      console.log(
        `[UpdateUser] Changing department for ${id} to ${department}`,
      );
      const availableDepartments = getAvailableDepartments();
      if (
        !availableDepartments.includes(department) &&
        department !== "ADMIN"
      ) {
        return error(
          res,
          `Invalid department. Available departments: ${availableDepartments.join(", ")}`,
          400,
        );
      }
    }

    // Validation for role
    if (role) {
      const validRoles = ["ADMIN", "MANAGEMENT", "EMPLOYEE"];
      if (!validRoles.includes(role.toUpperCase())) {
        return error(
          res,
          `Invalid role. Valid roles: ${validRoles.join(", ")}`,
          400,
        );
      }
      // Normalize role to uppercase
      req.body.role = role.toUpperCase();
    }

    console.log(`[UpdateUser] Updating user ${id} with data:`, {
      role: req.body.role,
      department,
      isVerified,
    });

    // Get current user status before updating
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true, isVerified: true }
    });

    if (!currentUser) {
      return error(res, "User not found.", 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: req.body.role, // Use the (potentially calculated) role
        department,
        isVerified,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true, // Now required
        department: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Send email notifications for approval/rejection
    if (typeof isVerified === 'boolean' && currentUser.isVerified !== isVerified) {
      try {
        if (isVerified === true) {
          // User was approved
          await sendApprovalEmail(currentUser.email, currentUser.name);
          console.log(`✅ Approval email sent to: ${currentUser.email}`);
        } else if (isVerified === false) {
          // User was rejected
          await sendRejectionEmail(currentUser.email, currentUser.name);
          console.log(`📧 Rejection email sent to: ${currentUser.email}`);
        }
      } catch (emailError) {
        console.error("Failed to send approval/rejection email:", emailError);
        // Don't fail the update if email fails
      }
    }

    // 6. Log the action
    if (req.body.role || isVerified) {
      let action = "UPDATE";
      let details = [];

      if (isVerified === true) action = "APPROVE";
      if (req.body.role) details.push(`Role set to ${req.body.role}`);
      if (isVerified) details.push("User verified");

      const targetUser = await prisma.user.findUnique({ where: { id } });
      await prisma.adminLog.create({
        data: {
          action,
          targetId: id,
          targetName: targetUser?.name,
          targetEmail: targetUser?.email,
          adminId: req.user.id,
          details: details.join(", "),
        },
      });
    }

    return success(res, { user });
  } catch (err) {
    if (err.code === "P2025") {
      return error(res, "User not found.", 404);
    }
    next(err);
  }
}

// ─── ADMIN ONLY: Delete User ───
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    // Prevent deleting self
    if (req.user.id === id) {
      return error(res, "You cannot delete yourself.", 403);
    }

    // Log before deletion (since we need the user link, though technically if user is deleted relation might fail depending on cascade.
    // For now we'll log 'REMOVE' but if user is deleted, relation to targetId might be tricky with referential integrity.
    // We'll keep the log but maybe the relation needs to be optional or we just store the ID string if we were doing strict history.
    // Prisma default is usually strict. Let's try to delete.

    const targetUser = await prisma.user.findUnique({ where: { id } });

    await prisma.adminLog.create({
      data: {
        action: "REMOVE",
        targetId: id,
        targetName: targetUser?.name,
        targetEmail: targetUser?.email,
        adminId: req.user.id,
        details: "User removed from system",
      },
    });

    await prisma.user.delete({
      where: { id },
    });

    return success(res, { message: "User deleted successfully." });
  } catch (err) {
    if (err.code === "P2025") {
      return error(res, "User not found.", 404);
    }
    next(err);
  }
}

// ─── ADMIN ONLY: Get Logs ───
async function getAdminLogs(req, res, next) {
  try {
    const logs = await prisma.adminLog.findMany({
      include: {
        adminUser: {
          select: { name: true, email: true },
        },
        targetUser: {
          select: { name: true, email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return success(res, { logs });
  } catch (err) {
    next(err);
  }
}

export {
  signup,
  signin,
  getMe,
  logout,
  getAllUsers,
  devLogin,
  updateUser,
  deleteUser,
  getAdminLogs,
};
