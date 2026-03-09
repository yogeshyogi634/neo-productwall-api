import express from "express";
const router = express.Router();
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import {
  getUpdates,
  getUpdateById,
  getUpdatesByProduct,
  createUpdate,
  editUpdate,
  changeStatus,
  getStatusHistory,
  deleteUpdate,
  getStatuses,
} from "../controllers/update.controller.js";

router.get("/statuses", protect, getStatuses);
router.get("/", protect, getUpdates);
router.get("/product/:productId", protect, getUpdatesByProduct);
router.get("/:id", protect, getUpdateById);
router.get("/:id/history", protect, getStatusHistory);
router.post("/", protect, restrictTo("ADMIN", "MANAGEMENT"), createUpdate);
router.put("/:id", protect, restrictTo("ADMIN", "MANAGEMENT"), editUpdate);
router.patch("/:id/status", protect, restrictTo("ADMIN", "MANAGEMENT"), changeStatus);
router.delete("/:id", protect, restrictTo("ADMIN", "MANAGEMENT"), deleteUpdate);

export default router;
