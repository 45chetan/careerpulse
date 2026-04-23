// INTERVIEW_API_URL is now provided by config.js
const API_BASE_URL = INTERVIEW_API_URL;

// State Management
let interviewState = {
  resumeText: '',
  role: '',
  experienceLevel: '',
  voice: 'male',
  history: [],
  currentQuestionIndex: 0,
  warnings: 0,
  isRecording: false,
  timerInterval: null,
  secondsElapsed: 0
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('--- [FRONTEND] Mock Interview Script Loaded at:', new Date().toLocaleTimeString(), '---');

  // DOM Elements
  const setupScreen = document.getElementById('setupScreen');
  const interviewScreen = document.getElementById('interviewScreen');
  const feedbackScreen = document.getElementById('feedbackScreen');
  const setupForm = document.getElementById('setupForm');
  const aiAvatar = document.getElementById('aiAvatar');
  const currentQuestionEl = document.getElementById('currentQuestion');
  const transcriptContainer = document.getElementById('transcriptContainer');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const waveform = document.getElementById('waveform');
  const speakingPulse = document.getElementById('speakingPulse');
  const timerEl = document.getElementById('interviewTimer');
  const warningAlert = document.getElementById('warningAlert');
  const warningMsg = document.getElementById('warningMsg');

  // Initialize Dark Mode
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
    document.documentElement.setAttribute('data-bs-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-bs-theme', 'light');
  }

  // Dark Mode Toggle Button
  const toggleDarkModeBtn = document.getElementById('toggleDarkMode');
  if (toggleDarkModeBtn) {
    toggleDarkModeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

    toggleDarkModeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const currentlyDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('darkMode', currentlyDark);
      document.documentElement.setAttribute('data-bs-theme', currentlyDark ? 'dark' : 'light');
      toggleDarkModeBtn.innerHTML = currentlyDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
  }

  if (!setupForm) {
    console.error('--- [FRONTEND] ERROR: setupForm element not found! ---');
    return;
  }

// Speech Recognition (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    interviewState.isRecording = true;
    statusText.innerText = 'Listening...';
    statusDot.classList.add('active');
    waveform.classList.add('listening');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    transcriptContainer.innerText = finalTranscript || interimTranscript;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
  };

  recognition.onend = () => {
    interviewState.isRecording = false;
    statusDot.classList.remove('active');
    waveform.classList.remove('listening');
    
    const answer = transcriptContainer.innerText.trim();
    if (answer && answer !== 'Your answer will appear here...') {
      handleAnswer(answer);
    } else {
      // If no answer detected, ask user to repeat
      speakText("I'm sorry, I didn't catch that. Could you please repeat?");
    }
  };
}

// Text to Speech
function speakText(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Attempt to pick a suitable voice
    if (interviewState.voice === 'male') {
      utterance.voice = voices.find(v => v.name.includes('Google US English') && v.name.includes('Male')) || voices[0];
    } else {
      utterance.voice = voices.find(v => v.name.includes('Google US English') && v.name.includes('Female')) || voices[1];
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => {
      statusText.innerText = 'AI Speaking...';
      speakingPulse.style.display = 'block';
    };
    
    utterance.onend = () => {
      speakingPulse.style.display = 'none';
      statusText.innerText = 'Waiting for your response...';
      resolve();
      startRecording();
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

// Recording Control
function startRecording() {
  if (recognition && !interviewState.isRecording) {
    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition already started');
    }
  }
}

function stopRecording() {
  if (recognition && interviewState.isRecording) {
    recognition.stop();
  }
}

  // Setup Form Submission
  const startInterviewBtn = document.getElementById('startInterviewBtn');
  
  // Clean Approach: Use ONLY the form submit listener
  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('--- [FRONTEND] Form Submit Event Triggered ---');
    await handleStartInterview();
  });

  async function handleStartInterview() {
    console.log('--- [FRONTEND] Starting Interview Process ---');
    
    const resumeFile = document.getElementById('resumeUpload').files[0];
    const jobRole = document.getElementById('jobRole').value;
    const experienceLevel = document.getElementById('experienceLevel').value;
    const voiceSelect = document.querySelector('input[name="voiceSelect"]:checked');
    const voice = voiceSelect ? voiceSelect.value : 'male';
    
    if (!resumeFile) return alert('Please upload a resume');
    if (!jobRole) return alert('Please enter a job role');
    
    // Disable button to prevent multiple clicks
    startInterviewBtn.disabled = true;
    startInterviewBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Initializing...';
    
    document.getElementById('loading').classList.remove('hidden');
    
    try {
      // 1. Upload Resume
      console.log('--- [FRONTEND] Sending Resume to Backend... ---');
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const uploadRes = await fetch(`${API_BASE_URL}/upload-resume`, {
        method: 'POST',
        body: formData
      });
      
      console.log('--- [FRONTEND] Backend Response Status:', uploadRes.status);
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        console.error('--- [FRONTEND] Upload Failed:', errorData.error);
        throw new Error(errorData.error || 'Failed to upload resume');
      }
      
      const uploadData = await uploadRes.json();
      console.log('--- [FRONTEND] Resume Upload Success! ---');
      
      interviewState.resumeText = uploadData.text;
      interviewState.role = jobRole;
      interviewState.experienceLevel = experienceLevel;
      interviewState.voice = voice;
      
      // Set Avatar
      aiAvatar.src = voice === 'male' ? 'assets/avatar-male.png' : 'assets/avatar-female.png';
      
      // 2. Start Interview
      console.log('--- [FRONTEND] Switching to Interview Screen ---');
      setupScreen.classList.add('hidden');
      interviewScreen.classList.remove('hidden');
      document.getElementById('loading').classList.add('hidden');
      
      startTimer();
      
      // Fetch question in background
      getNextQuestion();
      
    } catch (err) {
      console.error('--- [FRONTEND] Setup Error:', err, '---');
      alert('Error: ' + err.message);
      document.getElementById('loading').classList.add('hidden');
      
      // Re-enable button on error
      startInterviewBtn.disabled = false;
      startInterviewBtn.innerHTML = '<i class="fas fa-microphone me-2"></i> Start Interview';
    }
  }

