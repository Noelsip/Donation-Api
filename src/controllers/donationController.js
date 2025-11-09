const midtransClient = require('midtrans-client');
const pool = require('../config/sql');

// Initialize Midtrans Snap
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Create donation and get payment token
const createDonation = async (req, res) => {
    try {
        const { project_id, donatorName, donatorEmail, amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount harus lebih besar dari 0'
            });
        }

        // Generate unique order ID
        const orderId = `DON-${project_id}-${Date.now()}`;

        const conn = await pool.getConnection();
        try {
            // Get project details
            const [projectResult] = await conn.query(
                'CALL sp_get_project_detail(?)',
                [project_id]
            );

            if (!projectResult[0] || projectResult[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyek tidak ditemukan'
                });
            }

            const project = projectResult[0][0];

            // Create Midtrans transaction
            const parameter = {
                transaction_details: {
                    order_id: orderId,
                    gross_amount: parseInt(amount)
                },
                customer_details: {
                    first_name: donatorName || 'Anonymous',
                    email: donatorEmail || undefined
                },
                item_details: [{
                    id: project.project_id,
                    price: parseInt(amount),
                    quantity: 1,
                    name: project.project_name
                }],
                callbacks: {
                    finish: `${process.env.FRONTEND_URL}/donation/finish?order_id=${orderId}`
                }
            };

            const transaction = await snap.createTransaction(parameter);

            // Create donation with external_id using webhook handler
            await conn.query(
                'CALL sp_handle_payment_webhook(?, ?, ?, ?, ?, ?, ?)',
                [orderId, project_id, donatorName, donatorEmail, amount, 'PENDING', 'MIDTRANS']
            );

            res.status(200).json({
                success: true,
                message: 'Token pembayaran berhasil dibuat',
                data: {
                    orderId,
                    token: transaction.token,
                    redirectUrl: transaction.redirect_url
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error create donation:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || error.message || 'Gagal membuat donasi'
        });
    }
};

// Midtrans webhook handler
const handleWebhook = async (req, res) => {
    try {
        const notification = req.body;

        // Verify notification
        const statusResponse = await snap.transaction.notification(notification);

        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        console.log(`Transaction notification: ${orderId} - ${transactionStatus}`);

        let paymentStatus = 'PENDING';

        if (transactionStatus === 'capture') {
            if (fraudStatus === 'accept') {
                paymentStatus = 'COMPLETED';
            }
        } else if (transactionStatus === 'settlement') {
            paymentStatus = 'COMPLETED';
        } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
            paymentStatus = 'FAILED';
        }

        const conn = await pool.getConnection();
        try {
            // Get donation by external_id
            const [donationResult] = await conn.query(
                'CALL sp_get_donation_by_external_id(?)',
                [orderId]
            );

            if (!donationResult[0] || donationResult[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Donasi tidak ditemukan'
                });
            }

            const donation = donationResult[0][0];

            // Update donation status
            if (paymentStatus === 'COMPLETED') {
                await conn.query('CALL sp_confirm_donation(?)', [donation.donation_id]);
            } else if (paymentStatus === 'FAILED') {
                await conn.query('CALL sp_fail_donation(?)', [donation.donation_id]);
            }

            res.status(200).json({
                success: true,
                message: 'Webhook processed successfully'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Gagal memproses webhook'
        });
    }
};

// Get public donations for a project
const getPublicDonations = async (req, res) => {
    try {
        const { projectId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_public_donations(?)',
                [projectId || null]
            );

            res.status(200).json({
                success: true,
                data: result[0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get public donations:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat mengambil data donasi.'
        });
    }
};

// Check donation status
const checkDonationStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_donation_by_external_id(?)',
                [orderId]
            );

            if (!result[0] || result[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Donasi tidak ditemukan'
                });
            }

            res.status(200).json({
                success: true,
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error check donation status:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat memeriksa status donasi.'
        });
    }
};

module.exports = {
    createDonation,
    handleWebhook,
    getPublicDonations,
    checkDonationStatus
};