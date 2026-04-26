document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchCompanyForm');
  const searchInput = document.getElementById('searchLocation');
  const container = document.getElementById('companyResultsContainer');
  const countDisplay = document.getElementById('resultsCount');

  if (searchForm) {
    searchForm.addEventListener('submit', handleSearchCompanies);
  }

  // Reset UI when input is cleared
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (e.target.value.trim() === "") {
        resetUI(container, countDisplay);
      }
    });
  }
});

function resetUI(container, countDisplay) {
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted p-5 mt-4">
        <h5><i class="fas fa-city mb-3" style="font-size: 3rem; opacity: 0.3;"></i></h5>
        <p class="lead">Search for IT companies by entering a city</p>
        <p class="small text-secondary">Discover tech firms, software houses, and cloud services near you.</p>
      </div>
    `;
  }
  if (countDisplay) {
    countDisplay.innerHTML = '';
  }
}

async function handleSearchCompanies(e) {
  e.preventDefault();
  
  const location = document.getElementById('searchLocation').value.trim();
  const container = document.getElementById('companyResultsContainer');
  const countDisplay = document.getElementById('resultsCount');
  
  if (!location) {
    resetUI(container, countDisplay);
    return;
  }
  
  // Show loading skeleton
  container.innerHTML = `
    <div class="col-12 text-center p-5">
      <div class="premium-loader mx-auto">
        <div></div><div></div><div></div><div></div>
      </div>
      <p class="loading-text mt-3">Searching for verified IT companies in ${location}...</p>
    </div>
  `;
  countDisplay.innerText = '';

  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/companies/search?location=${encodeURIComponent(location)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    
    if (res.ok) {
      renderCompanies(data.results, data.meta, countDisplay, container);
    } else {
      showToast(data.message || 'Error fetching companies', 'error');
      container.innerHTML = `<div class="col-12 text-center text-danger p-5">${data.message || 'Failed to fetch companies.'}</div>`;
    }
  } catch (error) {
    showToast('Server error while searching companies', 'error');
    container.innerHTML = `<div class="col-12 text-center text-danger p-5">Failed due to network error.</div>`;
  }
}

function renderCompanies(companies, meta, countDisplay, container) {
  container.innerHTML = '';
  
  if (!companies || companies.length === 0) {
    countDisplay.innerHTML = `<span class="text-muted">0 companies found in ${meta?.city || 'this location'}</span>`;
    container.innerHTML = `
      <div class="col-12 text-center text-muted p-5 glass-card mt-3">
        <h5><i class="fas fa-search-minus mb-3" style="font-size: 2rem;"></i></h5>
        <p>No verified IT companies found in <b>${meta?.city || 'this location'}</b>.</p>
        <p class="small">Try searching for a larger neighboring city or check the spelling.</p>
      </div>
    `;
    return;
  }

  countDisplay.innerHTML = `Showing <b>${companies.length}</b> verified IT companies in <b>${meta.city}</b>`;

  companies.forEach((company, index) => {
    const name = company.name || 'Unknown Company';
    const address = company.location.formatted_address || 'Address not specified';
    
    // Use TomTom website if available, otherwise fallback to Google Search
    const websiteUrl = company.website || `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + address)}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + address)}`;
    const distanceKm = (company.distance / 1000).toFixed(1);
    
    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4 mb-4 fade-in';
    card.style.animationDelay = `${index * 0.05}s`;
    
    card.innerHTML = `
      <div class="glass-card h-100 p-4 d-flex flex-column position-relative overflow-hidden">
        <span class="badge bg-light text-primary position-absolute top-0 end-0 m-3 border shadow-sm">
          <i class="fas fa-map-marker-alt me-1"></i> ${distanceKm} km
        </span>
        
        <div class="mb-3 mt-2">
          <h5 class="fw-bold text-primary mb-2">${name}</h5>
          <p class="text-muted small mb-0"><i class="fas fa-location-dot me-2"></i>${address}</p>
        </div>
        
        <div class="mt-auto pt-3 border-top d-flex gap-2">
          <a href="${websiteUrl}" target="_blank" class="btn btn-outline-primary btn-sm flex-grow-1 text-center">
            <i class="fas ${company.website ? 'fa-globe' : 'fa-search'} me-1"></i> ${company.website ? 'Website' : 'Search'}
          </a>
          <a href="${mapsUrl}" target="_blank" class="btn btn-primary btn-sm flex-grow-1 text-center">
            <i class="fas fa-directions me-1"></i> Maps
          </a>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
