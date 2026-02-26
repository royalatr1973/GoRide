import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LocationInput from '../components/LocationInput';
import VoiceChat from '../components/VoiceChat';

function Home() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [showVoice, setShowVoice] = useState(false);
  const navigate = useNavigate();

  const handleSearch = () => {
    if (pickup.trim() && dropoff.trim()) {
      navigate('/booking', { state: { pickup, dropoff } });
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

  return (
    <div className="page home-page">
      <Header />
      <div className="home-content">
        <h2>Where are you going?</h2>

        <div className="location-form">
          <LocationInput
            label="Pickup"
            value={pickup}
            onChange={setPickup}
            placeholder="Enter pickup location"
            onLocate={handleUseCurrentLocation}
          />
          <div className="location-divider">
            <span className="dot-line"></span>
          </div>
          <LocationInput
            label="Drop"
            value={dropoff}
            onChange={setDropoff}
            placeholder="Where to?"
          />
          <button
            className="btn-primary btn-search"
            onClick={handleSearch}
            disabled={!pickup.trim() || !dropoff.trim()}
          >
            Search Rides
          </button>
        </div>

        <div className="quick-actions">
          <button className="quick-btn" onClick={() => navigate('/history')}>
            <span className="quick-icon">&#128337;</span>
            <span>History</span>
          </button>
          <button className="quick-btn" onClick={() => setShowVoice(true)}>
            <span className="quick-icon">&#127908;</span>
            <span>Voice Book</span>
          </button>
          <button className="quick-btn" onClick={() => navigate('/profile')}>
            <span className="quick-icon">&#9881;</span>
            <span>Profile</span>
          </button>
        </div>
      </div>

      {showVoice && <VoiceChat onClose={() => setShowVoice(false)} />}
    </div>
  );
}

export default Home;
