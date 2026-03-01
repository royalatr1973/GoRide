import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { driverAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../leaflet-fix';

const greenIcon = L.divIcon({
  className: '',
  html: '<svg width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#22c55e"/><circle cx="12.5" cy="12.5" r="6" fill="#fff"/></svg>',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
const redIcon = L.divIcon({
  className: '',
  html: '<svg width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#ef4444"/><circle cx="12.5" cy="12.5" r="6" fill="#fff"/></svg>',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

function safeFitBounds(map, bounds, options) {
  if (!map || !map.getContainer()) return;
  const container = map.getContainer();
  if (container.clientWidth === 0 || container.clientHeight === 0) return;
  map.fitBounds(bounds, options);
}

function ActiveRide() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [ride, setRide] = useState(null);
  const [status, setStatus] = useState('driver_assigned');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState(null);
  const [otpError, setOtpError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [completionData, setCompletionData] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Fetch ride details from backend
  const fetchRide = useCallback(async () => {
    try {
      const { data } = await driverAPI.getActiveRide();
      if (data.active && data.ride_id === id) {
        setRide(data);
        setStatus(data.status);
      }
    } catch { /* ignore */ }
  }, [id]);

  // Listen for ride events
  useEffect(() => {
    if (!token) return;
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('ride_cancelled', (data) => {
      if (data.ride_id === id) {
        setError('Ride was cancelled by passenger');
        setTimeout(() => navigate('/'), 3000);
      }
    });

    return () => socket.disconnect();
  }, [token, id, navigate]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([13.0827, 80.2707], 14);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Update map when ride info is available
  useEffect(() => {
    if (!ride || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing layers except tile layer
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const pLat = parseFloat(ride.pickup_lat);
    const pLng = parseFloat(ride.pickup_lng);
    L.marker([pLat, pLng], { icon: greenIcon }).addTo(map).bindPopup('Pickup');

    if (ride.dropoff_lat && ride.dropoff_lng) {
      const dLat = parseFloat(ride.dropoff_lat);
      const dLng = parseFloat(ride.dropoff_lng);
      L.marker([dLat, dLng], { icon: redIcon }).addTo(map).bindPopup('Dropoff');

      // Draw route line
      L.polyline([[pLat, pLng], [dLat, dLng]], {
        color: '#22c55e', weight: 3, opacity: 0.4, dashArray: '8, 8',
      }).addTo(map);

      fetch(`https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`)
        .then((r) => r.json())
        .then((data) => {
          if (!mapInstanceRef.current) return;
          if (data.routes?.[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
            L.polyline(coords, { color: '#22c55e', weight: 5, opacity: 0.9 }).addTo(mapInstanceRef.current);
            safeFitBounds(mapInstanceRef.current, L.latLngBounds(coords).pad(0.15));
          }
        })
        .catch(() => {});

      safeFitBounds(map, [[pLat, pLng], [dLat, dLng]], { padding: [50, 50] });
    } else {
      map.setView([pLat, pLng], 15);
    }

    setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 200);
  }, [ride, status]);

  // Load ride info from navigation state, then fetch from backend
  useEffect(() => {
    const stateRide = window.history.state?.usr?.ride;
    const stateDemoOtp = window.history.state?.usr?.demoOtp;
    if (stateRide) {
      setRide(stateRide);
      setStatus(stateRide.status || 'driver_assigned');
    }
    if (stateDemoOtp) {
      setDemoOtp(stateDemoOtp);
    }
    // Also fetch from backend to get latest data
    fetchRide();
  }, [fetchRide]);

  const handleCancelRide = async () => {
    setLoading(true);
    try {
      await driverAPI.cancelRide(id);
    } catch { /* ignore — navigate home regardless */ }
    setLoading(false);
    navigate('/');
  };

  const handleArrive = async () => {
    setLoading(true);
    setError('');
    try {
      await driverAPI.arriveAtPickup(id);
      setStatus('driver_arrived');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark arrival');
    }
    setLoading(false);
  };

  const handleStartRide = async () => {
    if (otp.length !== 4) { setOtpError('Enter 4-digit OTP from passenger'); return; }
    setLoading(true);
    setOtpError('');
    try {
      await driverAPI.startRide(id, otp);
      setStatus('in_progress');
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid OTP');
    }
    setLoading(false);
  };

  const handleEndRide = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await driverAPI.endRide(id);
      setCompletionData(data);
      setStatus('completed');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to end ride');
    }
    setLoading(false);
  };

  const handleRate = async (stars) => {
    setRating(stars);
    try { await driverAPI.ratePassenger(id, stars); } catch { /* ignore */ }
  };

  return (
    <div className="page map-page">
      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}></div>

      {/* Back button (only before ride starts) */}
      {status === 'driver_assigned' && (
        <button className="floating-back" onClick={handleCancelRide} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      )}

      {/* Bottom sheet */}
      <div className={`bottom-sheet driver-sheet ${status === 'completed' ? 'sheet-full' : ''}`}>
        <div className="sheet-handle"></div>

        {error && <div className="error-msg">{error}</div>}

        {/* NAVIGATING TO PICKUP */}
        {status === 'driver_assigned' && (
          <div className="ride-phase">
            <div className="phase-header">
              <span className="phase-icon navigate">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
              </span>
              <div>
                <h3>Navigate to Pickup</h3>
                <p className="phase-sub">Passenger is waiting</p>
              </div>
            </div>

            <div className="ride-locations">
              <div className="rl-row">
                <span className="rl-dot green"></span>
                <span>{ride?.pickup_address || 'Pickup location'}</span>
              </div>
              <div className="rl-row">
                <span className="rl-dot red"></span>
                <span>{ride?.dropoff_address || 'Dropoff location'}</span>
              </div>
            </div>

            <div className="ride-info-row">
              <span>&#8377;{ride?.estimated_fare || '--'}</span>
              <span>{ride?.vehicle_type || 'Auto'}</span>
              {ride?.distance_km && <span>{ride.distance_km} km</span>}
            </div>

            {ride?.passenger_phone && (
              <a href={`tel:${ride.passenger_phone}`} className="btn-call-passenger">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call Passenger
              </a>
            )}

            <button className="btn-green btn-full" onClick={handleArrive} disabled={loading}>
              {loading ? 'Updating...' : "I've Arrived at Pickup"}
            </button>
          </div>
        )}

        {/* ARRIVED - VERIFY OTP */}
        {status === 'driver_arrived' && (
          <div className="ride-phase">
            <div className="phase-header">
              <span className="phase-icon arrived">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </span>
              <div>
                <h3>At Pickup Point</h3>
                <p className="phase-sub">Ask passenger for OTP to start ride</p>
              </div>
            </div>

            <div className="otp-verify-section">
              <label className="input-label">Enter Passenger OTP</label>
              {demoOtp && (
                <div className="demo-otp-hint">Demo OTP: <strong>{demoOtp}</strong></div>
              )}
              <div className="otp-input-row">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    type="text"
                    className="otp-input-box"
                    maxLength={1}
                    value={otp[i] || ''}
                    autoFocus={i === 0}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const newOtp = otp.split('');
                      newOtp[i] = val;
                      setOtp(newOtp.join(''));
                      if (val && i < 3) e.target.nextSibling?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[i] && i > 0) {
                        e.target.previousSibling?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              {otpError && <div className="error-msg">{otpError}</div>}
            </div>

            <button className="btn-green btn-full" onClick={handleStartRide} disabled={loading}>
              {loading ? 'Starting...' : 'Verify OTP & Start Ride'}
            </button>
          </div>
        )}

        {/* RIDE IN PROGRESS */}
        {status === 'in_progress' && (
          <div className="ride-phase">
            <div className="phase-header">
              <span className="phase-icon in-progress">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </span>
              <div>
                <h3>Ride in Progress</h3>
                <p className="phase-sub">Navigate to dropoff</p>
              </div>
            </div>

            <div className="ride-locations">
              <div className="rl-row">
                <span className="rl-dot red"></span>
                <span>{ride?.dropoff_address || 'Dropoff location'}</span>
              </div>
            </div>

            <div className="ride-info-row">
              <span>&#8377;{ride?.estimated_fare || '--'}</span>
              <span>{ride?.vehicle_type || 'Auto'}</span>
            </div>

            <button className="btn-red btn-full" onClick={handleEndRide} disabled={loading}>
              {loading ? 'Completing...' : 'Complete Ride'}
            </button>
          </div>
        )}

        {/* RIDE COMPLETED */}
        {status === 'completed' && (
          <div className="ride-completed-driver">
            <div className="completed-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3>Ride Completed!</h3>

            {completionData && (
              <div className="completion-summary">
                <div className="comp-row">
                  <span>Fare collected</span>
                  <span className="comp-val">&#8377;{completionData.fare}</span>
                </div>
                <div className="comp-row">
                  <span>Commission</span>
                  <span className="comp-val deduct">-&#8377;{completionData.commission}</span>
                </div>
                <div className="comp-row total">
                  <span>Your earning</span>
                  <span className="comp-val earning">&#8377;{completionData.earning}</span>
                </div>
              </div>
            )}

            {!rating && (
              <div className="rating-section">
                <p>Rate passenger</p>
                <div className="stars-row">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} className={`star-btn ${s <= rating ? 'active' : ''}`} onClick={() => handleRate(s)}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill={s <= rating ? '#FFB800' : 'none'} stroke="#FFB800" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {rating > 0 && <p className="rating-thanks">Thanks for rating!</p>}

            <button className="btn-green btn-full" onClick={() => navigate('/')}>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActiveRide;
