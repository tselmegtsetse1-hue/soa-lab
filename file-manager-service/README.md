# File Manager Service (Lab 07)

- **POST** `/upload` — `multipart/form-data`, field `file`
- **Header:** `Authorization: Bearer <SOAP JWT>`
- **Response:** `{ url, key }` — use `url` as `avatar_url` in JSON profile API

Requires DigitalOcean Spaces (S3-compatible). Copy `.env.example` → `.env`.

```bash
npm install
npm start
```

Do not commit `.env` or API keys.
