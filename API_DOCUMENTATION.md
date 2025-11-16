# WhatsApp Analytics API Documentation

## Overview

Backend API server that monitors multiple WhatsApp groups and provides REST API endpoints for frontend consumption.

**Base URL:** `http://localhost:3000/api`

**WebSocket:** `ws://localhost:3000`

## Quick Start

### 1. Configure Groups

Edit `config.json`:

```json
{
  "groups": ["Army", "Family", "Work"],
  "checkInterval": 60000,
  "messageLimit": 15,
  "detectJoinsLeaves": true,
  "port": 3000
}
```

### 2. Start Server

```bash
npm run server
```

or

```bash
node server.js
```

### 3. Scan QR Code (First Time Only)

The server will display a QR code. Scan it with WhatsApp.

### 4. Access API

The server monitors all configured groups every minute and stores messages in memory.

---

## REST API Endpoints

### Health Check

**GET** `/api/health`

Check if server and WhatsApp are connected.

**Response:**
```json
{
  "status": "ok",
  "whatsappConnected": true,
  "monitoredGroups": [
    {
      "id": "120363123456789@g.us",
      "name": "Army",
      "memberCount": 12
    }
  ],
  "timestamp": "2025-11-12T16:30:00.000Z"
}
```

---

### Get All Groups

**GET** `/api/groups`

List all monitored groups.

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "id": "120363123456789@g.us",
      "name": "Army",
      "memberCount": 12
    }
  ],
  "count": 1
}
```

---

### Get Messages (All Groups)

**GET** `/api/messages`

Get messages from all monitored groups with pagination.

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 100)
- `offset` (optional): Number of messages to skip (default: 0)

**Example:**
```
GET /api/messages?limit=50&offset=0
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg123",
      "timestamp": "2025-11-12T16:30:00.000Z",
      "sender": "Ahmed Hassan",
      "senderId": "201234567890@c.us",
      "message": "Hello everyone!",
      "type": "chat",
      "hasMedia": false,
      "groupId": "120363123456789@g.us",
      "groupName": "Army"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

---

### Get Messages (Specific Group)

**GET** `/api/messages/:groupId`

Get messages from a specific group.

**Parameters:**
- `groupId`: The group ID (from `/api/groups`)

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 100)
- `offset` (optional): Number of messages to skip (default: 0)

**Example:**
```
GET /api/messages/120363123456789@g.us?limit=20&offset=0
```

**Response:**
```json
{
  "success": true,
  "groupName": "Army",
  "messages": [...],
  "total": 75,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

---

### Get Events (All Groups)

**GET** `/api/events`

Get join/leave events from all groups.

**Query Parameters:**
- `limit` (optional): Number of events to return (default: 100)
- `offset` (optional): Number of events to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "timestamp": "2025-11-12T16:25:00.000Z",
      "type": "JOIN",
      "memberName": "Sara Mohamed",
      "memberId": "201987654321@c.us",
      "groupId": "120363123456789@g.us",
      "groupName": "Army"
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0,
  "hasMore": false
}
```

---

### Get Events (Specific Group)

**GET** `/api/events/:groupId`

Get join/leave events from a specific group.

**Parameters:**
- `groupId`: The group ID

**Query Parameters:**
- `limit` (optional): Number of events to return (default: 100)
- `offset` (optional): Number of events to skip (default: 0)

---

### Search Messages

**GET** `/api/search`

Search messages across all groups or within a specific group.

**Query Parameters:**
- `q` (required): Search query
- `groupId` (optional): Limit search to specific group
- `limit` (optional): Max results to return (default: 100)

**Example:**
```
GET /api/search?q=hello&limit=20
```

**Response:**
```json
{
  "success": true,
  "query": "hello",
  "results": [
    {
      "id": "msg123",
      "timestamp": "2025-11-12T16:30:00.000Z",
      "sender": "Ahmed Hassan",
      "message": "Hello everyone!",
      "groupId": "120363123456789@g.us",
      "groupName": "Army"
    }
  ],
  "total": 5,
  "hasMore": false
}
```

---

### Get Statistics

**GET** `/api/stats`

Get statistics about all monitored groups.

