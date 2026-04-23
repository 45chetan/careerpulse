const API_URL = 'http://localhost:5000/api';
let isLoginMode = true;
let applications = [];
let deleteAppId = null;
let currentAppModal = null;
let currentDeleteModal = null;
let applyConfirmModal = null;

document.addEventListener('DOMContentLoaded', () => {
  // Init Modals
  const appModalEl = document.getElementById('appModal');
  if (appModalEl) currentAppModal = new bootstrap.Modal(appModalEl);
  
  const deleteModalEl = document.getElementById('deleteModal');
  if (deleteModalEl) currentDeleteModal = new bootstrap.Modal(deleteModalEl);

  const applyConfirmModalEl = document.getElementById('applyConfirmModal');
  if (applyConfirmModalEl) applyConfirmModal = new bootstrap.Modal(applyConfirmModalEl);

  const applyConfirmYesBtn = document.getElementById('applyConfirmYesBtn');
  if (applyConfirmYesBtn) {
    applyConfirmYesBtn.addEventListener('click', handleApplyConfirmYes);
  }

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

  // Auth Page Logic
  const authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', handleAuth);
    document.getElementById('toggleAuth').addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = !isLoginMode;
      document.getElementById('authBtn').innerText = isLoginMode ? 'Login' : 'Sign Up';
      e.target.innerText = isLoginMode ? 'Need an account? Sign up' : 'Already have an account? Login';
    });
  }

  // Dashboard / General Page Logic
  const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('dropdownLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      window.location.href = 'index.html';
    });
  }

  const appForm = document.getElementById('appForm');
  if (appForm) {
    appForm.addEventListener('submit', handleSaveApplication);
  }

  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDelete);
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', renderApplications);
  }

  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', renderApplications);
  }

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  const addAppBtn = document.getElementById('addAppBtn');
  if (addAppBtn) {
    addAppBtn.addEventListener('click', () => {
      document.getElementById('appId').value = '';
      document.getElementById('appForm').reset();
      document.getElementById('date').valueAsDate = new Date();
      document.getElementById('modalTitle').innerText = 'Add Application';
    });
  }
});

function showToast(message, type = 'success') {
  const toastEl = document.getElementById('appToast');
  const toastMessage = document.getElementById('toastMessage');
  toastEl.classList.remove('text-bg-primary', 'text-bg-danger', 'text-bg-success');
  
  if (type === 'error') toastEl.classList.add('text-bg-danger');
  else if (type === 'success') toastEl.classList.add('text-bg-success');
  else toastEl.classList.add('text-bg-primary');

  toastMessage.innerText = message;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (show) loading.classList.remove('hidden');
  else loading.classList.add('hidden');
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const endpoint = isLoginMode ? '/auth/login' : '/auth/signup';

  showLoading(true);
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    showLoading(false);

    if (res.ok) {
      localStorage.setItem('token', data.token);
      showToast('Authentication successful!');
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } else {
      showToast(data.message || 'Authentication failed', 'error');
    }
  } catch (error) {
    showLoading(false);
    showToast('Server error', 'error');
  }
}

async function loadApplications() {
  const token = localStorage.getItem('token');
  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/applications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = 'index.html';
      return;
    }
    const data = await res.json();
    if (res.ok) {
      applications = data;
      renderApplications();
      updateStats();
    }
  } catch (error) {
    showToast('Failed to load applications', 'error');
  }
  showLoading(false);
}

