require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { authMiddleware, roleMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './db/profile.db';

app.use(cors());
app.use(express.json());

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
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            name TEXT,
            email TEXT,
            bio TEXT,
            phone TEXT,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    saveDatabase();
    console.log('✓ Profile database initialized');
}

function saveDatabase() {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function getRow(sql) {
    const result = db.exec(sql);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const vals = result[0].values[0];
    const row = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    return row;
}

function getAllRows(sql) {
    const result = db.exec(sql);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((vals) => {
        const row = {};
        cols.forEach((c, i) => (row[c] = vals[i]));
        return row;
    });
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user-json-service' }));

app.post('/users', (req, res) => {
    try {
        const { user_id, name, email, bio, phone, avatar_url } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });
        if (getRow(`SELECT id FROM profiles WHERE user_id = ${user_id}`)) {
            return res.status(409).json({ error: 'Profile already exists for this user' });
        }
        const safeName = (name || '').replace(/'/g, "''");
        const safeEmail = (email || '').replace(/'/g, "''");
        const safeBio = (bio || '').replace(/'/g, "''");
        const safePhone = (phone || '').replace(/'/g, "''");
        const safeAvatar = (avatar_url || '').replace(/'/g, "''");
        db.run(
            `INSERT INTO profiles (user_id, name, email, bio, phone, avatar_url) VALUES (${user_id}, '${safeName}', '${safeEmail}', '${safeBio}', '${safePhone}', '${safeAvatar}')`
        );
        saveDatabase();
        const profile = getRow(`SELECT * FROM profiles WHERE user_id = ${user_id}`);
        res.status(201).json({ message: 'Profile created successfully', profile });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create profile', message: e.message });
    }
});

app.get('/users/:id', authMiddleware, (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (req.userId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied', message: 'You can only view your own profile' });
        }
        const profile = getRow(`SELECT * FROM profiles WHERE user_id = ${userId}`);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json({ profile });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get profile', message: e.message });
    }
});

app.put('/users/:id', authMiddleware, (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (req.userId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { name, email, bio, phone, avatar_url } = req.body;
        const existing = getRow(`SELECT * FROM profiles WHERE user_id = ${userId}`);
        if (!existing) {
            const safeName = (name || '').replace(/'/g, "''");
            const safeEmail = (email || '').replace(/'/g, "''");
            const safeBio = (bio || '').replace(/'/g, "''");
            const safePhone = (phone || '').replace(/'/g, "''");
            const safeAvatar = (avatar_url || '').replace(/'/g, "''");
            db.run(
                `INSERT INTO profiles (user_id, name, email, bio, phone, avatar_url) VALUES (${userId}, '${safeName}', '${safeEmail}', '${safeBio}', '${safePhone}', '${safeAvatar}')`
            );
            saveDatabase();
            const profile = getRow(`SELECT * FROM profiles WHERE user_id = ${userId}`);
            return res.status(201).json({ message: 'Profile created successfully', profile });
        }
        const updates = [];
        if (name !== undefined) updates.push(`name = '${String(name).replace(/'/g, "''")}'`);
        if (email !== undefined) updates.push(`email = '${String(email).replace(/'/g, "''")}'`);
        if (bio !== undefined) updates.push(`bio = '${String(bio).replace(/'/g, "''")}'`);
        if (phone !== undefined) updates.push(`phone = '${String(phone).replace(/'/g, "''")}'`);
        if (avatar_url !== undefined) updates.push(`avatar_url = '${String(avatar_url).replace(/'/g, "''")}'`);
        updates.push(`updated_at = datetime('now')`);
        db.run(`UPDATE profiles SET ${updates.join(', ')} WHERE user_id = ${userId}`);
        saveDatabase();
        const profile = getRow(`SELECT * FROM profiles WHERE user_id = ${userId}`);
        res.json({ message: 'Profile updated successfully', profile });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update profile', message: e.message });
    }
});

app.delete('/users/:id', authMiddleware, (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (req.userId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (!getRow(`SELECT * FROM profiles WHERE user_id = ${userId}`)) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        db.run(`DELETE FROM profiles WHERE user_id = ${userId}`);
        saveDatabase();
        res.json({ message: 'Profile deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete profile', message: e.message });
    }
});

app.get('/admin/users', authMiddleware, roleMiddleware('admin'), (req, res) => {
    try {
        res.json({ profiles: getAllRows('SELECT * FROM profiles ORDER BY created_at DESC') });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get profiles', message: e.message });
    }
});

async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`✓ JSON Service running on port ${PORT}`);
    });
}

startServer().catch(console.error);

process.on('SIGINT', () => {
    if (db) {
        saveDatabase();
        db.close();
    }
    process.exit(0);
});
