const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const acorn=require('acorn');
const root=path.join(__dirname,'..'),functions=new Map();
function walk(node,source){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration')functions.set(node.id.name,source.slice(node.start,node.end));
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,source));else if(value&&typeof value==='object')walk(value,source);
}
for(const file of ['08-writing-sidebar.js','11-agent.js']){
  const source=fs.readFileSync(path.join(root,'src',file),'utf8');walk(acorn.parse(source,{ecmaVersion:'latest'}),source);
}
function harness(){
  const file={id:'script-1',title:'测试剧本',type:'script',scriptBlocks:[{id:'s1',type:'scene',text:'INT. 房间 - 夜'},{id:'b1',type:'action',text:'她打开窗户。'}]};
  let writes=0,expanded=false;
  const notice={hidden:true,querySelector:()=>notice.innerHTML?{get open(){return expanded;},set open(v){expanded=v;}}:null};
  Object.defineProperty(notice,'innerHTML',{get(){return this.markup||'';},set(v){writes++;this.markup=v;expanded=false;}});
  const empty={hidden:false},messages=[],nodes={'#agent-format-notice':notice,'#agent-empty':empty};
  const ctx=vm.createContext({
    file,state:{projectPage:'scripts',scriptLayout:'american'},selection:{type:'script',file},
    history:false,scriptBlocksOf:f=>f.scriptBlocks,allAssets:()=>[],chat:()=>({messages}),
    escapeHtml:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  });
  ctx.contextDocInfo=()=>ctx.selection;
  nodes['#agent-back']={getAttribute:()=>String(ctx.history)};
  ctx.$=selector=>nodes[selector]||null;
  const run=code=>vm.runInContext(code,ctx);
  run(fs.readFileSync(path.join(root,'src/15-script-rules.js'),'utf8'));
  for(const name of ['agentFormatReport','agentFormatNoticeHtml','refreshAgentFormatNotice','renderContextSections','fillContextSections'])run(functions.get(name));
  return {ctx,run,file,notice,empty,messages,writes:()=>writes};
}
test('sidebar contains only its existing navigation, with no format section',()=>{
  const h=harness();h.ctx.renderContextSectionsBase=()=>'<section>场次导航</section>';
  assert.equal(h.run('renderContextSections([])'),'<section>场次导航</section>');
  assert.equal(functions.has('scriptLintSection'),false);
});
test('no format issues means no notice or success message',()=>{
  const h=harness();h.run('refreshAgentFormatNotice()');
  assert.equal(h.notice.hidden,true);assert.equal(h.notice.innerHTML,'');assert.equal(h.empty.hidden,false);
});
test('issues appear only in the Agent notice, with links to source paragraphs',()=>{
  const h=harness();h.file.scriptBlocks[1].text='她想起过去。';
  h.run('refreshAgentFormatNotice()');
  assert.equal(h.notice.hidden,false);assert.equal(h.empty.hidden,true);
  assert.match(h.notice.innerHTML,/剧本格式提示/);assert.match(h.notice.innerHTML,/data-agent-format-block="b1"/);
  assert.match(h.notice.innerHTML,/动作行含虚写/);assert.equal(h.messages.length,0);
});
test('fixing issues removes the notice without adding chat history',()=>{
  const h=harness();h.file.scriptBlocks[0].text='错误标题';h.run('refreshAgentFormatNotice()');
  h.file.scriptBlocks[0].text='INT. 房间 - 夜';h.run('refreshAgentFormatNotice()');
  assert.equal(h.notice.hidden,true);assert.equal(h.messages.length,0);
});
test('unchanged issues are not rebuilt; expanded state survives a changed issue',()=>{
  const h=harness();h.file.scriptBlocks[0].text='错误标题';h.run('refreshAgentFormatNotice()');
  const count=h.writes();h.run('refreshAgentFormatNotice()');assert.equal(h.writes(),count);
  h.notice.querySelector('details').open=true;h.file.scriptBlocks[1].text='她想起过去。';h.run('refreshAgentFormatNotice()');
  assert.equal(h.notice.querySelector('details').open,true);
});
test('notice follows selected script and hides in other documents or chat history',()=>{
  const h=harness();h.file.scriptBlocks[0].text='错误标题';h.run('refreshAgentFormatNotice()');
  h.ctx.selection={type:'storyboard',file:{id:'board'}};h.run('refreshAgentFormatNotice()');assert.equal(h.notice.hidden,true);
  h.ctx.selection={type:'script',file:h.file};h.ctx.history=true;h.run('refreshAgentFormatNotice()');assert.equal(h.notice.hidden,true);
  h.ctx.history=false;h.run('refreshAgentFormatNotice()');assert.equal(h.notice.hidden,false);
  h.ctx.state.projectPage='assets';h.run('refreshAgentFormatNotice()');assert.equal(h.notice.hidden,true);
});
test('layout selection changes which scene-heading rules apply',()=>{
  const h=harness();h.file.scriptBlocks[0].text='内景 房间 夜';
  assert.notEqual(h.run('agentFormatReport()'),null);
  h.ctx.state.scriptLayout='chinese';assert.equal(h.run('agentFormatReport()'),null);
});
test('rule readiness guard is safe during first render',()=>{
  const h=harness();h.run('MOODIO_SCRIPT_RULES=undefined');assert.equal(h.run('agentFormatReport()'),null);
});
test('user text is escaped and excluded from interface translation',()=>{
  const h=harness();h.file.title='<img src=x>';h.file.scriptBlocks[0].text='<script>oops</script>';
  h.run('refreshAgentFormatNotice()');
  assert.doesNotMatch(h.notice.innerHTML,/<img|<script>/);assert.match(h.notice.innerHTML,/&lt;script&gt;/);
  assert.match(h.notice.innerHTML,/data-i18n-skip/);
});
test('long action and dialogue lines are not newly restricted',()=>{
  const h=harness();h.file.scriptBlocks.push({id:'long',type:'action',text:'她打开窗户。'.repeat(300)},{id:'dialogue',type:'dialogue',text:'我们继续走。'.repeat(300)});
  assert.equal(h.run('agentFormatReport()'),null);
});
test('context updates notify Agent even when the sidebar has no dynamic sections',()=>{
  const h=harness();let events=0;h.ctx.document={dispatchEvent:e=>{assert.equal(e.type,'moodio:script-context-updated');events++;}};
  h.ctx.CustomEvent=class{constructor(type){this.type=type;}};
  h.run('fillContextSections()');assert.equal(events,1);
});
