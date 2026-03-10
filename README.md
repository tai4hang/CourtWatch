# FamilyShopping - Startup Platform

A production-ready full-stack startup platform with mobile app, backend API, database, and automated CI/CD deployments to TestFlight.

## Architecture

```
/FamilyShopping
├── mobile/              # React Native mobile app (iOS + Android)
├── server/              # Node.js backend API (Fastify)
├── infrastructure/      # Docker configs, Oracle wallet setup
├── ci/                  # Fastlane configurations
└── .github/workflows/  # CI/CD pipelines (GitHub Actions)
```

## Tech Stack

- **Mobile**: React Native, TypeScript, Expo, React Navigation, Zustand
- **Backend**: Node.js, Fastify, Oracle AI DB (oracledb driver)
- **Database**: Oracle Cloud AI DB (Autonomous Transaction Processing)
- **Payments**: Stripe Subscriptions
- **Notifications**: FCM (Android), APNS (iOS)
- **Analytics**: PostHog
- **CI/CD**: GitHub Actions, Fastlane, EAS

---

# Deployment Guide

This guide covers deploying to testing/production environments.

## Prerequisites

- [ ] Oracle Cloud account (Free Tier)
- [ ] Apple Developer account
- [ ] Expo account
- [ ] Stripe account
- [ ] GitHub repository access

---

## 1. Oracle Cloud AI DB Setup

### Create Autonomous Database

1. **Login to Oracle Cloud**: https://cloud.oracle.com/
2. Go to **Oracle Database** → **Autonomous Transaction Processing**
3. Click **Create Autonomous Database**
4. Select **Always Free** (recommended for testing)
5. Configure:
   - Display name: `FamilyShopping`
   - Database name: `familyshopping`
   - Admin password: `YourSecurePassword123!`
6. Click **Create** and wait for provisioning (~5 min)

### Download Wallet

1. Go to your ATP instance → **DB Connection**
2. Download **Wallet** (ZIP file)
3. Extract to `infrastructure/wallet/`
4. Note the connection string from `tnsnames.ora` (use the medium priority one)

### Get Connection Details

From `tnsnames.ora`, find your connection string:
```text
medium = (description=(address=(protocol=tcps)(port=1522)(host=...))(connect_data=(service_name=...)))
```

---

## 2. Backend Deployment

### Option A: Oracle Cloud Container Instance (Recommended)

1. **Build Docker image**:
   ```bash
   cd server
   docker build -t familyshopping-api:latest .
   ```

2. **Push to Oracle Container Registry** or Docker Hub:
   ```bash
   docker tag familyshopping-api:latest your-registry/familyshopping-api:latest
   docker push your-registry/familyshopping-api:latest
   ```

3. **Deploy via Oracle Cloud Container Instances**:
   - Go to Oracle Cloud → Containers → Container Instances
   - Create new instance
   - Configure:
     - Image: your-registry/familyshopping-api:latest
     - Environment variables (see below)
     - Volume mount: wallet files

### Option B: Docker Compose (Local Testing)

```bash
cd infrastructure

# Create .env file
cp .env.example .env
# Edit with your Oracle credentials

# Place Oracle wallet in infrastructure/wallet/

# Run
docker-compose up -d api
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_TYPE` | Database type | `oracle` |
| `ORACLE_USER` | DB username | `admin` |
| `ORACLE_PASSWORD` | DB password | `YourSecurePassword123!` |
| `ORACLE_CONNECT_STRING` | Connection string | `medium_dbname` |
| `ORACLE_WALLET_LOCATION` | Wallet path | `./wallet` |
| `ORACLE_WALLET_PASSWORD` | Wallet password | `YourWalletPassword` |
| `JWT_SECRET` | JWT signing secret | `generate-secure-random-string` |
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook | `whsec_...` |
| `FRONTEND_URL` | Mobile app URL | `https://your-app.expo.app` |

---

## 3. Mobile App - TestFlight Deployment

### Prerequisites

1. **Apple Developer Account**: https://developer.apple.com/
2. **App Store Connect API Key**:
   - Go to App Store Connect → Users and Access → Keys
   - Create API Key with "App Manager" role
   - Download .p8 file

