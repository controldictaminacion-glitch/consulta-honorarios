import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createExcel, createPdf } from '../js/exporters.js';

const columns = [
  ['ID', 'text'], ['Órgano', 'text'], ['Financiamiento', 'text'],
  ['Del', 'date'], ['Al', 'date'], ['Folios', 'number'],
  ['Costo total', 'currency'], ['Oficio', 'text'], ['Tipo de ingreso', 'text'],
  ['Procedencia', 'link'], ['Costo del dictamen', 'currency'],
].map(([title, type]) => ({ title, type }));

function context(year = 2025) {
  const values = ['001', '=HYPERLINK("https://example.org", "texto")', 'FISCALES',
    `${year}-01-01`, `${year}-12-29`, 12, 1234567.89, '00046', '+literal & <texto>',
    'https://example.org/documento?a=1&b=2', null];
  return {
    year, title: `Consulta de honorarios ${year}`, columns,
    rows: [{ values, display: values.map(v => String(v ?? '')) }],
    loadedAt: `${year}-11-26T12:00:00Z`, timeZone: 'America/Mexico_City',
    query: 'Financiamiento: FISCALES; desde: enero', matchMode: 'contains',
    scope: 'Resultados actuales',
  };
}

// Read real ZIP local records, rather than comparing an opaque snapshot.
async function unzipStored(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer()), files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const length = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const name = bytes.toString('utf8', offset + 30, offset + 30 + nameLength);
    files.set(name, bytes.toString('utf8', start, start + length));
    offset = start + length;
  }
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50, 'ZIP has central directory');
  return files;
}

test('XLSX preserves literal text, numeric amounts, date serials and external links', async () => {
  const ctx = context();
  const blob = createExcel(ctx);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const files = await unzipStored(blob), sheet = files.get('xl/worksheets/sheet1.xml');
  assert.match(sheet, /<c r="A2"[^>]*t="inlineStr"[^>]*>.*?<t[^>]*>001<\/t>/);
  assert.match(sheet, /=HYPERLINK\(&quot;https:\/\/example.org&quot;, &quot;texto&quot;\)/);
  assert.match(sheet, /00046/);
  assert.match(sheet, /\+literal &amp; &lt;texto&gt;/);
  assert.doesNotMatch(sheet, /<f(?:\s|>)/, 'spreadsheet text never becomes a formula');
  assert.match(sheet, /<c r="F2" s="2"><v>12<\/v><\/c>/);
  assert.match(sheet, /<c r="G2" s="3"><v>1234567\.89<\/v><\/c>/);
  assert.match(sheet, /<c r="D2" s="4"><v>45658<\/v><\/c>/);
  assert.match(sheet, /<c r="K2"[^>]*t="inlineStr"/, 'missing amount stays blank');
  assert.match(files.get('xl/worksheets/_rels/sheet1.xml.rels'), /Target="https:\/\/example.org\/documento\?a=1&amp;b=2" TargetMode="External"/);
  assert.match(files.get('docProps/core.xml'), /ejercicio: 2025/);
  assert.match(files.get('docProps/core.xml'), /Financiamiento: FISCALES/);
});

test('XLSX excludes executable and malformed hyperlinks', async () => {
  const ctx = context();
  ctx.rows[0].values[9] = 'javascript:alert(1)';
  const files = await unzipStored(createExcel(ctx));
  assert.equal(files.has('xl/worksheets/_rels/sheet1.xml.rels'), false);
  assert.match(files.get('xl/worksheets/sheet1.xml'), /javascript:alert\(1\)/);
});

function decodedPageText(page) {
  const contents = page.node.Contents();
  const streams = contents.asArray ? contents.asArray().map(ref => page.doc.context.lookup(ref)) : [contents];
  return streams.map(stream => {
    const bytes = stream.getContents();
    const source = Buffer.from(inflateSync(bytes)).toString('latin1');
    return [...source.matchAll(/<([A-Fa-f0-9]+)>\s*Tj/g)]
      .map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('\n');
  }).join('\n');
}

test('PDF generates real multipage output with repeated headers, links and the selected year', async () => {
  const ctx = context(2025);
  ctx.rows = Array.from({ length: 85 }, (_, index) => {
    const values = ctx.rows[0].values.slice();
    values[0] = String(index + 1); values[1] = 'Órgano de prueba ' + index;
    return { values, display: values.map(value => String(value ?? '')) };
  });
  const blob = await createPdf(ctx), bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/pdf');
  assert.equal(Buffer.from(bytes).toString('ascii', 0, 5), '%PDF-');
  const pdf = await globalThis.PDFLib.PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
  assert.equal(pdf.getTitle(), ctx.title);
  assert.match(pdf.getSubject(), /ejercicio: 2025/);
  for (const page of pdf.getPages()) {
    const content = decodedPageText(page);
    assert.match(content, /Concentrado de honorarios 2025/);
    assert.doesNotMatch(content, /honorarios 2026/);
    assert.match(content, /Financiamiento: FISCALES/);
    assert.match(content, /Costo del dictamen/);
    assert.ok(page.node.Annots()?.size() > 0, 'procedencia links remain clickable');
    assert.equal(page.getWidth(), 1190.55);
  }
});

test('PDF accepts an empty result and updates footer for another exercise', async () => {
  const ctx = context(2026); ctx.rows = [];
  const pdf = await globalThis.PDFLib.PDFDocument.load(await (await createPdf(ctx)).arrayBuffer());
  assert.equal(pdf.getPageCount(), 1);
  assert.match(decodedPageText(pdf.getPage(0)), /Concentrado de honorarios 2026/);
});
