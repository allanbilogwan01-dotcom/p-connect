# WatchGuard Deployment Guide - Windows LAN with Laragon

This guide covers deploying WatchGuard on a Windows PC/Laptop server using Laragon for LAN-only access.

## Prerequisites

- Windows 10/11 PC or Laptop (Server)
- [Laragon Full](https://laragon.org/download/) installed
- MySQL/MariaDB enabled in Laragon
- Python 3.9+ (for biometrics service)
- LAN network connectivity

## Project Structure

```
watchguard/
├── web/                  # React PWA frontend
├── api/                  # PHP backend (create this)
├── biometrics_service/   # Python face recognition (create this)
├── storage/              # Runtime created
│   ├── uploads/
│   ├── backups/
│   └── logs/
└── docs/                 # Documentation
```

## Step 1: Laragon Setup

1. Install Laragon Full from https://laragon.org
2. Start Laragon and ensure Apache/Nginx and MySQL are running
3. Create a new project folder in `C:\laragon\www\watchguard`

## Step 2: Frontend Build

```bash
cd web
npm install
npm run build
```

Copy the `dist/` folder contents to `C:\laragon\www\watchguard\public`

## Step 3: Configure Virtual Host

Laragon auto-creates virtual hosts. Access at:
- http://watchguard.test (local)
- http://192.168.x.x/watchguard (LAN clients)

## Step 4: Database Setup

1. Open Laragon → Database → Open HeidiSQL
2. Create database: `watchguard`
3. Import schema from `/api/db/schema.sql`

## Step 5: Configure .env

Create `C:\laragon\www\watchguard\api\.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=watchguard
DB_USERNAME=root
DB_PASSWORD=
STORAGE_PATH=C:/laragon/www/watchguard/storage
```

## Step 6: Windows Firewall

Allow incoming connections on port 80:

```powershell
netsh advfirewall firewall add rule name="WatchGuard HTTP" dir=in action=allow protocol=TCP localport=80
```

## Step 7: LAN Client Access

Clients connect via: `http://<SERVER_IP>/watchguard`

Find server IP with: `ipconfig`

## Step 8: Biometrics Service (Optional)

See `/docs/BIOMETRICS_OFFLINE.md` for Python InsightFace setup.

## Troubleshooting

### Cannot Connect from LAN
- Check Windows Firewall settings
- Verify Laragon is using 0.0.0.0 not 127.0.0.1
- Test with `ping <server-ip>` from client

### Database Connection Failed
- Ensure MySQL is running in Laragon
- Check `.env` credentials
- Verify database exists

### Slow Performance
- Enable PHP OPcache in Laragon
- Increase MySQL buffer pool size
- Use SSD storage for database

## Production Checklist

- [ ] Change default admin password
- [ ] Configure backup schedules
- [ ] Set up UPS for server
- [ ] Document server IP for clients
- [ ] Test offline operation
- [ ] Verify face recognition accuracy
