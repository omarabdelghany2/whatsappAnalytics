# WhatsApp Cairo Group Chat Analyzer

An automated tool to extract, parse, and analyze WhatsApp chat messages from the "cairo" group.

## Features

- **Real-time monitoring** - Check for new messages every minute automatically
- **Automated extraction** via WhatsApp Web bot (no manual export needed!)
- Parse WhatsApp exported chat files
- Extract messages with timestamps, senders, and content
- Generate statistics (message counts per sender, date ranges)
- Export data to JSON and CSV formats
- Search for specific keywords in messages
- Support for multiple WhatsApp export formats

## Three Methods Available

### Method 1: Real-Time Monitor (Best for Continuous Monitoring) ⭐
Automatically checks Cairo group every minute for new messages. Perfect for keeping track of conversations in real-time!

### Method 2: One-Time Extraction (Quick Snapshot)
Use the WhatsApp Web bot to extract messages once. Just scan a QR code and the bot does the rest!

### Method 3: Manual Export (Traditional Method)
Manually export chat from your phone and analyze the text file.

## Installation

1. Make sure you have Python 3.7+ installed

2. Install pipenv (if not already installed):
```bash
pip install pipenv
```

3. Install project dependencies using pipenv:
```bash
pipenv install
```

4. Activate the virtual environment:
```bash
pipenv shell
```

Alternatively, you can run commands without activating the shell:
```bash
pipenv run python extract_cairo_chat.py <file>
```

### For Node.js (Bot Method)

Install Node.js dependencies:
```bash
npm install
```

---

## Method 1: Real-Time Monitor ⭐ (Recommended)

Monitor the Cairo group continuously and get notified of new messages every minute!

### How It Works
- Checks Cairo group every 60 seconds
- Detects and displays new messages
- Saves all messages to files automatically
- Keeps running until you stop it (Ctrl+C)
- Stays logged in (no repeated QR code scans)

### Quick Start

**Windows - Double-click:**
```
start_monitor.bat
```

**Or run directly:**
```bash
node monitor.js
```

**Or with npm:**
```bash
npm run monitor
```

### First Time
1. The monitor will show a QR code
2. Scan it with WhatsApp (only needed once)
3. Monitor starts automatically

### Every Time After
- No QR code needed!
- Just run the command
- Starts monitoring immediately

### What You'll See

```
[12/11/2025, 15:30:00] Checking for new messages...
✅ Loaded 15 messages (first run)

[12/11/2025, 15:31:00] Checking for new messages...
   No new messages

[12/11/2025, 15:32:00] Checking for new messages...
🆕 Found 2 new message(s)!
   [12/11/2025, 15:31] Ahmed: Hello everyone!
   [12/11/2025, 15:32] Sara: Hi Ahmed!
```

### Output Files

The monitor creates 3 files in `output/`:
- `cairo_chat_latest.txt` - Last 15 messages (updated every minute)
- `cairo_chat_latest.json` - Last 15 messages in JSON format
- `cairo_chat_history.txt` - All messages ever seen (keeps growing)

### Stop the Monitor

Press **Ctrl+C** in the terminal window

---

## Method 2: One-Time Extraction (Quick Snapshot)

The easiest way to extract your cairo group chat is using the automated bot!

### Step 1: Run the Bot

**Windows:**
```bash
run_bot.bat
```

**Mac/Linux:**
```bash
node bot.js
```

Or:
```bash
npm start
```

### Step 2: Scan QR Code

1. The bot will display a QR code in your terminal
2. Open WhatsApp on your phone
3. Go to **Settings** → **Linked Devices** → **Link a Device**
4. Scan the QR code displayed in the terminal

### Step 3: Wait for Extraction

The bot will automatically:
- Find the "cairo" group
- Extract all messages
- Save them to `output/cairo_chat_export.txt`
- Generate statistics
- Display results

**That's it!** The chat is now saved and you can analyze it.

### Running Python Analysis After Bot Extraction

After the bot completes, you can run additional analysis:

```bash
pipenv run python extract_cairo_chat.py "output/cairo_chat_export.txt"
```

---

## Method 3: Manual Export

If you prefer not to use the bot, you can manually export the chat:

