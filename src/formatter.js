// src/formatter.js - VERSÃO ATUALIZADA (renomeie a classe para DocumentFormatter)
const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun,
    HeadingLevel, AlignmentType, PageBreak,
    Footer, PageNumber, NumberFormat
} = require('docx');

class DocumentFormatter {
    constructor() {
        this.outputDir = path.join(__dirname, '../output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generateDocument(content, data) {
        const { tipo } = data;
        
        switch(tipo) {
            case 'cv':
                return this._generateCV(content, data);
            case 'carta':
                return this._generateLetter(content, data);
            case 'relatorio':
                return this._generateReport(content, data);
            case 'documento_simples':
                return this._generateSimpleDocument(content, data);
            default:
                return this._generateAcademic(content, data);
        }
    }

    async _generateAcademic(content, data) {
        // Seu código existente do AcademicFormatter aqui
        const { titulo, autor, orientador, instituicao, curso, cidade, ano, tipo, formato } = data;
        
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        size: { width: 11906, height: 16838 },
                        margin: { top: 2268, right: 1701, bottom: 2268, left: 2835 }
                    }
                },
                children: [
                    this._capaAcademica(data, content),
                    this._quebraPagina(),
                    this._folhaRosto(data, content),
                    this._quebraPagina(),
                    this._corpoAcademico(content)
                ]
            }]
        });

        const outputPath = path.join(this.outputDir, `academico_${Date.now()}.docx`);
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }

    async _generateCV(content, data) {
        const doc = new Document({
            sections: [{
                properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
                children: [
                    this._titulo(content.nome, HeadingLevel.HEADING_1, { align: AlignmentType.CENTER }),
                    this._p(`🎯 ${content.cargo_desejado}`, { align: AlignmentType.CENTER, bold: true }),
                    this._p(content.objetivo, { italic: true }),
                    this._titulo('EXPERIÊNCIA PROFISSIONAL', HeadingLevel.HEADING_2),
                    ...content.experiencia.map(exp => [
                        this._p(`${exp.cargo} - ${exp.empresa} (${exp.periodo})`, { bold: true }),
                        ...exp.responsabilidades.map(resp => this._p(`• ${resp}`, { indent: 720 }))
                    ]).flat(),
                    this._titulo('FORMAÇÃO ACADÊMICA', HeadingLevel.HEADING_2),
                    ...content.educacao.map(edu => 
                        this._p(`${edu.curso} - ${edu.instituicao} (${edu.ano})`)
                    ),
                    this._titulo('HABILIDADES', HeadingLevel.HEADING_2),
                    this._p(content.habilidades.join(' • ')),
                    this._titulo('IDIOMAS', HeadingLevel.HEADING_2),
                    ...content.idiomas.map(idioma => 
                        this._p(`${idioma.idioma}: ${idioma.nivel}`)
                    )
                ]
            }]
        });

        const outputPath = path.join(this.outputDir, `cv_${Date.now()}.docx`);
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }

    async _generateLetter(content, data) {
        const doc = new Document({
            sections: [{
                properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
                children: [
                    this._p(content.remetente, { align: AlignmentType.RIGHT }),
                    this._p(content.data, { align: AlignmentType.RIGHT }),
                    this._vazio(1),
                    this._p(content.destinatario),
                    this._vazio(1),
                    this._p(content.saudacao),
                    this._vazio(1),
                    ...this._splitParagrafos(content.corpo).map(p => this._p(p)),
                    this._vazio(2),
                    this._p(content.fechamento, { align: AlignmentType.LEFT })
                ]
            }]
        });

        const outputPath = path.join(this.outputDir, `carta_${Date.now()}.docx`);
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }

    async _generateReport(content, data) {
        const doc = new Document({
            sections: [{
                children: [
                    this._titulo(content.titulo, HeadingLevel.HEADING_1, { align: AlignmentType.CENTER }),
                    this._p(`Período: ${content.periodo} | Autor: ${content.autor}`, { align: AlignmentType.CENTER }),
                    this._quebraPagina(),
                    this._titulo('RESUMO EXECUTIVO', HeadingLevel.HEADING_2),
                    this._p(content.resumo_executivo),
                    this._titulo('INTRODUÇÃO', HeadingLevel.HEADING_2),
                    this._p(content.introducao),
                    this._titulo('ANÁLISE DE DADOS', HeadingLevel.HEADING_2),
                    this._p(content.analise_dados),
                    this._titulo('CONCLUSÕES', HeadingLevel.HEADING_2),
                    this._p(content.conclusoes)
                ]
            }]
        });

        const outputPath = path.join(this.outputDir, `relatorio_${Date.now()}.docx`);
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }

    async _generateSimpleDocument(content, data) {
        const doc = new Document({
            sections: [{
                children: [
                    this._titulo(content.titulo, HeadingLevel.HEADING_1, { align: AlignmentType.CENTER }),
                    this._p(`Data: ${content.data}`, { align: AlignmentType.RIGHT }),
                    this._vazio(2),
                    this._p(`De: ${content.remetente}`),
                    this._p(`Para: ${content.destinatario}`),
                    this._vazio(2),
                    ...this._splitParagrafos(content.corpo).map(p => this._p(p)),
                    this._vazio(3),
                    this._p(content.assinatura, { align: AlignmentType.CENTER }),
                    this._p(content.observacoes || '', { italic: true, size: 20 })
                ]
            }]
        });

        const outputPath = path.join(this.outputDir, `documento_${Date.now()}.docx`);
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }

    // ─── HELPER METHODS ──────────────────────────────────────────────────────
    
    _p(text, opts = {}) {
        return new Paragraph({
            alignment: opts.align || AlignmentType.LEFT,
            spacing: { before: opts.before || 0, after: opts.after || 120, line: 360 },
            indent: opts.indent ? { left: opts.indent, firstLine: opts.indent } : undefined,
            children: [new TextRun({ text: text || '', size: opts.size || 24, bold: opts.bold || false, italics: opts.italic || false, font: 'Arial' })]
        });
    }

    _titulo(text, level, opts = {}) {
        return new Paragraph({
            heading: level,
            spacing: { before: opts.before || 360, after: opts.after || 240 },
            alignment: opts.align || AlignmentType.LEFT,
            children: [new TextRun({ text, bold: true, size: opts.size || 28, font: 'Arial' })]
        });
    }

    _vazio(n = 1) {
        return Array.from({ length: n }, () => new Paragraph({ children: [new TextRun('')] }));
    }

    _quebraPagina() {
        return new Paragraph({ children: [new PageBreak()] });
    }

    _capaAcademica(data, content) {
        return this._p(content.titulo, { align: AlignmentType.CENTER, bold: true, size: 32 });
    }

    _folhaRosto(data, content) {
        return this._p(content.titulo);
    }

    _corpoAcademico(content) {
        return [
            this._titulo('RESUMO', HeadingLevel.HEADING_1),
            this._p(content.resumo),
            this._titulo('INTRODUÇÃO', HeadingLevel.HEADING_1),
            ...this._splitParagrafos(content.introducao).map(p => this._p(p))
        ];
    }

    _splitParagrafos(texto) {
        return texto.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
    }
}

module.exports = { DocumentFormatter };