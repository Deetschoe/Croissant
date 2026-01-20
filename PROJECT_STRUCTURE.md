# Project Structure

```
Croissant/
├── src/
│   └── main.cpp              # ESP32 firmware
│                              # - WiFi AP setup
│                              # - DNS server (captive portal)
│                              # - Web server with WebSocket
│                              # - Message storage (in-memory)
│                              # - Rate limiting
│
├── data/                      # Web files (uploaded to LittleFS)
│   ├── index.html            # Intro/captive page
│   │                          # - Handwritten aesthetic
│   │                          # - "Enter the room" button
│   │                          # - Instructions for dismissing
│   │
│   ├── chat.html             # Main chat interface
│   │                          # - Message log
│   │                          # - Input form
│   │
│   ├── style.css             # Styling
│   │                          # - Serif fonts (Georgia)
│   │                          # - Parchment background (#f9f5eb)
│   │                          # - Warm brown text (#3c2f2f)
│   │                          # - Minimal, elegant
│   │
│   └── script.js             # Client-side JavaScript
│                              # - WebSocket connection
│                              # - Real-time message updates
│                              # - HTTP polling fallback
│                              # - Message sending
│
├── platformio.ini            # Build configuration
│                              # - ESP32-S2 board
│                              # - ESPAsyncWebServer library
│                              # - ArduinoJson library
│                              # - LittleFS filesystem
│
├── README.md                  # Main documentation
├── DEPLOY.md                  # Deployment instructions
└── PROJECT_STRUCTURE.md      # This file
```

## File Descriptions

### src/main.cpp
Main firmware code. Handles:
- WiFi Access Point setup (SSID: "Croissant")
- DNS server for captive portal
- AsyncWebServer with WebSocket support
- Message storage in memory (max 100 messages)
- Rate limiting (5 seconds between messages per IP)
- HTTP endpoints for polling fallback

### data/index.html
Intro page shown when users first connect. Includes:
- Simple headline "Croissant"
- Subtext explaining the concept
- "Enter the room" button linking to /chat
- Instructions for dismissing captive portal

### data/chat.html
Main chat interface. Features:
- Message log (scrollable)
- Input form at bottom
- Real-time updates via WebSocket

### data/style.css
Minimal styling with:
- Serif fonts (Georgia, Times New Roman)
- Parchment-like background colors
- Warm brown text
- No gradients, shadows, or modern UI elements
- Mobile-responsive

### data/script.js
Client-side functionality:
- WebSocket connection to /ws
- Automatic reconnection
- HTTP polling fallback if WebSocket fails
- Message sending and receiving
- Real-time log updates

## Data Flow

1. **User connects to "Croissant" WiFi**
2. **Captive portal opens** → Shows `index.html`
3. **User clicks "Enter the room"** → Redirects to `/chat`
4. **Chat page loads** → `chat.html` + `script.js`
5. **WebSocket connects** → `/ws` endpoint
6. **User types message** → Sent via WebSocket
7. **Server broadcasts** → All connected clients receive message
8. **Message appears** → Real-time update in all browsers

## Memory Usage

- **Messages:** Stored in array (max 100)
- **Rate limiting:** 10 IP slots tracked
- **No persistence:** All data lost on restart
