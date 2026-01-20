# Implementation Note - Pong Feature

This is a large feature addition. The following files need to be created/updated:

## Files to Create:
1. `data/pong-script.js` - Room selector JavaScript
2. `data/game-script.js` - Pong game logic with canvas

## Files to Update:
1. `src/main.cpp` - Add pong room management, initials storage, WebSocket pong messages
2. `data/script.js` - Update to use stored initials from localStorage
3. `data/style.css` - Add pong room and game styling

## Features:
- Initials collection on first visit (stored in localStorage + server)
- 3-4 pong rooms (max 2 players per room)
- Room selector showing who's in each room
- Canvas-based pong game with logo.png as ball
- WebSocket for real-time game state sync
- Use stored initials for chat messages

## Next Steps:
The implementation is in progress. Due to complexity, this requires:
1. Room state management in C++ (structs for rooms, players)
2. WebSocket message routing (chat vs pong messages)
3. Game loop with canvas rendering
4. Player input handling (keyboard events)
5. Game state synchronization via WebSocket
