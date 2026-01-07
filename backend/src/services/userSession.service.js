// services/userSession.service.js
import UserSession from "../models/UserSession.model.js";
import { getGameDate } from "../utils/dateUtils.js";

export const getUserSession = async (userId) => {
  const date = getGameDate();
  
  let session = await UserSession.findOne({ oderId: oderId, date });
  
  if (!session) {
    // Check yesterday's session for streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];
    
    const yesterdaySession = await UserSession.findOne({ 
      oderId: oderId,
      date: yesterdayDate,
      hasCompleted: true 
    });
    
    const streak = yesterdaySession ? yesterdaySession.streak : 0;
    
    session = await UserSession.create({
      oderId: oderId,
      date,
      hasPlayed: false,
      hasCompleted: false,
      currentQuestion: 0,
      score: 0,
      streak,
      answers: []
    });
  }
  
  return session;
};

export const startGameSession = async (userId) => {
  const date = getGameDate();
  
  return await UserSession.findOneAndUpdate(
    { oderId: oderId, date },
    { $set: { hasPlayed: true, startedAt: new Date() } },
    { upsert: true, new: true }
  );
};

export const recordAnswer = async (userId, puzzleId, questionIndex, selectedOption, isCorrect) => {
  const date = getGameDate();
  
  const existing = await UserSession.findOne({ 
    oderId: oderId, 
    date,
    "answers.puzzleId": puzzleId 
  });
  
  if (existing) {
    throw new Error("Question already answered");
  }
  
  return await UserSession.findOneAndUpdate(
    { oderId: oderId, date },
    {
      $push: {
        answers: { puzzleId, questionIndex, selectedOption, isCorrect, answeredAt: new Date() }
      },
      $set: { currentQuestion: questionIndex + 1 },
      $inc: { 
        score: isCorrect ? 100 : 0,
        streak: isCorrect ? 1 : 0
      }
    },
    { new: true }
  );
};

export const completeGameSession = async (userId, finalScore) => {
  const date = getGameDate();
  
  return await UserSession.findOneAndUpdate(
    { oderId: oderId, date },
    { 
      $set: { 
        hasCompleted: true, 
        completedAt: new Date(),
        score: finalScore
      },
      $inc: { streak: 1 }
    },
    { new: true }
  );
};

export const getUserStats = async (userId) => {
  const sessions = await UserSession.find({ 
    oderId: oderId, 
    hasCompleted: true 
  }).sort({ date: -1 }).limit(30);
  
  const totalGames = sessions.length;
  const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
  const bestScore = Math.max(...sessions.map(s => s.score), 0);
  const currentStreak = sessions[0]?.streak || 0;
  
  return {
    totalGames,
    totalScore,
    bestScore,
    currentStreak,
    averageScore: totalGames > 0 ? Math.round(totalScore / totalGames) : 0
  };
};