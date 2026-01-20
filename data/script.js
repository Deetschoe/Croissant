// WebSocket connection for real-time chat
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// Connect WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
        updateConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT) {
            reconnectAttempts++;
            setTimeout(() => {
                console.log(`Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT})`);
                connectWebSocket();
            }, 2000);
        } else {
            // Fallback to polling
            console.log('WebSocket failed, using polling');
            startPolling();
        }
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    if (data.type === 'message') {
        addMessageToLog(data.timestamp, data.sender, data.text, true);
    } else if (data.type === 'error') {
        alert(data.message || 'An error occurred');
    }
}

// Polling fallback (if WebSocket not available)
let pollingInterval = null;

function startPolling() {
    if (pollingInterval) return;
    
    // Load messages immediately
    loadMessages();
    
    // Poll every 5 seconds
    pollingInterval = setInterval(() => {
        loadMessages();
    }, 5000);
}

function loadMessages() {
    fetch('/messages')
        .then(response => response.json())
        .then(data => {
            if (data.messages) {
                updateMessageLog(data.messages);
            }
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
}

// Message form handling
document.addEventListener('DOMContentLoaded', () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (messageForm) {
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Try WebSocket first
    if (typeof WebSocket !== 'undefined') {
        connectWebSocket();
    } else {
        // Fallback to polling
        startPolling();
    }
});

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const text = messageInput.value.trim();
    
    if (!text || text.length === 0) {
        return;
    }
    
    if (text.length > 500) {
        alert('Message is too long (max 500 characters)');
        return;
    }
    
    // Get stored initials
    const initials = localStorage.getItem('userInitials') || 'Anonymous';
    
    // Disable input while sending
    sendButton.disabled = true;
    messageInput.disabled = true;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Send via WebSocket
        const message = JSON.stringify({
            type: 'send',
            text: text,
            initials: initials
        });
        ws.send(message);
        
        // Clear input
        messageInput.value = '';
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    } else {
        // Fallback: send via HTTP POST
        fetch('/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageInput.value = '';
            } else {
                alert(data.error || 'Failed to send message');
            }
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        })
        .catch(error => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Try again.');
            messageInput.disabled = false;
            sendButton.disabled = false;
        });
    }
}

// Update message log
let lastMessageCount = 0;

function updateMessageLog(messages) {
    const messageLog = document.getElementById('messageLog');
    if (!messageLog) return;
    
    if (messages.length === 0) {
        messageLog.innerHTML = '<p class="empty">No messages yet. Be the first to write something.</p>';
        return;
    }
    
    // Only update if messages changed
    if (messages.length === lastMessageCount) {
        return;
    }
    
    lastMessageCount = messages.length;
    
    messageLog.innerHTML = messages.map(msg => {
        const time = formatTime(msg.timestamp);
        const sender = msg.sender || 'Someone';
        return createMessageElement(time, sender, msg.text, false);
    }).join('');
    
    // Scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
}

function addMessageToLog(timestamp, sender, text, isNew) {
    const messageLog = document.getElementById('messageLog');
    if (!messageLog) return;
    
    // Remove loading/empty message
    if (messageLog.querySelector('.loading') || messageLog.querySelector('.empty')) {
        messageLog.innerHTML = '';
    }
    
    const time = formatTime(timestamp);
    const messageElement = createMessageElement(time, sender, text, isNew);
    
    messageLog.insertAdjacentHTML('beforeend', messageElement);
    
    // Scroll to bottom
    messageLog.scrollTop = messageLog.scrollHeight;
    
    // Remove flash animation after delay
    setTimeout(() => {
        const lastMessage = messageLog.lastElementChild;
        if (lastMessage) {
            lastMessage.classList.remove('new-message');
        }
    }, 500);
}

function createMessageElement(time, sender, text, isNew) {
    const senderParts = sender.split(' (');
    const senderName = senderParts[0] || 'Someone';
    const senderColor = senderParts[1] ? senderParts[1].replace(')', '') : '#3c2f2f';
    
    const newClass = isNew ? ' new-message' : '';
    
    return `
        <div class="message${newClass}">
            <div class="message-header">
                <span class="message-sender" style="color: ${senderColor}">${escapeHtml(senderName)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateConnectionStatus(connected) {
    // Optional: show connection status
    // Could add a small indicator in the UI
}
