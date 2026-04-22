// index.js  —  Ponto de entrada do Bot Científico WhatsApp
require('dotenv').config(); // Carrega .env se existir

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

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const AUTH_FOLDER = './auth_info_baileys';
const RECONNECT_DELAY_MS = 5000;

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

async function startBot() {
    console.log('\n🤖 ═══════════════════════════════════════');
    console.log('   BOT DE TRABALHOS CIENTÍFICOS');
    console.log('   WhatsApp + IA (Anthropic Claude)');
    console.log('═══════════════════════════════════════\n');

    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️  AVISO: ANTHROPIC_API_KEY não definida no ambiente.');
        console.warn('   Crie um arquivo .env com: ANTHROPIC_API_KEY=sua_chave_aqui');
        console.warn('   O bot funcionará em modo demo (conteúdo de exemplo).\n');
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📦 Baileys versão: ${version.join('.')}\n`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // Silencia logs internos do Baileys
        browser: ['Bot Científico', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false
    });

    // Instanciar o bot com o socket
    const bot = new AcademicBot(sock);

    // ─── EVENTOS DE CONEXÃO ───────────────────────────────────────────────────

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 Escaneie o QR Code abaixo com o WhatsApp:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n_Abra WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho_\n');
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
            console.log('  /novo    — Iniciar trabalho');
            console.log('  /ajuda   — Ver ajuda');
            console.log('  /status  — Ver status');
            console.log('  /cancelar — Cancelar\n');
        }

        if (connection === 'close') {
            const err = lastDisconnect?.error;
            const statusCode = err instanceof Boom ? err.output?.statusCode : 500;
            const reason = DisconnectReason[statusCode] || statusCode;

            console.log(`\n❌ Conexão encerrada. Razão: ${reason} (${statusCode})`);

            if (statusCode === DisconnectReason.loggedOut) {
                console.log('🧹 Sessão expirada. Removendo credenciais...');
                const fs = require('fs');
                try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch (_) {}
                console.log('🔁 Reiniciando para novo QR Code...\n');
                setTimeout(startBot, 2000);
            } else if (statusCode === DisconnectReason.connectionClosed ||
                       statusCode === DisconnectReason.connectionLost ||
                       statusCode === DisconnectReason.timedOut ||
                       statusCode === 408 || statusCode === 503 || statusCode === 500) {
                console.log(`🔄 Reconectando em ${RECONNECT_DELAY_MS / 1000}s...\n`);
                setTimeout(startBot, RECONNECT_DELAY_MS);
            } else {
                console.log('⚠️  Não será reconectado automaticamente para este erro.');
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
                // Ignorar mensagens do próprio bot
                if (msg.key.fromMe) continue;

                // Ignorar broadcasts e notificações de sistema
                if (msg.key.remoteJid === 'status@broadcast') continue;

                // Ignorar mensagens sem conteúdo
                const hasText =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text;
                if (!hasText) continue;

                // Indicador "digitando..."
                await sock.sendPresenceUpdate('composing', msg.key.remoteJid);

                // Processar mensagem no bot
                await bot.processMessage(msg);

                // Parar indicador
                await sock.sendPresenceUpdate('paused', msg.key.remoteJid);

            } catch (err) {
                console.error('❌ Erro no handler de mensagem:', err.message);
            }
        }
    });

    // ─── ERROS GLOBAIS ────────────────────────────────────────────────────────

    process.on('uncaughtException', (err) => {
        console.error('💥 Erro não tratado:', err.message);
        // Não encerrar o processo, apenas logar
    });

    process.on('unhandledRejection', (reason) => {
        console.error('💥 Promise rejeitada:', reason?.message || reason);
    });

    process.on('SIGINT', () => {
        console.log('\n\n👋 Encerrando bot graciosamente...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n\n👋 Bot encerrado por sinal SIGTERM.');
        process.exit(0);
    });
}

// ─── START ────────────────────────────────────────────────────────────────────

startBot().catch((err) => {
    console.error('💥 Falha crítica ao iniciar o bot:', err);
    process.exit(1);
});
