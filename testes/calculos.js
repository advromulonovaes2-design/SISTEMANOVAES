// Testes dos cálculos que não podem errar: prazos e Pix. Roda com: node testes/calculos.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = path.join(__dirname, '..');
const ctx = { console, TextEncoder, Date, Math, Set, Map, S: { config: {} }, NOME_PADRAO: 'Palha Novaes Advocacia', document: { addEventListener() {} } };
vm.createContext(ctx);
for (const f of ['calc.js', 'extras.js']) vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
let falhas = 0;
const confere = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  console.log(`${ok ? 'OK ' : 'ERRO'} ${nome}${ok ? '' : ` — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
  if (!ok) falhas++;
};
const venc = p => { const r = vm.runInContext(`calcPrazo(${JSON.stringify(p)})`, ctx); return r && r.venc; };
const base = { gatilho: 'djen', contagem: 'uteis', justica: 'estadual' };
vm.runInContext('setSuspensoes([])', ctx);
confere('5 dias úteis, DJEN em 05/11/2026', venc({ ...base, dataInicio: '2026-11-05', dias: 5 }), '2026-11-13');
const semSusp = venc({ ...base, dataInicio: '2026-11-05', dias: 5 });
vm.runInContext(`setSuspensoes([{tribunal:'TJPA',inicio:'2026-11-09',fim:'2026-11-10'}])`, ctx);
const comSusp = venc({ ...base, dataInicio: '2026-11-05', dias: 5, tribunal: 'TJPA' });
confere('suspensão do TJPA empurra o vencimento', comSusp > semSusp, true);
confere('suspensão de outro tribunal não muda', venc({ ...base, dataInicio: '2026-11-05', dias: 5, tribunal: 'TRF1' }), semSusp);
vm.runInContext('setSuspensoes([])', ctx);
confere('vencimento nunca cai em sábado ou domingo', [0, 6].includes(new Date(venc({ ...base, dataInicio: '2026-11-13', dias: 1 }) + 'T12:00:00Z').getUTCDay()), false);
confere('não vence no Natal (recesso)', venc({ ...base, dataInicio: '2026-12-15', dias: 5 }) >= '2027-01-21', true);
const cpp = { gatilho: 'ciencia', contagem: 'corridos', justica: 'estadual', dataInicio: '2026-12-22', dias: 5 };
confere('réu preso: a suspensão de janeiro não vale (CPP 798-A)', venc({ ...cpp, reuPreso: true }) < venc({ ...cpp, reuPreso: false }), true);
confere('réu preso: ciência em 22/12, 5 dias corridos', venc({ ...cpp, reuPreso: true }), '2027-01-11');
confere('sem réu preso: espera o fim da suspensão (20/01)', venc({ ...cpp, reuPreso: false }), '2027-01-25');
confere('Pix: exemplo oficial do Banco Central',
  vm.runInContext(`pixPayload({chave:'123e4567-e12b-12d1-a456-426655440000',nome:'Fulano de Tal',cidade:'BRASILIA',txid:'***'})`, ctx),
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');
confere('Pix: telefone vira +55', vm.runInContext(`normChavePix('(91) 98888-7777')`, ctx), '+5591988887777');
confere('prazo sugerido pelo texto', vm.runInContext(`sugerirDias('no prazo de 15 (quinze) dias, sob pena').dias`, ctx), 15);
// robô: o vencimento que ele calcula sozinho tem que ser igual ao da tela, e a leitura automática das intimações
const { execFileSync } = require('child_process');
const vRobo = JSON.parse(execFileSync('node', [path.join(raiz, 'robo', 'vencimento.js')],
  { input: JSON.stringify({ prazos: [{ ...base, dataInicio: '2026-11-10', dias: 15 }] }) }).toString());
confere('robô: vencimento igual ao da tela (15 dias úteis, DJEN 10/11/2026)', vRobo, ['2026-12-03']);
try { console.log(execFileSync('python3', [path.join(raiz, 'robo', 'teste_automatico.py')]).toString()); }
catch (e) { console.log(String(e.stdout || e.message)); confere('robô: leitura automática de audiências e prazos', 'falhou', 'ok'); }
if (falhas) { console.error(`\n${falhas} teste(s) falharam.`); process.exit(1); }
console.log('\nTodos os cálculos conferem.');
