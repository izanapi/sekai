
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8'),source=html.split('<script>')[1].split('</script>')[0];
function boot(storage=new Map()){
 const nodes=new Map(),element=()=>({innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},scrollIntoView(){},click(){}});
 const c={console,Date,Math:Object.create(Math),Map,Set,JSON,Number,Object,Array,String,Boolean,Error,Infinity,Blob,URL,confirm:()=>true,setInterval:()=>0,setTimeout:()=>0,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},querySelectorAll:()=>[],addEventListener(){},createElement:element,hidden:false},window:{addEventListener(){}}};
 vm.createContext(c);vm.runInContext(source,c);return {run:s=>vm.runInContext(s,c),storage,nodes};
}
let passed=0;function check(name,fn){fn();passed++;console.log('PASS',name);}
let app=boot(),r=s=>app.run(s);
check('1000 unique catalogue entries, 24 distinct machine pools',()=>{
 assert.equal(r('items.length'),1000);assert.equal(r('new Set(items.map(x=>x.n)).size'),1000);
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

check('all 118 previous records retain their complete identity and text',()=>{
 const crypto=require('crypto');
 assert.equal(crypto.createHash('sha256').update(r('JSON.stringify(items.slice(0,118))')).digest('hex'),'e3b0464a508f3e2c3aefeab0f190d452779647fb591aac5db7996949cb09f56d');
 assert.equal(r('new Set(items.map(x=>x.d)).size'),1000);
 assert.equal(r('items.slice(118).every(x=>x.n.length<=12&&!/[0-9０-９]/.test(x.n)&&x.d.length>=20&&x.u.length>=10)'),true);
});
check('every item has nonzero ordinary probability on at least one machine',()=>{
 assert.equal(r('items.every(x=>machines.some(m=>m.pool.includes(x.n)&&odds(m).some(o=>o.r===x.r&&o.p>0)))'),true);
 assert.equal(r('machines.every(m=>m.pool.length===new Set(m.pool).size)'),true);
 assert.equal(r('machines.every(m=>m.pool.length>=40&&m.pool.length<=50)'),true);
});
check('catalogue pagination caps rendering at 40 and covers all 1000 entries',()=>{
 r('S=freshState();query="";catalogueFilter="all";catalogueMachine="all";');
 let seen=[];
 for(let i=0;i<25;i++){
  seen.push(...JSON.parse(r('JSON.stringify(pageWindow(items,'+i+').entries.map(x=>x.n))')));
  r('setPage("catalogue",'+i+')');
  assert.equal((app.nodes.get('catalogueList').innerHTML.match(/class="row/g)||[]).length,40);
 }
 assert.equal(seen.length,1000);assert.equal(new Set(seen).size,1000);
 r('setPage("catalogue",999)');assert.equal(r('cataloguePage'),24);
 r('setPage("catalogue",-1)');assert.equal(r('cataloguePage'),0);
});
check('catalogue filters reset pagination, isolate machine and show empty state',()=>{
 r('setPage("catalogue",24)');
 app.nodes.get('catalogueMachine').listeners.change({target:{value:'m0'}});
 assert.equal(r('cataloguePage'),0);
 assert.equal(app.nodes.get('catalogueCount').textContent,r('machines[0].pool.length')+'件');
 app.nodes.get('search').listeners.input({target:{value:'zz-no-result-zz'}});
 assert.equal(app.nodes.get('catalogueCount').textContent,'0件');
 assert.match(app.nodes.get('catalogueList').innerHTML,/該当する項目はありません/);
 app.nodes.get('search').listeners.input({target:{value:''}});
 app.nodes.get('catalogueMachine').listeners.change({target:{value:'all'}});
 r('S.seen["石"]=1;S.seen["始原"]=1;');
 app.nodes.get('catalogueFilter').listeners.change({target:{value:'seen'}});
 assert.equal(app.nodes.get('catalogueCount').textContent,'2件');
 app.nodes.get('catalogueFilter').listeners.change({target:{value:'all'}});
});
check('inventory pagination/search exposes the last item without changing stock',()=>{
 r('S=freshState();items.forEach(x=>S.bag[x.n]=1);setPage("inventory",24);');
 assert.equal((app.nodes.get('inventoryList').innerHTML.match(/<article /g)||[]).length,40);
 assert.match(app.nodes.get('inventoryList').innerHTML,/始原/);
 app.nodes.get('inventorySearch').listeners.input({target:{value:'始原'}});
 assert.equal(r('inventoryPage'),0);
 assert.equal((app.nodes.get('inventoryList').innerHTML.match(/<article /g)||[]).length,1);
 assert.equal(r('Object.keys(S.bag).length'),1000);
 app.nodes.get('inventorySearch').listeners.input({target:{value:''}});
});
check('BUILD 0.4 saves retain completed rewards and all old inventory',()=>{
 r('S=freshState();items.slice(0,118).forEach(x=>{S.seen[x.n]=1;S.bag[x.n]=2;S.used[x.n]=1;});S.mastered.m0=true;S.claimed["discover-115"]=true;S.current={n:"世界",machine:"m18",fresh:false};S.research=23;S.skills.appraisal=true;S=validate(JSON.parse(JSON.stringify(S)));');
 assert.equal(r('count()'),118);
 assert.equal(r('items.slice(0,118).every(x=>S.bag[x.n]===2&&S.used[x.n]===1)'),true);
 assert.equal(r('S.mastered.m0'),true);assert.equal(r('S.claimed["discover-115"]'),true);
 assert.equal(r('S.current.n'),'世界');assert.equal(r('S.research'),23);assert.equal(r('S.skills.appraisal'),true);
 r('selected="m0";renderGacha()');
 assert.match(app.nodes.get('selectedMachine').innerHTML,/全品登録の報酬は受領済み/);
});
check('1000-item use milestone closes once without an impossible 1002 target',()=>{
 r('S=freshState();items.forEach(x=>S.used[x.n]=1);for(let i=3;i<=999;i+=3)S.claimed["use-"+i]=true;');
 assert.equal(r('milestone("use").goal'),1000);
 assert.equal(r('claim("use")'),true);
 assert.equal(r('milestone("use").finished'),true);
 assert.equal(r('claim("use")'),false);
});


console.log(passed+' checks passed.');
