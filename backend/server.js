const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courseRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes); // Tell Express to use your course routes

mongoose.connect(process.env.MONGO_URI, 
    {
  useNewUrlParser: true,
  useUnifiedTopology: true
    })

.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));