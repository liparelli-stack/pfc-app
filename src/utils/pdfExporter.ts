/*
-- ===================================================
-- Código             : /src/utils/pdfExporter.ts
-- Versão (.v20)      : 4.2.0
-- Data/Hora          : 2025-12-07 04:20 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo           : Relatório GERENCIAL com posição do Responsável logo
--                      abaixo do trade_name (fantasia).
-- Alteração (4.2.0)  : Incluído "Responsável: Nome" abaixo do trade_name.
-- Dependências       : jspdf
-- ===================================================
*/

import jsPDF from 'jspdf';
import { CompanyWithContacts } from '@/types/company';

/* -----------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')}`;
}

function sanitizeField(value: any, fallback: string = '-'): string {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  if (!str) return fallback;
  const lower = str.toLowerCase();
  if (['nan', 'null', 'undefined'].includes(lower)) return fallback;
  return str;
}

function translateKind(kind?: string | null): string {
  switch (kind) {
    case 'client': return 'Cliente';
    case 'lead': return 'Lead';
    case 'prospect': return 'Prospect';
    default: return '-';
  }
}

function translateStatus(status?: string | null): string {
  switch (status) {
    case 'active': return 'Ativo';
    case 'inactive': return 'Inativo';
    default: return '-';
  }
}

/* =====================================================
 * EXPORTADOR GERENCIAL PREMIUM
 * ===================================================== */
export const exportCompaniesToPDF = (companies: CompanyWithContacts[]) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  let y = 60;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  /* --------------------- Cabeçalho Geral --------------------- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(28, 76, 150);
  doc.text('Relação de Empresas - Gerencial', 40, y);
  y += 28;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, y);
  y += 40;

  /* ------------------------- LOOP --------------------------- */
  companies.forEach((c) => {
    if (y > 720) {
      doc.addPage();
      y = 60;
    }

    const tradeName = sanitizeField(c.trade_name);
    const legalName = sanitizeField(c.legal_name);
    const taxId = sanitizeField(c.tax_id);
    const ownerName = sanitizeField((c as any).owner_name);

    const emailEmpresa = sanitizeField(c.email);
    const phoneEmpresa = sanitizeField(c.phone);
    const website = sanitizeField(c.website);

    const segmento = sanitizeField((c as any).segment);
    const classificacao = sanitizeField((c as any).business_classification);
    const abc = sanitizeField((c as any).abc_analysis);
    const qualif = sanitizeField(c.qualification);

    const statusPT = translateStatus(c.status);
    const kindPT = translateKind(c.kind);

    const enderecoParts = [
      sanitizeField((c as any).address_line, ''),
      sanitizeField((c as any).neighborhood, ''),
      sanitizeField(c.city, ''),
      sanitizeField(c.state, ''),
      sanitizeField(c.zip_code, '')
    ].filter(Boolean);

    const enderecoCompleto = enderecoParts.length ? enderecoParts.join(', ') : '-';

    /* ---------------- Bloco Identificação ---------------- */
    doc.setDrawColor(28, 76, 150);
    doc.setLineWidth(1);
    doc.line(40, y, pageWidth - 40, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(28, 76, 150);
    doc.text(tradeName, 40, y);
    y += 18;

    /* **************** NOVO (4.2.0) — Responsável abaixo do trade_name ************** */
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
    doc.text(`Responsável: ${ownerName}`, 40, y);
    y += 20;
    /* ****************************************************************************** */

    doc.text(`Razão Social: ${legalName}`, 40, y);
    y += 16;

    doc.text(`CNPJ: ${taxId}`, 40, y);
    y += 16;

    doc.text(`Email: ${emailEmpresa}`, 40, y);
    y += 16;

    doc.text(`Telefone: ${phoneEmpresa}`, 40, y);
    y += 22;

    /* ---------------- Bloco Endereço ---------------- */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 76, 150);
    doc.text('Endereço', 40, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(enderecoCompleto, 40, y);
    y += 26;

    /* ---------------- Bloco Contatos ---------------- */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 76, 150);
    doc.text('Contatos', 40, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40);

    const contacts = c.contacts?.length ? c.contacts : [];
    if (contacts.length === 0) {
      doc.text('- Nenhum contato cadastrado', 50, y);
      y += 20;
    } else {
      contacts.forEach((ct) => {
        if (y > 740) {
          doc.addPage();
          y = 60;
        }

        const mail = sanitizeField(
          ct.channels?.find((ch) => ch.type === 'email')?.value,
          ''
        );
        const phone = sanitizeField(
          ct.channels?.find((ch) => ch.type === 'phone')?.value,
          ''
        );

        doc.text(`• ${sanitizeField(ct.full_name)}`, 50, y);
        y += 14;

        if (ct.position) {
          doc.text(`  Cargo: ${sanitizeField(ct.position)}`, 60, y);
          y += 14;
        }

        if (mail) {
          doc.text(`  Email: ${mail}`, 60, y);
          y += 14;
        }

        if (phone) {
          doc.text(`  Telefone: ${phone}`, 60, y);
          y += 14;
        }

        y += 8;
      });
    }

    /* ---------------- Bloco Estratégico ---------------- */
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 76, 150);
    doc.text('Dados Estratégicos', 40, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40);

    const dados = [
      `Tipo: ${kindPT}`,
      `Segmento: ${segmento}`,
      `Classificação: ${classificacao}`,
      `ABC: ${abc}`,
      `Situação: ${statusPT}`,
      `Qualificação: ${qualif}`,
      `Website: ${website}`
    ];

    dados.forEach((linha) => {
      doc.text(linha, 40, y);
      y += 16;
      if (y > 760) {
        doc.addPage();
        y = 60;
      }
    });

    /* ---------------- Bloco Datas ---------------- */
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 76, 150);
    doc.text('Datas', 40, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40);

    doc.text(`Criado em: ${formatDate(c.created_at)}`, 40, y);
    y += 16;

    doc.text(`Atualizado em: ${formatDate(c.updated_at)}`, 40, y);
    y += 28;

    /* ---------------- Separador ---------------- */
    doc.setDrawColor(210);
    doc.setLineWidth(0.7);
    doc.line(40, y, pageWidth - 40, y);
    y += 30;
  });

  /* ---------------- Rodapé com Página x/n ---------------- */
  const totalPages = (doc as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    (doc as any).setPage(i);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Página ${i} / ${totalPages}`, pageWidth - 80, pageHeight - 20);
  }

  const fileName = `Relacao_Empresas_Gerencial_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};
