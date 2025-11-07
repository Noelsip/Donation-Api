require('dotenv').config();
const pool = require('../config/sql');
const bcrypt = require('bcrypt');
const { raw } = require('body-parser');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables");
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h'
    });
}

exports.registerFundraiser = async (req, res) => {
    const { user_name, email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password wajib diisi'
        })
    }
    
    try {
        // melakukan hash pada password
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);

        const conn = await pool.getConnection();

        try {
            const [rows] = await conn.query(
                'CALL sp_register_fundraiser(?, ?, ?)',
                [user_name, email, hashed]
            );

            const resultSet = Array.isArray(rows) ? rows[0] : rows;
            const created = resultSet && resultSet[0] ? resultSet[0] : resultSet;

            return res.status(201).json({
                message: 'Fundraiser registered successfully',
                data: {
                    id: created.id,
                    user_name: created.user_name,
                    email: created.email
                }
            })
        } finally {
            conn.release();
        }
    } catch (error) {
        const message = error && error.sqlMessage ? error.sqlMessage : error.message;
        res.status(400).json({
            message: `Registration failed: ${message}`
        })
    }
};

exports.loginFundraiser = async (req, res) => {
    const { email, password } = req.body || {}; 

        if (!email || typeof email !== 'string' || !password || typeof password !== 'string'){
        return res.status(400).json({
            ok: false,
            error: 'Email dan password wajib berupa teks.'
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    let conn;
    try {
        conn = await pool.getConnection();

        const [rows] = await conn.query(
            'CALL sp_login_fundraiser(?)',
            [normalizedEmail]
        )
        const resultSet = Array.isArray(rows) ? rows[0] : rows;
        const userRow = resultSet && resultSet[0] ;

        if (!userRow) {
            return res.status(401).json({
                ok: false,
                error: 'Email atau password salah'
            })
        }

        const {
            user_id,
            user_name,
            email: returnedEmail,
            role,
            verified_at,
            created_at,
            hashed_password
        } = userRow;

        if (!hashed_password) {
            return res.status(500).json({
                ok: false,
                error: 'Kesalahan pada server: data password tidak ditemukan'
            });
        }

        // verify bycript password
        const match = await bcrypt.compare(password, hashed_password);
        if (!match) {
            return res.status(401).json({
                ok: false,
                error: 'Email atau password salah'
            
            });
        }

        // Memastikan hanya fundraiser dan admin yang bisa login
        const roleUpper = String(role || '').toUpperCase();
        if (!(roleUpper === 'FUNDRAISER' || roleUpper === 'ADMIN')) {
            return res.status(403).json({
                ok: false,
                error: 'Akun tidak memiliki izin untuk login'
            })
        }

        // Membuat JWT token
        const token = signToken({
            user_id,
            role: roleUpper
        });

        const userData = {
            user_id,
            user_name,
            email: returnedEmail,
            role: roleUpper,
            verified_at,
            created_at
        };

        return res.status(200).json({
            ok: true,
            message: 'Login Berhasil',
            data: {
                user: userData,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        const msg = error && error.sqlMessage ? error.sqlMessage : error.message || "Terjadi kesalahan server";
        return res.status(500).json({
            ok: false,
            error: `Login gagal: ${msg}`
        
        });
    } finally {
        if (conn) conn.release();
    }
}

exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body || {};

    console.log('=== LOGIN ADMIN DEBUG ===');
    console.log('Input email:', email);
    console.log('Input password:', password);

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({
            ok: false,
            error: 'Email dan password wajib berupa teks.'
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    console.log('Normalized email:', normalizedEmail);

    let conn;

    try {
        conn = await pool.getConnection();

        const [rows] = await conn.query(
            'CALL sp_login_admin(?)',
            [normalizedEmail]
        );

        console.log('Raw rows from procedure:', JSON.stringify(rows, null, 2));

        const resultSet = Array.isArray(rows) ? rows[0] : rows;
        console.log('ResultSet:', JSON.stringify(resultSet, null, 2));

        const adminRow = resultSet && resultSet[0];
        console.log('Admin row:', JSON.stringify(adminRow, null, 2));

        if (!adminRow) {
            console.log('❌ Admin row tidak ditemukan');
            return res.status(401).json({
                ok: false,
                error: 'Email atau password salah'
            });
        }

        const {
            user_id,
            user_name,
            email: returnedEmail,
            role,
            hashed_password
        } = adminRow;

        console.log('Extracted data:');
        console.log('- user_id:', user_id);
        console.log('- user_name:', user_name);
        console.log('- email:', returnedEmail);
        console.log('- role:', role);
        console.log('- hashed_password:', hashed_password);

        if (!hashed_password) {
            console.log('❌ Hashed password tidak ada');
            return res.status(500).json({
                ok: false,
                error: 'Kesalahan pada server: data password tidak ditemukan'
            });
        }

        // verify bcrypt password
        const match = await bcrypt.compare(password, hashed_password);
        console.log('Password match:', match);

        if (!match) {
            console.log('❌ Password tidak cocok');
            return res.status(401).json({
                ok: false,
                error: 'Email atau password salah'
            });
        }

        // Memastikan role adalah admin
        const roleUpper = String(role || '').toUpperCase();
        if (roleUpper !== 'ADMIN') {
            console.log('❌ Role bukan ADMIN:', roleUpper);
            return res.status(403).json({
                ok: false,
                error: 'Akun tidak memiliki izin admin'
            });
        }

        // Membuat JWT token
        const token = signToken({
            user_id,
            role: roleUpper
        });

        console.log('✅ Login berhasil');

        return res.status(200).json({
            ok: true,
            message: 'Login Admin Berhasil',
            data: {
                user: {
                    user_id,
                    user_name,
                    email: normalizedEmail,
                    role: roleUpper
                },
                token
            }
        });
    } catch (error) {
        console.error('Admin Login error:', error);
        const msg = error && error.sqlMessage ? error.sqlMessage : error.message || "Terjadi kesalahan server";
        return res.status(500).json({
            ok: false,
            error: `Login gagal: ${msg}`
        });
    } finally {
        if (conn) conn.release();
    }
}