/**
 * File Manager Service — Lab 07
 * Uploads images to DigitalOcean Spaces (S3-compatible).
 * Secrets ONLY via environment variables — never commit keys.
 *
 * Auth: Every upload requires SOAP JWT (ValidateToken via middleware).
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT;
const SPACES_BUCKET = process.env.SPACES_BUCKET;
const SPACES_REGION = process.env.SPACES_REGION || 'sgp1';
const SPACES_KEY = process.env.SPACES_KEY;
const SPACES_SECRET = process.env.SPACES_SECRET;
const SPACES_PUBLIC_BASE = process.env.SPACES_PUBLIC_BASE;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
        cb(ok ? null : new Error('Only image files allowed'), ok);
    }
});

app.use(cors());
app.use(express.json());

let s3 = null;
function getS3() {
    if (!SPACES_KEY || !SPACES_SECRET || !SPACES_ENDPOINT) {
        return null;
    }
    if (!s3) {
        s3 = new S3Client({
            region: SPACES_REGION,
            endpoint: SPACES_ENDPOINT,
            credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
            forcePathStyle: false
        });
    }
    return s3;
}

/**
 * POST /upload — multipart field name: "file"
 * Header: Authorization: Bearer <SOAP JWT>
 * Returns: { url, key } — save url in profile.avatar_url (JSON service)
 */
app.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const client = getS3();
        if (!client || !SPACES_BUCKET) {
            return res.status(503).json({
                error: 'Object storage not configured',
                hint: 'Set SPACES_ENDPOINT, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET in .env'
            });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file field "file"' });
        }

        const ext = (req.file.originalname || 'image').split('.').pop() || 'jpg';
        const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const key = `uploads/${req.userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;

        await client.send(
            new PutObjectCommand({
                Bucket: SPACES_BUCKET,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            })
        );

        const base =
            SPACES_PUBLIC_BASE ||
            `${SPACES_ENDPOINT.replace(/\/$/, '')}/${SPACES_BUCKET}`;
        const url = `${base.replace(/\/$/, '')}/${key}`;

        res.json({
            success: true,
            url,
            key,
            message: 'Save this url in profile (PUT /users/:id avatar_url)'
        });
    } catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ error: 'Upload failed', message: e.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'file-manager-service',
        spacesConfigured: !!(getS3() && SPACES_BUCKET)
    });
});

app.listen(PORT, () => {
    console.log(`File Manager Service on port ${PORT}`);
    console.log('POST /upload — requires Authorization: Bearer <SOAP JWT>');
});
