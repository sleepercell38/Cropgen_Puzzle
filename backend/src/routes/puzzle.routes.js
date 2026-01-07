// routes/puzzle.routes.js
import { Router } from "express";
import { extractUser, requireAuth } from "../middleware/auth.middleware.js";
import { 
  getDailyPuzzles, 
  submitAnswer,
  getGameStatus, 
  resetContent,
  forceRegenerate
} from "../controllers/puzzle.controller.js";

const router = Router();

router.use(extractUser);

router.get("/daily", requireAuth, getDailyPuzzles);
router.post("/answer", requireAuth, submitAnswer);
router.get("/status", getGameStatus);

// Dev only
router.delete("/reset", resetContent);
router.post("/regenerate", forceRegenerate);

export default router;