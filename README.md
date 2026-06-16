# OMOF

**Opposite of FOMO** — A cross-platform social app for sharing authentic experiences.

> Because nobody's life is just the highlights.

OMOF is a supportive social platform where people share struggles, setbacks, and difficult days — not just highlights. Built with React Native, Expo, and Firebase.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native, Expo SDK 56, TypeScript, Expo Router |
| State | Zustand, TanStack Query |
| Forms | React Hook Form + Zod |
| Backend | Firebase Auth, Firestore, Storage, Cloud Functions, FCM |
| Tooling | ESLint, Prettier, Jest |

## Project Structure

```
omof/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, signup, forgot password
│   ├── (onboarding)/       # First-time profile setup
│   ├── (tabs)/             # Main app tabs (feed, search, create, notifications, profile)
│   ├── post/[id].tsx       # Post detail
│   ├── user/[username].tsx # User profile
│   ├── profile/edit.tsx    # Edit profile
│   ├── settings/           # Settings, guidelines, blocked users
│   └── report.tsx          # Report content
├── components/             # Reusable UI components
├── features/               # Feature modules (via services + hooks)
├── hooks/                  # Custom React hooks
├── services/firebase/      # Firebase service layer
├── store/                  # Zustand stores
├── types/                  # TypeScript types
├── utils/                  # Utilities and validation
├── firebase/               # Security rules, indexes, Cloud Functions
└── __tests__/              # Unit tests
```

## Prerequisites

