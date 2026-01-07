import fetch from "node-fetch";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// List of crops for rotation
const CROPS = [
  "Rice", "Wheat", "Cotton", "Sugarcane", "Maize",
  "Potato", "Tomato", "Onion", "Soybean", "Groundnut",
  "Mustard", "Chilli", "Turmeric", "Banana", "Mango"
];

// Extended Language configurations - matching i18n codes
const LANGUAGE_CONFIG = {
  // Primary supported languages (full AI generation)
  en: {
    name: 'English',
    code: 'en',
    backendKey: 'english',
    instruction: 'Generate in English language',
    supported: true,
  },
  hi: {
    name: 'Hindi',
    code: 'hi',
    backendKey: 'hindi',
    instruction: 'Generate in Hindi language (हिंदी भाषा में तैयार करें)',
    supported: true,
  },
  mr: {
    name: 'Marathi',
    code: 'mr',
    backendKey: 'marathi',
    instruction: 'Generate in Marathi language (मराठी भाषेत तयार करा)',
    supported: true,
  },
  // Extended supported languages
  gu: {
    name: 'Gujarati',
    code: 'gu',
    backendKey: 'gujarati',
    instruction: 'Generate in Gujarati language (ગુજરાતી ભાષામાં બનાવો)',
    supported: true,
  },
  bn: {
    name: 'Bengali',
    code: 'bn',
    backendKey: 'bengali',
    instruction: 'Generate in Bengali language (বাংলা ভাষায় তৈরি করুন)',
    supported: true,
  },
  ta: {
    name: 'Tamil',
    code: 'ta',
    backendKey: 'tamil',
    instruction: 'Generate in Tamil language (தமிழ் மொழியில் உருவாக்கவும்)',
    supported: true,
  },
  ur: {
    name: 'Urdu',
    code: 'ur',
    backendKey: 'urdu',
    instruction: 'Generate in Urdu language (اردو زبان میں بنائیں)',
    supported: true,
  },
  fr: {
    name: 'French',
    code: 'fr',
    backendKey: 'french',
    instruction: 'Generate in French language (Générer en français)',
    supported: true,
  },
  de: {
    name: 'German',
    code: 'de',
    backendKey: 'german',
    instruction: 'Generate in German language (Auf Deutsch generieren)',
    supported: true,
  },
  es: {
    name: 'Spanish',
    code: 'es',
    backendKey: 'spanish',
    instruction: 'Generate in Spanish language (Generar en español)',
    supported: true,
  },
};

// Normalize language input (handles both codes and names)
const normalizeLanguage = (language) => {
  if (!language) return LANGUAGE_CONFIG.en;
  
  const langLower = language.toLowerCase().trim();
  
  // Check if it's a language code (en, hi, mr, etc.)
  if (LANGUAGE_CONFIG[langLower]) {
    return LANGUAGE_CONFIG[langLower];
  }
  
  // Check if it's a backend key (english, hindi, marathi, etc.)
  const byBackendKey = Object.values(LANGUAGE_CONFIG).find(
    config => config.backendKey === langLower
  );
  if (byBackendKey) {
    return byBackendKey;
  }
  
  // Check if it's a language name
  const byName = Object.values(LANGUAGE_CONFIG).find(
    config => config.name.toLowerCase() === langLower
  );
  if (byName) {
    return byName;
  }
  
  // Default to English
  console.log(`⚠️ Unknown language "${language}", defaulting to English`);
  return LANGUAGE_CONFIG.en;
};

// Get today's crop based on date
export const getTodaysCrop = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  return CROPS[dayOfYear % CROPS.length];
};

// Export supported languages for API response
export const getSupportedLanguages = () => {
  return Object.entries(LANGUAGE_CONFIG).map(([code, config]) => ({
    code,
    name: config.name,
    backendKey: config.backendKey,
    supported: config.supported,
  }));
};

/**
 * Clean and fix common JSON issues from LLM responses
 */
const cleanJsonString = (str) => {
  str = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  str = str.trim();
  
  const startIndex = str.indexOf('[');
  const endIndex = str.lastIndexOf(']');
  
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('No JSON array found in response');
  }
  
  str = str.substring(startIndex, endIndex + 1);
  str = str.replace(/,\s*([}\]])/g, '$1');
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return str;
};

/**
 * Attempt to parse JSON with multiple strategies
 */
const safeJsonParse = (text, context = 'Unknown') => {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.log(`Direct parse failed for ${context}, trying cleanup...`);
  }
  
  try {
    const cleaned = cleanJsonString(text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.log(`Cleaned parse failed for ${context}`);
  }
  
  try {
    const objectRegex = /\{[^{}]*\}/g;
    const matches = text.match(objectRegex);
    if (matches && matches.length > 0) {
      const objects = [];
      for (const match of matches) {
        try {
          objects.push(JSON.parse(match));
        } catch (e) {
          try {
            const fixed = match
              .replace(/,\s*}/g, '}')
              .replace(/'/g, '"')
              .replace(/(\w+):/g, '"$1":');
            objects.push(JSON.parse(fixed));
          } catch (e2) {
            // Skip malformed object
          }
        }
      }
      if (objects.length > 0) {
        return objects;
      }
    }
  } catch (e) {
    console.log(`Object extraction failed for ${context}`);
  }
  
  throw new Error(`Failed to parse JSON for ${context}`);
};

/**
 * Call Gemini API - SINGLE ATTEMPT ONLY
 */
