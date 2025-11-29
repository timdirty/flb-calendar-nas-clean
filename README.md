# 🔥 FLB Calendar NAS - Critical Production Backup v1.5.1

## 📋 Overview

This is the **CRITICAL PRODUCTION BACKUP** of the FLB Calendar NAS system, restored from Synology Docker backup dated **2025-11-28**. This version represents a stable, fully functional production state.

### 🎯 What This Backup Contains

✅ **Complete Source Code** (8.41MB, 1,888 files)
- All backend services and API endpoints
- Complete frontend application
- Database schemas and configurations
- Docker deployment files
- All utility scripts and tools

✅ **Production Ready**
- Server successfully starts and loads 295 calendar events
- All core functionality verified working
- Synology Calendar API integration verified
- Google Sheets API integration ready

## 🚀 Quick Start - Complete Restoration

### Step 1: Clone This Repository
```bash
git clone https://github.com/timdirty/flb-calendar-nas-clean.git
cd flb-calendar-nas-clean
git checkout v1.5.1-production-backup
```

### Step 2: Download Data Backup
Get the `flb-calendar-nas.syno.txz` file from your original source (this contains all runtime data).

### Step 3: Extract Runtime Data
```bash
tar -xJf flb-calendar-nas.syno.txz
# This will restore:
# - data/ (learning media, drive cache)
# - backups/ (runtime backups)
# - logs/ (application logs)
# - .env.nas (production environment)
```

### Step 4: Add Required Secrets
Create `service-account.json` with your Google Service Account credentials.

### Step 5: Install Dependencies & Start
```bash
npm install
npm run dev
```

## �� Backup Structure

### Included in Git
```
✅ server.js                 # Main application server
✅ routes/                    # All API endpoints
✅ public/                    # Frontend application
✅ utils/                     # Utility functions
✅ services/                  # Business logic services
✅ scripts/                   # Deployment and maintenance scripts
✅ tests/                     # Test suites
✅ package.json               # Dependencies and scripts
✅ Dockerfile                 # Docker configuration
✅ .env.production.example    # Environment template
```

### Excluded from Git (Restore from .txz)
```
❌ data/                      # Runtime media files (2GB+)
❌ backups/                   # Runtime backups
❌ logs/                      # Application logs
❌ temp/                      # Temporary files
❌ node_modules/              # Dependencies
❌ service-account.json       # Google credentials (secret)
❌ .env.nas                   # Production environment (secret)
```

## 🔧 Verification Checklist

After restoration, verify the system is working:

- [ ] Server starts without errors
- [ ] Loads 295 calendar events from 18 teachers
- [ ] Synology Calendar API connects successfully
- [ ] Google Sheets API connects successfully
- [ ] Frontend loads at http://localhost:3000
- [ ] Admin panel accessible at http://localhost:3000/admin-settings.html

## 📅 Backup Information

- **Source Date**: 2025-11-28 23:35
- **Backup Type**: Synology Docker Container Export
- **Git Commit**: `v1.5.1-production-backup`
- **Repository**: https://github.com/timdirty/flb-calendar-nas-clean
- **Size**: 8.41MB (source code only)
- **Full Size with Data**: ~12GB (including .txz backup)

## ⚠️ Important Notes

1. **This is a PRODUCTION backup** - tested and verified working
2. **Secrets are excluded** from git for security reasons
3. **Runtime data must be restored** from the .txz file
4. **Service account credentials** must be provided separately
5. **This version predates recent feature additions** - represents stable state

## 🆘 Support

If you encounter issues during restoration:

1. Check that all required files are present
2. Verify environment variables in `.env.nas`
3. Ensure Google Service Account has proper permissions
4. Check Synology API credentials are valid
5. Review application logs for specific errors

---

**🔥 This backup represents the complete, working production state as of 2025-11-28**
