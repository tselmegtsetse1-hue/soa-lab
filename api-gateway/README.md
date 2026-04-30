# API Gateway (Lab 08)

Single entry point for all services:

- `/api/users/**` -> User JSON Service
- `/api/soap/**` -> User SOAP Service
- `/api/files/**` -> File Manager Service

Redis cache is applied for `GET /api/users/**` requests.

## Run locally

```bash
cd api-gateway
copy .env.example .env
npm install
npm start
```

Health:

```bash
http://localhost:5000/health
```

## Redis setup (Ubuntu)

```bash
sudo apt update
sudo apt install -y redis-server
redis-cli ping
# PONG
```

## Frontend (Lab 08)

In `frontend-app/config.js`, set:

```javascript
window.SOA_CONFIG = {
  GATEWAY_URL: 'http://<GATEWAY_IP>:5000'
};
```

The frontend will automatically route to:

- JSON: `GATEWAY_URL + /api`
- SOAP: `GATEWAY_URL + /api/soap`
- Files: `GATEWAY_URL + /api/files`

## Cache logs

Gateway logs:

- `[Cache Hit] /api/users/...`
- `[Cache Miss] /api/users/... -> cached 60s`
