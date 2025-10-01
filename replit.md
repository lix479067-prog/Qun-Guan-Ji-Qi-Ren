# TG Bot Manager

## Overview

This is a full-stack Telegram bot management system built with React, Express, and PostgreSQL. The application provides a web-based dashboard for managing Telegram group bots, including bot configuration, group whitelist management, custom command creation, and activity logging. The system allows administrators to control bot behavior, monitor activity, and manage which groups the bot can operate in.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tools**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast hot-module replacement
- Wouter for lightweight client-side routing

**UI Component System**
- shadcn/ui component library built on Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with a custom dark theme configuration
- CSS variables for theming, allowing consistent colors across the application

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- Custom query client configuration with credential-based authentication
- Form state managed with React Hook Form and Zod for validation

**Design Decisions**
- Dark theme enforced application-wide for better visual consistency
- Component-based architecture with shared UI components
- Chinese language UI (机器人管理系统) for target audience
- Mobile-responsive design with breakpoint considerations

### Backend Architecture

**Server Framework**
- Express.js as the HTTP server with TypeScript support
- ESM module system for modern JavaScript features
- Session-based authentication using express-session with PostgreSQL session store

**Authentication & Security**
- bcrypt for password hashing with salt rounds of 10
- Session-based authentication with HTTP-only cookies
- Authentication middleware (`isAuthenticated`) for protected routes
- Session TTL of 7 days with secure cookie settings in production

**API Design**
- RESTful API structure under `/api` prefix
- JSON request/response format
- Comprehensive error handling with appropriate HTTP status codes
- Request logging middleware for debugging and monitoring

**Bot Integration**
- Telegraf library for Telegram Bot API integration
- Bot lifecycle management (start/stop/restart)
- Message listener for command processing from group replies
- Bot configuration stored in database with runtime state tracking

### Data Storage & Schema

**Database Technology**
- PostgreSQL via Neon serverless driver with WebSocket support
- Drizzle ORM for type-safe database queries and schema management
- Schema-first approach with TypeScript types generated from database schema

**Database Schema**

*Admins Table*
- Stores administrator credentials for dashboard access
- Username/password authentication
- UUID primary keys with auto-generation

*Bot Config Table*
- Stores Telegram bot token and metadata
- Tracks bot username, ID, active status, and last restart time
- Single configuration approach (one bot per system)

*Group Whitelist Table*
- Manages allowed Telegram groups where bot can operate
- Stores group ID, title, member count, and active status
- Enables granular group access control

*Commands Table*
- Defines custom bot commands with various action types
- Supports pin_message, set_title, mute, kick actions
- Tracks command usage count and enabled/disabled state
- Includes trigger conditions and response templates

*Activity Logs Table*
- Records all bot and system activities
- Categorizes by action type and status (success/error)
- Provides audit trail for troubleshooting and monitoring

**Storage Layer**
- Abstract storage interface (`IStorage`) for database operations
- Centralized data access layer in `server/storage.ts`
- Type-safe CRUD operations using Drizzle ORM

### External Dependencies

**Third-Party Services**
- Telegram Bot API via Telegraf library for bot functionality
- Neon PostgreSQL database for serverless data storage

**Key NPM Packages**
- `telegraf` - Telegram Bot API framework
- `@neondatabase/serverless` - Serverless PostgreSQL driver
- `drizzle-orm` - Type-safe ORM
- `express-session` & `connect-pg-simple` - Session management
- `bcrypt` - Password hashing
- `@tanstack/react-query` - Client-side data fetching
- `react-hook-form` & `zod` - Form handling and validation
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS framework

**Development Tools**
- Vite plugins for Replit integration (cartographer, dev banner, runtime error overlay)
- TypeScript for type safety across the stack
- Drizzle Kit for database migrations

**Environment Variables**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Session encryption key (required)
- `NODE_ENV` - Environment mode (development/production)