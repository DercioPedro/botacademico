// src/bot.js - Versão para Baileys
const { AcademicAIService } = require('./ai-service');
const { DocumentFormatter } = require('./formatter');
const fs = require('fs');
const path = require('path');

// ─── ESTADOS ──────────────────────────────────────────────────────────────────
const STEPS = {
    IDLE: 'idle',
    SELECIONAR_TIPO: 'selecionar_tipo',
    // Estados para trabalho acadêmico
    TEMA: 'tema',
    TIPO: 'tipo_trabalho',
    PAGINAS: 'paginas',
    FORMATO: 'formato',
    AUTOR: 'autor',
    ORIENTADOR: 'orientador',
    INSTITUICAO: 'instituicao',
    CURSO: 'curso',
    CIDADE: 'cidade',
    ANO: 'ano',
    // Estados para currículo
    CV_NOME: 'cv_nome',
    CV_CARGO: 'cv_cargo',
    CV_EXPERIENCIA: 'cv_experiencia',
    CV_EDUCACAO: 'cv_educacao',
    CV_HABILIDADES: 'cv_habilidades',
    CV_IDIOMAS: 'cv_idiomas',
    // Estados para carta
    CARTA_TIPO: 'carta_tipo',
    CARTA_DESTINATARIO: 'carta_destinatario',
    CARTA_ASSUNTO: 'carta_assunto',
    CARTA_CORPO: 'carta_corpo',
    // Estados para relatório
    RELATORIO_TITULO: 'relatorio_titulo',
    RELATORIO_PERIODO: 'relatorio_periodo',
    RELATORIO_DEPARTAMENTO: 'relatorio_departamento',
    // Estados para documento simples
    DOC_TIPO: 'doc_tipo',
    DOC_TITULO: 'doc_titulo',
    DOC_CONTEUDO: 'doc_conteudo',
    // Estado genérico
    CONFIRMAR: 'confirmar',
    GERANDO: 'gerando'
};

class AcademicBot {
    constructor(sock) {
        this.sock = sock;
        this.sessions = new Map();
        this.aiService = new AcademicAIService();
        this.formatter = new DocumentFormatter();
        this._loadSessions();
    }

    // ─── PERSISTÊNCIA ─────────────────────────────────────────────────────────

    _loadSessions() {
        const file = path.join(__dirname, 'sessions.json');
        try {
            if (fs.existsSync(file)) {
                const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
                this.sessions = new Map(raw);
            }
        } catch (_) {
            this.sessions = new Map();
        }
    }

    _saveSessions() {
        try {
            const file = path.join(__dirname, 'sessions.json');
            fs.writeFileSync(file, JSON.stringify([...this.sessions]));
        } catch (_) {}
    }

    _getSession(jid) {
        return this.sessions.get(jid) || { step: STEPS.IDLE, data: {} };
    }

    _setSession(jid, step, data) {
        this.sessions.set(jid, { step, data });
        this._saveSessions();
    }

    _clearSession(jid) {
        this.sessions.delete(jid);
        this._saveSessions();
    }

    // ─── ENTRADA PRINCIPAL ────────────────────────────────────────────────────

