const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('===============================================');
console.log('   WhatsApp Group List');
console.log('===============================================\n');

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

client.on('qr', (qr) => {
    console.log('📱 Scan this QR code:');
    qrcode.generate(qr, { small: true });
    console.log('\nWaiting for scan...\n');
});

client.on('authenticated', () => {
    console.log('✅ Authenticated!\n');
});

client.on('ready', async () => {
    console.log('✅ Client ready!\n');
    console.log('Fetching all groups...\n');

    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        if (groups.length === 0) {
            console.log('❌ No groups found in your WhatsApp.');
        } else {
            console.log('='.repeat(70));
            console.log(`Found ${groups.length} group(s):\n`);

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const participants = group.participants ? group.participants.length : 'Unknown';

                console.log(`${i + 1}. ${group.name}`);
                console.log(`   ID: ${group.id._serialized}`);
                console.log(`   Members: ${participants}`);
                console.log('');
            }

            console.log('='.repeat(70));
            console.log('\nTo monitor a group, add its name to config.json:');
            console.log('Example: { "groups": ["cairo", "Family Group"] }\n');
        }

        await client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        await client.destroy();
        process.exit(1);
    }
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
    process.exit(1);
});

console.log('🚀 Starting client...\n');
client.initialize();
