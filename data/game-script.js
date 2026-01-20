// Pong Game Script
let ws = null;
let canvas = null;
let ctx = null;
let gameState = null;
let myInitials = null;
let roomNum = null;
let keys = {};

// Ball image
let ballImg = null;

// Get room number from URL
function getRoomFromURL() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('room')) || 1;
}

// Get stored initials
function getInitials() {
    const stored = localStorage.getItem('userInitials');
    if (!stored) {
        window.location.href = '/initials.html';
        return null;
    }
    return stored;
}

// Connect WebSocket
function connectWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            // Join room
            if (roomNum && myInitials) {
                ws.send(JSON.stringify({
                    type: 'joinroom',
                    room: roomNum,
                    initials: myInitials
                }));
            }
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'gamestate') {
                    gameState = data;
                    // Update player info display
                    if (data.players) {
                        const player1El = document.getElementById('player1');
                        const player2El = document.getElementById('player2');
                        if (player1El) player1El.textContent = data.players[0] || '-';
                        if (player2El) player2El.textContent = data.players[1] || '-';
                    }
                }
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
            console.log('WebSocket closed, reconnecting...');
            setTimeout(connectWebSocket, 2000);
        };
    } catch (e) {
        console.error('Error setting up WebSocket:', e);
        setTimeout(connectWebSocket, 2000);
    }
}

// Handle keyboard
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
});

// Handle touch controls
let touchStartY = null;
let isTouching = false;

// Setup touch controls for canvas
function setupCanvasTouchControls() {
    if (!canvas) return;
    
    // Touch start
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        touchStartY = touch.clientY - rect.top;
        isTouching = true;
        
        // Determine direction based on touch position relative to center
        const centerY = canvas.height / 2;
        if (touchStartY < centerY) {
            keys.up = true;
            keys.down = false;
        } else {
            keys.down = true;
            keys.up = false;
        }
    }, { passive: false });

    // Touch move
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isTouching) return;
        
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;
        const centerY = canvas.height / 2;
        
        if (touchY < centerY) {
            keys.up = true;
            keys.down = false;
        } else {
            keys.down = true;
            keys.up = false;
        }
    }, { passive: false });

    // Touch end
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.up = false;
        keys.down = false;
        isTouching = false;
        touchStartY = null;
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys.up = false;
        keys.down = false;
        isTouching = false;
        touchStartY = null;
    }, { passive: false });
}

// Mobile button controls
function setupMobileButtons() {
    const upBtn = document.getElementById('upButton');
    const downBtn = document.getElementById('downButton');
    
    if (!upBtn || !downBtn) {
        console.warn('Mobile control buttons not found');
        return;
    }
    
    // Up button handlers
    const upStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        keys.up = true;
    };
    
    const upEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        keys.up = false;
    };
    
    upBtn.addEventListener('touchstart', upStart, { passive: false });
    upBtn.addEventListener('touchend', upEnd, { passive: false });
    upBtn.addEventListener('touchcancel', upEnd, { passive: false });
    
    // Mouse events for testing on desktop
    upBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        keys.up = true;
    });
    upBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        keys.up = false;
    });
    upBtn.addEventListener('mouseleave', (e) => {
        e.preventDefault();
        keys.up = false;
    });
    
    // Down button handlers
    const downStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        keys.down = true;
    };
    
    const downEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        keys.down = false;
    };
    
    downBtn.addEventListener('touchstart', downStart, { passive: false });
    downBtn.addEventListener('touchend', downEnd, { passive: false });
    downBtn.addEventListener('touchcancel', downEnd, { passive: false });
    
    // Mouse events for testing on desktop
    downBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        keys.down = true;
    });
    downBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        keys.down = false;
    });
    downBtn.addEventListener('mouseleave', (e) => {
        e.preventDefault();
        keys.down = false;
    });
    
    console.log('Mobile control buttons initialized');
}

// Send player input
function sendInput() {
    if (ws && ws.readyState === WebSocket.OPEN && gameState) {
        const isPlayer1 = gameState.players[0] === myInitials;
        const direction = keys.up ? -1 : keys.down ? 1 : 0;
        
        ws.send(JSON.stringify({
            type: 'ponginput',
            room: roomNum,
            player: isPlayer1 ? 1 : 2,
            direction: direction
        }));
    }
}

// Game loop
function gameLoop() {
    if (!ctx || !canvas) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Use default state if gameState not available yet
    if (!gameState) {
        initDefaultGameState();
    }
    
    // Clear canvas
    ctx.fillStyle = '#f9f5eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw paddles
    ctx.fillStyle = '#3c2f2f';
    const paddle1Y = gameState.paddle1Y || 200;
    const paddle2Y = gameState.paddle2Y || 200;
    ctx.fillRect(10, paddle1Y - 50, 10, 100);
    ctx.fillRect(canvas.width - 20, paddle2Y - 50, 10, 100);
    
    // Draw ball (logo.png)
    const ballX = gameState.ballX || canvas.width/2;
    const ballY = gameState.ballY || canvas.height/2;
    if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
        ctx.drawImage(ballImg, ballX - 15, ballY - 15, 30, 30);
    } else {
        // Fallback circle if image not loaded
        ctx.fillStyle = '#4a3728';
        ctx.beginPath();
        ctx.arc(ballX, ballY, 15, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw player initials
    ctx.fillStyle = '#3c2f2f';
    ctx.font = '20px Georgia';
    ctx.textAlign = 'center';
    if (gameState.players && gameState.players[0]) {
        ctx.fillText(gameState.players[0], canvas.width * 0.25, 30);
    }
    if (gameState.players && gameState.players[1]) {
        ctx.fillText(gameState.players[1], canvas.width * 0.75, 30);
    }
    
    // Send input if connected
    if (ws && ws.readyState === WebSocket.OPEN && gameState && gameState.players) {
        sendInput();
    }
    
    requestAnimationFrame(gameLoop);
}

// Initialize default game state so page doesn't hang
function initDefaultGameState() {
    if (!gameState) {
        gameState = {
            players: ['-', '-'],
            paddle1Y: 200,
            paddle2Y: 200,
            ballX: 400,
            ballY: 200
        };
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    try {
        myInitials = getInitials();
        if (!myInitials) {
            // Redirect will happen in getInitials, but just in case:
            return;
        }
        
        roomNum = getRoomFromURL();
        if (!roomNum) {
            roomNum = 1; // Default to room 1
        }
        
        canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }
        ctx = canvas.getContext('2d');
        
        // Initialize default game state
        initDefaultGameState();
        
        // Load ball image
        ballImg = new Image();
        ballImg.onload = () => {
            console.log('Ball image loaded');
        };
        ballImg.onerror = () => {
            console.log('Ball image failed to load, using fallback');
            ballImg = null;
        };
        ballImg.src = '/logo.png';
        
        // Update room info
        const roomNumEl = document.getElementById('roomNumber');
        if (roomNumEl) {
            roomNumEl.textContent = roomNum;
        }
        
        // Setup touch controls for canvas
        setupCanvasTouchControls();
        
        // Setup mobile button controls
        setupMobileButtons();
        
        // Start game loop immediately (will wait for gameState)
        gameLoop();
        
        // Connect WebSocket
        connectWebSocket();
    } catch (e) {
        console.error('Error initializing game:', e);
    }
});
