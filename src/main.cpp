#include <WiFi.h>
#include <DNSServer.h>
#include <LittleFS.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// Access Point Configuration
const char* AP_SSID = "Croissant";
const char* AP_PASSWORD = "";  // Empty = open network, or set a password
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_GATEWAY(192, 168, 4, 1);
const IPAddress AP_SUBNET(255, 255, 255, 0);

// Server instances
AsyncWebServer server(80);
DNSServer dnsServer;
AsyncWebSocket ws("/ws");

// Message storage (in-memory only, lost on restart)
struct Message {
    unsigned long timestamp;
    String sender;
    String text;
};

const int MAX_MESSAGES = 100;
Message messages[MAX_MESSAGES];
int messageCount = 0;
unsigned long lastMessageTime[10] = {0};  // Simple rate limiting per IP
const unsigned long RATE_LIMIT_MS = 5000;  // 5 seconds between messages

// Pong game structures
struct PongRoom {
    String players[2];
    int playerCount;
    float paddle1Y;
    float paddle2Y;
    float ballX;
    float ballY;
    float ballVelX;
    float ballVelY;
    unsigned long lastUpdate;
};

const int MAX_ROOMS = 4;
PongRoom rooms[MAX_ROOMS];
unsigned long lastGameUpdate = 0;
const unsigned long GAME_UPDATE_MS = 16;  // ~60 FPS

// Generate simple sender identifier (color-coded initials)
String generateSenderId() {
    const char* colors[] = {"#8B4513", "#654321", "#5C4033", "#4A3728", "#3C2F2F"};
    const char* initials[] = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"};
    int colorIdx = random(0, 5);
    int initialIdx = random(0, 10);
    return String(initials[initialIdx]) + " (" + String(colors[colorIdx]) + ")";
}

// Check rate limit for IP
bool checkRateLimit(IPAddress clientIP) {
    int ipHash = (clientIP[2] * 256 + clientIP[3]) % 10;
    unsigned long now = millis();
    if (now - lastMessageTime[ipHash] < RATE_LIMIT_MS) {
        return false;  // Rate limited
    }
    lastMessageTime[ipHash] = now;
    return true;
}

// Add message to log
void addMessage(const String& text, const String& sender) {
    if (messageCount >= MAX_MESSAGES) {
        // Shift array left, remove oldest
        for (int i = 0; i < MAX_MESSAGES - 1; i++) {
            messages[i] = messages[i + 1];
        }
        messageCount = MAX_MESSAGES - 1;
    }
    
    messages[messageCount].timestamp = millis();
    messages[messageCount].sender = sender;
    messages[messageCount].text = text;
    messageCount++;
}

// Broadcast message to all WebSocket clients
void broadcastMessage(const String& json) {
    // Will be handled by WebSocket event handler
}

// Serve file from LittleFS
bool serveFile(AsyncWebServerRequest *request, const String& path, const String& contentType) {
    if (LittleFS.exists(path)) {
        request->send(LittleFS, path, contentType);
        return true;
    }
    return false;
}

// Handle root and captive portal endpoints
void handleRoot(AsyncWebServerRequest *request) {
    if (!serveFile(request, "/index.html", "text/html")) {
        request->send(200, "text/html", "<html><body><h1>Croissant</h1><p>Welcome</p></body></html>");
    }
}

// Captive portal detection endpoints - return intro page, not redirects
void handleGenerate204(AsyncWebServerRequest *request) {
    serveFile(request, "/index.html", "text/html");
}

void handleHotspotDetect(AsyncWebServerRequest *request) {
    serveFile(request, "/index.html", "text/html");
}

void handleNcsi(AsyncWebServerRequest *request) {
    request->send(200, "text/plain", "Microsoft NCSI");
}

void handleConnectTest(AsyncWebServerRequest *request) {
    request->send(200, "text/plain", "success");
}

// Chat page
void handleChat(AsyncWebServerRequest *request) {
    serveFile(request, "/chat.html", "text/html");
}

// Pong page
void handlePong(AsyncWebServerRequest *request) {
    serveFile(request, "/pong.html", "text/html");
}

// Game page
void handleGame(AsyncWebServerRequest *request) {
    serveFile(request, "/game.html", "text/html");
}

// Initials page
void handleInitials(AsyncWebServerRequest *request) {
    serveFile(request, "/initials.html", "text/html");
}

