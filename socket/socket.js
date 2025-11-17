import { Server } from 'socket.io';
import { verifyToken } from '../utils/generateToken.js';
import User from '../models/User.js';
import { handleSocketEvents } from './handlers.js';

let io;
const userSocketMap = new Map(); // userId -> socketId

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return next(new Error('Authentication error'));
      }

      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Socket connection
  io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Store user socket mapping
    userSocketMap.set(socket.userId, socket.id);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: Date.now(),
    });

    // Emit online status to all users
    socket.broadcast.emit('user:online', { userId: socket.userId });

    // Handle all socket events
    handleSocketEvents(io, socket);

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userId}`);

      userSocketMap.delete(socket.userId);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: Date.now(),
      });

      // Emit offline status to all users
      socket.broadcast.emit('user:offline', { userId: socket.userId });
    });
  });

  console.log('📡 Socket.IO initialized');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const getReceiverSocketId = (userId) => {
  return userSocketMap.get(userId);
};
