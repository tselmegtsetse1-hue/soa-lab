/**
 * User JSON Service — Lab 06 + Lab 07
 * Profile DB: local file (sql.js) OR cloud PostgreSQL via DATABASE_URL / DB_* env vars.
 */
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

/** @type {import('pg').Pool | null} */
let pgPool = null;
/** @type {import('sql.js').Database | null} */
let sqliteDb = null;
let dbMode = 'sqlite';

function getPgConfig() {
    const conn =
        process.env.DATABASE_URL ||
        process.env.DB_URL ||
        process.env.DATABASE_URI ||
        null;
    if (conn) {
        return {
            connectionString: conn,
            ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
        };
    }
    const host = process.env.DB_HOST;
    if (!host) return null;
    const user = process.env.DB_USERNAME || process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || process.env.DATABASE_NAME || 'defaultdb';
    const port = parseInt(process.env.DB_PORT || '5432', 10);
    if (!user) return null;
    return {
        host,
        port,
        user,
        password,
        database,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
    };
}

async function initPostgres() {
    const { Pool } = require('pg');
    const config = getPgConfig();
    pgPool = new Pool(config);
    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL,
            name TEXT,
            email TEXT,
            bio TEXT,
            phone TEXT,
            avatar_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    const hostInfo = config.connectionString
        ? '(connection string — Lab07 cloud DB)'
        : `${config.host}:${config.port}/${config.database}`;
    console.log('✓ Profile database (PostgreSQL) connected —', hostInfo);
}

function saveSqliteDatabase() {
    if (!sqliteDb) return;
    fs.writeFileSync(DB_PATH, Buffer.from(sqliteDb.export()));
}

async function initSqlite() {
    const SQL = await initSqlJs();
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    if (fs.existsSync(DB_PATH)) {
        sqliteDb = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
        sqliteDb = new SQL.Database();
    }
    sqliteDb.run(`
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
    saveSqliteDatabase();
    console.log('✓ Profile database initialized (SQLite file:', DB_PATH, ')');
}

async function initDatabase() {
    if (getPgConfig()) {
        dbMode = 'pg';
        await initPostgres();
        return;
    }
    dbMode = 'sqlite';
    await initSqlite();
}

// ——— Data access ———

async function getProfileByUserId(userId) {
    if (dbMode === 'pg') {
        const r = await pgPool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
        return r.rows[0] || null;
    }
    const result = sqliteDb.exec(`SELECT * FROM profiles WHERE user_id = ${userId}`);
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    const vals = result[0].values[0];
    const row = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    return row;
}

async function getAllProfiles() {
    if (dbMode === 'pg') {
        const r = await pgPool.query('SELECT * FROM profiles ORDER BY created_at DESC');
        return r.rows;
    }
    const result = sqliteDb.exec('SELECT * FROM profiles ORDER BY created_at DESC');
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map((vals) => {
        const row = {};
        cols.forEach((c, i) => (row[c] = vals[i]));
        return row;
    });
}

async function insertProfile({ user_id, name, email, bio, phone, avatar_url }) {
    if (dbMode === 'pg') {
        const r = await pgPool.query(
            `INSERT INTO profiles (user_id, name, email, bio, phone, avatar_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [user_id, name || '', email || '', bio || '', phone || '', avatar_url || '']
        );
        return r.rows[0];
    }
    const safe = (s) => String(s || '').replace(/'/g, "''");
    sqliteDb.run(
        `INSERT INTO profiles (user_id, name, email, bio, phone, avatar_url) VALUES (${user_id}, '${safe(name)}', '${safe(email)}', '${safe(bio)}', '${safe(phone)}', '${safe(avatar_url)}')`
    );
    saveSqliteDatabase();
    return await getProfileByUserId(user_id);
}

async function updateProfile(userId, fields) {
    if (dbMode === 'pg') {
        const sets = [];
        const vals = [];
        let i = 1;
        if (fields.name !== undefined) {
            sets.push(`name = $${i++}`);
            vals.push(fields.name);
        }
        if (fields.email !== undefined) {
            sets.push(`email = $${i++}`);
            vals.push(fields.email);
        }
        if (fields.bio !== undefined) {
            sets.push(`bio = $${i++}`);
            vals.push(fields.bio);
        }
        if (fields.phone !== undefined) {
            sets.push(`phone = $${i++}`);
            vals.push(fields.phone);
        }
        if (fields.avatar_url !== undefined) {
            sets.push(`avatar_url = $${i++}`);
            vals.push(fields.avatar_url);
        }
        sets.push(`updated_at = NOW()`);
        vals.push(userId);
        const r = await pgPool.query(
            `UPDATE profiles SET ${sets.join(', ')} WHERE user_id = $${i} RETURNING *`,
            vals
        );
        return r.rows[0] || null;
    }
    const safe = (s) => String(s).replace(/'/g, "''");
    const updates = [];
    if (fields.name !== undefined) updates.push(`name = '${safe(fields.name)}'`);
    if (fields.email !== undefined) updates.push(`email = '${safe(fields.email)}'`);
    if (fields.bio !== undefined) updates.push(`bio = '${safe(fields.bio)}'`);
    if (fields.phone !== undefined) updates.push(`phone = '${safe(fields.phone)}'`);
    if (fields.avatar_url !== undefined) updates.push(`avatar_url = '${safe(fields.avatar_url)}'`);
    updates.push(`updated_at = datetime('now')`);
    sqliteDb.run(`UPDATE profiles SET ${updates.join(', ')} WHERE user_id = ${userId}`);
    saveSqliteDatabase();
    return getProfileByUserId(userId);
}

async function deleteProfile(userId) {
    if (dbMode === 'pg') {
        await pgPool.query('DELETE FROM profiles WHERE user_id = $1', [userId]);
        return;
    }
    sqliteDb.run(`DELETE FROM profiles WHERE user_id = ${userId}`);
    saveSqliteDatabase();
}

// ——— Routes ———

app.get('/health', (req, res) =>
    res.json({
        status: 'ok',
        service: 'user-json-service',
        database: dbMode === 'pg' ? 'postgresql' : 'sqlite'
    })
);

app.post('/users', async (req, res) => {
    try {
        const { user_id, name, email, bio, phone, avatar_url } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });
        if (await getProfileByUserId(user_id)) {
            return res.status(409).json({ error: 'Profile already exists for this user' });
        }
        const profile = await insertProfile({ user_id, name, email, bio, phone, avatar_url });
        res.status(201).json({ message: 'Profile created successfully', profile });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create profile', message: e.message });
    }
});

