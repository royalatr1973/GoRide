/**
 * GoRide Driver App
 */
let socket = null;
let currentRide = null;
let pendingRequest = null;
let requestTimer = null;
let locationWatchId = null;
let locationInterval = null;
let selectedRating = 0;
let ratingRideId = null;
let isOnline = false;

const REQUEST_TIMEOUT = 30; // seconds to accept/reject

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['driver'])) return;
  initApp();
});

function initApp() {
  const user = API.getUser();
  document.getElementById('greeting-text').textContent = `Hello, ${user.profile?.firstName || 'Driver'}`;
  connectSocket();
  loadDashboard();
  loadActiveRides();
}

// === SOCKET.IO ===

function connectSocket() {
  socket = io({ auth: { token: API.getToken() } });

  socket.on('connect', () => {
    // If previously online, re-emit driver_online
    if (isOnline) {
      emitOnline();
    }
  });

  socket.on('status_updated', (data) => {
    updateStatusUI(data.status);
  });

  // Incoming ride request (broadcasted by server to nearby drivers)
  socket.on('ride_request', (data) => {
    if (!isOnline || currentRide) return;
    showRideRequest(data);
  });

  socket.on('ride_confirmed', (data) => {
    pendingRequest = null;
    clearRequestTimer();
    document.getElementById('ride-request-section').style.display = 'none';
    currentRide = data.ride;
    showActiveRide(currentRide);
    showToast('Ride accepted! Navigate to pickup.', 'success');
  });

  socket.on('ride_rejected', () => {
    pendingRequest = null;
    clearRequestTimer();
    document.getElementById('ride-request-section').style.display = 'none';
  });

  socket.on('ride_error', (data) => {
    showToast(data.message, 'error');
  });

  socket.on('ride_cancelled', (data) => {
    showToast('Ride was cancelled', 'error');
    currentRide = null;
    document.getElementById('active-ride-section').style.display = 'none';
    loadDashboard();
  });

  socket.on('ride_status_update', (data) => {
    if (currentRide && currentRide._id === data.rideId) {
      currentRide.status = data.status;
      if (data.status === 'completed') {
        ratingRideId = data.rideId;
        document.getElementById('rating-modal').classList.add('active');
        document.getElementById('active-ride-section').style.display = 'none';
        currentRide = null;
        stopLocationTracking();
        loadDashboard();
      }
    }
  });

  socket.on('chat_message', (data) => {
    if (data.senderType !== 'driver') {
      showToast(`Passenger: ${data.message}`);
    }
  });
}

// === ONLINE / OFFLINE ===

function toggleOnline() {
  const toggle = document.getElementById('online-toggle');
  if (toggle.checked) {
    goOnline();
  } else {
    goOffline();
  }
}

function goOnline() {
  isOnline = true;
  emitOnline();
  startLocationTracking();
  updateStatusUI('available');
  showToast('You are now online', 'success');
}

function emitOnline() {
  getCurrentPosition((pos) => {
    if (socket) {
      socket.emit('driver_online', {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
    }
  });
}

function goOffline() {
  isOnline = false;
  if (socket) socket.emit('driver_offline');
  stopLocationTracking();
  updateStatusUI('offline');
  showToast('You are now offline');
}

function updateStatusUI(status) {
  const dot = document.getElementById('driver-status-indicator');
  const text = document.getElementById('status-text');
  dot.className = 'status-dot ' + status;

  const labels = {
    available: 'You are online',
    busy: 'On a ride',
    offline: 'You are offline'
  };
  text.textContent = labels[status] || 'You are offline';
}

// === LOCATION TRACKING ===

function startLocationTracking() {
  if (navigator.geolocation) {
    locationWatchId = navigator.geolocation.watchPosition(
      (pos) => sendLocationUpdate(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  // Also send periodic updates as a fallback
  locationInterval = setInterval(() => {
    getCurrentPosition((pos) => {
      sendLocationUpdate(pos.coords.latitude, pos.coords.longitude);
    });
  }, 10000);
}

function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
}

function sendLocationUpdate(latitude, longitude) {
  if (socket) {
    socket.emit('location_update', {
      latitude,
      longitude,
      rideId: currentRide?._id
    });
  }
}

function getCurrentPosition(callback) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(callback, () => {
      // Fallback: use a default or previously known location
    }, { enableHighAccuracy: true, timeout: 10000 });
  }
}

// === DASHBOARD ===

async function loadDashboard() {
  try {
    const result = await API.getDriverEarnings();
    const data = result.data;

    document.getElementById('today-rides').textContent = data.today.rides;
    document.getElementById('today-earnings').textContent = formatCurrency(data.today.earnings);
    document.getElementById('avg-rating').textContent = data.averageRating ? data.averageRating.toFixed(1) : '-';
  } catch (err) {
    // Dashboard data not critical
  }
}

async function loadActiveRides() {
  try {
    const result = await API.getDriverActiveRides();
    if (result.data.rides.length > 0) {
      currentRide = result.data.rides[0];
      showActiveRide(currentRide);

      // If there's an active ride, driver should be online
      isOnline = true;
      document.getElementById('online-toggle').checked = true;
      updateStatusUI('busy');

      if (socket) socket.emit('join_ride', { rideId: currentRide._id });
      startLocationTracking();
    }
  } catch (err) {
    // No active rides
  }
}

// === RIDE REQUESTS ===

function showRideRequest(data) {
  pendingRequest = data;

  document.getElementById('req-pickup').textContent = data.pickupLocation?.address || 'Pickup';
  document.getElementById('req-drop').textContent = data.dropLocation?.address || 'Drop';
  document.getElementById('req-fare').textContent = formatCurrency(data.estimatedFare || 0);
  document.getElementById('req-distance').textContent = data.estimatedDistance ? `${data.estimatedDistance} km` : '-';
  document.getElementById('ride-request-section').style.display = 'block';

  // Start countdown timer
  let seconds = REQUEST_TIMEOUT;
  clearRequestTimer();
  document.getElementById('request-timer').textContent = `${seconds}s`;

  requestTimer = setInterval(() => {
    seconds--;
    document.getElementById('request-timer').textContent = `${seconds}s`;
    if (seconds <= 0) {
      rejectRide();
    }
  }, 1000);
}

function clearRequestTimer() {
  if (requestTimer) {
    clearInterval(requestTimer);
    requestTimer = null;
  }
}

function acceptRide() {
  if (!pendingRequest) return;

  const btn = document.getElementById('accept-btn');
  btn.disabled = true;
  btn.textContent = 'Accepting...';

  if (socket) {
    socket.emit('ride_accept', { rideId: pendingRequest.rideId || pendingRequest._id });
  }

  clearRequestTimer();

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Accept';
  }, 3000);
}

