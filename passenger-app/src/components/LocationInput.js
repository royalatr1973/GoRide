import React from 'react';

function LocationInput({ label, value, onChange, placeholder, onLocate }) {
  return (
    <div className="location-input">
      <div className="location-input-row">
        <span className={`location-dot ${label === 'Pickup' ? 'green' : 'red'}`}></span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {onLocate && (
          <button type="button" className="locate-btn" onClick={onLocate} title="Use current location">
            &#9737;
          </button>
        )}
      </div>
    </div>
  );
}

export default LocationInput;
