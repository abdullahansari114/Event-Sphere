// script.mjs — LOCAL development server (Express + Socket.IO)
// Vercel par ye file use nahi hoti; wahan api/index.mjs se src/app.mjs chalti hai.
// Real-time chat (Socket.IO) ke liye persistent server chahiye, jo Vercel par possible nahi.

import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app, { corsOptions } from './src/app.mjs';
import main from './src/config/db.mjs';
import User from './src/models/User.mjs';
import { createMessage } from './src/controller/messageController.mjs';

// ==================== DATABASE ====================

try {
  await main();
} catch (error) {
  console.error('Could not connect to MongoDB, exiting:', error.message);
  process.exit(1);
}

const port = process.env.PORT || 3001;

// ==================== HTTP SERVER ====================
// Express + Socket.IO dono isi server par chalenge

const server = http.createServer(app);

// ==================== SOCKET.IO ====================

const io = new Server(server, {
  cors: corsOptions,
});

app.set('io', io);

// ============================================================
// SOCKET.IO AUTHENTICATION
// ============================================================

// Socket.IO handshake ke cookie header ko manually parse karenge.

const parseCookieHeader = (header = '') =>
  Object.fromEntries(
    header
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf('=');

        if (idx === -1) {
          return [pair, ''];
        }

        return [
          pair.slice(0, idx),
          decodeURIComponent(pair.slice(idx + 1)),
        ];
      })
  );


// ==================== SOCKET AUTH MIDDLEWARE ====================

io.use(async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie;

    if (!rawCookie) {
      return next(new Error('Not authorized'));
    }

    const { token } = parseCookieHeader(rawCookie);

    if (!token) {
      return next(new Error('Not authorized'));
    }

    // JWT verify
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Database se user find
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Not authorized'));
    }

    // Socket ke andar user ID save
    socket.userId = String(user._id);

    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);

    next(new Error('Not authorized'));
  }
});


// ============================================================
// SOCKET.IO CONNECTION
// ============================================================

io.on('connection', (socket) => {
  // Har user apni private room join karega
  // Room name = User ID

  socket.join(socket.userId);

  console.log(
    `🔌 Socket connected: user ${socket.userId} (${socket.id})`
  );


  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  socket.on(
    'sendMessage',
    async ({ receiverId, text }, callback) => {
      try {
        // Validation
        if (!receiverId || !text?.trim()) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'text is required',
            });
          }

          return;
        }


        // User khud ko message nahi kar sakta
        if (receiverId === socket.userId) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: 'Cannot message yourself',
            });
          }

          return;
        }


        // Database mein message create
        const message = await createMessage({
          sender: socket.userId,
          receiver: receiverId,
          text: text.trim(),
        });


        // Receiver aur sender dono ko message bhejna
        io
          .to(receiverId)
          .to(socket.userId)
          .emit('receiveMessage', message);


        // Success callback
        if (typeof callback === 'function') {
          callback({
            success: true,
            message,
          });
        }
      } catch (error) {
        console.error(
          'sendMessage error:',
          error
        );

        if (typeof callback === 'function') {
          callback({
            success: false,
            error: error.message,
          });
        }
      }
    }
  );


  // ==========================================================
  // TYPING
  // ==========================================================

  socket.on('typing', ({ receiverId }) => {
    if (receiverId) {
      socket
        .to(receiverId)
        .emit('typing', {
          senderId: socket.userId,
        });
    }
  });


  // ==========================================================
  // STOP TYPING
  // ==========================================================

  socket.on('stopTyping', ({ receiverId }) => {
    if (receiverId) {
      socket
        .to(receiverId)
        .emit('stopTyping', {
          senderId: socket.userId,
        });
    }
  });


  // ==========================================================
  // DISCONNECT
  // ==========================================================

  socket.on('disconnect', () => {
    console.log(
      `🔌 Socket disconnected: user ${socket.userId}`
    );
  });
});


// ============================================================
// START SERVER
// ============================================================

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔌 Socket.IO running on port ${port}`);
});
