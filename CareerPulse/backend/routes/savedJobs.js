const express = require('express');
const router = express.Router();
const SavedJob = require('../models/SavedJob');
const { protect } = require('../middleware/authMiddleware');

// Get all saved jobs for user
router.get('/', protect, async (req, res) => {
  try {
    const savedJobs = await SavedJob.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(savedJobs);
  } catch (error) {
    console.error('Get saved jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save a job
router.post('/', protect, async (req, res) => {
  try {
    const { jobTitle, company, location, salary, description, applyLink } = req.body;
    
    // Check if already saved
    const exists = await SavedJob.findOne({ userId: req.user.id, jobTitle, company });
    if (exists) {
      return res.status(400).json({ message: 'Job already saved' });
    }

    const savedJob = new SavedJob({
      userId: req.user.id,
      jobTitle,
      company,
      location,
      salary,
      description,
      applyLink
    });

    const createdJob = await savedJob.save();
    res.status(201).json(createdJob);
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a saved job
router.delete('/:id', protect, async (req, res) => {
  try {
    const savedJob = await SavedJob.findById(req.params.id);
    if (!savedJob) {
      return res.status(404).json({ message: 'Saved job not found' });
    }
    
    if (savedJob.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await savedJob.deleteOne();
    res.json({ message: 'Job removed from saved jobs' });
  } catch (error) {
    console.error('Delete saved job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
