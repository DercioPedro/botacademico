// src/ai-service.js  —  Suporte a Múltiplos Documentos (Acadêmico, CV, Relatórios, Cartas, etc)
const axios = require('axios');

// ─── CONFIGURAÇÃO DOS PROVEDORES ──────────────────────────────────────────────
//
//  No .env defina o provedor desejado:
//
//    AI_PROVIDER=groq        → Groq (recomendado - rápido e grátis)
//    AI_PROVIDER=anthropic   → Claude
//    AI_PROVIDER=deepseek    → DeepSeek
//    AI_PROVIDER=auto        → Tenta todos em ordem (padrão)
//
//  Chaves de API:
//    GROQ_API_KEY=gsk_...        (https://console.groq.com)
//    ANTHROPIC_API_KEY=sk-ant-...
//    DEEPSEEK_API_KEY=sk-...
//
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS = {
    groq: {
        name: 'Groq (Llama 3.3 70B)',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
        envKey: 'GROQ_API_KEY'
    },
    anthropic: {
        name: 'Anthropic (Claude)',
        url: 'https://api.anthropic.com/v1/messages',
        model: 'claude-sonnet-4-20250514',
        envKey: 'ANTHROPIC_API_KEY'
    },
    deepseek: {
        name: 'DeepSeek',
        url: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat',
        envKey: 'DEEPSEEK_API_KEY'
    }
};

class AcademicAIService {
    constructor() {
        this.provider = (process.env.AI_PROVIDER || 'auto').toLowerCase();
        this.groqKey = process.env.GROQ_API_KEY;
        this.anthropicKey = process.env.ANTHROPIC_API_KEY;
        this.deepseekKey = process.env.DEEPSEEK_API_KEY;

        this.providerOrder = ['groq', 'anthropic', 'deepseek'];

        if (this.provider === 'auto') {
            const active = this.groqKey ? 'Groq'
                         : this.anthropicKey ? 'Anthropic'
                         : this.deepseekKey ? 'DeepSeek'
                         : 'nenhum (modo demo)';
            console.log(`🤖 IA: modo AUTO → usando ${active}`);
        } else {
            const p = PROVIDERS[this.provider];
            console.log(`🤖 IA: provedor fixo → ${p ? p.name : this.provider}`);
        }
    }

    // ─── MÉTODO PRINCIPAL (AGORA SUPORTA MÚLTIPLOS TIPOS) ─────────────────────

    async generateDocument(data) {
        const { tipo } = data;
        
        // Seleciona o prompt builder baseado no tipo
        let prompt;
        switch(tipo) {
            case 'academico':
            case 'tcc':
            case 'artigo':
            case 'resenha':
            case 'relatorio_academico':
            case 'monografia':
            case 'dissertacao':
                prompt = this._buildAcademicPrompt(data);
                break;
            case 'cv':
            case 'curriculo':
                prompt = this._buildCVPrompt(data);
                break;
            case 'carta':
            case 'carta_profissional':
            case 'carta_apresentacao':
                prompt = this._buildLetterPrompt(data);
                break;
            case 'relatorio':
            case 'relatorio_profissional':
                prompt = this._buildReportPrompt(data);
                break;
            case 'documento_simples':
            case 'oficio':
            case 'memorando':
            case 'declaracao':
                prompt = this._buildSimpleDocumentPrompt(data);
                break;
            default:
                throw new Error(`Tipo de documento não suportado: ${tipo}`);
        }

        // ── AUTO: tenta todos os provedores ──
        if (this.provider === 'auto') {
            for (const provider of this.providerOrder) {
                const key = this[`${provider}Key`];
                if (key) {
                    try {
                        console.log(`🔄 Tentando ${provider.toUpperCase()}...`);
                        return await this[`_call${provider.charAt(0).toUpperCase() + provider.slice(1)}`](prompt, data, tipo);
                    } catch (err) {
                        console.warn(`⚠️  ${provider} falhou: ${err.message}`);
                    }
                }
            }
            console.warn('⚠️  Todos os provedores falharam. Usando modo demo.');
            return this.generateMockDocument(data);
        }

        // ── Provedor fixo ──
        if (this.provider === 'groq') {
            if (!this.groqKey) throw new Error('GROQ_API_KEY não definida');
            return await this._callGroq(prompt, data, tipo);
        }
        if (this.provider === 'anthropic') {
            if (!this.anthropicKey) throw new Error('ANTHROPIC_API_KEY não definida');
            return await this._callAnthropic(prompt, data, tipo);
        }
        if (this.provider === 'deepseek') {
            if (!this.deepseekKey) throw new Error('DEEPSEEK_API_KEY não definida');
            return await this._callDeepSeek(prompt, data, tipo);
        }

        throw new Error(`Provedor inválido: "${this.provider}"`);
    }

