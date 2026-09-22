const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const acorn=require('acorn');

// Run production functions with an isolated workspace and UI stubs.
// No user browser storage or paid model calls are accessed by this suite.
const root=path.join(__dirname,'..'),declarations=new Map(),methods=new Map();
function walk(node,source){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration')declarations.set(node.id.name,source.slice(node.start,node.end));
  if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'){
    if(node.id.name==='AGENT_TOOLS')for(const p of node.init.properties)methods.set(p.key.name,source.slice(p.value.start,p.value.end));
    else if(node.init)declarations.set(node.id.name,'var '+source.slice(node.start,node.end)+';');
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,source));else if(value&&typeof value==='object')walk(value,source);
}
for(const file of ['06-storyboard.js','07-create-assets.js','11-agent.js']){
  const source=fs.readFileSync(path.join(root,'src',file),'utf8');
  walk(acorn.parse(source,{ecmaVersion:'latest'}),source);
}
function harness(){
  const script={id:'script-1',type:'script',title:'回归测试剧本',scriptBlocks:[
    {id:'scene-a',type:'scene',text:'INT. 车内 - 夜'},
    {id:'para-a',type:'action',text:'雨水沿着前挡玻璃流下。'},
    {id:'para-b',type:'action',text:'小林放下文件，转头望向车窗。'},
    {id:'para-c',type:'dialogue',text:'我们到了。'},
    {id:'scene-b',type:'scene',text:'EXT. 门口 - 夜'},
    {id:'para-d',type:'action',text:'小林走进门厅。'}
  ]};
  const board={id:'board-1',type:'storyboard'},files=[script,board],saved=[];
  const state={shots:[],activeEpisodeId:'episode-1',currentDoc:'script',currentFileId:script.id,projectPage:'scripts'};
  const noop=()=>{},node={classList:{add:noop,remove:noop},getAttribute:()=> 'false'};
  const ctx=vm.createContext({
    console,crypto:require('node:crypto').webcrypto,CSS:{escape:String},
    script,board,files,saved,state,saveOK:true,agentAbort:false,
    findFile:id=>files.find(f=>f.id===id),requireDoc:id=>files.find(f=>f.id===id),
    latestFile:type=>files.find(f=>f.type===type),scriptBlocksOf:f=>f.scriptBlocks,
    activeStoryboardId:()=>board.id,isHistoricalFile:f=>!!f.historical,
    shotLabel:s=>'SHOT '+(state.shots.indexOf(s)+1),
    captureVisibleEdits:noop,render:noop,agentStatus:noop,agentLog:noop,agentDone:noop,agentScroll:noop,
    agentClick:async()=>{},agentCursorTo:async()=>{},sleep:async()=>{},agentGoPage:async()=>{},
    agentStep:async(t,fn)=>fn(),hideCaretToolbar:noop,document:{querySelector:()=>null},$:()=>node,
    workflowExistingShots:w=>state.shots.filter(s=>(s.boardFileId||board.id)===w.context.boardFileId&&(!s.sourceFileId||s.sourceFileId===w.context.fileId))
  });
  ctx.persistWorkspace=()=>{if(ctx.saveOK)saved.push(JSON.stringify(state));return ctx.saveOK;};
  const run=code=>vm.runInContext(code,ctx);
  run(fs.readFileSync(path.join(root,'src/16-shot-rules.js'),'utf8'));
  for(const name of ['sourceBlocks','agentShotBlocks','agentRecognitionContext','assertAgentShotContext','normalizeAgentShotDrafts','readAgentScriptPage','prepareChatShotAction','appendShot','commitWorkflowShot','parsePlanJSON','parseAgentPlan','requestAgentPlan','normalizeFollowUps','previewAction','relevantSceneText','docPlainText'])run(declarations.get(name));
  run('var AGENT_TOOLS={create_shots:async function'+methods.get('create_shots')+',read_doc:async function'+methods.get('read_doc')+'};');
  ctx.context={scriptFileId:script.id,fileId:script.id,episodeId:state.activeEpisodeId,page:'scripts'};
  ctx.action={tool:'create_shots',args:{fileId:script.id,scene:1,shots:[
    {sourceIds:['para-b','para-a'],size:'全景',angle:'平视',movement:'推镜',duration:4,description:'俯瞰封闭座舱，两侧虚化光斑包裹中央的沉默身影。'},
    {sourceId:'para-c',size:'近景',angle:'低位仰拍',movement:'固定',duration:3,description:'小林说：“我们到了。”',dialogue:'我们到了。'}
  ]}};
  const json=code=>JSON.parse(run('JSON.stringify('+code+')'));
  return {ctx,run,json,load:name=>run(declarations.get(name))};
}

