let savedJobs = [];
let trackerModal = null;

document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('addToTrackerModal');
  if (modalEl) {
    trackerModal = new bootstrap.Modal(modalEl);
  }

  const trackerForm = document.getElementById('savedJobTrackerForm');
  if (trackerForm) {
    trackerForm.addEventListener('submit', handleAddToTrackerSubmit);
  }

  loadSavedJobs();
});

async function loadSavedJobs() {
  const token = localStorage.getItem('token');
  const container = document.getElementById('savedJobsContainer');
  
  try {
    const res = await fetch(`${API_URL}/saved-jobs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      window.location.href = 'index.html';
      return;
    }
    
    const data = await res.json();
    
    if (res.ok) {
      savedJobs = data;
      renderSavedJobs();
    } else {
      showToast('Error loading saved jobs', 'error');
      container.innerHTML = `<div class="col-12 text-center text-danger p-5">Failed to fetch jobs.</div>`;
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
}

function renderSavedJobs() {
  const container = document.getElementById('savedJobsContainer');
  container.innerHTML = '';
  
  if (savedJobs.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted p-5 glass-card mt-3">
        <h5><i class="far fa-bookmark mb-3" style="font-size: 2rem;"></i></h5>
        <p>You haven't saved any jobs yet.</p>
        <a href="find-jobs.html" class="btn btn-primary mt-2">Find Jobs</a>
      </div>
    `;
    return;
  }

  savedJobs.forEach((job, index) => {
    const card = document.createElement('div');
    card.className = 'col-md-6 mb-4 fade-in';
    card.style.animationDelay = `${index * 0.05}s`;
    
    const applyUrl = job.applyLink || '#';
    const salary = job.salary ? job.salary : 'Salary not specified';
    const location = job.location ? job.location : 'Remote / India';
    const company = job.company;
    const title = job.jobTitle;

    card.innerHTML = `
      <div class="glass-card h-100 p-4 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h5 class="fw-bold text-primary mb-0" style="font-size: 1.1rem;">${title}</h5>
          <button class="btn btn-link text-danger p-0 ms-2" onclick="unsaveJob('${job._id}')" title="Unsave Job">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <h6 class="text-muted fw-bold"><i class="far fa-building me-1"></i> ${company}</h6>
        <div class="mb-3 mt-2 text-muted" style="font-size: 0.9rem;">
          <div><i class="fas fa-map-marker-alt me-1"></i> ${location}</div>
          <div><i class="fas fa-rupee-sign me-1"></i> ${salary}</div>
        </div>
        <p class="text-muted small flex-grow-1" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
          ${job.description || 'No description available.'}
        </p>
        <div class="mt-3 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
          <a href="${applyUrl}" target="_blank" class="btn btn-outline-primary btn-sm flex-grow-1 text-center" onclick="openApplyConfirmModal('${escapeQuotes(company)}', '${escapeQuotes(title)}')">
            <i class="fas fa-external-link-alt"></i> Apply Now
          </a>
          <button class="btn btn-primary btn-sm flex-grow-1" onclick="openTrackerModal('${escapeQuotes(company)}', '${escapeQuotes(title)}')">
            <i class="fas fa-plus"></i> Add to Tracker
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/(<([^>]+)>)/gi, "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function unsaveJob(id) {
  const token = localStorage.getItem('token');
  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/saved-jobs/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      showToast('Job removed', 'success');
      savedJobs = savedJobs.filter(j => j._id !== id);
      renderSavedJobs();
    } else {
      showToast('Error removing job', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}

function openTrackerModal(company, role) {
  document.getElementById('sjCompany').value = company;
  document.getElementById('sjRole').value = role;
  document.getElementById('sjDate').valueAsDate = new Date();
  document.getElementById('sjStatus').value = 'Applied';
  document.getElementById('sjNotes').value = 'Imported from Saved Jobs.';
  trackerModal.show();
}

async function handleAddToTrackerSubmit(e) {
  e.preventDefault();
  
  const token = localStorage.getItem('token');
  const companyName = document.getElementById('sjCompany').value;
  const role = document.getElementById('sjRole').value;
  const date = document.getElementById('sjDate').value;
  const status = document.getElementById('sjStatus').value;
  const notes = document.getElementById('sjNotes').value;

  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ companyName, role, date, status, notes })
    });
    
    if (res.ok) {
      showToast('Added to application tracker!', 'success');
      trackerModal.hide();
    } else {
      const data = await res.json();
      showToast(data.message || 'Error saving to tracker', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}
