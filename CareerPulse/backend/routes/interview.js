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

// Configure Gemini
const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
console.log('API Key Loaded:', apiKey ? apiKey.substring(0, 4) + '...' : 'NOT FOUND');

// Helper for Gemini Direct API Calls
async function callGemini(prompt) {
  // Using gemini-flash-latest to avoid high demand error on lite version
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  console.log('**************************************************');
  console.log('--- [BACKEND] SENDING FETCH REQUEST TO GEMINI ---');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });
  console.log('--- [BACKEND] FETCH REQUEST COMPLETE ---');
  console.log('**************************************************');

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Gemini API Error');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
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
      You are an expert technical interviewer.
      Resume Context: ${resumeText}
      Target Role: ${role}
      Experience Level: ${experienceLevel}
      Interview History: ${JSON.stringify(history)}
      Current Question Number: ${currentQuestionIndex + 1}

      Tasks:
      1. If history is empty, greet the user and ask the first introductory question based on their resume.
      2. If history is not empty, analyze the previous answer and ask a follow-up or a new question (Technical, HR, or Scenario-based).
      3. Keep the question professional and concise.
      4. Ensure the question is suitable for voice interaction.

      Return ONLY a JSON object:
      {
        "question": "The question text here",
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
