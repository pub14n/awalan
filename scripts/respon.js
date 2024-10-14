const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Konfigurasi koneksi MySQL
let db;

function handleDisconnect() {
    db = mysql.createConnection({
        host: '202.52.146.145',
        user: 'catidans_berkah',
        password: 'X1)y*etSm88-',
        database: 'catidans_berkah'
    });

    db.connect((err) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            setTimeout(handleDisconnect, 5000);
        } else {
            console.log('Connected to the database.');
        }
    });

    db.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Database connection was closed. Reconnecting...');
            handleDisconnect();
        } else {
            throw err;
        }
    });

    // Ping the database every 55 seconds to keep the connection alive
    setInterval(() => {
        db.ping((err) => {
            if (err) {
                console.error('Error with database ping:', err);
                handleDisconnect(); // Reconnect if ping fails
            } else {
                console.log('Database connection is alive, ping sent');
            }
        });
    }, 55000); // Ping every 55 seconds
}

handleDisconnect();

// Array pesan alternatif
const alternativeMessages = [
    'kak admin yang berkaitan sedang diluar\n\ntapi jangan khawatir aku siap bantu kakak, kk kirim pesan ke aku dengan format dibawah ini ya biar aku lebih mudah memahaminya\n\n*error youtube*\nkirim pesan itu ke aku jika akun youtube kk mengalami masalah, jika akun lain yang bermasalah ubah aja ujungnya, misal netflix berarti error netflix\n\nJika kk ingin order kk bisa order langsung di https://berkahprem.my.id , proses instan dan akun dikirim otomatis\n\nJika kk ada keperluan lain, mohon tunggu beberapa saat lagi ya',
    'Hallo kak, aku siap bantu kk walaupun aku hanya asisten disini :)\n\nKk boleh kirim pesan ke aku dengan kata *#menu* nanti aku kasih daftar layanan yg bisa aku bantu\n\nUntuk keperluan lain mohon tunggu ya kak, admin sebentar lagi kembali',
    'Hallo kak, permintaan kamu masih dalam proses oleh admin terkait\n\nUntuk mengetahui fitur lainnya silahkan kirim chat *#menu*\n\nBisa garansi, renew, order, dan lainnya',
    'Hallo kak, permintaan kamu masih dalam proses oleh admin terkait\n\nUntuk mengetahui fitur lainnya silahkan kirim chat *#menu*\n\nBisa garansi, renew, order, dan lainnya'
];

// Objek untuk menyimpan timer
const messageTimers = {};

