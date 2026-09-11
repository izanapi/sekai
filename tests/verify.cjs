
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8'),source=html.split('<script>')[1].split('</script>')[0];
function boot(storage=new Map()){
 const nodes=new Map(),element=()=>({innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){},scrollIntoView(){},click(){}});
 const c={console,Date,Math:Object.create(Math),Map,Set,JSON,Number,Object,Array,String,Boolean,Error,Infinity,Blob,URL,confirm:()=>true,setInterval:()=>0,setTimeout:()=>0,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},querySelectorAll:()=>[],addEventListener(){},createElement:element,hidden:false},window:{addEventListener(){}}};
 vm.createContext(c);vm.runInContext(source,c);return {run:s=>vm.runInContext(s,c),storage};
}
let passed=0;function check(name,fn){fn();passed++;console.log('PASS',name);}
let app=boot(),r=s=>app.run(s);
check('118 unique catalogue entries, 24 distinct machine pools',()=>{
 assert.equal(r('items.length'),118);assert.equal(r('new Set(items.map(x=>x.n)).size'),118);
 assert.equal(r('machines.length'),24);assert.equal(r('new Set(machines.map(x=>x.pool.slice().sort().join("|"))).size'),24);
 assert.equal(r('machines.every(m=>m.pool.length>0&&m.pool.every(n=>byName.has(n)))'),true);
 assert.equal(r('items.every(x=>machines.some(m=>m.pool.includes(x.n)))'),true);
 assert.equal(r('reports.every(r=>r.needs.every(n=>byName.has(n)))'),true);
});
check('initial funds and six available machines',()=>{
 assert.equal(r('S.money'),650);assert.equal(r('machines.filter(unlocked).length'),6);
 assert.equal(r('incomeRate()'),2);
});
check('probabilities normalized and boundaries stay in pool',()=>{
 assert.equal(r('machines.every(m=>Math.abs(odds(m).reduce((a,x)=>a+x.p,0)-1)<1e-10)'),true);
 for(const rand of [0,.1,.5,.999999999]){
  r('Math.random=()=>'+rand);
  assert.equal(r('machines.every(m=>m.pool.includes(pick(m).n))'),true);
 }
});
check('pending result cannot be overwritten; duplicate action rejected',()=>{
 r('Math.random=()=>0');assert.equal(r('pull("m0")'),true);
 const item=r('S.current.n'),funds=r('S.money');
 assert.equal(r('pull("m1")'),false);assert.equal(r('S.current.n'),item);assert.ok(Math.abs(r('S.money')-funds)<.01);
 assert.equal(r('operate("keep",S.current.n)'),true);
 assert.equal(r('operate("keep",'+JSON.stringify(item)+')'),false);
});
check('existing descriptions unchanged and all added items have use records',()=>{
 const crypto=require('crypto');
 assert.equal(crypto.createHash('sha256').update(r('JSON.stringify(items.slice(0,35))')).digest('hex'),'d3ae2c4b26a449969f88852b69fb4698efbfaa5413943b05941138be9fdaa2be');
 assert.equal(r('items.every(x=>x.d&&x.u&&Number.isFinite(x.x))'),true);
});
check('seven duplicate draws guarantee an unseen item',()=>{
 r('S=freshState();S.seen["石"]=1;S.streak.m0=7;Math.random=()=>0');
 assert.notEqual(r('pick(machines[0]).n'),'石');
});
check('first use grants research once, item consumed, return restores integrity',()=>{
 r('S=freshState();S.bag["雨"]=2;S.seen["雨"]=2');
 assert.equal(r('operate("use","雨",true)'),true);assert.equal(r('S.research'),4);
 r('operate("use","雨",true)');assert.equal(r('S.research'),4);assert.equal(r('S.bag["雨"]||0'),0);
 r('S.bag["石"]=1;operate("return","石",true)');assert.equal(r('S.research'),5);assert.equal(r('S.integrity'),100);
});
check('milestone rewards cannot be reclaimed and next goal advances',()=>{
 r('S=freshState();for(const x of items.slice(0,5))S.seen[x.n]=1;claim("discover")');
 assert.equal(r('milestone("discover").goal'),10);assert.equal(r('claim("discover")'),false);assert.equal(r('S.research'),2);
});
check('combination report preserves items and rewards once',()=>{
 r('S=freshState();for(const n of reports[0].needs){S.bag[n]=1;S.seen[n]=1;}');
 const before=r('incomeRate()');assert.equal(r('report("commute")'),true);
 assert.equal(r('reports[0].needs.every(n=>S.bag[n]===1)'),true);assert.ok(r('incomeRate()')>before);
 assert.equal(r('report("commute")'),false);assert.equal(r('S.research'),4);
});
check('real skills modify prices, income and cannot be bought twice',()=>{
 r('S=freshState();items.slice(0,50).forEach(x=>S.seen[x.n]=1);S.research=200;S.bag["石"]=1');
 const income=r('incomeRate()');
 assert.equal(r('buy("appraisal")'),true);assert.equal(r('sellPrice(items[0])'),21);assert.equal(r('buy("appraisal")'),false);
 r('buy("observation");buy("permit")');assert.ok(r('incomeRate()')>income);assert.equal(r('price(machines[0])'),85);
});
check('survey cooldown and always-available recovery funds',()=>{
 r('S=freshState();S.money=0;survey()');assert.equal(r('Math.floor(S.money)'),60);assert.equal(r('survey()'),false);
});
check('offline accrual caps at eight hours, cannot claim twice',()=>{
 r('S=freshState();S.lastAt=Date.now()-24*3600000;settle();');
 assert.ok(Math.abs(r('S.money')-1610)<.01);
 const money=r('S.money');r('settle()');assert.ok(Math.abs(r('S.money')-money)<.01);
});
check('save restores pending result, inventory, research and logs',()=>{
 r('S=freshState();S.bag["雨"]=1;S.research=7;pull("m0");save()');
 const saved=r('S.current.n'),next=boot(app.storage);
 assert.equal(next.run('S.current.n'),saved);assert.equal(next.run('S.bag["雨"]'),1);assert.equal(next.run('S.research'),7);
});
check('corrupt primary falls back to backup without erasing it',()=>{
 r('S=freshState();S.research=23;save();save()');
 app.storage.set('sekai-catalogue-v1','not JSON');
 const next=boot(app.storage);assert.equal(next.run('S.research'),23);
 assert.match(next.run('storageWarning'),/復旧/);
});
check('invalid import fails; unknown catalogue names ignored',()=>{
 assert.throws(()=>r('validate({version:1,money:-1})'));
 r('S=freshState();S.bag["不存在"]=1');
 assert.equal(r('Object.keys(validate(S).bag).length'),0);
});
check('all six views render without errors',()=>{
 r('S=freshState()');
 for(const view of ['gacha','inventory','catalogue','quests','skills','log'])r('switchView("'+view+'")');
});
check('long-run progression: highest district reachable, bounded logs, no negative money',()=>{
 r('S=freshState();globalThis.seed=12345;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};');
 for(let i=0;i<300;i++){
  r('S.lastAt-=30000;S.surveyAt=0;survey();for(const type of ["discover","use","pull"])while(claim(type)){}');
  r('{const eligible=machines.filter(m=>unlocked(m)&&price(m)<=S.money&&m.pool.some(n=>!S.seen[n]));if(eligible.length){const m=eligible[S.pulls%eligible.length];if(pull(m.id))operate("keep",S.current.n);}}');
 }
 console.log('PROGRESSION:',r('count()'),r('S.pulls'),r('Math.floor(S.money)'));
 assert.ok(r('count()')>=50,'50 discoveries reached');assert.equal(r('machines.every(unlocked)'),true);
 assert.ok(r('S.money')>=0);assert.ok(r('S.logs.length')<=100);
 console.log('SIMULATION:',r('count()'), 'discoveries,',r('S.pulls'),'pulls,',r('Math.floor(S.money)'),'yen');
});
console.log(passed+' checks passed.');
