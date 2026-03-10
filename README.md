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
- **Database**: Node.js, Fastify, Oracle AI DB (oracledb driver)
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

## 1. Database (Oracle Cloud AI DB)

### Oracle Cloud ATP Setup

1. **Create Oracle Cloud Account**: https://cloud.oracle.com/

2. **Provision Autonomous Database**:
   - Go to Oracle Cloud Console → Database → Autonomous Transaction Processing
   - Create with **Always Free** option
   - Download the wallet (ZIP file)
   - Note the connection string from tnsnames.ora

3. **Configure Environment**:
   ```bash
   # Extract wallet to infrastructure/wallet/
   cp wallet.zip infrastructure/wallet.zip
   cd infrastructure
   unzip wallet.zip
   
   # Update .env with your Oracle credentials
   cp .env.example .env
   # Edit .env with:
   ORACLE_USER=admin
   ORACLE_PASSWORD=your_password
   ORACLE_CONNECT_STRING=your_connection_string (from tnsnames.ora)
   ORACLE_WALLET_PASSWORD=your_wallet_password
   ```

4. **Initialize Database**:
   ```bash
   cd server
   npm install
   npm run db:init
   ```

### Local Development (Docker)

Not recommended - use Oracle Cloud Free Tier for development.

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
| `ORACLE_USER` | Oracle DB username |
| `ORACLE_PASSWORD` | Oracle DB password |
| `ORACLE_CONNECT_STRING` | Connection string from tnsnames.ora |
| `ORACLE_WALLET_LOCATION` | Path to Oracle wallet directory |
| `ORACLE_WALLET_PASSWORD` | Wallet password |
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