import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const backend = readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8');

function runtime({ active = '', effective = '', properties = {}, book, cache } = {}) {
  const state = { ...properties };
  const context = vm.createContext({
    Date, Set, Map, JSON, Number, String, Boolean, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state[key] || null, setProperty: (key,value) => { state[key]=value; } }) },
    Session: { getActiveUser: () => ({getEmail: () => active}), getEffectiveUser: () => ({getEmail: () => effective}) },
    ContentService: { MimeType: {JSON:'json'}, createTextOutput: text => ({text,setMimeType(){return this;}}) },
    HtmlService: { createHtmlOutput: text => ({text}), createHtmlOutputFromFile: () => ({setTitle(){return this;}}) },
    SpreadsheetApp: { openById: () => book },
    CacheService: { getScriptCache: () => cache || ({get:()=>null,put(){}}) },
    DriveApp: { getFileById: () => ({getLastUpdated:()=>new Date('2026-01-02T12:00:00Z')}) },
    Utilities: { formatDate: date => date.toISOString().slice(0,10) }
  });
  vm.runInContext(backend, context);
  return {context,state};
}

function configuredSource() {
  const types=['text','text','text','date','date','number','currency','text','text','link','currency'];
  return {
    year:2026,spreadsheetId:'SOURCE_TEST_ONLY',sheetId:0,enabled:true,validated:true,
    headerRow:1,startRow:2,yearEvidenceCell:'A1',rulesConfirmed:true,
    reconciliationNote:'Conciliación sintética de prueba completada.',
    columns:types.map((type,index)=>({title:'Columna '+index,type,column:index+1,sourceHeader:'Cabecera '+index})),
    rowSelection:{requiredColumn:2,excludeExact:['TOTAL'],excludeRows:[]}
  };
}

test('administración falla cerrada sin identidad, con identidad distinta o fuera de lista',()=>{
  for(const [active,effective] of [['','owner@synthetic.invalid'],['other@synthetic.invalid','owner@synthetic.invalid'],['outside@synthetic.invalid','outside@synthetic.invalid']]) {
    const {context}=runtime({active,effective,properties:{ADMIN_EMAILS_JSON:'["owner@synthetic.invalid"]'}});
    assert.throws(()=>context.adminGetConfig(),/FORBIDDEN/);
    assert.throws(()=>context.adminGetAudit(),/FORBIDDEN/);
    assert.throws(()=>context.adminValidateSource({}),/FORBIDDEN/);
    assert.throws(()=>context.adminSaveConfig({},0),/FORBIDDEN/);
  }
});

test('administración solo acepta identidad del usuario efectivo autorizada',()=>{
  const {context}=runtime({active:'member@synthetic.invalid',effective:'member@synthetic.invalid',properties:{ADMIN_EMAILS_JSON:'["member@synthetic.invalid"]'}});
  assert.equal(context.adminGetConfig().revision,0);
  assert.deepEqual(Array.from(context.adminGetConfig().years,s=>s.year),[2025,2026]);
});

test('lectura pública deshabilitada por defecto y error sanitizado',()=>{
  const {context}=runtime();
  assert.deepEqual(JSON.parse(context.doGet({parameter:{action:'data',year:'2026'}}).text),{
    error:{code:'READ_DISABLED',message:'La fuente no está disponible o requiere validación administrativa.'}
  });
});

test('una fuente no validada nunca se entrega aunque esté habilitada',()=>{
  const {context}=runtime({properties:{PUBLIC_READ_ENABLED:'true',HONORARIOS_CONFIG_JSON:JSON.stringify({revision:1,defaultYear:2026,years:[{year:2026,enabled:true,validated:false}]})}});
  assert.equal(JSON.parse(context.doGet({parameter:{action:'data',year:'2026'}}).text).error.code,'SOURCE_UNAVAILABLE');
});

test('solo acepta URLs de Google Sheets sin hosts o esquemas alternativos',()=>{
  const {context}=runtime();
  for(const sourceUrl of ['javascript:alert(1)','https://docs.google.com.evil.invalid/spreadsheets/d/SOURCE_TEST_ONLY/edit?gid=0','https://user@docs.google.com/spreadsheets/d/SOURCE_TEST_ONLY/edit?gid=0','https://docs.google.com/spreadsheets/d/SOURCE_TEST_ONLY/edit']) {
    assert.throws(()=>context.normalizeSource_({year:2026,enabled:true,sourceUrl}),/BAD_CONFIG/);
  }
  const parsed=context.normalizeSource_({year:2026,enabled:false,sourceUrl:'https://docs.google.com/spreadsheets/d/SOURCE_TEST_ONLY/edit?gid=42#gid=42'});
  assert.equal(parsed.sheetId,42);
});

