/**
 * GoRide Operator App
 */
let currentRidesPage = 1;
let assignVehicleId = null;
let cachedDrivers = [];

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth(['operator'])) return;
  loadDashboard();
});

// === NAVIGATION ===

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));

  document.getElementById(`page-${page}`).style.display = 'block';
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'drivers') loadDrivers();
  if (page === 'vehicles') loadVehicles();
  if (page === 'rides') loadRides();
  if (page === 'earnings') loadEarnings('today');
}

// === DASHBOARD ===

async function loadDashboard() {
  try {
    const result = await API.getOperatorDashboard();
    const { operator, stats } = result.data;

    document.getElementById('company-name').textContent = operator.companyName || 'Dashboard';
    document.getElementById('company-plan').textContent = operator.subscription?.plan
      ? `${operator.subscription.plan.charAt(0).toUpperCase() + operator.subscription.plan.slice(1)} Plan`
      : '';

    document.getElementById('stat-total-drivers').textContent = stats.totalDrivers;
    document.getElementById('stat-active-drivers').textContent = stats.activeDrivers;
    document.getElementById('stat-total-vehicles').textContent = stats.totalVehicles;
    document.getElementById('stat-active-vehicles').textContent = stats.activeVehicles;
    document.getElementById('stat-total-rides').textContent = stats.totalRides;
    document.getElementById('stat-today-rides').textContent = stats.todayRides;
    document.getElementById('stat-today-revenue').textContent = formatCurrency(stats.todayRevenue);
  } catch (err) {
    showToast('Failed to load dashboard', 'error');
  }
}

// === DRIVERS ===

