import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./middleware/session.middleware.js";
import gameRoutes from "./routes/game.routes.js";

const app = express();

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "🌾 CropGen Puzzle API",
    status: "running"
  });
});

app.use("/api/game", gameRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
