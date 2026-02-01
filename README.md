# Task Master

A modern task management application with authentication, built with React + TypeScript and Node.js.

## Features

- **Task Management**: Add, edit, delete tasks with due dates and priority levels
- **Focus Mode**: Automatically shows top 5 most important tasks based on priority, due dates, and age
- **Smart Filtering**: Filter by all, active, done, today, overdue, or high priority
- **Keyboard Shortcuts**:
  - `N` - Focus add task input
  - `F` - Toggle Focus Mode
- **Data Persistence**: Tasks and Focus Mode state saved to localStorage
- **Import/Export**: JSON export for backup, import for migration
- **Best Task Highlighting**: Algorithm suggests the optimal next task
- **Next Up Section**: Preview upcoming high-priority tasks

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (dev server + build)
- CSS Variables (dark theme)

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- JWT authentication
- bcryptjs for password hashing

## Local Development

### Prerequisites
- Node.js 18+ and npm

### Setup

1. Install dependencies:
```bash
npm install
cd server && npm install && cd ..
```

2. Start the backend server:
```bash
cd server
npm start
```

3. In a new terminal, start the frontend:
```bash
npm run dev
```

4. Open http://localhost:5173

The frontend uses Vite proxy to forward `/auth` and `/api` requests to the backend on port 4000.

## Production Deployment

### Frontend (Vercel)

1. **Connect your repo to Vercel**
2. **Set environment variable:**
````
<userPrompt>
Provide the fully rewritten file, incorporating the suggested code change. You must produce the complete file.
</userPrompt>
`````

### Backend (Render) - Deploy First

1. **Create a new Web Service on Render**
2. **Set environment variables:**
   ```bash
   NODE_ENV=production
   PORT=4000
   JWT_SECRET=<generate-secure-random-32-char-string>
   ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app-git-main-yourname.vercel.app,https://your-app-yourname.vercel.app
```
