const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizRoutes');
const quizSessionRoutes = require('./routes/quizSessionRoutes');
const courseRoutes = require('./routes/courseRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});


// middleware
app.use(cors());
app.use(express.json());

// attach io so routes can broadcast
app.set('io', io);

// sockets: rooms per session
io.on('connection', (socket) => {
  socket.on('joinSessionRoom', (sessionId) => socket.join(`session:${sessionId}`));
  socket.on('leaveSessionRoom', (sessionId) => socket.leave(`session:${sessionId}`));
  socket.on('disconnect', () => {console.log(`User disconnected: ${socket.id}`);});
});


// routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes); // Using /api/quizzes for consistency
app.use('/api/sessions', quizSessionRoutes); // Using /api/sessions for consistency

// db + start
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server + WS on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
