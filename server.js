const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Load configuration
let config;
try {
    const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(configFile);
} catch (error) {
    config = {
        groups: ["Army"],
        checkInterval: 60000,
        messageLimit: 15,
        detectJoinsLeaves: true,
        port: 3000
    };
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
}

const PORT = config.port || 3000;
const CHECK_INTERVAL = config.checkInterval || 60000;
const MESSAGE_LIMIT = config.messageLimit || 15;
const DETECT_JOINS_LEAVES = config.detectJoinsLeaves !== false;
const GROUP_NAMES = config.groups || ["Army"];

// Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// In-memory storage for messages
const messageStore = new Map(); // groupId -> array of messages
const eventStore = new Map(); // groupId -> array of events
const groupInfoStore = new Map(); // groupId -> { name, id, memberCount }

// WebSocket clients
const wsClients = new Set();

// WhatsApp client
let client;
let monitoredGroups = new Map();
let isClientReady = false;

console.log('===============================================');
console.log('   WhatsApp Analytics API Server');
console.log('===============================================');
console.log(`Port: ${PORT}`);
console.log(`Monitoring groups: ${GROUP_NAMES.join(', ')}`);
console.log(`Check interval: ${CHECK_INTERVAL / 1000} seconds`);
console.log(`Message limit: ${MESSAGE_LIMIT}`);
console.log(`Detect joins/leaves: ${DETECT_JOINS_LEAVES ? 'Yes' : 'No'}\n`);

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsappConnected: isClientReady,
        monitoredGroups: Array.from(groupInfoStore.values()),
        timestamp: new Date().toISOString()
    });
});

// Get all groups being monitored
app.get('/api/groups', (req, res) => {
    const groups = Array.from(groupInfoStore.values());
    res.json({
        success: true,
        groups: groups,
        count: groups.length
    });
});

// Get messages from all groups
app.get('/api/messages', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Collect all messages from all groups
    const allMessages = [];
    for (const [groupId, messages] of messageStore) {
        const groupInfo = groupInfoStore.get(groupId);
        allMessages.push(...messages.map(msg => ({
            ...msg,
            groupId: groupId,
            groupName: groupInfo?.name || 'Unknown'
        })));
    }

    // Sort by timestamp (newest first)
    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginate
    const paginated = allMessages.slice(offset, offset + limit);

    res.json({
        success: true,
        messages: paginated,
        total: allMessages.length,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < allMessages.length
    });
});

// Get messages from a specific group
app.get('/api/messages/:groupId', (req, res) => {
    const groupId = req.params.groupId;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const messages = messageStore.get(groupId) || [];
    const groupInfo = groupInfoStore.get(groupId);

    // Sort by timestamp (newest first)
    const sorted = [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginate
    const paginated = sorted.slice(offset, offset + limit);

    res.json({
        success: true,
        groupName: groupInfo?.name || 'Unknown',
        messages: paginated,
        total: messages.length,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < messages.length
    });
});

// Get events (joins/leaves) from all groups
app.get('/api/events', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Collect all events from all groups
    const allEvents = [];
    for (const [groupId, events] of eventStore) {
        const groupInfo = groupInfoStore.get(groupId);
        allEvents.push(...events.map(evt => ({
            ...evt,
            groupId: groupId,
            groupName: groupInfo?.name || 'Unknown'
        })));
    }

    // Sort by timestamp (newest first)
    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginate
    const paginated = allEvents.slice(offset, offset + limit);

    res.json({
        success: true,
        events: paginated,
        total: allEvents.length,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < allEvents.length
    });
});

// Get events from a specific group
app.get('/api/events/:groupId', (req, res) => {
    const groupId = req.params.groupId;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const events = eventStore.get(groupId) || [];
    const groupInfo = groupInfoStore.get(groupId);

    // Sort by timestamp (newest first)
    const sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginate
    const paginated = sorted.slice(offset, offset + limit);

    res.json({
        success: true,
        groupName: groupInfo?.name || 'Unknown',
        events: paginated,
        total: events.length,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < events.length
    });
});