function mockBook(source, rows) {
  const headers=source.columns.map(c=>c.sourceHeader);
  const sheet={
    getSheetId:()=>0,getLastRow:()=>rows.length+1,
    getRange:(row,column,count,width)=> {
      if(typeof row==='string') return {getDisplayValue:()=> 'Honorarios 2026'};
      if(row===1) return {getDisplayValues:()=>[headers]};
      return {
        getValues:()=>rows,
        getDisplayValues:()=>rows.map(row=>row.map(value=>value===null?'':String(value))),
        getRichTextValues:()=>rows.map(row=>row.map(()=>({getLinkUrl:()=>null})))
      };
    }
  };
  return {getName:()=> 'Fuente de prueba 2026',getSheets:()=>[sheet]};
}

test('extrae cifras nativas, conserva folios y excluye totales con regla explícita',()=>{
  const source=configuredSource();
  const row=['ID-0001','Órgano de prueba','Local',new Date('2026-01-01'),new Date('2026-12-31'),3,1234.56,'OF-001','Recibido','https://example.invalid/oficio',789.12];
  const total=[...row];total[1]='TOTAL';
  const {context}=runtime({book:mockBook(source,[row,total])});
  const data=context.data_(source,1);
  assert.equal(data.rows.length,1);
  assert.equal(data.rows[0].values[0],'ID-0001');
  assert.equal(data.rows[0].values[5],3);
  assert.equal(data.rows[0].values[6],1234.56);
  assert.equal(data.rows[0].values[10],789.12);
  assert.equal(data.rows[0].values[3],'2026-01-01');
  assert.equal(data.sourceUpdatedAt,'2026-01-02T12:00:00.000Z');
  assert.equal(JSON.stringify(data).includes(source.spreadsheetId),false);
});

test('no convierte importes en texto ni folios fraccionarios silenciosamente',()=>{
  const source=configuredSource();
  for(const [index,value] of [[6,'$1,234.56'],[5,2.5],[10,Infinity]]) {
    const row=['ID','Órgano','Local',null,null,3,100,'OF','Recibido',null,50];row[index]=value;
    const {context}=runtime({book:mockBook(source,[row])});
    assert.throws(()=>context.data_(source,1),/SCHEMA_MISMATCH/);
  }
});

test('encabezados cambiados y conciliación no confirmada bloquean la fuente',()=>{
  const source=configuredSource();
  const book=mockBook(source,[]);
  const {context}=runtime({book});
  source.rulesConfirmed=false;
  assert.throws(()=>context.validateSource_(source),/RECONCILIATION_REQUIRED/);
  source.rulesConfirmed=true;
  source.columns[0].sourceHeader='';
  assert.throws(()=>context.validateSource_(source),/BAD_CONFIG/);
});

test('campos no identificados permanecen null y se declaran no disponibles',()=>{
  const source=configuredSource();
  source.columns[8].column=null;source.columns[8].sourceHeader='';
  source.columns[10].column=null;source.columns[10].sourceHeader='';
  const row=['ID','Órgano','Local',null,null,3,100,'OF','VALOR NO UTILIZADO',null,99999];
  const {context}=runtime({book:mockBook(source,[row])});
  const result=context.readData_(source);
  assert.equal(result.rows[0].values[8],null);
  assert.equal(result.rows[0].values[10],null);
  assert.equal(result.rows[0].display[10],'');
  assert.deepEqual(Array.from(result.unavailableColumns),[8,10]);
  source.columns[1].column=null;source.columns[1].sourceHeader='';
  assert.throws(()=>context.validateSource_(source),/BAD_CONFIG/);
});

test('actualizar omite caché del servidor y vuelve a leer la fuente',()=>{
  const source=configuredSource();
  let cacheReads=0,cacheWrites=0;
  const cache={get:()=>{cacheReads++;return JSON.stringify({cached:true});},put:()=>{cacheWrites++;}};
  const {context}=runtime({book:mockBook(source,[]),cache});
  assert.equal(context.data_(source,1).cached,true);
  assert.equal(cacheReads,1);
  const fresh=context.data_(source,1,true);
  assert.equal(fresh.year,2026);
  assert.equal(cacheReads,1);
  assert.equal(cacheWrites,1);
});

test('evidencia anual contradictoria bloquea la fuente',()=>{
  const source=configuredSource();
  const book=mockBook(source,[]);book.getName=()=> 'Honorarios 2025';
  const {context}=runtime({book});
  assert.throws(()=>context.validateSource_(source),/YEAR_MISMATCH/);
});

test('bitácora requiere sus siete encabezados antes de aceptar cambios',()=>{
  const sheet={getLastRow:()=>1,getRange:()=>({getDisplayValues:()=>[['Cabecera incorrecta']]})};
  const book={getSheetByName:()=>sheet};
  const {context}=runtime({book,properties:{AUDIT_SPREADSHEET_ID:'AUDIT_TEST_ONLY'}});
  assert.throws(()=>context.auditSheet_(),/AUDIT_REQUIRED/);
});
