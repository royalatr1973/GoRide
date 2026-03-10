import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { driverAPI } from '../api';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../leaflet-fix';

const LOCATION_INTERVAL = 15000; // 15s location updates

function Home() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [rideRequest, setRideRequest] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(null);
  const [greeting, setGreeting] = useState('Hello');
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [socketStatus, setSocketStatus] = useState('disconnected');

  const socketRef = useRef(null);
  const locationWatchRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const firstName = user?.name?.split(' ')[0] || 'Driver';

  // Set greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Fetch today's earnings
  const fetchEarnings = useCallback(async () => {
    try {
      const { data } = await driverAPI.getEarnings('today');
      setTodayEarnings(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  // Check for active ride on load
  useEffect(() => {
    async function checkActiveRide() {
      try {
        const { data } = await driverAPI.getActiveRide();
        if (data.active) {
          navigate(`/ride/${data.ride_id}`, { state: { ride: data } });
        }
      } catch { /* ignore */ }
    }
    checkActiveRide();
  }, [navigate]);

  // Poll for pending ride requests every 3s when online (WebSocket fallback)
  useEffect(() => {
    if (!isOnline) return;

    const pollForRequests = async () => {
      // Skip if we already have a ride request showing
      if (rideRequest) return;
      try {
        const { data } = await driverAPI.getPendingRequest();
        if (data.pending) {
          console.log('[Poll] Pending ride request found:', data);
          setRideRequest(data);
        }
      } catch { /* ignore */ }
    };

    const interval = setInterval(pollForRequests, 3000);
    return () => clearInterval(interval);
  }, [isOnline, rideRequest]);

  // Get current location
  const getCurrentLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const lat = location?.lat || 13.0827;
    const lng = location?.lng || 80.2707;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const driverIcon = L.divIcon({
      className: '',
      html: '<div style="width:40px;height:40px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    markerRef.current = L.marker([lat, lng], { icon: driverIcon }).addTo(map);

    getCurrentLocation().then((loc) => {
      map.setView([loc.lat, loc.lng], 15);
      markerRef.current.setLatLng([loc.lat, loc.lng]);
    }).catch(() => {});

    return () => { map.remove(); mapInstanceRef.current = null; };
    // eslint-disable-next-line
  }, []);

  // Update marker when location changes
  useEffect(() => {
    if (location && markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    }
  }, [location]);

  // WebSocket connection for ride requests
  useEffect(() => {
    if (!token) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    console.log('[Socket] Connecting to:', socketUrl);
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setSocketStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      setSocketStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setSocketStatus('error: ' + err.message);
    });

    socket.on('ride_request', (data) => {
      console.log('[Socket] Ride request received:', data);
      setRideRequest(data);
    });

    socket.on('ride_cancelled', () => {
      setRideRequest(null);
    });

    return () => { socket.disconnect(); socketRef.current = null; setSocketStatus('disconnected'); };
  }, [token, navigate]);

  // Location tracking when online
  useEffect(() => {
    if (!isOnline) {
      if (locationWatchRef.current) {
        clearInterval(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }

    const sendLocation = async () => {
      try {
        const loc = await getCurrentLocation();
        await driverAPI.updateLocation(loc.lat, loc.lng);
        if (socketRef.current) {
          socketRef.current.emit('driver:location_update', loc);
        }
      } catch { /* ignore */ }
    };

    sendLocation();
    locationWatchRef.current = setInterval(sendLocation, LOCATION_INTERVAL);

    return () => { clearInterval(locationWatchRef.current); };
  }, [isOnline, getCurrentLocation]);

  // Toggle online/offline
  const handleToggle = async () => {
    setToggling(true);
    setError('');
    try {
      if (isOnline) {
        await driverAPI.goOffline();
        setIsOnline(false);
      } else {
        const loc = await getCurrentLocation();
        await driverAPI.goOnline(loc.lat, loc.lng);
        setIsOnline(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change status');
    }
    setToggling(false);
  };

  // Demo ride - create a test ride nearby
  const handleDemoRide = async () => {
    setError('');
    try {
      let loc = location;
      if (!loc) loc = await getCurrentLocation();
      const { data } = await driverAPI.demoRide(loc.lat, loc.lng);
      // Navigate to the active ride screen
      navigate(`/ride/${data.ride_id}`, { state: { ride: data.ride, demoOtp: data.otp } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create demo ride');
    }
  };

  // Accept ride
  const handleAccept = async () => {
    if (!rideRequest) return;
    try {
      const { data } = await driverAPI.respondToRequest(rideRequest.ride_request_id, 'accept');
      navigate(`/ride/${data.ride_id}`, { state: { ride: rideRequest } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept ride');
      setRideRequest(null);
    }
  };

  // Decline ride
  const handleDecline = async () => {
    if (!rideRequest) return;
    try {
      await driverAPI.respondToRequest(rideRequest.ride_request_id, 'decline');
    } catch { /* ignore */ }
    setRideRequest(null);
  };

  return (
    <div className="page home-page driver-home">
      {/* Map background */}
      <div ref={mapRef} className="driver-map"></div>

      {/* Status overlay */}
      <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
        <span className="status-dot"></span>
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      {/* Debug: WebSocket status (visible) */}
      <div style={{
        position: 'fixed', bottom: 200, left: 10, zIndex: 9999,
        padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
        background: socketStatus === 'connected' ? '#22c55e' : '#ef4444',
        color: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }}>
        WS: {socketStatus}
      </div>

      {/* Top bar */}
      <div className="driver-topbar">
        <button className="avatar-btn" onClick={() => navigate('/profile')}>
          {firstName[0]?.toUpperCase() || 'D'}
        </button>
        <div className="topbar-center">
          <div className="greeting-sm">{greeting},</div>
          <div className="driver-name">{firstName}</div>
        </div>
        <button className="icon-btn" onClick={() => navigate('/earnings')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </button>
      </div>

      {/* Ride request popup */}
      {rideRequest && (
        <div className="ride-request-overlay">
          <div className="ride-request-card">
            <div className="rr-header">
              <div className="rr-pulse"></div>
              <h3>New Ride Request</h3>
            </div>
            <div className="rr-fare">
              &#8377;{rideRequest.estimated_fare || '--'}
            </div>
            <div className="rr-vehicle">{rideRequest.vehicle_type || 'Auto'}</div>
            <div className="rr-locations">
              <div className="rr-loc-row">
                <span className="rr-dot green"></span>
                <span>{rideRequest.pickup_address || 'Pickup location'}</span>
              </div>
              <div className="rr-loc-row">
                <span className="rr-dot red"></span>
                <span>{rideRequest.dropoff_address || 'Dropoff location'}</span>
              </div>
            </div>
            {rideRequest.distance_km && (
              <div className="rr-meta">
                {rideRequest.distance_km} km &middot; ~{rideRequest.duration_minutes} min
              </div>
            )}
            <div className="rr-actions">
              <button className="btn-decline" onClick={handleDecline}>Decline</button>
              <button className="btn-accept" onClick={handleAccept}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom panel */}
      <div className="driver-bottom-panel">
        {error && <div className="error-msg">{error}</div>}

        {/* Today's stats */}
        {todayEarnings && (
          <div className="today-stats">
            <div className="stat-item">
              <span className="stat-value">&#8377;{Math.round(todayEarnings.total_earning || 0)}</span>
              <span className="stat-label">Today</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">{todayEarnings.ride_count || 0}</span>
              <span className="stat-label">Rides</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">{user?.rating_avg || '5.0'}</span>
              <span className="stat-label">Rating</span>
            </div>
          </div>
        )}

        {/* Demo ride button */}
        <button className="btn-demo-ride" onClick={handleDemoRide}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Demo Ride (OTP: 1234)
        </button>

        {/* Go Online / Offline button */}
        <button
          className={`btn-toggle-status ${isOnline ? 'is-online' : ''}`}
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? (
            <span className="spinner-sm"></span>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isOnline ? (
                  <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                ) : (
                  <polygon points="5 3 19 12 5 21 5 3"/>
                )}
              </svg>
              <span>{isOnline ? 'Go Offline' : 'Go Online'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default Home;
