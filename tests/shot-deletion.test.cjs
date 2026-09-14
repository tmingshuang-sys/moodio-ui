const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const acorn=require('acorn');
const source=fs.readFileSync(path.join(__dirname,'../src/07-create-assets.js'),'utf8');
const start=source.indexOf('    var shotDeletionHistory='),end=source.indexOf('    function refreshShot(',start);
assert.ok(start>0&&end>start);
const production=source.slice(start,end);
const assignments=acorn.parse(source,{ecmaVersion:'latest'}).body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression');
const card=assignments.find(n=>n.expression.left.name==='renderShotRecord');
const cardCode=source.slice(card.start,card.end);
const clone=value=>JSON.parse(JSON.stringify(value));
function sample(){return {
  activeEpisodeId:'ep-1',selectedShots:new Set([1,2]),
  shots:[{id:1,boardFileId:'board-a',scene:'01',description:'雨打在车窗上。',sourceText:'雨打在车窗上。',references:[{name:'参考图',data:'data:image/png;base64,AA=='}],camera:{size:['近景']}},{id:2,boardFileId:'board-b',description:'另一个分镜'}],
  chunks:[{id:'unit-a',shotIds:[1,2],nodes:[{id:'source-1',kind:'script',shotId:1},{id:'shot-1',kind:'shot',shotId:1},{id:'shot-2',kind:'shot',shotId:2},{id:'gen',kind:'gen',image:{result:'keep'}}],edges:[{id:'edge-1',from:'shot-1',to:'gen'},{id:'edge-2',from:'shot-2',to:'gen'}]}]
};}
function harness(){
  const state=sample(),error={textContent:''};let listener,dialog=null,saves=0,renders=0,saveOK=true,historical=false;
  const ctx=vm.createContext({state,document:{addEventListener:(name,fn)=>listener=fn},$:()=>error,
    findFile:id=>id.startsWith('board-')?{id,type:'storyboard'}:null,isHistoricalFile:()=>historical,
    captureVisibleEdits:()=>{},persistWorkspace:()=>{saves++;return saveOK;},render:()=>renders++,
    escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    shotLabel:s=>'SHOT '+String(state.shots.indexOf(s)+1).padStart(2,'0'),
    flowButton:(action,label)=>`<button data-flow="${action}">${label}</button>`,
    openFlowDialog:(title,body,footer)=>dialog={title,body,footer},closeFlowDialog:()=>dialog=null
  });
  vm.runInContext(production,ctx);
  return {ctx,state,error,dialog:()=>dialog,saves:()=>saves,renders:()=>renders,failSave:()=>saveOK=false,historical:()=>historical=true,
    click:(attribute,value)=>listener({target:{closest:()=>({dataset:{shotDelete:value,shotUndo:value},hasAttribute:key=>key===attribute})},preventDefault(){},stopImmediatePropagation(){}}),
    remove:()=>{ctx.requestShotDeletion(1);ctx.confirmShotDeletion();}};
}
test('card exposes an accessible delete button and click only opens confirmation',()=>{
  const h=harness();Object.assign(h.ctx,{icons:{trash:'<svg></svg>'},flowIcon:()=>'',compactMedia:()=>''});
  vm.runInContext(cardCode,h.ctx);
  assert.match(h.ctx.renderShotRecord(h.state.shots[0]),/data-shot-delete="1" title="删除 SHOT 01" aria-label="删除 SHOT 01"/);
  h.click('data-shot-delete','1');assert.match(h.dialog().title,/删除 SHOT 01/);
  assert.match(h.dialog().footer,/data-flow="close-dialog"/);assert.equal(h.saves(),0);assert.equal(h.state.shots.length,2);
  h.ctx.closeFlowDialog();assert.equal(h.state.shots.length,2);assert.equal(h.renders(),0);
});
test('confirmed deletion removes only the shot, its selection, linked nodes and edges; preserves generated output',()=>{
  const h=harness();h.remove();
  assert.deepEqual(clone(h.state.shots.map(s=>s.id)),[2]);assert.deepEqual([...h.state.selectedShots],[2]);
  assert.deepEqual(clone(h.state.chunks[0].shotIds),[2]);assert.deepEqual(clone(h.state.chunks[0].nodes.map(n=>n.id)),['shot-2','gen']);
  assert.deepEqual(clone(h.state.chunks[0].edges.map(e=>e.id)),['edge-2']);assert.equal(h.state.chunks[0].nodes[1].image.result,'keep');
  assert.match(h.ctx.renderShotDeletionUndo('board-a'),/撤销删除/);assert.equal(h.ctx.renderShotDeletionUndo('board-b'),'');
  assert.equal(h.saves(),1);assert.equal(h.renders(),1);assert.equal(h.dialog(),null);
});
test('undo restores full shot content, media, camera, order and associations',()=>{
  const h=harness(),before=clone(h.state);h.remove();h.click('data-shot-undo','board-a');
  assert.deepEqual(clone(h.state),before);assert.deepEqual([...h.state.selectedShots],[1,2].reverse());
  assert.equal(h.ctx.renderShotDeletionUndo('board-a'),'');assert.equal(h.saves(),2);
});
test('save failure rolls deletion back and keeps an actionable error in the dialog',()=>{
  const h=harness(),before=clone(h.state);h.failSave();h.remove();
  assert.deepEqual(clone(h.state),before);assert.equal(h.ctx.renderShotDeletionUndo('board-a'),'');
  assert.match(h.error.textContent,/未删除分镜/);assert.ok(h.dialog());assert.equal(h.renders(),0);
});
test('failed undo rolls back and retains the undo entry for retry',()=>{
  const h=harness();h.remove();const before=clone(h.state);h.failSave();h.ctx.undoShotDeletion('board-a');
  assert.deepEqual(clone(h.state),before);assert.match(h.ctx.renderShotDeletionUndo('board-a'),/撤销删除/);
  assert.equal(h.dialog().title,'无法撤销删除');
});
test('stale confirmations and historical boards never delete content',()=>{
  const h=harness();h.ctx.requestShotDeletion(1);h.state.activeEpisodeId='ep-2';h.ctx.confirmShotDeletion();assert.equal(h.saves(),0);
  h.state.activeEpisodeId='ep-1';h.historical();h.ctx.requestShotDeletion(1);assert.equal(h.dialog(),null);assert.equal(h.state.shots.length,2);
});
test('undo is scoped to episode and board and does not resurrect deleted generation units',()=>{
  const h=harness();h.remove();h.state.activeEpisodeId='ep-2';h.ctx.undoShotDeletion('board-a');assert.equal(h.state.shots.length,1);
  assert.equal(h.ctx.renderShotDeletionUndo('board-a'),'');h.state.activeEpisodeId='ep-1';h.state.chunks=[];h.ctx.undoShotDeletion('board-a');
  assert.equal(h.state.shots.length,2);assert.equal(h.state.chunks.length,0);
});
test('undo preserves intervening work and remaps reused shot, node and edge IDs',()=>{
  const h=harness();h.remove();
  h.state.shots.push({id:1,boardFileId:'board-a',description:'新镜头，不能覆盖'});
  const chunk=h.state.chunks[0];chunk.shotIds.push(1);chunk.nodes.push({id:'shot-1',kind:'shot',shotId:1});chunk.edges.push({id:'edge-1',from:'shot-1',to:'gen'});
  chunk.nodes.find(n=>n.id==='gen').image.result='updated';h.ctx.undoShotDeletion('board-a');
  assert.equal(h.state.shots[0].id,3);assert.equal(h.state.shots.find(s=>s.id===1).description,'新镜头，不能覆盖');
  assert.ok(chunk.nodes.some(n=>n.id==='shot-1-restored'&&n.shotId===3));
  assert.ok(chunk.edges.some(e=>e.id==='edge-1-restored'&&e.from==='shot-1-restored'));
  assert.equal(chunk.nodes.find(n=>n.id==='gen').image.result,'updated');assert.equal(new Set(chunk.shotIds).size,3);
});
test('successive deletions undo one at a time',()=>{
  const h=harness();h.state.shots[1].boardFileId='board-a';const before=clone(h.state);
  h.remove();h.ctx.requestShotDeletion(2);h.ctx.confirmShotDeletion();h.ctx.undoShotDeletion('board-a');h.ctx.undoShotDeletion('board-a');
  assert.deepEqual(clone(h.state),before);
});

