const midtransClient = require('midtrans-client');
const pool = require('../config/sql');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Midtrans Snap
const initMidtrans = () => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.MIDTRANS_CLIENT_KEY;

    if (!serverKey || !clientKey) {
        console.error('Midtrans keys tidak ditemukan')
        throw new Error('Midtrans keys tidak ditemukan');
    }

    return new midtransClient.Snap({
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
        serverKey: serverKey,
        clientKey: clientKey
    });
}

const snap = initMidtrans();

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

            console.log('Midtrans Config:', {
                isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
                serverKey: process.env.MIDTRANS_SERVER_KEY?.substring(0, 15) + '...',
                url: process.env.MIDTRANS_IS_PRODUCTION === 'true' 
                    ? 'https://app.midtrans.com' 
                    : 'https://app.sandbox.midtrans.com'
            });

            const transaction = await snap.createTransaction(parameter);

            // Create donation with external_id using webhook handler
            await conn.query(
                'CALL sp_handle_payment_webhook(?, ?, ?, ?, ?, ?)',
                [orderId, project_id, donatorName, donatorEmail, amount, 'PENDING']
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

        console.log('Webhook received:', JSON.stringify(notification, null, 2));

        // Validasi notification
        if (!notification.order_id) {
            console.error('Order ID tidak ditemukan dalam notification');
            return res.status(400).json({
                success: false,
                message: 'Order ID tidak ditemukan'
            });
        }

        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;

        console.log(`Transaction notification: ${orderId} - ${transactionStatus}`);

        // PERBAIKAN: Jangan gunakan snap.transaction.notification()
        // Langsung proses berdasarkan notification body yang dikirim Midtrans
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
                console.error('Donation not found for order:', orderId);
                return res.status(404).json({
                    success: false,
                    message: 'Donasi tidak ditemukan'
                });
            }

            const donation = donationResult[0][0];

            console.log('Current donation status:', donation.payment_status);
            console.log('New payment status:', paymentStatus);

            // Update donation status
            if (paymentStatus === 'COMPLETED' && donation.payment_status !== 'COMPLETED') {
                await conn.query('CALL sp_confirm_donation(?)', [donation.donation_id]);
                console.log('✅ Donation confirmed:', donation.donation_id);
            } else if (paymentStatus === 'FAILED' && donation.payment_status === 'PENDING') {
                await conn.query('CALL sp_fail_donation(?)', [donation.donation_id]);
                console.log('❌ Donation marked as failed:', donation.donation_id);
            } else {
                console.log('ℹ️ No status update needed');
            }

            res.status(200).json({
                success: true,
                message: 'Webhook processed successfully'
            });
        } catch (dbError) {
            console.error('Database error in webhook:', dbError);
            throw dbError;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error handling webhook:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || error.message || 'Gagal memproses webhook'
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

// Handle donation finish (redirect from Midtrans)
const handleDonationFinish = async (req, res) => {
    try {
        const { order_id, status_code, transaction_status } = req.query;

        console.log('Finish payment redirect:', {
            order_id,
            status_code,
            transaction_status
        });

        if (!order_id) {
            return res.status(400).json({
                success: false,
                message: 'Order ID tidak ditemukan'
            });
        }

        const conn = await pool.getConnection();
        try {
            // Get donation details
            const [donationResult] = await conn.query(
                'CALL sp_get_donation_by_external_id(?)',
                [order_id]
            );

            if (!donationResult[0] || donationResult[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Donasi tidak ditemukan',
                    data: {
                        order_id
                    }
                });
            }

            const donation = donationResult[0][0];

            // Get project details
            const [projectResult] = await conn.query(
                'CALL sp_get_project_detail(?)',
                [donation.project_id]
            );

            const project = projectResult[0] && projectResult[0][0] ? projectResult[0][0] : null;

            // Determine status message based on transaction status
            let paymentStatus = 'PENDING';
            let statusMessage = 'Pembayaran sedang diproses';

            if (transaction_status === 'settlement' || transaction_status === 'capture') {
                paymentStatus = 'COMPLETED';
                statusMessage = 'Pembayaran berhasil';
            } else if (['cancel', 'deny', 'expire', 'failure'].includes(transaction_status)) {
                paymentStatus = 'FAILED';
                statusMessage = 'Pembayaran gagal atau dibatalkan';
            } else if (transaction_status === 'pending') {
                paymentStatus = 'PENDING';
                statusMessage = 'Menunggu pembayaran';
            }

            res.status(200).json({
                success: true,
                message: statusMessage,
                data: {
                    order_id,
                    transaction_status,
                    status_code,
                    payment_status: paymentStatus,
                    donation: {
                        id: donation.donation_id,
                        donator_name: donation.donator_name,
                        donator_email: donation.donator_email,
                        amount: parseFloat(donation.donation_amount),
                        paid_at: donation.paid_at,
                        created_at: donation.created_at
                    },
                    project: project ? {
                        id: project.project_id,
                        name: project.project_name,
                        description: project.description,
                        target_amount: parseFloat(project.target_amount),
                        collected_amount: parseFloat(project.collected_amount),
                        progress: parseFloat(project.progress_percentage)
                    } : null
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error handling donation finish:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat memproses data donasi',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    createDonation,
    handleWebhook,
    getPublicDonations,
    checkDonationStatus,
    handleDonationFinish
};