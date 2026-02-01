**Vocabulary Retention Platform**

The Vocabulary Retention Platform is a mobile application designed for language learners and avid readers who want to retain vocabulary long-term, rather than rely on short-term memorization. The app supports structured review through spaced repetition, active recall, and interactive practice, allowing users to build durable vocabulary knowledge over time.

The application is built as a **React Native (Expo)** mobile app using **TypeScript**, with **Firebase** providing authentication and persistent data storage.

---

**Technology Stack**

- **Mobile Framework:** React Native (Expo)
- **Programming Language:** TypeScript
- **Navigation:** React Navigation (Native Stack)
- **Authentication:** Firebase Authentication (Email/Password)
- **Database:** Firebase Firestore
- **Build & Testing:** Expo Go (local development), EAS (future builds)

---

**Repository Structure**

apps/
└── mobile/
├── assets/ # App icons and static assets
├── src/
│ ├── screens/ # Screen components (Login, Home, etc.)
│ ├── navigation/ # Navigation configuration
│ ├── firebase/ # Firebase setup and exports
│ ├── components/ # Reusable UI components
│ ├── utils/ # Utility/helper functions
│ └── types/ # Shared TypeScript types
├── App.tsx # App entry point
├── app.json # Expo configuration
├── package.json # Dependency definitions
├── package-lock.json # Locked dependency versions
└── tsconfig.json # TypeScript configuration


---

**Current MVP Functionality**

- Email/password user registration
- Email/password user login
- Persistent authentication state
- Home screen displaying authenticated user information
- Logout functionality

---

**Getting Started**

**Prerequisites**

Before running the project, ensure the following are installed:

- Node.js (LTS version)
- Git
- Expo Go (installed on a physical iOS or Android device)
- An Expo account (free)

> Physical devices are recommended for development. iOS Simulator requires Xcode and is optional.

---

**Installation**

Clone the repository and navigate to the mobile app directory:

git clone <REPOSITORY_URL>
cd word-nerd/apps/mobile


Install all project dependencies:


---

**Environment Configuration**

Create a `.env` file inside `apps/mobile/` with the following values:

EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id


**Important:**
- `.env` files should never be committed to version control
- A `.env.example` file is included as a reference

---

**Running the Application**

Start the Expo development server:


- Open Expo Go on your device
- Scan the QR code displayed in the terminal or browser
- The app should load automatically

If you encounter caching issues:
npx expo start -c


---

**Dependency Management Guidelines**

- All dependencies are defined in `package.json`
- Always install new packages using:
npx expo install <package-name>


- Commit both `package.json` and `package-lock.json` after dependency changes

---

**Team Workflow Conventions**

- Use feature branches for development (e.g., `feature/auth-flow`, `feature/navigation`)
- Open pull requests for all changes
- Do not commit:
  - `node_modules/`
  - `.env`
- Keep commits small, descriptive, and focused

---

**Troubleshooting**

**QR code opens but app does not load**

- Ensure phone and laptop are on the same Wi-Fi network
- Disable VPNs on both devices
- Scan the QR code from within Expo Go (not the camera app)
- Press `l` (LAN mode) and `c` (clear cache) in the Expo terminal

**Missing or broken dependencies**

rm -rf node_modules package-lock.json
npm install


---

**Planned Enhancements**

- Curated vocabulary lists
- Spaced repetition scheduling
- Audio pronunciation support
- Vocabulary games and quizzes
- Progress and analytics dashboard
- Offline review (stretch goal)

---

**Project Notes**

This project intentionally begins from a blank Expo TypeScript template to ensure full understanding of the codebase and to allow incremental, transparent feature development suitable for a semester-long team project.

