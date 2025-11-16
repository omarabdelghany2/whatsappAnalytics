# Setup Guide - WhatsApp Group Monitor

## Quick Start

### 1. List Your Available Groups

First, see all WhatsApp groups you're in:

```bash
node list_groups.js
```

or

```bash
npm run list
```

This will show something like:

```
======================================================================
Found 5 group(s):

1. Cairo
   ID: 120363123456789@g.us
   Members: 8

2. Family Group
   ID: 120363987654321@g.us
   Members: 15

3. Work Team
   ID: 120363111222333@g.us
   Members: 25
======================================================================
```

### 2. Edit config.json

Open `config.json` and add the groups you want to monitor:

```json
{
  "groups": [
    "cairo",
    "family"
  ],
  "checkInterval": 60000,
  "messageLimit": 15,
  "detectJoinsLeaves": true
}
```

**Configuration Options:**

- `groups` (array): List of group names to monitor (case-insensitive, partial match)
- `checkInterval` (number): How often to check for new messages in milliseconds (60000 = 1 minute)
- `messageLimit` (number): How many recent messages to fetch each time
- `detectJoinsLeaves` (boolean): Whether to detect when people join/leave groups

### 3. Start Monitoring

```bash
node monitor.js
```

or

```bash
npm run monitor
```

## Features

### Multiple Group Monitoring

Monitor multiple groups at once:

```json
{
  "groups": ["cairo", "work", "family", "friends"]
}
```

The monitor will:
- Check all groups every minute (or your configured interval)
- Display messages with the group name
- Save each group's messages to separate files

### Join/Leave Detection

When enabled (`detectJoinsLeaves: true`), you'll see:

```
======================================================================
🟢 NEW MEMBER IN CAIRO
======================================================================
👤 Ahmed Hassan
⏰ 12/11/2025, 16:30:00
======================================================================
```

or

```
======================================================================
🔴 MEMBER LEFT CAIRO
======================================================================
👤 Sara Mohamed
⏰ 12/11/2025, 16:35:00
======================================================================
```

Events are also logged to: `output/cairo_events.txt`

### Output Files

For each group, the monitor creates:

- `{group}_latest.txt` - Last 15 messages (updated every check)
- `{group}_latest.json` - Last 15 messages in JSON format
- `{group}_history.txt` - All messages ever seen (keeps growing)
- `{group}_events.txt` - Join/leave events log

Example for "Cairo" group:
- `output/cairo_latest.txt`
- `output/cairo_latest.json`
- `output/cairo_history.txt`
- `output/cairo_events.txt`

## Tips

### Monitor Specific Group Only

```json
{
  "groups": ["cairo"]
}
```

### Check More Frequently (Every 30 seconds)

```json
{
  "checkInterval": 30000
}
```

### Fetch More Messages (last 50)

```json
{
  "messageLimit": 50
}
```

### Disable Join/Leave Detection

```json
{
  "detectJoinsLeaves": false
}
```

## Troubleshooting

### "No matching groups found"

1. Run `node list_groups.js` to see available groups
2. Make sure the group names in `config.json` match (case-insensitive)
3. Group names can be partial matches (e.g., "cai" will match "Cairo")

### "Group not found" after running

The group name might have changed. Run `list_groups.js` again to get updated names.

### Duplicate Messages

This is normal on first run. The monitor loads the last 15 messages to establish a baseline. After that, only new messages are shown.

### No Join/Leave Events Showing

- Make sure `detectJoinsLeaves: true` in config.json
- Events only trigger when someone actually joins or leaves while the monitor is running
- Past joins/leaves before the monitor started won't be detected

## Advanced

### Match Multiple Groups with Similar Names

```json
{
  "groups": ["family"]
}
```

This will match:
- "Family Group"
- "Extended Family"
- "Family 2024"
- etc.

### Monitor Everything with High Frequency

```json
{
  "groups": ["cairo", "work", "family", "friends"],
  "checkInterval": 15000,
  "messageLimit": 30,
  "detectJoinsLeaves": true
}
```

Checks every 15 seconds, fetches last 30 messages, tracks all events.
