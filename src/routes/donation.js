const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');

router.get('/public', donationController.getPublicDonations);
router.get('/public/:projectId', donationController.getPublicDonations);
router.get('/status/:orderId', donationController.checkDonationStatus);
router.get('/finish', donationController.handleDonationFinish);

router.post('/create', donationController.createDonation);
router.post('/webhook', donationController.handleWebhook);

module.exports = router;