/**
 * GoRide API Client - Shared across all frontends
 */
const API = {
  baseUrl: '/api/v1',

  getToken() {
    return localStorage.getItem('goride_token');
  },

  getRefreshToken() {
    return localStorage.getItem('goride_refresh_token');
  },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem('goride_token', accessToken);
    if (refreshToken) localStorage.setItem('goride_refresh_token', refreshToken);
  },

  clearTokens() {
    localStorage.removeItem('goride_token');
    localStorage.removeItem('goride_refresh_token');
    localStorage.removeItem('goride_user');
  },

  getUser() {
    const user = localStorage.getItem('goride_user');
    return user ? JSON.parse(user) : null;
  },

  setUser(user) {
    localStorage.setItem('goride_user', JSON.stringify(user));
  },

  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const token = this.getToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    let response = await fetch(url, options);

    // Token expired - try refresh
    if (response.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        options.headers['Authorization'] = `Bearer ${this.getToken()}`;
        response = await fetch(url, options);
      } else {
        this.clearTokens();
        window.location.href = '/passenger/index.html';
        return;
      }
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return result;
  },

  async refreshToken() {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.getRefreshToken() })
      });

      if (!response.ok) return false;

      const result = await response.json();
      this.setTokens(result.data.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  // Auth
  register: (data) => API.request('POST', '/auth/register', data),
  login: (data) => API.request('POST', '/auth/login', data),
  logout: () => API.request('POST', '/auth/logout'),
  getProfile: () => API.request('GET', '/auth/profile'),
  updateProfile: (data) => API.request('PUT', '/auth/profile', data),

  // Rides
  createRide: (data) => API.request('POST', '/rides', data),
  getRide: (id) => API.request('GET', `/rides/${id}`),
  acceptRide: (id) => API.request('POST', `/rides/${id}/accept`),
  updateRideStatus: (id, data) => API.request('PUT', `/rides/${id}/status`, data),
  getFareEstimate: (params) => API.request('GET', `/rides/fare-estimate?${new URLSearchParams(params)}`),
  getNearbyDrivers: (params) => API.request('GET', `/rides/nearby-drivers?${new URLSearchParams(params)}`),

  // Passenger
  getPassengerRides: (params) => API.request('GET', `/passengers/rides?${new URLSearchParams(params || {})}`),
  getActiveRides: () => API.request('GET', '/passengers/active-rides'),
  rateRide: (rideId, data) => API.request('POST', `/passengers/rides/${rideId}/rate`, data),

  // Driver
  getDriverProfile: () => API.request('GET', '/drivers/profile'),
  updateDriverStatus: (data) => API.request('PUT', '/drivers/status', data),
  updateDriverLocation: (data) => API.request('PUT', '/drivers/location', data),
  getDriverActiveRides: () => API.request('GET', '/drivers/active-rides'),
  getDriverRides: (params) => API.request('GET', `/drivers/rides?${new URLSearchParams(params || {})}`),
  getDriverEarnings: () => API.request('GET', '/drivers/earnings'),
  ratePassenger: (rideId, data) => API.request('POST', `/drivers/rides/${rideId}/rate`, data),

  // Operator
  getOperatorDashboard: () => API.request('GET', '/operators/dashboard'),
  getOperatorDrivers: () => API.request('GET', '/operators/drivers'),
  addOperatorDriver: (data) => API.request('POST', '/operators/drivers', data),
  getOperatorRides: (params) => API.request('GET', `/operators/rides?${new URLSearchParams(params || {})}`),
  getOperatorEarnings: (params) => API.request('GET', `/operators/earnings?${new URLSearchParams(params || {})}`),

  // Vehicles
  addVehicle: (data) => API.request('POST', '/vehicles', data),
  getVehicles: () => API.request('GET', '/vehicles'),
  updateVehicle: (id, data) => API.request('PUT', `/vehicles/${id}`, data),
  deleteVehicle: (id) => API.request('DELETE', `/vehicles/${id}`),
  assignDriver: (vehicleId, data) => API.request('POST', `/vehicles/${vehicleId}/assign-driver`, data)
};

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return `₹${Math.round(amount)}`;
}

/**
 * Format date
 */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

/**
 * Format time
 */
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Check if user is logged in
 */
function requireAuth(allowedTypes = []) {
  const user = API.getUser();
  const token = API.getToken();

  if (!user || !token) {
    window.location.href = '/passenger/index.html';
    return false;
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(user.userType)) {
    window.location.href = `/${user.userType}/index.html`;
    return false;
  }

  return true;
}