async function loadDrivers() {
  try {
    const result = await API.getOperatorDrivers();
    cachedDrivers = result.data.drivers;
    const container = document.getElementById('drivers-list');

    if (cachedDrivers.length === 0) {
      container.innerHTML = '<p class="text-gray">No drivers yet. Add your first driver.</p>';
      return;
    }

    container.innerHTML = cachedDrivers.map(driver => {
      const user = driver.userId;
      const name = user?.profile
        ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
        : 'Unknown';
      const initial = name.charAt(0).toUpperCase();

      return `
        <div class="entity-card">
          <div class="entity-header">
            <div class="flex gap-8">
              <div class="entity-avatar driver-av">${initial}</div>
              <div>
                <strong>${name}</strong>
                <div class="text-sm text-gray">${user?.email || ''}</div>
              </div>
            </div>
            <span class="badge badge-${driver.status === 'available' ? 'started' : driver.status === 'busy' ? 'accepted' : 'cancelled'}">${driver.status}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Phone</span>
            <span>${user?.phone || '-'}</span>
          </div>
          <div class="entity-detail">
            <span class="label">License</span>
            <span>${driver.licenseNumber}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Rating</span>
            <span>${driver.rating?.averageRating ? driver.rating.averageRating.toFixed(1) + '/5' : 'No ratings'}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Rides</span>
            <span>${driver.rating?.completedRides || 0}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Vehicle</span>
            <span>${driver.vehicleId ? `${driver.vehicleId.make} ${driver.vehicleId.model} (${driver.vehicleId.registrationNumber})` : 'Not assigned'}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Verified</span>
            <span>${driver.isVerified ? 'Yes' : 'Pending'}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('drivers-list').innerHTML = '<p class="text-sm text-gray">Unable to load drivers</p>';
  }
}

function openAddDriverModal() {
  document.getElementById('add-driver-modal').classList.add('active');
}

async function handleAddDriver(e) {
  e.preventDefault();
  const btn = document.getElementById('add-driver-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    await API.addOperatorDriver({
      firstName: document.getElementById('drv-firstname').value,
      lastName: document.getElementById('drv-lastname').value,
      email: document.getElementById('drv-email').value,
      phone: document.getElementById('drv-phone').value,
      password: document.getElementById('drv-password').value,
      licenseNumber: document.getElementById('drv-license').value,
      licenseExpiry: document.getElementById('drv-license-expiry').value
    });

    showToast('Driver added successfully!', 'success');
    closeModal('add-driver-modal');
    e.target.reset();
    loadDrivers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Driver';
  }
}

// === VEHICLES ===

async function loadVehicles() {
  try {
    const result = await API.getVehicles();
    const vehicles = result.data.vehicles;
    const container = document.getElementById('vehicles-list');

    if (vehicles.length === 0) {
      container.innerHTML = '<p class="text-gray">No vehicles yet. Add your first vehicle.</p>';
      return;
    }

    container.innerHTML = vehicles.map(vehicle => {
      const driverInfo = vehicle.driverId?.userId?.profile;
      const driverName = driverInfo
        ? `${driverInfo.firstName || ''} ${driverInfo.lastName || ''}`.trim()
        : null;

      return `
        <div class="entity-card">
          <div class="entity-header">
            <div class="flex gap-8">
              <div class="entity-avatar vehicle-av">${vehicle.vehicleType.charAt(0).toUpperCase()}</div>
              <div>
                <strong>${vehicle.make} ${vehicle.model}</strong>
                <div class="text-sm text-gray">${vehicle.registrationNumber}</div>
              </div>
            </div>
            <span class="badge ${vehicle.isActive ? 'badge-started' : 'badge-cancelled'}">${vehicle.isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Type</span>
            <span>${vehicle.vehicleType}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Year / Color</span>
            <span>${vehicle.year} / ${vehicle.color}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Capacity</span>
            <span>${vehicle.capacity} seats</span>
          </div>
          <div class="entity-detail">
            <span class="label">Driver</span>
            <span>${driverName || 'Unassigned'}</span>
          </div>
          <div class="entity-actions">
            <button class="btn btn-outline btn-sm" onclick="openAssignDriverModal('${vehicle._id}')">Assign Driver</button>
            ${vehicle.isActive ? `<button class="btn btn-danger btn-sm" onclick="deactivateVehicle('${vehicle._id}')">Deactivate</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('vehicles-list').innerHTML = '<p class="text-sm text-gray">Unable to load vehicles</p>';
  }
}

function openAddVehicleModal() {
  document.getElementById('add-vehicle-modal').classList.add('active');
}

async function handleAddVehicle(e) {
  e.preventDefault();
  const btn = document.getElementById('add-vehicle-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    await API.addVehicle({
      registrationNumber: document.getElementById('veh-reg').value,
      make: document.getElementById('veh-make').value,
      model: document.getElementById('veh-model').value,
      year: parseInt(document.getElementById('veh-year').value),
      color: document.getElementById('veh-color').value,
      vehicleType: document.getElementById('veh-type').value,
      capacity: parseInt(document.getElementById('veh-capacity').value)
    });

    showToast('Vehicle added successfully!', 'success');
    closeModal('add-vehicle-modal');
    e.target.reset();
    loadVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Vehicle';
  }
}

async function openAssignDriverModal(vehicleId) {
  assignVehicleId = vehicleId;

  // Load drivers if not cached
  if (cachedDrivers.length === 0) {
    try {
      const result = await API.getOperatorDrivers();
      cachedDrivers = result.data.drivers;
    } catch (err) {
      showToast('Failed to load drivers', 'error');
      return;
    }
  }

  const select = document.getElementById('assign-driver-select');
  select.innerHTML = '<option value="">-- Select a driver --</option>' +
    cachedDrivers.map(d => {
      const name = d.userId?.profile
        ? `${d.userId.profile.firstName || ''} ${d.userId.profile.lastName || ''}`.trim()
        : 'Unknown';
      return `<option value="${d._id}">${name} (${d.licenseNumber})</option>`;
    }).join('');

  document.getElementById('assign-driver-modal').classList.add('active');
}

async function handleAssignDriver() {
  const driverId = document.getElementById('assign-driver-select').value;
  if (!driverId || !assignVehicleId) {
    showToast('Please select a driver', 'error');
    return;
  }

  try {
    await API.assignDriver(assignVehicleId, { driverId });
    showToast('Driver assigned!', 'success');
    closeModal('assign-driver-modal');
    assignVehicleId = null;
    loadVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deactivateVehicle(vehicleId) {
  try {
    await API.deleteVehicle(vehicleId);
    showToast('Vehicle deactivated', 'success');
    loadVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// === RIDES ===

async function loadRides(page) {
  if (page) currentRidesPage = page;

  const status = document.getElementById('rides-status-filter').value;

  try {
    const params = { page: currentRidesPage, limit: 15 };
    if (status) params.status = status;

    const result = await API.getOperatorRides(params);
    const { rides, total, totalPages } = result.data;
    const container = document.getElementById('rides-list');

    if (rides.length === 0) {
      container.innerHTML = '<p class="text-gray">No rides found</p>';
      document.getElementById('rides-pagination').innerHTML = '';
      return;
    }

    container.innerHTML = rides.map(ride => {
      const passengerName = ride.passengerId?.profile
        ? `${ride.passengerId.profile.firstName || ''} ${ride.passengerId.profile.lastName || ''}`.trim()
        : '-';
      const driverName = ride.driverId?.userId?.profile
        ? `${ride.driverId.userId.profile.firstName || ''} ${ride.driverId.userId.profile.lastName || ''}`.trim()
        : '-';

      return `
        <div class="entity-card">
          <div class="entity-header">
            <span class="text-sm text-gray">${formatDate(ride.createdAt)} ${formatTime(ride.createdAt)}</span>
            <span class="badge badge-${ride.status}">${ride.status}</span>
          </div>
          <div class="ride-card">
            <div class="locations">
              <div class="location-item">
                <div class="location-dot pickup"></div>
                <span class="text-sm">${ride.pickupLocation?.address || '-'}</span>
              </div>
              <div class="location-item">
                <div class="location-dot drop"></div>
                <span class="text-sm">${ride.dropLocation?.address || '-'}</span>
              </div>
            </div>
          </div>
          <div class="entity-detail">
            <span class="label">Passenger</span>
            <span>${passengerName}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Driver</span>
            <span>${driverName}</span>
          </div>
          <div class="entity-detail">
            <span class="label">Fare</span>
            <strong style="color:var(--primary)">${formatCurrency(ride.fare?.totalFare || ride.estimatedFare || 0)}</strong>
          </div>
        </div>
      `;
    }).join('');

    // Pagination
    renderPagination(totalPages);
  } catch (err) {
    document.getElementById('rides-list').innerHTML = '<p class="text-sm text-gray">Unable to load rides</p>';
  }
}

function renderPagination(totalPages) {
  const container = document.getElementById('rides-pagination');
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  if (currentRidesPage > 1) {
    html += `<button class="btn btn-outline page-btn" onclick="loadRides(${currentRidesPage - 1})">Prev</button>`;
  }

  const start = Math.max(1, currentRidesPage - 2);
  const end = Math.min(totalPages, currentRidesPage + 2);

  for (let i = start; i <= end; i++) {
    html += `<button class="btn btn-outline page-btn ${i === currentRidesPage ? 'active' : ''}" onclick="loadRides(${i})">${i}</button>`;
  }

  if (currentRidesPage < totalPages) {
    html += `<button class="btn btn-outline page-btn" onclick="loadRides(${currentRidesPage + 1})">Next</button>`;
  }

  container.innerHTML = html;
}

// === EARNINGS ===

async function loadEarnings(period) {
  // Update active button
  document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  try {
    const result = await API.getOperatorEarnings({ period });
    const data = result.data;

    document.getElementById('earn-revenue').textContent = formatCurrency(data.totalRevenue);
    document.getElementById('earn-rides').textContent = data.totalRides;
    document.getElementById('earn-avg').textContent = formatCurrency(data.avgFare);
  } catch (err) {
    showToast('Failed to load earnings', 'error');
  }
}

// === MODALS ===

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// === AUTH ===

function handleLogout() {
  API.logout().catch(() => {});
  API.clearTokens();
  window.location.href = '/passenger/index.html';
}
