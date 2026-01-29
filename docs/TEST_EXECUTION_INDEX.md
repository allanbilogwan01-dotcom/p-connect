# WatchGuard Test Execution Index

## GO/NO-GO Checklist

Complete all tests before production deployment.

---

## Phase 1: Infrastructure Tests

### Database Connection

- [ ] PostgreSQL service running
- [ ] Connection from backend successful
- [ ] Migrations applied without errors
- [ ] Seed data populated

**Test Command:**
```bash
cd backend && npm run migrate
psql -h localhost -U watchguard -d watchguard -c "SELECT COUNT(*) FROM users;"
```

**Expected:** Returns `1` (default admin user)

---

### Biometrics Service

- [ ] Service starts without errors
- [ ] Models loaded successfully
- [ ] Health endpoint returns OK

**Test Command:**
```bash
curl http://localhost:8000/health
```

**Expected:**
```json
{"ok": true, "version": "1.0.0", "models_loaded": true, ...}
```

---

### Backend API

- [ ] Express server starts
- [ ] Health endpoint shows all checks passing
- [ ] CORS configured correctly

**Test Command:**
```bash
curl http://localhost:3001/api/health
```

**Expected:**
```json
{"status": "ok", "checks": {"database": {"status": "healthy"}, "biometrics": {"status": "healthy"}}}
```

---

## Phase 2: Authentication Tests

### Admin Login

- [ ] Login with default credentials works
- [ ] JWT token returned
- [ ] Token valid for protected routes

**Test Command:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Expected:** Returns `{ "token": "...", "user": {...} }`

---

### Protected Routes

- [ ] Unauthenticated requests return 401
- [ ] Authenticated requests succeed
- [ ] Role-based access enforced

---

## Phase 3: PDL Management Tests

### Create PDL

- [ ] POST /api/pdl creates record
- [ ] PDL code auto-generated
- [ ] Audit log created

**Test:**
```bash
curl -X POST http://localhost:3001/api/pdl \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "JOHN", "last_name": "DOE", "sex": "male"}'
```

---

### List/Search PDL

- [ ] GET /api/pdl returns paginated list
- [ ] Search by name works
- [ ] Filter by status works

---

## Phase 4: Visitor Management Tests

### Create Visitor

- [ ] POST /api/visitors creates record
- [ ] 10-digit visitor code generated
- [ ] Sex field properly stored

---

### PDL-Visitor Link (Kin Dalaw)

- [ ] Create link succeeds
- [ ] Link starts as "pending"
- [ ] Approval updates status
- [ ] Duplicate links rejected

---

## Phase 5: Biometrics Tests

### Quality Check

- [ ] Returns metrics for valid face image
- [ ] Rejects images with no face
- [ ] Rejects images with multiple faces

**Test (from frontend):**
1. Go to Settings > Camera Test
2. Click "Run Diagnostic Tests"
3. Verify all 5 tests pass

---

### Enrollment

- [ ] Minimum 3 samples required
- [ ] Quality gate rejects poor samples
- [ ] Embeddings stored server-side

**Test:**
1. Create a visitor
2. Start biometric enrollment
3. Capture 5 face samples
4. Verify "Enrolled" status

---

### Verification (1:1)

- [ ] Returns match for enrolled face
- [ ] Returns no-match for different person
- [ ] Score above threshold

---

### Matching (1:N)

- [ ] Returns best match from enrolled visitors
- [ ] Returns empty if no match above threshold

---

## Phase 6: Visitation Tests

### Check-In

- [ ] Creates active session
- [ ] Prevents duplicate active session
- [ ] Audit log created

---

### Check-Out

- [ ] Updates session with check-out time
- [ ] Session no longer in active list
- [ ] Audit log created

---

## Phase 7: Camera Tests (Frontend)

### Camera Access

- [ ] Permissions requested
- [ ] Camera list populated
- [ ] Camera switching works

---

### QR Scanning

- [ ] QR reader starts
- [ ] Scans visitor QR code
- [ ] Looks up visitor correctly

---

### Face Scanning

- [ ] Camera preview shows
- [ ] Face overlay visible
- [ ] Match result displayed

---

## Phase 8: PWA Tests

### Installation

- [ ] Install prompt appears
- [ ] App installs to device
- [ ] Opens in standalone mode

---

### Offline Behavior

- [ ] App loads when offline
- [ ] Shows offline indicator
- [ ] Biometrics blocked (expected)

---

## Phase 9: Security Tests

### Authentication

- [ ] Invalid credentials rejected
- [ ] Inactive accounts cannot login
- [ ] JWT expiration enforced

---

### Authorization

- [ ] Staff cannot access admin routes
- [ ] Guest limited to visitation only
- [ ] Audit logs cannot be modified

---

### Input Validation

- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] Invalid UUIDs rejected

---

## Summary

| Phase | Tests | Status |
|-------|-------|--------|
| Infrastructure | 4 | ☐ |
| Authentication | 3 | ☐ |
| PDL Management | 3 | ☐ |
| Visitor Management | 3 | ☐ |
| Biometrics | 4 | ☐ |
| Visitation | 3 | ☐ |
| Camera | 3 | ☐ |
| PWA | 3 | ☐ |
| Security | 4 | ☐ |

**Total: 30 test categories**

---

## Sign-Off

- [ ] All tests passing
- [ ] Documentation reviewed
- [ ] Backup procedures verified
- [ ] Staff trained

**GO / NO-GO Decision:** ___________

**Approved By:** ___________

**Date:** ___________
