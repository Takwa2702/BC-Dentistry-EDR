const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

require('dotenv').config();

const required = ['SYS_ADMIN_EMAIL', 'SYS_ADMIN_TEMP_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);

const password = process.env.SYS_ADMIN_TEMP_PASSWORD;
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('SYS_ADMIN_TEMP_PASSWORD must be at least 12 characters and include uppercase, lowercase, number, and symbol');
}

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || 'CHANGE_ME',
        database: process.env.DB_NAME || 'mydatabase'
    });
    try {
        const [existing] = await connection.execute('SELECT ID FROM User WHERE Role_ID = 1 LIMIT 1');
        if (existing.length) throw new Error('A Sys Admin already exists; bootstrap is intentionally single-use');
        const passwordHash = await bcrypt.hash(password, 12);
        await connection.execute(`INSERT INTO User
            (First_Name, Last_Name, Password, Email, Contact_Number, Role_ID, Created_Date, IsActive, Must_Change_Password)
            VALUES (?, ?, ?, ?, ?, 1, NOW(), 1, 1)`, [
            process.env.SYS_ADMIN_FIRST_NAME || 'System', process.env.SYS_ADMIN_LAST_NAME || 'Administrator',
            passwordHash, process.env.SYS_ADMIN_EMAIL, process.env.SYS_ADMIN_CONTACT_NUMBER || ''
        ]);
        console.log('Sys Admin created. A password change is required on first login.');
    } finally { await connection.end(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