// Search messages
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    const groupId = req.query.groupId;
    const limit = parseInt(req.query.limit) || 100;

    if (!query) {
        return res.status(400).json({
            success: false,
            error: 'Query parameter "q" is required'
        });
    }

    let searchMessages = [];

    if (groupId) {
        // Search in specific group
        const messages = messageStore.get(groupId) || [];
        searchMessages = messages;
    } else {
        // Search in all groups
        for (const [gId, messages] of messageStore) {
            const groupInfo = groupInfoStore.get(gId);
            searchMessages.push(...messages.map(msg => ({
                ...msg,
                groupId: gId,
                groupName: groupInfo?.name || 'Unknown'
            })));
        }
    }

    // Filter by query (case-insensitive)
    const queryLower = query.toLowerCase();
    const results = searchMessages.filter(msg =>
        msg.message.toLowerCase().includes(queryLower) ||
        msg.sender.toLowerCase().includes(queryLower)
    );

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    const limited = results.slice(0, limit);

    res.json({
        success: true,
        query: query,
        results: limited,
        total: results.length,
        hasMore: results.length > limit
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    const stats = {
        groups: [],
        totalMessages: 0,
        totalEvents: 0
    };

    for (const [groupId, groupInfo] of groupInfoStore) {
        const messages = messageStore.get(groupId) || [];
        const events = eventStore.get(groupId) || [];

        // Count messages per sender
        const senderCounts = {};
        messages.forEach(msg => {
            senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
        });

        const topSenders = Object.entries(senderCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        stats.groups.push({
            id: groupId,
            name: groupInfo.name,
            messageCount: messages.length,
            eventCount: events.length,
            memberCount: groupInfo.memberCount,
            topSenders: topSenders
        });

        stats.totalMessages += messages.length;
        stats.totalEvents += events.length;
    }

    res.json({
        success: true,
        stats: stats,
        timestamp: new Date().toISOString()
    });
});

// Add a new group to monitor
app.post('/api/groups', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Group name is required'
            });
        }

        const groupName = name.trim();

        // Check if WhatsApp client is ready
        if (!isClientReady || !client) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client is not ready. Please wait.'
            });
        }

        // Check if group is already being monitored
        const existingGroup = Array.from(groupInfoStore.values()).find(
            g => g.name.toLowerCase() === groupName.toLowerCase()
        );

        if (existingGroup) {
            return res.status(409).json({
                success: false,
                error: 'Group is already being monitored'
            });
        }

        // Search for the group in WhatsApp
        const chats = await client.getChats();
        const group = chats.find(chat =>
            chat.isGroup && chat.name.toLowerCase().includes(groupName.toLowerCase())
        );

        if (!group) {
            return res.status(404).json({
                success: false,
                error: `Group "${groupName}" not found in your WhatsApp chats`
            });
        }

        // Add group to monitoring
        const groupId = group.id._serialized;
        const memberCount = group.participants ? group.participants.length : 0;
        const members = group.participants ? group.participants.map(p => p.id._serialized) : [];

        const groupInfo = {
            id: groupId,
            name: group.name,
            memberCount: memberCount
        };

        groupInfoStore.set(groupId, groupInfo);

        monitoredGroups.set(groupId, {
            name: group.name,
            id: groupId,
            previousMessageIds: new Set(),
            previousMembers: new Set(members),
            isFirstRun: true
        });

        messageStore.set(groupId, []);
        eventStore.set(groupId, []);

        // Update config.json
        const configPath = path.join(__dirname, 'config.json');
        const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (!currentConfig.groups.includes(group.name)) {
            currentConfig.groups.push(group.name);
            fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
        }

        // Immediately check for messages in this new group
        const groupData = monitoredGroups.get(groupId);
        await checkMessages(groupId, groupData);

        // Broadcast to WebSocket clients
        broadcast({
            type: 'group_added',
            group: groupInfo
        });

        console.log(`✅ Added new group to monitoring: "${group.name}"`);

        res.json({
            success: true,
            message: 'Group added successfully',
            group: groupInfo
        });

    } catch (error) {
        console.error('Error adding group:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add group: ' + error.message
        });
    }
});

// ============================================
// WEBSOCKET
// ============================================

wss.on('connection', (ws) => {
    console.log('✅ New WebSocket client connected');
    wsClients.add(ws);

    // Send initial data
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to WhatsApp Analytics',
        groups: Array.from(groupInfoStore.values())
    }));

    ws.on('close', () => {
        console.log('❌ WebSocket client disconnected');
        wsClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
    });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
    const message = JSON.stringify(data);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ============================================
// WHATSAPP CLIENT INITIALIZATION
// ============================================

