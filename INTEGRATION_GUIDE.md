# WhatsApp Analytics - Full Stack Integration Guide

## Overview

Complete WhatsApp analytics system with backend API monitoring and React frontend.

```
┌─────────────────────┐
│   WhatsApp Groups   │
│   (Army, etc.)      │
└─────────┬───────────┘
          │
     ┌────▼──────┐
     │  Backend  │ ← Monitors every 60 seconds
     │  API      │ ← Stores all messages
     │  (Node.js)│ ← WebSocket for real-time
     └────┬──────┘
          │
          │ REST API + WebSocket
          │
     ┌────▼──────┐
     │  Frontend │ ← React + TypeScript
     │  (Vite)   │ ← Real-time UI
     └───────────┘
```

---

## Quick Start

### 1. Start Backend API Server

```bash
# In the main directory
npm run server
```

**First time:** Scan QR code with WhatsApp
**After that:** Automatically stays logged in

Backend will be available at:
- REST API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000`

### 2. Start Frontend

```bash
# In new terminal
cd frontend
npm run dev
```

Frontend will be available at: `http://localhost:5173`

---

## Configuration

### Backend (config.json)

```json
{
  "groups": ["Army", "Family"],     // Groups to monitor
  "checkInterval": 60000,            // Check every 60 seconds
  "messageLimit": 15,                // Messages per check
  "detectJoinsLeaves": true,        // Track join/leave
  "port": 3000                      // API port
}
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

---

## Features

### Backend API

✅ **Monitors Multiple Groups** - Configured in config.json
✅ **Stores All Messages** - In-memory storage, accessible via API
✅ **Detects Join/Leave Events** - Tracks group membership
✅ **REST API** - Full API for querying data
✅ **WebSocket** - Real-time message push
✅ **Pagination** - Efficient data loading
✅ **Search** - Find messages across groups
✅ **Statistics** - Analytics per group

### Frontend

✅ **Real-time Updates** - WebSocket connection
✅ **Group List** - See all monitored groups
✅ **Chat View** - Browse messages
✅ **Analytics Panel** - Group statistics
✅ **Toast Notifications** - New messages & events
✅ **Dark/Light Mode** - Theme toggle
✅ **Responsive Design** - Modern UI

---

## Project Structure

```
whatsappAnalytics/
├── server.js                # Backend API server
├── monitor.js              # Standalone monitor (alternative)
├── bot.js                  # One-time extraction
├── config.json             # Backend configuration
├── package.json            # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── api.ts          # Backend API client
│   │   ├── pages/
│   │   │   └── Index.tsx       # Main page (connected to backend)
│   │   ├── components/
│   │   │   ├── GroupList.tsx
│   │   │   ├── ChatView.tsx
│   │   │   └── AnalyticsPanel.tsx
│   │   └── App.tsx
│   ├── .env                    # Frontend configuration
│   └── package.json            # Frontend dependencies
│
└── Documentation/
    ├── API_DOCUMENTATION.md    # Complete API reference
    ├── FRONTEND_GUIDE.md       # Frontend integration
    └── SETUP_GUIDE.md          # Monitor configuration
