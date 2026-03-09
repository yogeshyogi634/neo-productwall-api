import express from "express";
const router = express.Router();
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  signup,
  signin,
  getMe,
  logout,
  getAllUsers,
  updateUser,
  deleteUser,
  devLogin,
  getAdminLogs,
} from "../controllers/auth.controller.js";
import {
  requestOTP,
  verifyOTP,
  resendOTP,
  getDepartments,
} from "../controllers/otpAuth.controller.js";

// Public routes
router.post("/signup", signup); // New Signup
router.post("/signin", signin); // New Signin
router.get("/departments", getDepartments); // Get available departments
router.post("/request-otp", requestOTP); // Request OTP for login
router.post("/verify-otp", verifyOTP); // Verify OTP and login
router.post("/resend-otp", resendOTP); // Resend OTP

// Legacy routes (can be removed later)
router.post("/dev-login", devLogin); // DEV ONLY — remove in production

// Protected routes
router.get("/me", protect, getMe);
router.get("/users", protect, restrictTo("ADMIN"), getAllUsers);
router.patch("/users/:id", protect, restrictTo("ADMIN"), updateUser);
router.delete("/users/:id", protect, restrictTo("ADMIN"), deleteUser);
router.get("/admin-logs", protect, restrictTo("ADMIN"), getAdminLogs);
router.post("/logout", protect, logout);

export default router;