async function initClient() {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: '.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('\n📱 Scan this QR code with WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\nWaiting for scan...\n');
    });

    client.on('authenticated', () => {
        console.log('✅ Authenticated!');
    });

    client.on('ready', async () => {
        console.log('✅ WhatsApp client ready!\n');
        isClientReady = true;

        // Initialize groups
        await initializeGroups();

        if (monitoredGroups.size === 0) {
            console.error('❌ No matching groups found!');
            console.log('Please update config.json with valid group names.\n');
        } else {
            console.log('🔄 Starting monitoring...\n');

            // Start checking immediately and then every interval
            checkAllGroups();
            setInterval(checkAllGroups, CHECK_INTERVAL);
        }
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Auth failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('⚠️  Disconnected:', reason);
        isClientReady = false;
        broadcast({ type: 'disconnected', message: 'WhatsApp disconnected' });
    });

    // Listen for group participant changes (joins/leaves)
    client.on('group_join', async (notification) => {
        const groupId = notification.chatId._serialized;
        const groupInfo = monitoredGroups.get(groupId);

        if (groupInfo && DETECT_JOINS_LEAVES) {
            for (const participant of notification.recipientIds) {
                const event = await createEvent(participant._serialized, 'JOIN', groupInfo.name, groupId);
                if (event) {
                    const events = eventStore.get(groupId) || [];
                    events.push(event);
                    eventStore.set(groupId, events);

                    console.log(`🟢 ${event.memberName} joined ${groupInfo.name}`);
                    broadcast({ type: 'event', event: event });
                }
            }
        }
    });

    client.on('group_leave', async (notification) => {
        const groupId = notification.chatId._serialized;
        const groupInfo = monitoredGroups.get(groupId);

        if (groupInfo && DETECT_JOINS_LEAVES) {
            for (const participant of notification.recipientIds) {
                const event = await createEvent(participant._serialized, 'LEAVE', groupInfo.name, groupId);
                if (event) {
                    const events = eventStore.get(groupId) || [];
                    events.push(event);
                    eventStore.set(groupId, events);

                    console.log(`🔴 ${event.memberName} left ${groupInfo.name}`);
                    broadcast({ type: 'event', event: event });
                }
            }
        }
    });

    await client.initialize();
}

async function initializeGroups() {
    const chats = await client.getChats();

    for (const groupName of GROUP_NAMES) {
        const group = chats.find(chat =>
            chat.isGroup && chat.name.toLowerCase().includes(groupName.toLowerCase())
        );

        if (group) {
            console.log(`✅ Found group: "${group.name}"`);

            const memberCount = group.participants ? group.participants.length : 0;
            const members = group.participants ? group.participants.map(p => p.id._serialized) : [];

            groupInfoStore.set(group.id._serialized, {
                id: group.id._serialized,
                name: group.name,
                memberCount: memberCount
            });

            monitoredGroups.set(group.id._serialized, {
                name: group.name,
                id: group.id._serialized,
                previousMessageIds: new Set(),
                previousMembers: new Set(members),
                isFirstRun: true
            });

            messageStore.set(group.id._serialized, []);
            eventStore.set(group.id._serialized, []);
        } else {
            console.log(`❌ Group "${groupName}" not found`);
        }
    }
}

async function checkAllGroups() {
    for (const [groupId, groupInfo] of monitoredGroups) {
        await checkMessages(groupId, groupInfo);
    }
}