   // src/bot.js - Adicione/modifique esta parte

async processMessage(msg) {
    try {
        // Extrair JID corretamente para Baileys
        const jid = msg.key.remoteJid;
        
        // Extrair texto da mensagem
        let text = '';
        if (msg.message?.conversation) {
            text = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageWithCaption?.caption) {
            text = msg.message.imageWithCaption.caption;
        }

        if (!text || !text.trim()) return;

        // 👇 ADICIONE ESTA PARTE PARA GRUPOS 👇
        const isGroup = jid.endsWith('@g.us');
        const botNumber = this.sock.user.id.split(':')[0];
        
        // Verificar se é grupo
        if (isGroup) {
            // Verificar se o bot foi mencionado
            const isMentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.some(
                j => j === this.sock.user.id
            );
            
            // Verificar se o comando é direto ou com menção
            const isCommand = text.startsWith('/');
            const isBotMentioned = text.includes(`@${botNumber}`) || isMentioned;
            
            // // Se for comando mas não mencionou o bot, ignora
            // if (isCommand && !isBotMentioned && !text.startsWith('/status') && !text.startsWith('/ajuda')) {
            //     return; // Ignora comandos em grupo sem mencionar o bot
            // }
            
            // Se for mensagem normal sem mencionar, ignora
            if (!isCommand && !isBotMentioned) {
                return;
            }
            
            // Limpar texto: remover menção do bot se existir
            text = text.replace(new RegExp(`@${botNumber}\\s*`, 'g'), '').trim();
        }

        console.log(`📩 [${new Date().toLocaleTimeString()}] ${isGroup ? 'GRUPO' : 'PV'} ${jid}: ${text.substring(0, 80)}`);

        if (text.startsWith('/')) {
            await this._handleCommand(jid, text.trim().toLowerCase(), isGroup);
        } else {
            await this._handleFlow(jid, text.trim());
        }
    } catch (err) {
        console.error('❌ Erro processMessage:', err.message);
    }
}

    // ─── COMANDOS ─────────────────────────────────────────────────────────────

   async _handleCommand(jid, cmd, isGroup = false) {
    switch (cmd) {
        case '/novo':
        case '/start':
            this._setSession(jid, STEPS.SELECIONAR_TIPO, {});
            await this._send(jid, MSG.SELECIONAR_TIPO);
            break;

        case '/cv':
        case '/curriculo':
            this._setSession(jid, STEPS.CV_NOME, { tipo: 'cv' });
            await this._send(jid, MSG.CV_INICIO);
            break;

        case '/carta':
            this._setSession(jid, STEPS.CARTA_TIPO, { tipo: 'carta' });
            await this._send(jid, MSG.CARTA_SELECIONAR);
            break;

        case '/relatorio':
            this._setSession(jid, STEPS.RELATORIO_TITULO, { tipo: 'relatorio' });
            await this._send(jid, MSG.RELATORIO_INICIO);
            break;

        case '/documento':
        case '/doc':
            this._setSession(jid, STEPS.DOC_TIPO, { tipo: 'documento_simples' });
            await this._send(jid, MSG.DOC_INICIO);
            break;

        case '/ajuda':
            let ajudaMsg = MSG.AJUDA;
            if (isGroup) {
                ajudaMsg = `🤖 *BOT ACADÊMICO*\n\n` +
                          `Para usar o bot neste grupo, me mencione junto com o comando:\n\n` +
                          `@${this.sock.user.id.split(':')[0]} /novo\n\n` +
                          `*Comandos disponíveis:*\n` +
                          `/novo - Iniciar trabalho acadêmico\n` +
                          `/cv - Criar currículo\n` +
                          `/carta - Criar carta\n` +
                          `/relatorio - Criar relatório\n` +
                          `/documento - Criar documento simples\n` +
                          `/status - Ver status\n` +
                          `/cancelar - Cancelar\n` +
                          `/ajuda - Esta mensagem`;
            }
            await this._send(jid, ajudaMsg);
            break;

        case '/status':
            await this._send(jid, this._msgStatus(jid));
            break;

        case '/cancelar':
            this._clearSession(jid);
            await this._send(jid, '❌ Operação cancelada.\n\nDigite */novo* ou outro comando para começar.');
            break;

        default:
            await this._send(jid, '❓ Comando não reconhecido. Digite */ajuda* para ver os comandos disponíveis.');
    }
}
    // ─── FLUXO DE CONVERSAÇÃO ─────────────────────────────────────────────────

