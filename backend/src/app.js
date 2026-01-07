import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./middleware/session.middleware.js";
import gameRoutes from "./routes/game.routes.js";

const app = express();

// CORS - allow credentials for cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Parse JSON
app.use(express.json());

// Parse cookies
app.use(cookieParser());

// Session middleware - adds sessionId to req
app.use(sessionMiddleware);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "🌾 CropGen Puzzle API",
    version: "1.0",
    endpoints: {
      startGame: "GET /api/game/start",
      submitAnswer: "POST /api/game/answer",
      getStatus: "GET /api/game/status",
      reset: "DELETE /api/game/reset"
    }
  });
});

// Game routes
app.use("/api/game", gameRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ 
    success: false, 
    error: "Internal server error" 
  });
});

export default app;