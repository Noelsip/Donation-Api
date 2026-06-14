const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const projectController = require('../controllers/projectController');
const { authMiddleware, adminMiddleware, isAdmin } = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.use(isAdmin);

router.get('/verifications/pending', adminController.getPendingVerifications);
router.post('/verifications/:verificationId/approve', adminController.approveVerification);
router.post('/verifications/:verificationId/reject', adminController.rejectVerification);

router.get('/projects/pending', adminController.getPendingProjects);
router.get('/projects', adminController.getAllProjects);
router.post('/projects/:projectId/activate', projectController.activateProject);
router.post('/projects/:projectId/reject', adminController.rejectProject);
router.delete('/projects/:projectId/close', adminController.closeProject);

router.get('/payouts', adminController.getAllPayouts);
router.post('/payouts/:payoutId/approve', adminController.approvePayout);
router.post('/payouts/:payoutId/reject', adminController.rejectPayout);
router.post('/payouts/:payoutId/transfer', adminController.markPayoutTransferred);

module.exports = router;