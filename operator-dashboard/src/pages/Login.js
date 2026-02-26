import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import '../App.css';

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone: `+91${phone}`, role: 'operator' });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone: `+91${phone}`, otp, role: 'operator' });
      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Freedom</h1>
        <p>Operator Dashboard — Login</p>

        {error && <div style={{ color: '#D63031', marginBottom: 16, fontSize: 14 }}>{error}</div>}

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP}>
            <div className="form-group">
              <label>Phone Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value="+91" readOnly style={{ width: 60, textAlign: 'center' }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || phone.length !== 10}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label>Enter OTP sent to +91{phone}</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit OTP"
                maxLength={4}
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || otp.length !== 4}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setStep('phone')}>
              Change Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
