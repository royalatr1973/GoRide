import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { passengerAPI } from '../api';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const greenIcon = L.divIcon({
  className: '',
  html: '<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#22c55e"/><circle cx="12.5" cy="12.5" r="6" fill="#fff"/></svg>',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const redIcon = L.divIcon({
  className: '',
  html: '<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#ef4444"/><circle cx="12.5" cy="12.5" r="6" fill="#fff"/></svg>',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const driverIcon = L.divIcon({
  className: '',
  html: '<div style="width:36px;height:36px;border-radius:50%;background:#6C63FF;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>',
  iconSize: [36, 36], iconAnchor: [18, 18],
});

function RideTracker() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [ride, setRide] = useState(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);

  // REST polling as fallback (slower interval since WebSocket is primary)
  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await passengerAPI.getRideStatus(id);
      setRide(data);
      // Update driver location from poll data if available
      if (data.driver?.current_lat && data.driver?.current_lng) {
        setDriverLocation({ lat: parseFloat(data.driver.current_lat), lng: parseFloat(data.driver.current_lng) });
      }
    } catch (err) {
      setError('Failed to get ride status');
    }
  }, [id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // 10s fallback (WebSocket handles real-time)
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!token) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Driver assigned / status changes
    socket.on('ride_status_update', (data) => {
      if (data.ride_id === id) {
        fetchStatus(); // Refresh full ride data
      }
    });

    // Driver arrived at pickup
    socket.on('driver_arrived', (data) => {
      if (data.ride_id === id) {
        setRide((prev) => prev ? { ...prev, status: 'driver_arrived' } : prev);
      }
    });

    // Live driver location
    socket.on('driver_location', (data) => {
      if (data.ride_id === id) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    });

    // Ride completed
    socket.on('ride_completed', (data) => {
      if (data.ride_id === id) {
        fetchStatus();
      }
    });

    return () => socket.disconnect();
  }, [token, id, fetchStatus]);

  // Map for pickup location
  useEffect(() => {
    if (!ride || !mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const lat = ride.pickup_lat || 13.0827;
    const lng = ride.pickup_lng || 80.2707;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);
    mapInstanceRef.current = map;

    L.tileLayer('/api/tiles/{z}/{x}/{y}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.marker([lat, lng], { icon: greenIcon }).addTo(map);

    if (ride.dropoff_lat && ride.dropoff_lng) {
      L.marker([ride.dropoff_lat, ride.dropoff_lng], { icon: redIcon }).addTo(map);

      // Fetch actual driving route
      const dLat = ride.dropoff_lat, dLng = ride.dropoff_lng;
      const routeLine = L.polyline([[lat, lng], [dLat, dLng]], { color: '#6C63FF', weight: 3, opacity: 0.3, dashArray: '8, 8' }).addTo(map);

      fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dLng},${dLat}?overview=full&geometries=geojson`)
        .then(r => {
          if (!r.ok) throw new Error('OSRM request failed');
          return r.json();
        })
        .then(data => {
          if (data.routes?.[0]) {
            map.removeLayer(routeLine);
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            L.polyline(coords, { color: '#6C63FF', weight: 5, opacity: 0.9 }).addTo(map);
            map.fitBounds(L.latLngBounds(coords).pad(0.15));
          }
        })
        .catch(err => console.warn('Route fetch failed:', err.message));

      const bounds = L.latLngBounds([[lat, lng], [dLat, dLng]]);
      map.fitBounds(bounds.pad(0.3));
    }

    setTimeout(() => map.invalidateSize(), 200);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [ride?.status]);

  // Update driver marker on map in real-time
  useEffect(() => {
    if (!driverLocation || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
    } else {
      driverMarkerRef.current = L.marker(
        [driverLocation.lat, driverLocation.lng],
        { icon: driverIcon, zIndexOffset: 1000 },
      ).addTo(map).bindPopup('Driver');
    }
  }, [driverLocation]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await passengerAPI.cancelRide(id, 'Cancelled by passenger');
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Cannot cancel ride');
    }
    setCancelling(false);
  };

  const handleRate = async (stars) => {
    setRating(stars);
    try { await passengerAPI.rateRide(id, stars); } catch { setError('Failed to submit rating'); }
  };

  if (!ride && !error) {
    return (
      <div className="page map-page">
        <div className="loading-fullscreen">
          <div className="spinner"></div>
          <p>Loading ride details...</p>
        </div>
      </div>
    );
  }

  const canCancel = ['searching', 'driver_assigned', 'driver_arriving'].includes(ride?.status);
  const isSearching = ride?.status === 'searching';
  const hasDriver = ride?.driver;
  const isCompleted = ride?.status === 'completed';
  const isEnded = ['completed', 'cancelled', 'no_driver_found'].includes(ride?.status);
  const otp = location.state?.otp || ride?.otp_code;

  return (
    <div className="page map-page">
      {/* Map background */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}></div>

      {/* Searching overlay */}
      {isSearching && (
        <div className="search-radar">
          <div className="radar-ring ring-1"></div>
          <div className="radar-ring ring-2"></div>
          <div className="radar-ring ring-3"></div>
          <div className="radar-center"></div>
        </div>
      )}

      {/* Bottom sheet */}
      <div className={`bottom-sheet ride-sheet ${isEnded ? 'sheet-full' : ''}`}>
        <div className="sheet-handle"></div>

        {error && <div className="error-msg">{error}</div>}

        {/* === SEARCHING STATE === */}
        {isSearching && (
          <div className="ride-searching">
            <div className="search-header">
              <h3>Finding your {ride?.vehicle_type_requested || 'Auto'} ride</h3>
              <p>Connecting you with nearby drivers...</p>
            </div>
            <div className="search-progress">
              <div className="search-progress-bar"></div>
            </div>
            <div className="search-locations-mini">
              <div className="slm-row"><span className="slm-dot green"></span><span>{ride?.pickup_address}</span></div>
              <div className="slm-row"><span className="slm-dot red"></span><span>{ride?.dropoff_address}</span></div>
            </div>
            {canCancel && (
              <button className="btn-cancel-outline" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling...' : 'Cancel search'}
              </button>
            )}
          </div>
        )}

        {/* === DRIVER ASSIGNED / ARRIVING / ARRIVED === */}
        {hasDriver && !isCompleted && !isEnded && (
          <div className="ride-assigned">
            <div className="assigned-status-row">
              <span className="assigned-status-text">
                {ride.status === 'driver_assigned' && 'Driver on the way'}
                {ride.status === 'driver_arriving' && 'Driver is arriving'}
                {ride.status === 'driver_arrived' && 'Driver has arrived'}
                {ride.status === 'in_progress' && 'Ride in progress'}
              </span>
              {ride.status !== 'in_progress' && (
                <span className="eta-badge">
                  {ride.status === 'driver_arrived' ? 'HERE' : '~2 min'}
                </span>
              )}
            </div>

            {/* OTP PIN */}
            {otp && ride.status !== 'in_progress' && (
              <div className="otp-section">
                <span className="otp-label-new">Start ride with PIN</span>
                <div className="otp-boxes">
                  {String(otp).split('').map((digit, i) => (
                    <div key={i} className="otp-box">{digit}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Driver info card */}
            <div className="driver-card-new">
              <div className="dc-left">
                <div className="dc-avatar">
                  {ride.driver.name?.[0]?.toUpperCase() || 'D'}
                </div>
                <div className="dc-info">
                  <span className="dc-name">{ride.driver.name || 'Driver'}</span>
                  <span className="dc-rating">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFB800" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {ride.driver.rating_avg || 'New'}
                  </span>
                </div>
              </div>
              {ride.vehicle && (
                <div className="dc-vehicle">
                  <span className="dc-vehicle-num">{ride.vehicle.registration_number}</span>
                  <span className="dc-vehicle-desc">{ride.vehicle.color} {ride.vehicle.make}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="driver-actions">
              <a href={`tel:${ride.driver.phone}`} className="action-btn call">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call
              </a>
              <button className="action-btn details" onClick={() => setShowDetails(!showDetails)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                Details
              </button>
            </div>

            {/* Expandable details */}
            {showDetails && (
              <div className="ride-expand-details">
                <div className="red-row"><span className="red-label">Vehicle</span><span>{ride.vehicle_type_requested}</span></div>
                <div className="red-row"><span className="red-label">Fare</span><span>&#8377;{ride.actual_fare || ride.estimated_fare}</span></div>
                <div className="red-row"><span className="red-label">Payment</span><span>Cash</span></div>
                <div className="red-locations">
                  <div className="slm-row"><span className="slm-dot green"></span><span>{ride.pickup_address}</span></div>
                  <div className="slm-row"><span className="slm-dot red"></span><span>{ride.dropoff_address}</span></div>
                </div>
                {canCancel && (
                  <button className="btn-cancel-outline" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? 'Cancelling...' : 'Cancel Ride'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* === COMPLETED STATE === */}
        {isCompleted && (
          <div className="ride-completed">
            <div className="completed-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3>Ride completed!</h3>
            <span className="completed-fare">&#8377;{ride.actual_fare || ride.estimated_fare}</span>

            {!rating && (
              <div className="rating-section-new">
                <p>How was your ride?</p>
                <div className="stars-row">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} className={`star-btn-new ${s <= rating ? 'active' : ''}`} onClick={() => handleRate(s)}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill={s <= rating ? '#FFB800' : 'none'} stroke="#FFB800" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {rating > 0 && <p className="rating-thanks">Thanks for rating!</p>}

            <button className="btn-yellow" onClick={() => navigate('/')}>
              Book Another Ride
            </button>
          </div>
        )}

        {/* === CANCELLED / NO DRIVER === */}
        {(ride?.status === 'cancelled' || ride?.status === 'no_driver_found') && (
          <div className="ride-cancelled">
            <div className="cancelled-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h3>{ride.status === 'cancelled' ? 'Ride Cancelled' : 'No driver found'}</h3>
            <p>{ride.status === 'no_driver_found' ? 'All nearby drivers are busy. Please try again.' : 'Your ride has been cancelled.'}</p>
            <button className="btn-yellow" onClick={() => navigate('/')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RideTracker;
