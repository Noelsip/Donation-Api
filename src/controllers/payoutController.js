const pool = require('../config/sql');

// Request payout (fundraiser membuat perminataan payout)
const requestPayout = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { amount } = req.body;
        const userId = req.user.user_id;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Jumlah payout harus lebih besar dari 0.'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [projectResult] = await conn.query(
                'CALL sp_get_project_detail(?)',
                [projectId]
            );

            if (!projectResult[0] || projectResult[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyek tidak ditemukan.'
                });
            }

            const project = projectResult[0][0];

            if (project.fundraiser_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Akses ditolak. Anda bukan pemilik proyek ini.'
                });
            }

            const [result] = await conn.query(
                'CALL sp_request_payout(?, ?)',
                [projectId, amount]
            );

            res.status(201).json({
                success: true,
                message: 'Permintaan payout berhasil dibuat.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error processing payout request:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

const getPayoutOverview = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            // Verifikasi project milik user (kecuali admin)
            if (req.user.role !== 'ADMIN') {
                const [projectResult] = await conn.query(
                    'CALL sp_get_project_detail(?)',
                    [projectId]
                );

                if (!projectResult[0] || projectResult[0].length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Proyek tidak ditemukan.'
                    });
                }

                const project = projectResult[0][0];

                if (project.fundraiser_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Akses ditolak. Anda bukan pemilik proyek ini.'
                    });
                }
            }

            // Mengambil payout overview
            const [result] = await conn.query(
                'CALL sp_get_payout_overview(?)',
                [projectId]
            );

            res.status(200).json({
                success: true,
                data: result[0],
                message: 'Payout overview berhasil diambil.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching payout overview:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

// Mengambil semua payout for authenticated fundraiser
const getMyPayouts = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_user_payouts(?, ?, ?)',
                [userId, parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                success: true,
                data: result[0],
                count: result[0].length,
                message: 'Payouts berhasil diambil.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching user payouts:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

const getPayoutById = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'ADMIN';

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_payout_by_id(?)',
                [payoutId]
            );

            if (!result[0] || result[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Payout tidak ditemukan.'
                });
            }

            const payout = result[0][0];

            if (!isAdmin && payout.fundraiser_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Akses ditolak. Anda bukan pemilik payout ini.'
                });
            }

            res.status(200).json({
                success: true,
                data: payout,
                message: 'Payout berhasil diambil.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching payout by ID:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

// Mengambil semua panding payout (admin only)
const getPendingPayouts = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_pending_payouts(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                success: true,
                data: result[0],
                count: result[0].length,
                message: 'Pending payouts berhasil diambil.'
            });
        } finally{
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching pending payouts:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server.'
        });
    }
};

// Cancel payout (fundraiser membatalkan payout yang pending)
const cancelPayoutRequest = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const userId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            // Mengambil detail payout
            const [payoutResult] = await conn.query(
                'CALL sp_get_payout_by_id(?)',
                [payoutId]
            );

            if (!payoutResult[0] || payoutResult[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Payout tidak ditemukan.'
                });
            }

            const payout = payoutResult[0][0];

            // Verifikasi ownership
            if (payout.fundraiser_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Akses ditolak. Anda bukan pemilik payout ini.'
                });
            }

            // Verifikasi status
            if (payout.payout_status !== 'REQUESTED') {
                return res.status(400).json({
                    success: false,
                    message: 'Payout hanya dapat dibatalkan jika statusnya REQUESTED.'
                });
            }

            const [result] = await conn.query(
                'CALL sp_reject_payout(?)',
                [payoutId]
            );

            res.status(200).json({
                success: true,
                message: 'Payout berhasil dibatalkan.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error cancelling payout request:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

module.exports = {
    requestPayout,
    getPayoutOverview,
    getMyPayouts,
    getPayoutById,
    getPendingPayouts,
    cancelPayoutRequest
};