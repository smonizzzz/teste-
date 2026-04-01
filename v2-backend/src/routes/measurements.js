// src/routes/measurements.js

const router = require('express').Router();
const {
  getMeasurementsBySession,
  createMeasurement,
  createMeasurementsBatch
} = require('../controllers/measurementsController');

router.get('/:sessionId',    getMeasurementsBySession);
router.post('/',             createMeasurement);
router.post('/batch',        createMeasurementsBatch);

module.exports = router;