    // ─── PROMPTS PARA DIFERENTES TIPOS DE DOCUMENTO ───────────────────────────

    _buildAcademicPrompt(data) {
        const { tema, tipo, paginas, formato, autor, instituicao, curso, orientador } = data;
        const tipoMap = {
            'tcc': 'Trabalho de Conclusão de Curso (TCC)',
            'artigo': 'Artigo Científico',
            'resenha': 'Resenha Crítica',
            'relatorio_academico': 'Relatório Técnico-Científico',
            'monografia': 'Monografia',
            'dissertacao': 'Dissertação',
            'academico': 'Trabalho Acadêmico'
        };

        return `Crie um ${tipoMap[tipo] || 'Trabalho Acadêmico'} completo.

TEMA: ${tema}
PÁGINAS: ${paginas}
NORMA: ${formato}
${autor ? `AUTOR: ${autor}` : ''}
${instituicao ? `INSTITUIÇÃO: ${instituicao}` : ''}
${curso ? `CURSO: ${curso}` : ''}
${orientador ? `ORIENTADOR: ${orientador}` : ''}

Responda SOMENTE com JSON:
{
  "titulo": "título completo",
  "resumo": "resumo (150-250 palavras)",
  "palavras_chave": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "introducao": "introdução (mínimo 400 palavras)",
  "fundamentacao": "fundamentação teórica (mínimo 500 palavras)",
  "metodologia": "metodologia (mínimo 300 palavras)",
  "analise": "análise (mínimo 500 palavras)",
  "conclusao": "conclusão (mínimo 250 palavras)",
  "referencias": ["ref1", "ref2", ...]
}`;
    }

    _buildCVPrompt(data) {
        const { nome, cargo, experiencia, educacao, habilidades, idiomas, objetivo } = data;

        return `Crie um Currículo Profissional de alto nível.

NOME: ${nome || '[Nome do Candidato]'}
${cargo ? `CARGO DESEJADO: ${cargo}` : ''}
${objetivo ? `OBJETIVO PROFISSIONAL: ${objetivo}` : ''}
${experiencia ? `EXPERIÊNCIA: ${experiencia}` : ''}
${educacao ? `FORMAÇÃO: ${educacao}` : ''}
${habilidades ? `HABILIDADES: ${habilidades}` : ''}
${idiomas ? `IDIOMAS: ${idiomas}` : ''}

Responda com JSON:
{
  "nome": "${nome || 'Nome do Profissional'}",
  "cargo_desejado": "${cargo || 'Cargo desejado'}",
  "objetivo": "resumo profissional impactante (100-150 palavras)",
  "experiencia": [
    {"periodo": "2022-2024", "empresa": "Empresa X", "cargo": "Cargo Y", "responsabilidades": ["resp1", "resp2"]}
  ],
  "educacao": [
    {"curso": "Curso", "instituicao": "Instituição", "ano": "2024"}
  ],
  "habilidades": ["habilidade1", "habilidade2"],
  "idiomas": [{"idioma": "Inglês", "nivel": "Avançado"}],
  "certificacoes": ["cert1", "cert2"],
  "contato": {"email": "email@exemplo.com", "telefone": "(00) 00000-0000"}
}`;
    }

    _buildLetterPrompt(data) {
        const { tipo_carta, destinatario, remetente, assunto, corpo, tom } = data;
        
        const tiposMap = {
            'carta_apresentacao': 'Carta de Apresentação para vaga de emprego',
            'carta_comercial': 'Carta Comercial formal',
            'carta_solicitacao': 'Carta de Solicitação',
            'carta_demissao': 'Carta de Demissão / Rescisão',
            'carta_recomendacao': 'Carta de Recomendação',
            'carta_profissional': 'Carta Profissional'
        };

        return `Crie uma ${tiposMap[tipo_carta] || 'Carta Profissional'}.

${destinatario ? `DESTINATÁRIO: ${destinatario}` : ''}
${remetente ? `REMETENTE: ${remetente}` : ''}
${assunto ? `ASSUNTO: ${assunto}` : ''}
${corpo ? `CONTEÚDO PRINCIPAL: ${corpo}` : ''}
${tom ? `TOM: ${tom} (formal, neutro, amigável)` : 'TOM: formal'}

Responda com JSON:
{
  "remetente": "${remetente || 'Seu Nome'}",
  "destinatario": "${destinatario || 'Nome do Destinatário'}",
  "assunto": "${assunto || 'Assunto da Carta'}",
  "data": "data atual formatada",
  "saudacao": "Prezado(a) Sr.(a) [Nome]",
  "corpo": "texto completo da carta com parágrafos bem estruturados",
  "fechamento": "Atenciosamente, [Nome]",
  "observacoes": "observações adicionais se houver"
}`;
    }

