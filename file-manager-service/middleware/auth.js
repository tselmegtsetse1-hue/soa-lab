/**
 * Lab07: SOAP ValidateToken — required for all file uploads (per assignment).
 */
const soap = require('soap');

const SOAP_WSDL_URL = process.env.SOAP_WSDL_URL || 'http://localhost:4000/wsdl?wsdl';

let soapClient = null;

async function initSoapClient() {
    if (!soapClient) {
        soapClient = await soap.createClientAsync(SOAP_WSDL_URL);
    }
    return soapClient;
}

async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization required', message: 'Send Bearer token (SOAP JWT)' });
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ error: 'Use Authorization: Bearer <token>' });
        }
        const client = await initSoapClient();
        const [result] = await client.ValidateTokenAsync({ token: parts[1] });
        if (!result.valid) {
            return res.status(401).json({ error: 'Invalid token', message: result.message });
        }
        req.userId = result.userId;
        req.userRole = result.role;
        next();
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'SOAP auth service unavailable' });
        }
        return res.status(500).json({ error: 'Auth failed', message: error.message });
    }
}

module.exports = { authMiddleware, initSoapClient };
