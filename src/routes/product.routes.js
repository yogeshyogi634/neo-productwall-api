import express from "express";
const router = express.Router();
import { protect } from "../middleware/auth.middleware.js";
import { getProducts } from "../controllers/product.controller.js";

router.get("/", protect, getProducts);

export default router;
