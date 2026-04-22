// index.js  —  Ponto de entrada do Bot Científico WhatsApp
require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { AcademicBot } = require('./src/bot');
const http = require('http');
const fs = require('fs');

// Servidor HTTP para health check e keep-alive
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } 
    else if (req.url === '/ping') {
        console.log(`🏓 Ping recebido em ${new Date().toLocaleString()}`);
        res.writeHead(200);
        res.end('pong');
    }
    else {
        res.writeHead(404);
        res.end();
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`✅ Keep-alive server running on port ${PORT}`);
});

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const AUTH_FOLDER = './auth_info_baileys';
const RECONNECT_DELAY_MS = 5000;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

async function startBot() {
    console.log('\n🤖 ═══════════════════════════════════════');
    console.log('   BOT DE TRABALHOS CIENTÍFICOS');
    console.log('   WhatsApp + IA (Groq)');
    console.log('═══════════════════════════════════════\n');

    // Verificar qual API key está configurada
    if (!process.env.GROQ_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️  AVISO: Nenhuma API key configurada!');
        console.warn('   Configure GROQ_API_KEY ou ANTHROPIC_API_KEY no .env');
        console.warn('   O bot funcionará em modo demo.\n');
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📦 Baileys versão: ${version.join('.')}\n`);

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Bot Científico', 'Chrome', '120.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000
        });

        const bot = new AcademicBot(sock);

        // ─── EVENTOS DE CONEXÃO ───────────────────────────────────────────────────

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📱 Escaneie o QR Code abaixo com o WhatsApp:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n_Abra WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho_\n');
                reconnectAttempts = 0;
            }

            if (connection === 'connecting') {
                console.log('🔄 Conectando ao WhatsApp...');
            }

            if (connection === 'open') {
                const info = sock.user;
                console.log(`\n✅ Conectado com sucesso!`);
                console.log(`📞 Número: ${info?.id?.split(':')[0] || 'desconhecido'}`);
                console.log(`👤 Nome: ${info?.name || 'desconhecido'}`);
                console.log('\n🎓 Bot pronto para receber mensagens!\n');
                console.log('Comandos disponíveis:');
                console.log('  /novo    — Iniciar trabalho acadêmico');
                console.log('  /cv      — Criar currículo');
                console.log('  /carta   — Criar carta');
                console.log('  /relatorio — Criar relatório');
                console.log('  /documento — Criar documento simples');
                console.log('  /ajuda   — Ver ajuda');
                console.log('  /status  — Ver status');
                console.log('  /cancelar — Cancelar\n');
                reconnectAttempts = 0;
            }

            if (connection === 'close') {
                const err = lastDisconnect?.error;
                const statusCode = err instanceof Boom ? err.output?.statusCode : 500;
                
                // Mapear códigos de erro
                let reason = '';
                if (statusCode === 515) reason = 'restartRequired (Reconexão necessária)';
                else if (statusCode === DisconnectReason.loggedOut) reason = 'loggedOut (Sessão expirada)';
                else if (statusCode === DisconnectReason.connectionClosed) reason = 'connectionClosed';
                else if (statusCode === DisconnectReason.connectionLost) reason = 'connectionLost';
                else if (statusCode === DisconnectReason.timedOut) reason = 'timedOut';
                else reason = String(statusCode);

                console.log(`\n❌ Conexão encerrada. Razão: ${reason}`);

                // Para TODOS os erros, tentar reconectar
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = Math.min(RECONNECT_DELAY_MS * reconnectAttempts, 30000);
                    console.log(`🔄 Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${delay/1000}s...`);
                    
                    // Se for erro de sessão expirada, limpar pasta
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 515) {
                        console.log('🧹 Limpando sessão antiga...');
                        try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch (_) {}
                    }
                    
                    setTimeout(() => startBot(), delay);
                } else {
                    console.log('❌ Máximo de tentativas atingido.');
                    console.log('   Reinicie manualmente com: node index.js\n');
                }
            }
        });

        // ─── SALVAR CREDENCIAIS ───────────────────────────────────────────────────

        sock.ev.on('creds.update', saveCreds);

        // ─── RECEBER MENSAGENS ────────────────────────────────────────────────────

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                try {
                    if (msg.key.fromMe) continue;
                    if (msg.key.remoteJid === 'status@broadcast') continue;

                    const hasText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    if (!hasText) continue;

                    await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
                    await bot.processMessage(msg);
                    await sock.sendPresenceUpdate('paused', msg.key.remoteJid);

                } catch (err) {
                    console.error('❌ Erro no handler de mensagem:', err.message);
                }
            }
        });

        // ─── TRATAMENTO DE ERROS DO SOCKET ────────────────────────────────────────

        sock.ev.on('error', (err) => {
            console.error('❌ Erro no socket:', err.message);
        });

    } catch (err) {
        console.error('❌ Erro ao iniciar bot:', err.message);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em 10s...`);
            setTimeout(() => startBot(), 10000);
        }
    }
}

// ─── TRATAMENTO DE SINAIS DO SISTEMA ──────────────────────────────────────────

process.on('uncaughtException', (err) => {
    console.error('💥 Erro não tratado:', err.message);
    setTimeout(() => startBot(), 5000);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Promise rejeitada:', reason?.message || reason);
    setTimeout(() => startBot(), 5000);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 Encerrando bot graciosamente...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Bot encerrado por sinal SIGTERM.');
    process.exit(0);
});

// ─── START ────────────────────────────────────────────────────────────────────

startBot().catch((err) => {
    console.error('💥 Falha crítica ao iniciar o bot:', err);
    process.exit(1);
});
