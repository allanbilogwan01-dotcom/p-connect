# WatchGuard LAN Production Deployment

Complete guide for deploying WatchGuard in a LAN-only correctional facility environment.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    LAN Network (192.168.x.x)                │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ PostgreSQL  │    │   Backend   │    │ Biometrics  │     │
│  │   :5432     │◄──►│   :3001     │◄──►│   :8000     │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                            │                                │
│                     ┌──────┴──────┐                        │
│                     │   Nginx     │                        │
│                     │   :80/443   │                        │
│                     └──────┬──────┘                        │
│                            │                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  Tablet  │    │  Desktop │    │  Kiosk   │             │
│  │  (PWA)   │    │ (Browser)│    │  (PWA)   │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Server Requirements

### Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Storage | 100 GB SSD | 500+ GB SSD |
| GPU | None | NVIDIA (for faster biometrics) |

### Software

- Windows Server 2019+ or Ubuntu 22.04 LTS
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- Nginx (reverse proxy)

---

## Step 1: Server Preparation

### Windows Server

```powershell
# Install Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install dependencies
choco install nodejs python postgresql nginx -y

# Create service user
net user watchguard <password> /add
```

### Ubuntu Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs python3 python3-pip postgresql nginx

# Create service user
sudo useradd -m -s /bin/bash watchguard
```

---

## Step 2: Database Setup

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE watchguard;
CREATE USER watchguard WITH ENCRYPTED PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE watchguard TO watchguard;
\c watchguard
GRANT ALL ON SCHEMA public TO watchguard;
EOF
```

---

## Step 3: Application Deployment

### Clone Repository

```bash
cd /opt
sudo git clone <repository-url> watchguard
sudo chown -R watchguard:watchguard watchguard
```

### Install Dependencies

```bash
cd /opt/watchguard

# Frontend
npm install
npm run build

# Backend
cd backend
npm install
npm run build

# Biometrics
cd biometrics_service
pip3 install -r requirements.txt
```

### Configure Environment

```bash
# Backend configuration
cat > /opt/watchguard/backend/.env << EOF
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
DATABASE_URL=postgresql://watchguard:your-strong-password@localhost:5432/watchguard
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
BIOMETRICS_URL=http://127.0.0.1:8000
CORS_ORIGINS=http://192.168.1.100
UPLOAD_DIR=/opt/watchguard/uploads
EOF

# Biometrics configuration
cat > /opt/watchguard/backend/biometrics_service/.env << EOF
HOST=127.0.0.1
PORT=8000
DETECTOR_MODEL=models/yunet_n_640_640.onnx
EMBEDDER_MODEL=models/w600k_r50.onnx
MATCH_THRESHOLD=0.45
DATABASE_URL=postgresql://watchguard:your-strong-password@localhost:5432/watchguard
EOF
```

### Run Migrations

```bash
cd /opt/watchguard/backend
npm run migrate
npm run seed
```

---

## Step 4: Process Management (PM2)

```bash
# Install PM2
sudo npm install -g pm2

# Start services
cd /opt/watchguard/backend
pm2 start dist/index.js --name watchguard-api

cd biometrics_service
pm2 start main.py --interpreter python3 --name watchguard-bio

# Save and configure startup
pm2 save
pm2 startup
```

---

## Step 5: Nginx Configuration

```nginx
# /etc/nginx/sites-available/watchguard
server {
    listen 80;
    server_name 192.168.1.100;  # Your LAN IP

    # Frontend
    location / {
        root /opt/watchguard/dist;
        try_files $uri $uri/ /index.html;
        
        # PWA headers
        add_header Service-Worker-Allowed /;
        add_header Cache-Control "public, max-age=31536000";
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Large file uploads (biometric images)
        client_max_body_size 50M;
    }

    # Uploaded files
    location /uploads/ {
        alias /opt/watchguard/uploads/;
    }

    # Manifest and service worker
    location /manifest.json {
        root /opt/watchguard/dist;
        add_header Content-Type application/manifest+json;
    }

    location /sw.js {
        root /opt/watchguard/dist;
        add_header Content-Type application/javascript;
        add_header Service-Worker-Allowed /;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/watchguard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 6: Firewall Configuration

### Windows

```powershell
netsh advfirewall firewall add rule name="WatchGuard HTTP" dir=in action=allow protocol=tcp localport=80
netsh advfirewall firewall add rule name="WatchGuard HTTPS" dir=in action=allow protocol=tcp localport=443
```

### Ubuntu (UFW)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Step 7: SSL/TLS (Optional but Recommended)

For HTTPS within LAN, generate a self-signed certificate:

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/watchguard.key \
    -out /etc/ssl/certs/watchguard.crt \
    -subj "/CN=192.168.1.100"
```

Update Nginx to use SSL:

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/watchguard.crt;
    ssl_certificate_key /etc/ssl/private/watchguard.key;
    # ... rest of config
}
```

---

## Step 8: Client Device Setup

### Desktop Browsers

Navigate to `http://192.168.1.100` (or your server IP).

### Tablets/Mobile (PWA)

1. Open Chrome/Edge on the device
2. Navigate to `http://192.168.1.100`
3. Tap "Add to Home Screen" or look for install prompt
4. App will launch in fullscreen mode

### Dedicated Kiosk Mode (Chrome)

```bash
# Launch Chrome in kiosk mode
chrome.exe --kiosk --app=http://192.168.1.100
```

---

## Monitoring & Maintenance

### Check Service Status

```bash
pm2 status
pm2 logs watchguard-api
pm2 logs watchguard-bio
```

### Database Backup

```bash
# Manual backup
pg_dump -U watchguard watchguard > backup-$(date +%Y%m%d).sql

# Automated daily backup (cron)
0 2 * * * pg_dump -U watchguard watchguard | gzip > /backups/watchguard-$(date +\%Y\%m\%d).sql.gz
```

### Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
pm2 logs watchguard-api --lines 50

# Check port availability
netstat -tlnp | grep 3001
```

### Database Connection Failed

```bash
# Test connection
psql -h localhost -U watchguard -d watchguard -c "SELECT 1;"

# Check PostgreSQL status
systemctl status postgresql
```

### Biometrics Not Working

1. Verify models exist in `backend/biometrics_service/models/`
2. Check service health: `curl http://localhost:8000/health`
3. Verify Python dependencies installed

### Camera Not Working on Clients

1. Ensure using HTTP**S** or localhost (browser security)
2. Check browser permissions
3. Use Camera Test in Settings to diagnose

---

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong PostgreSQL password
- [ ] Generate unique JWT_SECRET
- [ ] Enable firewall, allow only needed ports
- [ ] Use HTTPS even on LAN
- [ ] Regular database backups
- [ ] Monitor audit logs
- [ ] Update dependencies regularly
