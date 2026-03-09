import prisma from "../utils/prisma.js";
import { success, error } from "../utils/response.js";
import {
  assignRole,
  getAvailableDepartments,
} from "../utils/roleAssignment.js";
import { generateOTP, sendOTPEmail, validateEmailDomain } from "../utils/emailService.js";
import { signToken } from "../utils/jwt.js";

/**
 * POST /api/auth/request-otp
 * Request OTP for login/registration
 * Body: { name, email, department }
 */
async function requestOTP(req, res, next) {
  try {
    const { name, email, department } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return error(res, "Name is required.", 400);
    }
    if (!email || !email.trim()) {
      return error(res, "Email is required.", 400);
    }
    if (!department || !department.trim()) {
      return error(res, "Department is required.", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedName = name.trim();
    const normalizedDepartment = department.trim();

    // Validate email domain
    if (!validateEmailDomain(normalizedEmail)) {
      return error(
        res,
        "Email domain not allowed. Please use your company email address.",
        403,
      );
    }

    // Validate department
    const availableDepartments = getAvailableDepartments();
    if (!availableDepartments.includes(normalizedDepartment)) {
      return error(
        res,
        `Invalid department. Available departments: ${availableDepartments.join(", ")}`,
        400,
      );
    }

    // Rate limiting: Check recent OTP requests
    const recentOTPs = await prisma.oTP.count({
      where: {
        email: normalizedEmail,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentOTPs >= 3) {
      return error(res, "Too many OTP requests. Please try again later.", 429);
    }

    // Check if there's a recent OTP (within 1 minute for initial request)
    const recentOTP = await prisma.oTP.findFirst({
      where: {
        email: normalizedEmail,
        createdAt: {
          gte: new Date(Date.now() - 1 * 60 * 1000), // Last 1 minute
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentOTP) {
      const timeDiff = Date.now() - new Date(recentOTP.createdAt).getTime();
      const secondsLeft = Math.ceil((1 * 60 * 1000 - timeDiff) / 1000);
      return error(
        res,
        `Please wait ${secondsLeft} seconds before requesting a new OTP.`,
        429,
      );
    }

    // Invalidate existing OTPs for this email
    await prisma.oTP.updateMany({
      where: {
        email: normalizedEmail,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    const otpRecord = await prisma.oTP.create({
      data: {
        email: normalizedEmail,
        code: otpCode,
        expiresAt,
      },
    });

    // Send OTP email
    const emailResult = await sendOTPEmail(
      normalizedEmail,
      normalizedName,
      otpCode,
    );

    if (!emailResult.success) {
      return error(res, "Failed to send OTP email. Please try again.", 500);
    }

    return success(res, {
      message: "OTP sent successfully. Please check your email.",
      email: normalizedEmail,
      expiresAt,
      otpId: otpRecord.id,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/verify-otp
 * Verify OTP and complete login/registration
 * Body: { email, otpCode, name?, department? }
 */
async function verifyOTP(req, res, next) {
  try {
    const { email, otpCode, name, department } = req.body;

    // Validation
    if (!email || !otpCode) {
      return error(res, "Email and OTP code are required.", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid OTP
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: normalizedEmail,
        code: otpCode,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      // Increment attempts for existing OTP records
      await prisma.oTP.updateMany({
        where: {
          email: normalizedEmail,
          code: otpCode,
          isUsed: false,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      return error(res, "Invalid or expired OTP code.", 400);
    }

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Update existing user if new info provided
      const updateData = {};
      if (name && name.trim() && name.trim() !== user.name) {
        updateData.name = name.trim();
      }
      if (
        department &&
        department.trim() &&
        department.trim() !== user.department
      ) {
        updateData.department = department.trim();
        // Reassign role based on new department
        updateData.role = assignRole(normalizedEmail, department.trim());
      }
      updateData.isVerified = true;

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    } else {
      // Create new user
      if (!name || !department) {
        return error(
          res,
          "Name and department are required for new users.",
          400,
        );
      }

      const role = assignRole(normalizedEmail, department.trim());

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name.trim(),
          department: department.trim(),
          role,
          isVerified: true,
        },
      });
    }

    // Generate JWT token
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Set httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return success(res, {
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/resend-otp
 * Resend OTP for an email
 * Body: { email }
 */
async function resendOTP(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, "Email is required.", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email domain
    if (!validateEmailDomain(normalizedEmail)) {
      return error(res, "Email domain not allowed.", 403);
    }

    // Rate limiting: Check recent OTP requests
    const recentOTPs = await prisma.oTP.count({
      where: {
        email: normalizedEmail,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentOTPs >= 5) {
      return error(res, "Too many OTP requests. Please try again later.", 429);
    }

    // Check if there's a recent OTP (used OR unused, within 2 minutes)
    const recentOTP = await prisma.oTP.findFirst({
      where: {
        email: normalizedEmail,
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000), // Last 2 minutes
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentOTP) {
      const timeDiff = Date.now() - new Date(recentOTP.createdAt).getTime();
      const secondsLeft = Math.ceil((2 * 60 * 1000 - timeDiff) / 1000);
      return error(
        res,
        `Please wait ${secondsLeft} seconds before requesting a new OTP.`,
        429,
      );
    }

    // Invalidate existing OTPs
    await prisma.oTP.updateMany({
      where: {
        email: normalizedEmail,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    const otpRecord = await prisma.oTP.create({
      data: {
        email: normalizedEmail,
        code: otpCode,
        expiresAt,
      },
    });

    // Get user name if exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { name: true },
    });

    // Send OTP email
    const emailResult = await sendOTPEmail(
      normalizedEmail,
      user?.name || "User",
      otpCode,
    );

    if (!emailResult.success) {
      return error(res, "Failed to send OTP email. Please try again.", 500);
    }

    return success(res, {
      message: "OTP resent successfully. Please check your email.",
      email: normalizedEmail,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/departments
 * Get list of available departments
 */
async function getDepartments(req, res, next) {
  try {
    const departments = getAvailableDepartments();

    return success(res, {
      departments,
    });
  } catch (err) {
    next(err);
  }
}

export { requestOTP, verifyOTP, resendOTP, getDepartments };
