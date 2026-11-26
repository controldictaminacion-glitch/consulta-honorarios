import '../vendor/pdf-lib.min.js';

/* Exportación sin llamadas a servicios externos. PDF-lib se incluye en el proyecto. */
  'use strict';
  const Exportadores = (() => {
    const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const encoder = new TextEncoder();
    const concat = arrays => { const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0)); let at = 0; for (const a of arrays) { out.set(a, at); at += a.length; } return out; };
    const u16 = value => new Uint8Array([value & 255, (value >>> 8) & 255]);
    const u32 = value => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
    const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++)n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
    const crc32 = bytes => { let crc = 0xffffffff; for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
    function zip(files) {
      const local = [], central = []; let offset = 0;
      for (const [name, text] of Object.entries(files)) {
        const filename = encoder.encode(name), data = encoder.encode(text), crc = crc32(data);
        const header = concat([u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(filename.length), u16(0), filename]);
        local.push(header, data);
        central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(filename.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), filename]));
        offset += header.length + data.length;
      }
      const directory = concat(central), count = central.length;
      return concat([...local, directory, u32(0x06054b50), u16(0), u16(0), u16(count), u16(count), u32(directory.length), u32(offset), u16(0)]);
    }
    function safeUrl(value) { try { const u = new URL(String(value)); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch (e) { return null; } }
    function crearExcel(ctx) {
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
      const textCell = (ref, value, style = 0) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      const linkRefs = [], rows = [`<row r="1" ht="46" customHeight="1">${ctx.columns.map((c, i) => textCell(String.fromCharCode(65 + i) + '1', c.title, 1)).join('')}</row>`];
      ctx.rows.forEach((row, index) => {
        const r = index + 2; const chars = [11, 50, 20, 12, 12, 10, 20, 15, 23, 60, 22]; const lines = Math.max(...row.values.map((v, i) => Math.max(1, ...String(v ?? '').split('\n').map(t => Math.ceil(t.length / chars[i]))))); const height = Math.min(409, Math.max(44, lines * 15 + 10)); rows.push(`<row r="${r}" ht="${height}" customHeight="1">` + ctx.columns.map((col, i) => {
          const ref = String.fromCharCode(65 + i) + r, value = row.values[i];
          if (value === null || value === '') return textCell(ref, '');
          if (col.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) { const serial = (Date.parse(value + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000; return `<c r="${ref}" s="4"><v>${serial}</v></c>`; }
          if ((col.type === 'number' || col.type === 'currency') && typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${col.type === 'currency' ? 3 : 2}"><v>${value}</v></c>`;
          if (col.type === 'link' && safeUrl(value)) linkRefs.push({ ref, url: safeUrl(value) });
          return textCell(ref, String(value)); // Texto literal: los signos =, +, - o @ nunca se ejecutan como fórmula.
        }).join('') + '</row>');
      });
      const widths = [13, 56, 22, 14, 14, 12, 22, 17, 25, 65, 24];
      const links = linkRefs.length ? `<hyperlinks>${linkRefs.map((l, i) => `<hyperlink ref="${l.ref}" r:id="rId${i + 1}"/>`).join('')}</hyperlinks>` : '';
      const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF253142"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF9F2241"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
      const files = {
        '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
        '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
        'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(ctx.title)}</dc:title><dc:creator>Consulta de honorarios</dc:creator><dc:description>${xml(ctx.scope + '; ejercicio: ' + ctx.year + '; filtros: ' + (ctx.query || 'Sin filtro') + '; información consultada: ' + ctx.loadedAt)}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
        'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets><sheet name="Concentrado" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
        'xl/styles.xml': styles,
        'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}" xmlns:r="${rel}"><dimension ref="A1:K${ctx.rows.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="44"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:K${ctx.rows.length + 1}"/>${links}<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape"/></worksheet>`
      };
      if (linkRefs.length) files['xl/worksheets/_rels/sheet1.xml.rels'] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${linkRefs.map((l, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/hyperlink" Target="${xml(l.url)}" TargetMode="External"/>`).join('')}</Relationships>`;
      return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    async function crearPdf(ctx) {
      const PDFLib = globalThis.PDFLib;
      if (!PDFLib) throw new Error('No se cargó la biblioteca PDF local.');
      const { PDFDocument, StandardFonts, rgb, PDFName, PDFString } = PDFLib;
      const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      pdf.setTitle(ctx.title); pdf.setAuthor('Consulta de honorarios'); pdf.setSubject(ctx.scope + '; ejercicio: ' + ctx.year + '; ' + (ctx.query || 'Sin filtro')); pdf.setCreationDate(new Date());
      const W = 1190.55, H = 841.89, M = 32, bottom = 43, ink = rgb(.15, .19, .25), muted = rgb(.36, .41, .48), wine = rgb(.624, .133, .255), line = rgb(.86, .88, .91);
      const widths = [80, 215, 82, 68, 68, 50, 105, 72, 85, 167, 105], factor = (W - 2 * M) / widths.reduce((a, b) => a + b, 0), ws = widths.map(w => w * factor), bodySize = 8.7, leading = 11.5, padding = 7;
      function clean(text, face = font) { return [...String(text ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ')].map(c => { if (c === '\n') return c; try { face.encodeText(c); return c; } catch (e) { return '?'; } }).join(''); }
      function wrap(text, width, size, face = font) { const lines = []; for (const paragraph of clean(text, face).split('\n')) { let current = ''; for (const word of paragraph.split(/\s+/).filter(Boolean)) { const candidate = current ? current + ' ' + word : word; if (face.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; } if (current) { lines.push(current); current = ''; } let chunk = ''; for (const char of word) { if (chunk && face.widthOfTextAtSize(chunk + char, size) > width) { lines.push(chunk); chunk = char; } else chunk += char; } current = chunk; } lines.push(current); } return lines.length ? lines : ['']; }
      function text(page, value, x, y, size = bodySize, face = font, color = ink) { page.drawText(clean(value, face), { x, y, size, font: face, color }); }
      const queryText = ctx.query ? 'Filtros: ' + ctx.query : 'Filtros: sin filtro';
      const queryLines = wrap(queryText, W - 2 * M, 9), headLines = ctx.columns.map((c, i) => wrap(c.title, ws[i] - 2 * padding, 8, bold)), headHeight = Math.max(...headLines.map(a => a.length)) * 10 + 16;
      const stamp = new Date(ctx.loadedAt).toLocaleString('es-MX', { timeZone: ctx.timeZone || 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' });
      let page, y;
      function newPage() { page = pdf.addPage([W, H]); page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: wine }); text(page, ctx.title, M, H - 42, 20, bold, wine); text(page, ctx.scope + ' · ' + ctx.rows.length + ' registros · Importes en MXN', M, H - 62, 10); text(page, 'Información consultada: ' + stamp, M, H - 79, 9, font, muted); queryLines.forEach((s, i) => text(page, s, M, H - 96 - i * 12, 9, font, muted)); const top = H - 109 - (queryLines.length - 1) * 12; page.drawRectangle({ x: M, y: top - headHeight, width: W - 2 * M, height: headHeight, color: rgb(.94, .95, .97) }); let x = M; headLines.forEach((lines, i) => { lines.forEach((s, j) => text(page, s, x + padding, top - 14 - j * 10, 8, bold)); x += ws[i]; }); y = top - headHeight; }
      const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
      function value(row, i) { const v = row.values[i], type = ctx.columns[i].type; if (v === null || v === '') return ''; if (type === 'currency' && typeof v === 'number') return money.format(v); if (type === 'number' && typeof v === 'number') return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(v); return row.display[i] || String(v); }
      function link(page, url, x, base, width, height) { const annot = pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, base, x + width, base + height], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } })); const key = PDFName.of('Annots'); const existing = page.node.lookup(key); if (existing) existing.push(annot); else page.node.set(key, pdf.context.obj([annot])); }
      newPage();
      ctx.rows.forEach((row, index) => {
        const cells = ctx.columns.map((col, i) => wrap(value(row, i), ws[i] - 2 * padding, bodySize)); let remaining = Math.max(...cells.map(a => a.length)), offset = 0;
        const fullHeight = remaining * leading + 2 * padding;
        // Mantiene una fila unida siempre que quepa en una página nueva.
        if (fullHeight <= H - 180 && y - fullHeight < bottom) newPage();
        while (remaining > 0) {
          let capacity = Math.floor((y - bottom - 2 * padding) / leading); if (capacity < 1) { newPage(); capacity = Math.floor((y - bottom - 2 * padding) / leading); } const take = Math.min(capacity, remaining), height = take * leading + 2 * padding, base = y - height;
          if (index % 2 === 1) page.drawRectangle({ x: M, y: base, width: W - 2 * M, height, color: rgb(.975, .978, .984) });
          let x = M; cells.forEach((lines, i) => { const type = ctx.columns[i].type, url = type === 'link' ? safeUrl(row.values[i]) : null; lines.slice(offset, offset + take).forEach((s, j) => { const right = (type === 'currency' || type === 'number') ? ws[i] - padding - font.widthOfTextAtSize(clean(s), bodySize) : padding; text(page, s, x + right, y - padding - bodySize - j * leading, bodySize, font, url ? wine : ink); }); if (url && offset < lines.length) link(page, url, x, base, ws[i], height); x += ws[i]; });
          page.drawLine({ start: { x: M, y: base }, end: { x: W - M, y: base }, thickness: .4, color: line }); y = base; remaining -= take; offset += take; if (remaining > 0) newPage();
        }
      });
      pdf.getPages().forEach((p, i) => { p.drawLine({ start: { x: M, y: 29 }, end: { x: W - M, y: 29 }, thickness: .4, color: line }); text(p, 'Concentrado de honorarios ' + ctx.year + ' · ' + ctx.scope, M, 17, 8, font, muted); const label = 'Página ' + (i + 1) + ' de ' + pdf.getPageCount(); text(p, label, W - M - font.widthOfTextAtSize(label, 8), 17, 8, font, muted); });
      return new Blob([await pdf.save()], { type: 'application/pdf' });
    }
    function descargar(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    return { crearExcel, crearPdf, descargar };
  })();

export const createExcel = Exportadores.crearExcel;
export const createPdf = Exportadores.crearPdf;
export const downloadBlob = Exportadores.descargar;
