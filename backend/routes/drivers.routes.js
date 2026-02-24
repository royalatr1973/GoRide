const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('driver'));

router.get('/profile', driverController.getProfile);
router.put('/status', driverController.updateStatus);
router.put('/location', driverController.updateLocation);
router.get('/active-rides', driverController.getActiveRides);
router.get('/rides', driverController.getRideHistory);
router.get('/earnings', driverController.getEarnings);
router.post('/rides/:rideId/rate', driverController.ratePassenger);

module.exports = router;
