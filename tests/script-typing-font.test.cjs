const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
const fontOf=selector=>{
  const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  return rules.filter(m=>m[1].trim().split(',').map(s=>s.trim()).includes(selector))
    .map(m=>m[2].match(/font-family\s*:\s*([^;]+)/)?.[1]?.trim()).filter(Boolean).at(-1);
};
test('live script editor inherits exactly the same Songti family as the final script body',()=>{
  assert.equal(fontOf('.script-paper .script-blocks'),fontOf('.script-body'));
  assert.match(fontOf('.script-paper .script-blocks'),/"Songti SC"/);
});
test('font correction leaves per-paragraph font inheritance and screenplay layout rules intact',()=>{
  assert.equal(fontOf('.script-block'),'inherit');
  assert.equal(fontOf('.script-paper.american-layout .scene-heading-text'),fontOf('.script-paper .script-blocks'));
  assert.equal(fontOf('.script-paper.chinese-layout .script-body'),fontOf('.script-paper .script-blocks'));
});

// Isolated browser check of the actual stylesheet and both DOM shapes used by Agent
// typing and the final render. No user content, storage or model calls.
if(process.env.MOODIO_FONT_FIXTURE){
  const types=['scene-line','action','character','dialogue','parenthetical','transition'];
  const sections=['american','chinese'].map(layout=>'<section class="script-paper '+layout+'-layout"><h2>'+layout+'</h2><div class="script-blocks">'+types.map(type=>
    '<div class="pair"><div data-phase="typing" data-kind="'+layout+'-'+type+'" class="script-block '+type+' agent-typing">雨打在车窗上，梦雨转过头。</div><div class="script-body"><div data-phase="final" class="script-block '+type+'">雨打在车窗上，梦雨转过头。</div></div></div>').join('')+'</div></section>').join('');
  fs.writeFileSync(process.env.MOODIO_FONT_FIXTURE,'<!doctype html><meta charset="utf-8"><title>Agent 写入字体回归</title><style>'+css+'</style><style>body{display:block;overflow:auto;padding:20px}main{max-width:1100px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:24px}.pair{padding:10px;border-bottom:1px solid #ddd}.script-paper{background:white;padding:20px}.script-body{margin-top:8px}.script-blocks{padding-bottom:0}output{display:block;margin-bottom:16px}</style><output id="result">正在检查字体</output><main>'+sections+'</main><script>document.fonts.ready.then(()=>{const results=[...document.querySelectorAll(".pair")].map(pair=>{const live=pair.querySelector("[data-phase=typing]"),final=pair.querySelector("[data-phase=final]");const before=getComputedStyle(live).fontFamily,after=getComputedStyle(final).fontFamily;live.dataset.font=before;final.dataset.font=after;return before===after&&before.includes("Songti SC")});document.querySelector("#result").textContent=results.filter(Boolean).length+" / "+results.length+"：写入中与完成后字体一致（宋体）";});</script>');
}
