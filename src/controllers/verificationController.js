const pool = require('../config/sql');

const uploadVerification = async (req, res) => {
    const { doc_path, notes } = req.body;
    const fundraiser_id = req.user.user_id;

    if (!doc_path) {
        return res.status(400).json({
            message: 'Document path wajib diisi'
        });
    }

    try {
        const [results] = await pool.query(
            'CALL sp_upload_fundraiser_verification(?, ?, ?)',
            [fundraiser_id, doc_path, notes || null]
        );

        const verification = results[0][0];

        return res.status(201).json({
            message: 'Dokumen verifikasi berhasil diunggah',
            data: {
                verification_id: verification.verification_id,
                status: verification.status
            }
        });
    } catch (error) {
        console.error('Error upload verification:', error);
        return res.status(500).json({
            message: 'Gagal mengunggah dokumen verifikasi',
            error: error.sqlMessage || error.message
        });
    }
};

const listPendingVerifications = async (req, res) => {
    const { limit, offset } = req.query;

    try {
        const [results] = await pool.query(
            'CALL sp_list_pending_verifications(?, ?)',
            [limit || 50, offset || 0]
        );

        const verifications = results[0];

        return res.status(200).json({
            message: 'Berhasil mengambil daftar verifikasi pending',
            data: verifications
        });
    } catch (error) {
        console.error('Error list pending verifications:', error);
        return res.status(500).json({
            message: 'Gagal mengambil daftar verifikasi',
            error: error.sqlMessage || error.message
        });
    }
};

const verifyDocument = async (req, res) => {
    const { verificationId } = req.params;
    const { status, notes } = req.body;
    const admin_id = req.user.user_id;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({
            message: 'Status harus APPROVED atau REJECTED'
        });
    }

    try {
        const [results] = await pool.query(
            'CALL sp_verify_fundraiser_document(?, ?, ?, ?)',
            [verificationId, admin_id, status, notes || null]
        );

        const result = results[0][0];

        return res.status(200).json({
            message: `Dokumen berhasil ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}`,
            data: {
                affected_rows: result.affected_rows,
                new_status: result.new_status
            }
        });
    } catch (error) {
        console.error('Error verify document:', error);
        return res.status(500).json({
            message: 'Gagal memverifikasi dokumen',
            error: error.sqlMessage || error.message
        });
    }
};

const getVerificationStatus = async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const [results] = await pool.query(
            'CALL sp_get_fundraiser_verification_status(?)',
            [user_id]
        );

        const verifications = results[0];

        return res.status(200).json({
            message: 'Berhasil mengambil status verifikasi',
            data: verifications
        });
    } catch (error) {
        console.error('Error get verification status:', error);
        return res.status(500).json({
            message: 'Gagal mengambil status verifikasi',
            error: error.sqlMessage || error.message
        });
    }
};

module.exports = {
    uploadVerification,
    listPendingVerifications,
    verifyDocument,
    getVerificationStatus
};