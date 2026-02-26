import React, { useState, useEffect, useRef } from 'react';
import { passengerAPI } from '../api';

function LocationInput({ label, value, onChange, placeholder, onLocate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Close suggestions when clicking outside
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (text) => {
    onChange(text);

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce: wait 400ms after user stops typing
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await passengerAPI.autocomplete(text.trim());
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 400);
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.description);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="location-input" ref={wrapperRef} style={{ position: 'relative' }}>
      <div className="location-input-row">
        <span className={`location-dot ${label === 'Pickup' ? 'green' : 'red'}`}></span>
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && <span className="autocomplete-spinner"></span>}
        {onLocate && (
          <button type="button" className="locate-btn" onClick={onLocate} title="Use current location">
            &#9737;
          </button>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((s, i) => (
            <li key={i} className="autocomplete-item" onClick={() => handleSelect(s)}>
              <span className="autocomplete-icon">&#128205;</span>
              <span className="autocomplete-text">{s.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LocationInput;