const callGemini = async (prompt, timeoutMs = 30000) => {
  console.log('📡 Calling Gemini API (single attempt)...');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 4000,
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 429 || errorText.includes('quota')) {
        console.error('❌ GEMINI API QUOTA EXCEEDED');
        throw new Error('QUOTA_EXCEEDED');
      }
      
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Empty response from Gemini');
    }
    
    console.log('✅ Gemini API call successful');
    return data.candidates[0].content.parts[0].text;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    
    throw error;
  }
};

/**
 * Generate tips from Gemini
 */
export const generateTips = async (crop, language = "en") => {
  const langConfig = normalizeLanguage(language);
  const langName = langConfig.name;
  const langInstruction = langConfig.instruction;
  
  console.log(`🌱 Generating tips for ${crop} in ${langName} (${langConfig.code})`);
  
  const prompt = `You are an Indian agriculture expert specializing in ${crop} farming.
${langInstruction}

Generate exactly 12 practical farming tips for ${crop} in ${langName}.

CRITICAL: Return ONLY a valid JSON array. No markdown, no code blocks, no explanation.

Format:
[
  {"text": "Tip 1 in ${langName}"},
  {"text": "Tip 2 in ${langName}"},
  {"text": "Tip 3 in ${langName}"},
  {"text": "Tip 4 in ${langName}"},
  {"text": "Tip 5 in ${langName}"},
  {"text": "Tip 6 in ${langName}"},
  {"text": "Tip 7 in ${langName}"},
  {"text": "Tip 8 in ${langName}"},
  {"text": "Tip 9 in ${langName}"},
  {"text": "Tip 10 in ${langName}"},
  {"text": "Tip 11 in ${langName}"},
  {"text": "Tip 12 in ${langName}"}
]

Rules:
- Write completely in ${langName} language
- Each tip: 1-2 lines, practical, actionable
- Focus on Indian farming conditions
- Cover: soil preparation, sowing, irrigation, fertilization, pest control, harvesting
- Return ONLY the JSON array`;

  try {
    const text = await callGemini(prompt, 20000);
    console.log(`Tips response length for ${langName}:`, text.length);
    
    const tips = safeJsonParse(text, 'Tips');
    
    const validTips = tips
      .slice(0, 12)
      .map((t, index) => {
        if (typeof t === 'string') return { text: t };
        if (t && typeof t.text === 'string') return { text: t.text };
        return { text: `Farming tip ${index + 1} for ${crop}` };
      });
    
    while (validTips.length < 12) {
      validTips.push({ text: `Practice sustainable ${crop} farming techniques` });
    }
    
    console.log(`✅ Generated ${validTips.length} tips in ${langName} from Gemini`);
    return validTips;
    
  } catch (error) {
    console.warn(`⚠️ Gemini tips failed for ${langName}, using fallback:`, error.message);
    return generateFallbackTips(crop, langConfig.backendKey);
  }
};

/**
 * Generate MCQs from Gemini
 */
export const generateMCQs = async (crop, language = "en") => {
  const langConfig = normalizeLanguage(language);
  const langName = langConfig.name;
  const langInstruction = langConfig.instruction;
  
  console.log(`📝 Generating MCQs for ${crop} in ${langName} (${langConfig.code})`);
  
  const prompt = `You are an Indian agriculture expert. Create a quiz about ${crop} farming.
${langInstruction}

Generate exactly 12 multiple choice questions in ${langName}.

CRITICAL: Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.

Format:
[
  {
    "question": "Question text in ${langName}?",
    "options": ["Option 1 in ${langName}", "Option 2 in ${langName}", "Option 3 in ${langName}", "Option 4 in ${langName}"],
    "correctAnswer": 0,
    "explanation": "Brief explanation in ${langName}."
  }
]

Rules:
- Write completely in ${langName} language
- correctAnswer: index (0-3) of correct option
- Exactly 4 options per question
- Questions about: cultivation, soil, water, fertilizers, pest management, harvesting
- Brief explanations (1-2 sentences)
- Focus on Indian farming context
- Return ONLY the JSON array`;

  try {
    const text = await callGemini(prompt, 25000);
    console.log(`MCQs response length for ${langName}:`, text.length);
    
    const mcqs = safeJsonParse(text, 'MCQs');
    
    const validMcqs = mcqs
      .slice(0, 12)
      .map((q, index) => {
        if (!q.question || typeof q.question !== 'string') {
          q.question = `Question ${index + 1} about ${crop}?`;
        }
        
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          q.options = ["Option A", "Option B", "Option C", "Option D"];
        }
        
        q.options = q.options.map((opt, i) => 
          typeof opt === 'string' ? opt : `Option ${String.fromCharCode(65 + i)}`
        );
        
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
          q.correctAnswer = 0;
        }
        
        if (!q.explanation || typeof q.explanation !== 'string') {
          q.explanation = "This is the correct answer based on agricultural best practices.";
        }
        
        return {
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation
        };
      });
    
    while (validMcqs.length < 12) {
      validMcqs.push(generateFallbackMCQ(crop, validMcqs.length, langConfig.backendKey));
    }
    
    console.log(`✅ Generated ${validMcqs.length} MCQs in ${langName} from Gemini`);
    return validMcqs;
    
  } catch (error) {
    console.warn(`⚠️ Gemini MCQs failed for ${langName}, using fallback:`, error.message);
    return generateFallbackMCQs(crop, langConfig.backendKey);
  }
};

/**
 * Generate fallback tips
 */
