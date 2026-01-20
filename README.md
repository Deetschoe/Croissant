# Croissant

A small, quiet place to leave messages. Everyone here can read what you write. Nothing is saved after the network restarts.

## Overview

Croissant is an ESP32-S2 captive portal that creates a simple, ephemeral message board. When devices connect to the "Croissant" WiFi network, they can leave messages that everyone else on the network can see. Messages are stored only in memory and disappear when the device restarts.

## Features

- **Simple captive portal** - Auto-opens on most phones when connected
- **Dismissable** - Users can close the popup and use their normal browser
- **Real-time chat** - WebSocket-based messaging (with HTTP polling fallback)
- **Ephemeral** - Messages lost on restart (no persistence)
- **Rate limited** - Prevents spam (one message per 5 seconds per IP)
- **Clean aesthetic** - Serif fonts, parchment background, warm colors

## Hardware

- ESP32-S2 (Flipper Zero Wi-Fi dev board)
- USB power (wall adapter or power bank)

## Setup

### 1. Install Dependencies

```bash
# Install PlatformIO if needed
pip install platformio
```

### 2. Upload Filesystem

```bash
# Find your ESP32 port
pio device list

# Upload filesystem (web files)
pio run -t uploadfs --upload-port YOUR_PORT
```

### 3. Upload Firmware

```bash
# Put ESP32 in bootloader mode: Hold BOOT, press RESET, release BOOT
# Then upload firmware
pio run -t upload --upload-port YOUR_PORT
```

## Usage

1. **Power the ESP32** (USB power bank or wall adapter)
2. **Connect to WiFi:** "Croissant" (no password)
3. **Captive portal opens** - Shows intro page
4. **Click "Enter the room"** or manually visit `http://192.168.4.1/chat`
5. **Type messages** - Everyone connected sees them in real-time

## Project Structure

```
Croissant/
├── src/
│   └── main.cpp          # ESP32 firmware
├── data/                 # Web files (uploaded to LittleFS)
│   ├── index.html        # Intro/captive page
│   ├── chat.html         # Main chat interface
│   ├── style.css         # Styling
│   └── script.js         # WebSocket client
├── platformio.ini        # Build configuration
└── README.md            # This file
```

## Technical Details

- **WiFi Mode:** AP only (no internet connection)
- **AP IP:** 192.168.4.1
- **Web Server:** ESPAsyncWebServer
- **WebSocket:** Real-time messaging
- **Fallback:** HTTP polling if WebSocket unavailable
- **Message Limit:** 100 messages (oldest removed when full)
- **Rate Limit:** 5 seconds between messages per IP

## Testing Multi-User Chat

1. Connect two phones to "Croissant" WiFi
2. On phone 1: Visit `http://192.168.4.1/chat`
3. On phone 2: Visit `http://192.168.4.1/chat`
4. Send a message from phone 1
5. Message should appear instantly on phone 2 (via WebSocket)
6. Send a message from phone 2
7. Message should appear instantly on phone 1

## Troubleshooting

### Port Not Found
- Unplug and replug USB cable
- Put ESP32 in bootloader mode (BOOT + RESET)
- Check `pio device list`

### Messages Not Appearing
- Check WebSocket connection in browser console
- Falls back to polling every 5 seconds if WebSocket fails
- Refresh page if needed

### Captive Portal Too Aggressive
- Close the popup
- Open Chrome/Safari manually
- Type `http://192.168.4.1/chat` directly

---

**A small, quiet place to leave messages.**