module.exports = (sock) => {
    sock.ev.on('messages.upsert', async (message) => {
        const { messages, type } = message;
        if (type === 'notify') {
            const msg = messages[0];
            if (!msg.key.fromMe && msg.message && msg.message.conversation) {
                const text = msg.message.conversation;
                const senderId = msg.key.remoteJid; // Mendapatkan ID pengirim

                console.log(`Pesan diterima: ${text}`);

                // Tandai pesan sebagai sudah dibaca
                const key = {
                    remoteJid: msg.key.remoteJid,
                    id: msg.key.id,
                    participant: msg.key.participant || undefined
                };
                await sock.readMessages([key]);

                // Reset timer jika ada pesan dari nomor yang sama
                if (messageTimers[senderId]) {
                    clearTimeout(messageTimers[senderId]);
                }

                // Setel timer untuk mengirim pesan alternatif setelah 5 menit
                messageTimers[senderId] = setTimeout(async () => {
                    const randomIndex = Math.floor(Math.random() * alternativeMessages.length);
                    const randomMessage = alternativeMessages[randomIndex];
                    await sock.sendMessage(senderId, { text: randomMessage });
                    delete messageTimers[senderId]; // Hapus timer setelah pesan dikirim
                }, 300000); // 5 menit dalam milidetik

                try {
                    if (text.startsWith('.garansiid ')) {
                        const parts = text.split(' ');
                        if (parts.length === 2) {
                            const idGaransi = parts[1];

                            // Ambil kategori dan id_user dari tabel garansi
                            const [garansiResults] = await db.promise().query('SELECT kategori, id_user FROM garansi WHERE id_garansi = ?', [idGaransi]);
                            if (garansiResults.length > 0) {
                                const { kategori, id_user } = garansiResults[0];

                                if (kategori === 'youtube') {
                                    // Ambil detail akun dari tabel akun_premium
                                    const [accountResults] = await db.promise().query('SELECT detail_akun, id_akun FROM akun_premium WHERE kategori = "youtube" LIMIT 1');
                                    if (accountResults.length > 0) {
                                        const { detail_akun, id_akun } = accountResults[0];

                                        // Update tabel garansi
                                        await db.promise().query('UPDATE garansi SET status = "success", akun_garansi = ? WHERE id_garansi = ?', [detail_akun, idGaransi]);

                                        // Ambil nomor WhatsApp dari tabel users
                                        const [userResults] = await db.promise().query('SELECT no_whatsapp FROM users WHERE id_user = ?', [id_user]);
                                        if (userResults.length > 0) {
                                            const userNumber = userResults[0].no_whatsapp;

                                            // Kirim detail akun ke nomor WhatsApp
                                            await sock.sendMessage(`${userNumber}@s.whatsapp.net`, { text: `Detail akun: ${detail_akun}` });

                                            // Hapus akun dari tabel akun_premium
                                            await db.promise().query('DELETE FROM akun_premium WHERE id_akun = ?', [id_akun]);

                                            // Kirim balasan sukses ke admin
                                            await sock.sendMessage(msg.key.remoteJid, { text: 'Sukses' });
                                        } else {
                                            await sock.sendMessage(msg.key.remoteJid, { text: 'Error: Nomor WhatsApp tidak ditemukan.' });
                                        }
                                    } else {
                                        await sock.sendMessage(msg.key.remoteJid, { text: 'Error: Tidak ada akun dengan kategori youtube.' });
                                    }
                                } else {
                                    await sock.sendMessage(msg.key.remoteJid, { text: 'Kategori tidak sesuai dengan youtube.' });
                                }
                            } else {
                                await sock.sendMessage(msg.key.remoteJid, { text: 'Error: ID garansi tidak ditemukan.' });
                            }
                        } else {
                            await sock.sendMessage(msg.key.remoteJid, { text: 'Format perintah tidak sesuai. Contoh: .garansiid 22' });
                        }
                    } else {
                        // Cek template di database
                        const [templates] = await db.promise().query('SELECT * FROM response_templates WHERE is_enabled = true');
                        if (templates.length > 0) {
                            let exactMatchTemplate = null;
                            let matchedTemplates = [];

                            const textLower = text.toLowerCase();

                            for (const template of templates) {
                                const keywords = template.keyword.split('|').map(k => k.trim().toLowerCase());

                                // Cek apakah ada keyword yang sama persis
                                if (keywords.includes(textLower)) {
                                    exactMatchTemplate = template;
                                    break; // Prioritaskan template dengan keyword yang sama persis
                                }

                                const matchedKeywords = keywords.filter(keyword => textLower.includes(keyword));
                                const matchedCount = matchedKeywords.length;

                                if (matchedCount > 0) {
                                    matchedTemplates.push({
                                        template: template.template,
                                        query: template.query,
                                        matchedKeywords,
                                        keywords
                                    });
                                }
                            }

                            if (exactMatchTemplate) {
                                // Jika ada template yang sama persis dengan pesan
                                const [responseResults] = await db.promise().query(exactMatchTemplate.query);
                                if (responseResults.length > 0) {
                                    const responseText = responseResults[0].response;
                                    await sock.sendMessage(msg.key.remoteJid, { text: responseText });
                                }
                            } else if (matchedTemplates.length > 0) {
                                // Jika tidak ada yang persis, gunakan template yang cocok sebagian
                                matchedTemplates.sort((a, b) => {
                                    const aCount = a.matchedKeywords.length;
                                    const bCount = b.matchedKeywords.length;
                                    if (aCount !== bCount) return bCount - aCount; // Urutkan berdasarkan jumlah keyword
                                    
                                    const aFirstPos = Math.min(...a.keywords.map(keyword => text.indexOf(keyword)));
                                    const bFirstPos = Math.min(...b.keywords.map(keyword => text.indexOf(keyword)));

                                    return aFirstPos - bFirstPos;
                                });
                                
                                const matchedTemplate = matchedTemplates[0];
                                if (matchedTemplate) {
                                    const [responseResults] = await db.promise().query(matchedTemplate.query);
                                    if (responseResults.length > 0) {
                                        const responseText = responseResults[0].response;
                                        await sock.sendMessage(msg.key.remoteJid, { text: responseText });
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error handling message:', err);
                    await sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan saat memproses pesan.' });
                }
            }
        }
    });

    // Cek status garansi setiap 1 menit
    setInterval(async () => {
    try {
        // Ambil semua garansi dengan status 'pending'
        const [garansiPending] = await db.promise().query('SELECT id_garansi, kategori FROM garansi WHERE status = "pending"');
        
        if (garansiPending.length > 0) {
            let message = 'Ada garansi pending:\n';
            garansiPending.forEach((garansi, index) => {
                message += `${index + 1}. ID Garansi: ${garansi.id_garansi}, Kategori: ${garansi.kategori}\n`;
            });

            // Kirim pesan ke admin
            await sock.sendMessage('6281271170052@c.us', { text: message });
        } else {
            // Jika tidak ada garansi pending, tampilkan log
            console.log('Tidak ada garansi dengan status pending.');
        }
    } catch (err) {
        console.error('Error checking garansi status:', err);
    }
}, 60000); // 1 menit interval
};