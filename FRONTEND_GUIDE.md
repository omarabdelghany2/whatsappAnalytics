# Frontend Integration Guide

## Overview

This backend API server monitors multiple WhatsApp groups and provides REST + WebSocket APIs for your frontend.

## Architecture

```
┌─────────────────┐
│   WhatsApp      │
│   Groups        │
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Backend │ ← Monitors every 60 seconds
    │  Server  │ ← Stores messages in memory
    └────┬─────┘
         │
    ┌────▼─────────┐
    │   REST API   │ ← GET /api/messages
    │   WebSocket  │ ← Real-time updates
    └──────────────┘
         │
    ┌────▼─────────┐
    │   Frontend   │ ← Your UI
    └──────────────┘
```

## Quick Start for Frontend Developers

### 1. Start the Backend

```bash
cd whatsappAnalytics
npm run server
```

### 2. Check if Running

Open browser: `http://localhost:3000/api/health`

You should see:
```json
{
  "status": "ok",
  "whatsappConnected": true,
  "monitoredGroups": [...]
}
```

### 3. Connect from Frontend

**REST API:**
```javascript
// Fetch messages
const response = await fetch('http://localhost:3000/api/messages?limit=20');
const data = await response.json();
console.log(data.messages);
```

**WebSocket:**
```javascript
// Real-time updates
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New message:', data);
};
```

---

## API Endpoints Summary

### Get Messages (Paginated)

```javascript
// Get first 20 messages
fetch('http://localhost:3000/api/messages?limit=20&offset=0')

// Get next 20 messages
fetch('http://localhost:3000/api/messages?limit=20&offset=20')
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg123",
      "timestamp": "2025-11-12T16:30:00.000Z",
      "sender": "Ahmed Hassan",
      "message": "Hello!",
      "groupName": "Army"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

### Get Messages from Specific Group

```javascript
// Get group ID from /api/groups first
const groupId = "120363123456789@g.us";
fetch(`http://localhost:3000/api/messages/${groupId}?limit=20`)
```

### Search Messages

```javascript
fetch('http://localhost:3000/api/search?q=hello')
```

### Get Statistics

```javascript
fetch('http://localhost:3000/api/stats')
```

**Response:**
```json
{
  "stats": {
    "groups": [
      {
        "name": "Army",
        "messageCount": 150,
        "topSenders": [
          { "name": "Ahmed", "count": 45 }
        ]
      }
    ],
    "totalMessages": 150
  }
}
```

---

## React Example

### 1. Fetch Messages Component

```jsx
import React, { useEffect, useState } from 'react';

function MessageList() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/messages?limit=50')
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.sender}</strong>: {msg.message}
          <small>{new Date(msg.timestamp).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
```

### 2. Real-time Updates

```jsx
import React, { useEffect, useState } from 'react';

function LiveMessages() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Initial load
    fetch('http://localhost:3000/api/messages?limit=20')
      .then(res => res.json())
      .then(data => setMessages(data.messages));

    // WebSocket for real-time
    const ws = new WebSocket('ws://localhost:3000');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        // Add new message to top
        setMessages(prev => [data.message, ...prev]);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.sender}</strong>: {msg.message}
        </div>
      ))}
    </div>
  );
}
```

### 3. Infinite Scroll

```jsx
import React, { useEffect, useState } from 'react';

function InfiniteMessages() {
  const [messages, setMessages] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = () => {
    if (loading || !hasMore) return;

    setLoading(true);
    fetch(`http://localhost:3000/api/messages?limit=20&offset=${offset}`)
      .then(res => res.json())
      .then(data => {
        setMessages(prev => [...prev, ...data.messages]);
        setOffset(prev => prev + 20);
        setHasMore(data.hasMore);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMore();
  }, []);

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.message}</div>
      ))}

      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### 4. Search Component

```jsx
import React, { useState } from 'react';

function SearchMessages() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = () => {
    fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => setResults(data.results));
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search messages..."
      />
      <button onClick={handleSearch}>Search</button>

      {results.map(msg => (
        <div key={msg.id}>
          <strong>{msg.sender}</strong>: {msg.message}
        </div>
      ))}
    </div>
  );
}
```

---

## Vue.js Example

