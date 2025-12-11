require('dotenv').config();
const pool = require('../config/sql');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1h';
if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables");
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: JWT_EXPIRES_IN
    });
    res.setHeader('Authorization', `Bearer ${token}`);
}

// handler untuk google oauth callback
exports.googleOAuthCallback = async (req, res) => {
  try {
    if (!req.user || !req.user.profile) {
      return res.status(400).json({ ok: false, error: 'No profile from Google' });
    }

    const profile = req.user.profile;
    const oauthId = profile.id;
    const displayName = profile.displayName || null;
    const emails = profile.emails || [];
    const email = emails.length > 0 ? emails[0].value : null;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'No email found' });
    }

    let conn;
    try {
      conn = await pool.getConnection();

      const [rows] = await conn.query(
        'CALL sp_register_fundraiser_oauth(?, ?, ?, ?)',
        [displayName, email, 'google', oauthId]
      );

      const user = rows[0][0];
      const token = signToken({ user_id: user.user_id, role: user.role });
      res.setHeader('Authorization', `Bearer ${token}`);

      return res.json({
        ok: true,
        message: user.is_new_user 
          ? 'Registration successful' 
          : 'Login successful',
        data: { user }
      });

    } catch (err) {
      return res.status(500).json({ 
        ok: false, 
        error: err.sqlMessage || err.message 
      });
    } finally {
      if (conn) conn.release();
    }
  } catch (error) {
    return res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
};