const mongoose = require('mongoose');

const savedJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobTitle: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    default: ''
  },
  salary: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  applyLink: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('SavedJob', savedJobSchema);