// Get messages (for polling fallback)
void handleGetMessages(AsyncWebServerRequest *request) {
    DynamicJsonDocument doc(8192);
    JsonArray messagesArray = doc.createNestedArray("messages");
    
    for (int i = 0; i < messageCount; i++) {
        JsonObject msg = messagesArray.createNestedObject();
        msg["timestamp"] = messages[i].timestamp;
        msg["sender"] = messages[i].sender;
        msg["text"] = messages[i].text;
    }
    
    String response;
    serializeJson(doc, response);
    request->send(200, "application/json", response);
}

// Send message (HTTP fallback) - body handler
void handleSendMessageBody(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    // Collect body data
    static String body = "";
    if (index == 0) {
        body = "";
    }
    
    for (size_t i = 0; i < len; i++) {
        body += (char)data[i];
    }
    
    if (index + len == total) {
        // Complete body received
        IPAddress clientIP = request->client()->remoteIP();
        if (!checkRateLimit(clientIP)) {
            request->send(429, "application/json", "{\"success\":false,\"error\":\"Please wait a moment before sending another message.\"}");
            return;
        }
        
        DynamicJsonDocument doc(512);
        deserializeJson(doc, body);
        
        if (doc.containsKey("text")) {
            String text = doc["text"].as<String>();
            text.trim();
            
            if (text.length() > 0 && text.length() <= 500) {
                String sender = generateSenderId();
                addMessage(text, sender);
                
                // Broadcast via WebSocket
                DynamicJsonDocument broadcast(512);
                broadcast["type"] = "message";
                broadcast["timestamp"] = messages[messageCount - 1].timestamp;
                broadcast["sender"] = sender;
                broadcast["text"] = text;
                
                String json;
                serializeJson(broadcast, json);
                ws.textAll(json);
                
                request->send(200, "application/json", "{\"success\":true}");
                return;
            }
        }
        
        request->send(400, "application/json", "{\"success\":false,\"error\":\"Invalid message\"}");
    }
}

// Initialize pong rooms
void initPongRooms() {
    for (int i = 0; i < MAX_ROOMS; i++) {
        rooms[i].playerCount = 0;
        rooms[i].paddle1Y = 200.0;
        rooms[i].paddle2Y = 200.0;
        rooms[i].ballX = 400.0;
        rooms[i].ballY = 200.0;
        rooms[i].ballVelX = 2.0;
        rooms[i].ballVelY = 1.5;
        rooms[i].lastUpdate = millis();
    }
}

// Broadcast room list to all clients
void broadcastRoomList() {
    DynamicJsonDocument doc(2048);
    doc["type"] = "rooms";
    JsonArray roomsArray = doc.createNestedArray("rooms");
    
    for (int i = 0; i < MAX_ROOMS; i++) {
        JsonObject room = roomsArray.createNestedObject();
        JsonArray players = room.createNestedArray("players");
        for (int j = 0; j < rooms[i].playerCount; j++) {
            players.add(rooms[i].players[j]);
        }
    }
    
    String json;
    serializeJson(doc, json);
    ws.textAll(json);
}

// Send room list to a specific client
void sendRoomListToClient(AsyncWebSocketClient *client) {
    DynamicJsonDocument doc(2048);
    doc["type"] = "rooms";
    JsonArray roomsArray = doc.createNestedArray("rooms");
    
    for (int i = 0; i < MAX_ROOMS; i++) {
        JsonObject room = roomsArray.createNestedObject();
        JsonArray players = room.createNestedArray("players");
        for (int j = 0; j < rooms[i].playerCount; j++) {
            players.add(rooms[i].players[j]);
        }
    }
    
    String json;
    serializeJson(doc, json);
    if (client && client->canSend()) {
        client->text(json);
    }
}

// Broadcast game state to clients in a room
void broadcastGameState(int roomIdx) {
    if (roomIdx < 0 || roomIdx >= MAX_ROOMS) return;
    
    DynamicJsonDocument doc(512);
    doc["type"] = "gamestate";
    JsonArray players = doc.createNestedArray("players");
    for (int i = 0; i < rooms[roomIdx].playerCount; i++) {
        players.add(rooms[roomIdx].players[i]);
    }
    doc["paddle1Y"] = rooms[roomIdx].paddle1Y;
    doc["paddle2Y"] = rooms[roomIdx].paddle2Y;
    doc["ballX"] = rooms[roomIdx].ballX;
    doc["ballY"] = rooms[roomIdx].ballY;
    
    String json;
    serializeJson(doc, json);
    ws.textAll(json);
}

