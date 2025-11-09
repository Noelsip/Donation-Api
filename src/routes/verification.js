const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Semua verifikasi routes memerlukan autentikasi
router.use(authMiddleware);

// Upload dokumen verifikasi
router.post('/upload', verificationController.uploadVerification);

// Mendapatkan status verifikasi
router.get('/status', verificationController.getVerificationStatus);

module.exports = router;