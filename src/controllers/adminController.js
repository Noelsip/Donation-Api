const pool = require('../config/sql');

const verifyDocument = async (req, res) => {
    try {
        const { verificationId } = req.params;
        const { status, notes } = req.body;
        const adminId = req.user.user_id;

        if (!['APPROVED', 'REJECTED'].includes(status?.toUpperCase())) {
            return res.status(400).json({
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
                message: `Dokumen berhasil di${status.toLowerCase()}`,
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error verifying document:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat memverifikasi dokumen.'
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
            message: 'Terjadi kesalahan pada server saat mengambil data verifikasi.'
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
            message: 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

const rejectProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const adminId = req.user.user_id;
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                message: 'Alasan penolakan harus diisi'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_reject_project(?, ?, ?)',
                [projectId, adminId, reason]
            );

            const row = result[0] && result[0][0] ? result[0][0] : null;
            if (!row || row.affected_rows === 0) {
                return res.status(404).json({
                    message: 'Project tidak ditemukan.'
                });
            }

            res.status(200).json({
                message: 'Project berhasil ditolak',
                data: row
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error rejecting project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menolak project.'
        });
    }
};

const approvePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_approve_payout(?, ?)',
                [payoutId, adminId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    message: 'Payout tidak ditemukan atau sudah diproses.'
                });
            }

            res.status(200).json({
                message: 'Payout berhasil disetujui.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error approving payout:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menyetujui payout.'
        });
    }
};

const rejectPayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.user_id;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                message: 'Alasan penolakan harus diisi'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_reject_payout(?, ?, ?)',
                [payoutId, adminId, reason]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    message: 'Payout tidak ditemukan atau sudah diproses.'
                });
            }

            res.status(200).json({
                message: 'Payout berhasil ditolak.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error rejecting payout:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menolak payout.'
        });
    }
};

const markPayoutTransferred = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { transferReference } = req.body;
        const adminId = req.user.user_id;

        if (!transferReference || transferReference.trim() === '') {
            return res.status(400).json({
                message: 'Transfer reference harus diisi'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_mark_payout_transferred(?, ?, ?)',
                [payoutId, adminId, transferReference]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    message: 'Payout tidak ditemukan atau belum disetujui.'
                });
            }

            res.status(200).json({
                message: 'Payout berhasil ditandai sebagai transferred.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error marking payout as transferred:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menandai payout sebagai transferred.'
        });
    }
};

const closeProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const adminId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_close_project(?, ?)',
                [projectId, adminId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    message: 'Project tidak ditemukan atau sudah ditutup.'
                });
            }

            res.status(200).json({
                message: 'Project berhasil ditutup.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error closing project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menutup project.'
        });
    }
};

const recalculateCollectedAmount = async (req, res) => {
    try {
        const { project_id } = req.body;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_recalculate_collected_amount(?)',
                [project_id || null]
            );

            res.status(200).json({
                message: 'Rekalkulasi total donasi berhasil.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error recalculating collected amount:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat merekalkulasi total donasi.'
        });
    }
};

module.exports = {
    verifyDocument,
    getPendingVerifications,
    getPendingProjects,
    approvePayout,
    rejectProject,
    rejectPayout,
    markPayoutTransferred,
    closeProject,
    recalculateCollectedAmount
};