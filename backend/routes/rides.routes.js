const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', authorize('passenger'), rideController.createRide);
router.get('/fare-estimate', rideController.getFareEstimate);
router.get('/nearby-drivers', authorize('passenger'), rideController.getNearbyDrivers);
router.get('/:id', rideController.getRide);
router.post('/:id/accept', authorize('driver'), rideController.acceptRide);
router.put('/:id/status', rideController.updateStatus);

module.exports = router;
