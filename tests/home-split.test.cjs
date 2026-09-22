const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const acorn=require('acorn');

// 审阅工作区的进入 / 退出规则（src/06 stagePage）：只在首页全屏对话里打开板块时停靠，显式进入完整工作区或回首页时退出。
const source=fs.readFileSync(path.join(__dirname,'..','src','06-storyboard.js'),'utf8');
const declarations=new Map();
(function walk(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration')declarations.set(node.id.name,source.slice(node.start,node.end));
  if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&node.init)declarations.set(node.id.name,'var '+source.slice(node.start,node.end)+';');
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
})(acorn.parse(source,{ecmaVersion:'latest'}));

function harness({projectPage='home',chatting=false,width=1600}={}){
  const state={projectPage,homeSplit:false,sidebarCollapsed:false};
  const ctx=vm.createContext({state,innerWidth:width,document:{body:{classList:{contains:name=>name==='home-chatting'&&chatting}}}});
  for(const name of ['homeSplitRestore','homeChatFullscreen','stagePage'])vm.runInContext(declarations.get(name),ctx);
  return {state,stage:(page,opts)=>vm.runInContext(`stagePage(${JSON.stringify(page)}${opts?','+JSON.stringify(opts):''})`,ctx)};
}

test('opening a section from the full-screen chat docks the chat and shows the section on the right',()=>{
  const h=harness({chatting:true});
  h.stage('scripts');
  assert.equal(h.state.homeSplit,true);assert.equal(h.state.projectPage,'scripts');
  h.stage('assets');
  assert.equal(h.state.homeSplit,true);assert.equal(h.state.projectPage,'assets');
});
test('entering a section from the greeting page or project overview stays the full workspace',()=>{
  const h=harness({chatting:false});
  h.stage('scripts');
  assert.equal(h.state.homeSplit,false);assert.equal(h.state.projectPage,'scripts');
});
test('closing the workspace returns to the full-screen chat; opening the full workspace leaves the split',()=>{
  const a=harness({chatting:true});a.stage('scripts');a.stage('home');
  assert.equal(a.state.homeSplit,false);assert.equal(a.state.projectPage,'home');
  const b=harness({chatting:true});b.stage('scripts');b.stage('scripts',{full:true});
  assert.equal(b.state.homeSplit,false);assert.equal(b.state.projectPage,'scripts');
});
test('a narrow right pane collapses the writing sidebar and restores it afterwards',()=>{
  const h=harness({chatting:true,width:1280});
  h.stage('scripts');assert.equal(h.state.sidebarCollapsed,true);
  h.stage('home');assert.equal(h.state.sidebarCollapsed,false);
  const wide=harness({chatting:true,width:1800});wide.stage('scripts');assert.equal(wide.state.sidebarCollapsed,false);
});
