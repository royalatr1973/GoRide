import React from 'react';

const VEHICLE_INFO = {
  auto: { name: 'Auto', icon: '🛺', seats: '3 seats' },
  economy: { name: 'Economy', icon: '🚗', seats: '4 seats' },
  sedan: { name: 'Sedan', icon: '🚙', seats: '4 seats' },
  suv: { name: 'SUV', icon: '🚐', seats: '6 seats' },
};

function VehicleSelector({ fares, selected, onSelect }) {
  const available = Object.keys(fares).filter((key) => fares[key]);

  return (
    <div className="vehicle-selector">
      <h3>Choose your ride</h3>
      <div className="vehicle-list">
        {available.map((type) => {
          const info = VEHICLE_INFO[type];
          const fare = fares[type];
          return (
            <button
              key={type}
              className={`vehicle-card ${selected === type ? 'selected' : ''}`}
              onClick={() => onSelect(type)}
            >
              <span className="vehicle-icon">{info.icon}</span>
              <div className="vehicle-details">
                <span className="vehicle-name">{info.name}</span>
                <span className="vehicle-seats">{info.seats}</span>
              </div>
              <span className="vehicle-fare">₹{fare.total}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default VehicleSelector;
