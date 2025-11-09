const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Public routes (tanpa auth) - untuk melihat semua project aktif
router.get('/public', projectController.getAllPublicProjects);
router.get('/public/:projectId', projectController.getProjectById);

// Protected routes (dengan auth) - untuk user melihat project miliknya
router.post('/create', authMiddleware, projectController.createProject);
router.get('/all', authMiddleware, projectController.getAllProjects);
router.get('/:projectId', authMiddleware, projectController.getProjectById);
router.put('/:projectId/update', authMiddleware, projectController.updateProject);
router.delete('/:projectId/delete', authMiddleware, projectController.deleteProject);

module.exports = router;