const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Semua route payout memerlukan autentikasi
router.use(authMiddleware);

// Route untuk fundraiser membuat permintaan payout
router.post('/project/:projectId/request', payoutController.requestPayout);
router.get('/my-payouts', payoutController.getMyPayouts);

// PENTING: Route dengan path spesifik HARUS di atas route dengan parameter dinamis
router.get('/project/:projectId/overview', payoutController.getPayoutOverview);
router.get('/project/:projectId/eligibility', payoutController.checkPayoutEligibility);

// Route dengan parameter dinamis di paling bawah
router.get('/:payoutId', payoutController.getPayoutById);
router.delete('/:payoutId/cancel', payoutController.cancelPayoutRequest);

// Admin routes
router.get('/admin/pending', payoutController.getPendingPayouts);

module.exports = router;