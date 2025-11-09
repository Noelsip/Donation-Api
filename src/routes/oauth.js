const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const oauthController = require('../controllers/oauthController');
const { route } = require('./auth');

// flow auth
router.get('/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'], 
        session: false,
        accessType: 'offline',
        prompt: 'consent' 
    })
);

// callback auth
router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', {
            failureRedirect: '/auth/google/failure',
            session: false
        }, (err, user, info) => {
            if (err) {
                console.error('Passport authentication error:', err);
                return res.status(500).json({
                    ok: false,
                    error: 'Authentication error',
                    details: err.message
                });
            }
            
            if (!user) {
                console.error('No user returned from passport');
                return res.redirect('/auth/google/failure');
            }
            
            req.user = user;
            next();
        })(req, res, next);
    },
    oauthController.googleOAuthCallback
);

router.get('/google/failure', (req, res) => {
    res.status(401).json({
        ok: false,
        message: 'Google OAuth authentication failed'
    })
})

module.exports = router;