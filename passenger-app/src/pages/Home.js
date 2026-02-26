import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LocationInput from '../components/LocationInput';
import VoiceChat from '../components/VoiceChat';

function Home() {
  const { user } = useAuth();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [showVoice, setShowVoice] = useState(false);
  const [greeting, setGreeting] = useState('Hello');
  const navigate = useNavigate();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const handleSearch = () => {
    if (pickup.trim() && dropoff.trim()) {
      navigate('/confirm-map', { state: { pickup, dropoff } });
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPickup(`${pos.coords.latitude},${pos.coords.longitude}`);
        },
        () => setPickup('')
      );
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="page home-page">
      {/* Top bar */}
      <div className="home-topbar">
        <div className="home-topbar-left">
          <button className="avatar-btn" onClick={() => navigate('/profile')}>
            {firstName[0]?.toUpperCase() || 'U'}
          </button>
          <div>
            <div className="greeting-text">{greeting},</div>
            <div className="user-name">{firstName}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => navigate('/history')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      </div>

      {/* Hero section */}
      <div className="home-hero">
        <h1>Where are you<br/>heading today?</h1>
      </div>

      {/* Location card */}
      <div className="home-location-card">
        <LocationInput
          label="Pickup"
          value={pickup}
          onChange={setPickup}
          placeholder="Your pickup location"
          onLocate={handleUseCurrentLocation}
        />
        <div className="location-divider-line">
          <div className="divider-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
        <LocationInput
          label="Drop"
          value={dropoff}
          onChange={setDropoff}
          placeholder="Where to?"
        />
        <button
          className="btn-yellow btn-find-rides"
          onClick={handleSearch}
          disabled={!pickup.trim() || !dropoff.trim()}
        >
          Find Rides
        </button>
      </div>

      {/* Vehicle quick select */}
      <div className="vehicle-quick-row">
        <div className="vehicle-quick-item">
          <div className="vehicle-quick-icon">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="#FFF3E0"/>
              <text x="10" y="28" fontSize="20">&#x1F6FA;</text>
            </svg>
          </div>
          <span>Auto</span>
        </div>
        <div className="vehicle-quick-item">
          <div className="vehicle-quick-icon">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="#E3F2FD"/>
              <text x="10" y="28" fontSize="20">&#x1F697;</text>
            </svg>
          </div>
          <span>Economy</span>
        </div>
        <div className="vehicle-quick-item">
          <div className="vehicle-quick-icon">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="#F3E5F5"/>
              <text x="10" y="28" fontSize="20">&#x1F699;</text>
            </svg>
          </div>
          <span>Sedan</span>
        </div>
        <div className="vehicle-quick-item">
          <div className="vehicle-quick-icon">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="#E8F5E9"/>
              <text x="10" y="28" fontSize="20">&#x1F690;</text>
            </svg>
          </div>
          <span>SUV</span>
        </div>
      </div>

      {/* Voice booking FAB */}
      <button className="voice-fab" onClick={() => setShowVoice(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>

      {showVoice && <VoiceChat onClose={() => setShowVoice(false)} />}
    </div>
  );
}

export default Home;
