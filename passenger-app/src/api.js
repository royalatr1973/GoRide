import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  sendOTP: (phone) => api.post('/auth/send-otp', { phone, role: 'passenger' }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp, role: 'passenger' }),
  updateProfile: (data) => api.post('/auth/update-profile', data),
};

export const passengerAPI = {
  autocomplete: (text) => api.post('/passenger/autocomplete', { text }),
  geocode: (text) => api.post('/passenger/geocode', { text }),
  reverseGeocode: (lat, lng) => api.post('/passenger/reverse-geocode', { lat, lng }),
  calculateRoute: (pickup, dropoff) => api.post('/passenger/calculate-route', { pickup, dropoff }),
  bookRide: (data) => api.post('/passenger/book-ride', data),
  getRideStatus: (id) => api.get(`/passenger/ride/${id}/status`),
  cancelRide: (id, reason) => api.post(`/passenger/ride/${id}/cancel`, { reason }),
  rateRide: (id, rating, feedback) => api.post(`/passenger/ride/${id}/rate`, { rating, feedback }),
  getRideHistory: (page) => api.get(`/passenger/ride-history?page=${page}`),
};

export const voiceAPI = {
  sendMessage: (message, session_id) => api.post('/voice/message', { message, session_id }),
  newSession: () => api.post('/voice/new-session'),
};

export default api;
