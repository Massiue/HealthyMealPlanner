**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key.
3. Run the frontend:
   `npm run dev`
4. Run the backend:
   `npm run dev:server`

Structure:

```text
healthy-meal-planner/
|-- frontend/
|   |-- index.html
|   |-- metadata.json
|   |-- tsconfig.json
|   |-- vite.config.ts
|   `-- src/
|       |-- App.tsx
|       |-- index.tsx
|       |-- constants.ts
|       |-- types.ts
|       |-- components/
|       |-- pages/
|       `-- services/
|-- backend/
|   |-- server.js
|   `-- nutriplan.db
|-- .env
|-- .env.local
|-- package.json
|-- package-lock.json
`-- README.md
```

---------------------------------------
Backend API Structure:

GET /api/meals
POST /api/login
PUT /api/plans
DELETE /api/meals/:id
