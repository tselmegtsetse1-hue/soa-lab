# Lab 07 — Quick link (Cloud + File Manager)

Built on **Lab 06** (JSON + SOAP + Frontend).

| Item | Location |
|------|----------|
| Full guide | [docs/Lab07-CloudDeployment.md](docs/Lab07-CloudDeployment.md) |
| Cloud architecture (screenshot for PDF) | [docs/architecture-lab07-cloud.html](docs/architecture-lab07-cloud.html) |
| Frontend upload wiring | [docs/LAB07-FRONTEND-INTEGRATION.md](docs/LAB07-FRONTEND-INTEGRATION.md) |
| New service | `file-manager-service/` |

**Run locally (after Lab 06 SOAP + JSON):**

```bash
cd file-manager-service && npm install && npm start
# Port 3001 — set Spaces vars in .env for real uploads
```

**Deploy:** See `docs/Lab07-CloudDeployment.md` (DigitalOcean App Platform, Droplet, Spaces).
