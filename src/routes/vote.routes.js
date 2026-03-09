import express from "express";
const router = express.Router();
import { protect } from "../middleware/auth.middleware.js";
import { castVote, removeVote } from "../controllers/vote.controller.js";

router.post("/", protect, castVote);
router.delete("/:updateId", protect, removeVote);

export default router;