```vue
<template>
  <div>
    <div v-for="msg in messages" :key="msg.id">
      <strong>{{ msg.sender }}</strong>: {{ msg.message }}
    </div>
    <button @click="loadMore" v-if="hasMore">Load More</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      messages: [],
      offset: 0,
      hasMore: true
    };
  },
  mounted() {
    this.loadMessages();
    this.connectWebSocket();
  },
  methods: {
    async loadMessages() {
      const res = await fetch(`http://localhost:3000/api/messages?limit=20&offset=${this.offset}`);
      const data = await res.json();
      this.messages.push(...data.messages);
      this.offset += 20;
      this.hasMore = data.hasMore;
    },
    loadMore() {
      this.loadMessages();
    },
    connectWebSocket() {
      const ws = new WebSocket('ws://localhost:3000');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          this.messages.unshift(data.message);
        }
      };
    }
  }
};
</script>
```

---

## Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp Monitor</title>
</head>
<body>
  <div id="messages"></div>
  <button id="loadMore">Load More</button>

  <script>
    let offset = 0;
    const messagesDiv = document.getElementById('messages');
    const loadMoreBtn = document.getElementById('loadMore');

    // Load messages
    async function loadMessages() {
      const res = await fetch(`http://localhost:3000/api/messages?limit=20&offset=${offset}`);
      const data = await res.json();

      data.messages.forEach(msg => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${msg.sender}</strong>: ${msg.message}`;
        messagesDiv.appendChild(div);
      });

      offset += 20;

      if (!data.hasMore) {
        loadMoreBtn.style.display = 'none';
      }
    }

    // WebSocket
    const ws = new WebSocket('ws://localhost:3000');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${data.message.sender}</strong>: ${data.message.message}`;
        messagesDiv.insertBefore(div, messagesDiv.firstChild);
      }
    };

    loadMoreBtn.onclick = loadMessages;
    loadMessages(); // Initial load
  </script>
</body>
</html>
```

---

## CORS Configuration

The backend has CORS enabled by default for all origins. If you need to restrict:

Edit `server.js`:
```javascript
app.use(cors({
  origin: 'http://localhost:5173' // Your frontend URL
}));
```

---

## Environment Variables (Optional)

You can use environment variables for configuration:

```bash
PORT=3000 node server.js
```

---

## Production Deployment

### Backend

1. **Use a process manager:**
```bash
npm install -g pm2
pm2 start server.js --name whatsapp-api
```

2. **Environment variables:**
```bash
export PORT=3000
export NODE_ENV=production
```

### Frontend

Your frontend should connect to:
- REST API: `https://your-domain.com/api`
- WebSocket: `wss://your-domain.com`

---

## Data Flow

### Initial Load
```
Frontend → GET /api/messages?limit=20
Backend → Returns last 20 messages
Frontend → Displays messages
```

### Scroll/Load More
```
Frontend → GET /api/messages?limit=20&offset=20
Backend → Returns next 20 messages
Frontend → Appends to list
```

### Real-time Updates
```
WhatsApp → New message arrives
Backend → Stores message
Backend → Broadcasts via WebSocket
Frontend → Receives via WebSocket
Frontend → Adds to UI (top of list)
```

---

## Tips

1. **Pagination:** Use `limit` and `offset` for smooth scrolling
2. **Real-time:** WebSocket for instant updates
3. **Search:** Debounce search input to avoid too many requests
4. **Caching:** Cache messages in frontend state
5. **Loading states:** Show spinners during API calls
6. **Error handling:** Handle network errors gracefully

---

## Example Full App Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── MessageList.jsx
│   │   ├── MessageItem.jsx
│   │   ├── SearchBar.jsx
│   │   └── GroupFilter.jsx
│   ├── hooks/
│   │   ├── useMessages.js
│   │   └── useWebSocket.js
│   ├── services/
│   │   └── api.js
│   └── App.jsx
```

**services/api.js:**
```javascript
const API_URL = 'http://localhost:3000/api';

export const api = {
  getMessages: (limit = 20, offset = 0) =>
    fetch(`${API_URL}/messages?limit=${limit}&offset=${offset}`)
      .then(res => res.json()),

  search: (query) =>
    fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json()),

  getStats: () =>
    fetch(`${API_URL}/stats`)
      .then(res => res.json())
};
```

---

## Ready to Connect!

Your backend is ready at:
- **REST API:** `http://localhost:3000/api`
- **WebSocket:** `ws://localhost:3000`
- **Health Check:** `http://localhost:3000/api/health`

Check `API_DOCUMENTATION.md` for complete API reference!
