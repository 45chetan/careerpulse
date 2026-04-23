require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const jobsRoutes = require('./routes/jobs');
const interviewRoutes = require('./routes/interview');


const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/saved-jobs', require('./routes/savedJobs'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/interview', interviewRoutes);

// Connect to MongoDB
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/careerpulse';

console.log(MONGO_URI);
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30
  family: 4 // Force IPv4
})
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
