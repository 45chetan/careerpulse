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
  isTransitioning: false,
  timerInterval: null,
  secondsElapsed: 0
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('--- [FRONTEND] Mock Interview Script Loaded ---');

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

  // Logout Logic
  const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      window.location.href = 'index.html';
    });
  }

  if (!setupForm) {
    console.error('--- [FRONTEND] ERROR: setupForm element not found! ---');
    return;
  }

// Speech Recognition (Web Speech API)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let silenceTimer = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    console.log('--- [FRONTEND] Microphone Listening ---');
    interviewState.isRecording = true;
    if (statusText) statusText.innerText = 'Listening...';
    if (statusDot) statusDot.classList.add('active');
    if (waveform) waveform.classList.add('listening');
    if (transcriptContainer) {
        transcriptContainer.innerText = '';
        transcriptContainer.style.border = '2px solid var(--primary-color)';
    }

    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
        if (interviewState.isRecording) {
            console.log("Silence detected on start, stopping recording...");
            stopRecording();
        }
    }, 10000);
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    if (transcriptContainer) {
        transcriptContainer.innerText = (finalTranscript + interimTranscript).trim();
    }

    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
        if (interviewState.isRecording) {
            console.log("Silence detected after speech, stopping recording...");
            stopRecording();
        }
    }, 5000);
  };

  recognition.onerror = (event) => {
    console.error('--- [FRONTEND] Recognition Error:', event.error);
    if (event.error === 'not-allowed') {
        alert('Microphone blocked! Please allow access in your browser settings.');
    }
    clearTimeout(silenceTimer);
  };

  recognition.onend = () => {
    console.log('--- [FRONTEND] Microphone Off ---');
    interviewState.isRecording = false;
    clearTimeout(silenceTimer);
    if (statusDot) statusDot.classList.remove('active');
    if (waveform) waveform.classList.remove('listening');
    if (transcriptContainer) transcriptContainer.style.border = '';

    if (interviewState.isTransitioning) return;

    if (statusText) statusText.innerText = 'Processing...';

    // Process answer
    setTimeout(() => {
        const answer = transcriptContainer ? transcriptContainer.innerText.trim() : '';
        if (answer && answer !== '' && answer !== 'Your answer will appear here...') {
          handleAnswer(answer);
        } else if (!interviewState.isTransitioning && !interviewState.isRecording) {
          console.warn('No speech detected, asking to repeat.');
          speakText("I'm sorry, I didn't hear anything. Could you please repeat that?");
        }
    }, 500);
  };
}

// Text to Speech
function speakText(text) {
  return new Promise((resolve) => {
    console.log('--- [FRONTEND] AI Speaking ---');
    interviewState.isTransitioning = true;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Heartbeat to prevent Chrome hanging
    const heartbeat = setInterval(() => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        } else {
            clearInterval(heartbeat);
        }
    }, 5000);

    let voices = window.speechSynthesis.getVoices();
    const voiceName = interviewState.voice === 'male' ? 'Male' : 'Female';
    utterance.voice = voices.find(v => v.name.includes(voiceName) && v.lang.startsWith('en')) || voices[0];
    
    utterance.onstart = () => {
      statusText.innerText = 'AI Speaking...';
      speakingPulse.style.display = 'block';
    };
    
    utterance.onend = () => {
      clearInterval(heartbeat);
      speakingPulse.style.display = 'none';
      statusText.innerText = 'Your turn to speak';
      interviewState.isTransitioning = false;
      resolve();
      setTimeout(startRecording, 500);
    };

    utterance.onerror = (err) => {
      clearInterval(heartbeat);
      speakingPulse.style.display = 'none';
      interviewState.isTransitioning = false;
      resolve();
      setTimeout(startRecording, 500);
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

// Recording Control
function startRecording() {
  if (recognition && !interviewState.isRecording && !interviewState.isTransitioning) {
    try {
      recognition.start();
      const btn = document.getElementById('manualMicBtn');
      if (btn) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline-primary');
      }
    } catch (e) {
      console.warn('Mic already active or blocked');
    }
  }
}

function stopRecording() {
  if (recognition && interviewState.isRecording) {
    recognition.stop();
    const btn = document.getElementById('manualMicBtn');
    if (btn) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-primary');
    }
  }
}

  // Setup Form Submission
  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleStartInterview();
  });

  async function handleStartInterview() {
    const resumeFile = document.getElementById('resumeUpload').files[0];
    const jobRole = document.getElementById('jobRole').value;
    const experienceLevel = document.getElementById('experienceLevel').value;
    const voiceSelect = document.querySelector('input[name="voiceSelect"]:checked');
    const voice = voiceSelect ? voiceSelect.value : 'male';
    
    if (!resumeFile) return alert('Please upload a resume');
    
    startInterviewBtn.disabled = true;
    startInterviewBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Initializing...';
    document.getElementById('loading').classList.remove('hidden');
    
    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const uploadRes = await fetch(`${API_BASE_URL}/upload-resume`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const uploadData = await uploadRes.json();
      interviewState.resumeText = uploadData.text;
      interviewState.role = jobRole;
      interviewState.experienceLevel = experienceLevel;
      interviewState.voice = voice;
      
      aiAvatar.src = voice === 'male' ? 'assets/avatar-male.png' : 'assets/avatar-female.png';
      
      setupScreen.classList.add('hidden');
      interviewScreen.classList.remove('hidden');
      document.getElementById('loading').classList.add('hidden');
      
      startTimer();
      getNextQuestion();
      
    } catch (err) {
      alert('Error: ' + err.message);
      document.getElementById('loading').classList.add('hidden');
      startInterviewBtn.disabled = false;
      startInterviewBtn.innerHTML = '<i class="fas fa-microphone me-2"></i> Start Interview';
    }
  }

