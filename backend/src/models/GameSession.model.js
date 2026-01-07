import mongoose from "mongoose";

const gameSessionSchema = new mongoose.Schema({
  
  // Session ID from cookie
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Crop for this session
  crop: {
    type: String,
    required: true
  },

  // Language preference
  language: {
    type: String,
    default: "english"
  },

  // AI generated tips
  tips: [{
    text: { type: String, required: true }
  }],

  // AI generated MCQs
  mcqs: [{
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    explanation: { type: String }
  }],

  // User's answers
  answers: [{
    questionIndex: { type: Number, required: true },
    selectedOption: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
    answeredAt: { type: Date, default: Date.now }
  }],

  // Game state
  score: {
    type: Number,
    default: 0
  },

  isCompleted: {
    type: Boolean,
    default: false
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },

  expiresAt: {
    type: Date,
    required: true
  }

});

// Auto delete expired sessions
gameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("GameSession", gameSessionSchema);