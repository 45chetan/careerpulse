require('dotenv').config();

async function checkModels() {
    const apiKey = process.env.GEMINI_API_KEY.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log('--- AVAILABLE MODELS ---');
        if (data.models) {
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log('No models found or error:', data);
        }
    } catch (e) {
        console.error('Error fetching models:', e);
    }
}

checkModels();