// Update game physics
void updateGame(int roomIdx) {
    if (roomIdx < 0 || roomIdx >= MAX_ROOMS || rooms[roomIdx].playerCount < 2) {
        return;
    }
    
    PongRoom &room = rooms[roomIdx];
    unsigned long now = millis();
    
    // Update ball position
    room.ballX += room.ballVelX;
    room.ballY += room.ballVelY;
    
    // Ball collision with top/bottom walls
    if (room.ballY <= 15 || room.ballY >= 385) {
        room.ballVelY = -room.ballVelY;
    }
    
    // Ball collision with paddles
    if (room.ballX <= 25 && room.ballY >= room.paddle1Y - 50 && room.ballY <= room.paddle1Y + 50) {
        room.ballVelX = -room.ballVelX;
        room.ballX = 25;
    }
    if (room.ballX >= 775 && room.ballY >= room.paddle2Y - 50 && room.ballY <= room.paddle2Y + 50) {
        room.ballVelX = -room.ballVelX;
        room.ballX = 775;
    }
    
    // Ball reset if out of bounds
    if (room.ballX < 0 || room.ballX > 800) {
        room.ballX = 400.0;
        room.ballY = 200.0;
        room.ballVelX = (random(0, 2) == 0) ? 2.0 : -2.0;
        room.ballVelY = (random(0, 2) == 0) ? 1.5 : -1.5;
    }
    
    room.lastUpdate = now;
}

// WebSocket event handler
void onWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, 
                      AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        // Send all existing messages to new client
        for (int i = 0; i < messageCount; i++) {
            DynamicJsonDocument doc(512);
            doc["type"] = "message";
            doc["timestamp"] = messages[i].timestamp;
            doc["sender"] = messages[i].sender;
            doc["text"] = messages[i].text;
            
            String json;
            serializeJson(doc, json);
            client->text(json);
        }
        
        // Send room list directly to new client
        sendRoomListToClient(client);
    } else if (type == WS_EVT_DISCONNECT) {
        // Remove player from rooms
        for (int i = 0; i < MAX_ROOMS; i++) {
            for (int j = 0; j < rooms[i].playerCount; j++) {
                // Note: We can't identify which client disconnected easily
                // This is simplified - in production you'd track client->ID()
            }
        }
        broadcastRoomList();
    } else if (type == WS_EVT_DATA) {
        // Message received from client
        AwsFrameInfo *info = (AwsFrameInfo*)arg;
        if (info->final && info->index == 0 && info->len == len) {
            if (info->opcode == WS_TEXT) {
                data[len] = 0;
                String message = String((char*)data);
                
                DynamicJsonDocument doc(512);
                deserializeJson(doc, message);
                String msgType = doc["type"].as<String>();
                
                // Handle chat messages
                if (msgType == "send" && doc.containsKey("text")) {
                    String text = doc["text"].as<String>();
                    text.trim();
                    
                    if (text.length() > 0 && text.length() <= 500) {
                        IPAddress clientIP = client->remoteIP();
                        if (checkRateLimit(clientIP)) {
                            String sender = generateSenderId();
                            addMessage(text, sender);
                            
                            // Broadcast to all clients
                            DynamicJsonDocument broadcast(512);
                            broadcast["type"] = "message";
                            broadcast["timestamp"] = messages[messageCount - 1].timestamp;
                            broadcast["sender"] = sender;
                            broadcast["text"] = text;
                            
                            String json;
                            serializeJson(broadcast, json);
                            ws.textAll(json);
                        } else {
                            // Rate limited - send error
                            DynamicJsonDocument error(256);
                            error["type"] = "error";
                            error["message"] = "Please wait a moment before sending another message.";
                            String json;
                            serializeJson(error, json);
                            client->text(json);
                        }
                    }
                }
                // Handle getrooms request
                else if (msgType == "getrooms") {
                    broadcastRoomList();
                }
                // Handle joinroom request
                else if (msgType == "joinroom" && doc.containsKey("room") && doc.containsKey("initials")) {
                    int roomNum = doc["room"].as<int>() - 1;  // Convert to 0-based index
                    String initials = doc["initials"].as<String>();
                    
                    if (roomNum >= 0 && roomNum < MAX_ROOMS) {
                        PongRoom &room = rooms[roomNum];
                        
                        // Check if player already in room
                        bool alreadyInRoom = false;
                        for (int i = 0; i < room.playerCount; i++) {
                            if (room.players[i] == initials) {
                                alreadyInRoom = true;
                                break;
                            }
                        }
                        
                        // Add player if not full and not already in room
                        if (!alreadyInRoom && room.playerCount < 2) {
                            room.players[room.playerCount] = initials;
                            room.playerCount++;
                        }
                        
                        broadcastRoomList();
                        broadcastGameState(roomNum);
                    }
                }
                // Handle pong input
                else if (msgType == "ponginput" && doc.containsKey("room") && doc.containsKey("player") && doc.containsKey("direction")) {
                    int roomNum = doc["room"].as<int>() - 1;
                    int player = doc["player"].as<int>();
                    int direction = doc["direction"].as<int>();
                    
                    if (roomNum >= 0 && roomNum < MAX_ROOMS) {
                        PongRoom &room = rooms[roomNum];
                        
                        // Update paddle position
                        if (player == 1) {
                            room.paddle1Y += direction * 5.0;
                            if (room.paddle1Y < 50) room.paddle1Y = 50;
                            if (room.paddle1Y > 350) room.paddle1Y = 350;
                        } else if (player == 2) {
                            room.paddle2Y += direction * 5.0;
                            if (room.paddle2Y < 50) room.paddle2Y = 50;
                            if (room.paddle2Y > 350) room.paddle2Y = 350;
                        }
                        
                        broadcastGameState(roomNum);
                    }
                }
            }
        }
    }
}

