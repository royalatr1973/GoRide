const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('operator'));

router.post('/', vehicleController.addVehicle);
router.get('/', vehicleController.getVehicles);
router.get('/:id', vehicleController.getVehicle);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);
router.post('/:id/assign-driver', vehicleController.assignDriver);

module.exports = router;
