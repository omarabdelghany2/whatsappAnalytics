const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const DEFAULT_MESSAGE_LIMIT = 100;
const MESSAGE_LIMIT = process.argv[2] ? parseInt(process.argv[2]) : DEFAULT_MESSAGE_LIMIT;
const SCROLL_PAUSE_TIME = 2000; // ms to wait between scrolls
const SCROLL_ATTEMPTS = 15; // Number of times to scroll up
// =========================

console.log('===============================================');
console.log('   WhatsApp Cairo Chat Extractor (Scroll)');
console.log('===============================================');
console.log(`Target messages: ${MESSAGE_LIMIT}`);
console.log(`Scroll attempts: ${SCROLL_ATTEMPTS}\n`);

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
        headless: false, // Show browser
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 Scan this QR code:');
    qrcode.generate(qr, { small: true });
    console.log('\nWaiting...\n');
});

client.on('ready', async () => {
    console.log('✅ Client ready!\n');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for full load

    console.log('Searching for "cairo" group...\n');

    try {
        const chats = await client.getChats();
        const cairoGroup = chats.find(chat =>
            chat.isGroup && chat.name.toLowerCase().includes('cairo')
        );

        if (!cairoGroup) {
            console.error('❌ Could not find cairo group');
            const groups = chats.filter(chat => chat.isGroup);
            console.log('\nAvailable groups:');
            groups.forEach((group, index) => {
                console.log(`   ${index + 1}. ${group.name}`);
            });
            await client.destroy();
            process.exit(1);
        }

        console.log(`✅ Found: "${cairoGroup.name}"`);
        console.log(`\n📜 Scrolling to load more messages...\n`);

        // Get the puppeteer page
        const page = await client.pupPage;

        if (!page) {
            console.error('❌ Could not access browser page');
            await client.destroy();
            process.exit(1);
        }

        // Click on the chat to open it
        console.log('Opening chat...');
        await page.evaluate((chatId) => {
            const chatElement = document.querySelector(`[data-id="${chatId}"]`);
            if (chatElement) chatElement.click();
        }, cairoGroup.id._serialized);

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Scroll up to load more messages
        for (let i = 1; i <= SCROLL_ATTEMPTS; i++) {
            console.log(`Scroll attempt ${i}/${SCROLL_ATTEMPTS}...`);

            await page.evaluate(() => {
                const messageContainer = document.querySelector('[data-testid="conversation-panel-body"]') ||
                                       document.querySelector('[class*="copyable-area"]') ||
                                       document.querySelector('div[tabindex="-1"]');

                if (messageContainer) {
                    // Scroll to top
                    messageContainer.scrollTop = 0;

                    // Also try keyboard scroll
                    messageContainer.focus();
                    for (let j = 0; j < 10; j++) {
                        messageContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
                    }
                }
            });

            await new Promise(resolve => setTimeout(resolve, SCROLL_PAUSE_TIME));
        }

        console.log(`\n✅ Finished scrolling. Now fetching messages...\n`);

        // Now fetch messages after scrolling
        const messages = await cairoGroup.fetchMessages({ limit: MESSAGE_LIMIT });

        console.log(`✅ Fetched ${messages.length} messages!\n`);

        // Process messages
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

        // Save files
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const txtFilePath = path.join(outputDir, 'cairo_chat_export.txt');
        fs.writeFileSync(txtFilePath, exportText, 'utf8');
        console.log(`✅ Saved: ${txtFilePath}`);

        const jsonFilePath = path.join(outputDir, 'cairo_chat_raw.json');
        fs.writeFileSync(jsonFilePath, JSON.stringify(processedMessages, null, 2), 'utf8');
        console.log(`✅ Saved: ${jsonFilePath}`);

        // Statistics
        console.log('\n' + '='.repeat(50));
        console.log('📊 STATISTICS');
        console.log('='.repeat(50));
        console.log(`Total messages: ${messages.length}`);

        const senderCounts = {};
        processedMessages.forEach(msg => {
            senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
        });

        console.log('\nTop contributors:');
        Object.entries(senderCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([sender, count], index) => {
                const percentage = ((count / messages.length) * 100).toFixed(1);
                console.log(`   ${index + 1}. ${sender}: ${count} (${percentage}%)`);
            });

        if (processedMessages.length > 0) {
            const first = processedMessages[0];
            const last = processedMessages[processedMessages.length - 1];
            console.log('\nDate range:');
            console.log(`   First: ${new Date(first.timestamp).toLocaleString()}`);
            console.log(`   Last: ${new Date(last.timestamp).toLocaleString()}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ COMPLETE!');
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
    console.log('✅ Authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
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

console.log('🚀 Starting...\n');
client.initialize();
