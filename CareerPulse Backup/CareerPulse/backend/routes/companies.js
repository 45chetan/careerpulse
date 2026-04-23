const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Strong IT Keywords for Multi-Query Strategy
const KEYWORDS = [
  "software company",
  "IT services",
  "technology company",
  "software development",
  "cloud"
];

// Get Accurate IT companies from TomTom Search API with Multi-Query Strategy
router.get('/search', protect, async (req, res) => {
  try {
    const { location } = req.query;
    console.log(`\n--- 🚀 Multi-Query Search Started: ${location} ---`);
    
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }

    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'API Key is missing' });
    }

    // STEP 1: Geocode the location (Focusing on India results)
    const geoUrl = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(location)}.json?key=${apiKey}&limit=1&countrySet=IN`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ message: `Location '${location}' not found.` });
    }

    const { lat, lon } = geoData.results[0].position;
    const targetCity = (geoData.results[0].address.municipality || location).toLowerCase();
    console.log(`📍 Center Coords for ${location}: ${lat}, ${lon}`);

    // STEP 2: Execute Parallel API Calls (Multi-Query Strategy)
    const searchRequests = KEYWORDS.map(kw => {
      const query = encodeURIComponent(kw);
      const url = `https://api.tomtom.com/search/2/poiSearch/${query}.json?key=${apiKey}&lat=${lat}&lon=${lon}&radius=20000&limit=30&countrySet=IN`;
      return fetch(url).then(r => r.json());
    });

    console.log(`📡 Fetching results for ${KEYWORDS.length} parallel queries...`);
    const allResponses = await Promise.all(searchRequests);
    
    // STEP 3: Merge Results
    let combinedResults = [];
    allResponses.forEach(data => {
      if (data.results) combinedResults = combinedResults.concat(data.results);
    });

    console.log(`📊 Total Raw results collected from all queries: ${combinedResults.length}`);

    // STEP 4: De-duplicate and Strict Filter
    const uniqueMap = new Map();
    const itCheckKeywords = ['software', 'it', 'tech', 'technology', 'system', 'digital', 'solution', 'service', 'computer', 'web', 'data', 'infotech', 'consultancy', 'consulting', 'cloud'];

    combinedResults.forEach(item => {
      if (!item.poi || !item.address) return;
      
      const name = item.poi.name;
      const lowerName = name.toLowerCase();
      const city = (item.address.municipality || "").toLowerCase();
      const address = (item.address.freeformAddress || "").toLowerCase();

      // 1. Duplicate check (by Name)
      if (uniqueMap.has(lowerName)) return;

      // 2. City Filter (Strict)
      const isCorrectCity = city.includes(targetCity) || address.includes(targetCity) || city.includes(location.toLowerCase());
      if (!isCorrectCity) return;

      // 3. Relevance Filter (IT Keywords)
      const isIT = itCheckKeywords.some(kw => lowerName.includes(kw)) || 
                   (item.poi.categories && item.poi.categories.some(cat => itCheckKeywords.some(kw => cat.toLowerCase().includes(kw))));
      
      // 4. Negative Filter (Exclude non-tech)
      const isIrrelevant = lowerName.includes('restaurant') || lowerName.includes('shop') || lowerName.includes('hotel') || 
                           lowerName.includes('hospital') || lowerName.includes('school') || lowerName.includes('bank') || 
                           lowerName.includes('cafe') || lowerName.includes('studio') || lowerName.includes('health') ||
                           (lowerName.includes('service') && !lowerName.includes('services'));

      if (isIT && !isIrrelevant) {
        uniqueMap.set(lowerName, {
          name: name,
          location: {
            formatted_address: item.address.freeformAddress,
            city: item.address.municipality,
            lat: item.position.lat,
            lon: item.position.lon
          },
          website: item.poi.url ? (item.poi.url.startsWith('http') ? item.poi.url : `https://${item.poi.url}`) : null,
          distance: Math.round(item.dist)
        });
      }
    });

    const finalResults = Array.from(uniqueMap.values()).sort((a, b) => a.distance - b.distance);
    console.log(`✅ Final De-duplicated & Accurate IT Companies: ${finalResults.length}`);

    res.json({ 
      results: finalResults,
      meta: {
        count: finalResults.length,
        city: geoData.results[0].address.municipality || location
      }
    });

  } catch (error) {
    console.error('Multi-Query Search error:', error);
    res.status(500).json({ message: 'Server error while searching' });
  }
});

module.exports = router;
