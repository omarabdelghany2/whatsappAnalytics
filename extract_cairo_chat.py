#!/usr/bin/env python3
"""
WhatsApp Cairo Group Chat Extractor
Extracts and analyzes chat messages from the 'cairo' WhatsApp group
"""

import os
import sys
from whatsapp_parser import WhatsAppParser


def main():
    # Check if chat file is provided
    if len(sys.argv) < 2:
        print("Usage: python extract_cairo_chat.py <path_to_whatsapp_export.txt>")
        print("\nHow to export WhatsApp chat:")
        print("1. Open WhatsApp on your phone")
        print("2. Go to the 'cairo' group")
        print("3. Tap on the group name at the top")
        print("4. Scroll down and select 'Export chat'")
        print("5. Choose 'Without media' or 'With media'")
        print("6. Save the .txt file and provide its path to this script")
        sys.exit(1)

    chat_file = sys.argv[1]

    # Check if file exists
    if not os.path.exists(chat_file):
        print(f"Error: File '{chat_file}' not found!")
        sys.exit(1)

    print(f"Loading chat from: {chat_file}")
    print("-" * 60)

    # Parse the chat
    parser = WhatsAppParser(chat_file)
    messages = parser.parse()

    if not messages:
        print("No messages found! Please check if the file format is correct.")
        sys.exit(1)

    # Display statistics
    print(f"\nTotal messages: {parser.get_message_count()}")
    print("\nMessages per sender:")
    print("-" * 60)

    sender_stats = parser.get_sender_stats()
    for sender, count in sender_stats.items():
        percentage = (count / parser.get_message_count()) * 100
        print(f"{sender}: {count} messages ({percentage:.1f}%)")

    # Date range
    if messages[0]['timestamp'] and messages[-1]['timestamp']:
        print("\nDate range:")
        print("-" * 60)
        print(f"First message: {messages[0]['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Last message: {messages[-1]['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")

    # Export options
    print("\n" + "=" * 60)
    print("Exporting data...")
    print("=" * 60)

    # Export to JSON
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)

    json_file = os.path.join(output_dir, "cairo_chat.json")
    parser.export_to_json(json_file)

    # Export to CSV
    csv_file = os.path.join(output_dir, "cairo_chat.csv")
    parser.export_to_csv(csv_file)

    print("\n" + "=" * 60)
    print("Done! Check the 'output' folder for exported files.")
    print("=" * 60)

    # Optional: Search functionality
    print("\nWould you like to search for specific keywords in the chat? (y/n): ", end="")
    try:
        response = input().strip().lower()
        if response == 'y':
            while True:
                print("\nEnter keyword to search (or 'quit' to exit): ", end="")
                keyword = input().strip()
                if keyword.lower() == 'quit':
                    break

                results = parser.search_messages(keyword)
                print(f"\nFound {len(results)} messages containing '{keyword}':")
                print("-" * 60)

                for i, msg in enumerate(results[:10], 1):  # Show first 10 results
                    print(f"\n{i}. [{msg['timestamp_str']}] {msg['sender']}:")
                    print(f"   {msg['message'][:200]}...")  # Show first 200 chars

                if len(results) > 10:
                    print(f"\n... and {len(results) - 10} more results")

    except (KeyboardInterrupt, EOFError):
        print("\n\nExiting...")

    print("\nThank you for using WhatsApp Cairo Chat Extractor!")


if __name__ == "__main__":
    main()