app.get('/users/:id', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (req.userId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied', message: 'You can only view your own profile' });
        }
        const profile = await getProfileByUserId(userId);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json({ profile });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get profile', message: e.message });
    }
});

app.put('/users/:id', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (req.userId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { name, email, bio, phone, avatar_url } = req.body;
        const existing = await getProfileByUserId(userId);
        if (!existing) {
            const profile = await insertProfile({
                user_id: userId,
                name: name || '',
                email: email || '',
                bio: bio || '',
                phone: phone || '',
                avatar_url: avatar_url || ''
            });
            return res.status(201).json({ message: 'Profile created successfully', profile });
        }
        const fields = {};
        if (name !== undefined) fields.name = name;
        if (email !== undefined) fields.email = email;
        if (bio !== undefined) fields.bio = bio;
        if (phone !== undefined) fields.phone = phone;
        if (avatar_url !== undefined) fields.avatar_url = avatar_url;
        const profile = await updateProfile(userId, fields);
        res.json({ message: 'Profile updated successfully', profile });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update profile', message: e.message });
    }
});

app.delete('/users/:id', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (req.userId !== userId && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (!(await getProfileByUserId(userId))) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        await deleteProfile(userId);
        res.json({ message: 'Profile deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete profile', message: e.message });
    }
});

app.get('/admin/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
    try {
        const profiles = await getAllProfiles();
        res.json({ profiles });
    } catch (e) {
        res.status(500).json({ error: 'Failed to get profiles', message: e.message });
    }
});

async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`✓ JSON Service running on port ${PORT} (db: ${dbMode})`);
    });
}

startServer().catch(console.error);

process.on('SIGINT', async () => {
    if (sqliteDb) {
        saveSqliteDatabase();
        sqliteDb.close();
    }
    if (pgPool) await pgPool.end();
    process.exit(0);
});
