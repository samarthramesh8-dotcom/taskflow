# AI Coding Guidelines for My App

## Architecture Overview
This is a React + TypeScript single-page application built with Vite. The app consists of two main sections in a grid layout: a profile card with a counter, and a task management card with filtering.

- **State Management**: All state is managed locally in `App.tsx` using React hooks (`useState`, `useMemo`).
- **Components**: Functional components with TypeScript interfaces for props (e.g., `ProfileProps` in `src/components/Profile.tsx`).
- **Data Flow**: Props passed down from `App` to child components; no global state or context.

## Development Workflow
- **Start Dev Server**: `npm run dev` (Vite with HMR).
- **Build**: `npm run build` (runs TypeScript check then Vite build).
- **Lint**: `npm run lint` (ESLint with React hooks and refresh plugins).
- **Preview**: `npm run preview` (serves built app).

TypeScript is configured with strict mode and project references (`tsconfig.json` references `tsconfig.app.json` for app code).

## Code Patterns
- **Component Structure**: Export default functional components. Use TypeScript interfaces for props (e.g., `type Task = { id: number; text: string; done: boolean }`).
- **State Updates**: Immutable updates using array methods like `map` and `filter` (e.g., `setTasks(tasks.map(t => t.id === id ? {...t, done: !t.done} : t))`).
- **Computed Values**: Use `useMemo` for derived state (e.g., filtering tasks or calculating stats).
- **Styling**: CSS classes in `.css` files with CSS variables for theming (dark theme). Some inline styles for simple layouts (e.g., in `Profile.tsx`).
- **Event Handling**: Inline arrow functions for handlers (e.g., `onClick={() => toggleTask(id)}`).
- **Forms**: Prevent default on submit, trim input, validate before adding (e.g., task addition in `addTask`).

## Key Files
- `src/App.tsx`: Main component with all logic and state.
- `src/components/Profile.tsx`: Reusable profile component example.
- `src/App.css`: Main styles with CSS variables.
- `vite.config.ts`: Minimal Vite config with React plugin.

Focus on maintaining immutability in state updates and using TypeScript for type safety.