const generateFallbackTips = (crop, language) => {
  console.log(`📚 Using fallback tips for ${crop} in ${language}`);
  
  const tipsData = {
    english: [
      `Prepare soil well before planting ${crop} with proper plowing and organic matter.`,
      `Select high-quality certified seeds for better ${crop} germination and yield.`,
      `Maintain proper spacing between ${crop} plants for adequate sunlight and air circulation.`,
      `Water ${crop} regularly during critical growth stages, but avoid waterlogging.`,
      `Apply balanced NPK fertilizers based on soil test results for ${crop}.`,
      `Monitor ${crop} plants regularly for early detection of pests and diseases.`,
      `Use integrated pest management (IPM) approach for sustainable ${crop} farming.`,
      `Remove weeds regularly, especially during early growth stages of ${crop}.`,
      `Apply mulching to conserve soil moisture and suppress weeds in ${crop} fields.`,
      `Harvest ${crop} at the right maturity stage for best quality and market value.`,
      `Practice crop rotation with ${crop} to maintain soil health and break pest cycles.`,
      `Store ${crop} produce properly in cool, dry conditions to prevent spoilage.`
    ],
    marathi: [
      `${crop} लागवड करण्यापूर्वी योग्य नांगरणी आणि सेंद्रिय पदार्थांसह माती चांगली तयार करा.`,
      `चांगल्या ${crop} अंकुरण आणि उत्पादनासाठी उच्च-गुणवत्तेची प्रमाणित बियाणे निवडा.`,
      `पुरेसा सूर्यप्रकाश आणि हवा मिळण्यासाठी ${crop} रोपांमध्ये योग्य अंतर ठेवा.`,
      `${crop} च्या महत्त्वपूर्ण वाढीच्या टप्प्यात नियमितपणे पाणी द्या, परंतु जलसाठा टाळा.`,
      `${crop} साठी मातीच्या चाचणी निकालांवर आधारित संतुलित NPK खते वापरा.`,
      `किडी आणि रोगांच्या लवकर शोधासाठी ${crop} रोपांचे नियमितपणे निरीक्षण करा.`,
      `शाश्वत ${crop} शेतीसाठी एकात्मिक कीड व्यवस्थापन (IPM) पद्धत वापरा.`,
      `विशेषतः ${crop} च्या सुरुवातीच्या वाढीच्या टप्प्यात तण नियमितपणे काढा.`,
      `${crop} शेतात मातीची ओलावा टिकवून ठेवण्यासाठी आणि तण दाबण्यासाठी गालिचा लावा.`,
      `सर्वोत्तम गुणवत्ता आणि बाजारमूल्यासाठी ${crop} योग्य परिपक्वता अवस्थेत काढा.`,
      `मातीचे आरोग्य राखण्यासाठी आणि किडींचे चक्र तोडण्यासाठी ${crop} सह पीक फेरपालट करा.`,
      `खराब होण्यापासून रोखण्यासाठी ${crop} उत्पादन योग्य प्रकारे थंड, कोरड्या परिस्थितीत साठवा.`
    ],
    hindi: [
      `${crop} रोपण से पहले उचित जुताई और जैविक पदार्थ के साथ मिट्टी को अच्छी तरह तैयार करें.`,
      `बेहतर ${crop} अंकुरण और उपज के लिए उच्च गुणवत्ता वाले प्रमाणित बीज चुनें.`,
      `पर्याप्त धूप और हवा संचार के लिए ${crop} पौधों के बीच उचित दूरी बनाए रखें.`,
      `${crop} की महत्वपूर्ण वृद्धि अवस्थाओं में नियमित रूप से पानी दें, लेकिन जलभराव से बचें.`,
      `${crop} के लिए मिट्टी परीक्षण परिणामों के आधार पर संतुलित NPK उर्वरक लागू करें.`,
      `कीटों और रोगों की शीघ्र पहचान के लिए ${crop} पौधों की नियमित निगरानी करें.`,
      `टिकाऊ ${crop} खेती के लिए एकीकृत कीट प्रबंधन (IPM) दृष्टिकोण का उपयोग करें.`,
      `विशेष रूप से ${crop} की शुरुआती वृद्धि अवस्थाओं में नियमित रूप से खरपतवार हटाएं.`,
      `${crop} के खेतों में मिट्टी की नमी बनाए रखने और खरपतवार को दबाने के लिए मल्चिंग करें.`,
      `सर्वोत्तम गुणवत्ता और बाजार मूल्य के लिए ${crop} को सही परिपक्वता अवस्था में काटें.`,
      `मिट्टी के स्वास्थ्य को बनाए रखने और कीट चक्र को तोड़ने के लिए ${crop} के साथ फसल चक्र अपनाएं.`,
      `${crop} उत्पाद को खराब होने से बचाने के लिए ठंडी, सूखी परिस्थितियों में ठीक से भंडारित करें.`
    ],
    gujarati: [
      `${crop} વાવેતર પહેલાં યોગ્ય ખેડાણ અને કાર્બનિક પદાર્થો સાથે જમીન સારી રીતે તૈયાર કરો.`,
      `સારા ${crop} અંકુરણ અને ઉપજ માટે ઉચ્ચ ગુણવત્તાના પ્રમાણિત બીજ પસંદ કરો.`,
      `પૂરતો સૂર્યપ્રકાશ અને હવાની અવરજવર માટે ${crop} છોડ વચ્ચે યોગ્ય અંતર જાળવો.`,
      `${crop} ના મહત્વના વૃદ્ધિ તબક્કાઓ દરમિયાન નિયમિતપણે પાણી આપો, પરંતુ જળભરાવ ટાળો.`,
      `${crop} માટે જમીન પરીક્ષણ પરિણામોના આધારે સંતુલિત NPK ખાતરો લાગુ કરો.`,
      `જીવાતો અને રોગોની વહેલી શોધ માટે ${crop} છોડનું નિયમિતપણે નિરીક્ષણ કરો.`,
      `ટકાઉ ${crop} ખેતી માટે સંકલિત જીવાત વ્યવસ્થાપન (IPM) અભિગમ વાપરો.`,
      `ખાસ કરીને ${crop} ના પ્રારંભિક વૃદ્ધિ તબક્કાઓ દરમિયાન નિયમિતપણે નીંદણ દૂર કરો.`,
      `${crop} ના ખેતરોમાં જમીનની ભેજ જાળવવા અને નીંદણ દબાવવા માટે મલ્ચિંગ લાગુ કરો.`,
      `શ્રેષ્ઠ ગુણવત્તા અને બજાર મૂલ્ય માટે ${crop} ને યોગ્ય પરિપક્વતા તબક્કે લણો.`,
      `જમીનની તંદુરસ્તી જાળવવા અને જીવાત ચક્ર તોડવા માટે ${crop} સાથે પાક ફેરબદલી કરો.`,
      `બગાડ અટકાવવા માટે ${crop} ઉત્પાદનને ઠંડી, સૂકી પરિસ્થિતિઓમાં યોગ્ય રીતે સંગ્રહિત કરો.`
    ],
    bengali: [
      `${crop} রোপণের আগে সঠিক চাষ এবং জৈব পদার্থ দিয়ে মাটি ভালোভাবে প্রস্তুত করুন।`,
      `ভালো ${crop} অঙ্কুরোদগম এবং ফলনের জন্য উচ্চ মানের প্রত্যয়িত বীজ নির্বাচন করুন।`,
      `পর্যাপ্ত সূর্যালোক এবং বায়ু সঞ্চালনের জন্য ${crop} গাছগুলির মধ্যে যথাযথ দূরত্ব বজায় রাখুন।`,
      `${crop} এর গুরুত্বপূর্ণ বৃদ্ধির পর্যায়ে নিয়মিত জল দিন, তবে জলাবদ্ধতা এড়িয়ে চলুন।`,
      `${crop} এর জন্য মাটি পরীক্ষার ফলাফলের উপর ভিত্তি করে সুষম NPK সার প্রয়োগ করুন।`,
      `কীটপতঙ্গ এবং রোগ তাড়াতাড়ি সনাক্ত করতে ${crop} গাছগুলি নিয়মিত পর্যবেক্ষণ করুন।`,
      `টেকসই ${crop} চাষের জন্য সমন্বিত কীট ব্যবস্থাপনা (IPM) পদ্ধতি ব্যবহার করুন।`,
      `বিশেষ করে ${crop} এর প্রাথমিক বৃদ্ধির পর্যায়ে নিয়মিত আগাছা পরিষ্কার করুন।`,
      `${crop} ক্ষেতে মাটির আর্দ্রতা সংরক্ষণ এবং আগাছা দমন করতে মালচিং প্রয়োগ করুন।`,
      `সেরা মান এবং বাজার মূল্যের জন্য ${crop} সঠিক পরিপক্কতা পর্যায়ে সংগ্রহ করুন।`,
      `মাটির স্বাস্থ্য বজায় রাখতে এবং কীটপতঙ্গ চক্র ভাঙতে ${crop} এর সাথে ফসল পর্যায় অনুশীলন করুন।`,
      `নষ্ট হওয়া রোধ করতে ${crop} উৎপাদন সঠিকভাবে ঠান্ডা, শুষ্ক পরিস্থিতিতে সংরক্ষণ করুন।`
    ],
    tamil: [
      `${crop} நடவு செய்வதற்கு முன் சரியான உழவு மற்றும் இயற்கை பொருட்களுடன் மண்ணை நன்றாக தயார் செய்யுங்கள்.`,
      `சிறந்த ${crop} முளைப்பு மற்றும் மகசூலுக்கு உயர் தரமான சான்றிதழ் விதைகளைத் தேர்ந்தெடுக்கவும்.`,
      `போதுமான சூரிய ஒளி மற்றும் காற்று சுழற்சிக்கு ${crop} தாவரங்களுக்கு இடையே சரியான இடைவெளியை பராமரிக்கவும்.`,
      `${crop} இன் முக்கிய வளர்ச்சி நிலைகளில் தொடர்ந்து நீர் பாய்ச்சுங்கள், ஆனால் நீர் தேங்குவதை தவிர்க்கவும்.`,
      `${crop} க்கு மண் பரிசோதனை முடிவுகளின் அடிப்படையில் சமநிலையான NPK உரங்களைப் பயன்படுத்துங்கள்.`,
      `பூச்சிகள் மற்றும் நோய்களை ஆரம்பத்தில் கண்டறிய ${crop} தாவரங்களை தொடர்ந்து கண்காணிக்கவும்.`,
      `நிலையான ${crop} விவசாயத்திற்கு ஒருங்கிணைந்த பூச்சி மேலாண்மை (IPM) அணுகுமுறையைப் பயன்படுத்துங்கள்.`,
      `குறிப்பாக ${crop} இன் ஆரம்ப வளர்ச்சி நிலைகளில் களைகளை தொடர்ந்து அகற்றுங்கள்.`,
      `${crop} வயல்களில் மண் ஈரப்பதத்தை பாதுகாக்கவும் களைகளை அடக்கவும் மல்ச்சிங் செய்யுங்கள்.`,
      `சிறந்த தரம் மற்றும் சந்தை மதிப்புக்கு ${crop} ஐ சரியான முதிர்ச்சி நிலையில் அறுவடை செய்யுங்கள்.`,
      `மண் ஆரோக்கியத்தை பராமரிக்கவும் பூச்சி சுழற்சிகளை உடைக்கவும் ${crop} உடன் பயிர் சுழற்சியை கடைபிடியுங்கள்.`,
      `கெட்டுப்போவதை தடுக்க ${crop} உற்பத்தியை குளிர்ச்சியான, வறண்ட சூழ்நிலையில் சரியாக சேமிக்கவும்.`
    ],
    urdu: [
      `${crop} بونے سے پہلے مناسب جوتائی اور نامیاتی مادوں سے مٹی کو اچھی طرح تیار کریں۔`,
      `بہتر ${crop} اگنے اور پیداوار کے لیے اعلیٰ معیار کے تصدیق شدہ بیج منتخب کریں۔`,
      `کافی دھوپ اور ہوا کی گردش کے لیے ${crop} پودوں کے درمیان مناسب فاصلہ رکھیں۔`,
      `${crop} کے اہم نشوونما کے مراحل میں باقاعدگی سے پانی دیں، لیکن پانی جمع ہونے سے بچیں۔`,
      `${crop} کے لیے مٹی کی جانچ کے نتائج کی بنیاد پر متوازن NPK کھاد استعمال کریں۔`,
      `کیڑوں اور بیماریوں کی جلد تشخیص کے لیے ${crop} پودوں کی باقاعدگی سے نگرانی کریں۔`,
      `پائیدار ${crop} کاشتکاری کے لیے مربوط کیڑے مار انتظام (IPM) نقطہ نظر استعمال کریں۔`,
      `خاص طور پر ${crop} کی ابتدائی نشوونما کے مراحل میں جڑی بوٹیاں باقاعدگی سے ہٹائیں۔`,
      `${crop} کے کھیتوں میں مٹی کی نمی کو محفوظ رکھنے اور جڑی بوٹیوں کو دبانے کے لیے ملچنگ کریں۔`,
      `بہترین معیار اور مارکیٹ قیمت کے لیے ${crop} کو صحیح پختگی کے مرحلے میں کاٹیں۔`,
      `مٹی کی صحت برقرار رکھنے اور کیڑوں کے چکر کو توڑنے کے لیے ${crop} کے ساتھ فصلوں کی تبدیلی کریں۔`,
      `خرابی سے بچنے کے لیے ${crop} کی پیداوار کو ٹھنڈی، خشک حالات میں مناسب طریقے سے ذخیرہ کریں۔`
    ],
    french: [
      `Préparez bien le sol avant de planter ${crop} avec un labour approprié et de la matière organique.`,
      `Sélectionnez des semences certifiées de haute qualité pour une meilleure germination et rendement de ${crop}.`,
      `Maintenez un espacement approprié entre les plants de ${crop} pour une lumière et une circulation d'air adéquates.`,
      `Arrosez ${crop} régulièrement pendant les phases de croissance critiques, mais évitez l'engorgement.`,
      `Appliquez des engrais NPK équilibrés basés sur les résultats d'analyse du sol pour ${crop}.`,
      `Surveillez régulièrement les plants de ${crop} pour la détection précoce des parasites et maladies.`,
      `Utilisez l'approche de gestion intégrée des parasites (IPM) pour une culture durable de ${crop}.`,
      `Enlevez les mauvaises herbes régulièrement, surtout pendant les premières phases de croissance de ${crop}.`,
      `Appliquez du paillage pour conserver l'humidité du sol et supprimer les mauvaises herbes dans les champs de ${crop}.`,
      `Récoltez ${crop} au bon stade de maturité pour la meilleure qualité et valeur marchande.`,
      `Pratiquez la rotation des cultures avec ${crop} pour maintenir la santé du sol et briser les cycles de parasites.`,
      `Stockez la production de ${crop} correctement dans des conditions fraîches et sèches pour éviter la détérioration.`
    ],
    german: [
      `Bereiten Sie den Boden vor der Pflanzung von ${crop} gut vor mit richtigem Pflügen und organischer Substanz.`,
      `Wählen Sie hochwertige zertifizierte Samen für bessere ${crop} Keimung und Ertrag.`,
      `Halten Sie den richtigen Abstand zwischen ${crop} Pflanzen für ausreichend Sonnenlicht und Luftzirkulation.`,
      `Bewässern Sie ${crop} regelmäßig während kritischer Wachstumsphasen, aber vermeiden Sie Staunässe.`,
      `Wenden Sie ausgewogene NPK-Dünger basierend auf Bodentest-Ergebnissen für ${crop} an.`,
      `Überwachen Sie ${crop} Pflanzen regelmäßig für die frühe Erkennung von Schädlingen und Krankheiten.`,
      `Nutzen Sie den Ansatz des integrierten Schädlingsmanagements (IPM) für nachhaltigen ${crop} Anbau.`,
      `Entfernen Sie Unkraut regelmäßig, besonders während der frühen Wachstumsphasen von ${crop}.`,
      `Wenden Sie Mulch an, um die Bodenfeuchtigkeit zu erhalten und Unkraut in ${crop} Feldern zu unterdrücken.`,
      `Ernten Sie ${crop} im richtigen Reifestadium für beste Qualität und Marktwert.`,
      `Praktizieren Sie Fruchtfolge mit ${crop}, um die Bodengesundheit zu erhalten und Schädlingszyklen zu unterbrechen.`,
      `Lagern Sie ${crop} Produkte richtig unter kühlen, trockenen Bedingungen, um Verderb zu verhindern.`
    ],
    spanish: [
      `Prepare bien el suelo antes de plantar ${crop} con arado adecuado y materia orgánica.`,
      `Seleccione semillas certificadas de alta calidad para mejor germinación y rendimiento de ${crop}.`,
      `Mantenga el espaciamiento adecuado entre las plantas de ${crop} para luz solar y circulación de aire adecuadas.`,
      `Riegue ${crop} regularmente durante las etapas críticas de crecimiento, pero evite el encharcamiento.`,
      `Aplique fertilizantes NPK equilibrados basados en los resultados del análisis de suelo para ${crop}.`,
      `Monitoree las plantas de ${crop} regularmente para la detección temprana de plagas y enfermedades.`,
      `Use el enfoque de manejo integrado de plagas (MIP) para la agricultura sostenible de ${crop}.`,
      `Elimine las malezas regularmente, especialmente durante las etapas tempranas de crecimiento de ${crop}.`,
      `Aplique acolchado para conservar la humedad del suelo y suprimir malezas en los campos de ${crop}.`,
      `Coseche ${crop} en la etapa de madurez correcta para mejor calidad y valor de mercado.`,
      `Practique la rotación de cultivos con ${crop} para mantener la salud del suelo y romper ciclos de plagas.`,
      `Almacene la producción de ${crop} adecuadamente en condiciones frescas y secas para prevenir el deterioro.`
    ]
  };
  
  const tips = tipsData[language] || tipsData.english;
  return tips.map(text => ({ text }));
};

