import { Router } from "express";
import { 
  startGame, 
  submitAnswer, 
  getGameStatus, 
  resetGame 
} from "../controllers/game.controller.js";

const router = Router();

// Start or resume game
router.get("/start", startGame);

// Submit answer
router.post("/answer", submitAnswer);

// Get game status
router.get("/status", getGameStatus);

// Reset game (for testing)
router.delete("/reset", resetGame);

export default router;