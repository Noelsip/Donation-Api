const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { route } = require('./admin');

// Semua route payout memerlukan autentikasi
router.use(authMiddleware);

// Route untuk fundraiser membuat permintaan payout
router.post('/project/:projectId/request', payoutController.requestPayout);
router.get('/my-payouts', payoutController.getMyPayouts);
router.get('/:payoutId', payoutController.getPayoutById);
router.get('/project/:projectId/overview', payoutController.getPayoutOverview);
router.delete('/:payoutId/cancel', payoutController.cancelPayoutRequest);

// Admin routes
router.get('/admin/pending', payoutController.getPendingPayouts);

module.exports = router;