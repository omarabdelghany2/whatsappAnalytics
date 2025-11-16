const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
// Change this to fetch more or fewer messages
// Examples: 60, 100, 500, 1000, 5000, etc.
const DEFAULT_MESSAGE_LIMIT = 5000;

// Get limit from command line argument if provided
// Usage: node bot.js 60  (fetches last 60 messages)
// Usage: node bot.js 1000  (fetches last 1000 messages)
const MESSAGE_LIMIT = process.argv[2] ? parseInt(process.argv[2]) : DEFAULT_MESSAGE_LIMIT;
// =========================

console.log('===============================================');
console.log('   WhatsApp Cairo Group Chat Extractor Bot');
console.log('===============================================');
console.log(`Message limit: ${MESSAGE_LIMIT}\n`);

// Create a new client with local authentication
const client = new Client({
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

// Generate QR code for authentication
client.on('qr', (qr) => {
    console.log('📱 Scan this QR code with your WhatsApp mobile app:');
    console.log('   Go to WhatsApp > Settings > Linked Devices > Link a Device\n');
    qrcode.generate(qr, { small: true });
    console.log('\nWaiting for QR code scan...\n');
});

// Client is ready
client.on('ready', async () => {
    console.log('✅ WhatsApp Web client is ready!\n');

    // Wait a bit for everything to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Searching for "cairo" group...\n');

    try {
        // Get all chats
        const chats = await client.getChats();

        // Find the cairo group
        const cairoGroup = chats.find(chat =>
            chat.isGroup &&
            chat.name.toLowerCase().includes('cairo')
        );

        if (!cairoGroup) {
            console.error('❌ Error: Could not find a group with "cairo" in its name.');
            console.log('\nAvailable groups:');
            const groups = chats.filter(chat => chat.isGroup);
            groups.forEach((group, index) => {
                console.log(`   ${index + 1}. ${group.name}`);
            });
            console.log('\nPlease check the group name and try again.');
            process.exit(1);
        }

        console.log(`✅ Found group: "${cairoGroup.name}"`);
        console.log(`📊 Fetching last ${MESSAGE_LIMIT} messages... This may take a while.\n`);

        // Fetch messages from the group
        const messages = await cairoGroup.fetchMessages({ limit: MESSAGE_LIMIT });

        console.log(`✅ Successfully fetched ${messages.length} messages!\n`);

        // Format messages in WhatsApp export format
        let exportText = '';
        const processedMessages = [];

        for (const msg of messages) {
            try {
                const timestamp = new Date(msg.timestamp * 1000);
                const dateStr = formatDate(timestamp);

                // Get sender name
                let senderName = 'Unknown';
                if (msg.author) {
                    const contact = await client.getContactById(msg.author);
                    senderName = contact.pushname || contact.name || contact.number || 'Unknown';
                }

                // Get message body
                let body = msg.body || '';

                // Handle media messages
                if (msg.hasMedia) {
                    const mediaType = msg.type;
                    body = body || `<${mediaType}>`;
                }

                // Format in WhatsApp export style
                const formattedMsg = `${dateStr} - ${senderName}: ${body}`;
                exportText += formattedMsg + '\n';

                // Store structured data
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

        // Create output directory if it doesn't exist
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Save as text file (WhatsApp export format)
        const txtFilePath = path.join(outputDir, 'cairo_chat_export.txt');
        fs.writeFileSync(txtFilePath, exportText, 'utf8');
        console.log(`✅ Saved chat export to: ${txtFilePath}`);

        // Save as JSON
        const jsonFilePath = path.join(outputDir, 'cairo_chat_raw.json');
        fs.writeFileSync(jsonFilePath, JSON.stringify(processedMessages, null, 2), 'utf8');
        console.log(`✅ Saved JSON data to: ${jsonFilePath}`);

        // Display statistics
        console.log('\n' + '='.repeat(50));
        console.log('📊 CHAT STATISTICS');
        console.log('='.repeat(50));
        console.log(`Total messages: ${messages.length}`);

        // Count messages per sender
        const senderCounts = {};
        processedMessages.forEach(msg => {
            senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
        });

        console.log('\nTop contributors:');
        const sortedSenders = Object.entries(senderCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        sortedSenders.forEach(([sender, count], index) => {
            const percentage = ((count / messages.length) * 100).toFixed(1);
            console.log(`   ${index + 1}. ${sender}: ${count} messages (${percentage}%)`);
        });

        // Date range
        if (processedMessages.length > 0) {
            const firstMsg = processedMessages[processedMessages.length - 1];
            const lastMsg = processedMessages[0];
            console.log('\nDate range:');
            console.log(`   First message: ${new Date(firstMsg.timestamp).toLocaleString()}`);
            console.log(`   Last message: ${new Date(lastMsg.timestamp).toLocaleString()}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ EXTRACTION COMPLETE!');
        console.log('='.repeat(50));
        console.log('\nYou can now analyze the chat using the Python script:');
        console.log(`   python extract_cairo_chat.py "${txtFilePath}"\n`);
        console.log('Or with pipenv:');
        console.log(`   pipenv run python extract_cairo_chat.py "${txtFilePath}"\n`);

        // Exit
        await client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nFull error details:');
        console.error(error);

        console.log('\n💡 Troubleshooting tips:');
        console.log('   1. Make sure no other bot instances are running');
        console.log('   2. Wait 10-30 seconds between runs');
        console.log('   3. Try restarting if the issue persists');

        try {
            await client.destroy();
        } catch (e) {
            // Ignore cleanup errors
        }
        process.exit(1);
    }
});

// Handle authentication
client.on('authenticated', () => {
    console.log('✅ Authentication successful!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    process.exit(1);
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('⚠️  Client was disconnected:', reason);
});

// Helper function to format date in WhatsApp style
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

// Initialize the client
console.log('🚀 Starting WhatsApp Web client...\n');
client.initialize();
