import React, { useState } from 'react';
import api from '../api';

export default function Settings() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/auth/update-profile', { name });
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', background: '#E8F5E9', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          {message}
        </div>
      )}

      <div className="stat-card" style={{ maxWidth: 500 }}>
        <h3 style={{ marginBottom: 20 }}>Business Profile</h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Business Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your business name"
            />
          </div>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      <div className="stat-card" style={{ maxWidth: 500, marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Service Area</h3>
        <p style={{ color: '#636E72', fontSize: 14 }}>Currently operating in Chennai, Tamil Nadu</p>
      </div>

      <div className="stat-card" style={{ maxWidth: 500, marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Commission Rate</h3>
        <p style={{ color: '#636E72', fontSize: 14 }}>Your current commission rate is set by Freedom platform. Contact support to change.</p>
      </div>
    </div>
  );
}