```

---

## How It Works

### 1. Backend Monitoring

```javascript
// Every 60 seconds
1. Connect to WhatsApp Web
2. Fetch last 15 messages from each group
3. Store new messages in memory
4. Detect joins/leaves
5. Broadcast updates via WebSocket
```

### 2. Frontend Connection

```javascript
// On page load
1. Fetch groups from API
2. Fetch initial messages
3. Connect WebSocket
4. Display data
5. Listen for real-time updates
```

### 3. Data Flow

```
New Message → Backend stores → WebSocket broadcast → Frontend updates UI
```

---

## API Endpoints Used by Frontend

### GET /api/groups
```javascript
// Fetch monitored groups
const { groups } = await api.getGroups();
```

### GET /api/messages?limit=100&offset=0
```javascript
// Fetch messages (paginated)
const { messages, hasMore } = await api.getMessages(100, 0);
```

### GET /api/messages/:groupId
```javascript
// Fetch messages from specific group
const { messages } = await api.getGroupMessages(groupId, 100, 0);
```

### GET /api/stats
```javascript
// Fetch statistics
const { stats } = await api.getStats();
```

### GET /api/search?q=query
```javascript
// Search messages
const { results } = await api.search("hello");
```

### WebSocket ws://localhost:3000
```javascript
// Real-time updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'message') {
    // New message received
  }
};
```

---

## Running in Development

### Terminal 1: Backend
```bash
npm run server
```

Output:
```
🚀 API Server running on http://localhost:3000
📡 WebSocket available at ws://localhost:3000
✅ WhatsApp client ready!
✅ Found group: "Army"
🔄 Starting monitoring...
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

Output:
```
VITE v5.x.x ready in X ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## Testing the Integration

### 1. Check Backend Health

Open browser: `http://localhost:3000/api/health`

Should see:
```json
{
  "status": "ok",
  "whatsappConnected": true,
  "monitoredGroups": [...]
}
```

### 2. Check Frontend

Open browser: `http://localhost:5173`

Should see:
- Group list on the left
- Messages in the center
- Analytics on the right

### 3. Send a Test Message

Send a message in your WhatsApp group. Within 60 seconds:
1. Backend fetches it
2. WebSocket broadcasts it
3. Frontend shows toast notification
4. Message appears in UI

---

## Troubleshooting

### Backend Issues

**"No matching groups found"**
- Run `npm run list` to see available groups
- Update `config.json` with correct group names

**"Auth failed"**
- Delete `.wwebjs_auth` folder
- Restart backend and scan QR code again

**WebSocket not working**
- Check if port 3000 is available
- Look for firewall blocks

### Frontend Issues

**"Failed to fetch"**
- Make sure backend is running on port 3000
- Check `.env` has correct API_URL

**No real-time updates**
- Check WebSocket connection in browser DevTools
- Verify backend WebSocket is working

**Empty groups list**
- Backend might not have any groups configured
- Check `config.json`

---

## Adding More Groups

### 1. Update Backend Config

Edit `config.json`:
```json
{
  "groups": ["Army", "Family", "Work Team"],
  ...
}
```

### 2. Restart Backend

```bash
# Stop server (Ctrl+C)
npm run server
```

### 3. Frontend Auto-Updates

Frontend will automatically show new groups!

---

## Production Deployment

### Backend

```bash
# Use PM2
npm install -g pm2
pm2 start server.js --name whatsapp-api

# Or Docker
docker build -t whatsapp-api .
docker run -p 3000:3000 whatsapp-api
```

### Frontend

```bash
cd frontend
npm run build

# Serve dist/ folder
npx serve -s dist
```

---

## File Changes Made

### New Files
- `frontend/src/lib/api.ts` - Backend API client
- `frontend/.env` - Environment configuration
- `INTEGRATION_GUIDE.md` - This guide

### Modified Files
- `frontend/src/pages/Index.tsx` - Connected to real backend data
- `config.json` - Added port configuration

---

## Next Steps

1. ✅ Backend is running and monitoring groups
2. ✅ Frontend is connected and showing real data
3. ✅ Real-time updates are working
4. 🎯 **You're ready to use the app!**

---

## Support

- **API Reference:** See `API_DOCUMENTATION.md`
- **Frontend Examples:** See `FRONTEND_GUIDE.md`
- **Monitor Config:** See `SETUP_GUIDE.md`

---

## Summary

✅ Backend monitors WhatsApp groups every minute
✅ All messages stored and accessible via API
✅ Frontend displays real-time data
✅ WebSocket pushes instant updates
✅ Full pagination, search, and statistics

**Open both in browser to see it working!**
- Backend API: `http://localhost:3000/api/health`
- Frontend UI: `http://localhost:5173`