test('read_doc exposes actual source IDs, scenes and formats',async()=>{
  const h=harness(),result=await h.run('AGENT_TOOLS.read_doc({id:script.id,scene:1})'),page=JSON.parse(result.content);
  assert.deepEqual(page.blocks.map(b=>b.id),['scene-a','para-a','para-b','para-c']);
  assert.equal(page.blocks[1].format,'action');assert.equal(page.blocks[1].scene,'01');assert.equal(page.nextOffset,null);
});
test('long documents paginate on whole blocks through completion',()=>{
  const h=harness();h.run('script.scriptBlocks=Array.from({length:150},(_,i)=>({id:"b"+i,type:"action",text:"测试正文".repeat(80)}));');
  const ids=[];let offset=0;
  do{
    const p=h.json('readAgentScriptPage(script,{offset:'+offset+'})');ids.push(...p.blocks.map(b=>b.id));offset=p.nextOffset;
    if(offset!==null)assert.equal(p.readMore.args.offset,offset);
  }while(offset!==null);
  assert.equal(ids.length,150);assert.equal(new Set(ids).size,150);
});
test('relevant context includes IDs even without scene headings',()=>{
  const h=harness();h.run('var sceneEntries=()=>[],mentionedAssets=()=>[];');
  assert.match(h.run('relevantSceneText(script,"创建分镜")'),/"id":"para-a"/);
});
test('multi-paragraph drafts show source evidence before confirmation',()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);');
  assert.deepEqual(h.json('prepared.shotDrafts[0].sourceIds'),['para-a','para-b']);
  assert.match(h.run('previewAction(prepared)'),/剧本依据（para-a、para-b）/);assert.equal(h.ctx.state.shots.length,0);
});
test('cinematic paraphrasing is a warning, not a source rejection',()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);');
  assert.equal(h.run('prepared.shotChecks[0].status'),'new');
  assert.match(h.run('prepared.shotChecks[0].reasons.join()'),/确认前核对/);
});
test('creation writes both shots, source links, camera fields and persistent records',async()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);');
  const result=await h.run('AGENT_TOOLS.create_shots(prepared.args,"创建两镜",prepared.shotContext)');
  assert.match(result.summary,/已创建 2 个镜头/);
  const shots=h.json('state.shots');assert.equal(shots.length,2);assert.deepEqual(shots[0].sourceIds,['para-a','para-b']);
  assert.equal(shots[0].boardFileId,'board-1');assert.equal(shots[0].sourceFileId,'script-1');
  assert.equal(shots[0].camera.size,'全景 (FS)');assert.equal(shots[0].camera.movement,'推镜');assert.equal(shots[0].duration,4);
  assert.equal(shots[1].dialogueCue,'我们到了。');assert.equal(h.ctx.saved.length,2);
});
test('visible Agent creation keeps the script at its source when each new shot redraws the comparison',async()=>{
  const h=harness(),source=fs.readFileSync(path.join(root,'src/08-writing-sidebar.js'),'utf8');
  const init=acorn.parse(source,{ecmaVersion:'latest'}).body[0];
  const slots={left:{firstElementChild:null},right:{firstElementChild:null}},seen=[];
  const node={classList:{add:()=>{},remove:()=>{}},getAttribute:()=> 'false',addEventListener:()=>{}};
  Object.assign(h.ctx,{
    setView:()=>{},setTimeout:()=>{},
    $:selector=>selector==='#compare-script'?slots.left:selector==='#compare-secondary'?slots.right:node,
    document:{querySelector:selector=>({...node,kind:selector.includes('data-script-id')?'source':'record',selector})},
    render:()=>{
      slots.left.firstElementChild={dataset:{pageFile:h.ctx.state.currentFileId},scrollTop:0,scrollLeft:0};
      slots.right.firstElementChild={dataset:{},scrollTop:0};
    },
    agentScroll:el=>{
      if(el.kind==='source'){
        seen.push({phase:'before-source',top:slots.left.firstElementChild.scrollTop});
        slots.left.firstElementChild.scrollTop=el.selector.includes('para-a')?1500:1900;
      }else seen.push({phase:'new-record',top:slots.left.firstElementChild.scrollTop});
    }
  });
  h.run(source.slice(init.start,init.end));
  h.run('var prepared=prepareChatShotAction(action,context);');
  await h.run('AGENT_TOOLS.create_shots(prepared.args,"创建两镜",prepared.shotContext)');
  assert.deepEqual(seen,[
    {phase:'before-source',top:0},{phase:'new-record',top:1500},
    {phase:'before-source',top:1500},{phase:'new-record',top:1900}
  ]);
  assert.equal(h.ctx.state.shots.length,2);assert.equal(h.ctx.state.compareMemo.scroll.left,1900);
});
for(const [name,change,pattern] of [
  ['missing ID','action.args.shots[1].sourceId="nonexistent"',/来源无效/],
  ['text used as ID','action.args.shots[1].sourceId="我们到了。"',/来源无效/],
  ['partly invalid source IDs','action.args.shots[0].sourceIds.push("bad")',/来源无效/],
  ['cross-scene sources','action.args.shots[0].sourceIds.push("para-d")',/跨越/],
  ['wrong scene','action.args.scene=2',/指定场次/],
  ['missing shot array','delete action.args.shots',/1–100/],
  ['historical script','script.historical=true',/只读/]
])test(name+' rejected before any writes',()=>{
  const h=harness();h.run(change);assert.throws(()=>h.run('prepareChatShotAction(action,context)'),pattern);assert.equal(h.ctx.state.shots.length,0);
});
test('script edits after confirmation invalidate the plan',async()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);script.scriptBlocks[1].text="修改过的原文";');
  await assert.rejects(h.run('AGENT_TOOLS.create_shots(prepared.args,"创建",prepared.shotContext)'),/内容已变化/);
  assert.equal(h.ctx.state.shots.length,0);
});
test('repeat skips existing shots; other source files do not cause false duplicates',async()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);');
  await h.run('AGENT_TOOLS.create_shots(prepared.args,"创建",prepared.shotContext)');
  await h.run('AGENT_TOOLS.create_shots(prepared.args,"创建",prepared.shotContext)');assert.equal(h.ctx.state.shots.length,2);
  h.run('state.shots.forEach(s=>s.sourceFileId="another-file");var other=prepareChatShotAction(action,context);');
  assert.equal(h.run('other.shotChecks[0].status'),'new');
});
test('storage failure rolls back the failed record',async()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);saveOK=false;');
  await assert.rejects(h.run('AGENT_TOOLS.create_shots(prepared.args,"创建",prepared.shotContext)'),/未能保存/);
  assert.equal(h.ctx.state.shots.length,0);
});
test('stop retains completed records without creating later shots',async()=>{
  const h=harness();h.run('var prepared=prepareChatShotAction(action,context);agentDone=()=>{agentAbort=true;};');
  const result=await h.run('AGENT_TOOLS.create_shots(prepared.args,"创建",prepared.shotContext)');
  assert.match(result.summary,/已停止，已保留 1/);assert.equal(h.ctx.state.shots.length,1);
});
test('invalid JSON retries once without executing the valid returned plan',async()=>{
  const h=harness();h.run('var calls=0;var request=async()=>++calls===1?"not JSON":JSON.stringify({message:"请确认",actions:[action]});');
  const plan=await h.run('requestAgentPlan(request)');
  assert.equal(plan.actions[0].tool,'create_shots');assert.equal(h.run('calls'),2);assert.equal(h.ctx.state.shots.length,0);
});
test('two malformed responses fail explicitly, without mock creation',async()=>{
  const h=harness();h.run('var calls=0;var request=async()=>{calls++;return "not JSON";};');
  await assert.rejects(h.run('requestAgentPlan(request)'),e=>e.code==='MODEL_PLAN_FORMAT'&&/未执行/.test(e.message));
  assert.equal(h.run('calls'),2);assert.equal(h.ctx.state.shots.length,0);
});
test('network / incomplete stream errors do not get JSON repair retries',async()=>{
  const h=harness();h.run('var calls=0;var request=async()=>{calls++;throw Error("模型输出中断");};');
  await assert.rejects(h.run('requestAgentPlan(request)'),/输出中断/);assert.equal(h.run('calls'),1);
});
test('invalid plan shapes and unknown tools are rejected',()=>{
  const h=harness();
  for(const value of ['null','{}','[]','{"message":"x","actions":[null]}','{"message":"x","actions":[{"tool":"__proto__","args":{}}]}']){
    h.ctx.payload=value;assert.throws(()=>h.run('parseAgentPlan(payload)'));
  }
});
test('missing duration keeps the default, instead of forcing half a second',()=>{
  const h=harness();assert.equal(h.run('normalizeShotFields({}).duration'),null);
});
function conversationHarness(){
  const h=harness(),noop=()=>{};
  Object.assign(h.ctx,{
    modelCfg:()=>({apiKey:'test-only-not-a-real-key'}),renderAgent:noop,renderAgentSoon:noop,agentGlow:noop,agentEnd:noop,
    staleScenes:()=>[],save:noop,attachFollowUps:noop,coverIsBlank:()=>false,
    normalizeQuestions:q=>q,saveBrief:()=>[],pendingPlans:{},lastToolContents:[],agentLogLines:[],
    DESTRUCTIVE_TOOLS:new Set(),NO_CONFIRM_TOOLS:new Set(['read_doc','open_doc','read_asset']),
    c:{id:'chat-1',title:'回归测试',messages:[{role:'user',text:'创建两镜'}]},
    localPlan:()=>{throw Error('must not use local fallback');}
  });
  for(const name of ['runActions','reply','describeAction','PLAN_KIND','planKind','planSteps'])h.load(name);
  return h;
}
test('conversation reads several pages with IDs then offers confirmation without writes',async()=>{
  const h=conversationHarness();
  h.run('var inputs=[];remotePlan=async text=>{inputs.push(text);return inputs.length<3?{message:"读取",actions:[{tool:"read_doc",args:{id:script.id,scene:1,offset:(inputs.length-1)*2,limit:2}}]}:{message:"请确认",actions:[action]};};');
  await h.run('reply("创建两镜",c,context)');
  assert.match(h.run('inputs[2]'),/"id":"para-a"/);assert.match(h.run('inputs[2]'),/"id":"para-c"/);
  assert.equal(Object.keys(h.ctx.pendingPlans).length,1);assert.equal(h.ctx.state.shots.length,0);
  assert.match(h.run('c.messages.at(-1).plan.steps[0].preview'),/剧本依据/);
  assert.equal(h.run('c.messages.at(-1).plan.state'),'pending');assert.equal(h.run('c.messages.at(-1).plan.steps[0].kind'),'shot');
  assert.doesNotMatch(h.run('c.messages.at(-1).text'),/剧本依据/);
  assert.equal(h.run('c.messages.at(-1).actions[0].label'),'确认执行');
});
test('execution marks each plan step running, then done with its result',async()=>{
  const h=conversationHarness();
  h.run('var prepared=prepareChatShotAction(action,context);var steps=planSteps([prepared]);var seen=[];renderAgentSoon=()=>seen.push(steps[0].status);');
  assert.equal(h.run('steps[0].status'),'pending');assert.equal(h.run('steps[0].destructive'),false);
  const out=await h.run('runActions([prepared],"创建两镜",steps)');
  assert.equal(h.run('steps[0].status'),'done');assert.match(h.run('steps[0].result'),/已创建 2 个镜头/);
  assert.deepEqual(h.json('seen'),['running','done']);assert.equal(out.results.length,1);assert.equal(h.ctx.state.shots.length,2);
});
test('a failing step is marked failed and a stop skips the rest',async()=>{
  const h=conversationHarness();
  h.run('AGENT_TOOLS.boom=async()=>{throw Error("坏了");};AGENT_TOOLS.halt=async()=>{throw Error("已停止");};AGENT_TOOLS.ok=async()=>"好";renderAgentSoon=()=>{};');
  h.run('var plan=[{tool:"boom"},{tool:"ok"},{tool:"halt"},{tool:"ok"}];var steps=plan.map(a=>({tool:a.tool,status:"pending",result:""}));');
  const out=await h.run('runActions(plan,"x",steps)');
  assert.deepEqual(h.json('steps.map(s=>s.status)'),['failed','done','skipped','skipped']);
  assert.match(h.run('steps[0].result'),/坏了/);assert.equal(h.run('steps[1].result'),'好');assert.equal(out.results.length,3);
});
test('conversation rejects a malformed model plan without local fallback or confirmation',async()=>{
  const h=conversationHarness();
  h.run('remotePlan=async()=>{const e=Error("格式错误");e.code="MODEL_PLAN_FORMAT";throw e;};');
  await h.run('reply("创建两镜",c,context)');
  assert.equal(Object.keys(h.ctx.pendingPlans).length,0);assert.equal(h.ctx.state.shots.length,0);
  assert.equal(h.run('c.messages.at(-1).text'),'格式错误');
});
test('conversation rejects a whole batch with invalid source IDs before confirmation',async()=>{
  const h=conversationHarness();
  h.run('action.args.shots[1].sourceId="bad";remotePlan=async()=>({message:"请确认",actions:[action]});');
  await h.run('reply("创建两镜",c,context)');
  assert.equal(Object.keys(h.ctx.pendingPlans).length,0);assert.equal(h.ctx.state.shots.length,0);
  assert.match(h.run('c.messages.at(-1).text'),/来源无效/);
});
