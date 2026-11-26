import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const backend = readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8');

function runtime({ active = '', effective = '', properties = {}, book, cache } = {}) {
  const state = { ...properties };
  const logs = [];
  const context = vm.createContext({
    Date, Set, Map, JSON, Number, String, Boolean, RegExp, Error,
    console: {log: value => logs.push(String(value))},
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state[key] || null, setProperty: (key,value) => { state[key]=value; } }) },
    Session: { getActiveUser: () => ({getEmail: () => active}), getEffectiveUser: () => ({getEmail: () => effective}) },
    ContentService: { MimeType: {JSON:'json'}, createTextOutput: text => ({text,setMimeType(){return this;}}) },
    HtmlService: { createHtmlOutput: text => ({text}), createHtmlOutputFromFile: () => ({setTitle(){return this;}}) },
    SpreadsheetApp: { openById: () => book },
    CacheService: { getScriptCache: () => cache || ({get:()=>null,put(){}}) },
    DriveApp: { getFileById: () => ({getLastUpdated:()=>new Date('2026-01-02T12:00:00Z')}) },
    Utilities: { formatDate: (date,timeZone) => {
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
      return `${parts.year}-${parts.month}-${parts.day}`;
    } }
  });
  vm.runInContext(backend, context);
  return {context,state,logs};
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
    assert.throws(()=>context.verificarConexion(),/FORBIDDEN/);
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

