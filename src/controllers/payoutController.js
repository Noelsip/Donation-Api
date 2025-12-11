const pool = require('../config/sql');

const requestPayout = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { amount } = req.body;
        const userId = req.user.user_id;

        if (!amount || amount <= 0) {
            return res.status(400).json({
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
                    message: 'Proyek tidak ditemukan.'
                });
            }

            const project = projectResult[0][0];

            if (project.fundraiser_id !== userId) {
                return res.status(403).json({
                    message: 'Akses ditolak. Anda bukan pemilik proyek ini.'
                });
            }

            const [result] = await conn.query(
                'CALL sp_request_payout(?, ?)',
                [projectId, amount]
            );

            res.status(201).json({
                message: 'Permintaan payout berhasil dibuat.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error processing payout request:', error);

        if (error.message && error.message.includes('Dana tidak mencukupi')) {
            return res.status(400).json({
                message: 'Dana tidak mencukupi',
                details: 'Silahkan cek saldo tersedia di overview'
            });
        }

        res.status(500).json({
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
            if (req.user.role !== 'ADMIN') {
                const [projectResult] = await conn.query(
                    'CALL sp_get_project_detail(?)',
                    [projectId]
                );

                if (!projectResult[0] || projectResult[0].length === 0) {
                    return res.status(404).json({
                        message: 'Proyek tidak ditemukan.'
                    });
                }

                const project = projectResult[0][0];

                if (project.fundraiser_id !== userId) {
                    return res.status(403).json({
                        message: 'Akses ditolak. Anda bukan pemilik proyek ini.'
                    });
                }
            }

            const [result] = await conn.query(
                'CALL sp_get_payout_overview(?)',
                [projectId]
            );

            res.status(200).json({
                data: result[0][0],
                message: 'Payout overview berhasil diambil.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching payout overview:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

const getMyPayouts = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_user_payouts(?)',
                [userId]
            );

            res.status(200).json({
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
                    message: 'Payout tidak ditemukan.'
                });
            }

            const payout = result[0][0];

            if (!isAdmin && payout.fundraiser_id !== userId) {
                return res.status(403).json({
                    message: 'Akses ditolak. Anda bukan pemilik payout ini.'
                });
            }

            res.status(200).json({
                data: payout,
                message: 'Payout berhasil diambil.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching payout by ID:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

const getPendingPayouts = async (req, res) => {
    try {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query('CALL sp_get_pending_payouts()');

            res.status(200).json({
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
            message: 'Terjadi kesalahan pada server.'
        });
    }
};

const cancelPayoutRequest = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const userId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            const [payoutResult] = await conn.query(
                'CALL sp_get_payout_by_id(?)',
                [payoutId]
            );

            if (!payoutResult[0] || payoutResult[0].length === 0) {
                return res.status(404).json({
                    message: 'Payout tidak ditemukan.'
                });
            }

            const payout = payoutResult[0][0];

            if (payout.fundraiser_id !== userId) {
                return res.status(403).json({
                    message: 'Akses ditolak. Anda bukan pemilik payout ini.'
                });
            }

            if (payout.payout_status !== 'REQUESTED') {
                return res.status(400).json({
                    message: 'Payout hanya dapat dibatalkan jika statusnya REQUESTED.'
                });
            }

            const [result] = await conn.query(
                'CALL sp_reject_payout(?, ?, ?)',
                [payoutId, userId, 'Dibatalkan oleh fundraiser']
            );

            res.status(200).json({
                message: 'Payout berhasil dibatalkan.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error cancelling payout request:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

const checkPayoutEligibility = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            const [projectResult] = await conn.query(
                'CALL sp_get_project_detail(?)',
                [projectId]
            );

            if (!projectResult[0] || projectResult[0].length === 0) {
                return res.status(404).json({
                    message: 'Proyek tidak ditemukan.'
                });
            }

            const project = projectResult[0][0];

            if (project.fundraiser_id !== userId) {
                return res.status(403).json({
                    message: 'Akses ditolak. Anda bukan pemilik proyek ini.'
                });
            }

            res.status(200).json({
                message: 'Proyek eligible untuk payout.',
                data: {
                    project_id: project.project_id,
                    project_name: project.project_name,
                    project_status: project.project_status,
                    collected_amount: parseFloat(project.collected_amount),
                    total_paid_out: parseFloat(project.total_paid_out || 0),
                    available_payout: parseFloat(project.available_payout || 0),
                    can_request_payout: project.project_status === 'ACTIVE' && 
                                       parseFloat(project.available_payout || 0) > 0
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error checking payout eligibility:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server.'
        });
    }
};

const getAllPayouts = async (req, res) => {
    try {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query('CALL sp_get_pending_payouts()');

            res.status(200).json({
                data: result[0],
                count: result[0].length,
                message: 'Semua payout berhasil diambil.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error Fetching all payouts: ', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

module.exports = {
    requestPayout,
    getPayoutOverview,
    getMyPayouts,
    getPayoutById,
    getPendingPayouts,
    cancelPayoutRequest,
    checkPayoutEligibility,
    getAllPayouts
};