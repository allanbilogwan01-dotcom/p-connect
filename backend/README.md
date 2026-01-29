# WatchGuard Backend Specification

## Overview

This document specifies the backend architecture for WatchGuard - a production-grade visitor management system for correctional facilities. The system uses a **Local Server Only (LAN)** deployment model with **PostgreSQL as the Single Source of Truth (SSOT)**.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LAN Network                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │   Browser    │     │   Browser    │     │   Browser    │   │
│   │   Client 1   │     │   Client 2   │     │   Client N   │   │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│          │                    │                    │            │
│          └────────────────────┼────────────────────┘            │
│                               │                                  │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │   Node.js API       │                      │
│                    │   (Express/Fastify) │                      │
│                    │   Port: 3001        │                      │
│                    └─────────┬───────────┘                      │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│              ▼               ▼               ▼                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│   │  PostgreSQL  │  │  FastAPI     │  │  File        │        │
│   │  Database    │  │  Biometrics  │  │  Storage     │        │
│   │  Port: 5432  │  │  Port: 8000  │  │  /uploads    │        │
│   └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Node.js API Server

**Technology**: Express.js or Fastify (your choice)
**Port**: 3001 (default)

#### Endpoints

##### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/setup-needed` | Check if initial setup is required |
| POST | `/api/auth/setup` | Initial setup with first admin user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/register` | Register new user (admin only) |
| POST | `/api/auth/change-password` | Change password |

##### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings |
| GET | `/api/settings/jail` | Get jail/facility settings |
| POST | `/api/settings/jail` | Update jail settings |
| POST | `/api/settings/jail/logo/:slot` | Upload logo (1-4) |
| GET | `/api/settings/system` | Get system settings |
| POST | `/api/settings/system` | Update system settings |

##### PDL Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pdl` | List PDL with search/filter |
| GET | `/api/pdl/:id` | Get PDL by ID |
| GET | `/api/pdl/code/:code` | Get PDL by code |
| POST | `/api/pdl` | Create PDL |
| PUT | `/api/pdl/:id` | Update PDL |
| GET | `/api/pdl/stats` | Get PDL statistics |

##### Visitors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/visitors` | List visitors |
| GET | `/api/visitors/:id` | Get visitor by ID |
| GET | `/api/visitors/code/:code` | Get visitor by code |
| POST | `/api/visitors` | Create visitor |
| PUT | `/api/visitors/:id` | Update visitor |
| GET | `/api/visitors/:id/enrollment-status` | Check biometric enrollment |

##### PDL-Visitor Links (Kin Dalaw)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/links/pdl/:pdlId` | Get links for PDL |
| GET | `/api/links/visitor/:visitorId` | Get links for visitor |
| GET | `/api/links/pending` | Get pending approvals |
| POST | `/api/links` | Create link |
| POST | `/api/links/:id/approve` | Approve link |
| POST | `/api/links/:id/reject` | Reject link |

##### Biometrics (Proxy to FastAPI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/biometrics/health` | Check biometrics service |
| POST | `/api/biometrics/quality` | Check image quality |
| POST | `/api/biometrics/enroll` | Enroll visitor biometrics |
| POST | `/api/biometrics/verify` | Verify visitor identity |
| POST | `/api/biometrics/match` | Match against all visitors |
| POST | `/api/biometrics/liveness` | Liveness detection |
| POST | `/api/biometrics/check` | Check enrollment status |
| POST | `/api/biometrics/delete` | Delete enrollment |

##### Visitation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/visits` | List visits with filters |
| GET | `/api/visits/today` | Get today's visits |
| GET | `/api/visits/active` | Get active (checked-in) visits |
| GET | `/api/visits/:id` | Get visit by ID |
| GET | `/api/visits/open/:visitorId` | Get open session for visitor |
| POST | `/api/visits/check-in` | Check-in visitor |
| POST | `/api/visits/check-out` | Check-out visitor |
| GET | `/api/visits/stats` | Get visit statistics |

##### Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | List audit logs with filters |
| GET | `/api/audit/:id` | Get audit log by ID |
| GET | `/api/audit/subject/:type/:id` | Get logs for subject |
| GET | `/api/audit/recent` | Get recent activity |

##### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Overall health check |

### 2. FastAPI Biometrics Service

**Technology**: Python FastAPI with ArcFace/ONNX
**Port**: 8000 (default)

#### Models Required

- **YuNet ONNX** - Face detection
- **ArcFace ONNX (w600k_r50)** - Face embedding (512 dimensions)

#### Endpoints

```python
# GET /health
{
    "status": "healthy",
    "version": "1.0.0",
    "models_loaded": true,
    "detector": "yunet_2023mar",
    "recognizer": "arcface_w600k_r50",
    "uptime_seconds": 3600
}

# POST /quality
# Input: { "imageBase64": "..." }
# Output:
{
    "ok": true,
    "reason": "",
    "metrics": {
        "num_faces": 1,
        "det_score": 0.95,
        "blur": 0.1,
        "brightness": 0.8,
        "face_size": 0.25
    },
    "overall_score": 0.92,
    "face_confidence": 0.95
}

# POST /enroll
# Input: { "subjectType": "visitor", "subjectId": "uuid", "samples": ["base64...", ...] }
# Output:
{
    "ok": true,
    "subject_id": "uuid",
    "samples_processed": 5,
    "template_id": "uuid",
    "message": "Enrollment successful"
}

# POST /verify
# Input: { "subjectType": "visitor", "subjectId": "uuid", "imageBase64": "..." }
# Output:
{
    "ok": true,
    "match": true,
    "score": 0.85,
    "decision": "pass",
    "message": "Identity verified"
}

# POST /match
# Input: { "subjectType": "visitor", "imageBase64": "...", "topK": 5 }
# Output:
{
    "ok": true,
    "candidates": [
        { "subject_id": "uuid", "visitor_id": "uuid", "score": 0.85, "decision": "match" }
    ],
    "best_match": { ... },
    "message": "Match found"
}

# POST /liveness
# Input: { "frames": ["base64...", ...] }
# Output:
{
    "ok": true,
    "live": true,
    "score": 0.9,
    "checks": {
        "blink_detected": true,
        "head_movement": true,
        "texture_analysis": true
    },
    "message": "Liveness confirmed"
}
```

### 3. PostgreSQL Database

See `backend/migrations/001_initial_schema.sql` for complete schema.

### 4. File Storage

```
/uploads/
├── logos/
│   ├── logo1.png
│   ├── logo2.png
│   ├── logo3.png
│   └── logo4.png
└── temp/
    └── (temporary upload files)
```

## Environment Variables

### API Server (.env)

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://watchguard:password@localhost:5432/watchguard
DB_HOST=localhost
DB_PORT=5432
DB_NAME=watchguard
DB_USER=watchguard
DB_PASSWORD=your_secure_password

# Biometrics Service
BIOMETRICS_URL=http://localhost:8000

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# CORS (for LAN access)
CORS_ORIGINS=http://localhost:8080,http://192.168.1.100:8080
```

### Biometrics Service (.env)

```env
# Server
HOST=0.0.0.0
PORT=8000

# Models
MODEL_DIR=./models
DETECTOR_MODEL=yunet_2023mar.onnx
RECOGNIZER_MODEL=w600k_r50.onnx

# Database (for storing embeddings)
DATABASE_URL=postgresql://watchguard:password@localhost:5432/watchguard

# Thresholds
MATCH_THRESHOLD=0.6
QUALITY_THRESHOLD=0.7
MIN_FACE_SIZE=100
```

## Security Considerations

1. **No sensitive data in browser storage** - Only auth tokens and UI preferences
2. **Biometric embeddings never exposed** - All matching is server-side
3. **PDL privacy** - No face photos or case numbers stored
4. **Password hashing** - bcrypt with salt
5. **JWT authentication** - Short-lived tokens with refresh
6. **Audit logging** - All actions logged with user context

## Offline Behavior

The PWA frontend handles offline scenarios:

1. **Allowed offline**:
   - View cached data
   - Queue QR/manual check-ins for sync
   - UI preferences

2. **Requires server**:
   - Biometric enrollment
   - Biometric verification
   - New record creation
   - Audit log viewing

## Deployment

See `docs/DEPLOY_PROD_LAN.md` for deployment instructions.
