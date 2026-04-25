const express = require('express');
const router = express.Router();
console.log('**************************************************');
console.log('--- [BACKEND] Interview Route Version 2.0 (STRICT VALIDATION) Loaded ---');
console.log('Interview Route Loaded from:', __filename);
console.log('**************************************************');

const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Usage = require('../models/Usage');

// Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'chetansahu4572@gmail.com',
    pass: process.env.EMAIL_PASS // User needs to set this app password in .env
  }
});

async function sendLimitWarning(currentCount) {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'chetansahu4572@gmail.com',
      to: 'chetansahu4572@gmail.com',
      subject: '⚠️ CareerPulse: Gemini API Limit Warning',
      text: `Warning: You have used ${currentCount} requests today. Only approx 50 requests are left for the day before the daily limit (1500) is reached. Please plan accordingly.`
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('--- [EMAIL] Limit warning sent to chetansahu4572@gmail.com ---');
    } catch (error) {
        console.error('--- [EMAIL] Failed to send warning:', error.message);
    }
}

// Configure Gemini
const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
console.log('API Key Loaded:', apiKey ? apiKey.substring(0, 4) + '...' : 'NOT FOUND');

// Helper for Gemini Direct API Calls with Retry Logic
async function callGemini(prompt, retries = 5) {
  // Track Usage
  const today = new Date().toISOString().split('T')[0];
  let usage = await Usage.findOne({ date: today });
  if (!usage) {
    usage = new Usage({ date: today, count: 0 });
  }
  usage.count += 1;
  await usage.save();

  // Check if warning is needed (Limit ~1500, warning at 1450)
  if (usage.count === 1450) {
      sendLimitWarning(usage.count);
  }

  // Switched to gemini-3.1-flash-lite-preview as it has active quota and is more reliable for this API key.
  const model = "gemini-3.1-flash-lite-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let delay = 2000; 

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`--- [GEMINI] Attempt ${i + 1}/${retries} using ${model} ---`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      console.log(`--- [GEMINI] Status: ${response.status} ${response.statusText} ---`);

      // Handle Rate Limit (429) and Overloaded/Service Unavailable (503/504)
      if (response.status === 429 || response.status === 503 || response.status === 504) {
        const errorType = response.status === 429 ? "Rate Limit/Quota" : "Server Overloaded";
        console.warn(`--- [GEMINI] ${errorType} hit. Retrying in ${delay}ms... ---`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }

      if (!response.ok) {
        const err = await response.json();
        console.error('--- [GEMINI] Error Body:', JSON.stringify(err));
        
        // If the error message indicates overloaded, retry even if status isn't 503
        if (err.error?.message?.includes('heavy load') || err.error?.message?.includes('overloaded')) {
           console.warn(`--- [GEMINI] Detected heavy load in message. Retrying in ${delay}ms... ---`);
           await new Promise(resolve => setTimeout(resolve, delay));
           delay *= 2;
           continue;
        }
        
        throw new Error(err.error?.message || 'Gemini API Error');
      }

      const data = await response.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        // Sometimes the API returns a success but no content due to safety or other reasons
        if (data.promptFeedback?.blockReason) {
            throw new Error(`Content blocked by Gemini: ${data.promptFeedback.blockReason}`);
        }
        throw new Error('Invalid response from Gemini');
      }
      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error(`--- [GEMINI] Request failed: ${error.message}. ---`);
      if (i === retries - 1) throw error;
      
      // Retry on network errors or specified API errors
      console.log(`Retrying (${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error('Gemini API is currently under heavy load or quota exceeded. Please try again in a moment.');
}
// Configure Multer for resume uploads (using Memory Storage to prevent Live Server reloads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== '.pdf') {
      return cb(new Error('Only PDFs are allowed'));
    }
    cb(null, true);
  }
});

// Route: Upload and Parse Resume with Validation
router.post('/upload-resume', upload.single('resume'), async (req, res) => {
  console.log('--- [BACKEND] /upload-resume Request Received ---');
  try {
    if (!req.file) {
      console.log('--- [BACKEND] No file uploaded ---');
      return res.status(400).json({ error: 'Please upload a PDF resume' });
    }
    console.log(`--- [BACKEND] Parsing file from buffer: ${req.file.originalname} ---`);

    // Parse PDF directly from the memory buffer
    const data = await pdf(req.file.buffer);
    const resumeText = data.text.trim();

    // 1. Basic Content Check
    if (!resumeText || resumeText.length < 150) {
      console.log('--- [BACKEND] Validation Failed: Content too short or empty ---');
      return res.status(400).json({ 
        error: "The uploaded file does not appear to be a valid resume. Please upload a proper resume containing your skills, education, and experience." 
      });
    }

    console.log(`--- [BACKEND] Resume parsed. Length: ${resumeText.length} chars. ---`);
    console.log(`--- [BACKEND] Sample text: ${resumeText.substring(0, 200)}... ---`);

    // 2. AI-Based Semantic Validation
    const validationPrompt = `
      You are a strict recruitment validator. 
      Analyze the following text and determine if it is a professional resume.
      
      A VALID resume must:
      - Explicitly mention professional skills, education, or work experience.
      - Be structured as a profile for a job applicant.
      
      An INVALID document is:
      - A book, essay, movie script, list of random items, or generic text.
      - Any document that does not represent a specific individual's professional history.

      Text:
      ${resumeText.substring(0, 3000)}

      Return ONLY a JSON object:
      {
        "isValid": true or false,
        "reason": "explanation",
        "confidence": 0-100
      }
    `;

    console.log('**************************************************');
    console.log('--- [BACKEND] CALLING AI FOR VALIDATION ---');
    const validationResponse = await callGemini(validationPrompt);
    console.log('--- [BACKEND] AI RESPONSE:', validationResponse);
    console.log('**************************************************');

    const jsonMatch = validationResponse.match(/\{[\s\S]*\}/);
    let isResumeValid = false;
    
    if (jsonMatch) {
      try {
        const validation = JSON.parse(jsonMatch[0]);
        console.log('--- [BACKEND] PARSED VALIDATION:', validation);
        
        // Strict check: Must have high confidence and explicitly be a resume
        if (validation.isValid === true && (validation.confidence === undefined || validation.confidence >= 70)) {
          isResumeValid = true;
          console.log('--- [BACKEND] RESULT: VALID ---');
        } else {
          console.log('--- [BACKEND] RESULT: INVALID (or Low Confidence) ---');
        }
      } catch (parseErr) {
        console.error('--- [BACKEND] JSON PARSE ERROR:', parseErr);
      }
    } else {
      console.warn('--- [BACKEND] NO JSON FOUND IN AI RESPONSE ---');
    }

    if (!isResumeValid) {
      console.log('--- [BACKEND] FINAL DECISION: REJECTING RESUME ---');
      console.log('**************************************************');
      return res.status(400).json({ 
        error: "The uploaded file does not appear to be a valid resume. Please upload a proper resume containing your skills, education, and experience." 
      });
    }

    console.log('--- [BACKEND] FINAL DECISION: ACCEPTING RESUME ---');
    console.log('**************************************************');
    res.json({ text: resumeText });

  } catch (error) {
    console.error('--- [BACKEND] Resume processing/validation error:', error);
    res.status(500).json({ error: 'Failed to process resume: ' + error.message });
  }
});

// Route: Generate Next Question
router.post('/next-question', async (req, res) => {
  console.log('--- Next Question Request Received ---');
  try {
    const { resumeText, role, experienceLevel, history, currentQuestionIndex } = req.body;
    console.log(`Role: ${role}, History Length: ${history.length}`);

    const prompt = `
      You are an expert technical interviewer for a ${role} position.
      Resume Context: ${resumeText}
      Target Role: ${role}
      Experience Level: ${experienceLevel}
      Interview History (Previous Q&A): ${JSON.stringify(history)}
      Current Question Number: ${currentQuestionIndex + 1}

      CRITICAL RULES:
      1. NEVER repeat a question that has already been asked in the history.
      2. If history is empty, start with a warm welcome and a foundational question about their background in ${role}.
      3. If history is not empty, acknowledge the previous answer briefly and ask a follow-up or a new challenging question.
      4. Focus on specific technical skills mentioned in the resume and how they apply to ${role}.
      5. Keep questions concise (1-2 sentences) and optimized for voice interaction.

      Return ONLY a JSON object:
      {
        "question": "Your next question here",
        "type": "Technical|HR|Scenario"
      }
    `;

    console.log('--- [BACKEND] Calling Gemini for next question... ---');
    const text = await callGemini(prompt);
    console.log('--- [BACKEND] Gemini Response Received ---');

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`--- [BACKEND] Question Generated: "${parsed.question.substring(0, 50)}..." ---`);
      res.json(parsed);
    } else {
      console.log('--- [BACKEND] Gemini response was not JSON, sending fallback ---');
      res.json({ question: "Could you tell me more about your experience with " + role + "?", type: "Intro" });
    }
  } catch (error) {
    console.error('--- [BACKEND] Question generation error:', error);
    res.status(500).json({ error: 'Failed to generate question: ' + error.message });
  }
});

// Route: Evaluate Answer & Check Discipline
router.post('/evaluate-answer', async (req, res) => {
  try {
    const { question, answer, history, role } = req.body;

    const prompt = `
      You are an interview evaluator.
      Question: ${question}
      Candidate Answer: ${answer}
      Role: ${role}

      Tasks:
      1. Check if the answer is relevant to the question or the interview context.
      2. Check if the answer is in English.
      3. Evaluate for: Relevance, Clarity, Technical Accuracy.

      Return ONLY a JSON object:
      {
        "isRelevant": true|false,
        "isEnglish": true|false,
        "feedback": "Short feedback on this answer",
        "evaluation": {
          "relevance": 1-10,
          "clarity": 1-10,
          "accuracy": 1-10
        }
      }
    `;

    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      res.json(JSON.parse(jsonMatch[0]));
    } else {
      res.status(500).json({ error: 'Failed to evaluate answer' });
    }
  } catch (error) {
    console.error('Answer evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate answer' });
  }
});

// Route: Final Feedback
router.post('/final-feedback', async (req, res) => {
  try {
    const { history, role, experienceLevel } = req.body;

    const prompt = `
      You are a senior hiring manager. Provide a detailed interview feedback report.
      Role: ${role}
      Experience Level: ${experienceLevel}
      Interview History: ${JSON.stringify(history)}

      Provide feedback in the following structure (JSON):
      {
        "overallScore": 0-10,
        "strengths": ["list", "of", "strengths"],
        "areasForImprovement": ["list", "of", "areas"],
        "communicationFeedback": {
          "fluency": "string",
          "grammar": "string",
          "clarity": "string"
        },
        "technicalFeedback": {
          "strongTopics": ["list"],
          "weakAreas": ["list"]
        },
        "suggestions": ["practice recommendations"]
      }
    `;

    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      res.json(JSON.parse(jsonMatch[0]));
    } else {
      res.status(500).json({ error: 'Failed to generate final feedback' });
    }
  } catch (error) {
    console.error('Final feedback error:', error);
    res.status(500).json({ error: 'Failed to generate final feedback' });
  }
});

module.exports = router;
