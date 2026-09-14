const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const acorn=require('acorn');
const source=fs.readFileSync(path.join(__dirname,'../src/11-agent.js'),'utf8');
const functions=new Map();let handler;
function walk(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration')functions.set(node.id.name,source.slice(node.start,node.end));
  if(node.type==='CallExpression'&&node.callee?.object?.name==='panel'&&node.callee?.property?.name==='addEventListener'){
    const callback=node.arguments[1],text=source.slice(callback.start,callback.end);
    if(text.includes("const opt=event.target.closest('[data-q-option]')"))handler=text;
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
}
walk(acorn.parse(source,{ecmaVersion:'latest'}));
const questions=[{text:'这个故事想做成什么类型？',options:['悬疑反转','温情治愈','黑色喜剧']},{text:'想要什么调性？',options:['温暖细腻','紧张压迫','荒诞幽默'],multi:true},{text:'主要用途？',options:['竖屏短视频','参赛短片','练习']}];
function harness(){
  const message={role:'assistant',questions:structuredClone(questions),answers:{}},chat={messages:[message]};
  const counters={saves:0,renders:0,sends:0},body={scrollTop:120},input={value:'',dispatchEvent:()=>{}};
  const send={dataset:{qSend:'0'},disabled:true};
  let card;
  const options=questions.flatMap((q,qi)=>q.options.map((o,oi)=>({
    dataset:{qOption:`0:${qi}:${oi}`},selected:false,attributes:{},
    classList:{toggle(name,on){this.owner.selected=on;}},setAttribute(name,value){this.attributes[name]=value;},
    closest(selector){return selector==='[data-q-option]'?this:selector==='[data-q-msg]'?card:null;}
  })));
  options.forEach(button=>button.classList.owner=button);
  card={querySelectorAll:()=>options,querySelector:()=>send};
  send.closest=selector=>selector==='[data-q-send]'?send:null;
  const ctx=vm.createContext({chat:()=>chat,save:()=>counters.saves++,Event:class{},
    renderAgent:()=>{counters.renders++;body.scrollTop=999;},
    $:selector=>selector==='#agent-input'?input:{click:()=>counters.sends++}
  });
  vm.runInContext(functions.get('refreshQuestionSelection')+'\nvar clickHandler='+handler+';',ctx);
  return {message,counters,body,input,send,options,click:button=>ctx.clickHandler({target:button,preventDefault:()=>{},stopImmediatePropagation:()=>{}})};
}
test('choosing an answer updates the existing card without rendering, scrolling or sending',()=>{
  const h=harness();h.click(h.options[0]);
  assert.equal(h.options[0].selected,true);assert.equal(h.options[0].attributes['aria-pressed'],'true');
  assert.equal(h.send.disabled,false);assert.equal(h.body.scrollTop,120);
  assert.deepEqual(h.counters,{saves:1,renders:0,sends:0});
});
test('single-choice replacement and deselection keep the card in place',()=>{
  const h=harness();h.click(h.options[0]);h.click(h.options[1]);
  assert.equal(h.options[0].selected,false);assert.equal(h.options[1].selected,true);
  h.click(h.options[1]);assert.equal(h.send.disabled,true);assert.equal(h.body.scrollTop,120);assert.equal(h.counters.renders,0);
});
test('multiple choices remain selected independently and other questions retain their answers',()=>{
  const h=harness();h.click(h.options[0]);h.click(h.options[3]);h.click(h.options[4]);h.click(h.options[3]);
  assert.equal(h.options[0].selected,true);assert.equal(h.options[3].selected,false);assert.equal(h.options[4].selected,true);
  assert.equal(h.send.disabled,false);assert.equal(h.body.scrollTop,120);assert.equal(h.counters.sends,0);
});
test('only sending the completed answer triggers chat rendering and submission',()=>{
  const h=harness();h.click(h.options[0]);h.click(h.options[3]);h.click(h.send);
  assert.equal(h.message.questionsUsed,true);assert.equal(h.counters.sends,1);assert.equal(h.counters.renders,1);
  assert.match(h.input.value,/悬疑反转/);assert.match(h.input.value,/温暖细腻/);
});

// Optional isolated browser fixture: real production card markup and click handler,
// no project storage or model calls. Generate outside the repository for visual QA.
if(process.env.MOODIO_QUESTION_FIXTURE){
  const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
  const start=css.indexOf('    /* Agent 追问卡片 */'),end=css.indexOf('\n\n',start);
  const html='<!doctype html><meta charset="utf-8"><title>Agent 选项滚动回归</title><style>'+css.slice(start,end)+
    ':root{--ink:#191917;--ink-3:#666;--line:#ddd;--line-strong:#ccc;--font-ui:system-ui}body{font:15px system-ui;background:#f6f6f6}#agent-panel{width:380px;margin:30px auto;background:white;border:1px solid #bbb;border-radius:14px;padding:16px}#agent-body{height:340px;overflow:auto}.intro{height:120px}.after{height:250px}#agent-input{width:95%;margin-top:12px}</style>'+ 
    '<main id="agent-panel"><h3>帮我写一个 1 分钟的小故事</h3><div id="agent-body"><div id="agent-messages"></div></div><textarea id="agent-input" aria-label="给 Agent 的消息"></textarea><button id="agent-send">发送</button><p id="qa-status">尚未提交</p></main><script>'+ 
    'var panel=document.querySelector("#agent-panel"),agentBusy=false;var m={role:"assistant",questions:'+JSON.stringify(questions)+',answers:{}};var c={messages:[m]};var chat=()=>c,save=()=>{},$=s=>document.querySelector(s),escapeHtml=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");'+
    functions.get('questionsHtml')+'\n'+functions.get('refreshQuestionSelection')+'\n'+
    'function renderAgent(){document.querySelector("#agent-messages").innerHTML="<div class=intro>先确认几个关键点，选好后再发送回答。</div>"+questionsHtml(m,0,c)+"<div class=after>回答后，我会提供创作方案。</div>";document.querySelector("#agent-body").scrollTop=9999;}'+
    'panel.addEventListener("click",'+handler+');document.querySelector("#agent-send").onclick=()=>document.querySelector("#qa-status").textContent="已提交";renderAgent();document.querySelector("#agent-body").scrollTop=110;</script>';
  fs.writeFileSync(process.env.MOODIO_QUESTION_FIXTURE,html);
}
