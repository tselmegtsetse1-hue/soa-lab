# Lab 07: Cloud Deployment & File Manager (Lab 06 дээр суурилсан)

## 1. Даалгаварын хураангуй

| # | Агуулга |
|---|---------|
| 1 | Lab 06 (JSON, SOAP, Frontend) — DigitalOcean дээр deploy |
| 2 | Cloud Database (SQLite localhost ажиллахгүй) |
| 3 | **File Manager Service** — Spaces руу зураг upload + **SOAP token** шаардлагатай |

---

## 2. Өгөгдлийн сангийн шилжилт

Local `auth.db` / `profile.db` нь зөвхөн таны PC дээр ажиллана. Cloud дээр **Managed Database** эсвэл **MongoDB Atlas (free)** ашиглана.

**Орчны хувьсагч (жишээ PostgreSQL):**

```env
DATABASE_URL=postgresql://user:pass@host:25060/defaultdb?sslmode=require
```

JSON/SOAP сервисүүдийн кодыг cloud DB руу шилжүүлэхэд `pg` эсвэл `mongodb` драйвер ашиглаж, `process.env.DATABASE_URL`-аас уншина (кодонд нууц бичихгүй).

---

## 3. Deploy — DigitalOcean

### 3.1 Бэлтгэл

1. [GitHub Student Pack](https://education.github.com/pack) — DO кредит
2. DigitalOcean account — төсөл үүсгэх
3. Lab 06-ын сервис бүрийг **тусдаа GitHub repo** руу push (эсвэл monorepo + олон App)

### 3.2 User JSON Service — App Platform

1. **Create → Apps → GitHub** холбох
2. **Environment Variables** (жишээ):

   | Key | Утга |
   |-----|------|
   | `PORT` | `3000` (эсвэл платформын default) |
   | `SOAP_WSDL_URL` | `https://your-soap-droplet/wsdl?wsdl` |
   | `DATABASE_URL` | PostgreSQL connection string |

3. **Auto-deploy on push** идэвхжүүлэх

### 3.3 Frontend — Static Site (үнэгүй tier)

1. Deploy-ийн өмнө `frontend-app/config.js` дотор **localhost биш**, cloud URL-ууд оруулна:

```javascript
window.SOA_CONFIG = {
  JSON_API_URL: 'https://your-json-app.ondigitalocean.app',
  SOAP_PROXY_URL: 'https://your-soap-droplet',
  FILE_API_URL: 'https://your-file-manager.ondigitalocean.app'
};
```

2. **App Platform → Static Site** — repo-ийн `frontend-app` хавтас сонгоно.

### 3.4 User SOAP Service — Droplet (VPS)

1. **Create → Droplet** — Docker image эсвэл Ubuntu
2. SSH: `ssh root@YOUR_IP`
3. `git clone` → `docker build` / `npm install` → `npm start`
4. **Networking → Firewalls** — порт **4000** (эсвэл nginx reverse proxy 443)
5. `SOAP_WSDL_URL` бусад сервисүүдэд энэ public URL байна

### 3.5 File Manager Service (шинэ)

1. **App Platform** эсвэл **Droplet** — `file-manager-service/`
2. Environment:

| Key | Тайлбар |
|-----|---------|
| `SOAP_WSDL_URL` | SOAP сервисийн WSDL (public) |
| `SPACES_ENDPOINT` | жишээ: `https://sgp1.digitaloceanspaces.com` |
| `SPACES_REGION` | `sgp1` гэх мэт |
| `SPACES_BUCKET` | Spaces bucket нэр |
| `SPACES_KEY` / `SPACES_SECRET` | API → Tokens (кодонд бичихгүй!) |
| `SPACES_PUBLIC_BASE` | (заавал биш) CDN/public URL |

3. **Spaces:** Create → Spaces → бүс (Singapore) — Keys үүсгэх

---

## 4. Local туршилт (Spaces түлхүүртэй)

```bash
cd file-manager-service
copy .env.example .env
# .env засварлана
npm install
npm start
```

Зураг upload: `POST http://localhost:3001/upload`  
Header: `Authorization: Bearer <login-оос авсан JWT>`  
Body: `multipart/form-data`, field нэр: `file`

Амжилттай хариу: `{ "url": "https://..." }` — энийг **JSON service** `PUT /users/:id` дээр `avatar_url` болгон хадгална.

---

## 5. Илгээх зүйлс (Deliverables checklist)

- [ ] Architecture diagram (cloud) — `docs/architecture-lab07-cloud.html`
- [ ] Live URLs (frontend + API)
- [ ] Database: cloud DB-тай холбогдсон log/screenshot
- [ ] File upload: Spaces дотор зураг харагдаж буй screenshot
- [ ] PDF: `Lab07_SOA_[ТаныКод].pdf`

---

## 6. Аюулгүй байдал

- Spaces Key / Secret, DB нууц — **зөвхөн environment variables**
- GitHub дээр `.env` **хэзээ ч** push хийхгүй (`.gitignore`)
