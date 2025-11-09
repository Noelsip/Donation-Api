const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const projectController = require('../controllers/projectController');
const payoutController = require('../controllers/payoutController');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(authMiddleware, isAdmin);

// Verification management
router.get('/verifications/pending', adminController.getPendingVerifications);
router.post('/verifications/:verificationId/verify', adminController.verifyDocument);

// Project management
router.get('/projects/pending', adminController.getPendingProjects);
router.post('/projects/:projectId/activate', projectController.activateProject);
router.post('/projects/:projectId/close', adminController.closeProject);

// Payout management
router.get('/payouts/pending', payoutController.getPendingPayouts);
router.post('/payouts/:payoutId/approve', adminController.approvePayout);
router.post('/payouts/:payoutId/reject', adminController.rejectPayout);
router.post('/payouts/:payoutId/transfer', adminController.markPayoutTransferred);

// Utilities
router.post('/recalculate-collected', adminController.recalculateCollectedAmount);

module.exports = router;