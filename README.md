# 🎬 WatchParty

**[Live Demo](https://watchparty06.vercel.app/)**

WatchParty is a real-time collaborative video synchronization platform that allows users to watch YouTube videos together. It ensures everyone in the room stays perfectly in sync, featuring authoritative host controls, role-based interaction barriers, and smart playback logic to handle buffering and drift.

## ✨ Features

- **Real-Time Synchronization:** Seamless, frame-accurate synchronization of YouTube videos across multiple clients using Socket.IO.
- **Role-Based Controls:** 
  - **Host:** Full control over video playback, pausing, seeking, and changing the video.
  - **Participant:** Read-only playback state. Participants can adjust their local volume and subtitles, but any attempt to manually pause or play the video will trigger "rubber-banding" to instantly snap them back in sync with the host.
- **Dynamic Video Loading:** Easily change the video mid-party without reloading the room. The custom parser supports standard YouTube links, bare IDs, and YouTube Shorts URLs.
- **Anti-Drift Technology:** Automatically corrects playback drift if a participant's video falls out of sync (by more than 2 seconds) due to network latency.
- **Modern UI:** Built with Next.js and Tailwind CSS for a sleek, responsive, and intuitive dark-mode interface.

## 🛠 Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, YouTube IFrame API
- **Backend:** Node.js, Express, Socket.IO
- **State Management:** Custom React Hooks + Singleton Socket Client

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18+) installed.

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd Watchparty
```

### 2. Setup the Backend
The backend serves as the authoritative state manager and WebSocket server.
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```
The backend will start running on `http://localhost:4000`.

### 3. Setup the Frontend
Open a new terminal window:
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
The frontend will start running on `http://localhost:3000`. Open this URL in your browser to start a party!

## 📂 Project Architecture

The project is split into a standalone backend and frontend to ensure clean separation of concerns:

- `backend/src/rooms/roomManager.js`: Authoritative in-memory state manager (pure logic, no socket dependencies).
- `backend/src/socket/socketHandlers.js`: WebSocket event listeners, role-verification, and state broadcasters.
- `frontend/src/app/room/[roomId]/page.tsx`: Main WatchParty layout, rendering the lobby, player column, and participant sidebar.
- `frontend/src/components/player/YoutubePlayer.tsx`: Core IFrame engine handling anti-echo patterns, `lastSyncEvent` state propagation, and participant rubber-banding.
- `frontend/src/hooks/useRoom.ts`: Centralized custom hook managing the Socket.IO connection lifecycle.

## 📝 License
This project is open-source and available under the MIT License.
