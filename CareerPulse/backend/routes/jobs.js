const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Get jobs from Adzuna API
router.get('/search', protect, async (req, res) => {
  try {
    const { what = '', where = 'india', full_time, part_time, contract, salary_min, sort_by = 'relevance' } = req.query;
    
    // Base URL for India
    let apiUrl = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}`;
    
    if (what) apiUrl += `&what=${encodeURIComponent(what)}`;
    if (where) apiUrl += `&where=${encodeURIComponent(where)}`;
    if (full_time === 'true') apiUrl += '&full_time=1';
    if (part_time === 'true') apiUrl += '&part_time=1';
    if (contract === 'true') apiUrl += '&contract=1';
    if (salary_min) apiUrl += `&salary_min=${encodeURIComponent(salary_min)}`;
    
    // Sort logic (Adzuna supports 'date' or 'relevance', default is relevance)
    if (sort_by === 'date') apiUrl += '&sort_by=date';
    else apiUrl += '&sort_by=relevance';

    // Fetch API works natively in Node.js >= 18
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Adzuna API Error: ${err}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Job search error:', error);
    res.status(500).json({ message: 'Error fetching jobs' });
  }
});

module.exports = router;
