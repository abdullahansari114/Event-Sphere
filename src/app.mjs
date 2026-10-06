// src/app.mjs
// Express app yahan banti hai (HTTP server / Socket.IO / listen yahan NAHI hai).
// - Local: script.mjs is app ko import karke server + socket chalata hai
// - Vercel: api/index.mjs is app ko serverless function ki tarah export karta hai

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import main from './config/db.mjs';
import User from './models/User.mjs';
import authController from './controller/authController.mjs';

import router from './routes/authRoute.mjs';
import eventrouter from './routes/eventRoutes.mjs';
import eventRequestRouter from './routes/eventRequestRoutes.mjs';
import registrationRouter from './routes/registrationRoutes.mjs';
import floorPlanRouter from './routes/floorPlanRoutes.mjs';
import boothRouter from './routes/boothRoutes.mjs';
import boothRequestRouter from './routes/boothRequestRoutes.mjs';
import settingsRouter from './routes/settingsRoutes.mjs';
import exhibitorRouter from './routes/exhibitorRoutes.mjs';
import sessionRouter from './routes/sessionRoutes.mjs';
import sessionRegistrationRouter from './routes/sessionRegistrationRoutes.mjs';
import statsRouter from './routes/statsRoutes.mjs';
import productRouter from './routes/productRoutes.mjs';
import publicEventRouter from './routes/publicEventRoutes.mjs';
import messageRouter from './routes/messageRoutes.mjs';
import contactRouter from './routes/contactRoutes.mjs';
import chatRouter from './routes/chatRoutes.mjs';

const app = express();

// Vercel proxy ke peeche chalta hai — secure cookies ke liye zaroori
app.set('trust proxy', 1);

// ==================== CORS ====================
// Allowed frontends: local dev + live Vercel frontend + CLIENT_URL (comma separated bhi chalega)

export const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://eventsspheree.vercel.app',
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean),
];

export const corsOptions = {
  origin(origin, callback) {
    // Postman / server-to-server requests mein origin nahi hota
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// ==================== DATABASE (serverless friendly) ====================
// Har request par check hota hai — connection cached rehta hai, baar baar nahi banta

app.use(async (req, res, next) => {
  try {
    await main();
    next();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

const port = process.env.PORT || 3001;

// ==================== HEALTH CHECK ====================

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Event Sphere API is running' });
});

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

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

if (googleEnabled) {
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
            return done(new Error('Google account has no public email'), null);
          }

          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email }],
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
}

const clientUrl = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

// ==================== GOOGLE AUTH START ====================
// /auth/google
// /auth/google?role=exhibitor

app.get('/auth/google', (req, res, next) => {
  if (!googleEnabled) {
    return res.redirect(`${clientUrl()}/login?error=google_not_configured`);
  }

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

  (req, res, next) => {
    if (!googleEnabled) {
      return res.redirect(`${clientUrl()}/login?error=google_not_configured`);
    }
    next();
  },

  passport.authenticate('google', {
    session: false,
    failureRedirect: `${clientUrl()}/login?error=google_auth_failed`,
  }),

  (req, res, next) => {
    try {
      // JWT cookie set karo, phir frontend par wapas bhejo
      authController.googleLoginSuccess(req.user, res);
      res.redirect(`${clientUrl()}/dashboard`);
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
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  console.error(err.stack);

  res.status(statusCode).json({
    message: err.message,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });
});

export default app;
