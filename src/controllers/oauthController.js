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
      return res.status(400).json({ ok: false, error: 'No email found in Google profile' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    let conn;
    try {
      conn = await pool.getConnection();

      // 1) Cek existing user
      const [existing] = await conn.query(
        `SELECT id AS user_id, user_name, email, role
         FROM users
         WHERE (oauth_provider = ? AND oauth_id = ?)
            OR LOWER(email) = ?
         LIMIT 1`,
        ['google', oauthId, normalizedEmail]
      );

      if (existing && existing[0]) {
        const user = existing[0];
        const token = jwt.sign(
          { user_id: user.user_id, role: String(user.role || 'FUNDRAISER').toUpperCase() },
          process.env.JWT_SECRET,
          { algorithm: 'HS256', expiresIn: '1h' }
        );
        return res.json({
          ok: true,
          message: 'Google OAuth login successful (existing user)',
          data: {
            user: {
              user_id: user.user_id,
              user_name: user.user_name,
              email: user.email,
              role: String(user.role || 'FUNDRAISER').toUpperCase(),
            },
            token,
          },
        });
      }

      // 2) Belum ada -> register via SP
      const [rows] = await conn.query(
        'CALL sp_register_fundraiser_oauth(?, ?, ?, ?)',
        [displayName, normalizedEmail, 'google', oauthId]
      );

      const resultSet = Array.isArray(rows) ? rows[0] : rows;
      const out = resultSet && resultSet[0] ? resultSet[0] : resultSet;
      const userId = out && (out.user_id || out.id);
      const role = out && out.role ? out.role : 'FUNDRAISER';

      const token = jwt.sign(
        { user_id: userId, role },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      return res.json({
        ok: true,
        message: 'Google OAuth registration successful',
        data: {
          user: {
            user_id: userId,
            user_name: displayName || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            role,
          },
          token,
        },
      });
    } catch (err) {
      // Tampilkan pesan asli dari SP (karena sekarang RESIGNAL)
      const msg = err && (err.sqlMessage || err.message);
      return res.status(500).json({ ok: false, error: `Google OAuth failed: ${msg}` });
    } finally {
      if (conn) conn.release();
    }
  } catch (error) {
    const msg = error && error.message ? error.message : 'Terjadi kesalahan server';
    return res.status(500).json({ ok: false, error: `Google OAuth failed: ${msg}` });
  }
};