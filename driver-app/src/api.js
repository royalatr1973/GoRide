import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('driver_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('driver_token');
      localStorage.removeItem('driver_user');
      window.location.href = '/driver/login';
    }
    return Promise.reject(err);
  },
);

export const authAPI = {
  sendOTP: (phone) => api.post('/auth/send-otp', { phone, role: 'driver' }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp, role: 'driver' }),
  updateProfile: (data) => api.post('/auth/update-profile', data),
};

export const driverAPI = {
  goOnline: (lat, lng) => api.post('/driver/go-online', { lat, lng }),
  goOffline: () => api.post('/driver/go-offline'),
  updateLocation: (lat, lng) => api.post('/driver/update-location', { lat, lng }),
  respondToRequest: (ride_request_id, action) =>
    api.post('/driver/respond-to-request', { ride_request_id, action }),
  arriveAtPickup: (ride_id) => api.post('/driver/arrive-at-pickup', { ride_id }),
  startRide: (ride_id, otp) => api.post('/driver/start-ride', { ride_id, otp }),
  endRide: (ride_id) => api.post('/driver/end-ride', { ride_id }),
  ratePassenger: (ride_id, rating) => api.post('/driver/rate-passenger', { ride_id, rating }),
  cancelRide: (ride_id) => api.post('/driver/cancel-ride', { ride_id }),
  getEarnings: (period) => api.get(`/driver/earnings?period=${period}`),
  getActiveRide: () => api.get('/driver/active-ride'),
  demoRide: (lat, lng) => api.post('/driver/demo-ride', { lat, lng }),
};

export default api;
