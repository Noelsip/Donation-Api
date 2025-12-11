const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/public', projectController.listActiveProjects);
router.get('/search', projectController.searchProjects);
router.get('/summary', projectController.getProjectSummary);
router.get('/summary/:projectId', projectController.getProjectSummary);
router.get('/:projectId', projectController.getProjectDetail);
router.get('/:projectId/donations', projectController.getProjectDonations);

router.use(authMiddleware);

router.post('/create', projectController.createProject);
router.get('/user/all', projectController.getAllProjects);
router.get('/user/finished', projectController.getFinishedProject);
router.put('/:projectId', projectController.updateProject);
router.delete('/:projectId/close', projectController.closeProject);

module.exports = router;