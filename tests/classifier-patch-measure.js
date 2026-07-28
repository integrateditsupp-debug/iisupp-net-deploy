'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const corpus=require('./scenario-corpus-10k');
const SRC=fs.readFileSync('./aria-classifier-mirror.js','utf8');

function build(src){
  const sandbox={module:{exports:{}},require,console};
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox);
  return sandbox.module.exports;
}
function run(m){
  const out=[];
  for(const it of corpus){
    const q=it.q,e=it.expect;let got,pass;
    if(e==='resolution'){got=m.looksLikeResolution(q)?'resolution':'NOT-resolution';pass=got==='resolution';}
    else if(e==='not-resolution'){got=m.looksLikeResolution(q)?'resolution':'NOT-resolution';pass=got==='NOT-resolution';}
    else if(e==='edge'){got=m.classify(q);pass=got==='default';}
    else if(e==='weather/news'){got=m.classify(q);pass=got==='weather'||got==='news';}
    else {got=m.classify(q);pass=got===e;}
    out.push(pass);
  }
  return out;
}
const base=run(build(SRC));
const bp=base.filter(Boolean).length;
console.log('BASELINE',bp,'/',corpus.length,((bp/corpus.length)*100).toFixed(2)+'%');

const patches=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const applied=[];
for(const p of patches){
  let src=SRC;let ok=true;
  for(const e of p.edits){
    if(!src.includes(e.find)){console.log('!! NO MATCH',p.id,e.find.slice(0,50));ok=false;break;}
    src=src.replace(e.find,e.replace);
  }
  if(!ok)continue;
  const r=run(build(src));
  let gain=0,reg=0;const gEx={},rEx={};
  for(let i=0;i<r.length;i++){
    if(r[i]&&!base[i]){gain++;const k=corpus[i].expect;gEx[k]=(gEx[k]||0)+1;}
    if(!r[i]&&base[i]){reg++;const k=corpus[i].expect;rEx[k]=(rEx[k]||0)+1;}
  }
  console.log(`${p.id}  net=${gain-reg}  gain=${gain}  reg=${reg}  gains=${JSON.stringify(gEx)}  regs=${JSON.stringify(rEx)}`);
  applied.push({p,src,gain,reg});
}
// combined: apply all patches with net>0 and reg==0 => SAFE set; and ALL => full set
function combo(list,label){
  let src=SRC;
  for(const a of list) for(const e of a.p.edits){ if(src.includes(e.find)) src=src.replace(e.find,e.replace); }
  const r=run(build(src));
  const pass=r.filter(Boolean).length;
  let gain=0,reg=0;const rEx={};
  for(let i=0;i<r.length;i++){if(r[i]&&!base[i])gain++;if(!r[i]&&base[i]){reg++;const k=corpus[i].expect;rEx[k]=(rEx[k]||0)+1;}}
  console.log(`\n${label}: ${pass}/${corpus.length} = ${((pass/corpus.length)*100).toFixed(2)}%  net=${gain-reg} gain=${gain} reg=${reg} regs=${JSON.stringify(rEx)}`);
}
combo(applied.filter(a=>a.reg===0&&a.gain>0),'ZERO-REGRESSION COMBINED');
combo(applied.filter(a=>a.gain-a.reg>0),'ALL-POSITIVE COMBINED');