test('doGet sin evento usa listado de ejercicios de forma segura',()=>{
  const {context}=runtime({properties:{PUBLIC_READ_ENABLED:'true'}});
  assert.deepEqual(JSON.parse(context.doGet().text),{years:[{year:2025,enabled:false},{year:2026,enabled:false}],defaultYear:2026});
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

function mockBook(source, rows, {displays,richLinks={},timeZone='UTC'} = {}) {
  const headers=Array(Math.max(...source.columns.map(c=>c.column||0))).fill('');
  source.columns.forEach(c=>{if(c.column!==null)headers[c.column-1]=c.sourceHeader;});
  const sheet={
    getSheetId:()=>0,getLastRow:()=>rows.length+1,
    getRange:(row,column,count,width)=> {
      if(typeof row==='string') return {getDisplayValue:()=> 'Honorarios 2026'};
      if(row===1) return {getDisplayValues:()=>[headers]};
      return {
        getValues:()=>rows,
        getDisplayValues:()=>displays||rows.map(row=>row.map(value=>value===null?'':String(value))),
        getRichTextValues:()=>rows.map((row,i)=>row.map((_,j)=>({getLinkUrl:()=>richLinks[`${i}:${j}`]||null})))
      };
    }
  };
  return {getName:()=> 'Fuente de prueba 2026',getSheets:()=>[sheet],getSpreadsheetTimeZone:()=>timeZone};
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

test('conserva texto numérico y folios nativos sin convertir ni rechazar filas',()=>{
  const source=configuredSource();
  for(const [index,value,expected] of [[6,'$1,234.56','$1,234.56'],[5,2.5,2.5],[10,Infinity,'Infinity']]) {
    const row=['ID','Órgano','Local',null,null,3,100,'OF','Recibido',null,50];row[index]=value;
    const {context}=runtime({book:mockBook(source,[row])});
    const result=context.data_(source,1);
    assert.equal(result.rows[0].values[index],expected);
    assert.equal(result.warnings.some(w=>w.columnIndex===index),typeof expected==='string');
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

test('serializador conserva respaldos visibles y fechas como el original',()=>{
  const {context}=runtime();
  const cases=[
    [null,'No inventar','text','UTC',null],
    [undefined,'No inventar','text','UTC',null],
    ['', 'No inventar','text','UTC',null],
    [7,'0007','text','UTC','0007'],
    [25,'OF-00025','text','UTC','OF-00025'],
    [true,'Sí','text','UTC','Sí'],
    [45000.99,'15/03/2023','date','America/Mexico_City','2023-03-15'],
    [0.99,'30/12/1899','date','Asia/Tokyo','1899-12-30'],
    [-1.2,'28/12/1899','date','UTC','1899-12-28'],
    [new Date('2026-01-02T02:30:00Z'),'02/01/2026','date','America/Mexico_City','2026-01-01'],
    [new Date('2026-01-02T02:30:00Z'),'02/01/2026','date','Asia/Tokyo','2026-01-02'],
    [new Date('invalid'),'Fecha pendiente','date','UTC','Fecha pendiente'],
    ['Por definir','PENDIENTE','date','UTC','PENDIENTE'],
    [1234.56,'$1,234.56','currency','UTC',1234.56],
    ['1234.56','$1,234.56','currency','UTC','$1,234.56'],
    [12,'00012','number','UTC',12],
    ['12','00012','number','UTC','00012']
  ];
  for(const [value,visible,type,zone,expected] of cases) assert.equal(context.serializeCell_(value,visible,type,zone),expected);
});

test('regla original2026 usa B visible e incluye totales cuando no hay exclusiones',()=>{
  const source=configuredSource();
  source.rowSelection={requiredColumn:2,excludeExact:[],excludeRows:[]};
  const base=['ID','Órgano','Local',null,null,3,100,'OF','Recibido',null,50];
  const rows=[base.slice(),base.slice(),base.slice(),base.slice()];
  rows[0][1]='Oculto por formato';rows[1][1]=0;rows[2][1]='TOTAL';rows[3][1]='   ';
  const displays=rows.map(row=>row.map(value=>value===null?'':String(value)));
  displays[0][1]='';displays[1][1]='Órgano visible';
  const {context}=runtime({book:mockBook(source,rows,{displays})});
  const result=context.readData_(source);
  assert.equal(result.rows.length,2);
  assert.equal(result.rows[0].values[1],'Órgano visible');
  assert.equal(result.rows[1].values[1],'TOTAL');
});

test('mapeo2026 conserva IDs/oficios, zona del libro, fechas y enlaces de procedencia',()=>{
  const source=configuredSource();
  const sourceColumns=[1,2,3,5,6,7,8,9,10,11,24];
  source.columns.forEach((column,index)=>column.column=sourceColumns[index]);
  source.rowSelection={requiredColumn:2,excludeExact:[],excludeRows:[]};
  const row=Array(24).fill('');
  const selected=[7,'Órgano sintético','Local',new Date('2026-01-02T02:30:00Z'),45000.9,4,1234.56,9,'Ordinario','Ver antecedente',321.09];
  sourceColumns.forEach((column,index)=>row[column-1]=selected[index]);
  const display=row.map(value=>String(value));display[0]='0007';display[8]='OF-00009';display[4]='02/01/2026';display[5]='15/03/2023';
  const url='https://example.invalid/antecedente';
  const {context}=runtime({book:mockBook(source,[row],{displays:[display],richLinks:{'0:10':url},timeZone:'America/Mexico_City'})});
  const result=context.readData_(source);
  assert.deepEqual(Array.from(result.rows[0].values),['0007','Órgano sintético','Local','2026-01-01','2023-03-15',4,1234.56,'OF-00009','Ordinario',url,321.09]);
  assert.equal(result.rows[0].display[3],'01/01/2026');
  assert.equal(result.rows[0].display[4],'15/03/2023');
  assert.equal(result.rows[0].display[9],url);
  assert.equal(result.timeZone,'America/Mexico_City');
  assert.equal(result.warnings.length,0);
});

test('enlace textual y texto de procedencia inerte conservan la representación original',()=>{
  const source=configuredSource();
  const row=['ID','Órgano','Local',null,null,1,100,'OF','Ingreso','https://example.invalid/origen',50];
  const displays=[row.map(value=>value===null?'':String(value))];
  const {context}=runtime({book:mockBook(source,[row],{displays})});
  assert.equal(context.readData_(source).rows[0].values[9],'https://example.invalid/origen');
  row[9]='Pendiente';displays[0][9]='Sin vínculo';
  const result=context.readData_(source);
  assert.equal(result.rows[0].values[9],'Sin vínculo');
  assert.equal(result.rows[0].display[9],'Sin vínculo');
});

test('verificarConexion lee fuente confirmada deshabilitada sin escribir, usar caché o exponer identificadores',()=>{
  const source=configuredSource();source.enabled=false;source.validated=false;
  const rows=[
    ['ID-privado','Órgano sintético','Local',null,null,3,100,'OF-privado','Ingreso',null,50],
    ['ID-otro','Otro órgano','Local',null,null,'4',25,'OF-otro','Ingreso',null,'16']
  ];
  const book=mockBook(source,rows,{timeZone:'America/Mexico_City'});
  book.getSheetByName=()=>({
    getLastRow:()=>1,
    getRange:()=>({getDisplayValues:()=>[['Fecha','Cuenta','Operacion','Revision','Estado','HashAnterior','HashNuevo']],setValue:()=>assert.fail('No debe escribir la bitácora')}),
    appendRow:()=>assert.fail('No debe agregar a la bitácora')
  });
  const config={revision:0,defaultYear:2026,years:[{year:2025,enabled:false,validated:false,rulesConfirmed:false},source]};
  const properties={PUBLIC_READ_ENABLED:'false',ADMIN_EMAILS_JSON:'["member@synthetic.invalid"]',AUDIT_SPREADSHEET_ID:'AUDIT_TEST_ONLY',HONORARIOS_CONFIG_JSON:JSON.stringify(config)};
  const {context,state,logs}=runtime({active:'member@synthetic.invalid',effective:'member@synthetic.invalid',properties,book,
    cache:{get:()=>assert.fail('No debe consultar caché'),put:()=>assert.fail('No debe guardar caché')}});
  const before=JSON.stringify(state);
  const summary=JSON.parse(JSON.stringify(context.verificarConexion()));
  assert.deepEqual(summary,[{year:2026,records:2,columns:11,timeZone:'America/Mexico_City',folios:3,cost:125,dictamen:50,missing:[]}]);
  assert.equal(JSON.stringify(state),before);
  assert.equal(logs.length,1);
  assert.deepEqual(JSON.parse(logs[0]),summary);
  for(const privateValue of ['SOURCE_TEST_ONLY','AUDIT_TEST_ONLY','member@synthetic.invalid','ID-privado','OF-privado','Órgano sintético']) assert.equal(logs[0].includes(privateValue),false);
});
