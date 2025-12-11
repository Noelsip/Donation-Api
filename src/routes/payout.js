const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/project/:projectId/request', payoutController.requestPayout);
router.get('/project/:projectId/overview', payoutController.getPayoutOverview);
router.get('/project/:projectId/eligibility', payoutController.checkPayoutEligibility);
router.get('/my-payouts', payoutController.getMyPayouts);
router.get('/:payoutId', payoutController.getPayoutById);
router.delete('/:payoutId/cancel', payoutController.cancelPayoutRequest);

module.exports = router;