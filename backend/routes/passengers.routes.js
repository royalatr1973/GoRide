const express = require('express');
const router = express.Router();
const passengerController = require('../controllers/passengerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('passenger'));

router.get('/rides', passengerController.getRideHistory);
router.get('/active-rides', passengerController.getActiveRides);
router.post('/rides/:rideId/rate', passengerController.rateRide);

module.exports = router;
