const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const DEFAULT_MESSAGE_LIMIT = 100;
const MESSAGE_LIMIT = process.argv[2] ? parseInt(process.argv[2]) : DEFAULT_MESSAGE_LIMIT;
// =========================

console.log('===============================================');
console.log('   WhatsApp Cairo Chat Extractor (Extended)');
console.log('===============================================');
console.log(`Target messages: ${MESSAGE_LIMIT}\n`);

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
        headless: false, // Show browser to see what's happening
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 Scan this QR code with your WhatsApp mobile app:');
    qrcode.generate(qr, { small: true });
    console.log('\nWaiting for QR code scan...\n');
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Searching for "cairo" group...\n');

    try {
        const chats = await client.getChats();
        const cairoGroup = chats.find(chat =>
            chat.isGroup && chat.name.toLowerCase().includes('cairo')
        );

        if (!cairoGroup) {
            console.error('❌ Could not find a group with "cairo" in its name.');
            const groups = chats.filter(chat => chat.isGroup);
            console.log('\nAvailable groups:');
            groups.forEach((group, index) => {
                console.log(`   ${index + 1}. ${group.name}`);
            });
            await client.destroy();
            process.exit(1);
        }

        console.log(`✅ Found group: "${cairoGroup.name}"`);
        console.log(`📊 Fetching messages with scrolling...\n`);

        let allMessages = [];
        let previousCount = 0;
        let attempts = 0;
        const maxAttempts = 10;

        // Fetch messages in batches by scrolling
        while (allMessages.length < MESSAGE_LIMIT && attempts < maxAttempts) {
            attempts++;

            console.log(`   Attempt ${attempts}: Fetching messages...`);
            const messages = await cairoGroup.fetchMessages({ limit: 100 });

            console.log(`   Got ${messages.length} messages (total unique: ${allMessages.length})`);

            // Deduplicate by message ID
            const messageMap = new Map();

            // Add existing messages
            allMessages.forEach(msg => messageMap.set(msg.id._serialized, msg));

            // Add new messages
            messages.forEach(msg => messageMap.set(msg.id._serialized, msg));

            allMessages = Array.from(messageMap.values());

            // If we got the same count as before, we've reached the end
            if (allMessages.length === previousCount) {
                console.log(`   No new messages found. Stopping.`);
                break;
            }

            previousCount = allMessages.length;

            // Wait before next fetch to avoid rate limiting
            if (allMessages.length < MESSAGE_LIMIT) {
                console.log(`   Waiting before next fetch...\n`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        console.log(`\n✅ Successfully fetched ${allMessages.length} unique messages!\n`);

        // Sort messages by timestamp (oldest first)
        allMessages.sort((a, b) => a.timestamp - b.timestamp);

        // Process messages
        let exportText = '';
        const processedMessages = [];

        for (const msg of allMessages) {
            try {
                const timestamp = new Date(msg.timestamp * 1000);
                const dateStr = formatDate(timestamp);

                let senderName = 'Unknown';
                if (msg.author) {
                    const contact = await client.getContactById(msg.author);
                    senderName = contact.pushname || contact.name || contact.number || 'Unknown';
                }

                let body = msg.body || '';
                if (msg.hasMedia) {
                    const mediaType = msg.type;
                    body = body || `<${mediaType}>`;
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
                console.error('Error processing message:', err.message);
            }
        }

        // Create output directory
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Save files
        const txtFilePath = path.join(outputDir, 'cairo_chat_export.txt');
        fs.writeFileSync(txtFilePath, exportText, 'utf8');
        console.log(`✅ Saved chat export to: ${txtFilePath}`);

        const jsonFilePath = path.join(outputDir, 'cairo_chat_raw.json');
        fs.writeFileSync(jsonFilePath, JSON.stringify(processedMessages, null, 2), 'utf8');
        console.log(`✅ Saved JSON data to: ${jsonFilePath}`);

        // Display statistics
        console.log('\n' + '='.repeat(50));
        console.log('📊 CHAT STATISTICS');
        console.log('='.repeat(50));
        console.log(`Total messages: ${allMessages.length}`);

        const senderCounts = {};
        processedMessages.forEach(msg => {
            senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
        });

        console.log('\nTop contributors:');
        const sortedSenders = Object.entries(senderCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        sortedSenders.forEach(([sender, count], index) => {
            const percentage = ((count / allMessages.length) * 100).toFixed(1);
            console.log(`   ${index + 1}. ${sender}: ${count} messages (${percentage}%)`);
        });

        if (processedMessages.length > 0) {
            const firstMsg = processedMessages[0];
            const lastMsg = processedMessages[processedMessages.length - 1];
            console.log('\nDate range:');
            console.log(`   First: ${new Date(firstMsg.timestamp).toLocaleString()}`);
            console.log(`   Last: ${new Date(lastMsg.timestamp).toLocaleString()}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ EXTRACTION COMPLETE!');
        console.log('='.repeat(50));

        await client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        try {
            await client.destroy();
        } catch (e) {}
        process.exit(1);
    }
});

client.on('authenticated', () => {
    console.log('✅ Authentication successful!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    process.exit(1);
});

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

console.log('🚀 Starting WhatsApp Web client...\n');
client.initialize();