3. **Expo Account**: https://expo.dev/

### Configure App

Update `mobile/app.json`:
```json
{
  "expo": {
    "name": "FamilyShopping",
    "ios": {
      "bundleIdentifier": "com.startup.familyshopping",
      "appleTeamId": "YOUR_TEAM_ID"
    },
    "android": {
      "package": "com.startup.familyshopping"
    }
  }
}
```

### Build & Submit via EAS

```bash
cd mobile

# Install dependencies
npm install

# Login to Expo
eas login

# Build for iOS (TestFlight)
eas build -p ios --profile preview

# Submit to TestFlight
eas submit -p ios
```

### Build & Submit via Fastlane (Alternative)

```bash
cd mobile

# Install Fastlane
sudo gem install fastlane

# Configure in ci/ folder
# Update ci/Fastfile with your credentials

# Build and upload
cd ci
fastlane build_ios
fastlane upload_testflight
```

---

## 4. GitHub Actions CI/CD

The repository includes automated pipelines in `.github/workflows/`.

### Workflows

| File | Trigger | Description |
|------|---------|-------------|
| `ci.yml` | Push/PR | Lint, TypeScript check |
| `deploy-backend.yml` | Push to `server/` | Build & push Docker image |
| `deploy-mobile.yml` | Push to `mobile/` | Build iOS & submit to TestFlight |

### Configure GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions**

Add these secrets:

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password |
| `EXPO_TOKEN` | Expo access token |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Team ID |
| `FASTLANE_PASSWORD` | Fastlane password |
| `ORACLE_USER` | Oracle DB user |
| `ORACLE_PASSWORD` | Oracle DB password |
| `ORACLE_CONNECT_STRING` | Connection string |
| `ORACLE_WALLET_PASSWORD` | Wallet password |
| `JWT_SECRET` | JWT secret |
| `STRIPE_SECRET_KEY` | Stripe key |

### Get Expo Token

1. Go to https://expo.dev/settings/access-tokens
2. Create new access token
3. Copy and add as `EXPO_TOKEN` secret

### Get Apple App-Specific Password

1. Go to https://appleid.apple.com/
2. Sign in → Security → App-Specific Passwords
3. Generate new password

### Trigger Deployment

Push to main branch:
```bash
git push origin main
```

Monitor at: https://github.com/tai4hang/Family-Shopping/actions

---

## Quick Deploy Checklist

- [ ] Oracle Cloud ATP provisioned + wallet downloaded
- [ ] Apple Developer account with App Store Connect API key
- [ ] Expo account created
- [ ] GitHub secrets configured
- [ ] Push code to main branch
- [ ] Wait for GitHub Actions (~15-20 min)
- [ ] Check TestFlight for build

---

## Troubleshooting

### GitHub Actions Failures

| Error | Solution |
|-------|----------|
| `EXPO_TOKEN` invalid | Regenerate at expo.dev/settings/access-tokens |
| Apple auth failed | Check APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD |
| iOS build timeout | Increase timeout in workflow or use EAS build |

### Backend Deployment

| Error | Solution |
|-------|----------|
| Oracle connection failed | Verify wallet + credentials in .env |
| Wallet not found | Ensure wallet mounted at correct path |

---

## Project Structure

```
FamilyShopping/
├── .github/workflows/     # CI/CD pipelines
│   ├── ci.yml            # Lint & test
│   ├── deploy-backend.yml # Backend Docker build
│   └── deploy-mobile.yml # iOS TestFlight build
├── ci/                   # Fastlane configs
│   ├── Fastfile
│   └── Appfile
├── infrastructure/        # Deployment configs
│   ├── docker-compose.yml
│   ├── .env.example
│   └── nginx.conf
├── mobile/               # React Native app
│   ├── app.json
│   ├── src/
│   └── package.json
└── server/               # Backend API
    ├── src/
    │   ├── db/          # Database connection
    │   ├── routes/      # API endpoints
    │   ├── services/    # Business logic
    │   └── main.ts      # Entry point
    ├── Dockerfile
    └── package.json
```

---

## License

MIT