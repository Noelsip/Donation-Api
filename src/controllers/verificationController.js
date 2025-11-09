const pool  = require('../config/sql');

// Upload verification document
const uploadVerification = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { doc_path, notes} = req.body;

        if (!doc_path || doc_path.trim() === '') {
            return res.status(400).json({ 
                success: false,
                message: 'Path dokumen tidak boleh kosong'
             });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp__upload_fundraiser_verification(?, ?, ?)',
                [userId, doc_path, notes || null]
            );

            res.status(201).json({
                success: true,
                message: 'Dokumen verifikasi berhasil diunggah',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error uploading verification document:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });       
    }
};

// Mengambil status verifikasi untuk authenticated user
const getVerificationStatus = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_fundraiser_verification_status(?)',
                [userId]
            );

            res.status(200).json({
                success: true,
                data: result[0][0],
                count: result[0].length,
                message: 'Status verifikasi berhasil diambil'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error fetching verification status:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });       
    }
};

module.exports = {
    uploadVerification,
    getVerificationStatus
};