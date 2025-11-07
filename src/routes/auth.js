const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.registerFundraiser);
router.post('/login', authController.loginFundraiser);
router.post('/login/admin', authController.loginAdmin);

module.exports = router;