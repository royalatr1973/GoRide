import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import Header from '../components/Header';

function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [language, setLanguage] = useState(user?.language_preference || 'en');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await authAPI.updateProfile({ name, language_preference: language });
      updateUser({ name, language_preference: language });
      setMessage('Profile updated!');
    } catch (err) {
      setMessage('Failed to update');
    }
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="page profile-page">
      <Header back />
      <h2>Profile</h2>

      <div className="profile-avatar">
        {user?.name ? user.name[0].toUpperCase() : 'U'}
      </div>
      <p className="profile-phone">{user?.phone}</p>

      <form onSubmit={handleSave} className="profile-form">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />

        <label>Language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="en">English</option>
          <option value="ta">Tamil</option>
        </select>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>

      <button className="btn-danger btn-logout" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default Profile;
