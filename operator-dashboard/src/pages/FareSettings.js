import React, { useEffect, useState } from 'react';
import api from '../api';

const VEHICLE_TYPES = ['auto', 'economy', 'sedan', 'suv'];

export default function FareSettings() {
  const [configs, setConfigs] = useState({});
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load current fare configs — we get them from the vehicles endpoint structure
    // Since there's no direct GET fare-config endpoint, we initialize with defaults
    const defaults = {};
    VEHICLE_TYPES.forEach((type) => {
      defaults[type] = { base_fare: '', per_km_rate: '', per_minute_rate: '', minimum_fare: '' };
    });
    setConfigs(defaults);
  }, []);

  const handleChange = (type, field, value) => {
    setConfigs((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const handleSave = async (type) => {
    const c = configs[type];
    if (!c.base_fare || !c.per_km_rate || !c.per_minute_rate || !c.minimum_fare) {
      setMessage('Please fill in all fields');
      return;
    }
    setSaving(type);
    try {
      await api.put('/operator/fare-config', {
        vehicle_type: type,
        base_fare: parseFloat(c.base_fare),
        per_km_rate: parseFloat(c.per_km_rate),
        per_minute_rate: parseFloat(c.per_minute_rate),
        minimum_fare: parseFloat(c.minimum_fare),
      });
      setMessage(`${type} fares updated successfully`);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving('');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Fare Settings</h1>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: '#E8F5E9', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {VEHICLE_TYPES.map((type) => (
          <div key={type} className="stat-card">
            <h3 style={{ marginBottom: 16, textTransform: 'capitalize' }}>{type}</h3>
            <div className="form-group">
              <label>Base Fare (&#8377;)</label>
              <input
                type="number"
                value={configs[type]?.base_fare || ''}
                onChange={(e) => handleChange(type, 'base_fare', e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
            <div className="form-group">
              <label>Per KM Rate (&#8377;)</label>
              <input
                type="number"
                value={configs[type]?.per_km_rate || ''}
                onChange={(e) => handleChange(type, 'per_km_rate', e.target.value)}
                placeholder="e.g. 15"
              />
            </div>
            <div className="form-group">
              <label>Per Minute Rate (&#8377;)</label>
              <input
                type="number"
                value={configs[type]?.per_minute_rate || ''}
                onChange={(e) => handleChange(type, 'per_minute_rate', e.target.value)}
                placeholder="e.g. 1.5"
              />
            </div>
            <div className="form-group">
              <label>Minimum Fare (&#8377;)</label>
              <input
                type="number"
                value={configs[type]?.minimum_fare || ''}
                onChange={(e) => handleChange(type, 'minimum_fare', e.target.value)}
                placeholder="e.g. 80"
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => handleSave(type)}
              disabled={saving === type}
            >
              {saving === type ? 'Saving...' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
