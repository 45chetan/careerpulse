require('dotenv').config();
const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Available Models:');
    data.models.forEach(m => console.log(m.name));
  } catch (e) {
    console.error('Error listing models:', e);
  }
}

listModels();
