# 🚀 Quick Start Guide

## Start Everything in 2 Steps!

### Step 1: Start Backend (Terminal 1)

```bash
npm run server
```

**First time only:** Scan the QR code with your WhatsApp

Wait until you see:
```
✅ WhatsApp client ready!
✅ Found group: "Army"
🔄 Starting monitoring...
```

### Step 2: Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## That's It! 🎉

You should now see:
- ✅ Your WhatsApp groups on the left
- ✅ Messages in the center
- ✅ Analytics on the right
- ✅ Real-time updates when new messages arrive

---

## Test It!

Send a message in your WhatsApp group. Within 60 seconds:
1. Backend fetches it
2. Frontend shows a notification
3. Message appears in the UI

---

## Add More Groups

Edit `config.json`:
```json
{
  "groups": ["Army", "Family", "Work Team"]
}
```

Restart backend (Ctrl+C then `npm run server`)

---

## Need Help?

- Full documentation: `INTEGRATION_GUIDE.md`
- API reference: `API_DOCUMENTATION.md`
- Frontend examples: `FRONTEND_GUIDE.md`

---

## What's Running?

**Backend (Port 3000):**
- REST API: http://localhost:3000/api
- WebSocket: ws://localhost:3000
- Health check: http://localhost:3000/api/health

**Frontend (Port 5173):**
- UI: http://localhost:5173
