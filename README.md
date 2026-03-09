# Project Overview

This is a production-ready startup platform with cross-platform mobile apps, backend API, and automated deployments.

## Architecture

```
/FamilyShopping
├── mobile/              # React Native mobile app (iOS + Android)
├── server/              # Node.js backend API
├── database/           # Prisma ORM + Oracle AI DB
├── infrastructure/     # Docker & Kubernetes configs
├── ci/                 # Fastlane configurations
└── .github/workflows/  # CI/CD pipelines
```

## Tech Stack

- **Mobile**: React Native, TypeScript, Expo, React Navigation, Zustand
- **Backend**: Node.js, Fastify, Prisma, Oracle AI DB
- **Payments**: Stripe Subscriptions
- **Notifications**: FCM (Android), APNS (iOS)
- **Analytics**: PostHog
- **CI/CD**: GitHub Actions, Fastlane, EAS

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Oracle Cloud account
- Apple Developer account (with App Store Connect API key)
- Google Play Console account
- Stripe account
- Expo account (eas CLI)

---

# Deployment Guide

This guide covers deploying each layer of the application.

## Table of Contents
1. [Database (Oracle AI DB)](#1-database-oracle-ai-db)
2. [Backend API](#2-backend-api)
3. [Mobile App (iOS TestFlight)](#3-mobile-app-ios-testflight)
4. [GitHub Actions CI/CD](#4-github-actions-cicd)

---

## 1. Database (Oracle AI DB)

### Option A: Oracle Cloud Free Tier

1. **Create Oracle Cloud Account**: https://cloud.oracle.com/

2. **Provision Autonomous Database**:
   - Go to Oracle Cloud Console → Database → Autonomous Transaction Processing
   - Create with **Always Free** option
   - Note the connection string (wallet)

3. **Configure Prisma**:
   ```bash
   cd database
   # Download Oracle wallet and extract to ./wallet/
   # Update DATABASE_URL in your .env:
   DATABASE_URL="oracle://user:password@atp_connection_string/PDB1?wallet_location=./wallet"
   ```

4. **Run Migrations**:
   ```bash
   cd server
   npm install
   npm run db:generate
   npm run db:migrate
   ```

### Option B: Local Development with Docker

```bash
cd infrastructure
docker-compose up -d oracle-db
```

---

## 2. Backend API

### Deploy to Oracle Cloud Container Instance

1. **Build Docker Image**:
   ```bash
   cd server
   docker build -t your-registry/startup-api:latest .
   ```

2. **Push to Container Registry**:
   ```bash
   docker push your-registry/startup-api:latest
   ```

3. **Deploy via Oracle Cloud**:
   - Use Oracle Cloud Container Instances
   - Or use kubectl with OKE (Oracle Kubernetes Engine)

### Using Docker Compose (Local/Production)

```bash
cd infrastructure
cp .env.example .env
# Edit .env with your values
docker-compose up -d api
```

### Environment Variables Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Oracle DB connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `POSTHOG_API_KEY` | PostHog analytics key |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key |

---

## 3. Mobile App (iOS TestFlight)

### Prerequisites

1. **Apple Developer Account**: https://developer.apple.com/
2. **App Store Connect API Key**: Created in App Store Connect
3. **Expo Account**: https://expo.dev/

### Step 1: Configure EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
cd mobile
eas project:init
```

### Step 2: Configure app.json

Update `app.json` with your Apple Team ID:
```json
{
  "expo": {
    "ios": {
      "appleTeamId": "YOUR_TEAM_ID",
      "bundleIdentifier": "com.yourapp.bundleid"
    }
  }
}
```

### Step 3: Build for iOS TestFlight

```bash
# Build for iOS (creates .ipa for TestFlight)
eas build -p ios --profile preview

# Or build locally
npx expo run:ios --configuration Release
```

### Step 4: Submit to TestFlight

```bash
# Submit to TestFlight
eas submit -p ios

# Or use Fastlane (see ci/ folder)
```

### Manual Fastlane Build (Alternative)

```bash
cd mobile

# Install Fastlane
sudo gem install fastlane

# Setup (one time)
fastlane init

# Build and upload to TestFlight
fastlane build_ios
fastlane upload_testflight
```

---

## 4. GitHub Actions CI/CD

The repository includes automated CI/CD pipelines in `.github/workflows/`.

### Workflow Files

| File | Description |
|------|-------------|
| `ci.yml` | CI pipeline (lint, test, build) |
| `deploy-backend.yml` | Backend Docker build & deploy |
| `deploy-mobile.yml` | Mobile build & TestFlight upload |

### Required Secrets

Configure these in GitHub Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password |
| `ORACLE_DB_URL` | Oracle DB connection string |
| `JWT_SECRET` | JWT secret |
| `STRIPE_SECRET_KEY` | Stripe key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook |
| `POSTHOG_API_KEY` | PostHog key |
| `EXPO_TOKEN` | Expo access token |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Team ID |
| `FASTLANE_PASSWORD` | Fastlane password |

### Getting Expo Token

1. Go to https://expo.dev/settings/access-tokens
2. Create new access token
3. Add as `EXPO_TOKEN` secret in GitHub

### Getting Apple App-Specific Password

1. Go to https://appleid.apple.com/
2. Sign in → Security → App-Specific Passwords
3. Generate new password
4. Use with your Apple ID in GitHub secrets

### Pipeline Triggers

| Trigger | Action |
|---------|--------|
| Push to `main` | Full CI + Deploy backend + Build mobile |
| PR to `main` | CI only (lint + test) |
| Tag `v*` | Release build + auto-submit to TestFlight |

### Running the Pipeline

1. **Push code to main branch**:
   ```bash
   git push origin main
   ```

2. **Check GitHub Actions**: 
   - Go to https://github.com/tai4hang/Family-Shopping/actions
   - Monitor build progress

3. **View TestFlight**:
   - After successful build, check App Store Connect
   - Build appears in TestFlight → Builds

---

## Quick Deploy Checklist

- [ ] Oracle Cloud DB provisioned
- [ ] Apple Developer account ready
- [ ] Expo account created
- [ ] GitHub secrets configured
- [ ] First push to main triggers pipeline
- [ ] TestFlight build available (~15-20 min)

---

## Troubleshooting

### Build Failures

1. **iOS Build Fails**: Check Apple Developer certificates
2. **Backend Build Fails**: Check Docker configuration
3. **Expo Build Fails**: Verify EXPO_TOKEN is valid

### Common Issues

- **Missing secrets**: Ensure all required secrets are set
- **Certificate expired**: Regenerate Apple certificates
- **Database connection**: Verify Oracle wallet path

---

## License

MIT