/**
 * Generate fallback MCQs
 */
const generateFallbackMCQs = (crop, language) => {
  console.log(`📚 Using fallback MCQs for ${crop} in ${language}`);
  
  // English MCQs as base (other languages would follow same pattern)
  const mcqsData = {
    english: [
      {
        question: `What is the ideal soil pH range for growing ${crop}?`,
        options: ["4.0 - 5.0", "6.0 - 7.5", "8.5 - 9.5", "9.0 - 10.0"],
        correctAnswer: 1,
        explanation: `Most crops including ${crop} grow best in slightly acidic to neutral soil (pH 6.0-7.5).`
      },
      {
        question: `Which nutrient is essential for leaf growth in ${crop}?`,
        options: ["Phosphorus", "Potassium", "Nitrogen", "Calcium"],
        correctAnswer: 2,
        explanation: "Nitrogen promotes vegetative growth and gives leaves their green color."
      },
      {
        question: `What is the best time to water ${crop} plants?`,
        options: ["Midday", "Early morning", "Late night", "Afternoon"],
        correctAnswer: 1,
        explanation: "Early morning watering reduces evaporation and prevents fungal diseases."
      },
      {
        question: `Which practice helps conserve soil moisture for ${crop}?`,
        options: ["Deep plowing", "Mulching", "Removing vegetation", "Flooding"],
        correctAnswer: 1,
        explanation: "Mulching retains moisture, regulates temperature, and suppresses weeds."
      },
      {
        question: `Why is crop rotation important for ${crop}?`,
        options: ["Increases pests", "Depletes nutrients", "Maintains soil health", "Reduces yield"],
        correctAnswer: 2,
        explanation: "Crop rotation maintains fertility and breaks pest and disease cycles."
      },
      {
        question: `Which organic amendment improves soil for ${crop}?`,
        options: ["Plastic waste", "Compost", "Chemical pesticides", "Synthetic fertilizers"],
        correctAnswer: 1,
        explanation: "Compost improves soil structure, water retention, and microbial activity."
      },
      {
        question: `What is the purpose of seed treatment for ${crop}?`,
        options: ["Color enhancement", "Disease protection", "Weight increase", "Flavor improvement"],
        correctAnswer: 1,
        explanation: "Seed treatment protects against soil-borne diseases and pests."
      },
      {
        question: `Which pest management is most sustainable for ${crop}?`,
        options: ["Chemical pesticides only", "Integrated Pest Management", "Ignoring pests", "Burning fields"],
        correctAnswer: 1,
        explanation: "IPM combines biological, cultural, and chemical methods sustainably."
      },
      {
        question: `What indicates nutrient deficiency in ${crop}?`,
        options: ["Rapid growth", "Yellowing leaves", "Excessive flowering", "Deep green color"],
        correctAnswer: 1,
        explanation: "Yellowing and stunted growth often indicate nutrient deficiency."
      },
      {
        question: `When should ${crop} be harvested?`,
        options: ["Before maturity", "At proper maturity", "When fully dried", "During rain"],
        correctAnswer: 1,
        explanation: "Harvesting at proper maturity ensures best quality and nutrition."
      },
      {
        question: `What is the benefit of proper plant spacing in ${crop}?`,
        options: ["Increases pests", "Better air circulation", "Reduces yield", "Wastes space"],
        correctAnswer: 1,
        explanation: "Proper spacing ensures sunlight, air circulation, and reduces disease."
      },
      {
        question: `Which irrigation method is most efficient for ${crop}?`,
        options: ["Flood irrigation", "Drip irrigation", "Midday sprinkler", "Rain-fed only"],
        correctAnswer: 1,
        explanation: "Drip irrigation delivers water to roots, reducing waste by up to 50%."
      }
    ],
    // Add Hindi fallback
     hindi: [
      {
        question: `${crop} उगाने के लिए आदर्श मिट्टी का pH रेंज क्या है?`,
        options: ["4.0 - 5.0", "6.0 - 7.5", "8.5 - 9.5", "9.0 - 10.0"],
        correctAnswer: 1,
        explanation: `${crop} सहित अधिकांश फसलें हल्की अम्लीय से तटस्थ मिट्टी (pH 6.0-7.5) में सबसे अच्छी बढ़ती हैं।`
      },
      {
        question: `${crop} में पत्तियों की वृद्धि के लिए कौन सा पोषक तत्व आवश्यक है?`,
        options: ["फॉस्फोरस", "पोटेशियम", "नाइट्रोजन", "कैल्शियम"],
        correctAnswer: 2,
        explanation: "नाइट्रोजन वनस्पति वृद्धि को बढ़ावा देता है और पत्तियों को हरा रंग देता है।"
      },
      {
        question: `${crop} के पौधों को पानी देने का सबसे अच्छा समय क्या है?`,
        options: ["दोपहर में", "सुबह जल्दी", "देर रात", "दोपहर बाद"],
        correctAnswer: 1,
        explanation: "सुबह जल्दी पानी देने से वाष्पीकरण कम होता है और फफूंद रोग से बचाव होता है।"
      },
      {
        question: `${crop} के लिए मिट्टी की नमी बनाए रखने में कौन सी प्रथा मदद करती है?`,
        options: ["गहरी जुताई", "मल्चिंग", "वनस्पति हटाना", "बाढ़"],
        correctAnswer: 1,
        explanation: "मल्चिंग नमी बनाए रखती है, तापमान नियंत्रित करती है और खरपतवार दबाती है।"
      },
      {
        question: `${crop} के लिए फसल चक्र क्यों महत्वपूर्ण है?`,
        options: ["कीट बढ़ाता है", "पोषक तत्व घटाता है", "मिट्टी का स्वास्थ्य बनाए रखता है", "उपज कम करता है"],
        correctAnswer: 2,
        explanation: "फसल चक्र उर्वरता बनाए रखता है और कीट व रोग चक्र को तोड़ता है।"
      },
      {
        question: `${crop} के लिए मिट्टी सुधारने वाला कौन सा जैविक पदार्थ है?`,
        options: ["प्लास्टिक कचरा", "कम्पोस्ट", "रासायनिक कीटनाशक", "सिंथेटिक उर्वरक"],
        correctAnswer: 1,
        explanation: "कम्पोस्ट मिट्टी की संरचना, जल धारण और सूक्ष्मजीव गतिविधि में सुधार करता है।"
      },
      {
        question: `${crop} के लिए बीज उपचार का उद्देश्य क्या है?`,
        options: ["रंग वृद्धि", "रोग सुरक्षा", "वजन बढ़ाना", "स्वाद सुधार"],
        correctAnswer: 1,
        explanation: "बीज उपचार मिट्टी जनित रोगों और कीटों से बचाता है।"
      },
      {
        question: `${crop} के लिए सबसे टिकाऊ कीट प्रबंधन कौन सा है?`,
        options: ["केवल रासायनिक कीटनाशक", "एकीकृत कीट प्रबंधन", "कीटों की अनदेखी", "खेत जलाना"],
        correctAnswer: 1,
        explanation: "IPM जैविक, सांस्कृतिक और रासायनिक विधियों को टिकाऊ तरीके से जोड़ता है।"
      },
      {
        question: `${crop} में पोषक तत्व की कमी क्या संकेत करती है?`,
        options: ["तेजी से वृद्धि", "पत्तियों का पीला होना", "अत्यधिक फूल आना", "गहरा हरा रंग"],
        correctAnswer: 1,
        explanation: "पीलापन और रुकी हुई वृद्धि अक्सर पोषक तत्व की कमी का संकेत देती है।"
      },
      {
        question: `${crop} की कटाई कब करनी चाहिए?`,
        options: ["परिपक्वता से पहले", "उचित परिपक्वता पर", "पूरी तरह सूखने पर", "बारिश के दौरान"],
        correctAnswer: 1,
        explanation: "उचित परिपक्वता पर कटाई सर्वोत्तम गुणवत्ता और पोषण सुनिश्चित करती है।"
      },
      {
        question: `${crop} में उचित पौध दूरी का क्या लाभ है?`,
        options: ["कीट बढ़ाता है", "बेहतर वायु संचार", "उपज कम करता है", "जगह बर्बाद करता है"],
        correctAnswer: 1,
        explanation: "उचित दूरी सूर्य का प्रकाश, वायु संचार सुनिश्चित करती है और रोग कम करती है।"
      },
      {
        question: `${crop} के लिए सबसे कुशल सिंचाई विधि कौन सी है?`,
        options: ["बाढ़ सिंचाई", "ड्रिप सिंचाई", "दोपहर स्प्रिंकलर", "केवल वर्षा आधारित"],
        correctAnswer: 1,
        explanation: "ड्रिप सिंचाई जड़ों तक पानी पहुंचाती है, 50% तक बर्बादी कम करती है।"
      }
    ],
    marathi: [
      {
        question: `${crop} पिकासाठी आदर्श मातीची pH श्रेणी काय आहे?`,
        options: ["4.0 - 5.0", "6.0 - 7.5", "8.5 - 9.5", "9.0 - 10.0"],
        correctAnswer: 1,
        explanation: `${crop} सह बहुतेक पिके किंचित आम्लीय ते तटस्थ मातीत (pH 6.0-7.5) उत्तम वाढतात.`
      },
      {
        question: `${crop} मध्ये पानांच्या वाढीसाठी कोणता पोषक घटक आवश्यक आहे?`,
        options: ["फॉस्फरस", "पोटॅशियम", "नायट्रोजन", "कॅल्शियम"],
        correctAnswer: 2,
        explanation: "नायट्रोजन वनस्पती वाढीस प्रोत्साहन देते आणि पानांना हिरवा रंग देते."
      },
      {
        question: `${crop} च्या रोपांना पाणी देण्याची सर्वोत्तम वेळ कोणती आहे?`,
        options: ["दुपारी", "पहाटे लवकर", "उशीरा रात्री", "दुपारनंतर"],
        correctAnswer: 1,
        explanation: "पहाटे पाणी दिल्याने बाष्पीभवन कमी होते आणि बुरशीजन्य रोगांपासून बचाव होतो."
      },
      {
        question: `${crop} साठी मातीची ओलावा टिकवून ठेवण्यासाठी कोणती पद्धत मदत करते?`,
        options: ["खोल नांगरणी", "मल्चिंग", "वनस्पती काढणे", "पूर"],
        correctAnswer: 1,
        explanation: "मल्चिंग ओलावा टिकवून ठेवते, तापमान नियंत्रित करते आणि तण दाबते."
      },
      {
        question: `${crop} साठी पीक फेरपालट का महत्त्वाची आहे?`,
        options: ["किडी वाढवते", "पोषक घटक कमी करते", "मातीचे आरोग्य राखते", "उत्पादन कमी करते"],
        correctAnswer: 2,
        explanation: "पीक फेरपालट सुपीकता राखते आणि किडी व रोग चक्र तोडते."
      },
      {
        question: `${crop} साठी माती सुधारणारा कोणता सेंद्रिय पदार्थ आहे?`,
        options: ["प्लॅस्टिक कचरा", "कंपोस्ट", "रासायनिक कीटकनाशके", "कृत्रिम खते"],
        correctAnswer: 1,
        explanation: "कंपोस्ट मातीची रचना, जलधारण आणि सूक्ष्मजीव क्रियाकलाप सुधारते."
      },
      {
        question: `${crop} साठी बियाणे प्रक्रिया करण्याचा उद्देश काय आहे?`,
        options: ["रंग वाढ", "रोग संरक्षण", "वजन वाढ", "चव सुधार"],
        correctAnswer: 1,
        explanation: "बियाणे प्रक्रिया मातीजन्य रोग आणि किडींपासून संरक्षण देते."
      },
      {
        question: `${crop} साठी सर्वात टिकाऊ कीड व्यवस्थापन कोणते आहे?`,
        options: ["फक्त रासायनिक कीटकनाशके", "एकात्मिक कीड व्यवस्थापन", "किडींकडे दुर्लक्ष", "शेत जाळणे"],
        correctAnswer: 1,
        explanation: "IPM जैविक, सांस्कृतिक आणि रासायनिक पद्धती टिकाऊपणे एकत्र करते."
      },
      {
        question: `${crop} मध्ये पोषक घटकांची कमतरता काय सूचित करते?`,
        options: ["जलद वाढ", "पाने पिवळी पडणे", "जास्त फुले येणे", "गडद हिरवा रंग"],
        correctAnswer: 1,
        explanation: "पिवळेपणा आणि खुंटलेली वाढ अनेकदा पोषक घटकांची कमतरता दर्शवते."
      },
      {
        question: `${crop} ची कापणी केव्हा करावी?`,
        options: ["परिपक्वतेपूर्वी", "योग्य परिपक्वतेवर", "पूर्णपणे कोरडे झाल्यावर", "पावसादरम्यान"],
        correctAnswer: 1,
        explanation: "योग्य परिपक्वतेवर कापणी उत्तम गुणवत्ता आणि पोषण सुनिश्चित करते."
      },
      {
        question: `${crop} मध्ये योग्य रोप अंतराचा काय फायदा आहे?`,
        options: ["किडी वाढवते", "चांगली हवा वाहणे", "उत्पादन कमी करते", "जागा वाया घालवते"],
        correctAnswer: 1,
        explanation: "योग्य अंतर सूर्यप्रकाश, हवा वाहणे सुनिश्चित करते आणि रोग कमी करते."
      },
      {
        question: `${crop} साठी सर्वात कार्यक्षम सिंचन पद्धत कोणती आहे?`,
        options: ["पूर सिंचन", "ठिबक सिंचन", "दुपारचे स्प्रिंकलर", "फक्त पावसावर आधारित"],
        correctAnswer: 1,
        explanation: "ठिबक सिंचन मुळांपर्यंत पाणी पोहोचवते, 50% पर्यंत वाया कमी करते."
      }
    ]
  };
  
  return mcqsData[language] || mcqsData.english;
};

/**
 * Generate single fallback MCQ
 */
const generateFallbackMCQ = (crop, index, language) => {
  const fallback = generateFallbackMCQs(crop, language);
  return fallback[index % fallback.length];
};