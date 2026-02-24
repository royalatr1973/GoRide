const express = require('express');
const router = express.Router();
const operatorController = require('../controllers/operatorController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('operator'));

router.get('/dashboard', operatorController.getDashboard);
router.get('/drivers', operatorController.getDrivers);
router.post('/drivers', operatorController.addDriver);
router.get('/rides', operatorController.getRides);
router.get('/earnings', operatorController.getEarnings);

module.exports = router;
