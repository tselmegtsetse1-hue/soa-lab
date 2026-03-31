require('dotenv').config();
const express = require('express');
const cors = require('cors');
const soap = require('soap');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const DB_PATH = process.env.DB_PATH || './db/auth.db';

app.use(cors());

let db = null;

async function initDatabase() {
    const SQL = await initSqlJs();
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
        db = new SQL.Database();
    }
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    saveDatabase();
    console.log('✓ Database initialized');
}

function saveDatabase() {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

const userAuthService = {
    UserAuthService: {
        UserAuthPort: {
            RegisterUser: function (args) {
                try {
                    const { username, password, email } = args;
                    if (!username || !password || !email) {
                        return { success: false, message: 'Username, password, and email are required' };
                    }
                    const existing = db.exec(
                        `SELECT id FROM users WHERE username = '${String(username).replace(/'/g, "''")}' OR email = '${String(email).replace(/'/g, "''")}'`
                    );
                    if (existing.length && existing[0].values.length) {
                        return { success: false, message: 'Username or email already exists' };
                    }
                    const passwordHash = bcrypt.hashSync(password, 10);
                    db.run(`INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`, [
                        username,
                        email,
                        passwordHash,
                        'user'
                    ]);
                    const r = db.exec('SELECT last_insert_rowid() as id');
                    const userId = r[0].values[0][0];
                    saveDatabase();
                    return { success: true, message: 'User registered successfully', userId };
                } catch (e) {
                    console.error('RegisterUser:', e);
                    return { success: false, message: 'Registration failed: ' + e.message };
                }
            },
            LoginUser: function (args) {
                try {
                    const { username, password } = args;
                    if (!username || !password) {
                        return { success: false, message: 'Username and password are required' };
                    }
                    const result = db.exec(
                        `SELECT id, username, password_hash, role FROM users WHERE username = '${String(username).replace(/'/g, "''")}'`
                    );
                    if (!result.length || !result[0].values.length) {
                        return { success: false, message: 'Invalid username or password' };
                    }
                    const row = result[0].values[0];
                    const user = { id: row[0], username: row[1], password_hash: row[2], role: row[3] };
                    if (!bcrypt.compareSync(password, user.password_hash)) {
                        return { success: false, message: 'Invalid username or password' };
                    }
                    const token = jwt.sign(
                        { userId: user.id, username: user.username, role: user.role },
                        JWT_SECRET,
                        { expiresIn: JWT_EXPIRES_IN }
                    );
                    return {
                        success: true,
                        token,
                        userId: user.id,
                        role: user.role,
                        message: 'Login successful'
                    };
                } catch (e) {
                    console.error('LoginUser:', e);
                    return { success: false, message: 'Login failed: ' + e.message };
                }
            },
            ValidateToken: function (args) {
                try {
                    const { token } = args;
                    if (!token) return { valid: false, message: 'Token is required' };
                    const decoded = jwt.verify(token, JWT_SECRET);
                    const result = db.exec(`SELECT id, role FROM users WHERE id = ${decoded.userId}`);
                    if (!result.length || !result[0].values.length) {
                        return { valid: false, message: 'User no longer exists' };
                    }
                    return {
                        valid: true,
                        userId: decoded.userId,
                        role: decoded.role,
                        message: 'Token is valid'
                    };
                } catch (e) {
                    if (e.name === 'TokenExpiredError') return { valid: false, message: 'Token has expired' };
                    if (e.name === 'JsonWebTokenError') return { valid: false, message: 'Invalid token' };
                    return { valid: false, message: 'Token validation failed' };
                }
            }
        }
    }
};

async function startServer() {
    await initDatabase();
    const wsdlPath = path.join(__dirname, 'wsdl', 'user.wsdl');
    const wsdl = fs.readFileSync(wsdlPath, 'utf8');
    app.listen(PORT, () => {
        console.log(`✓ SOAP Service running on port ${PORT}`);
        soap.listen(app, '/wsdl', userAuthService, wsdl, () => {
            console.log(`✓ WSDL: http://localhost:${PORT}/wsdl?wsdl`);
        });
    });
    app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-soap-service' }));
}

startServer().catch(console.error);

process.on('SIGINT', () => {
    if (db) {
        saveDatabase();
        db.close();
    }
    process.exit(0);
});
