const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const { protect } = require('../middleware/authMiddleware');

// Get all applications for logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create application
router.post('/', protect, async (req, res) => {
  const { companyName, role, date, status, notes } = req.body;
  try {
    const application = new Application({
      userId: req.user.id,
      companyName,
      role,
      date,
      status,
      notes
    });
    const createdApplication = await application.save();
    res.status(201).json(createdApplication);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update application
router.put('/:id', protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    // Make sure user owns this application
    if (application.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedApplication);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete application
router.delete('/:id', protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (application.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    await application.deleteOne();
    res.json({ message: 'Application removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
