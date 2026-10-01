import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import main from './src/config/db.mjs';
import router from './src/routes/authRoute.mjs';
import cors from 'cors';
import eventrouter from './src/routes/eventRoutes.mjs';
import cookieParser from 'cookie-parser';
import eventRequestRouter from './src/routes/eventRequestRoutes.mjs';
import registrationRouter from './src/routes/registrationRoutes.mjs';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import floorPlanRouter from './src/routes/floorPlanRoutes.mjs';
import boothRouter from './src/routes/boothRoutes.mjs';
import boothRequestRouter from './src/routes/boothRequestRoutes.mjs';
import settingsRouter from './src/routes/settingsRoutes.mjs';
import User from './src/models/User.mjs';
import authController from './src/controller/authController.mjs';
import exhibitorRouter from './src/routes/exhibitorRoutes.mjs';
import sessionRouter from './src/routes/sessionRoutes.mjs';
import sessionRegistrationRouter from './src/routes/sessionRegistrationRoutes.mjs';
import statsRouter from './src/routes/statsRoutes.mjs';
import productRouter from './src/routes/productRoutes.mjs';
import publicEventRouter from './src/routes/publicEventRoutes.mjs';
import messageRouter from './src/routes/messageRoutes.mjs';
import { createMessage } from './src/controller/messageController.mjs';
import contactRouter from './src/routes/contactRoutes.mjs';
import chatRouter from './src/routes/chatRoutes.mjs';


// ==================== DATABASE ====================

await main();


// ==================== EXPRESS APP ====================

const app = express();


// ==================== HTTP SERVER ====================
// Express + Socket.IO dono isi server par chalenge

const server = http.createServer(app);


// ==================== SOCKET.IO ====================

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

app.set('io', io);


// ==================== MIDDLEWARE ====================

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const port = process.env.PORT || 3001;


// ==================== STATIC FILES ====================

app.use('/uploads', express.static('uploads'));


// ==================== API ROUTES ====================

app.use('/api/v1/auth', router);

app.use('/api/v1/event', eventrouter);

app.use('/api/v1/event-request', eventRequestRouter);

app.use('/api/v1/registration', registrationRouter);

app.use('/api/v1/floorplan', floorPlanRouter);

app.use('/api/v1/booth', boothRouter);

app.use('/api/v1/booth-request', boothRequestRouter);

app.use('/api/v1/settings', settingsRouter);

app.use('/api/v1/exhibitor', exhibitorRouter);

app.use('/api/v1/session', sessionRouter);

app.use('/api/v1/session-registration', sessionRegistrationRouter);

app.use('/api/v1/stats', statsRouter);

app.use('/api/v1/product', productRouter);

app.use('/api/v1/event-public', publicEventRouter);

app.use('/api/v1/message', messageRouter);

app.use('/api/v1/contact', contactRouter);

app.use('/api/v1/chat', chatRouter);


// ==================== GOOGLE SIGN-IN ====================

app.use(passport.initialize());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,

      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        `http://localhost:${port}/auth/google/callback`,

      passReqToCallback: true,
    },

    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();

        if (!email) {
          return done(
            new Error('Google account has no public email'),
            null
          );
        }

        let user = await User.findOne({
          $or: [
            { googleId: profile.id },
            { email },
          ],
        });

        // ==================== CREATE NEW USER ====================

        if (!user) {
          const requestedRole = req.query.state;

          const role = ['exhibitor', 'attendee'].includes(requestedRole)
            ? requestedRole
            : 'attendee';

          user = await User.create({
            name: profile.displayName || email.split('@')[0],
            email,
            googleId: profile.id,
            role,
          });
        }

        // ==================== LINK GOOGLE TO EXISTING ACCOUNT ====================

        else if (!user.googleId) {
          user.googleId = profile.id;

          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);


// ==================== GOOGLE AUTH START ====================
// Example:
// /auth/google
// /auth/google?role=exhibitor

app.get('/auth/google', (req, res, next) => {
  const role = ['exhibitor', 'attendee'].includes(req.query.role)
    ? req.query.role
    : undefined;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: role,
  })(req, res, next);
});


// ==================== GOOGLE AUTH CALLBACK ====================

app.get(
  '/auth/google/callback',

  passport.authenticate('google', {
    session: false,

    failureRedirect:
      `${process.env.CLIENT_URL}/login?error=google_auth_failed`,
  }),

  async (req, res, next) => {
    try {
      // googleLoginSuccess ko user aur response pass kar rahe hain
      await authController.googleLoginSuccess(req.user, res);

      // Agar googleLoginSuccess response already send kar de
      // to dobara response/redirect nahi bhejna.
    } catch (error) {
      next(error);
    }
  }
);


// ==================== 404 HANDLER ====================

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.originalUrl}`,
  });
});


// ==================== GLOBAL ERROR HANDLER ====================

app.use((err, req, res, next) => {
  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  console.error(err.stack);

  res.status(statusCode).json({
    message: err.message,

    ...(process.env.NODE_ENV === 'production'
      ? {}
      : {
          stack: err.stack,
        }),
  });
});


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
// IMPORTANT:
// app.listen() nahi.
// Socket.IO ke liye server.listen() use karna hai.

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔌 Socket.IO running on port ${port}`);
});