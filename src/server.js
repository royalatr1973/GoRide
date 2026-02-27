require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./websocket/socketServer');
const db = require('./db/connection');

const PORT = process.env.PORT || 3000;

const server = http.createServer({ maxHeaderSize: 65536 }, app);

// Initialize WebSocket server
initSocketServer(server);

// Test database connection then start
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((err) => {
    console.warn('Database connection failed:', err.message);
    console.warn('Server will start anyway — DB-dependent routes will fail until DB is available');
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`Freedom server running on port ${PORT}`);
    });
  });
