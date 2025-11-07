require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./src/config/sql');

async function fixAdminPassword() {
    const adminId = 19;
    const password = 'admin123';

    try {
        // Generate hash baru
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Generated hash:', hashedPassword);

        const conn = await pool.getConnection();
        
        try {
            // Update password
            const [result] = await conn.query(
                'UPDATE users SET user_pass = ? WHERE id = ?',
                [hashedPassword, adminId]
            );
            
            console.log('Affected rows:', result.affectedRows);

            // Verifikasi update
            const [rows] = await conn.query(
                'SELECT id, email, user_pass FROM users WHERE id = ?',
                [adminId]
            );

            console.log('\n=== VERIFIKASI ===');
            console.log('Data di database:', rows[0]);

            // Test bcrypt compare
            const testMatch = await bcrypt.compare(password, rows[0].user_pass);
            console.log('\nTest password match:', testMatch);

            if (testMatch) {
                console.log('✅ Password berhasil di-update dan valid!');
            } else {
                console.log('❌ Ada masalah dengan hash!');
            }
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

fixAdminPassword();