**Response:**
```json
{
  "success": true,
  "stats": {
    "groups": [
      {
        "id": "120363123456789@g.us",
        "name": "Army",
        "messageCount": 150,
        "eventCount": 5,
        "memberCount": 12,
        "topSenders": [
          { "name": "Ahmed Hassan", "count": 45 },
          { "name": "Sara Mohamed", "count": 30 }
        ]
      }
    ],
    "totalMessages": 150,
    "totalEvents": 5
  },
  "timestamp": "2025-11-12T16:30:00.000Z"
}
```

---

## WebSocket API

Connect to `ws://localhost:3000` for real-time updates.

### Events

**Connection:**
```json
{
  "type": "connected",
  "message": "Connected to WhatsApp Analytics",
  "groups": [...]
}
```

**New Message:**
```json
{
  "type": "message",
  "message": {
    "id": "msg123",
    "timestamp": "2025-11-12T16:30:00.000Z",
    "sender": "Ahmed Hassan",
    "message": "Hello!",
    "groupId": "120363123456789@g.us",
    "groupName": "Army"
  }
}
```

**Join/Leave Event:**
```json
{
  "type": "event",
  "event": {
    "timestamp": "2025-11-12T16:25:00.000Z",
    "type": "JOIN",
    "memberName": "Sara Mohamed",
    "groupId": "120363123456789@g.us",
    "groupName": "Army"
  }
}
```

**Disconnection:**
```json
{
  "type": "disconnected",
  "message": "WhatsApp disconnected"
}
```

---

## Frontend Integration Examples

### Fetch Messages

```javascript
fetch('http://localhost:3000/api/messages?limit=50')
  .then(res => res.json())
  .then(data => {
    console.log('Messages:', data.messages);
    console.log('Total:', data.total);
  });
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'message') {
    console.log('New message:', data.message);
    // Add to UI
  } else if (data.type === 'event') {
    console.log('Event:', data.event);
    // Show notification
  }
};
```

### Infinite Scroll

```javascript
let offset = 0;
const limit = 20;

async function loadMore() {
  const res = await fetch(
    `http://localhost:3000/api/messages?limit=${limit}&offset=${offset}`
  );
  const data = await res.json();

  // Append messages to UI
  displayMessages(data.messages);

  // Update offset for next load
  offset += limit;

  // Check if more available
  if (!data.hasMore) {
    hideLoadMoreButton();
  }
}
```

### Search

```javascript
const searchQuery = 'hello';

fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(searchQuery)}`)
  .then(res => res.json())
  .then(data => {
    console.log('Search results:', data.results);
  });
```

---

## Configuration

### config.json

```json
{
  "groups": ["Army", "Family"],      // Groups to monitor
  "checkInterval": 60000,             // Check every 60 seconds
  "messageLimit": 15,                 // Fetch last 15 messages
  "detectJoinsLeaves": true,          // Track joins/leaves
  "port": 3000                        // API server port
}
```

---

## Features

✅ Monitor multiple WhatsApp groups simultaneously
✅ Store all messages in memory (accessible via API)
✅ Paginated message retrieval
✅ Real-time updates via WebSocket
✅ Detect group joins and leaves
✅ Search functionality
✅ Group statistics
✅ CORS enabled for frontend access
✅ Auto-reconnect on WhatsApp disconnection

---

## Notes

- Messages are stored **in memory only** (lost on server restart)
- First run shows all current messages, then only new ones
- WebSocket provides real-time updates as messages arrive
- Pagination helps with large message volumes
- All timestamps are in ISO 8601 format (UTC)

---

## Troubleshooting

### "No matching groups found"

1. Run `node list_groups.js` to see available groups
2. Update `config.json` with correct group names

### CORS errors

The server has CORS enabled by default. If you still face issues:
- Check if server is running on correct port
- Verify frontend is making requests to correct URL

### WebSocket not connecting

- Make sure server is running
- Check firewall settings
- Use `ws://localhost:3000` (not `http://`)

---

## Example Frontend Flow

1. **Initial Load:**
   - GET `/api/groups` - Show available groups
   - GET `/api/messages?limit=20` - Load first 20 messages

2. **Scroll/Load More:**
   - GET `/api/messages?limit=20&offset=20` - Next 20 messages
   - Continue with increasing offset

3. **Real-time Updates:**
   - Connect WebSocket on page load
   - Listen for new messages and events
   - Update UI in real-time

4. **Search:**
   - GET `/api/search?q=query` - Search as user types

5. **Statistics:**
   - GET `/api/stats` - Show analytics dashboard