    _buildReportPrompt(data) {
        const { titulo_relatorio, periodo, autor_relatorio, departamento, resumo_executivo, topicos } = data;

        return `Crie um Relatório Profissional detalhado.

TÍTULO: ${titulo_relatorio || 'Relatório de Atividades'}
${periodo ? `PERÍODO: ${periodo}` : ''}
${autor_relatorio ? `AUTOR: ${autor_relatorio}` : ''}
${departamento ? `DEPARTAMENTO: ${departamento}` : ''}
${resumo_executivo ? `RESUMO EXECUTIVO: ${resumo_executivo}` : ''}
${topicos ? `TÓPICOS A COBRIR: ${topicos}` : ''}

Responda com JSON:
{
  "titulo": "${titulo_relatorio || 'Relatório'}",
  "periodo": "${periodo || 'Mês/Ano'}",
  "autor": "${autor_relatorio || 'Nome do Autor'}",
  "departamento": "${departamento || 'Departamento'}",
  "resumo_executivo": "visão geral do relatório (100-150 palavras)",
  "introducao": "contextualização e objetivos",
  "metodologia": "como o relatório foi elaborado",
  "analise_dados": "análise detalhada com dados e métricas",
  "resultados": "principais descobertas",
  "conclusoes": "conclusões e recomendações",
  "proximos_passos": "ações sugeridas",
  "anexos": ["anexo1", "anexo2"]
}`;
    }

    _buildSimpleDocumentPrompt(data) {
        const { tipo_documento, titulo, conteudo_principal, remetente_simples, destinatario_simples, data_documento } = data;

        const tiposMap = {
            'oficio': 'Ofício (comunicação oficial)',
            'memorando': 'Memorando (comunicação interna)',
            'declaracao': 'Declaração Formal',
            'atestado': 'Atestado',
            'certidao': 'Certidão',
            'documento_simples': 'Documento Simples'
        };

        return `Crie um ${tiposMap[tipo_documento] || 'Documento Simples'}.

${titulo ? `TÍTULO: ${titulo}` : ''}
${conteudo_principal ? `CONTEÚDO PRINCIPAL: ${conteudo_principal}` : ''}
${remetente_simples ? `REMETENTE: ${remetente_simples}` : ''}
${destinatario_simples ? `DESTINATÁRIO: ${destinatario_simples}` : ''}
${data_documento ? `DATA: ${data_documento}` : ''}

Responda com JSON:
{
  "tipo": "${tiposMap[tipo_documento] || 'Documento'}",
  "titulo": "${titulo || 'Título do Documento'}",
  "data": "${data_documento || 'Data atual'}",
  "remetente": "${remetente_simples || 'Nome do Remetente'}",
  "destinatario": "${destinatario_simples || 'Nome do Destinatário'}",
  "corpo": "texto completo do documento com linguagem apropriada",
  "assinatura": "local para assinatura",
  "observacoes": "informações adicionais se necessário"
}`;
    }

    // ─── MÉTODOS DE CHAMADA DA API ───────────────────────────────────────────

