const pool = require('../config/sql');

const approveVerification = async (req, res) => {
    try {
        const { verificationId } = req.params;
        const { notes } = req.body;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_verify_fundraiser_document(?, ?, ?, ?)',
                [parseInt(verificationId, 10), adminId, 'APPROVED', notes || 'Dokumen disetujui']
            );

            res.status(200).json({
                message: 'Verifikasi dokumen berhasil disetujui'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error approving verification:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const rejectVerification = async (req, res) => {
    try {
        const { verificationId } = req.params;
        const { notes } = req.body;
        const adminId = req.user.user_id;

        if (!notes || notes.trim() === '') {
            return res.status(400).json({
                message: 'Alasan penolakan harus diisi'
            });
        }

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_verify_fundraiser_document(?, ?, ?, ?)',
                [parseInt(verificationId, 10), adminId, 'REJECTED', notes]
            );

            res.status(200).json({
                message: 'Verifikasi dokumen berhasil ditolak'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error rejecting verification:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const getPendingVerifications = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_list_pending_verifications(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                data: result[0],
                count: result[0].length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get pending verifications:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

const getPendingProjects = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_list_pending_projects(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                data: result[0],
                count: result[0].length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get pending projects:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};


const rejectProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_reject_project(?, ?, ?)',
                [parseInt(projectId, 10), adminId, reason]
            );

            res.status(200).json({
                message: 'Proyek berhasil ditolak'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error reject project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const approvePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_approve_payout(?, ?)',
                [parseInt(payoutId, 10), adminId]
            );

            res.status(200).json({
                message: 'Payout berhasil disetujui'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error approve payout:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const rejectPayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { notes } = req.body;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_reject_payout(?, ?, ?)',
                [parseInt(payoutId, 10), adminId, notes]
            );

            res.status(200).json({
                message: 'Payout berhasil ditolak'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error reject payout:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const markPayoutTransferred = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { transfer_reference, notes } = req.body;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_mark_payout_transferred(?, ?, ?, ?)',
                [parseInt(payoutId, 10), adminId, transfer_reference, notes]
            );

            res.status(200).json({
                message: 'Payout berhasil ditandai sebagai transferred'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error mark payout transferred:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const closeProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_close_project(?, ?, ?)',
                [parseInt(projectId, 10), adminId, reason]
            );

            res.status(200).json({
                message: 'Proyek berhasil ditutup'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error close project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const recalculateCollectedAmount = async (req, res) => {
    try {
        const { project_id } = req.body;

        const conn = await pool.getConnection();
        try {
            await conn.query(
                'CALL sp_recalculate_collected_amount(?)',
                [parseInt(project_id, 10)]
            );

            res.status(200).json({
                message: 'Collected amount berhasil direcalculate'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error recalculate:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const getAllProjects = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_admin_get_all_projects(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                data: result[0],
                count: result[0].length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get all projects:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

const getAllPayouts = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_admin_get_all_payouts(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                data: result[0],
                count: result[0].length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get all payouts:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan pada server'
        });
    }
};

module.exports = {
    approveVerification,
    rejectVerification,
    getPendingVerifications,
    getPendingProjects,
    getAllProjects,
    getAllPayouts,
    approvePayout,
    rejectProject,
    rejectPayout,
    markPayoutTransferred,
    closeProject,
    recalculateCollectedAmount
};