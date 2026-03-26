# Healthy Meal Planner (Web App)

Healthy Meal Planner is a full-stack web application for meal planning, nutrition tracking, and admin meal management.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: MySQL (Aiven/Render compatible)

## Features

- User authentication (signup/login) with JWT
- Dashboard, profile, progress, planner, meal recommendations, chatbot
- Admin CRUD for global meals and users
- File upload pipeline (image + PDF) from frontend to backend
  - Admin uploads supported file
  - Backend validates, stores in `backend/uploads/`
  - Public URL returned (served at `/uploads/...`)

## Project Structure

```text
healthy-meal-planner/
|-- frontend/
|   |-- src/
|   |-- vite.config.ts
|-- backend/
|   |-- server.js
|   |-- uploads/
|-- scripts/
|-- .env.example
|-- package.json
`-- README.md
```

## Prerequisites

- Node.js 20+
- npm 10+
- A MySQL database

## Environment Setup

1. Copy the sample env:

```bash
cp .env.example .env
```

2. Fill required values in `.env` (or Render env variables):

- `MYSQL_URI` (recommended) OR MySQL host/port/user/password/database set
- `JWT_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASS`
- Optional: `GEMINI_API_KEY`, mail settings

## Install

```bash
npm install
```

## Run Locally

Run backend:

```bash
npm run dev:server
```

Run frontend:

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Build (Production)

```bash
npm run build
```

This generates the frontend build in `dist/`.

## Start (Production)

```bash
npm start
```

The backend serves API routes and static frontend assets.

## Deployment (Render)

- Build command: `npm install`
- Start command: `node backend/server.js` (or `npm start`)
- Use a valid MySQL connection in env vars (prefer `MYSQL_URI`)
- Ensure SSL env values are set for Aiven/MySQL SSL usage

## Upload API

Admin-only upload endpoint:

- `POST /api/admin/uploads`
- Body:

```json
{
  "fileName": "sample.png",
  "mimeType": "image/png",
  "contentBase64": "<base64-content>"
}
```

Supported types:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `application/pdf`

Max file size: 8MB.

## Core API (Examples)

- `POST /api/signup`
- `POST /api/login`
- `GET /api/meals`
- `GET /api/plans`
- `PUT /api/plans/:date`
- `PUT /api/profile`
- `POST /api/admin/meals`
- `PUT /api/admin/meals/:id`
- `DELETE /api/admin/meals/:id`
- `GET /api/admin/users`

## Notes on APK/AAB

This repository is a web app (React + Express), so APK/AAB generation is not native in the current stack.
If Android artifacts are required, add a wrapper workflow (for example Capacitor) and then generate APK/AAB from Android Studio.