- Node.js 20+
- npm or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- iOS Simulator (macOS) or Android Emulator for local testing
- [EAS CLI](https://docs.expo.dev/build/setup/) for production builds

## Installation

```bash
# Clone and install dependencies
cd omof
npm install

# Copy environment variables
cp .env.example .env
```

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named `omof` (or your preferred name)
3. Enable **Authentication** → Email/Password provider
4. Create a **Firestore** database (start in production mode)
5. Create a **Storage** bucket
6. Enable **Cloud Messaging** for push notifications

### 2. Register Apps

1. Add a **Web** app in Firebase Console (required for Expo)
2. Copy the Firebase config values into `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Deploy Security Rules & Functions

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login and initialize (select existing project)
firebase login
cd firebase
firebase use --add

# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Storage rules
firebase deploy --only storage

# Install and deploy Cloud Functions
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 4. Firestore Indexes

Composite indexes are defined in `firebase/firestore.indexes.json`. Deploy them with:

```bash
firebase deploy --only firestore:indexes
```

## Expo Setup

### Run Locally

```bash
# Start the development server
npm start

# Run on Android emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios
```

Scan the QR code with **your OMOF development build** on a physical iPhone (see [iPhone development build](#iphone-development-build-sdk-56) below). Expo Go only supports older SDKs and cannot run this project. Press `a` / `i` for emulators, or use `npm run web` in a browser.

### Environment

Ensure `.env` is configured before starting. Expo reads `EXPO_PUBLIC_*` variables at build time.

## iPhone development build (SDK 56)

Expo Go on the App Store lags behind the latest SDK. OMOF uses **Expo SDK 56**, so you need a **custom development build** installed on your iPhone (not Expo Go).

### 1. One-time setup (on your PC)

```bash
cd C:\Users\Farhan\Projects\omof
npm install

# Log in to Expo (create a free account at https://expo.dev if needed)
npx eas login

# Link this repo to an EAS project (writes a real projectId into app.json)
npx eas init
```

### 2. Push Firebase env vars to EAS (required for cloud builds)

EAS cloud builds do not read your local `.env`. Push the `EXPO_PUBLIC_*` values from `.env` (not `.env.local`):

```bash
npm run env:push:dev
```

Confirm when prompted (or add `-- --force` to skip confirmation). Variables are stored in the **development** environment and injected into dev builds automatically.

### 3. Register your iPhone

```bash
npm run device:register
```

Follow the prompts on your iPhone to install the provisioning profile. You only need to do this once per device.

### 4. Build and install the dev app

```bash
npm run build:ios:dev
```

- First build: EAS will ask for your **Apple ID** (a free Apple Developer account is enough for internal dev builds).
- When the build finishes, open the link EAS prints (or the build page on [expo.dev](https://expo.dev)) and install the `.ipa` on your iPhone.

### 5. Daily development

With the OMOF dev app installed on your phone:

```bash
npm run start:dev
```

Scan the QR code **with the OMOF dev app** (not Expo Go). Your phone and PC must be on the same Wi‑Fi, or use tunnel mode: `npx expo start --dev-client --tunnel`.

---

## Build for Production

### Install EAS CLI

```bash
npm install -g eas-cli
eas login
eas init
```

Update `app.json` → `extra.eas.projectId` with your EAS project ID.

### iOS Build

```bash
# Development build
eas build --platform ios --profile development

# Production build (App Store)
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Android Build

```bash
# Development build
eas build --platform android --profile development

# Production build (Play Store)
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

## Development Commands

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run lint       # Run ESLint
npm run format     # Run Prettier
npm run typecheck  # TypeScript check
npm test           # Run Jest tests
```

## Features

- **Authentication** — Email/password sign up, login, logout, forgot password
- **Onboarding** — Username, display name, bio, optional profile photo
- **Feed** — Chronological, paginated, pull-to-refresh
- **Posts** — Image + caption (280 chars) + mood tag
- **Support Reactions** — "I relate", "I've been there", "Sending support"
- **Comments** — Add, view, delete own comments with profanity filtering
- **Follows** — Follow/unfollow with counts
- **Notifications** — Comments, reactions, new followers
- **Search** — Find users by username or display name
- **Safety** — Report posts/comments, block users, crisis support modal, community guidelines

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles |
| `usernames` | Username uniqueness lookup |
| `posts` | User posts with images |
| `comments` | Post comments |
| `reactions` | Support reactions (one per user per post) |
| `follows` | Follow relationships |
| `notifications` | In-app notifications |
| `reports` | Content reports |
| `blockedUsers` | Block relationships |

## Manual QA Checklist

### Authentication
- [ ] Sign up with email/password
- [ ] Log in with valid credentials
- [ ] Log in with invalid credentials shows error
- [ ] Forgot password sends reset email
- [ ] Logout clears session and redirects to login
- [ ] Auth persists after app restart

### Onboarding
- [ ] New user is prompted to set username, display name, bio
- [ ] Username uniqueness is enforced
- [ ] Optional profile photo upload works
- [ ] Completed onboarding redirects to feed

### Profiles & Follows
- [ ] View own profile with posts and counts
- [ ] View other user profiles
- [ ] Edit profile (display name, bio, photo)
- [ ] Follow a user — counts update
- [ ] Unfollow a user — counts update

### Feed & Posts
- [ ] Feed shows posts from followed users + own posts
- [ ] Feed is chronological (newest first)
- [ ] Pull-to-refresh works
- [ ] Create post with image, caption, mood tag
- [ ] Caption max 280 characters enforced
- [ ] Post detail shows image, caption, mood, author, timestamp

### Comments & Reactions
- [ ] Add comment on a post
- [ ] View comments on post detail
- [ ] Delete own comment
- [ ] Add support reaction (one per user)
- [ ] Change reaction type
- [ ] Reaction counts display correctly

### Notifications
- [ ] Notification on new comment
- [ ] Notification on support reaction
- [ ] Notification on new follower
- [ ] Mark notification as read
- [ ] Mark all as read

### Search
- [ ] Search by username
- [ ] Search by display name
- [ ] Blocked users excluded from results

### Safety
- [ ] Report a post with reason
- [ ] Report a comment with reason
- [ ] Block a user — their content hidden
- [ ] Unblock a user from settings
- [ ] Crisis modal appears for self-harm language in captions
- [ ] Profanity filtered in comments
- [ ] Community Guidelines screen accessible

## Deployment

### Firebase

```bash
cd firebase
firebase deploy
```

### Mobile Apps

1. Configure EAS with `eas init`
2. Set up signing credentials: `eas credentials`
3. Build: `eas build --platform all --profile production`
4. Submit: `eas submit --platform all`

### Environment Variables for CI

Set `EXPO_PUBLIC_FIREBASE_*` variables in EAS Secrets:

```bash
eas secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
# Repeat for all Firebase config values
```

## License

Private — All rights reserved.