// Timer Logic
function startTimer() {
  interviewState.secondsElapsed = 0;
  interviewState.timerInterval = setInterval(() => {
    interviewState.secondsElapsed++;
    const mins = Math.floor(interviewState.secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (interviewState.secondsElapsed % 60).toString().padStart(2, '0');
    timerEl.innerText = `${mins}:${secs}`;
  }, 1000);
}

// Interview Flow
async function getNextQuestion() {
  console.log('--- [FRONTEND] Fetching Next Question... ---');
  try {
    const res = await fetch(`${API_BASE_URL}/next-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: interviewState.resumeText,
        role: interviewState.role,
        experienceLevel: interviewState.experienceLevel,
        history: interviewState.history,
        currentQuestionIndex: interviewState.currentQuestionIndex
      })
    });
    
    const data = await res.json();
    console.log('--- [FRONTEND] Next Question Data:', data, '---');
    currentQuestionEl.innerText = data.question;
    
    // If it's the first question, add the rules intro
    let textToSpeak = data.question;
    if (interviewState.history.length === 0) {
      textToSpeak = "Hello! I am your AI interviewer. Before we begin, please ensure you speak only in English and stay focused on the questions. Irrelevant responses may lead to session termination. Let's start. " + data.question;
    }
    
    await speakText(textToSpeak);
    
  } catch (err) {
    console.error('--- [FRONTEND] Error fetching question:', err, '---');
  }
}

async function handleAnswer(answer) {
  stopRecording();
  statusText.innerText = 'Analyzing answer...';
  
  try {
    const res = await fetch(`${API_BASE_URL}/evaluate-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: currentQuestionEl.innerText,
        answer: answer,
        role: interviewState.role
      })
    });
    
    const evalData = await res.json();
    
    // Discipline Logic
    if (!evalData.isRelevant || !evalData.isEnglish) {
      interviewState.warnings++;
      warningAlert.classList.remove('hidden');
      
      if (interviewState.warnings === 1) {
        warningMsg.innerText = "Please stay focused on the interview and speak in English. This is your first warning.";
        await speakText("Please stay focused on the interview and speak only in English. This is your first warning.");
      } else {
        warningMsg.innerText = "The interview session is terminated due to irrelevant responses.";
        await speakText("The interview session is terminated due to irrelevant responses.");
        endInterview();
        return;
      }
    } else {
      warningAlert.classList.add('hidden');
    }
    
    // Save to history
    interviewState.history.push({
      question: currentQuestionEl.innerText,
      answer: answer,
      evaluation: evalData.evaluation,
      feedback: evalData.feedback
    });
    
    interviewState.currentQuestionIndex++;
    
    // Proceed to next question or end if 5-7 questions reached
    if (interviewState.currentQuestionIndex >= 6) {
      endInterview();
    } else {
      getNextQuestion();
    }
    
  } catch (err) {
    console.error('Error evaluating answer:', err);
  }
}

async function endInterview() {
  clearInterval(interviewState.timerInterval);
  document.getElementById('loading').classList.remove('hidden');
  
  try {
    const res = await fetch(`${API_BASE_URL}/final-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: interviewState.history,
        role: interviewState.role,
        experienceLevel: interviewState.experienceLevel
      })
    });
    
    const feedback = await res.json();
    displayFeedback(feedback);
    
  } catch (err) {
    console.error('Error getting final feedback:', err);
    alert('Failed to generate feedback. Check console for details.');
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function displayFeedback(data) {
  interviewScreen.classList.add('hidden');
  feedbackScreen.classList.remove('hidden');
  
  document.getElementById('finalScore').innerText = `${data.overallScore}/10`;
  
  const strengthsList = document.getElementById('strengthsList');
  strengthsList.innerHTML = data.strengths.map(s => `<div class="strength-tag">${s}</div>`).join('');
  
  const improvementsList = document.getElementById('improvementsList');
  improvementsList.innerHTML = data.areasForImprovement.map(i => `<div class="improvement-tag">${i}</div>`).join('');
  
  document.getElementById('fluencyRating').innerText = data.communicationFeedback.fluency;
  document.getElementById('grammarRating').innerText = data.communicationFeedback.grammar;
  document.getElementById('clarityRating').innerText = data.communicationFeedback.clarity;
  
  document.getElementById('strongTopicsList').innerHTML = data.technicalFeedback.strongTopics.map(t => `<span class="badge bg-success me-1">${t}</span>`).join('');
  document.getElementById('weakAreasList').innerHTML = data.technicalFeedback.weakAreas.map(t => `<span class="badge bg-danger me-1">${t}</span>`).join('');
}

document.getElementById('endInterviewBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to end the interview?')) {
    endInterview();
  }
});

  // Initialize Voices
  window.speechSynthesis.onvoiceschanged = () => {
    // Just to ensure voices are loaded
  };
});
