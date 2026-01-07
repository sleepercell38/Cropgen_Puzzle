// services/dailyContent.service.js
import DailyContent from "../models/DailyContent.model.js";
import { generateTips, generateMCQs } from "../config/gemini.js";
import { getGameDate, getDailyCrop } from "../utils/dateUtils.js";

const MAX_RETRIES = 3;

export const getStoredContent = async () => {
  const date = getGameDate();
  return await DailyContent.findOne({ date });
};

export const generateAndSaveContent = async (language = "english") => {
  const date = getGameDate();
  const crop = getDailyCrop();
  
  const existing = await DailyContent.findOne({ date });
  if (existing) return existing;
  
  console.log(`🔄 Generating content for ${date} - ${crop}`);
  
  let tips, mcqs;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      tips = await generateTips({ crop, language });
      console.log("✅ Tips generated:", tips.length);
      break;
    } catch (error) {
      console.error(`❌ Tips attempt ${i + 1} failed:`, error.message);
      if (i === MAX_RETRIES - 1) throw new Error("Failed to generate tips");
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      mcqs = await generateMCQs({ crop, language });
      console.log("✅ MCQs generated:", mcqs.length);
      break;
    } catch (error) {
      console.error(`❌ MCQs attempt ${i + 1} failed:`, error.message);
      if (i === MAX_RETRIES - 1) throw new Error("Failed to generate MCQs");
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  const content = await DailyContent.create({ 
    date, crop, language, tips, mcqs, generatedAt: new Date()
  });
  
  console.log("💾 Content saved for", date);
  return content;
};

export const clearOldData = async () => {
  const today = getGameDate();
  return await DailyContent.deleteMany({ date: { $ne: today } });
};

export const clearAllData = async () => {
  return await DailyContent.deleteMany({});
};