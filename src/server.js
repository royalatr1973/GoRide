require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./websocket/socketServer');
const db = require('./db/connection');

const PORT = process.env.PORT || 3000;

const server = http.createServer({ maxHeaderSize: 32768 }, app);

// Initialize WebSocket server
initSocketServer(server);

// Test database connection then start
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully');
    server.listen(PORT, () => {
      console.log(`Freedom server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