function rejectRide() {
  if (!pendingRequest) return;

  if (socket) {
    socket.emit('ride_reject', { rideId: pendingRequest.rideId || pendingRequest._id });
  }

  pendingRequest = null;
  clearRequestTimer();
  document.getElementById('ride-request-section').style.display = 'none';
}

// === ACTIVE RIDE ===

function showActiveRide(ride) {
  document.getElementById('active-ride-section').style.display = 'block';
  document.getElementById('ride-pickup').textContent = ride.pickupLocation?.address || 'Pickup';
  document.getElementById('ride-drop').textContent = ride.dropLocation?.address || 'Drop';
  document.getElementById('ride-fare').textContent = formatCurrency(ride.estimatedFare || ride.fare?.totalFare || 0);
  updateRideStatusBadge(ride.status);
  renderRideActions(ride.status);

  // Passenger info
  const passenger = ride.passengerId;
  if (passenger && typeof passenger === 'object') {
    const name = passenger.profile
      ? `${passenger.profile.firstName || ''} ${passenger.profile.lastName || ''}`.trim()
      : 'Passenger';
    document.getElementById('passenger-name').textContent = name;
    document.getElementById('passenger-phone').textContent = passenger.phone || '';
    document.getElementById('passenger-avatar').textContent = name.charAt(0).toUpperCase();
  }

  if (socket) socket.emit('join_ride', { rideId: ride._id });
}

function updateRideStatusBadge(status) {
  const badge = document.getElementById('ride-status-badge');
  badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  badge.className = `badge badge-${status}`;
}

function renderRideActions(status) {
  const container = document.getElementById('ride-actions');

  switch (status) {
    case 'accepted':
      container.innerHTML = `
        <button class="btn btn-primary" onclick="updateRideStatus('arriving')">Arriving at Pickup</button>
        <button class="btn btn-danger btn-sm" onclick="cancelCurrentRide()">Cancel Ride</button>
      `;
      break;
    case 'arriving':
      container.innerHTML = `
        <button class="btn btn-primary" onclick="updateRideStatus('started')">Start Ride</button>
        <button class="btn btn-danger btn-sm" onclick="cancelCurrentRide()">Cancel Ride</button>
      `;
      break;
    case 'started':
      container.innerHTML = `
        <button class="btn btn-secondary" onclick="updateRideStatus('completed')">Complete Ride</button>
      `;
      break;
    default:
      container.innerHTML = '';
  }
}

function updateRideStatus(status) {
  if (!currentRide || !socket) return;

  socket.emit('ride_status', {
    rideId: currentRide._id,
    status
  });

  currentRide.status = status;
  updateRideStatusBadge(status);
  renderRideActions(status);

  if (status === 'completed') {
    ratingRideId = currentRide._id;
    document.getElementById('rating-modal').classList.add('active');
    document.getElementById('active-ride-section').style.display = 'none';
    currentRide = null;
    stopLocationTracking();
    updateStatusUI('available');
    loadDashboard();
  }
}

