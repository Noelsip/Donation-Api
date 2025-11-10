const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');

// Public routes - pisahkan route dengan dan tanpa projectId
router.get('/public', donationController.getPublicDonations);
router.get('/public/:projectId', donationController.getPublicDonations);
router.get('/status/:orderId', donationController.checkDonationStatus);

// Create donation (no auth required)
router.post('/create', donationController.createDonation);

// Midtrans webhook
router.post('/webhook', donationController.handleWebhook);
router.get('/finish', donationController.handleDonationFinish);

module.exports = router;