const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

console.log('🔧 importRoutes.js loaded');

// Import data
router.post('/students', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Students import completed',
    imported: 0,
    errors: []
  });
});

router.post('/tasks', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Tasks import completed',
    imported: 0,
    errors: []
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Import Service',
    status: 'healthy'
  });
});

module.exports = router;