function startTimer() {
  interviewState.secondsElapsed = 0;
  interviewState.timerInterval = setInterval(() => {
    interviewState.secondsElapsed++;
    const mins = Math.floor(interviewState.secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (interviewState.secondsElapsed % 60).toString().padStart(2, '0');
    timerEl.innerText = `${mins}:${secs}`;
  }, 1000);
}

async function getNextQuestion() {
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
    currentQuestionEl.innerText = data.question;
    
    let textToSpeak = data.question;
    if (interviewState.history.length === 0) {
      textToSpeak = "Hello! I am your AI interviewer. Let's start. " + data.question;
    }
    
    await speakText(textToSpeak);
    
  } catch (err) {
    console.error('Question fetch error:', err);
  }
}

async function handleAnswer(answer) {
  stopRecording();
  statusText.innerText = 'Analyzing...';
  
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
    
    if (!evalData.isRelevant || !evalData.isEnglish) {
      interviewState.warnings++;
      warningAlert.classList.remove('hidden');
      
      if (interviewState.warnings === 1) {
        warningMsg.innerText = "Please stay focused and speak in English. First warning.";
        await speakText("Please stay focused and speak in English. First warning.");
      } else {
        warningMsg.innerText = "Session terminated due to irrelevant responses.";
        await speakText("Session terminated. Goodbye.");
        endInterview();
        return;
      }
    } else {
      warningAlert.classList.add('hidden');
    }
    
    interviewState.history.push({
      question: currentQuestionEl.innerText,
      answer: answer,
      evaluation: evalData.evaluation,
      feedback: evalData.feedback
    });
    
    interviewState.currentQuestionIndex++;
    
    if (interviewState.currentQuestionIndex >= 6) {
      endInterview();
    } else {
      getNextQuestion();
    }
    
  } catch (err) {
    interviewState.currentQuestionIndex++;
    if (interviewState.currentQuestionIndex < 6) getNextQuestion(); else endInterview();
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
    alert('Error generating feedback.');
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function displayFeedback(data) {
  interviewScreen.classList.add('hidden');
  feedbackScreen.classList.remove('hidden');
  
  const score = data.overallScore || 0;
  const scoreEl = document.getElementById('finalScore');
  scoreEl.innerText = `${score}/10`;
  
  const strengthsList = document.getElementById('strengthsList');
  strengthsList.innerHTML = (data.strengths || []).map(s => `<div class="strength-tag"><i class="fas fa-check-circle"></i> ${s}</div>`).join('');
  
  const improvementsList = document.getElementById('improvementsList');
  improvementsList.innerHTML = (data.areasForImprovement || []).map(i => `<div class="improvement-tag"><i class="fas fa-arrow-up"></i> ${i}</div>`).join('');
  
  if (data.communicationFeedback) {
    document.getElementById('fluencyRating').innerText = data.communicationFeedback.fluency;
    document.getElementById('grammarRating').innerText = data.communicationFeedback.grammar;
    document.getElementById('clarityRating').innerText = data.communicationFeedback.clarity;
  }
  
  if (data.technicalFeedback) {
    const strongTopicsList = document.getElementById('strongTopicsList');
    strongTopicsList.innerHTML = (data.technicalFeedback.strongTopics || []).map(t => `<span class="badge bg-success-subtle text-success m-1">${t}</span>`).join('');
    
    const weakAreasList = document.getElementById('weakAreasList');
    weakAreasList.innerHTML = (data.technicalFeedback.weakAreas || []).map(a => `<span class="badge bg-warning-subtle text-warning m-1">${a}</span>`).join('');
  }
}

document.getElementById('endInterviewBtn').addEventListener('click', () => {
  if (confirm('End interview?')) endInterview();
});

const manualMicBtn = document.getElementById('manualMicBtn');
if (manualMicBtn) {
  manualMicBtn.addEventListener('click', () => {
    if (interviewState.isRecording) stopRecording(); else startRecording();
  });
}

window.speechSynthesis.onvoiceschanged = () => {};
});
