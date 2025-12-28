# WatchGuard Backup & Restore Guide

## Overview

WatchGuard supports scheduled and manual backups. All backups are stored locally and can be downloaded as ZIP files.

## Backup Types

| Type | Frequency | Contents |
|------|-----------|----------|
| Manual | On-demand | Full system snapshot |
| Monthly | 1st of month | Full backup |
| Semestral | Jan 1, Jul 1 | Full backup |
| Yearly | Jan 1 | Full backup + archive |

## Backup Contents

Each backup ZIP includes:

```
backup-YYYY-MM-DD_HHMM.zip
├── database/
│   └── watchguard.sql          # MySQL dump
├── uploads/
│   └── [user uploads]          # Photos, documents
├── biometrics/
│   └── [face embeddings]       # Biometric data
└── config/
    └── settings.json           # Non-secret config
```

## Creating Manual Backup

### Via UI
1. Navigate to **Settings** → **Backup & Export**
2. Click **DOWNLOAD BACKUP**
3. Save the JSON file securely

### Via API (Future)
```bash
POST /api/backups/create?type=manual
Authorization: Bearer <admin-token>
```

## Scheduled Backups (Windows)

### Setup Task Scheduler

1. Open Task Scheduler (`taskschd.msc`)
2. Import XML from `/docs/tasks/`

### Monthly Backup Task
```xml
<Task>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2024-01-01T02:00:00</StartBoundary>
      <ScheduleByMonth>
        <DaysOfMonth><Day>1</Day></DaysOfMonth>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Actions>
    <Exec>
      <Command>php</Command>
      <Arguments>C:\laragon\www\watchguard\api\cli\run_backup.php --type=monthly</Arguments>
    </Exec>
  </Actions>
</Task>
```

## Restoring from Backup

### Prerequisites
- SUPER ADMIN or ADMIN role required
- System must be in maintenance mode

### Restore Steps

1. Navigate to **Settings** → **Backup & Export**
2. Click **RESTORE FROM BACKUP**
3. Select backup file
4. Confirm restoration
5. System will restart

### Manual Database Restore

```bash
mysql -u root watchguard < backup/database/watchguard.sql
```

## Backup Storage Location

Default: `<project_root>/storage/backups/`

Structure:
```
storage/backups/
├── manual/
├── monthly/
├── semestral/
└── yearly/
```

## Best Practices

1. **Test restores regularly** - Verify backups are valid
2. **Store offsite copies** - Copy to external drive weekly
3. **Document restoration** - Keep written procedures
4. **Rotate old backups** - Keep last 12 monthly, 4 semestral, 5 yearly
5. **Encrypt sensitive data** - Use ZIP encryption for transport

## Security Notes

- Backup files contain sensitive data (biometrics, PII)
- Store backups in secure, access-controlled location
- Do not transmit backups over untrusted networks
- Only SUPER ADMIN and ADMIN can restore backups