function renderApplications() {
  const tbody = document.getElementById('appsTableBody');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;
  
  tbody.innerHTML = '';

  const filtered = applications.filter(app => {
    const matchesSearch = app.companyName.toLowerCase().includes(search) || app.role.toLowerCase().includes(search);
    const matchesStatus = statusFilter ? app.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    document.getElementById('noDataMsg').classList.remove('hidden');
    document.getElementById('appsTable').classList.add('hidden');
  } else {
    document.getElementById('noDataMsg').classList.add('hidden');
    document.getElementById('appsTable').classList.remove('hidden');

    filtered.forEach(app => {
      const tr = document.createElement('tr');
      const dateStr = new Date(app.date).toLocaleDateString();
      let statusBadge = 'bg-secondary';
      if (app.status === 'Applied') statusBadge = 'bg-primary';
      else if (app.status === 'Interview') statusBadge = 'bg-warning text-dark';
      else if (app.status === 'Rejected') statusBadge = 'bg-danger';
      else if (app.status === 'Offer') statusBadge = 'bg-success';

      tr.innerHTML = `
        <td class="fw-bold">${app.companyName}</td>
        <td>${app.role}</td>
        <td>${dateStr}</td>
        <td><span class="badge ${statusBadge}">${app.status}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-2" onclick="editApp('${app._id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAppPrompt('${app._id}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function updateStats() {
  document.getElementById('statTotal').innerText = applications.length;
  document.getElementById('statInterviews').innerText = applications.filter(a => a.status === 'Interview').length;
  document.getElementById('statOffers').innerText = applications.filter(a => a.status === 'Offer').length;
}

async function handleSaveApplication(e) {
  e.preventDefault();
  const id = document.getElementById('appId').value;
  const companyName = document.getElementById('companyName').value;
  const role = document.getElementById('role').value;
  const date = document.getElementById('date').value;
  const status = document.getElementById('status').value;
  const notes = document.getElementById('notes').value;
  
  const token = localStorage.getItem('token');
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_URL}/applications/${id}` : `${API_URL}/applications`;

  showLoading(true);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ companyName, role, date, status, notes })
    });
    
    if (res.ok) {
      showToast(id ? 'Application updated' : 'Application added');
      currentAppModal.hide();
      loadApplications();
    } else {
      const data = await res.json();
      showToast(data.message || 'Error saving application', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}

window.editApp = function(id) {
  const app = applications.find(a => a._id === id);
  if (!app) return;
  
  document.getElementById('appId').value = app._id;
  document.getElementById('companyName').value = app.companyName;
  document.getElementById('role').value = app.role;
  document.getElementById('date').value = app.date.split('T')[0];
  document.getElementById('status').value = app.status;
  document.getElementById('notes').value = app.notes;
  
  document.getElementById('modalTitle').innerText = 'Edit Application';
  currentAppModal.show();
};

window.deleteAppPrompt = function(id) {
  deleteAppId = id;
  currentDeleteModal.show();
};

async function confirmDelete() {
  if (!deleteAppId) return;
  const token = localStorage.getItem('token');
  
  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/applications/${deleteAppId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      showToast('Application deleted');
      currentDeleteModal.hide();
      loadApplications();
    } else {
      showToast('Error deleting application', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}

function exportToCSV() {
  if (applications.length === 0) return showToast('No data to export', 'error');
  
  const headers = ['Company', 'Role', 'Date', 'Status', 'Notes'];
  const rows = applications.map(app => [
    `"${app.companyName}"`,
    `"${app.role}"`,
    `"${new Date(app.date).toLocaleDateString()}"`,
    `"${app.status}"`,
    `"${app.notes.replace(/"/g, '""')}"`
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'applications.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.openApplyConfirmModal = function(companyName, role) {
  document.getElementById('applyConfirmCompany').value = companyName;
  document.getElementById('applyConfirmRole').value = role;
  if (applyConfirmModal) {
    applyConfirmModal.show();
  }
};

async function handleApplyConfirmYes() {
  const companyName = document.getElementById('applyConfirmCompany').value;
  const role = document.getElementById('applyConfirmRole').value;
  const token = localStorage.getItem('token');
  
  if (!token) return;

  showLoading(true);
  try {
    const resGet = await fetch(`${API_URL}/applications`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (resGet.ok) {
      const apps = await resGet.json();
      const isDuplicate = apps.some(a => a.companyName.toLowerCase() === companyName.toLowerCase() && a.role.toLowerCase() === role.toLowerCase());
      
      if (isDuplicate) {
        showLoading(false);
        if (applyConfirmModal) applyConfirmModal.hide();
        showToast('Already added to tracker', 'primary');
        return;
      }
    }
    
    const date = new Date().toISOString().split('T')[0];
    const status = 'Applied';
    const notes = 'Applied via Find Jobs / Saved Jobs';

    const resPost = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ companyName, role, date, status, notes })
    });
    
    if (resPost.ok) {
      if (applyConfirmModal) applyConfirmModal.hide();
      showToast('Application added to tracker ✅', 'success');
    } else {
      const data = await resPost.json();
      showToast(data.message || 'Error saving application', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}
