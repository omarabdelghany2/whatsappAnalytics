const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
    const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(configFile);
} catch (error) {
    console.error('❌ Error loading config.json:', error.message);
    console.log('\nCreating default config.json...');
    config = {
        groups: ["cairo"],
        checkInterval: 60000,
        messageLimit: 15,
        detectJoinsLeaves: true
    };
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
    console.log('✅ Created config.json with default settings\n');
}

const CHECK_INTERVAL = config.checkInterval || 60000;
const MESSAGE_LIMIT = config.messageLimit || 15;
const DETECT_JOINS_LEAVES = config.detectJoinsLeaves !== false;
const GROUP_NAMES = config.groups || ["cairo"];

console.log('===============================================');
console.log('   WhatsApp Group Monitor');
console.log('===============================================');
console.log(`Monitoring groups: ${GROUP_NAMES.join(', ')}`);
console.log(`Check interval: ${CHECK_INTERVAL / 1000} seconds`);
console.log(`Message limit: ${MESSAGE_LIMIT}`);
console.log(`Detect joins/leaves: ${DETECT_JOINS_LEAVES ? 'Yes' : 'No'}\n`);

let client;
let monitoredGroups = new Map(); // groupId -> { name, previousMessageIds, previousMembers, isFirstRun }

// Initialize client
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
        console.log('📱 Scan this QR code:');
        qrcode.generate(qr, { small: true });
        console.log('\nWaiting for scan...\n');
    });

    client.on('authenticated', () => {
        console.log('✅ Authenticated!');
    });

    client.on('ready', async () => {
        console.log('✅ Client ready!\n');

        // Find and initialize monitored groups
        await initializeGroups();

        if (monitoredGroups.size === 0) {
            console.error('❌ No matching groups found!');
            console.log('\nRun "node list_groups.js" to see all available groups.');
            console.log('Then update config.json with the group names you want to monitor.\n');
            process.exit(1);
        }

        console.log('🔄 Starting monitoring...\n');

        // Start checking immediately and then every interval
        checkAllGroups();
        setInterval(checkAllGroups, CHECK_INTERVAL);
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Auth failed:', msg);
        process.exit(1);
    });

    client.on('disconnected', (reason) => {
        console.log('⚠️  Disconnected:', reason);
        console.log('Reconnecting in 10 seconds...');
        setTimeout(() => {
            client.initialize();
        }, 10000);
    });

    // Listen for group join events
    if (DETECT_JOINS_LEAVES) {
        client.on('group_join', async (notification) => {
            const groupId = notification.id.remote;
            const groupInfo = monitoredGroups.get(groupId);

            if (groupInfo) {
                try {
                    const contact = await client.getContactById(notification.recipientIds[0]);
                    const name = contact.pushname || contact.name || contact.number || 'Unknown';

                    console.log('\n' + '='.repeat(70));
                    console.log(`🟢 SOMEONE JOINED ${groupInfo.name.toUpperCase()}`);
                    console.log('='.repeat(70));
                    console.log(`👤 ${name}`);
                    console.log(`⏰ ${new Date().toLocaleString()}`);
                    console.log('='.repeat(70) + '\n');

                    // Log to file
                    logEvent(groupInfo.name, 'JOIN', name);
                } catch (e) {
                    console.log(`🟢 Someone joined ${groupInfo.name}`);
                }
            }
        });

        // Listen for group leave events
        client.on('group_leave', async (notification) => {
            const groupId = notification.id.remote;
            const groupInfo = monitoredGroups.get(groupId);

            if (groupInfo) {
                try {
                    const contact = await client.getContactById(notification.recipientIds[0]);
                    const name = contact.pushname || contact.name || contact.number || 'Unknown';

                    console.log('\n' + '='.repeat(70));
                    console.log(`🔴 SOMEONE LEFT ${groupInfo.name.toUpperCase()}`);
                    console.log('='.repeat(70));
                    console.log(`👤 ${name}`);
                    console.log(`⏰ ${new Date().toLocaleString()}`);
                    console.log('='.repeat(70) + '\n');

                    // Log to file
                    logEvent(groupInfo.name, 'LEAVE', name);
                } catch (e) {
                    console.log(`🔴 Someone left ${groupInfo.name}`);
                }
            }
        });
    }

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

            // Get initial member list
            let members = [];
            if (DETECT_JOINS_LEAVES && group.participants) {
                members = group.participants.map(p => p.id._serialized);
            }

            monitoredGroups.set(group.id._serialized, {
                name: group.name,
                id: group.id._serialized,
                previousMessageIds: new Set(),
                previousMembers: new Set(members),
                isFirstRun: true
            });
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
    console.log(`\n[${timestamp}] Checking ${groupInfo.name}...`);

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.id._serialized === groupId);

        if (!group) {
            console.error(`❌ Group ${groupInfo.name} not found`);
            return;
        }

        // Check for member changes (joins/leaves) if enabled
        if (DETECT_JOINS_LEAVES && group.participants) {
            const currentMembers = new Set(group.participants.map(p => p.id._serialized));

            // Detect new members (joins)
            for (const memberId of currentMembers) {
                if (!groupInfo.previousMembers.has(memberId) && !groupInfo.isFirstRun) {
                    try {
                        const contact = await client.getContactById(memberId);
                        const name = contact.pushname || contact.name || contact.number || 'Unknown';

                        console.log('\n' + '='.repeat(70));
                        console.log(`🟢 NEW MEMBER IN ${groupInfo.name.toUpperCase()}`);
                        console.log('='.repeat(70));
                        console.log(`👤 ${name}`);
                        console.log(`⏰ ${new Date().toLocaleString()}`);
                        console.log('='.repeat(70) + '\n');

                        logEvent(groupInfo.name, 'JOIN', name);
                    } catch (e) {
                        console.log(`🟢 New member in ${groupInfo.name}`);
                    }
                }
            }

            // Detect removed members (leaves)
            for (const memberId of groupInfo.previousMembers) {
                if (!currentMembers.has(memberId) && !groupInfo.isFirstRun) {
                    try {
                        const contact = await client.getContactById(memberId);
                        const name = contact.pushname || contact.name || contact.number || 'Unknown';

                        console.log('\n' + '='.repeat(70));
                        console.log(`🔴 MEMBER LEFT ${groupInfo.name.toUpperCase()}`);
                        console.log('='.repeat(70));
                        console.log(`👤 ${name}`);
                        console.log(`⏰ ${new Date().toLocaleString()}`);
                        console.log('='.repeat(70) + '\n');

                        logEvent(groupInfo.name, 'LEAVE', name);
                    } catch (e) {
                        console.log(`🔴 Member left ${groupInfo.name}`);
                    }
                }
            }

            // Update member list
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

        if (groupInfo.isFirstRun) {
            console.log(`✅ Loaded ${messages.length} messages (first run)\n`);
            console.log('=' .repeat(70));
            console.log(`RECENT MESSAGES FROM ${groupInfo.name.toUpperCase()}:`);
            console.log('=' .repeat(70));

            // Display all messages on first run
            for (const msg of messages.slice().reverse()) {
                await displayMessage(msg, groupInfo.name);
            }
            console.log('\n' + '=' .repeat(70) + '\n');
            groupInfo.isFirstRun = false;
        } else if (newMessages.length > 0) {
            console.log(`🆕 Found ${newMessages.length} new message(s) in ${groupInfo.name}!\n`);
            console.log('=' .repeat(70));

            // Display new messages
            for (const msg of newMessages.reverse()) {
                await displayMessage(msg, groupInfo.name);
            }
            console.log('\n' + '=' .repeat(70) + '\n');
        } else {
            console.log(`   No new messages in ${groupInfo.name}`);
        }

        // Save all messages to file
        await saveMessages(messages, groupInfo.name, groupId);

        // Clean up old message IDs (keep last 100)
        if (groupInfo.previousMessageIds.size > 100) {
            const idsArray = Array.from(groupInfo.previousMessageIds);
            groupInfo.previousMessageIds = new Set(idsArray.slice(-100));
        }

    } catch (error) {
        console.error(`❌ Error checking ${groupInfo.name}:`, error.message);
    }
}

