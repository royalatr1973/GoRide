const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy REST API calls to the backend server
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3000',
      changeOrigin: true,
    }),
  );

  // Proxy Socket.IO (including WebSocket upgrades) to the backend server
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://localhost:3000',
      ws: true,
      changeOrigin: true,
    }),
  );
};
