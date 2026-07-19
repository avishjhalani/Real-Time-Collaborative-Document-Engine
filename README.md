# Real-Time Collaborative Document Engine

A high-performance, SaaS-style real-time collaborative document workspace. It features Yjs CRDTs for conflict-free typing, live cursor presence, a dark glassmorphic dashboard, and an elegant writing canvas inspired by Notion.

---

## 🚀 Key Features

*   **Real-time Collaboration**: Powered by **Yjs Conflict-free Replicated Data Types (CRDTs)**, ensuring seamless, zero-conflict simultaneous typing across multiple devices.
*   **Live Presence Carets**: Displays active users, custom cursor selections, and typing coordinates in real-time.
*   **Notion-Style Writing Canvas**: An elegant, distraction-free document sheet layout (`bg-zinc-900`) with a floating rich-text formatting toolbar.
*   **SaaS Statistics Dashboard**: Glassmorphic dashboard containing document stats (Total Documents, Cloud Sync status) and quick card actions to rename or delete pages.
*   **Debounced Database Persistence**: Updates are saved to the PostgreSQL database with a 5-second debounce of idle time or immediately on disconnect to optimize database queries.
*   **Scalable Architecture**: Uses a Redis (or Valkey) Pub/Sub cluster adapter to sync document states instantly across multiple load-balanced backend instances.
*   **Secure Authentication**: JWT-based user login and signup with secure encryption.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Lucide icons, Tiptap Editor |
| **Backend** | NestJS, Socket.io (WebSockets), Passport JWT, class-validator |
| **Database** | PostgreSQL, Prisma ORM |
| **Cache / Scaling** | Redis (or Valkey) |
| **Infrastructure** | Docker Compose |

---

## 📦 Directory Structure

```
├── client/          # Vite + React frontend client app
├── server/          # NestJS backend API & WebSocket server gateway
├── docker-compose.yml # Dev infrastructure for PostgreSQL & Redis
└── README.md        # Root documentation
```

---

## ⚙️ Local Development Setup

### Prerequisites
*   Node.js (v18 or higher)
*   Docker & Docker Compose

### 1. Spin up Database & Redis Containers
From the root directory:
```bash
docker-compose up -d
```
This launches a PostgreSQL container on port `5435` and a Redis container on port `6380`.

### 2. Configure Backend Server
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Set up environment variables in `server/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password123@localhost:5435/collab_docs?schema=public"
   REDIS_URL="redis://localhost:6380"
   JWT_SECRET="secure-crdt-editor-token-key-2026"
   PORT=3000
   ```
3. Install dependencies and start NestJS in watch mode:
   ```bash
   npm install
   npm run start:dev
   ```

### 3. Configure Frontend Client
1. Navigate to the client folder:
   ```bash
   cd ../client
   ```
2. Set up local environment variables in `client/.env.local`:
   ```env
   VITE_API_URL=http://localhost:3000
   ```
3. Install dependencies and start Vite dev server:
   ```bash
   npm install
   npm run dev
   ```
4. Open your browser to the local URL (usually `http://localhost:5174/`).

---

## 🌐 Production Deployment

### 1. Database (Supabase PostgreSQL)
*   Create a project on [Supabase](https://supabase.com/).
*   Copy your **Transaction Connection Pooler** string from **Connect** > **ORM (Prisma)** to get IPv4 support.
*   Push your schema from the `server/` directory:
   ```bash
   npx prisma db push
   ```

### 2. Cache (Aiven Valkey / Redis)
*   Create a free Valkey service on [Aiven.io](https://aiven.io/).
*   Copy the **Service URI** and swap the prefix from `valkeys://` to `rediss://`.

### 3. Server Hosting (Render)
*   Host the `server/` directory as a **Web Service** on [Render](https://render.com/).
*   Set the build command to `npm install && npm run build` and start command to `npm run start:prod`.
*   Pass `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` as environment variables.

### 4. Client Hosting (Vercel / Netlify)
*   Host the `client/` directory on Vercel or Netlify.
*   Add the `VITE_API_URL` environment variable pointing to your live Render server address.
