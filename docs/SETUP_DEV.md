# WatchGuard Development & Deployment Guide

## Quick Start

### Prerequisites

- **Windows/Linux/macOS**
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### 1. Clone & Setup

```bash
# Clone the repository
git clone <repo-url>
cd watchguard

# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install

# Biometrics service
cd biometrics_service
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb watchguard

# Or using psql
psql -U postgres -c "CREATE DATABASE watchguard;"
psql -U postgres -c "CREATE USER watchguard WITH PASSWORD 'yourpassword';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE watchguard TO watchguard;"

# Run migrations
cd backend
cp .env.example .env
# Edit .env with your database credentials
npm run migrate

# Seed default data
npm run seed
```

### 3. Download Biometric Models

```bash
cd backend/biometrics_service/models

# YuNet detector (face detection)
curl -L -o yunet_n_640_640.onnx \
  https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx

# ArcFace embedder (w600k_r50)
# Download from InsightFace model zoo or use:
curl -L -o w600k_r50.onnx \
  https://github.com/deepinsight/insightface/releases/download/v0.7/w600k_r50.onnx
```

### 4. Start All Services

**Option A: Manual Start**

```bash
# Terminal 1: Biometrics Service
cd backend/biometrics_service
python main.py

# Terminal 2: Backend API
cd backend
npm run dev

# Terminal 3: Frontend
npm run dev
```

**Option B: Using Scripts (Windows)**

```powershell
.\scripts\start_dev_all.ps1
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Biometrics**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Default Login

- **Username**: admin
- **Password**: admin123

---

## Production Deployment (LAN)

### Server Requirements

- Windows Server 2019+ or Ubuntu 22.04+
- 8GB RAM minimum
- 100GB SSD storage
- Dedicated GPU optional (improves biometrics speed)

### 1. Install Dependencies

**Windows (using Chocolatey):**

```powershell
choco install nodejs postgresql python
```

**Ubuntu:**

```bash
sudo apt update
sudo apt install nodejs npm postgresql python3 python3-pip
```

### 2. Configure PostgreSQL

```sql
-- Connect as postgres user
CREATE DATABASE watchguard;
CREATE USER watchguard WITH ENCRYPTED PASSWORD 'strongpassword';
GRANT ALL PRIVILEGES ON DATABASE watchguard TO watchguard;
```

### 3. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```ini
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://watchguard:strongpassword@localhost:5432/watchguard
JWT_SECRET=<generate-with-openssl-rand-base64-32>
BIOMETRICS_URL=http://localhost:8000
CORS_ORIGINS=http://192.168.1.100:8080
```

### 4. Build & Deploy

```bash
# Build frontend
npm run build

# Build backend
cd backend
npm run build

# Serve with PM2
npm install -g pm2
pm2 start dist/index.js --name watchguard-api
pm2 start biometrics_service/main.py --interpreter python3 --name watchguard-bio
pm2 save
pm2 startup
```

### 5. Serve Frontend

Use Nginx or serve directly:

```bash
npm install -g serve
serve -s dist -l 8080
```

---

## API Reference

### Authentication

```
POST /api/auth/login         - Login
POST /api/auth/logout        - Logout
GET  /api/auth/me            - Current user
POST /api/auth/register      - Create user (admin only)
```

### PDL (Person Deprived of Liberty)

```
GET  /api/pdl                - List PDLs
GET  /api/pdl/:id            - Get PDL by ID
GET  /api/pdl/code/:code     - Get PDL by code
POST /api/pdl                - Create PDL
PUT  /api/pdl/:id            - Update PDL
GET  /api/pdl/stats          - Get statistics
```

### Visitors

```
GET  /api/visitors           - List visitors
GET  /api/visitors/:id       - Get visitor
POST /api/visitors           - Create visitor
PUT  /api/visitors/:id       - Update visitor
```

### Biometrics

```
GET  /api/biometrics/health  - Service health
POST /api/biometrics/quality - Check image quality
POST /api/biometrics/enroll  - Enroll visitor
POST /api/biometrics/verify  - Verify 1:1
POST /api/biometrics/match   - Match 1:N
POST /api/biometrics/liveness - Liveness check
```

### Visitation

```
GET  /api/visits             - List visits
GET  /api/visits/active      - Active sessions
POST /api/visits/check-in    - Check in
POST /api/visits/:id/check-out - Check out
```

---

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
systemctl status postgresql

# Test connection
psql -h localhost -U watchguard -d watchguard
```

### Biometrics Service Not Starting

```bash
# Check Python dependencies
pip install -r requirements.txt

# Verify models exist
ls backend/biometrics_service/models/
```

### Camera Not Working

1. Check browser permissions
2. Use HTTPS in production
3. Test with Camera Test in Settings

### Face Detection Failing

1. Ensure good lighting
2. Face should be at least 80px
3. Single face in frame
4. Check biometrics service logs

---

## GO/NO-GO Checklist

Before going live, verify:

- [ ] PostgreSQL connected and migrations applied
- [ ] Biometrics service healthy (`/health` returns ok)
- [ ] Backend API responding (`/api/health`)
- [ ] Admin can login
- [ ] PDL CRUD works
- [ ] Visitor enrollment works
- [ ] Face capture working
- [ ] Biometric enrollment successful
- [ ] Biometric verification accurate
- [ ] Visitation check-in/out works
- [ ] Audit logs recording
- [ ] Camera test passes all checks
- [ ] PWA installable on devices
- [ ] CORS configured for LAN IPs
