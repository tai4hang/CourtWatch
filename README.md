# Project Overview

This is a production-ready startup platform with cross-platform mobile apps, backend API, and automated deployments.

## Architecture

```
/project
├── mobile/           # React Native mobile app (iOS + Android)
├── server/           # Node.js backend API
├── database/        # Prisma ORM + Oracle AI DB
├── infrastructure/  # Docker & Kubernetes configs
├── ci/               # Fastlane configurations
└── .github/workflows/ # CI/CD pipelines
```

## Tech Stack

- **Mobile**: React Native, TypeScript, Expo, React Navigation, Zustand
- **Backend**: Node.js, Fastify, Prisma, Oracle AI DB
- **Payments**: Stripe Subscriptions
- **Notifications**: FCM (Android), APNS (iOS)
- **Analytics**: PostHog
- **CI/CD**: GitHub Actions, Fastlane

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Oracle Cloud account
- Apple Developer account
- Google Play Console account
- Stripe account

### Local Development

1. **Configure environment variables:**
   ```bash
   cp infrastructure/.env.example infrastructure/.env
   ```

2. **Start infrastructure services:**
   ```bash
   docker-compose -f infrastructure/docker-compose.yml up -d
   ```

3. **Start backend:**
   ```bash
   cd server
   npm install
   npm run db:migrate
   npm run dev
   ```

4. **Start mobile app:**
   ```bash
   cd mobile
   npm install
   npx expo start
   ```

## Environment Variables

See `infrastructure/.env.example` for required variables.

## Documentation

- [Mobile App](docs/MOBILE.md)
- [Backend API](docs/BACKEND.md)
- [Database Schema](docs/DATABASE.md)
- [CI/CD](docs/CICD.md)
- [Deployment](docs/DEPLOYMENT.md)

## License

MIT