### How to Export WhatsApp Chat

1. Open WhatsApp on your phone
2. Go to the **cairo** group chat
3. Tap on the group name at the top
4. Scroll down and select **"Export chat"**
5. Choose **"Without media"** (recommended) or **"With media"**
6. Save/share the exported `.txt` file to your computer
7. Place the file in this project directory or note its path

### Manual Method Usage

Run the Python script with your exported file:

**Option 1: Inside pipenv shell**
```bash
pipenv shell
python extract_cairo_chat.py path/to/exported_chat.txt
```

**Option 2: Using pipenv run (without activating shell)**
```bash
pipenv run python extract_cairo_chat.py path/to/exported_chat.txt
```

Or if the file is in the current directory:

```bash
pipenv run python extract_cairo_chat.py "WhatsApp Chat with cairo.txt"
```

### What the Script Does

1. **Parses the chat file** - Reads and processes all messages
2. **Shows statistics** - Displays:
   - Total message count
   - Messages per sender (with percentages)
   - Date range (first and last message)
3. **Exports data** - Creates an `output/` folder with:
   - `cairo_chat.json` - All messages in JSON format
   - `cairo_chat.csv` - All messages in CSV format
4. **Keyword search** - Optionally search for specific words/phrases in messages

### Example Output

```
Loading chat from: WhatsApp Chat with cairo.txt
------------------------------------------------------------

Total messages: 1,234

Messages per sender:
------------------------------------------------------------
Ahmed: 456 messages (37.0%)
Sara: 389 messages (31.5%)
Mohamed: 234 messages (19.0%)
Fatima: 155 messages (12.5%)

Date range:
------------------------------------------------------------
First message: 2024-01-15 09:30:00
Last message: 2024-11-12 14:22:00

============================================================
Exporting data...
============================================================
Exported 1,234 messages to output/cairo_chat.json
Exported 1,234 messages to output/cairo_chat.csv

============================================================
Done! Check the 'output' folder for exported files.
============================================================
```

## Output Files

### JSON Format (`cairo_chat.json`)
```json
[
  {
    "timestamp": "2024-11-12 10:30:00",
    "timestamp_str": "12/11/2024, 10:30",
    "sender": "Ahmed",
    "message": "Hello everyone!"
  }
]
```

### CSV Format (`cairo_chat.csv`)
| timestamp | timestamp_str | sender | message |
|-----------|---------------|--------|---------|
| 2024-11-12 10:30:00 | 12/11/2024, 10:30 | Ahmed | Hello everyone! |

## Advanced Usage

### Using as a Python Module

You can also import and use the parser in your own scripts:

```python
from whatsapp_parser import WhatsAppParser

# Parse a chat file
parser = WhatsAppParser("path/to/chat.txt")
messages = parser.parse()

# Get statistics
print(f"Total messages: {parser.get_message_count()}")
print(f"Sender stats: {parser.get_sender_stats()}")

# Search for keywords
results = parser.search_messages("meeting")
print(f"Found {len(results)} messages about meetings")

# Get messages from specific sender
ahmed_messages = parser.get_messages_by_sender("Ahmed")

# Export to different formats
parser.export_to_json("output.json")
parser.export_to_csv("output.csv")
```

## Supported Date Formats

The parser automatically detects and supports multiple WhatsApp export formats:
- `[DD/MM/YYYY, HH:MM:SS]` format
- `DD/MM/YYYY, HH:MM - ` format
- `MM/DD/YYYY, HH:MM AM/PM - ` format
- And various other international formats

## Troubleshooting

### "No messages found" error
- Make sure you're using the correct exported chat file
- Verify the file is a `.txt` file exported from WhatsApp
- Check that the file contains the actual chat messages

### Import errors
- Run `pip install -r requirements.txt` to install dependencies
- Make sure you're using Python 3.7 or higher

### File encoding issues
- The script uses UTF-8 encoding by default
- If you see garbled text, the export file might use a different encoding

## Privacy Note

- This tool only works with locally exported chat files
- No data is sent to any external servers
- All processing happens on your computer
- Keep your exported chat files secure and private

## License

This project is open source and available for personal use.
#   w h a t s a p p A n a l y t i c s  
 