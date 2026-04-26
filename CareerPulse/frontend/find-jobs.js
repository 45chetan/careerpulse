document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearchJobs);
  }
});

async function handleSearchJobs(e) {
  e.preventDefault();
  
  const what = document.getElementById('searchWhat').value;
  const where = document.getElementById('searchWhere').value;
  const fullTime = document.getElementById('filterFullTime').checked;
  const partTime = document.getElementById('filterPartTime').checked;
  const contract = document.getElementById('filterContract').checked;
  const salaryMin = document.getElementById('filterSalaryMin').value;
  const sortBy = document.getElementById('filterSortBy').value;

  const container = document.getElementById('jobResultsContainer');
  const countDisplay = document.getElementById('resultsCount');
  
  // Show skeleton or loading
  container.innerHTML = `
    <div class="col-12 text-center p-5">
      <div class="premium-loader mx-auto">
        <div></div><div></div><div></div><div></div>
      </div>
      <p class="loading-text mt-3">Searching for jobs...</p>
    </div>
  `;
  countDisplay.innerText = '';

  const token = localStorage.getItem('token');
  
  // Construct URL
  let query = `?what=${encodeURIComponent(what)}&where=${encodeURIComponent(where)}&sort_by=${sortBy}`;
  if (fullTime) query += '&full_time=true';
  if (partTime) query += '&part_time=true';
  if (contract) query += '&contract=true';
  if (salaryMin) query += `&salary_min=${encodeURIComponent(salaryMin)}`;

  try {
    const res = await fetch(`${API_URL}/jobs/search${query}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    
    if (res.ok) {
      renderJobs(data.results, countDisplay, container);
    } else {
      showToast(data.message || 'Error fetching jobs', 'error');
      container.innerHTML = `<div class="col-12 text-center text-danger p-5">Failed to fetch jobs.</div>`;
    }
  } catch (error) {
    showToast('Server error while searching jobs', 'error');
    container.innerHTML = `<div class="col-12 text-center text-danger p-5">Failed to fetch jobs due to network error.</div>`;
  }
}

function renderJobs(jobs, countDisplay, container) {
  container.innerHTML = '';
  
  if (!jobs || jobs.length === 0) {
    countDisplay.innerText = '0 jobs found';
    container.innerHTML = `
      <div class="col-12 text-center text-muted p-5 glass-card">
        <h5><i class="fas fa-search-minus mb-3" style="font-size: 2rem;"></i></h5>
        <p>No jobs found matching your criteria. Try adjusting your filters.</p>
      </div>
    `;
    return;
  }

  countDisplay.innerText = `Showing top ${jobs.length} results`;

  jobs.forEach((job, index) => {
    // Adzuna data mapping
    const title = job.title || 'Unknown Title';
    const company = job.company ? job.company.display_name : 'Unknown Company';
    const location = job.location && job.location.display_name ? job.location.display_name : 'Remote / India';
    const salary = job.salary_min && job.salary_max ? `₹${Math.round(job.salary_min).toLocaleString()} - ₹${Math.round(job.salary_max).toLocaleString()}` : 'Salary not specified';
    const description = job.description || 'No description available.';
    const applyUrl = job.redirect_url;
    
    const card = document.createElement('div');
    card.className = 'col-md-6 mb-4';
    
    card.innerHTML = `
      <div class="glass-card h-100 p-4 d-flex flex-column" style="animation-delay: ${index * 0.05}s;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h5 class="fw-bold text-primary mb-0" style="font-size: 1.1rem;" title="${title}">${title.replace(/(<([^>]+)>)/gi, "")}</h5>
        </div>
        <h6 class="text-muted fw-bold"><i class="far fa-building me-1"></i> ${company}</h6>
        <div class="mb-3 mt-2 text-muted" style="font-size: 0.9rem;">
          <div><i class="fas fa-map-marker-alt me-1"></i> ${location}</div>
          <div><i class="fas fa-rupee-sign me-1"></i> ${salary}</div>
        </div>
        <p class="text-muted small flex-grow-1" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
          ${description}
        </p>
        <div class="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
          <a href="${applyUrl}" target="_blank" class="btn btn-outline-primary btn-sm" onclick="openApplyConfirmModal('${escapeQuotes(company)}', '${escapeQuotes(title)}')">
            <i class="fas fa-external-link-alt"></i> Apply Now
          </a>
          <button class="btn btn-primary btn-sm" onclick="saveJobToTracker('${escapeQuotes(company)}', '${escapeQuotes(title)}', '${escapeQuotes(location)}', '${escapeQuotes(salary)}', '${escapeQuotes(description)}', '${applyUrl}')">
            <i class="fas fa-bookmark"></i> Save Job
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

async function saveJobToTracker(companyName, role, location, salary, description, applyLink) {
  const token = localStorage.getItem('token');

  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/saved-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        jobTitle: role, 
        company: companyName,
        location,
        salary,
        description,
        applyLink
      })
    });
    
    if (res.ok) {
      showToast(`Saved "${role}" to your Saved Jobs!`, 'success');
    } else {
      const data = await res.json();
      showToast(data.message || 'Error saving job', 'error');
    }
  } catch (error) {
    showToast('Server error while saving job', 'error');
  }
  showLoading(false);
}