async function displayMessage(msg, groupName) {
    const timestamp = new Date(msg.timestamp * 1000);
    const dateStr = formatDate(timestamp);

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

    console.log(`\n[${dateStr}] [${groupName}]`);
    console.log(`👤 ${senderName}`);
    console.log(`💬 ${body}`);
}

async function saveMessages(messages, groupName, groupId) {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Sanitize group name for filename
    const safeGroupName = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    let exportText = '';
    const processedMessages = [];

    // Sort by timestamp
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);

    for (const msg of sortedMessages) {
        try {
            const timestamp = new Date(msg.timestamp * 1000);
            const dateStr = formatDate(timestamp);

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

            const formattedMsg = `${dateStr} - ${senderName}: ${body}`;
            exportText += formattedMsg + '\n';

            processedMessages.push({
                timestamp: timestamp.toISOString(),
                timestamp_str: dateStr,
                sender: senderName,
                message: body,
                type: msg.type,
                hasMedia: msg.hasMedia
            });
        } catch (err) {
            // Skip errors
        }
    }

    // Save to files
    const txtFilePath = path.join(outputDir, `${safeGroupName}_latest.txt`);
    fs.writeFileSync(txtFilePath, exportText, 'utf8');

    const jsonFilePath = path.join(outputDir, `${safeGroupName}_latest.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(processedMessages, null, 2), 'utf8');

    // Also append to history file
    const historyFile = path.join(outputDir, `${safeGroupName}_history.txt`);
    const newMessagesText = exportText.split('\n')
        .filter(line => line.trim())
        .join('\n') + '\n';

    if (fs.existsSync(historyFile)) {
        const existing = fs.readFileSync(historyFile, 'utf8');
        const existingLines = new Set(existing.split('\n').filter(l => l.trim()));
        const newLines = newMessagesText.split('\n').filter(l => l.trim() && !existingLines.has(l));

        if (newLines.length > 0) {
            fs.appendFileSync(historyFile, newLines.join('\n') + '\n', 'utf8');
        }
    } else {
        fs.writeFileSync(historyFile, newMessagesText, 'utf8');
    }
}

function logEvent(groupName, eventType, memberName) {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const safeGroupName = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const eventsFile = path.join(outputDir, `${safeGroupName}_events.txt`);

    const timestamp = new Date().toLocaleString();
    const logLine = `[${timestamp}] ${eventType}: ${memberName}\n`;

    fs.appendFileSync(eventsFile, logLine, 'utf8');
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Stopping monitor...');
    if (client) {
        await client.destroy();
    }
    console.log('✅ Stopped. Goodbye!\n');
    process.exit(0);
});

// Start
console.log('🚀 Starting WhatsApp monitor...\n');
initClient();
