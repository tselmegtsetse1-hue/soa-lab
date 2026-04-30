# Lab 08 — API Gateway, Redis Caching, VPC Security

## 1) Шинэ сервис: `api-gateway/`

Gateway нь бүх хүсэлтийг нэг цэгээр хүлээж дотоод сервис рүү дамжуулна:

- `/api/users/**` -> JSON service
- `/api/soap/**` -> SOAP service
- `/api/files/**` -> File Manager

## 2) Redis cache

`GET /api/users/**` хүсэлтүүд Redis-д 60 сек хадгалагдана.

- Cache Hit -> Redis-ээс буцаана
- Cache Miss -> Backend рүү явж cache-д хадгална

Gateway log жишээ:

- `[Cache Hit] /api/users/1`
- `[Cache Miss] /api/users/1 -> cached 60s`

## 3) Local setup

```bash
sudo apt update
sudo apt install -y redis-server
redis-cli ping
# PONG
```

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

## 4) Frontend update (Lab08)

`frontend-app/config.js`:

```javascript
window.SOA_CONFIG = {
  GATEWAY_URL: 'http://<GATEWAY_PUBLIC_IP>:5000'
};
```

`app.js` дээр gateway URL байвал автоматаар:

- JSON -> `/api`
- SOAP -> `/api/soap`
- File -> `/api/files`

## 5) VPC + Firewall checklist

- JSON/SOAP/File droplet-үүдийг нэг VPC-д
- Internal services inbound: зөвхөн gateway private IP (эсвэл tag)
- Public-оос зөвхөн gateway (5000) нээлттэй

## 6) Deliverables (PDF)

1. VPC architecture screenshot
2. Firewall screenshot (gateway-only inbound)
3. Cache Hit / Cache Miss gateway logs
4. Postman response time comparison (cache miss vs hit)
