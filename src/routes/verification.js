const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');

router.post('/upload', authMiddleware, verificationController.uploadVerification);
router.get('/status', authMiddleware, verificationController.getVerificationStatus);
router.get('/pending', authMiddleware, isAdmin, verificationController.listPendingVerifications);

module.exports = router;