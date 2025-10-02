# TG Bot Manager

## Overview

This project is a full-stack Telegram bot management system featuring a web-based dashboard. It enables administrators to configure bots, manage group whitelists, create custom commands, and monitor activity logs. The system is designed to provide comprehensive control over bot behavior and group interactions, with a focus on ease of use and efficient management of Telegram group bots.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

-   **Framework:** React 18 with TypeScript.
-   **Build Tool:** Vite.
-   **Routing:** Wouter.
-   **UI:** shadcn/ui (Radix UI) and Tailwind CSS with a custom dark theme.
-   **State Management:** TanStack Query for server state; React Hook Form with Zod for form validation.
-   **Design:** Component-based, dark theme, Chinese language UI, mobile-responsive.

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
-   **Group Management:** Whitelist specific Telegram groups; bot only operates in whitelisted groups.
-   **Command Management:** Create custom commands with `direct` or `reply` trigger types.
    -   **Direct Commands:** Unpin all messages, create invite links, set group name/description.
    -   **Reply Commands:** Pin/unpin messages, set/remove user titles, mute/kick/ban users, delete messages.
-   **Activity Logging:** Detailed logs with group and user context, grouped display, and automated daily cleanup.
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