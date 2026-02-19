**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


Structure:
     healthy-meal-planner/
│
├── components/
│   ├── Layout.tsx
│   └── Sidebar.tsx
│
├── pages/
│   ├── AdminDashboard.tsx
│   ├── Dashboard.tsx
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ProfilePage.tsx
│   ├── MealPlanPage.tsx
│   ├── MealRecommendations.tsx
│   └── ProgressPage.tsx
│
├── services/
│   └── (API / backend connection files)
│
├── node_modules/
│
├── .env.local
├── .gitignore
│
├── App.tsx
├── index.tsx
├── index.html
├── constants.ts
├── types.ts
├── metadata.json
│
├── server.js              (Node/Express backend)
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── README.md
│
└── node_modules/
