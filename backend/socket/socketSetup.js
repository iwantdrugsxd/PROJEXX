const socketIO = require('socket.io');

function setupSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true
    }
  });

  // Store io instance globally for access in other files
  global.io = io;

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join user-specific room on authentication
    socket.on('authenticate', ({ userId, userRole }) => {
      const room = `${userRole}_${userId}`;
      socket.join(room);
      console.log(`User ${userId} joined room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = setupSocket;