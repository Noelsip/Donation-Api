require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./src/config/sql');

async function createAdmin() {
    const adminData = {
        user_name: 'Admin',
        email: 'admin@gmail.com',
        password: '123123123'
    };

    try {
        const hashedPassword = await bcrypt.hash(adminData.password, 10);
        console.log('Generated hash:', hashedPassword);

        const conn = await pool.getConnection();
        
        try {
            const [result] = await conn.query(
                'INSERT INTO users (user_name, email, user_pass, role, created_at) VALUES (?, ?, ?, ?, NOW())',
                [adminData.user_name, adminData.email, hashedPassword, 'ADMIN']
            );
            
            console.log('Admin created with ID:', result.insertId);

            const [rows] = await conn.query(
                'SELECT id, user_name, email, role FROM users WHERE id = ?',
                [result.insertId]
            );

            console.log('\n=== ADMIN ACCOUNT ===');
            console.log('ID:', rows[0].id);
            console.log('Name:', rows[0].user_name);
            console.log('Email:', rows[0].email);
            console.log('Role:', rows[0].role);
            console.log('Password:', adminData.password);
            console.log('✅ Admin berhasil dibuat!');
        } finally {
            conn.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.error('❌ Email sudah terdaftar!');
        } else {
            console.error('Error:', error.message);
        }
    } finally {
        process.exit();
    }
}

createAdmin();