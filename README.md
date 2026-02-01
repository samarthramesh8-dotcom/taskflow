# Task Master

Smart task management with focus mode. A clean, efficient React + TypeScript app for staying productive.

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

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Plain CSS with CSS variables for theming
- **State Management**: React hooks (no external libraries)
- **Data Storage**: localStorage with versioning
- **Linting**: ESLint with React and TypeScript rules

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Build for production: `npm run build`

## Project Structure

```
src/
├── App.tsx          # Main app component with all logic
├── App.css          # Global styles and theme
├── components/
│   └── Profile.tsx  # Reusable profile component
├── assets/          # Static assets
└── main.tsx         # App entry point
```

## Development

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture Decisions

- **Single Component**: All logic in `App.tsx` for simplicity (no state management libs)
- **Pure Functions**: Task scoring and filtering extracted to pure helpers
- **Immutable Updates**: All state updates use array methods like `map` and `filter`
- **Type Safety**: Strict TypeScript with proper interfaces
- **Performance**: All derived data uses `useMemo` for optimal re-renders

## Production Deployment

### Environment Variables

Create a `.env` file with the following variables:

```bash
NODE_ENV=production
PORT=4000
JWT_SECRET=<your-secure-random-secret>
ALLOWED_ORIGINS=https://yourdomain.com
```

### Security Features

- **Rate Limiting**:
  - Auth endpoints: 5-10 requests per 15 minutes per IP
  - Task endpoints: 100 requests per minute per authenticated user
- **Request Validation**: Strict payload validation with length limits (500 chars for title, 2000 for description)
- **CORS**: Restricted to configured origins in production
- **Seed Endpoint**: Automatically disabled in production mode

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `JWT_SECRET` (min 32 characters)
- [ ] Configure `ALLOWED_ORIGINS` with your domain(s)
- [ ] Ensure database backups are configured
- [ ] Test rate limiting before go-live
- [ ] Verify seed endpoint returns 403 in production

import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