    async _handleFlow(jid, text) {
        const session = this._getSession(jid);
        const { step, data } = session;
        const t = text.trim();
        const tLow = t.toLowerCase();

        if (['cancelar', 'sair', 'cancel'].includes(tLow)) {
            this._clearSession(jid);
            await this._send(jid, '❌ Cancelado. Digite */novo* ou outro comando para recomeçar.');
            return;
        }

        switch (step) {
            case STEPS.IDLE:
                await this._send(jid, MSG.MENU_INICIAL);
                break;

            case STEPS.SELECIONAR_TIPO:
                await this._handleTipoDocumento(jid, tLow, data);
                break;

            // ─── TRABALHO ACADÊMICO ──────────────────────────────────────────
            case STEPS.TEMA:
                await this._handleAcademicFlow(jid, t, data);
                break;
            case STEPS.TIPO:
                await this._handleTipoTrabalho(jid, t, data);
                break;
            case STEPS.PAGINAS:
                await this._handlePaginas(jid, t, data);
                break;
            case STEPS.FORMATO:
                await this._handleFormato(jid, t, data);
                break;
            case STEPS.AUTOR:
                await this._handleAutor(jid, t, data);
                break;
            case STEPS.ORIENTADOR:
                await this._handleOrientador(jid, t, data);
                break;
            case STEPS.INSTITUICAO:
                await this._handleInstituicao(jid, t, data);
                break;
            case STEPS.CURSO:
                await this._handleCurso(jid, t, data);
                break;
            case STEPS.CIDADE:
                await this._handleCidade(jid, t, data);
                break;
            case STEPS.ANO:
                await this._handleAno(jid, t, data);
                break;

            // ─── CURRÍCULO ───────────────────────────────────────────────────
            case STEPS.CV_NOME:
                data.nome = t;
                this._setSession(jid, STEPS.CV_CARGO, data);
                await this._send(jid, MSG.CV_PERGUNTAR_CARGO);
                break;
            case STEPS.CV_CARGO:
                data.cargo = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.CV_EXPERIENCIA, data);
                await this._send(jid, MSG.CV_PERGUNTAR_EXPERIENCIA);
                break;
            case STEPS.CV_EXPERIENCIA:
                data.experiencia = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.CV_EDUCACAO, data);
                await this._send(jid, MSG.CV_PERGUNTAR_EDUCACAO);
                break;
            case STEPS.CV_EDUCACAO:
                data.educacao = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.CV_HABILIDADES, data);
                await this._send(jid, MSG.CV_PERGUNTAR_HABILIDADES);
                break;
            case STEPS.CV_HABILIDADES:
                data.habilidades = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.CV_IDIOMAS, data);
                await this._send(jid, MSG.CV_PERGUNTAR_IDIOMAS);
                break;
            case STEPS.CV_IDIOMAS:
                data.idiomas = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.CONFIRMAR, data);
                await this._send(jid, this._msgConfirmarCV(data));
                break;

            // ─── CARTA ───────────────────────────────────────────────────────
            case STEPS.CARTA_TIPO:
                await this._handleTipoCarta(jid, tLow, data);
                break;
            case STEPS.CARTA_DESTINATARIO:
                data.destinatario = t;
                this._setSession(jid, STEPS.CARTA_ASSUNTO, data);
                await this._send(jid, MSG.CARTA_PERGUNTAR_ASSUNTO);
                break;
            case STEPS.CARTA_ASSUNTO:
                data.assunto = t;
                this._setSession(jid, STEPS.CARTA_CORPO, data);
                await this._send(jid, MSG.CARTA_PERGUNTAR_CORPO);
                break;
            case STEPS.CARTA_CORPO:
                data.corpo = t;
                this._setSession(jid, STEPS.CONFIRMAR, data);
                await this._send(jid, this._msgConfirmarCarta(data));
                break;

            // ─── RELATÓRIO ───────────────────────────────────────────────────
            case STEPS.RELATORIO_TITULO:
                data.titulo_relatorio = t;
                this._setSession(jid, STEPS.RELATORIO_PERIODO, data);
                await this._send(jid, MSG.RELATORIO_PERGUNTAR_PERIODO);
                break;
            case STEPS.RELATORIO_PERIODO:
                data.periodo = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.RELATORIO_DEPARTAMENTO, data);
                await this._send(jid, MSG.RELATORIO_PERGUNTAR_DEPARTAMENTO);
                break;
            case STEPS.RELATORIO_DEPARTAMENTO:
                data.departamento = tLow === 'pular' ? '' : t;
                this._setSession(jid, STEPS.CONFIRMAR, data);
                await this._send(jid, this._msgConfirmarRelatorio(data));
                break;

            // ─── DOCUMENTO SIMPLES ───────────────────────────────────────────
            case STEPS.DOC_TIPO:
                await this._handleTipoDocumentoSimples(jid, tLow, data);
                break;
            case STEPS.DOC_TITULO:
                data.titulo = t;
                this._setSession(jid, STEPS.DOC_CONTEUDO, data);
                await this._send(jid, MSG.DOC_PERGUNTAR_CONTEUDO);
                break;
            case STEPS.DOC_CONTEUDO:
                data.conteudo_principal = t;
                this._setSession(jid, STEPS.CONFIRMAR, data);
                await this._send(jid, this._msgConfirmarDocumento(data));
                break;

            // ─── CONFIRMAR E GERAR ───────────────────────────────────────────
            case STEPS.CONFIRMAR:
                if (['sim', 's', 'yes', 'ok', '1'].includes(tLow)) {
                    this._setSession(jid, STEPS.GERANDO, data);
                    await this._gerarEEnviar(jid, data);
                } else {
                    this._clearSession(jid);
                    await this._send(jid, '❌ Cancelado. Digite */novo* ou outro comando para recomeçar.');
                }
                break;

            case STEPS.GERANDO:
                await this._send(jid, '⏳ Seu documento ainda está sendo gerado, aguarde...');
                break;
        }
    }

    // ─── HANDLERS ESPECÍFICOS ─────────────────────────────────────────────────

    async _handleTipoDocumento(jid, tLow, data) {
        const tipos = {
            '1': 'academico', 'academico': 'academico', 'tcc': 'academico',
            '2': 'cv', 'curriculo': 'cv', 'cv': 'cv',
            '3': 'carta', 'carta': 'carta',
            '4': 'relatorio', 'relatorio': 'relatorio',
            '5': 'documento_simples', 'documento': 'documento_simples', 'doc': 'documento_simples'
        };
        
        const tipoDoc = tipos[tLow];
        if (!tipoDoc) {
            await this._send(jid, '⚠️ Opção inválida.\n\n' + MSG.SELECIONAR_TIPO);
            return;
        }
        
        data.tipo = tipoDoc;
        
        switch(tipoDoc) {
            case 'academico':
                this._setSession(jid, STEPS.TEMA, data);
                await this._send(jid, MSG.PEDIR_TEMA);
                break;
            case 'cv':
                this._setSession(jid, STEPS.CV_NOME, data);
                await this._send(jid, MSG.CV_INICIO);
                break;
            case 'carta':
                this._setSession(jid, STEPS.CARTA_TIPO, data);
                await this._send(jid, MSG.CARTA_SELECIONAR);
                break;
            case 'relatorio':
                this._setSession(jid, STEPS.RELATORIO_TITULO, data);
                await this._send(jid, MSG.RELATORIO_INICIO);
                break;
            case 'documento_simples':
                this._setSession(jid, STEPS.DOC_TIPO, data);
                await this._send(jid, MSG.DOC_INICIO);
                break;
        }
    }

    async _handleTipoCarta(jid, tLow, data) {
        const tipos = {
            '1': 'carta_apresentacao',
            '2': 'carta_comercial',
            '3': 'carta_solicitacao',
            '4': 'carta_demissao',
            '5': 'carta_recomendacao'
        };
        
        data.tipo_carta = tipos[tLow] || (tLow.includes('apres') ? 'carta_apresentacao' : 
                                          tLow.includes('comerc') ? 'carta_comercial' :
                                          tLow.includes('solic') ? 'carta_solicitacao' :
                                          tLow.includes('demis') ? 'carta_demissao' :
                                          tLow.includes('recom') ? 'carta_recomendacao' : null);
        
        if (!data.tipo_carta) {
            await this._send(jid, '⚠️ Opção inválida.\n\n' + MSG.CARTA_SELECIONAR);
            return;
        }
        
        this._setSession(jid, STEPS.CARTA_DESTINATARIO, data);
        await this._send(jid, MSG.CARTA_PERGUNTAR_DESTINATARIO);
    }

    async _handleTipoDocumentoSimples(jid, tLow, data) {
        const tipos = {
            '1': 'oficio', 'oficio': 'oficio',
            '2': 'memorando', 'memorando': 'memorando',
            '3': 'declaracao', 'declaracao': 'declaracao',
            '4': 'atestado', 'atestado': 'atestado'
        };
        
        data.tipo_documento = tipos[tLow];
        if (!data.tipo_documento) {
            await this._send(jid, '⚠️ Opção inválida.\n\n' + MSG.DOC_INICIO);
            return;
        }
        
        this._setSession(jid, STEPS.DOC_TITULO, data);
        await this._send(jid, MSG.DOC_PERGUNTAR_TITULO);
    }

    async _handleAcademicFlow(jid, t, data) {
        if (t.length < 5) {
            await this._send(jid, '⚠️ Descreva o tema com mais detalhes (mínimo 5 caracteres).');
            return;
        }
        data.tema = t;
        this._setSession(jid, STEPS.TIPO, data);
        await this._send(jid, MSG.PEDIR_TIPO);
    }

    async _handleTipoTrabalho(jid, t, data) {
        const tipos = { '1':'tcc', '2':'artigo', '3':'resenha', '4':'relatorio_academico', '5':'monografia', '6':'dissertacao' };
        data.tipo_trabalho = tipos[t] || (t.includes('tcc') ? 'tcc' : t.includes('artigo') ? 'artigo' : 
                                t.includes('resenha') ? 'resenha' : t.includes('relat') ? 'relatorio_academico' : 
                                t.includes('monogr') ? 'monografia' : t.includes('disser') ? 'dissertacao' : null);
        if (!data.tipo_trabalho) {
            await this._send(jid, '⚠️ Opção inválida. ' + MSG.PEDIR_TIPO);
            return;
        }
        data.tipo = 'academico';
        this._setSession(jid, STEPS.PAGINAS, data);
        await this._send(jid, MSG.PEDIR_PAGINAS);
    }

    async _handlePaginas(jid, t, data) {
        const n = parseInt(t);
        if (isNaN(n) || n < 5 || n > 100) {
            await this._send(jid, '⚠️ Digite um número entre 5 e 100.');
            return;
        }
        data.paginas = n;
        this._setSession(jid, STEPS.FORMATO, data);
        await this._send(jid, MSG.PEDIR_FORMATO);
    }

    async _handleFormato(jid, t, data) {
        const formatos = { '1': 'ABNT', '2': 'APA', '3': 'Vancouver' };
        data.formato = formatos[t] || (t.includes('abnt') ? 'ABNT' : t.includes('apa') ? 'APA' : 
                                       t.includes('van') ? 'Vancouver' : null);
        if (!data.formato) {
            await this._send(jid, '⚠️ Opção inválida. ' + MSG.PEDIR_FORMATO);
            return;
        }
        this._setSession(jid, STEPS.AUTOR, data);
        await this._send(jid, '👤 *Qual o nome do(s) autor(es)?*');
    }

    async _handleAutor(jid, t, data) {
        data.autor = t;
        this._setSession(jid, STEPS.ORIENTADOR, data);
        await this._send(jid, '🎓 *Nome do orientador(a):* (ou *pular*)');
    }

    async _handleOrientador(jid, t, data) {
        data.orientador = t.toLowerCase() === 'pular' ? '' : t;
        this._setSession(jid, STEPS.INSTITUICAO, data);
        await this._send(jid, '🏛️ *Nome da instituição:* (ou *pular*)');
    }

    async _handleInstituicao(jid, t, data) {
        data.instituicao = t.toLowerCase() === 'pular' ? '' : t;
        this._setSession(jid, STEPS.CURSO, data);
        await this._send(jid, '📚 *Curso ou departamento:* (ou *pular*)');
    }

    async _handleCurso(jid, t, data) {
        data.curso = t.toLowerCase() === 'pular' ? '' : t;
        this._setSession(jid, STEPS.CIDADE, data);
        await this._send(jid, '🏙️ *Cidade:* (ou *pular*)');
    }

    async _handleCidade(jid, t, data) {
        data.cidade = t.toLowerCase() === 'pular' ? '' : t;
        this._setSession(jid, STEPS.ANO, data);
        await this._send(jid, `📅 *Ano do trabalho:* (padrão: ${new Date().getFullYear()})`);
    }

    async _handleAno(jid, t, data) {
        data.ano = /^\d{4}$/.test(t) ? t : String(new Date().getFullYear());
        this._setSession(jid, STEPS.CONFIRMAR, data);
        await this._send(jid, this._msgConfirmarAcademico(data));
    }

    // ─── GERAÇÃO E ENVIO ─────────────────────────────────────────────────────

    async _gerarEEnviar(jid, data) {
        const tipoNome = {
            'academico': 'trabalho acadêmico',
            'cv': 'currículo',
            'carta': 'carta',
            'relatorio': 'relatório',
            'documento_simples': 'documento'
        }[data.tipo] || 'documento';
        
        await this._send(jid, `⏳ *Gerando seu ${tipoNome}...*\n\nA IA está elaborando o conteúdo. Isso leva alguns segundos.\n\n_Aguarde..._`);

        try {
            const content = await this.aiService.generateDocument(data);
            const filePath = await this.formatter.generateDocument(content, data);
            const buffer = fs.readFileSync(filePath);
            
            const fileName = this._getFileName(content, data);
            const caption = this._getCaption(content, data);
            
            // Enviar documento via Baileys
            await this.sock.sendMessage(jid, {
                document: buffer,
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                fileName: fileName,
                caption: caption
            });
            
            try { fs.unlinkSync(filePath); } catch (_) {}
            this._clearSession(jid);
            
        } catch (err) {
            console.error('❌ Erro ao gerar documento:', err.message);
            this._clearSession(jid);
            await this._send(jid, `❌ *Erro ao gerar o documento.*\n\n_${err.message}_\n\nDigite */novo* para tentar novamente.`);
        }
    }

    _getFileName(content, data) {
        if (data.tipo === 'cv') return `curriculo_${Date.now()}.docx`;
        if (data.tipo === 'carta') return `carta_${Date.now()}.docx`;
        if (data.tipo === 'relatorio') return `relatorio_${Date.now()}.docx`;
        const titulo = content.titulo || data.titulo || 'documento';
        return `${titulo.substring(0, 40).replace(/[^\w\s]/gi, '').trim()}.docx`;
    }

    _getCaption(content, data) {
        if (data.tipo === 'cv') {
            return `✅ *CURRÍCULO GERADO!*\n\n👤 *Nome:* ${content.nome}\n🎯 *Cargo:* ${content.cargo_desejado}\n\nDigite */cv* para gerar outro.`;
        }
        if (data.tipo === 'carta') {
            return `✅ *CARTA GERADA!*\n\n📌 *Assunto:* ${content.assunto}\n👥 *Destinatário:* ${content.destinatario}\n\nDigite */carta* para gerar outra.`;
        }
        if (data.tipo === 'relatorio') {
            return `✅ *RELATÓRIO GERADO!*\n\n📊 *Título:* ${content.titulo}\n📅 *Período:* ${content.periodo}\n\nDigite */relatorio* para gerar outro.`;
        }
        return `✅ *DOCUMENTO GERADO!*\n\n📚 *Título:* ${content.titulo || 'Documento'}\n\nDigite */novo* para gerar outro.`;
    }

    // ─── MENSAGENS DE CONFIRMAÇÃO ────────────────────────────────────────────

    _msgConfirmarAcademico(data) {
        return `✅ *CONFIRME OS DADOS DO TRABALHO ACADÊMICO:*\n\n` +
            `📌 *Tema:* ${data.tema}\n` +
            `📄 *Tipo:* ${data.tipo_trabalho}\n` +
            `📐 *Norma:* ${data.formato}\n` +
            `📏 *Páginas:* ${data.paginas}\n` +
            `👤 *Autor:* ${data.autor || '—'}\n` +
            (data.orientador ? `🎓 *Orientador:* ${data.orientador}\n` : '') +
            (data.instituicao ? `🏛️ *Instituição:* ${data.instituicao}\n` : '') +
            `\nDigite *SIM* para gerar o trabalho.`;
    }

    _msgConfirmarCV(data) {
        return `✅ *CONFIRME OS DADOS DO CURRÍCULO:*\n\n` +
            `👤 *Nome:* ${data.nome}\n` +
            `🎯 *Cargo:* ${data.cargo || '—'}\n` +
            `\nDigite *SIM* para gerar o currículo.`;
    }

    _msgConfirmarCarta(data) {
        return `✅ *CONFIRME OS DADOS DA CARTA:*\n\n` +
            `📌 *Tipo:* ${data.tipo_carta}\n` +
            `👥 *Destinatário:* ${data.destinatario}\n` +
            `📝 *Assunto:* ${data.assunto}\n` +
            `\nDigite *SIM* para gerar a carta.`;
    }

    _msgConfirmarRelatorio(data) {
        return `✅ *CONFIRME OS DADOS DO RELATÓRIO:*\n\n` +
            `📊 *Título:* ${data.titulo_relatorio}\n` +
            `📅 *Período:* ${data.periodo || '—'}\n` +
            `\nDigite *SIM* para gerar o relatório.`;
    }

    _msgConfirmarDocumento(data) {
        return `✅ *CONFIRME OS DADOS DO DOCUMENTO:*\n\n` +
            `📄 *Tipo:* ${data.tipo_documento}\n` +
            `📌 *Título:* ${data.titulo}\n` +
            `\nDigite *SIM* para gerar o documento.`;
    }

    // ─── ENVIO ───────────────────────────────────────────────────────────────

    async _send(jid, text) {
        try {
            await this.sock.sendMessage(jid, { text });
        } catch (err) {
            console.error('❌ Erro ao enviar mensagem:', err.message);
        }
    }

    _msgStatus(jid) {
        const s = this._getSession(jid);
        if (s.step === STEPS.IDLE) return 'Nenhuma operação em andamento. Use: /novo, /cv, /carta, /relatorio, /documento';
        return `📊 *Status:* ${s.step}\nDigite *cancelar* para abandonar.`;
    }
}