    async _callGroq(prompt, data, tipo) {
        const { name, url, model } = PROVIDERS.groq;
        console.log(`📡 Gerando ${tipo} com ${name}...`);

        const response = await axios.post(url, {
            model,
            max_tokens: 4000,
            temperature: 0.7,
            messages: [
                { role: 'system', content: 'Você é um especialista em criação de documentos profissionais. Responda SOMENTE com JSON válido.' },
                { role: 'user', content: prompt }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
            timeout: 90000
        });

        const text = response.data.choices[0].message.content.trim();
        console.log(`✅ ${tipo} gerado com sucesso!`);
        return this._parseJSON(text, data, tipo);
    }

    async _callAnthropic(prompt, data, tipo) {
        const { name, url, model } = PROVIDERS.anthropic;
        console.log(`📡 Gerando ${tipo} com ${name}...`);

        const response = await axios.post(url, {
            model,
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'x-api-key': this.anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            timeout: 90000
        });

        const text = response.data.content[0].text.trim();
        console.log(`✅ ${tipo} gerado com sucesso!`);
        return this._parseJSON(text, data, tipo);
    }

    async _callDeepSeek(prompt, data, tipo) {
        const { name, url, model } = PROVIDERS.deepseek;
        console.log(`📡 Gerando ${tipo} com ${name}...`);

        const response = await axios.post(url, {
            model,
            max_tokens: 4000,
            temperature: 0.7,
            messages: [
                { role: 'system', content: 'Você é um especialista. Responda SOMENTE com JSON válido.' },
                { role: 'user', content: prompt }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${this.deepseekKey}`, 'Content-Type': 'application/json' },
            timeout: 90000
        });

        const text = response.data.choices[0].message.content.trim();
        console.log(`✅ ${tipo} gerado com sucesso!`);
        return this._parseJSON(text, data, tipo);
    }

    // ─── PARSE JSON ───────────────────────────────────────────────────────────

    _parseJSON(text, data, tipo) {
        const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        
        try {
            return JSON.parse(clean);
        } catch (_) {
            const match = clean.match(/\{[\s\S]*\}/);
            if (match) {
                try { return JSON.parse(match[0]); } catch (_) {}
            }
            console.error('⚠️  JSON inválido. Usando mock.');
            return this.generateMockDocument({ ...data, tipo });
        }
    }

    // ─── MOCK PARA CADA TIPO DE DOCUMENTO ─────────────────────────────────────

    generateMockDocument(data) {
        const { tipo } = data;
        
        switch(tipo) {
            case 'cv':
            case 'curriculo':
                return this._mockCV(data);
            case 'carta':
            case 'carta_profissional':
                return this._mockLetter(data);
            case 'relatorio':
                return this._mockReport(data);
            case 'documento_simples':
                return this._mockSimpleDocument(data);
            default:
                return this._mockAcademic(data);
        }
    }

    _mockAcademic(data) {
        return {
            titulo: `${data.tema || 'Tema'}: Análise Científica`,
            resumo: "Resumo acadêmico demonstrativo...",
            palavras_chave: ["pesquisa", "análise", "metodologia"],
            introducao: "Introdução do trabalho acadêmico...",
            fundamentacao: "Fundamentação teórica...",
            metodologia: "Metodologia aplicada...",
            analise: "Análise dos resultados...",
            conclusao: "Conclusões e recomendações...",
            referencias: ["Referência 1", "Referência 2"]
        };
    }

    _mockCV(data) {
        return {
            nome: data.nome || "Profissional Qualificado",
            cargo_desejado: data.cargo || "Cargo Específico",
            objetivo: "Profissional dedicado com experiência em...",
            experiencia: [{ periodo: "2020-2024", empresa: "Empresa Exemplo", cargo: "Cargo Exemplo", responsabilidades: ["Responsabilidade 1"] }],
            educacao: [{ curso: "Curso Superior", instituicao: "Universidade", ano: "2024" }],
            habilidades: ["Liderança", "Comunicação", "Gestão de Projetos"],
            idiomas: [{ idioma: "Português", nivel: "Nativo" }]
        };
    }

    _mockLetter(data) {
        return {
            remetente: data.remetente || "Remetente",
            destinatario: data.destinatario || "Destinatário",
            assunto: data.assunto || "Assunto da Carta",
            corpo: "Conteúdo da carta profissional...",
            saudacao: "Prezado(a),",
            fechamento: "Atenciosamente,"
        };
    }

    _mockReport(data) {
        return {
            titulo: data.titulo_relatorio || "Relatório de Atividades",
            resumo_executivo: "Resumo do relatório...",
            introducao: "Introdução...",
            analise_dados: "Análise...",
            conclusoes: "Conclusões..."
        };
    }

    _mockSimpleDocument(data) {
        return {
            tipo: data.tipo_documento || "Documento",
            titulo: data.titulo || "Documento Simples",
            corpo: "Conteúdo do documento..."
        };
    }
}

module.exports = { AcademicAIService };