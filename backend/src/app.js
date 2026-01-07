import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./middleware/session.middleware.js";
import gameRoutes from "./routes/game.routes.js";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

app.get("/", (req, res) => {
  res.json({
    message: "🌾 CropGen Puzzle API",
    status: "running"
  });
});

app.use("/api/game", gameRoutes);

export default app;
