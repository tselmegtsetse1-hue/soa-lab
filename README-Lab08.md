# Lab 08 — Quick link (API Gateway + Redis + VPC)

| Item | Location |
|------|----------|
| Gateway service | `api-gateway/` |
| Lab 08 guide | `docs/Lab08-API-Gateway-Redis-VPC.md` |
| Architecture HTML (PDF screenshot) | `docs/architecture-lab08-gateway.html` |

## Quick start

```bash
# On gateway server
sudo apt update && sudo apt install -y redis-server
redis-cli ping

cd api-gateway
copy .env.example .env
npm install
npm start
```

Frontend config:

```javascript
window.SOA_CONFIG = {
  GATEWAY_URL: 'http://<gateway-ip>:5000'
};
```
