/**
 * GoRide Passenger App
 */
let socket = null;
let currentRide = null;
let selectedRating = 0;
let ratingRideId = null;

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
  const user = API.getUser();
  if (user && API.getToken()) {
    showApp();
  }

  // Toggle driver/operator fields on registration
  const userTypeSelect = document.getElementById('reg-usertype');
  if (userTypeSelect) {
    userTypeSelect.addEventListener('change', (e) => {
      document.getElementById('driver-fields').style.display = e.target.value === 'driver' ? 'block' : 'none';
      document.getElementById('operator-fields').style.display = e.target.value === 'operator' ? 'block' : 'none';
    });
  }
});

// === AUTH ===

function toggleAuth(view) {
  document.getElementById('login-form').style.display = view === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = view === 'register' ? 'block' : 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const result = await API.login({
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    });

    API.setTokens(result.data.accessToken, result.data.refreshToken);
    API.setUser(result.data.user);

    // Redirect based on user type
    const userType = result.data.user.userType;
    if (userType === 'driver') {
      window.location.href = '/driver/index.html';
      return;
    } else if (userType === 'operator') {
      window.location.href = '/operator/index.html';
      return;
    }

    showApp();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  try {
    const userType = document.getElementById('reg-usertype').value;
    const data = {
      email: document.getElementById('reg-email').value,
      phone: document.getElementById('reg-phone').value,
      password: document.getElementById('reg-password').value,
      firstName: document.getElementById('reg-firstname').value,
      lastName: document.getElementById('reg-lastname').value,
      userType
    };

    if (userType === 'driver') {
      data.licenseNumber = document.getElementById('reg-license').value;
      data.licenseExpiry = document.getElementById('reg-license-expiry').value;
    }
    if (userType === 'operator') {
      data.companyName = document.getElementById('reg-company').value;
    }

    const result = await API.register(data);
    API.setTokens(result.data.accessToken, result.data.refreshToken);
    API.setUser(result.data.user);

    if (userType === 'driver') {
      window.location.href = '/driver/index.html';
      return;
    } else if (userType === 'operator') {
      window.location.href = '/operator/index.html';
      return;
    }

    showToast('Account created!', 'success');
    showApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleLogout() {
  API.logout().catch(() => {});
  API.clearTokens();
  if (socket) socket.disconnect();
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('app-section').style.display = 'none';
}

// === APP ===

function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';

  const user = API.getUser();
  document.getElementById('user-greeting').textContent = `Hi, ${user.profile?.firstName || 'User'}`;

  connectSocket();
  loadActiveRides();
  loadRecentRides();
}

// === SOCKET.IO ===

function connectSocket() {
  socket = io({ auth: { token: API.getToken() } });

  socket.on('connect', () => {
    socket.emit('passenger_connect');
  });

  socket.on('ride_accepted', (data) => {
    showToast('Driver found! Your ride has been accepted.', 'success');
    if (currentRide) {
      currentRide.status = 'accepted';
      updateRideUI(data);
    }
    loadActiveRides();
  });

  socket.on('ride_status_update', (data) => {
    if (currentRide && currentRide._id === data.rideId) {
      currentRide.status = data.status;
      updateStatusBadge(data.status);

      if (data.status === 'completed') {
        showToast('Ride completed!', 'success');
        ratingRideId = data.rideId;
        document.getElementById('rating-modal').classList.add('active');
        document.getElementById('active-ride-section').style.display = 'none';
        currentRide = null;
        loadRecentRides();
      }
    }
  });

  socket.on('driver_location', (data) => {
    // Update driver location on map (placeholder for Google Maps integration)
    const mapEl = document.getElementById('tracking-map');
    mapEl.innerHTML = `<div class="flex-center" style="height:100%; flex-direction:column">
      <p>Driver Location</p>
      <p class="text-sm text-gray">Lat: ${data.latitude.toFixed(4)}, Lng: ${data.longitude.toFixed(4)}</p>
    </div>`;
  });

  socket.on('ride_cancelled', (data) => {
    showToast('Ride has been cancelled', 'error');
    document.getElementById('active-ride-section').style.display = 'none';
    currentRide = null;
  });

  socket.on('chat_message', (data) => {
    if (data.senderType !== 'passenger') {
      showToast(`Driver: ${data.message}`);
    }
  });
}

// === BOOKING ===

async function getFareEstimate() {
  const pickupLat = document.getElementById('pickup-lat').value;
  const pickupLng = document.getElementById('pickup-lng').value;
  const dropLat = document.getElementById('drop-lat').value;
  const dropLng = document.getElementById('drop-lng').value;

  if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
    showToast('Please enter all coordinates', 'error');
    return;
  }

  try {
    const result = await API.getFareEstimate({
      pickupLat, pickupLng, dropLat, dropLng,
      vehicleType: document.getElementById('vehicle-type').value
    });

    const fare = result.data.fare;
    document.getElementById('fare-estimate').style.display = 'block';
    document.getElementById('est-distance').textContent = `${fare.distance} km`;
    document.getElementById('est-duration').textContent = `${fare.duration} min`;
    document.getElementById('est-fare').textContent = formatCurrency(fare.totalFare);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function bookRide() {
  const pickupLat = parseFloat(document.getElementById('pickup-lat').value);
  const pickupLng = parseFloat(document.getElementById('pickup-lng').value);
  const dropLat = parseFloat(document.getElementById('drop-lat').value);
  const dropLng = parseFloat(document.getElementById('drop-lng').value);

  if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
    showToast('Please enter all coordinates', 'error');
    return;
  }

  const btn = document.getElementById('book-btn');
  btn.disabled = true;
  btn.textContent = 'Searching for drivers...';

  try {
    const result = await API.createRide({
      pickupLocation: {
        address: document.getElementById('pickup-address').value || 'Pickup Location',
        latitude: pickupLat,
        longitude: pickupLng
      },
      dropLocation: {
        address: document.getElementById('drop-address').value || 'Drop Location',
        latitude: dropLat,
        longitude: dropLng
      },
      vehicleType: document.getElementById('vehicle-type').value,
      paymentMethod: document.getElementById('payment-method').value
    });

    currentRide = result.data.ride;
    showToast(`Ride requested! Searching ${result.data.nearbyDrivers} nearby drivers...`);

    // Join ride room
    if (socket) socket.emit('join_ride', { rideId: currentRide._id });

    showActiveRide(currentRide);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Book Ride';
  }
}

function cancelRide() {
  if (!currentRide) return;

  if (socket) {
    socket.emit('ride_cancel', { rideId: currentRide._id, reason: 'Cancelled by passenger' });
  }

  document.getElementById('active-ride-section').style.display = 'none';
  currentRide = null;
  showToast('Ride cancelled');
}

// === UI HELPERS ===

function showActiveRide(ride) {
  document.getElementById('active-ride-section').style.display = 'block';
  document.getElementById('ride-pickup').textContent = ride.pickupLocation.address;
  document.getElementById('ride-drop').textContent = ride.dropLocation.address;
  document.getElementById('ride-fare').textContent = formatCurrency(ride.estimatedFare || ride.fare?.totalFare || 0);
  updateStatusBadge(ride.status);

  if (ride.status === 'requested') {
    document.getElementById('ride-driver-info').style.display = 'none';
  }
}

function updateRideUI(data) {
  if (data.driver) {
    document.getElementById('ride-driver-info').style.display = 'flex';
    document.getElementById('driver-name').textContent = data.driver.name || 'Your Driver';
    document.getElementById('driver-rating').textContent = `Rating: ${data.driver.rating?.averageRating || '-'}/5`;
  }
}

function updateStatusBadge(status) {
  const badge = document.getElementById('ride-status-badge');
  badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  badge.className = `badge badge-${status}`;

  // Hide cancel button for completed/cancelled
  const cancelBtn = document.getElementById('cancel-ride-btn');
  cancelBtn.style.display = ['completed', 'cancelled'].includes(status) ? 'none' : 'block';
}

async function loadActiveRides() {
  try {
    const result = await API.getActiveRides();
    if (result.data.rides.length > 0) {
      currentRide = result.data.rides[0];
      showActiveRide(currentRide);
      if (socket) socket.emit('join_ride', { rideId: currentRide._id });
    }
  } catch (err) {
    // No active rides
  }
}

async function loadRecentRides() {
  try {
    const result = await API.getPassengerRides({ limit: 5 });
    const container = document.getElementById('recent-rides');

    if (result.data.rides.length === 0) {
      container.innerHTML = '<p class="text-gray text-sm mt-8">No rides yet. Book your first ride!</p>';
      return;
    }

    container.innerHTML = result.data.rides.map(ride => `
      <div class="card ride-card">
        <div class="locations">
          <div class="location-item">
            <div class="location-dot pickup"></div>
            <span class="text-sm">${ride.pickupLocation.address}</span>
          </div>
          <div class="location-item">
            <div class="location-dot drop"></div>
            <span class="text-sm">${ride.dropLocation.address}</span>
          </div>
        </div>
        <div class="ride-info">
          <span class="text-sm text-gray">${formatDate(ride.createdAt)}</span>
          <span class="badge badge-${ride.status}">${ride.status}</span>
          <strong>${formatCurrency(ride.fare?.totalFare || ride.estimatedFare || 0)}</strong>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('recent-rides').innerHTML = '<p class="text-sm text-gray">Unable to load rides</p>';
  }
}

// === PAGES ===

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));

  document.getElementById(`page-${page}`).style.display = 'block';
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'history') loadRideHistory();
  if (page === 'profile') loadProfile();
}

async function loadRideHistory() {
  try {
    const result = await API.getPassengerRides({ limit: 50 });
    const container = document.getElementById('ride-history-list');

    if (result.data.rides.length === 0) {
      container.innerHTML = '<p class="text-gray">No ride history</p>';
      return;
    }

    container.innerHTML = result.data.rides.map(ride => `
      <div class="card ride-card">
        <div class="flex-between">
          <span class="text-sm text-gray">${formatDate(ride.createdAt)} ${formatTime(ride.createdAt)}</span>
          <span class="badge badge-${ride.status}">${ride.status}</span>
        </div>
        <div class="locations mt-8">
          <div class="location-item">
            <div class="location-dot pickup"></div>
            <span class="text-sm">${ride.pickupLocation.address}</span>
          </div>
          <div class="location-item">
            <div class="location-dot drop"></div>
            <span class="text-sm">${ride.dropLocation.address}</span>
          </div>
        </div>
        <div class="ride-info">
          <span class="text-sm">${ride.distance ? ride.distance + ' km' : '-'}</span>
          <strong>${formatCurrency(ride.fare?.totalFare || ride.estimatedFare || 0)}</strong>
        </div>
        ${ride.status === 'completed' && !ride.driverRating?.score ? `<button class="btn btn-outline btn-sm mt-8" onclick="openRating('${ride._id}')">Rate Ride</button>` : ''}
      </div>
    `).join('');
  } catch (err) {
    showToast('Failed to load history', 'error');
  }
}

async function loadProfile() {
  try {
    const result = await API.getProfile();
    const user = result.data.user;
    document.getElementById('profile-content').innerHTML = `
      <div class="card">
        <div class="flex gap-16">
          <div class="driver-avatar">${user.profile.firstName[0]}</div>
          <div>
            <h3>${user.profile.firstName} ${user.profile.lastName}</h3>
            <p class="text-sm text-gray">${user.email}</p>
            <p class="text-sm text-gray">${user.phone}</p>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Account Type</h3>
        <p class="mt-8">${user.userType.charAt(0).toUpperCase() + user.userType.slice(1)}</p>
      </div>
      <div class="card">
        <h3>Emergency Contact</h3>
        <p class="mt-8 text-sm text-gray">${user.emergencyContact?.name || 'Not set'}</p>
        <p class="text-sm text-gray">${user.emergencyContact?.phone || ''}</p>
      </div>
      <button class="btn btn-danger mt-16" onclick="handleLogout()">Logout</button>
    `;
  } catch (err) {
    showToast('Failed to load profile', 'error');
  }
}

// === RATING ===

function openRating(rideId) {
  ratingRideId = rideId;
  selectedRating = 0;
  document.querySelectorAll('#rating-stars .star').forEach(s => s.classList.remove('active'));
  document.getElementById('rating-review').value = '';
  document.getElementById('rating-modal').classList.add('active');
}

function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('#rating-stars .star').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}

async function submitRating() {
  if (!selectedRating || !ratingRideId) return;

  try {
    await API.rateRide(ratingRideId, {
      rating: selectedRating,
      review: document.getElementById('rating-review').value
    });

    showToast('Rating submitted!', 'success');
    document.getElementById('rating-modal').classList.remove('active');
    loadRecentRides();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