// ─── MENSAGENS ESTÁTICAS ──────────────────────────────────────────────────────

const MSG = {
    MENU_INICIAL: `👋 *Olá! Sou o Bot de Documentos Inteligente* 📄\n\n` +
        `Crio diversos tipos de documentos com IA:\n\n` +
        `🎓 *Acadêmicos* - TCC, artigos, resenhas\n` +
        `📄 *Currículos* - CV profissional\n` +
        `✉️ *Cartas* - Apresentação, comercial, etc\n` +
        `📊 *Relatórios* - Profissionais e técnicos\n` +
        `📋 *Documentos* - Ofícios, declarações\n\n` +
        `Digite */novo* para começar.\nDigite */ajuda* para ver todos os comandos.`,

    SELECIONAR_TIPO: `📋 *QUAL DOCUMENTO VOCÊ QUER CRIAR?*\n\n` +
        `1️⃣ Trabalho Acadêmico (TCC, artigo, etc)\n` +
        `2️⃣ Currículo / CV\n` +
        `3️⃣ Carta (apresentação, comercial, etc)\n` +
        `4️⃣ Relatório Profissional\n` +
        `5️⃣ Documento Simples (ofício, declaração)\n\n` +
        `_Digite o número ou o nome:_`,

    PEDIR_TEMA: `📝 *Qual o tema do trabalho acadêmico?*\n\n_Seja específico para melhor resultado._`,
    PEDIR_TIPO: `📄 *Tipo de trabalho?*\n\n1️⃣ TCC\n2️⃣ Artigo\n3️⃣ Resenha\n4️⃣ Relatório\n5️⃣ Monografia\n6️⃣ Dissertação`,
    PEDIR_PAGINAS: `📏 *Quantas páginas?* (5-100)`,
    PEDIR_FORMATO: `📐 *Norma?*\n1️⃣ ABNT\n2️⃣ APA\n3️⃣ Vancouver`,

    CV_INICIO: `📄 *Vamos criar seu CURRÍCULO!*\n\nQual o seu *nome completo*?`,
    CV_PERGUNTAR_CARGO: `🎯 *Qual o cargo desejado?* (ou *pular*)`,
    CV_PERGUNTAR_EXPERIENCIA: `💼 *Descreva sua experiência:* (ou *pular*)`,
    CV_PERGUNTAR_EDUCACAO: `🎓 *Qual sua formação?* (ou *pular*)`,
    CV_PERGUNTAR_HABILIDADES: `🛠️ *Principais habilidades?* (ou *pular*)`,
    CV_PERGUNTAR_IDIOMAS: `🌐 *Idiomas?* (ou *pular*)`,

    CARTA_SELECIONAR: `✉️ *QUAL TIPO DE CARTA?*\n\n` +
        `1️⃣ Apresentação\n2️⃣ Comercial\n3️⃣ Solicitação\n4️⃣ Demissão\n5️⃣ Recomendação`,
    CARTA_PERGUNTAR_DESTINATARIO: `👥 *Para quem é a carta?*`,
    CARTA_PERGUNTAR_ASSUNTO: `📝 *Qual o assunto?*`,
    CARTA_PERGUNTAR_CORPO: `📄 *Descreva o conteúdo principal:*`,

    RELATORIO_INICIO: `📊 *Título do relatório?*`,
    RELATORIO_PERGUNTAR_PERIODO: `📅 *Período?* (ou *pular*)`,
    RELATORIO_PERGUNTAR_DEPARTAMENTO: `🏢 *Departamento?* (ou *pular*)`,

    DOC_INICIO: `📋 *Tipo de documento?*\n1️⃣ Ofício\n2️⃣ Memorando\n3️⃣ Declaração\n4️⃣ Atestado`,
    DOC_PERGUNTAR_TITULO: `📌 *Título do documento?*`,
    DOC_PERGUNTAR_CONTEUDO: `📄 *Descreva o conteúdo:*`,

    AJUDA: `📚 *COMANDOS:*\n\n` +
        `*/novo* — Iniciar novo documento\n` +
        `*/cv* — Criar currículo\n` +
        `*/carta* — Criar carta\n` +
        `*/relatorio* — Criar relatório\n` +
        `*/documento* — Documento simples\n` +
        `*/status* — Ver operação atual\n` +
        `*/cancelar* — Cancelar\n` +
        `*/ajuda* — Este menu`
};

module.exports = { AcademicBot };
