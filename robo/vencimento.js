// Calcula o vencimento dos prazos que o robô lança sozinho, com o MESMO cálculo da tela (calc.js).
// Entrada (stdin): {"feriados": "...", "suspensoes": [...], "prazos": [{dataInicio, dias, contagem, justica, gatilho, tribunal, reuPreso}]}
// Saída (stdout): ["2026-12-03", ...]  ("" quando não dá para calcular)
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Date, Math, Set, Map, JSON, String, Number, Array };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'calc.js'), 'utf8'), ctx, { filename: 'calc.js' });
const ent = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
ctx.__ent = ent;
const saida = vm.runInContext(`setFeriadosLocais(__ent.feriados||'');setSuspensoes(__ent.suspensoes||[]);
  (__ent.prazos||[]).map(p=>{try{const r=calcPrazo(p);return r&&r.venc||'';}catch(e){return '';}})`, ctx);
process.stdout.write(JSON.stringify(saida));
