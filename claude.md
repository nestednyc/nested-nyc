# Nested NYC

A student-only project network and collaboration platform for NYC universities. Students can discover projects, create and manage their own projects, find teammates, browse events, and connect with other students through profiles.

## Tech Stack

- **Frontend**: React 18 + Vite + React Router 6
- **Styling**: Tailwind CSS + inline styles
- **Backend**: Supabase (PostgreSQL, Auth)
- **Deployment**: Vercel

## Project Structure

```
src/
├── pages/           # 33 screen components (main UI)
├── components/      # Reusable UI (MobileFrame, WebLayout, BottomNav, ContextSidebar)
├── lib/             # Supabase client + auth service
├── utils/           # Data utilities (projectData, nestData, storage)
├── context/         # React context (OnboardingContext)
├── config/          # Feature flags
├── assets/          # Static images
├── App.jsx          # Root router with layout detection
└── main.jsx         # Entry point
```

## Key Files

- `src/App.jsx` - Root router, handles mobile vs desktop layout detection
- `src/lib/supabase.js` - Supabase client + comprehensive `authService` with .edu email validation
- `src/utils/projectData.js` - Project data store (default + user-created projects)
- `src/utils/nestData.js` - Community/nest data store
- `src/config/features.js` - Feature flags (SHOW_NESTS, SHOW_FILTERS, SHOW_PEOPLE_SECTION)
- `src/context/OnboardingContext.jsx` - Global onboarding state

## Architecture Notes

### MVP Design
- **localStorage is the primary data store** - user projects, nests, and onboarding state persist in browser
- Supabase is integrated for **authentication only** (database tables planned but not connected)
- Feature flags hide unfinished features (Nests, Filters, People) without removing code

### Layout System
- **Mobile**: `MobileFrame` wrapper (390x844px iPhone frame) with `BottomNav`
- **Desktop**: `WebLayout` with header navigation and `ContextSidebar`
- Breakpoint: 1024px (mobile < 1024px, desktop >= 1024px)

### Data Flow
1. Components call utility functions (`getProjectById`, `getDiscoverProjects`, etc.)
2. Utilities merge localStorage data with default mock data
3. User actions write to localStorage
4. Auth operations go directly to Supabase

## Authentication

Uses Supabase Auth with **.edu email enforcement**:
- Email + password signup/signin
- Magic link + OTP (6-digit code) passwordless login
- JWT session management

Key methods in `authService`:
- `signUpWithEmailPassword(email, password)`
- `signInWithEmailPassword(email, password)`
- `sendMagicLink(email)`
- `verifyOtp(email, token)`
- `getSession()`, `getUser()`, `signOut()`

## Routes

| Route | Screen | Purpose |
|-------|--------|---------|
| `/discover` | DiscoverScreen | Project discovery feed |
| `/projects/:id` | ProfileDetailScreen | Project detail view |
| `/projects/:id/edit` | EditProjectScreen | Edit project |
| `/events` | EventsScreen | Events listing |
| `/events/:id` | EventDetailScreen | Event detail |
| `/matches` | MatchesScreen | My projects/saved |
| `/profile/:userId` | ProfileViewScreen | User profile |
| `/profile/edit` | ProfileEditScreen | Edit own profile |
| `/messages` | MessagesScreen | Message inbox |
| `/chat/:id` | ChatScreen | Direct message |

## Data Patterns

### Response Format
All service methods return consistent format:
```javascript
{ data: {...}, error: null }        // success
{ data: null, error: { message, code } }  // error
```

### Storage Keys
- `nested_user_projects` - User-created projects
- `nested_user_nests` - User-created communities
- `nested_onboarding_complete` - Onboarding status
- `nested_project_edits` - Project edit drafts

### Demo User
Hardcoded `demo-user-1` ID for MVP testing ownership features.

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
```

## Environment Variables

```
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

## Conventions

- Inline styles preferred for rapid iteration
- Feature flags control visibility of incomplete features
- Project IDs: default projects use numeric IDs, user projects use `user-{id}` prefix
- Categories have display labels mapped via `CATEGORY_LABELS` in projectData.js
