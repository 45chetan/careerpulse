// Configuration for CareerPulse Deployment
const CONFIG = {
  // Replace this with your actual Render/Backend URL after deployment
  // Example: 'https://careerpulse-backend.onrender.com'
  BACKEND_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://careerpulse-render2.onrender.com' // <-- UPDATE THIS AFTER DEPLOYING BACKEND
};

// Common API endpoints
const API_URL = `${CONFIG.BACKEND_URL}/api`;
const INTERVIEW_API_URL = `${CONFIG.BACKEND_URL}/api/interview`;
