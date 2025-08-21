// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courseRoutes');
const quizRoutes = require('./routes/quizRoutes');
const sessionRoutes = require('./routes/quizSessionRoutes');

const Response = require('./models/responseModel');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});

// middleware
app.use(cors());
app.use(express.json());

// attach io so routes and controllers can emit
app.set('io', io);

// --- sockets ---
io.on('connection', (socket) => {
  // join a session room
  socket.on('join_session', ({ sessionId }) => {
    if (sessionId) socket.join(`session:${sessionId}`);
  });
  socket.on('joinSessionRoom', (sessionId) => {
    if (sessionId) socket.join(`session:${sessionId}`);
  });

  // lecturer controls
  socket.on('next_question', ({ sessionId, index }) => {
    io.to(`session:${sessionId}`).emit('next_question', { index });
    io.to(`session:${sessionId}`).emit('phase', { value: 'question', index });
  });

  socket.on('phase', ({ sessionId, value, index }) => {
    io.to(`session:${sessionId}`).emit('phase', { value, index });
  });

  socket.on('end_quiz', ({ sessionId }) => {
    io.to(`session:${sessionId}`).emit('end_quiz');
  });

  // compute and broadcast scoreboard (top N)
  socket.on('show_scoreboard', async ({ sessionId, limit = 3 }) => {
    try {
      const sid = new mongoose.Types.ObjectId(sessionId);
      const top = await Response.aggregate([
        { $match: { session: sid } },
        { $group: { _id: '$student', total: { $sum: '$pointsEarned' } } },
        { $sort: { total: -1 } },
        { $limit: limit },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: '$u' },
        { $project: { _id: 0, name: '$u.name', total: 1 } },
      ]);
      io.to(`session:${sessionId}`).emit('scoreboard', { top });
      io.to(`session:${sessionId}`).emit('phase', { value: 'scoreboard' });
    } catch (e) {
      console.error('scoreboard error', e);
    }
  });
});

// routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/sessions', sessionRoutes);

// db + start
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server + WS on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
