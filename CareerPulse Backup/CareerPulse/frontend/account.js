document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  
  const accountForm = document.getElementById('accountForm');
  if (accountForm) {
    accountForm.addEventListener('submit', handleUpdateProfile);
  }
});

async function loadProfile() {
  const token = localStorage.getItem('token');
  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('accEmail').value = data.email || '';
      document.getElementById('accName').value = data.name || '';
      document.getElementById('accRole').value = data.preferredRole || '';
    } else {
      showToast('Error loading profile', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const name = document.getElementById('accName').value;
  const preferredRole = document.getElementById('accRole').value;
  const password = document.getElementById('accPassword').value;

  const payload = { name, preferredRole };
  if (password) payload.password = password;

  showLoading(true);
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      showToast('Profile updated successfully!', 'success');
      document.getElementById('accPassword').value = '';
    } else {
      showToast('Failed to update profile', 'error');
    }
  } catch (error) {
    showToast('Server error', 'error');
  }
  showLoading(false);
}
