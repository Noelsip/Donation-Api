require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/sql');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const registerFundraiser = async (req, res) => {
    const { user_name, email, password } = req.body;

    if (!user_name || !email || !password) {
        return res.status(400).json({
            message: 'User name, email, dan password wajib diisi'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const [results] = await pool.query(
            'CALL sp_register_fundraiser(?, ?, ?)',
            [user_name, email, hashedPassword]
        );

        const user = results[0][0];

        return res.status(201).json({
            message: 'Registrasi berhasil',
            data: {
                user_id: user.user_id,
                user_name: user.user_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error register fundraiser:', error);

        if (error.sqlMessage && error.sqlMessage.includes('Email sudah terdaftar')) {
            return res.status(409).json({
                message: 'Email sudah terdaftar'
            });
        }

        return res.status(500).json({
            message: 'Terjadi kesalahan saat registrasi',
            error: error.sqlMessage || error.message
        });
    }
};

const loginFundraiser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_login_fundraiser(?)',
                [email]
            );

            const user = result[0][0];

            if (!user) {
                return res.status(401).json({
                    message: 'Email atau password salah'
                });
            }

            const token = jwt.sign(
                { user_id: user.user_id, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(200).json({
                message: 'Login berhasil',
                token: token,
                user: {
                    user_id: user.user_id,
                    user_name: user.user_name,
                    email: user.email,
                    role: user.role,
                    verification_status: user.verification_status
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error login fundraiser:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_login_admin(?)',
                [email]
            );

            const user = result[0][0];

            if (!user) {
                return res.status(401).json({
                    message: 'Email atau password salah'
                });
            }

            const token = jwt.sign(
                { user_id: user.user_id, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(200).json({
                message: 'Login admin berhasil',
                token: token,
                user: {
                    user_id: user.user_id,
                    user_name: user.user_name,
                    email: user.email,
                    role: user.role
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error login admin:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

module.exports = {
    registerFundraiser,
    loginFundraiser,
    loginAdmin
};