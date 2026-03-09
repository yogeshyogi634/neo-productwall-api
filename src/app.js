import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFound } from "./middleware/error.middleware.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import updateRoutes from "./routes/update.routes.js";
import voteRoutes from "./routes/vote.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import replyRoutes from "./routes/reply.routes.js";

const app = express();

// ─── Global Middleware ───
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // allow cookies
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Check ───
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/updates", updateRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/replies", replyRoutes);

// ─── Error Handling ───
app.use(notFound);
app.use(errorHandler);

export default app;
