import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

function Login() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phone.length !== 13) return setError('Enter a valid 10-digit mobile number');
    setLoading(true);
    setError('');
    try {
      await authAPI.sendOTP(phone);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 4) return setError('Enter the 4-digit OTP');
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.verifyOTP(phone, otp);
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    }
    setLoading(false);
  };

  return (
    <div className="page login-page">
      <div className="login-hero">
        <div className="login-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h1>GoRide Driver</h1>
        <p>Earn on your own terms</p>
      </div>

      <div className="login-card">
        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <label className="input-label">Mobile Number</label>
            <div className="phone-input-row">
              <span className="phone-prefix">+91</span>
              <input
                type="tel"
                className="input-field phone-field"
                placeholder="Enter 10-digit number"
                value={phone.slice(3)}
                onChange={(e) => setPhone('+91' + e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoFocus
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-green btn-full" disabled={loading}>
              {loading ? 'Sending...' : 'Get OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <label className="input-label">Enter OTP sent to {phone}</label>
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
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-green btn-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button type="button" className="btn-link" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
              Change number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
