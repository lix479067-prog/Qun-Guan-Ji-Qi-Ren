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
- `REPLIT_DEV_DOMAIN` - Replit domain for webhook (auto-provided)

### Bot Communication Method

**Webhook Mode (Used)**
- ✅ Real-time message delivery (instant, millisecond-level)
- ✅ Low resource consumption (passive receiving)
- ✅ Automatic domain configuration via `REPLIT_DEV_DOMAIN`
- ✅ Production-ready and efficient

The bot uses Telegram's webhook API to receive messages instantly. Telegram pushes updates directly to the application endpoint at `https://{REPLIT_DEV_DOMAIN}/api/telegram-webhook`. This is more efficient than long polling and requires no CPU-intensive background processes.

## Getting Started

### Default Admin Credentials
- **Username**: `admin`
- **Password**: `admin123`

These credentials are automatically created on first server start if no admin exists.

### Setting Up a Telegram Bot

1. **Create a Telegram Bot**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` command
   - Follow the prompts to create your bot
   - Copy the bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

2. **Configure Bot in Dashboard**
   - Log in to the web dashboard
   - Navigate to "机器人配置" (Bot Configuration) section
   - Paste your bot token
   - Click "更新Token" (Update Token)
   - Bot will automatically restart with new configuration

3. **Add Bot to Groups**
   - Add your bot to a Telegram group
   - Promote the bot to admin with necessary permissions
   - Get the group ID (use `/id` command or Telegram API)
   - Add the group to whitelist in the dashboard

4. **Configure Commands**
   - Create custom commands in the dashboard
   - Choose trigger type: Direct (no reply needed) or Reply (reply to message/user first)
   - Select from various action types based on trigger method

### Command Trigger Types

The bot supports two types of command triggers:

**1. Direct Commands** (管理员直接发送)
Admin sends command directly in the group without replying to any message.

Supported operations:
- `unpin_all_messages` - Unpin all pinned messages
- `create_invite_link` - Create temporary invite link (format: "邀请 [人数] [分钟]")
- `set_group_name` - Change group name (format: "设置群名 [新名称]")
- `set_group_description` - Set group description (format: "设置简介 [内容]")
- `delete_group_description` - Delete group description

**Example: Create Invite Link**
1. Admin sends: "邀请 100 60" (100 members, 60 minutes expiry)
2. Bot creates invite link and replies with the link
3. Action is logged

**2. Reply Commands** (管理员回复消息后发送)
Admin must reply to a message or user first, then send the command.

Supported operations:
- `pin_message` - Pin the replied message
- `unpin_message` - Unpin the replied message
- `set_title` - Set custom title for replied user (format: "设置头衔 [名称]")
- `remove_title` - Remove custom title from replied user
- `mute` - Mute the replied user (1 hour)
- `kick` - Kick the replied user from group
- `delete_message` - Delete the replied message

**Example: Pin Message**
1. Admin replies to a message with text containing "置顶"
2. Bot checks if admin has proper permissions
3. Bot pins the replied-to message
4. Action is logged

**Example: Set Title**
1. Admin replies to a user's message with "设置头衔 VIP会员"
2. Bot extracts "VIP会员" as the custom title
3. Bot updates the user's admin title
4. Action is logged

### Group Whitelist Security

- Only whitelisted groups can use the bot
- Bot ignores commands from non-whitelisted groups
- Only group administrators can trigger commands
- Regular group members cannot execute bot commands

## Recent Changes

### 2025-10-01 (Latest Update)
- **Added two command trigger types:**
  - Direct commands: Admin sends command without replying (e.g., "邀请 100 60", "设置群名 新名称")
  - Reply commands: Admin replies to message/user then sends command (e.g., reply + "置顶", reply + "设置头衔 VIP")
- **Implemented 7 new command operations:**
  - unpin_message, unpin_all_messages, remove_title (reply commands)
  - create_invite_link, set_group_name, set_group_description, delete_group_description (direct commands)
- Updated database schema with `trigger_type` field (default: 'reply')
- Refactored bot.ts with separate handlers for direct and reply commands
- Enhanced UI to show trigger type badges (blue for direct, purple for reply)
- All new features tested and verified working end-to-end

### 2025-10-01 (Earlier)
- Fixed TypeScript LSP errors across the codebase
- Added session type declarations for express-session
- Improved Telegram chat type handling in bot.ts
- Added proper type annotations for React Query responses
- Updated storage interface to support bot configuration updates
- All MVP features tested and verified working:
  - Admin login and authentication
  - Group whitelist management
  - Command configuration (create, edit, delete)
  - Activity logging and statistics

## Testing Status

All core features have been tested and verified:
- ✅ Admin login/logout functionality
- ✅ Group whitelist (add/remove groups)
- ✅ Command configuration (create/edit/delete commands)
- ✅ Direct command triggers (verified triggerType='direct' persisted in DB)
- ✅ Reply command triggers (verified triggerType='reply' persisted in DB)
- ✅ Activity logs display
- ✅ Statistics dashboard

## Next Steps

Potential future enhancements:
- Add more command types (ban, unban, warn)
- Per-group command configuration
- Multi-admin support with role-based permissions
- Enhanced activity log filtering and search
- Bot uptime monitoring and alerts
- Webhook support for better performance