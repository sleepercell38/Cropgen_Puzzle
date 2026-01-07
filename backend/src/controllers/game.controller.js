// controllers/game.controller.js
import GameSession from "../models/GameSession.model.js";
import { generateTips, generateMCQs, getTodaysCrop } from "../config/gemini.js";
import { getTimeRemaining, isWithin24Hours } from "../utils/helpers.js";

/**
 * GET /api/game/start
 * Start or resume a game
 */
export const startGame = async (req, res) => {
  try {
    const { sessionId } = req;
    const language = req.query.language || "english";

    const existingSession = await GameSession.findOne({ sessionId });

    // CASE 1: Session exists and within 24 hours
    if (existingSession && isWithin24Hours(existingSession.createdAt)) {
      const timer = getTimeRemaining(existingSession.createdAt);

      return res.json({
        success: true,
        isNewGame: false,
        message: "You have already generated today's tips. Come back tomorrow for new tips!",
        data: {
          crop: existingSession.crop,
          language: existingSession.language,
          tips: existingSession.tips,
          mcqs: existingSession.mcqs.map((mcq, index) => {
            const answered = existingSession.answers.find(a => a.questionIndex === index);
            return {
              index,
              question: mcq.question,
              options: mcq.options,
              correctAnswer: answered ? mcq.correctAnswer : undefined,
              explanation: answered ? mcq.explanation : undefined,
              userAnswer: answered?.selectedOption,
              isCorrect: answered?.isCorrect,
              isAnswered: !!answered
            };
          }),
          score: existingSession.score,
          answeredCount: existingSession.answers.length,
          totalQuestions: 12,
          isCompleted: existingSession.isCompleted,
          timer
        }
      });
    }

    // CASE 2: No session or expired - Generate new content
    const crop = getTodaysCrop();
    
    const [tips, mcqs] = await Promise.all([
      generateTips(crop, language),
      generateMCQs(crop, language)
    ]);

    // Delete old session if exists
    if (existingSession) {
      await GameSession.deleteOne({ sessionId });
    }

    // Create new session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const newSession = await GameSession.create({
      sessionId,
      crop,
      language,
      tips,
      mcqs,
      answers: [],
      score: 0,
      isCompleted: false,
      expiresAt
    });

    const timer = getTimeRemaining(newSession.createdAt);

    return res.json({
      success: true,
      isNewGame: true,
      message: `Today's tips are about ${crop} farming! Answer questions to unlock tips.`,
      data: {
        crop: newSession.crop,
        language: newSession.language,
        tips: newSession.tips,
        mcqs: newSession.mcqs.map((mcq, index) => ({
          index,
          question: mcq.question,
          options: mcq.options,
          isAnswered: false
        })),
        score: 0,
        answeredCount: 0,
        totalQuestions: 12,
        isCompleted: false,
        timer
      }
    });

  } catch (error) {
    console.error("startGame error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * POST /api/game/answer
 * Submit answer for a question
 */
export const submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req;
    const { questionIndex, selectedOption } = req.body;

    if (questionIndex === undefined || selectedOption === undefined) {
      return res.status(400).json({
        success: false,
        error: "questionIndex and selectedOption are required"
      });
    }

    const session = await GameSession.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "No active game found. Please start a new game."
      });
    }

    const alreadyAnswered = session.answers.find(a => a.questionIndex === questionIndex);
    if (alreadyAnswered) {
      return res.status(400).json({
        success: false,
        error: "Question already answered"
      });
    }

    const mcq = session.mcqs[questionIndex];
    if (!mcq) {
      return res.status(404).json({
        success: false,
        error: "Question not found"
      });
    }

    const isCorrect = selectedOption === mcq.correctAnswer;
    const pointsEarned = isCorrect ? 10 : 0;

    session.answers.push({
      questionIndex,
      selectedOption,
      isCorrect,
      answeredAt: new Date()
    });
    
    session.score += pointsEarned;
    
    if (session.answers.length >= 12) {
      session.isCompleted = true;
    }

    await session.save();

    const tip = session.tips[questionIndex];

    return res.json({
      success: true,
      result: {
        questionIndex,
        selectedOption,
        isCorrect,
        correctAnswer: mcq.correctAnswer,
        explanation: mcq.explanation,
        tip: isCorrect ? tip : null,
        pointsEarned,
        totalScore: session.score,
        answeredCount: session.answers.length,
        isGameComplete: session.isCompleted,
        message: isCorrect 
          ? "🎉 Correct! You unlocked a farming tip!" 
          : "❌ Wrong answer. Try the next question!"
      }
    });

  } catch (error) {
    console.error("submitAnswer error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * GET /api/game/status
 * Get current game status
 */
export const getGameStatus = async (req, res) => {
  try {
    const { sessionId } = req;
    const session = await GameSession.findOne({ sessionId });

    if (!session) {
      return res.json({
        success: true,
        hasActiveGame: false,
        message: "No active game. Start a new game!"
      });
    }

    const timer = getTimeRemaining(session.createdAt);

    return res.json({
      success: true,
      hasActiveGame: true,
      data: {
        crop: session.crop,
        score: session.score,
        answeredCount: session.answers.length,
        totalQuestions: 12,
        isCompleted: session.isCompleted,
        timer
      }
    });

  } catch (error) {
    console.error("getGameStatus error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * DELETE /api/game/reset
 * Reset game
 */
export const resetGame = async (req, res) => {
  try {
    const { sessionId } = req;
    await GameSession.deleteOne({ sessionId });
    res.clearCookie("sessionId");

    return res.json({
      success: true,
      message: "Game reset successfully. Start a new game!"
    });

  } catch (error) {
    console.error("resetGame error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};