void setup() {
    Serial1.begin(115200);
    delay(1000);
    
    Serial1.println("\n\n=== Croissant Starting ===");
    
    // Initialize pong rooms
    initPongRooms();
    
    // Initialize LittleFS
    if (!LittleFS.begin(true)) {
        Serial1.println("LittleFS Mount Failed - formatting...");
        if (!LittleFS.format()) {
            Serial1.println("LittleFS Format Failed!");
            return;
        }
        if (!LittleFS.begin(true)) {
            Serial1.println("LittleFS Mount Failed after format!");
            return;
        }
    }
    Serial1.println("LittleFS mounted successfully");
    
    // Initialize WiFi in AP mode only
    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
    
    if (strlen(AP_PASSWORD) > 0) {
        WiFi.softAP(AP_SSID, AP_PASSWORD);
    } else {
        WiFi.softAP(AP_SSID);
    }
    
    Serial1.print("AP started: ");
    Serial1.println(AP_SSID);
    Serial1.print("AP IP: ");
    Serial1.println(AP_IP);
    
    // Start DNS server (captive portal)
    dnsServer.start(53, "*", AP_IP);
    Serial1.println("DNS server started on port 53");
    
    // Setup WebSocket
    ws.onEvent(onWebSocketEvent);
    server.addHandler(&ws);
    
    // Setup web server routes
    server.on("/", handleRoot);
    server.on("/chat", handleChat);
    server.on("/pong", handlePong);
    server.on("/game", handleGame);
    server.on("/initials", handleInitials);
    server.on("/messages", handleGetMessages);  // Polling fallback
    server.on("/send", HTTP_POST, [](AsyncWebServerRequest *request){}, NULL, handleSendMessageBody);  // HTTP fallback
    server.on("/generate_204", handleGenerate204);
    server.on("/hotspot-detect.html", handleHotspotDetect);
    server.on("/ncsi.txt", handleNcsi);
    server.on("/connecttest.txt", handleConnectTest);
    
    // Captive portal endpoints for Apple devices
    server.on("/library/test/success.html", handleRoot);
    server.on("/success.txt", handleRoot);
    
    // Serve static files
    server.onNotFound([](AsyncWebServerRequest *request) {
        String path = request->url();
        if (path.endsWith(".css")) {
            serveFile(request, path, "text/css");
        } else if (path.endsWith(".js")) {
            serveFile(request, path, "application/javascript");
        } else if (path.endsWith(".png") || path.endsWith(".jpg")) {
            String contentType = path.endsWith(".png") ? "image/png" : "image/jpeg";
            serveFile(request, path, contentType);
        } else {
            // For unknown paths, serve intro page (not aggressive redirect)
            serveFile(request, "/index.html", "text/html");
        }
    });
    
    server.begin();
    Serial1.println("Web server started on port 80");
    Serial1.println("\n=== Croissant Ready ===");
    Serial1.println("Connect to WiFi: " + String(AP_SSID));
    Serial1.println("Then visit: http://" + AP_IP.toString());
    Serial1.println("Chat: http://" + AP_IP.toString() + "/chat");
}

void loop() {
    dnsServer.processNextRequest();
    ws.cleanupClients();
    
    // Update game physics for active rooms
    unsigned long now = millis();
    if (now - lastGameUpdate >= GAME_UPDATE_MS) {
        for (int i = 0; i < MAX_ROOMS; i++) {
            if (rooms[i].playerCount >= 2) {
                updateGame(i);
                broadcastGameState(i);
            }
        }
        lastGameUpdate = now;
    }
    
    delay(10);
}
