require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables");
}

// Middleware untuk verifikasi token JWT
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            ok: false,
            message: 'Akses ditolak. Token tidak ditemukan.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verifikasi token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Menyimpan data user di req
        req.user = {
            user_id: decoded.user_id,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error("Token verification failed:", error.message);
        return res.status(401).json({
            ok: false,
            message: 'Token tidak valid atau sudah kadaluarsa.'
        });
    }
};

const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({
            ok: false,
            message: 'Akses ditolak. Hanya admin yang dapat mengakses sumber daya ini.'
        });
    }
    next();
};

module.exports = {
    authMiddleware,
    isAdmin
};