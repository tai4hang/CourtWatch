# CourtWatch 🏃🎾

A production-ready full-stack mobile app for finding and tracking tennis courts in the GTA (Greater Toronto Area). Users can discover nearby courts, check availability, report court status, and save favorites.

## Architecture

```
/CourtWatch
├── mobile/              # React Native mobile app (iOS + Android)
├── server/              # Node.js backend API (Fastify)
├── .github/workflows/  # CI/CD pipelines (GitHub Actions)
└── assets/              # App icons and images
```

## Tech Stack

- **Mobile**: React Native, TypeScript, Expo SDK 54, React Navigation, Zustand
- **Backend**: Node.js, Fastify, Firestore (Google Cloud)
- **Auth**: Firebase Authentication (Email + Google Sign-In)
- **Database**: Google Firestore
- **Maps**: React Native Maps
- **Notifications**: Expo Notifications (FCM/APNS)
- **CI/CD**: GitHub Actions, EAS Build

---

## Features

- 📍 **Find Courts**: Search and browse tennis courts by location
- 🏃 **Availability**: Check real-time court status (Available, Busy, Closed)
- 🔦 **Lights**: Filter for lit courts for evening play
- ❤️ **Favorites**: Save your favorite courts
- 📱 **Reports**: Report court status to help other players
- 🔐 **Auth**: Email/password + Google Sign-In

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud account (for Firestore)
- Firebase project (for Auth)
- Expo account (for building)

### Backend Setup

```bash
cd server

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit with your Firebase and Firestore credentials

# Run locally
npm run dev
```

### Mobile Setup

```bash
cd mobile

# Install dependencies
npm install

# Copy Firebase config (optional - uses default for dev)
cp src/services/firebase.ts.example src/services/firebase.ts

# Start Expo
npx expo start
```

---

## Environment Variables

### Server (.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator (dev only) |

### Mobile (app.json / .env)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `EXPO_PUBLIC_USE_MOCK` | Use mock data (dev only) |

---

## Deployment

### Backend (Google Cloud Run)

```bash
cd server
gcloud builds submit --tag gcr.io/PROJECT_ID/courtwatch-api
gcloud run deploy courtwatch-api --platform managed
```

### Mobile (EAS)

```bash
cd mobile

# Configure EAS
eas configure

# Build for iOS
eas build -p ios --profile preview

# Submit to TestFlight
eas submit -p ios
```

---

## CI/CD

GitHub Actions workflows are included:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | Push/PR | TypeScript check, lint |
| `deploy-backend.yml` | Push to `server/` | Build & deploy to Cloud Run |
| `deploy-mobile.yml` | Push to `mobile/` | Build iOS via EAS |

### Required Secrets

- `EXPO_TOKEN`: Expo access token
- `GOOGLE_APPLICATION_CREDENTIALS`: GCP service account JSON

---

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Login with Google
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Courts
- `GET /api/courts` - List courts (paginated, filterable)
- `GET /api/courts/:id` - Get court details
- `GET /api/courts/nearby` - Find nearby courts
- `POST /api/courts/report` - Report court status

### Favorites
- `GET /api/courts/favorites/me` - Get user favorites
- `POST /api/courts/favorites` - Add favorite
- `DELETE /api/courts/favorites/:courtId` - Remove favorite

---

## Project Structure

```
CourtWatch/
├── .github/workflows/     # CI/CD pipelines
├── assets/                 # App icons and images
├── mobile/                # React Native app
│   ├── App.tsx            # App entry point
│   ├── app.json           # Expo config
│   ├── src/
│   │   ├── screens/       # Screen components
│   │   ├── navigation/    # Navigation config
│   │   ├── store/         # Zustand stores
│   │   ├── services/      # API, Firebase services
│   │   └── theme.ts       # Theme config
│   └── package.json
└── server/                # Backend API
    ├── src/
    │   ├── routes/        # API routes
    │   ├── services/      # Business logic
    │   ├── db/            # Firestore connection
    │   └── main.ts        # Entry point
    ├── package.json
    └── Dockerfile
```

---

## License

MIT