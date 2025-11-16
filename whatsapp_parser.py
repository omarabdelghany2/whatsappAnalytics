import re
from datetime import datetime
from typing import List, Dict, Optional
import json


class WhatsAppParser:
    """Parser for WhatsApp chat export files"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.messages = []

    def parse(self) -> List[Dict]:
        """Parse WhatsApp chat export file and return list of messages"""
        with open(self.file_path, 'r', encoding='utf-8') as file:
            content = file.read()

        # Pattern to match WhatsApp messages
        # Supports formats like:
        # [DD/MM/YYYY, HH:MM:SS] Contact: Message
        # DD/MM/YYYY, HH:MM - Contact: Message
        # M/D/YY, H:MM AM/PM - Contact: Message

        patterns = [
            r'\[(\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}:\d{2})\]\s([^:]+):\s(.+?)(?=\[\d{1,2}/\d{1,2}/\d{2,4}|$)',
            r'(\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2})\s-\s([^:]+):\s(.+?)(?=\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}\s-|$)',
            r'(\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}\s[AP]M)\s-\s([^:]+):\s(.+?)(?=\d{1,2}/\d{1,2}/\d{2,4},\s\d{1,2}:\d{2}\s[AP]M\s-|$)',
        ]

        messages = []

        for pattern in patterns:
            matches = re.finditer(pattern, content, re.DOTALL)
            temp_messages = []

            for match in matches:
                timestamp_str = match.group(1)
                sender = match.group(2).strip()
                message_text = match.group(3).strip()

                # Parse timestamp
                timestamp = self._parse_timestamp(timestamp_str)

                temp_messages.append({
                    'timestamp': timestamp,
                    'timestamp_str': timestamp_str,
                    'sender': sender,
                    'message': message_text
                })

            if temp_messages:
                messages = temp_messages
                break

        self.messages = messages
        return messages

    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """Try to parse timestamp string with multiple formats"""
        formats = [
            '%d/%m/%Y, %H:%M:%S',
            '%m/%d/%Y, %H:%M:%S',
            '%d/%m/%Y, %H:%M',
            '%m/%d/%Y, %H:%M',
            '%d/%m/%y, %H:%M',
            '%m/%d/%y, %H:%M',
            '%d/%m/%Y, %I:%M %p',
            '%m/%d/%Y, %I:%M %p',
            '%d/%m/%y, %I:%M %p',
            '%m/%d/%y, %I:%M %p',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue

        return None

    def get_message_count(self) -> int:
        """Get total number of messages"""
        return len(self.messages)

    def get_sender_stats(self) -> Dict[str, int]:
        """Get message count per sender"""
        stats = {}
        for msg in self.messages:
            sender = msg['sender']
            stats[sender] = stats.get(sender, 0) + 1
        return dict(sorted(stats.items(), key=lambda x: x[1], reverse=True))

    def get_messages_by_sender(self, sender: str) -> List[Dict]:
        """Get all messages from a specific sender"""
        return [msg for msg in self.messages if msg['sender'] == sender]

    def export_to_json(self, output_path: str):
        """Export parsed messages to JSON file"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.messages, f, ensure_ascii=False, indent=2, default=str)
        print(f"Exported {len(self.messages)} messages to {output_path}")

    def export_to_csv(self, output_path: str):
        """Export parsed messages to CSV file"""
        try:
            import pandas as pd
            df = pd.DataFrame(self.messages)
            df.to_csv(output_path, index=False, encoding='utf-8')
            print(f"Exported {len(self.messages)} messages to {output_path}")
        except ImportError:
            print("pandas is required for CSV export. Install it with: pip install pandas")

    def search_messages(self, keyword: str, case_sensitive: bool = False) -> List[Dict]:
        """Search for messages containing a keyword"""
        if case_sensitive:
            return [msg for msg in self.messages if keyword in msg['message']]
        else:
            keyword_lower = keyword.lower()
            return [msg for msg in self.messages if keyword_lower in msg['message'].lower()]
