const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const acorn=require('acorn');

const source=fs.readFileSync(path.join(__dirname,'../src/08-writing-sidebar.js'),'utf8');
const initializer=acorn.parse(source,{ecmaVersion:'latest'}).body[0];
const production=source.slice(initializer.start,initializer.end);
function harness(){
  const state={projectPage:'scripts',workspaceMode:'document',view:'compare',currentDoc:'script',currentFileId:'script-a',compareDoc:'script',compareFileId:'script-b',selectedPageSlot:'left'};
  const page=(id,top=0,left=0)=>({dataset:{pageFile:id},scrollTop:top,scrollLeft:left});
  const slots={left:{firstElementChild:page('script-a',1800,15)},right:{firstElementChild:page('script-b',600,30)}};
  let onScroll,draws=0;
  const ctx=vm.createContext({state,setView:()=>{},findFile:id=>({id,type:'script'}),activeFile:()=>({type:'script'}),captureVisibleEdits:()=>{},
    $:selector=>selector==='#compare-script'?slots.left:selector==='#compare-secondary'?slots.right:{addEventListener:(name,fn)=>{onScroll=fn;}},
    render:()=>{
      draws++;
      slots.left.firstElementChild=state.view==='compare'?page(state.currentFileId):null;
      slots.right.firstElementChild=state.view==='compare'?page(state.compareFileId):null;
    }
  });
  vm.runInContext(production,ctx);
  return {state,slots,ctx,page,draws:()=>draws,render:()=>ctx.render(),scroll:(side,top)=>{
    const target=slots[side].firstElementChild;target.scrollTop=top;
    target.closest=()=>({dataset:{pageSlot:side}});onScroll({target});
  }};
}
test('same-document redraw synchronously preserves both paper positions before updating the memo',()=>{
  const h=harness(),old=h.slots.left.firstElementChild;h.render();
  assert.notEqual(h.slots.left.firstElementChild,old);
  assert.equal(h.slots.left.firstElementChild.scrollTop,1800);assert.equal(h.slots.right.firstElementChild.scrollTop,600);
  assert.equal(h.slots.left.firstElementChild.scrollLeft,15);assert.equal(h.slots.right.firstElementChild.scrollLeft,30);
  assert.equal(h.state.compareMemo.scroll.left,1800);assert.equal(h.state.compareMemo.scroll.right,600);
  assert.equal(h.draws(),1);
});
test('consecutive redraws retain the latest paragraph position, not a stale saved memo',()=>{
  const h=harness();h.state.compareMemo={scroll:{left:20,right:10}};
  for(const top of [1800,2150,1950,2800]){
    h.slots.left.firstElementChild.scrollTop=top;h.render();
    assert.equal(h.slots.left.firstElementChild.scrollTop,top);assert.equal(h.state.compareMemo.scroll.left,top);
  }
});
test('new document identity does not inherit the previous document scroll',()=>{
  const h=harness();h.state.currentFileId='new-script';h.render();
  assert.equal(h.slots.left.firstElementChild.scrollTop,0);assert.equal(h.slots.right.firstElementChild.scrollTop,600);
});
test('changing the right document leaves the left script in place',()=>{
  const h=harness();h.state.compareFileId='new-board';h.render();
  assert.equal(h.slots.left.firstElementChild.scrollTop,1800);assert.equal(h.slots.right.firstElementChild.scrollTop,0);
});
test('focus mode and the first empty comparison render are safe',()=>{
  const h=harness();h.state.view='focus';h.render();
  assert.equal(h.slots.left.firstElementChild,null);
  h.state.view='compare';h.render();assert.equal(h.slots.left.firstElementChild.scrollTop,0);
});
test('unknown page identity is not restored across unrelated renderers',()=>{
  const h=harness();delete h.slots.left.firstElementChild.dataset.pageFile;h.render();
  assert.equal(h.slots.left.firstElementChild.scrollTop,0);
});
test('position zero is preserved and later explicit navigation still wins',()=>{
  const h=harness();h.slots.left.firstElementChild.scrollTop=0;h.render();
  assert.equal(h.slots.left.firstElementChild.scrollTop,0);
  h.scroll('left',950);assert.equal(h.state.compareMemo.scroll.left,950);
  h.render();assert.equal(h.slots.left.firstElementChild.scrollTop,950);
});
test('non-document workspaces do not restore hidden paper scroll positions',()=>{
  for(const change of [{workspaceMode:'beatboard'},{projectPage:'assets'}]){
    const h=harness();Object.assign(h.state,change);h.render();
    assert.equal(h.slots.left.firstElementChild.scrollTop,0);
  }
});
