const pool = require('../config/sql');

// Verify fundraiser document
const verifyDocument = async (req, res) => {
    try {
        const { verificationId } = req.params;
        const { status, notes } = req.body;
        const adminId = req.user.user_id;

        if (!['APPROVED', 'REJECTED'].includes(status?.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Status harus berupa APPROVED atau REJECTED'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_verify_fundraiser_document(?, ?, ?, ?)',
                [verificationId, adminId, status.toUpperCase(), notes || null]
            );

            res.json({
                success: true,
                message: `Dokumen berhasil di${status.toLowerCase()}`,
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error verifying document:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat memverifikasi dokumen.'
        });
    }
};

// List pending verifications
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
                success: true,
                data: result[0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get pending verifications:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat mengambil data verifikasi.'
        });
    }
};

// List pending projects
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
                success: true,
                data: result[0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get pending projects:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

// Approve payout
const approvePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_approve_payout(?)',
                [payoutId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Payout tidak ditemukan atau sudah diproses.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Payout berhasil disetujui.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error approving payout:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menyetujui payout.'
        });
    }
};

// Reject payout
const rejectPayout = async (req, res) => {
    try {
        const { payoutId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_reject_payout(?)',
                [payoutId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Payout tidak ditemukan atau sudah diproses.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Payout berhasil ditolak.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error rejecting payout:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menolak payout.'
        });
    }
};

// Mark payout as transferred
const markPayoutTransferred = async (req, res) => {
    try {
        const { payoutId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_mark_payout_transferred(?)',
                [payoutId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Payout tidak ditemukan atau belum disetujui.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Payout berhasil ditandai sebagai selesai.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error marking payout as transferred:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menandai payout sebagai selesai.'
        });
    }
};

// Close project
const closeProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_close_project(?)',
                [projectId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Project tidak ditemukan atau sudah ditutup.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Project berhasil ditutup.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error closing project:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menutup project.'
        });
    }
};

// Recalculate collected amount
const recalculateCollectedAmount = async (req, res) => {
    try {
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query('CALL sp_recalculate_collected_amount()');

            res.status(200).json({
                success: true,
                message: 'Rekalkulasi total donasi berhasil.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error recalculating collected amount:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat merekalkulasi total donasi.'
        });
    }
};

module.exports = {
    verifyDocument,
    getPendingVerifications,
    getPendingProjects,
    approvePayout,
    rejectPayout,
    markPayoutTransferred,
    closeProject,
    recalculateCollectedAmount
};