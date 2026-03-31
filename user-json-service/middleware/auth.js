/**
 * Authentication Middleware — JSON Service
 * Validates Bearer token via SOAP ValidateToken.
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
            return res.status(401).json({ error: 'Authorization header is required' });
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
        }
        const token = parts[1];
        const client = await initSoapClient();
        const [result] = await client.ValidateTokenAsync({ token });
        if (!result.valid) {
            return res.status(401).json({ error: 'Invalid or expired token', message: result.message });
        }
        req.userId = result.userId;
        req.userRole = result.role;
        next();
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        return res.status(500).json({ error: 'Authentication failed', message: error.message });
    }
}

function roleMiddleware(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(403).json({ error: 'Access denied', message: 'No role information available' });
        }
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ error: 'Access denied', message: `Required role: ${roles.join(' or ')}` });
        }
        next();
    };
}

module.exports = { authMiddleware, roleMiddleware, initSoapClient };