async function checkMessages(groupId, groupInfo) {
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] Checking ${groupInfo.name}...`);

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.id._serialized === groupId);

        if (!group) {
            console.error(`❌ Group ${groupInfo.name} not found`);
            return;
        }

        // Check for member changes
        if (DETECT_JOINS_LEAVES && group.participants) {
            const currentMembers = new Set(group.participants.map(p => p.id._serialized));

            // Detect joins
            for (const memberId of currentMembers) {
                if (!groupInfo.previousMembers.has(memberId) && !groupInfo.isFirstRun) {
                    const event = await createEvent(memberId, 'JOIN', groupInfo.name, groupId);
                    if (event) {
                        const events = eventStore.get(groupId) || [];
                        events.push(event);
                        eventStore.set(groupId, events);

                        console.log(`🟢 ${event.memberName} joined ${groupInfo.name}`);
                        broadcast({ type: 'event', event: event });
                    }
                }
            }

            // Detect leaves
            for (const memberId of groupInfo.previousMembers) {
                if (!currentMembers.has(memberId) && !groupInfo.isFirstRun) {
                    const event = await createEvent(memberId, 'LEAVE', groupInfo.name, groupId);
                    if (event) {
                        const events = eventStore.get(groupId) || [];
                        events.push(event);
                        eventStore.set(groupId, events);

                        console.log(`🔴 ${event.memberName} left ${groupInfo.name}`);
                        broadcast({ type: 'event', event: event });
                    }
                }
            }

            // Update member count
            const groupData = groupInfoStore.get(groupId);
            if (groupData) {
                groupData.memberCount = currentMembers.size;
                groupInfoStore.set(groupId, groupData);
            }

            groupInfo.previousMembers = currentMembers;
        }

        const messages = await group.fetchMessages({ limit: MESSAGE_LIMIT });

        // Detect new messages
        const newMessages = [];
        for (const msg of messages) {
            const msgId = msg.id._serialized;
            if (!groupInfo.previousMessageIds.has(msgId)) {
                newMessages.push(msg);
                groupInfo.previousMessageIds.add(msgId);
            }
        }

        if (newMessages.length > 0 || groupInfo.isFirstRun) {
            const processedMessages = [];

            for (const msg of messages) {
                const processed = await processMessage(msg, groupInfo.name, groupId);
                if (processed) {
                    processedMessages.push(processed);
                }
            }

            // Update message store
            messageStore.set(groupId, processedMessages);

            if (!groupInfo.isFirstRun) {
                console.log(`🆕 ${newMessages.length} new message(s) in ${groupInfo.name}`);

                // Broadcast new messages to WebSocket clients
                for (const msg of newMessages) {
                    const processed = await processMessage(msg, groupInfo.name, groupId);
                    if (processed) {
                        broadcast({ type: 'message', message: processed });
                    }
                }
            } else {
                console.log(`✅ Loaded ${processedMessages.length} messages from ${groupInfo.name}`);
            }

            groupInfo.isFirstRun = false;
        } else {
            console.log(`   No new messages in ${groupInfo.name}`);
        }

        // Clean up old message IDs
        if (groupInfo.previousMessageIds.size > 100) {
            const idsArray = Array.from(groupInfo.previousMessageIds);
            groupInfo.previousMessageIds = new Set(idsArray.slice(-100));
        }

    } catch (error) {
        console.error(`❌ Error checking ${groupInfo.name}:`, error.message);
    }
}

async function processMessage(msg, groupName, groupId) {
    try {
        const timestamp = new Date(msg.timestamp * 1000);

        let senderName = 'Unknown';
        if (msg.author) {
            try {
                const contact = await client.getContactById(msg.author);
                senderName = contact.pushname || contact.name || contact.number || 'Unknown';
            } catch (e) {
                senderName = msg.author.split('@')[0];
            }
        }

        let body = msg.body || '';
        if (msg.hasMedia) {
            body = body || `<${msg.type}>`;
        }

        return {
            id: msg.id._serialized,
            timestamp: timestamp.toISOString(),
            sender: senderName,
            senderId: msg.author || '',
            message: body,
            type: msg.type,
            hasMedia: msg.hasMedia,
            groupId: groupId,
            groupName: groupName
        };
    } catch (error) {
        return null;
    }
}

async function createEvent(memberId, eventType, groupName, groupId) {
    try {
        const contact = await client.getContactById(memberId);
        const memberName = contact.pushname || contact.name || contact.number || 'Unknown';

        return {
            timestamp: new Date().toISOString(),
            type: eventType,
            memberName: memberName,
            memberId: memberId,
            groupId: groupId,
            groupName: groupName
        };
    } catch (e) {
        return {
            timestamp: new Date().toISOString(),
            type: eventType,
            memberName: 'Unknown',
            memberId: memberId,
            groupId: groupId,
            groupName: groupName
        };
    }
}

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket available at ws://localhost:${PORT}`);
    console.log('\nAPI Endpoints:');
    console.log(`  GET  /api/health - Server health check`);
    console.log(`  GET  /api/groups - List monitored groups`);
    console.log(`  GET  /api/messages - Get all messages (paginated)`);
    console.log(`  GET  /api/messages/:groupId - Get messages from specific group`);
    console.log(`  GET  /api/events - Get all join/leave events`);
    console.log(`  GET  /api/events/:groupId - Get events from specific group`);
    console.log(`  GET  /api/search?q=query - Search messages`);
    console.log(`  GET  /api/stats - Get statistics\n`);

    // Initialize WhatsApp client
    initClient();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    if (client) {
        await client.destroy();
    }
    server.close();
    console.log('✅ Goodbye!\n');
    process.exit(0);
});
