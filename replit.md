# TG Bot Manager

## Overview

This project is a full-stack Telegram bot management system featuring a web-based dashboard. It enables administrators to configure bots, manage group whitelists, create custom commands, and monitor activity logs. The system is designed to provide comprehensive control over bot behavior and group interactions, with a focus on ease of use and efficient management of Telegram group bots.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

-   **Framework:** React 18 with TypeScript.
-   **Build Tool:** Vite.
-   **Routing:** Wouter with multi-page navigation.
-   **UI:** shadcn/ui (Radix UI) and Tailwind CSS with a custom dark theme.
-   **State Management:** TanStack Query for server state; React Hook Form with Zod for form validation.
-   **Design:** Component-based, dark theme, Chinese language UI, mobile-responsive.
-   **Page Structure:**
    -   **Dashboard (/):** Statistics overview (active groups, configured commands, uptime) and bot configuration
    -   **Group Settings (/group-settings):** Group whitelist management and command configuration in two-column layout
    -   **Logs (/logs):** Activity logging with system logs (30%) and group logs (70%) in horizontal split layout
-   **Navigation:** Persistent sidebar with active route highlighting, proper authentication state handling during loading

### Backend

-   **Framework:** Express.js with TypeScript and ESM.
-   **Authentication:** Session-based using `express-session` (PostgreSQL store), `bcrypt` for password hashing, HTTP-only cookies, 7-day session TTL.
-   **API:** RESTful (`/api` prefix), JSON format, comprehensive error handling, request logging.
-   **Bot Integration:** Telegraf library for Telegram Bot API, manages bot lifecycle and command processing. Uses Webhook mode for real-time, efficient message delivery.
-   **Bot Communication:** Webhook mode is used for real-time message delivery, low resource consumption, and flexible domain configuration via environment variables (`WEBHOOK_DOMAIN` or `WEBHOOK_URL`).

### Data Storage

-   **Database:** PostgreSQL (Neon serverless driver).
-   **ORM:** Drizzle ORM for type-safe queries and schema management.
-   **Schema:**
    -   **Admins:** Stores admin credentials.
    -   **Bot Config:** Stores bot token, username, ID, status.
    -   **Group Whitelist:** Manages allowed Telegram groups (ID, title, active status).
    -   **Commands:** Defines custom bot commands (pin, set_title, mute, kick, ban, etc.) with `direct` and `reply` trigger types, and usage counts.
    -   **Activity Logs:** Records bot and system actions with `groupId`, `groupTitle`, `targetUserName`, action type, status, and includes automatic cleanup for logs older than 10 days.

### Feature Specifications

-   **Bot Configuration:** Update bot token, with confirmation dialogs and options to clear group whitelist.
-   **Group Management:** 
    -   Whitelist specific Telegram groups; bot only operates in whitelisted groups
    -   **Search functionality:** Real-time search by group ID or group name (case-insensitive)
    -   **Scrollable list:** Fixed 500px height container with overflow scrolling for many groups
    -   **Refresh groups:** Update group info (title, member count) from Telegram API
-   **Command Management:** 
    -   Create custom commands with `direct` or `reply` trigger types
    -   **Direct Commands:** Unpin all messages, create invite links (with flexible parameters), set group name/description, delete group description, unmute users (via @mention)
    -   **Reply Commands:** Pin/unpin messages, set/remove user titles, mute/unmute users, kick/ban users, delete messages
    -   **Scrollable list:** Fixed 500px height container with overflow scrolling for many commands
    -   **Dynamic action filtering:** Action type dropdown dynamically filters based on selected trigger type, showing only compatible actions
    -   **Smart command filtering:** When creating new commands, the system automatically hides trigger-action combinations that already exist, showing only available command options to prevent duplicates
    -   **Automatic selection:** When creating new commands or changing trigger type, the first available (non-duplicate) action is automatically selected to maintain form validity
    -   **Invite Link Creation:** Requires mandatory parameters with space-separated format (`/创建邀请 10 5` for 10 people, 5 minutes); automatically adds creator name annotation to links; shows error message if parameters are missing
    -   **Unmute Functionality:** Restores normal member permissions (messaging, media, polls); reply method is most reliable; direct method works with text_mention entities via user avatar selection
    -   **Instant Command Feedback:** All operations send immediate status messages before executing, improving perceived responsiveness
-   **New Member Notifications:**
    -   Automatic welcome messages when users join via invite links
    -   Displays who created the invite link (tracked via link name annotation)
    -   Only works with custom invite links created through the bot
    -   Notifications sent in group chat with format: "🎉 欢迎新成员！👤 [新成员] 通过 [邀请人] 的邀请链接加入了群组"
    -   Events logged to activity logs with inviter and new member information
-   **Activity Logging:** 
    -   **Two-tier log system:** System logs (bot token changes, system events) and group logs (command executions per group)
    -   **System logs:** Preserved permanently, never auto-deleted when groups are cleared; includes "🔄 刷新群组信息" actions
    -   **Group logs:** Deleted when clearing groups, preserved when keeping groups; max 30 displayed per group
    -   **Layout:** Horizontal split (30% system logs, 70% group logs with tabs), both independently scrollable in 600px container
    -   **Manual refresh:** No auto-polling; refresh button reloads all logs on demand
    -   **Export functionality:** Per-group CSV export for 2-day or 10-day ranges with Chinese character support
    -   **Automated cleanup:** Daily cleanup at 3 AM removes logs older than 10 days
    -   **Log display format:** Action field shows command name (e.g., "/pin", "/mute"), details field shows operation type with emoji (e.g., "📌 置顶消息")
-   **Security:** Only group administrators can trigger bot commands.

## External Dependencies

-   **Telegram Bot API:** Used via the `telegraf` library for core bot functionality.
-   **Neon PostgreSQL:** Serverless database for data persistence.
-   **NPM Packages:**
    -   `telegraf`
    -   `@neondatabase/serverless`
    -   `drizzle-orm`
    -   `express-session`, `connect-pg-simple`
    -   `bcrypt`
    -   `@tanstack/react-query`
    -   `react-hook-form`, `zod`
    -   `@radix-ui/*`, `tailwindcss`
-   **Environment Variables:** `DATABASE_URL`, `SESSION_SECRET`, `WEBHOOK_DOMAIN` (or `WEBHOOK_URL`), `NODE_ENV`.