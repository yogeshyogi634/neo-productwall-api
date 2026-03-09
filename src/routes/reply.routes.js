import express from "express";
const router = express.Router();
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { createReply, deleteReply } from "../controllers/reply.controller.js";

router.post("/", protect, restrictTo("ADMIN", "MANAGEMENT"), createReply);
router.delete("/:id", protect, restrictTo("ADMIN", "MANAGEMENT"), deleteReply);

export default router;