function cancelCurrentRide() {
  if (!currentRide || !socket) return;

  socket.emit('ride_cancel', {
    rideId: currentRide._id,
    reason: 'Cancelled by driver'
  });

  currentRide = null;
  document.getElementById('active-ride-section').style.display = 'none';
  updateStatusUI('available');
  showToast('Ride cancelled');
}

// === PAGES ===

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));

  document.getElementById(`page-${page}`).style.display = 'block';
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'earnings') loadEarnings();
  if (page === 'history') loadRideHistory();
  if (page === 'profile') loadProfile();
}

// === EARNINGS ===

async function loadEarnings() {
  try {
    const result = await API.getDriverEarnings();
    const data = result.data;

    document.getElementById('week-earnings').textContent = formatCurrency(data.thisWeek.earnings);
    document.getElementById('month-earnings').textContent = formatCurrency(data.thisMonth.earnings);
    document.getElementById('week-rides').textContent = data.thisWeek.rides;
    document.getElementById('month-rides').textContent = data.thisMonth.rides;
    document.getElementById('total-rides').textContent = data.totalRides;
  } catch (err) {
    showToast('Failed to load earnings', 'error');
  }
}

// === RIDE HISTORY ===

async function loadRideHistory() {
  try {
    const result = await API.getDriverRides({ limit: 50 });
    const container = document.getElementById('ride-history-list');

    if (result.data.rides.length === 0) {
      container.innerHTML = '<p class="text-gray">No ride history yet</p>';
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
            <span class="text-sm">${ride.pickupLocation?.address || '-'}</span>
          </div>
          <div class="location-item">
            <div class="location-dot drop"></div>
            <span class="text-sm">${ride.dropLocation?.address || '-'}</span>
          </div>
        </div>
        <div class="ride-info">
          <span class="text-sm">${ride.distance ? ride.distance + ' km' : '-'}</span>
          <strong>${formatCurrency(ride.fare?.totalFare || ride.estimatedFare || 0)}</strong>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('ride-history-list').innerHTML = '<p class="text-sm text-gray">Unable to load history</p>';
  }
}

// === PROFILE ===

async function loadProfile() {
  try {
    const [profileResult, driverResult] = await Promise.all([
      API.getProfile(),
      API.getDriverProfile()
    ]);

    const user = profileResult.data.user;
    const driver = driverResult.data.driver;

    document.getElementById('profile-content').innerHTML = `
      <div class="card">
        <div class="flex gap-16">
          <div class="passenger-avatar">${user.profile.firstName[0]}</div>
          <div>
            <h3>${user.profile.firstName} ${user.profile.lastName}</h3>
            <p class="text-sm text-gray">${user.email}</p>
            <p class="text-sm text-gray">${user.phone}</p>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Driver Details</h3>
        <div class="flex-between mt-8">
          <span class="text-gray">License</span>
          <span>${driver.licenseNumber}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">License Expiry</span>
          <span>${formatDate(driver.licenseExpiry)}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">Verified</span>
          <span>${driver.isVerified ? 'Yes' : 'Pending'}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">Rating</span>
          <span>${driver.rating.averageRating ? driver.rating.averageRating.toFixed(1) + '/5' : 'No ratings'}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">Completed Rides</span>
          <span>${driver.rating.completedRides}</span>
        </div>
      </div>
      ${driver.vehicleId ? `
      <div class="card">
        <h3>Vehicle</h3>
        <div class="flex-between mt-8">
          <span class="text-gray">Type</span>
          <span>${driver.vehicleId.type || '-'}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">Make / Model</span>
          <span>${driver.vehicleId.make || ''} ${driver.vehicleId.model || ''}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">Plate</span>
          <span>${driver.vehicleId.licensePlate || '-'}</span>
        </div>
        <div class="flex-between mt-8">
          <span class="text-gray">Color</span>
          <span>${driver.vehicleId.color || '-'}</span>
        </div>
      </div>` : '<div class="card"><p class="text-gray">No vehicle assigned</p></div>'}
      <button class="btn btn-danger mt-16" onclick="handleLogout()">Logout</button>
    `;
  } catch (err) {
    document.getElementById('profile-content').innerHTML = '<p class="text-sm text-gray">Unable to load profile</p>';
  }
}

// === RATING ===

function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('#rating-stars .star').forEach((s, i) => {
    s.classList.toggle('active', i < n);
  });
}

async function submitRating() {
  if (!selectedRating || !ratingRideId) return;

  try {
    await API.ratePassenger(ratingRideId, {
      rating: selectedRating,
      review: document.getElementById('rating-review').value
    });

    showToast('Rating submitted!', 'success');
    document.getElementById('rating-modal').classList.remove('active');
    selectedRating = 0;
    ratingRideId = null;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// === AUTH ===

function handleLogout() {
  if (isOnline) goOffline();
  API.logout().catch(() => {});
  API.clearTokens();
  if (socket) socket.disconnect();
  window.location.href = '/passenger/index.html';
}