// A background browser can exercise the real card markup and deletion handlers
// without reading or modifying user project storage, or making model requests.
if(process.env.MOODIO_SHOT_DELETE_FIXTURE){
  const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
  const iconSource=fs.readFileSync(path.join(__dirname,'../src/01-data.js'),'utf8');
  const trash=iconSource.match(/trash: '([^']+)'/)[1];
  const initial=sample();initial.shots=initial.shots.slice(0,1);initial.chunks=[];initial.selectedShots=[];
  const html='<!doctype html><meta charset="utf-8"><title>分镜删除交互回归</title><style>'+css+'</style><style>body{display:block;overflow:auto;background:#f6f6f6}main{width:min(680px,92vw);margin:100px auto;background:white;padding:32px}.board-selection{position:static;margin:0;padding:0 0 18px}.compact-media{min-height:110px;border:1px dashed #ccc;border-radius:8px;display:grid;place-items:center;color:#888}#status{font-size:13px;margin-top:18px}</style><main><div id="board"></div><p id="status" role="status"></p></main><dialog id="flow-dialog" class="flow-dialog"></dialog><script>'+ 
    'var state='+JSON.stringify(initial)+';state.selectedShots=new Set();var icons={trash:'+JSON.stringify(trash)+'};var $=s=>document.querySelector(s),flowIcon=()=>"",compactMedia=()=>"<div class=compact-media>图片 / 视频参考</div>",escapeHtml=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\"/g,"&quot;");var findFile=id=>({id,type:"storyboard"}),isHistoricalFile=()=>false,captureVisibleEdits=()=>{},persistWorkspace=()=>true,shotLabel=s=>"SHOT "+String(state.shots.indexOf(s)+1).padStart(2,"0"),flowButton=(a,l)=>`<button class="canvas-action" data-flow="${a}">${l}</button>`;'+
    'function openFlowDialog(title,body,footer){const d=$("#flow-dialog");d.innerHTML=`<header><h2>${title}</h2><button data-flow="close-dialog" aria-label="关闭窗口">×</button></header><div class="flow-dialog-body">${body}</div><footer>${footer}</footer>`;if(!d.open)d.showModal()}function closeFlowDialog(){$("#flow-dialog").close()}document.addEventListener("click",e=>{if(e.target.closest("[data-flow=close-dialog]"))closeFlowDialog()});'+
    production+cardCode+'function render(){$("#board").innerHTML=`<section class="board-shell"><div class="board-selection">${renderShotDeletionUndo("board-a")}<button class="canvas-action" disabled>合并创建 生成单元</button></div><div class="shot-list">${state.shots.map(renderShotRecord).join("")||"<div class=board-empty>选中剧本正文，创建第一个分镜。</div>"}</div></section>`;$("#status").textContent="镜头数量："+state.shots.length;}render();</script>';
  fs.writeFileSync(process.env.MOODIO_SHOT_DELETE_FIXTURE,html);
}
