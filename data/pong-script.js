// Pong Room Selector
'use strict';

let ws = null;
let myInitials = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = 5;

// Global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error, e.message, e.filename, e.lineno);
    const roomList = document.getElementById('roomList');
    if (roomList && roomList.innerHTML.includes('Loading')) {
        roomList.innerHTML = '<p class="empty">Error loading. Please refresh the page.</p>';
    }
});

// Get stored initials
function getInitials() {
    try {
        const stored = localStorage.getItem('userInitials');
        if (!stored) {
            // Small delay to allow page to render before redirect
            setTimeout(() => {
                window.location.href = '/initials.html';
            }, 100);
            return null;
        }
        return stored;
    } catch (e) {
        console.error('Error getting initials:', e);
        return null;
    }
}

// Connect WebSocket
function connectWebSocket() {
    // Prevent multiple connection attempts
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
    }
    
    // Clear any existing reconnect timer
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    // Stop trying after max attempts
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max WebSocket reconnection attempts reached. Using offline mode.');
        return;
    }
    
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        ws = new WebSocket(wsUrl);
        reconnectAttempts++;
        
        ws.onopen = () => {
            console.log('WebSocket connected to pong page');
            reconnectAttempts = 0; // Reset on successful connection
            // Request room list
            try {
                ws.send(JSON.stringify({type: 'getrooms'}));
            } catch (e) {
                console.error('Error sending getrooms:', e);
            }
        };
        
        ws.onmessage = (event) => {
            try {
                if (!event || !event.data) return;
                const data = JSON.parse(event.data);
                if (data && data.type === 'rooms') {
                    updateRoomList(data.rooms);
                }
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        ws.onclose = (event) => {
            console.log('WebSocket closed');
            ws = null;
            // Only reconnect if it wasn't a clean close and we haven't exceeded attempts
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectTimer = setTimeout(() => {
                    connectWebSocket();
                }, 3000);
            }
        };
    } catch (e) {
        console.error('Error setting up WebSocket:', e);
        ws = null;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, 3000);
        }
    }
}

// Update room list display
function updateRoomList(rooms) {
    try {
        const roomList = document.getElementById('roomList');
        if (!roomList) {
            console.error('Room list element not found');
            return;
        }
        
        if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
            // Show default empty rooms
            showDefaultRooms();
            return;
        }
        
        // Safely build room list HTML
        let html = '';
        for (let idx = 0; idx < rooms.length; idx++) {
            const room = rooms[idx];
            if (!room) continue;
            
            const roomNum = idx + 1;
            const players = room.players || [];
            const player1 = players[0] || '-';
            const player2 = players[1] || '-';
            const isFull = players.length >= 2;
            const canJoin = !isFull && (!myInitials || !players.includes(myInitials));
            
            html += `
                <div class="room-card ${isFull ? 'full' : ''}">
                    <h3>Room ${roomNum}</h3>
                    <p class="room-players">${player1} | ${player2}</p>
                    ${canJoin ? 
                        `<a href="/game?room=${roomNum}" class="join-button">Join</a>` :
                        `<span class="join-button disabled">${isFull ? 'Full' : 'Joined'}</span>`
                    }
                </div>
            `;
        }
        
        roomList.innerHTML = html || '<p class="empty">No rooms available</p>';
    } catch (e) {
        console.error('Error updating room list:', e);
        showDefaultRooms();
    }
}

// Show default rooms (when WebSocket isn't connected yet)
function showDefaultRooms() {
    try {
        const roomList = document.getElementById('roomList');
        if (!roomList) {
            console.error('Room list element not found in showDefaultRooms');
            return;
        }
        
        // Show 4 empty rooms that can be joined
        let html = '';
        for (let i = 1; i <= 4; i++) {
            html += `
                <div class="room-card">
                    <h3>Room ${i}</h3>
                    <p class="room-players">- | -</p>
                    <a href="/game?room=${i}" class="join-button">Join</a>
                </div>
            `;
        }
        roomList.innerHTML = html;
    } catch (e) {
        console.error('Error showing default rooms:', e);
        const roomList = document.getElementById('roomList');
        if (roomList) {
            roomList.innerHTML = '<p class="empty">Error loading rooms. Please refresh the page.</p>';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Show default rooms immediately (will update when WebSocket connects)
        showDefaultRooms();
        
        // Get initials (will redirect if not set)
        myInitials = getInitials();
        if (!myInitials) {
            // Redirect will happen in getInitials
            return;
        }
        
        // Try to connect WebSocket after a small delay
        setTimeout(() => {
            try {
                connectWebSocket();
            } catch (e) {
                console.error('Error connecting WebSocket:', e);
            }
        }, 500);
        
        // Poll for room updates every 3 seconds (only if connected)
        setInterval(() => {
            try {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({type: 'getrooms'}));
                }
            } catch (e) {
                console.error('Error polling for rooms:', e);
            }
        }, 3000);
        
    } catch (e) {
        console.error('Error initializing pong page:', e);
        // Fallback: show default rooms even on error
        try {
            showDefaultRooms();
        } catch (e2) {
            console.error('Critical error showing default rooms:', e2);
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    try {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }
        if (ws) {
            ws.close();
        }
    } catch (e) {
        console.error('Error in cleanup:', e);
    }
});
