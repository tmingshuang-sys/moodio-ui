    const CD = {
      text: '<span style="font:600 13px/1 Georgia,serif">T</span>', h1: '<span style="font:600 11px/1 Georgia,serif">H1</span>', h2: '<span style="font:600 11px/1 Georgia,serif">H2</span>', h3: '<span style="font:600 11px/1 Georgia,serif">H3</span>',
      code: '<span style="font:600 12px/1 Menlo,monospace">{ }</span>', quote: '<span style="font:700 18px/1 Georgia,serif;margin-top:6px">“</span>',
      callout: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h16v11H4z"/><path d="M8 20h8M12 16v4"/></svg>',
      hr: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 12h16"/></svg>',
      grip: '<svg viewBox="0 0 24 24" class="icon"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
      chev: '<svg viewBox="0 0 24 24" class="icon chev"><path d="m9 6 6 6-6 6"/></svg>',
      caret: '<svg viewBox="0 0 24 24" class="icon caret"><path d="m7 10 5 5 5-5"/></svg>',
      align: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M4 12h12M4 18h16"/></svg>',
      indent: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M10 12h10M4 18h16"/><path d="m4 10 3 2-3 2"/></svg>',
      color: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 1-3 1-4a9 9 0 0 0-7-8z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16" cy="10" r="1"/></svg>',
      cut: '<svg viewBox="0 0 24 24" class="icon"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 8M8 16l12-8"/></svg>',
      copy: '<svg viewBox="0 0 24 24" class="icon"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
      translate: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h9M8.5 5v2c0 3-2 6-4.5 7M6 9c1 2.5 3 4.5 6 5.5M13 20l4-9 4 9M14.5 17h5"/></svg>',
      share: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 12h12M12 6l6 6-6 6M4 6v12"/></svg>',
      subdoc: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M12 11v6M9 14h6"/></svg>',
      link: '<svg viewBox="0 0 24 24" class="icon"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg>',
      plus: '<svg viewBox="0 0 24 24" class="icon"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>',
      more: '<svg viewBox="0 0 24 24" class="icon"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>'
    };
    const CDOC_BLOCK_TYPES = [
      { id: 'text', name: '文本', hint: '正文段落', icon: CD.text, kw: 'text p 正文 文本' },
      { id: 'h1', name: '标题 1', hint: '一级标题', icon: CD.h1, kw: 'h1 heading 标题' },
      { id: 'h2', name: '标题 2', hint: '二级标题', icon: CD.h2, kw: 'h2 heading 标题' },
      { id: 'h3', name: '标题 3', hint: '三级标题', icon: CD.h3, kw: 'h3 heading 标题' },
      { id: 'ol', name: '有序列表', hint: '1. 2. 3.', icon: CI.ol, kw: 'ol number 有序 列表 编号' },
      { id: 'ul', name: '无序列表', hint: '• 项目符号', icon: CI.ul, kw: 'ul bullet 无序 列表' },
      { id: 'todo', name: '任务', hint: '可勾选的待办', icon: CI.todo, kw: 'todo task 任务 待办 勾选' },
      { id: 'code', name: '代码块', hint: '等宽字体', icon: CD.code, kw: 'code 代码' },
      { id: 'quote', name: '引用', hint: '引用他人的话', icon: CD.quote, kw: 'quote 引用' },
      { id: 'callout', name: '高亮块', hint: '带底色的提示', icon: CD.callout, kw: 'callout 高亮 提示 备注' },
      { id: 'hr', name: '分割线', hint: '水平分割', icon: CD.hr, kw: 'hr divider 分割线', insertOnly: true },
      { id: 'table', name: '表格', hint: '3 × 3 表格', icon: CI.table, kw: 'table 表格', insertOnly: true },
      { id: 'image', name: '图片', hint: '上传本地图片', icon: CI.image, kw: 'image 图片 照片', insertOnly: true },
      { id: 'video', name: '视频', hint: '上传本地视频', icon: CI.video, kw: 'video 视频', insertOnly: true }
    ];
    const CDOC_TEXT_COLORS = [['', '默认'], ['#696764', '灰'], ['#b34d46', '红'], ['#c9762b', '橙'], ['#9a9a98', '黄'], ['#4a7a3a', '绿'], ['#191917', '青'], ['#2f6db3', '蓝'], ['#6b4fa3', '紫'], ['#c4478a', '粉']];
    const CDOC_BG_COLORS = [['', '无'], ['#f0f0ee', '灰'], ['#fde8e6', '红'], ['#fdebd9', '橙'], ['#fff3c4', '黄'], ['#e3f1de', '绿'], ['#dcefe9', '青'], ['#dfe9f7', '蓝'], ['#ebe3f6', '紫'], ['#fbe1ee', '粉']];
    const CDOC_BUILTIN_TEMPLATES = [
      { id: 'meeting', name: '会议纪要', hint: '时间、参会人、议题、结论、待办', html: '<h2>会议纪要</h2><p><b>时间：</b>　　<b>地点：</b>　　<b>记录：</b></p><p><b>参会人：</b></p><h3>议题</h3><ol><li>议题一</li><li>议题二</li></ol><h3>结论</h3><ul><li></li></ul><h3>待办</h3><ul class="cdoc-todo"><li><input type="checkbox" contenteditable="false"><span>待办事项 · 负责人 · 截止时间</span></li></ul>' },
      { id: 'character', name: '人物小传', hint: '基本信息、性格、动机、人物弧光', html: '<h2>人物小传</h2><table class="cdoc-table"><tbody><tr><td>姓名</td><td></td><td>年龄</td><td></td></tr><tr><td>职业</td><td></td><td>与主角关系</td><td></td></tr></tbody></table><h3>性格与外貌</h3><p></p><h3>动机与弱点</h3><p></p><h3>人物弧光</h3><p>开场时的状态 → 转折 → 结局时的变化</p>' },
      { id: 'scene', name: '场景设定', hint: '地点、时间、氛围、视觉关键词', html: '<h2>场景设定</h2><table class="cdoc-table"><tbody><tr><td>地点</td><td></td><td>时间</td><td></td></tr><tr><td>氛围</td><td></td><td>出场场次</td><td></td></tr></tbody></table><h3>视觉关键词</h3><ul><li></li></ul><h3>声音</h3><p></p><div class="cdoc-callout"><span class="cdoc-callout-icon" contenteditable="false">💡</span><div class="cdoc-callout-body">与美术 / 摄影确认的注意事项写在这里</div></div>' },
      { id: 'plan', name: '拍摄计划', hint: '按日期排布场次与地点', html: '<h2>拍摄计划</h2><table class="cdoc-table"><tbody><tr><td>日期</td><td>场次</td><td>地点</td><td>备注</td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table><h3>风险与备案</h3><ul><li></li></ul>' }
    ];
    const CDOC_TPL_KEY = 'moodio-cdoc-templates';
    function cdocUserTemplates() { try { return JSON.parse(localStorage.getItem(CDOC_TPL_KEY) || '[]'); } catch (_) { return []; } }
    function cdocSaveUserTemplates(list) { try { localStorage.setItem(CDOC_TPL_KEY, JSON.stringify(list)); } catch (_) {} }

    // —— 块工具 ——
    function cdocBlockOf(node) {
      const el0 = node?.nodeType === 3 ? node.parentElement : node;
      const sb = el0?.closest?.('.script-block'); if (sb) return sb;   // 剧本块
      const body = el0?.closest?.('[data-cdoc-body]'); if (!body) return null; let el = el0; while (el && el.parentElement !== body) el = el.parentElement; return el && el !== body ? el : null; }
    function blockHostOf(block) { return block?.closest?.('[data-cdoc-body]') || block?.closest?.('.script-paper') || null; }
    // —— 剧本撤回 / 重做：每次结构或文字变更（按停顿分组）记一条历史 ——
    const scriptHist = new Map();
    function shist(file) { if (!scriptHist.has(file.id)) scriptHist.set(file.id, { past: [], future: [] }); return scriptHist.get(file.id); }
    let scriptRestoring = false, scriptTypingTimer = null;
    function scriptEnsureBaseline(el) { const paper = el?.closest?.('[data-paper]'); const file = findFile(paper?.dataset.pageFile); if (!file || !paper?.classList.contains('script-paper')) return; const h = shist(file); if (h.baseline == null) h.baseline = JSON.stringify(file.scriptBlocks || []); }
    ['keydown', 'paste', 'cut', 'beforeinput'].forEach(type => document.addEventListener(type, event => { const root = event.target?.closest?.('.script-paper [data-script-blocks]'); if (root) scriptEnsureBaseline(root); }, true));
    function scriptChanged(el) {
      const paper = el?.closest?.('[data-paper]'); const file = findFile(paper?.dataset.pageFile); if (!paper || !file) return;
      $$('.script-block', paper).forEach(b => b.classList.toggle('is-empty', !b.innerText.trim()));
      const h = shist(file); if (h.baseline == null) h.baseline = JSON.stringify(file.scriptBlocks || []);   // 基线：上一次记入历史时的状态（模型可能已被即时同步更新）
      captureScriptBlocks(paper, file);
      const now = JSON.stringify(file.scriptBlocks || []);
      if (now !== h.baseline) { h.past.push(h.baseline); if (h.past.length > 100) h.past.shift(); h.future = []; h.baseline = now; }
      try { fillContextSections(); } catch (_) {} markSaving();
    }
    function scriptUndo(paper, file, redo = false) {
      clearTimeout(scriptTypingTimer); scriptChanged(paper.querySelector('.script-block') || paper);   // 先把未落盘的输入记入历史
      const h = shist(file), from = redo ? h.future : h.past, to = redo ? h.past : h.future; if (!from.length) return false;
      const focusedId = scriptBlockFromSelection()?.dataset.scriptId;
      to.push(JSON.stringify(file.scriptBlocks || [])); file.scriptBlocks = JSON.parse(from.pop()); h.baseline = JSON.stringify(file.scriptBlocks);
      file.editableText = file.editableText || {}; file.scriptBlocks.forEach(b => { file.editableText[`script:${b.id}`] = b.text; });
      scriptRestoring = true; try { render(); } finally { scriptRestoring = false; }
      const target = focusedId && $(`[data-paper][data-page-file="${file.id}"] [data-script-id="${focusedId}"]`); if (target) scriptFocusBlock(target, true);
      try { fillContextSections(); } catch (_) {} persistWorkspace(); return true;
    }
    function blockHostChanged(el) { const host = blockHostOf(el); if (!host) return; if (host.matches('.script-paper')) scriptChanged(el); else cdocChanged(el); }
    function scriptNewBlockHtml(type, text = '') { const id = (type === 'scene' ? 'sc-' : 'b-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); return renderScriptBlock(id, text, type); }
    function scriptFocusBlock(el, atEnd = false) { if (!el) return; const root = el.closest('[contenteditable="true"]'); if (root && document.activeElement !== root) root.focus({ preventScroll: true }); const r = document.createRange(); const target = el.lastChild?.nodeName === 'BR' && el.childNodes.length === 1 ? null : null; r.selectNodeContents(el); r.collapse(!atEnd); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    function applyScriptFormatTo(block, type) {
      const format = screenplayFormats.find(f => f.id === type); if (!block || !format) return;
      const paper = block.closest('[data-paper]'), fileId = paper?.dataset.pageFile || 'script';
      state.formatAssignments[`${fileId}:${block.dataset.scriptId}`] = type;
      screenplayFormats.forEach(f => { if (f.className) block.classList.remove(f.className); }); if (format.className) block.classList.add(format.className);
      block.classList.toggle('scene-heading-text', type === 'scene');
      block.dataset.formatType = type; block.dataset.placeholder = SCRIPT_PLACEHOLDER[type] || '';
      scriptChanged(block);
    }
    function scriptNextType(type) { return ({ scene: 'action', action: 'action', character: 'dialogue', dialogue: 'character', paren: 'dialogue', transition: 'scene', subtitle: 'action' })[type] || 'action'; }
    function scriptCycleType(type, back = false) { const order = ['action', 'character', 'dialogue', 'paren', 'scene', 'transition']; const i = order.indexOf(type); return order[(i + (back ? order.length - 1 : 1)) % order.length]; }
    function scriptCreateShotFromBlock(block) {
      if (!state.storyboardEnabled) return showToast('请先开启“识别分镜”');
      const r = document.createRange(); r.selectNodeContents(block); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const src = sourceSelection(); if (src) savedShotSelection = src; createShotFromSelection();
    }
    function cdocBlockType(block) {
      if (!block) return 'text';
      if (block.classList?.contains('script-block')) return block.dataset.formatType || 'action';
      const tag = block.tagName;
      if (tag === 'H1') return 'h1'; if (tag === 'H2') return 'h2'; if (tag === 'H3') return 'h3';
      if (tag === 'UL') return block.classList.contains('cdoc-todo') ? 'todo' : 'ul'; if (tag === 'OL') return 'ol';
      if (tag === 'PRE') return 'code'; if (tag === 'BLOCKQUOTE') return 'quote'; if (tag === 'HR') return 'hr'; if (tag === 'TABLE') return 'table';
      if (tag === 'FIGURE') return block.dataset.kind === 'video' ? 'video' : 'image'; if (block.classList.contains('cdoc-callout')) return 'callout';
      return 'text';
    }
    function cdocBlockIcon(type) { const st = SCRIPT_TYPES.find(t => t[0] === type); if (st) return `<span style="font:600 11px/1 var(--font-ui)">${st[2]}</span>`; return (CDOC_BLOCK_TYPES.find(t => t.id === type) || CDOC_BLOCK_TYPES[0]).icon; }
    function cdocNewBlockHtml(type, inner = '') {
      const c = inner || '<br>';
      if (type === 'h1' || type === 'h2' || type === 'h3') return `<${type}>${c}</${type}>`;
      if (type === 'ol') return `<ol><li>${c}</li></ol>`; if (type === 'ul') return `<ul><li>${c}</li></ul>`;
      if (type === 'todo') return `<ul class="cdoc-todo"><li><input type="checkbox" contenteditable="false"><span>${inner || '&#8203;'}</span></li></ul>`;
      if (type === 'code') return `<pre>${c}</pre>`; if (type === 'quote') return `<blockquote>${c}</blockquote>`;
      if (type === 'callout') return `<div class="cdoc-callout"><span class="cdoc-callout-icon" contenteditable="false">💡</span><div class="cdoc-callout-body">${c}</div></div>`;
      if (type === 'hr') return '<hr>'; if (type === 'table') return `<table class="cdoc-table"><tbody>${('<tr>' + '<td><br></td>'.repeat(3) + '</tr>').repeat(3)}</tbody></table>`;
      return `<p>${c}</p>`;
    }
    function cdocBlockInner(block) {
      const type = cdocBlockType(block);
      if (type === 'ul' || type === 'ol') return Array.from(block.children).map(li => li.innerHTML).join('<br>');
      if (type === 'todo') return Array.from(block.querySelectorAll('li > span')).map(sp => sp.innerHTML).join('<br>');
      if (type === 'callout') return block.querySelector('.cdoc-callout-body')?.innerHTML || '';
      if (type === 'code') return escapeHtml(block.innerText).replace(/\n/g, '<br>');
      if (type === 'hr' || type === 'table' || type === 'image' || type === 'video') return null;
      return block.innerHTML;
    }
    function cdocConvertBlock(block, type) {
      const inner = cdocBlockInner(block); if (inner === null) return block;
      const def = CDOC_BLOCK_TYPES.find(t => t.id === type); if (!def || def.insertOnly) return block;
      const holder = document.createElement('div'); holder.innerHTML = cdocNewBlockHtml(type, inner.replace(/<br>\s*$/, '') || '');
      const el = holder.firstElementChild; block.replaceWith(el); return el;
    }
    function cdocFocusBlock(el) {
      const target = el.matches('.cdoc-callout') ? el.querySelector('.cdoc-callout-body') : el.matches('ul.cdoc-todo') ? el.querySelector('li > span') : el.matches('ul, ol') ? el.querySelector('li') : el.matches('table') ? el.querySelector('td') : el;
      if (!target) return; const r = document.createRange(); r.selectNodeContents(target); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); cdocRange = r.cloneRange();
    }
    function cdocInsertBlockAfter(block, type, body) {
      if (type === 'image' || type === 'video') { cdocFocusBlock(block); return cdocPickFiles(body, type === 'image' ? 'image/*' : 'video/*'); }
      block.insertAdjacentHTML('afterend', cdocNewBlockHtml(type)); const el = block.nextElementSibling; cdocFocusBlock(el); cdocChanged(body); return el;
    }

    // —— “/” 菜单 ——
    let cdocSlash = null;   // { body, node, start, filter, index }
    function cdocSlashEl() { let el = $('#cdoc-slash'); if (!el) { document.body.insertAdjacentHTML('beforeend', '<div class="cdoc-slash hidden" id="cdoc-slash" role="menu"></div>'); el = $('#cdoc-slash'); } return el; }
    const SCRIPT_SLASH = [
      { id: 'scene', name: '场景标题', hint: 'INT./EXT. 地点 - 时间', icon: '<span style="font:600 12px/1 var(--font-ui)">场</span>', kw: 'scene int ext 场景 场次 标题' },
      { id: 'action', name: '动作', hint: '画面与动作描述', icon: '<span style="font:600 12px/1 var(--font-ui)">动</span>', kw: 'action 动作 描述' },
      { id: 'character', name: '人物', hint: '说话的人物名', icon: '<span style="font:600 12px/1 var(--font-ui)">人</span>', kw: 'character 人物 角色' },
      { id: 'dialogue', name: '对白', hint: '台词', icon: '<span style="font:600 12px/1 var(--font-ui)">白</span>', kw: 'dialogue 对白 台词' },
      { id: 'paren', name: '括号提示', hint: '（语气 / 动作）', icon: '<span style="font:600 12px/1 var(--font-ui)">括</span>', kw: 'paren 括号 提示' },
      { id: 'transition', name: '转场', hint: 'CUT TO: / 淡出', icon: '<span style="font:600 12px/1 var(--font-ui)">转</span>', kw: 'transition 转场 cut' },
      { id: 'shot', name: '创建分镜', hint: '用当前段落生成一个镜头', icon: '<span style="font:600 12px/1 var(--font-ui)">镜</span>', kw: 'shot 分镜 镜头 storyboard' }
    ];
    function cdocSlashItems(filter) { const q = (filter || '').toLowerCase(); const list = cdocSlash?.mode === 'script' ? SCRIPT_SLASH : CDOC_BLOCK_TYPES; return list.filter(t => !q || t.kw.toLowerCase().includes(q) || t.name.includes(q)); }
    function cdocSlashClose() { cdocSlash = null; $('#cdoc-slash')?.classList.add('hidden'); }
    function cdocSlashRender() {
      if (!cdocSlash) return; const el = cdocSlashEl(), items = cdocSlashItems(cdocSlash.filter);
      cdocSlash.index = Math.min(cdocSlash.index || 0, Math.max(0, items.length - 1));
      el.innerHTML = `<div class="cdoc-slash-head">${cdocSlash.filter ? `匹配“${escapeHtml(cdocSlash.filter)}”` : (cdocSlash.mode === 'script' ? '剧本格式 · ↑↓ 选择，回车应用' : '基础块 · ↑↓ 选择，回车插入')}</div>` + (items.length ? items.map((t, i) => `<button type="button" class="cdoc-slash-item ${i === cdocSlash.index ? 'active' : ''}" data-cdoc-slash-pick="${t.id}"><span class="cdoc-slash-icon">${t.icon}</span><span>${t.name}<small>${t.hint}</small></span></button>`).join('') : '<div class="cdoc-slash-empty">没有匹配的内容，继续输入或按 Esc 关闭</div>');
      const sel = window.getSelection(); let rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
      if (!rect || (!rect.width && !rect.height)) rect = cdocBlockOf(cdocSlash.node)?.getBoundingClientRect() || { left: 100, bottom: 100, top: 80 };
      cdocPlace(el, rect, 8);
    }
    function cdocSlashCheck(body, mode = 'doc') {
      const sel = window.getSelection(); if (!sel.rangeCount) return cdocSlashClose();
      const r = sel.getRangeAt(0); if (!r.collapsed || !body.contains(r.startContainer) || r.startContainer.nodeType !== 3) return cdocSlashClose();
      const text = r.startContainer.textContent.slice(0, r.startOffset), idx = text.lastIndexOf('/');
      if (idx < 0 || (idx > 0 && !/\s/.test(text[idx - 1]))) return cdocSlashClose();
      const filter = text.slice(idx + 1); if (/\s/.test(filter) || filter.length > 20) return cdocSlashClose();
      cdocSlash = { body, node: r.startContainer, start: idx, filter, index: cdocSlash?.index || 0, mode };
      cdocSlashRender();
    }
    function cdocSlashPick(type) {
      if (!cdocSlash) return;
      if (cdocSlash.mode === 'script') {   // 剧本：删掉 “/关键字” 后应用格式或创建分镜
        const { node, start } = cdocSlash; const block = node.parentElement?.closest('.script-block'); cdocSlashClose(); if (!block) return;
        const tail = node.textContent.slice(start).match(/^\/[^\s\/]*/); const del = document.createRange(); del.setStart(node, start); del.setEnd(node, start + (tail ? tail[0].length : 1)); del.deleteContents();
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(del);
        if (type === 'shot') { if (!block.innerText.trim()) return showToast('这一段还没有内容'); return scriptCreateShotFromBlock(block); }
        applyScriptFormatTo(block, type); block.focus(); return;
      }
      const { body, node, start } = cdocSlash; cdocSlashClose();
      // 删掉 “/关键字”
      const end = Math.min(node.textContent.length, start + 1 + (cdocSlash?.filter?.length || 0));
      const del = document.createRange(); del.setStart(node, start); del.setEnd(node, node.textContent.length >= end ? Math.max(end, start + 1) : node.textContent.length);
      const tail = node.textContent.slice(start).match(/^\/[^\s\/]*/); del.setEnd(node, start + (tail ? tail[0].length : 1)); del.deleteContents();
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(del); cdocRange = del.cloneRange();
      const block = cdocBlockOf(node) || body.lastElementChild;
      const def = CDOC_BLOCK_TYPES.find(t => t.id === type);
      if (def?.insertOnly) {
        if (type === 'image' || type === 'video') return cdocPickFiles(body, type === 'image' ? 'image/*' : 'video/*');
        const empty = block && !block.innerText.trim() && !block.querySelector('img, video, table, hr');
        if (empty) { block.insertAdjacentHTML('afterend', cdocNewBlockHtml(type) + '<p><br></p>'); const next = block.nextElementSibling; block.remove(); cdocFocusBlock(next.matches('table') ? next : next.nextElementSibling || next); }
        else { block.insertAdjacentHTML('afterend', cdocNewBlockHtml(type) + '<p><br></p>'); cdocFocusBlock(block.nextElementSibling.nextElementSibling || block.nextElementSibling); }
        body.focus(); cdocChanged(body); return;
      }
      if (block) { const el = cdocConvertBlock(block, type); cdocFocusBlock(el); }
      body.focus(); cdocChanged(body);
    }

    // —— 块手柄与块菜单 ——
    let cdocHoverBlock = null, cdocMenuBlock = null, cdocDragBlock = null;
    function cdocHandleEl() { let el = $('#cdoc-block-handle'); if (!el) { document.body.insertAdjacentHTML('beforeend', `<div class="cdoc-block-handle hidden" id="cdoc-block-handle" title="点击打开块菜单 · 拖动排序"><span class="cdoc-bh-type"></span><span class="cdoc-bh-grip" draggable="true">${CD.grip}</span></div>`); el = $('#cdoc-block-handle'); } return el; }
    function cdocShowHandle(block) {
      const el = cdocHandleEl(), r = block.getBoundingClientRect();
      cdocHoverBlock = block; $('.cdoc-bh-type', el).innerHTML = cdocBlockIcon(cdocBlockType(block));
      el.classList.remove('hidden'); el.style.left = Math.max(4, r.left - 50) + 'px'; el.style.top = (r.top + Math.min(4, Math.max(0, (r.height - 26) / 2))) + 'px';
    }
    function cdocHideHandle() { if ($('#cdoc-block-menu') && !$('#cdoc-block-menu').classList.contains('hidden')) return; $('#cdoc-block-handle')?.classList.add('hidden'); cdocHoverBlock = null; }
    document.addEventListener('mousemove', event => {
      if (cdocDragBlock) return;
      if (event.target.closest?.('#cdoc-block-handle, #cdoc-block-menu')) return;
      const body = event.target.closest?.('[data-cdoc-body]');   // 剧本稿纸不显示块手柄
      if (!body) { if (!event.target.closest?.('.paper.doc-clean')) cdocHideHandle(); return; }
      const block = cdocBlockOf(event.target); if (!block) return;
      if (block !== cdocHoverBlock) cdocShowHandle(block);
    });
    document.addEventListener('scroll', () => { $('#cdoc-block-handle')?.classList.add('hidden'); cdocHoverBlock = null; cdocCloseBlockMenu(); cdocSlashClose(); cdocFloatHide(); }, true);
    function cdocMenuEl() { let el = $('#cdoc-block-menu'); if (!el) { document.body.insertAdjacentHTML('beforeend', '<div class="cdoc-block-menu hidden" id="cdoc-block-menu" role="menu"></div>'); el = $('#cdoc-block-menu'); } return el; }
    function cdocCloseBlockMenu() { const m = $('#cdoc-block-menu'); if (m) moodioMenuFx.close(m, () => m.classList.add('hidden')); if (cdocMenuBlock) { cdocMenuBlock.classList.remove('cdoc-block-active'); cdocMenuBlock = null; } }
    function cdocOpenBlockMenu(block, anchorRect) {
      const el = cdocMenuEl(), type = cdocBlockType(block), convertible = block.classList.contains('script-block') ? true : cdocBlockInner(block) !== null;
      cdocMenuBlock = block; block.classList.add('cdoc-block-active');
      const item = (act, icon, label, extra = '', cls = '') => `<button type="button" class="cdoc-bm-item ${cls}" data-cdoc-bm="${act}" ${extra}>${icon}<span>${label}</span>${act.startsWith('sub:') ? CD.chev : ''}</button>`;
      if (block.classList.contains('script-block')) {
        el.innerHTML = `
          <div class="cdoc-bm-types script-types">${SCRIPT_TYPES.map(([id, name, glyph]) => `<button type="button" class="${id === type ? 'active' : ''}" data-cdoc-bm-type="${id}" title="${name}"><span style="font:600 12px/1 var(--font-ui)">${glyph}</span></button>`).join('')}</div>
          ${item('script-shot', CI.comment.replace('M4 5h16v11H9l-5 4z', 'M4 5h16v11H9l-5 4z'), '创建分镜', state.storyboardEnabled && block.innerText.trim() ? '' : 'disabled')}
          <div class="cdoc-bm-group">${item('cut', CD.cut, '剪切')}${item('copy', CD.copy, '复制')}${item('delete', CI.clear, '删除', '', 'danger')}</div>
          <div class="cdoc-bm-group">${item('sub:add', CD.plus, '在下方添加')}
          <div class="cdoc-bm-sub" data-cdoc-bm-sub="add">${SCRIPT_TYPES.map(([id, name, glyph]) => `<button type="button" class="cdoc-bm-item" data-cdoc-bm-add="${id}"><span style="font:600 11px/1 var(--font-ui);width:15px;text-align:center">${glyph}</span><span>${name}</span></button>`).join('')}</div></div>`;
        el.classList.remove('hidden');
        const w = el.offsetWidth, h = el.offsetHeight, left = anchorRect.left - w - 8 >= 8 ? anchorRect.left - w - 8 : anchorRect.right + 8;
        el.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
        el.style.top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - h - 8)) + 'px';
        moodioMenuFx.open(el);
        return;
      }
      const colorRow = (kind, list, label) => `<div class="cdoc-bm-colors"><span>${label}</span>${list.map(([c, n]) => `<button type="button" style="background:${c || '#fff'}" data-cdoc-bm-color="${kind}" data-color="${c}" title="${n}" class="${c ? '' : 'clear'}"></button>`).join('')}</div>`;
      el.innerHTML = `
        <div class="cdoc-bm-types">${CDOC_BLOCK_TYPES.filter(t => !t.insertOnly).map(t => `<button type="button" class="${t.id === type ? 'active' : ''}" data-cdoc-bm-type="${t.id}" title="${t.name}" ${convertible ? '' : 'disabled'}>${t.icon}</button>`).join('')}</div>
        ${item('sub:align', CD.align, '缩进和对齐')}
        <div class="cdoc-bm-sub" data-cdoc-bm-sub="align">${item('indent+', CD.indent, '增加缩进')}${item('indent-', CI.outdent, '减少缩进')}${item('align:left', CI.left, '左对齐')}${item('align:center', CI.center, '居中')}${item('align:right', CI.right, '右对齐')}</div>
        ${item('sub:color', CD.color, '颜色')}
        <div class="cdoc-bm-sub" data-cdoc-bm-sub="color">${colorRow('fg', CDOC_TEXT_COLORS, '文字颜色')}${colorRow('bg', CDOC_BG_COLORS, '背景颜色')}</div>
        <div class="cdoc-bm-group">${item('comment', CI.comment, '评论')}${item('cut', CD.cut, '剪切')}${item('copy', CD.copy, '复制')}${item('translate', CD.translate, '翻译')}${item('delete', CI.clear, '删除', '', 'danger')}</div>
        <div class="cdoc-bm-group">${item('share', CD.share, '分享')}${item('subdoc', CD.subdoc, '转换为子文档')}${item('template', BK_TEMPLATE_ICON, '保存为模板')}${item('copylink', CD.link, '复制链接')}</div>
        <div class="cdoc-bm-group">${item('sub:add', CD.plus, '在下方添加')}
        <div class="cdoc-bm-sub" data-cdoc-bm-sub="add">${CDOC_BLOCK_TYPES.map(t => `<button type="button" class="cdoc-bm-item" data-cdoc-bm-add="${t.id}">${t.icon}<span>${t.name}</span></button>`).join('')}</div></div>`;
      el.classList.remove('hidden');
      const w = el.offsetWidth, h = el.offsetHeight, left = anchorRect.left - w - 8 >= 8 ? anchorRect.left - w - 8 : anchorRect.right + 8;
      el.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
      el.style.top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - h - 8)) + 'px';
      moodioMenuFx.open(el);
    }
    function cdocBlockRange(block) { const r = document.createRange(); r.selectNodeContents(block); return r; }
    document.addEventListener('click', event => {
      const t = event.target;
      // 手柄
      if (t.closest('#cdoc-block-handle')) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!cdocHoverBlock || !document.contains(cdocHoverBlock)) return cdocHideHandle();
        const menu = $('#cdoc-block-menu');
        if (menu && !menu.classList.contains('hidden') && cdocMenuBlock === cdocHoverBlock) return cdocCloseBlockMenu();
        cdocCloseBlockMenu(); cdocFloatHide(); cdocOpenBlockMenu(cdocHoverBlock, $('#cdoc-block-handle').getBoundingClientRect()); return;
      }
      // 块菜单
      if (t.closest('#cdoc-block-menu')) {
        event.preventDefault(); event.stopImmediatePropagation();
        const block = cdocMenuBlock; if (!block || !document.contains(block)) return cdocCloseBlockMenu();
        const typeBtn = t.closest('[data-cdoc-bm-type]'), sub = t.closest('[data-cdoc-bm^="sub:"]'), color = t.closest('[data-cdoc-bm-color]'), add = t.closest('[data-cdoc-bm-add]'), act = t.closest('[data-cdoc-bm]')?.dataset.cdocBm;
        if (block.classList.contains('script-block')) {   // 剧本块菜单
          if (typeBtn) { applyScriptFormatTo(block, typeBtn.dataset.cdocBmType); cdocCloseBlockMenu(); cdocShowHandle(block); return; }
          if (sub) { const key = sub.dataset.cdocBm.slice(4); const panel = $(`[data-cdoc-bm-sub="${key}"]`, $('#cdoc-block-menu')); const open = !panel.classList.contains('open'); $$('.cdoc-bm-sub', $('#cdoc-block-menu')).forEach(p => p.classList.remove('open')); if (open) { panel.classList.add('open'); sub.setAttribute('aria-expanded', 'true'); } return; }
          if (add) { cdocCloseBlockMenu(); block.insertAdjacentHTML('afterend', scriptNewBlockHtml(add.dataset.cdocBmAdd)); const el = block.nextElementSibling; scriptFocusBlock(el); scriptChanged(block); return; }
          if (act === 'script-shot') { cdocCloseBlockMenu(); scriptCreateShotFromBlock(block); return; }
          if (act === 'copy' || act === 'cut') { navigator.clipboard?.writeText(block.innerText).catch(() => {}); cdocCloseBlockMenu(); cdocHideHandle(); if (act === 'cut') { const paper = block.closest('[data-paper]'); block.remove(); scriptChanged(paper.querySelector('.script-block') || paper); } return; }
          if (act === 'delete') { const paper = block.closest('[data-paper]'); const prev = block.previousElementSibling; block.remove(); cdocCloseBlockMenu(); cdocHideHandle(); scriptChanged(paper.querySelector('.script-block') || paper); if (prev?.classList.contains('script-block')) scriptFocusBlock(prev, true); return; }
          return;
        }
        const body = block.closest('[data-cdoc-body]'), file = cdocFileOf(body);
        if (typeBtn) { if (typeBtn.disabled) return; const el = cdocConvertBlock(block, typeBtn.dataset.cdocBmType); cdocCloseBlockMenu(); cdocChanged(body); cdocShowHandle(el); return; }
        if (sub) { const key = sub.dataset.cdocBm.slice(4); const panel = $(`[data-cdoc-bm-sub="${key}"]`, $('#cdoc-block-menu')); const open = !panel.classList.contains('open'); $$('.cdoc-bm-sub', $('#cdoc-block-menu')).forEach(p => p.classList.remove('open')); $$('[data-cdoc-bm^="sub:"]', $('#cdoc-block-menu')).forEach(b => b.setAttribute('aria-expanded', 'false')); if (open) { panel.classList.add('open'); sub.setAttribute('aria-expanded', 'true'); } return; }
        if (color) { const c = color.dataset.color; if (color.dataset.cdocBmColor === 'fg') block.style.color = c; else { block.style.background = c; block.style.padding = c ? '6px 10px' : ''; block.style.borderRadius = c ? '6px' : ''; } cdocChanged(body); return; }
        if (add) { cdocCloseBlockMenu(); cdocInsertBlockAfter(block, add.dataset.cdocBmAdd, body); return; }
        if (act === 'indent+' || act === 'indent-') { const cur = parseInt(block.style.marginLeft) || 0; block.style.marginLeft = Math.max(0, cur + (act === 'indent+' ? 24 : -24)) + 'px'; if (block.style.marginLeft === '0px') block.style.marginLeft = ''; cdocChanged(body); return; }
        if (act?.startsWith('align:')) { const a = act.slice(6); block.style.textAlign = a === 'left' ? '' : a; cdocChanged(body); return; }
        if (act === 'comment') { cdocCloseBlockMenu(); const r = cdocBlockRange(block); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); cdocRange = r.cloneRange(); cdocAddComment(body); return; }
        if (act === 'copy' || act === 'cut') { const text = block.innerText; navigator.clipboard?.writeText(text).catch(() => {}); if (act === 'cut') { block.remove(); cdocChanged(body); } cdocCloseBlockMenu(); cdocHideHandle(); showToast(act === 'cut' ? '已剪切该块' : '已复制该块内容'); return; }
        if (act === 'translate') { cdocCloseBlockMenu(); showToast('翻译需要连接 AI 服务，离线原型暂不可用'); return; }
        if (act === 'delete') { block.remove(); cdocCloseBlockMenu(); cdocHideHandle(); if (!body.children.length) body.innerHTML = ''; cdocChanged(body); showToast('已删除该块'); return; }
        if (act === 'share' || act === 'copylink') { const idx = Array.from(body.children).indexOf(block); const link = `${location.origin}${location.pathname}#doc=${file?.id || ''}&block=${idx + 1}`; navigator.clipboard?.writeText(link).catch(() => {}); cdocCloseBlockMenu(); showToast(act === 'share' ? '已复制分享链接（原型：仅本机可用）' : '已复制该块链接'); return; }
        if (act === 'subdoc') {
          cdocCloseBlockMenu(); if (!file) return;
          const title = (block.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 24) || '子文档';
          const sub = addFile('custom', { title, preview: '由文档块转换' }); sub.kind = 'doc'; sub.lineageId = sub.id; sub.parentDocId = file.id; sub.docHtml = block.outerHTML.replace(/ class="cdoc-block-active"/, ''); sub.comments = []; sub.updatedAt = Date.now();
          block.outerHTML = `<p class="cdoc-subdoc-link" contenteditable="false">${CD.subdoc}<a href="#" data-cdoc-open-file="${sub.id}">${escapeHtml(title)}</a><small>子文档</small></p>`;
          cdocChanged(body); renderWritingPanel?.(); showToast(`已转换为子文档「${title}」，点击卡片可打开`); return;
        }
        if (act === 'template') {
          cdocCloseBlockMenu();
          openFlowDialog('保存为模板', `<label>模板名称<input id="cdoc-tpl-name" maxlength="30" value="${escapeHtml((block.innerText || '').trim().slice(0, 12) || '我的模板')}"></label><p>保存后可在空文档的「选择模板」里使用。</p>`, flowButton('close-dialog', '取消') + flowButton('cdoc-save-template', '保存', '', true));
          $('#cdoc-tpl-name').dataset.html = block.outerHTML.replace(/ class="cdoc-block-active"/, ''); setTimeout(() => $('#cdoc-tpl-name')?.select(), 30); return;
        }
        return;
      }
      // 模板保存 / 选择
      if (t.closest('[data-flow="cdoc-save-template"]')) {
        event.preventDefault(); event.stopImmediatePropagation();
        const input = $('#cdoc-tpl-name'); const list = cdocUserTemplates(); list.push({ id: 't' + Date.now().toString(36), name: input.value.trim() || '我的模板', html: input.dataset.html }); cdocSaveUserTemplates(list); closeFlowDialog(); showToast('模板已保存'); return;
      }
      if (t.closest('[data-cdoc-templates]')) {
        event.preventDefault(); event.stopImmediatePropagation();
        const paper = t.closest('[data-paper]'); cdocOpenTemplates(paper?.dataset.pageFile); return;
      }
      const tpl = t.closest('[data-cdoc-tpl]');
      if (tpl) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (t.closest('.tpl-del')) { cdocSaveUserTemplates(cdocUserTemplates().filter(x => x.id !== tpl.dataset.cdocTpl)); cdocOpenTemplates($('#cdoc-template-grid')?.dataset.forFile); return; }
        const fileId = $('#cdoc-template-grid')?.dataset.forFile; const body = $(`[data-paper][data-page-file="${fileId}"] [data-cdoc-body]`); closeFlowDialog(); if (!body) return;
        const def = CDOC_BUILTIN_TEMPLATES.find(x => x.id === tpl.dataset.cdocTpl) || cdocUserTemplates().find(x => x.id === tpl.dataset.cdocTpl); if (!def) return;
        body.innerHTML = def.html; body.focus(); cdocChanged(body); showToast(`已应用模板「${def.name}」`); return;
      }
      // “/” 菜单点击
      const pick = t.closest('[data-cdoc-slash-pick]');
      if (pick) { event.preventDefault(); event.stopImmediatePropagation(); cdocSlashPick(pick.dataset.cdocSlashPick); return; }
      // 子文档卡片
      const openFile = t.closest('[data-cdoc-open-file]');
      if (openFile) { event.preventDefault(); event.stopImmediatePropagation(); if (findFile(openFile.dataset.cdocOpenFile)) selectFile(openFile.dataset.cdocOpenFile); else showToast('子文档已不存在'); return; }
      // 浮动工具条的下拉
      const fp = t.closest('[data-cdoc-fpop]');
      if (fp) { event.preventDefault(); event.stopImmediatePropagation(); cdocFloatPop(fp); return; }
      const fpick = t.closest('[data-cdoc-fpick]');
      if (fpick) {
        event.preventDefault(); event.stopImmediatePropagation();
        const paper = cdocRangePaper(), body = paper && $('[data-cdoc-body]', paper); $('#cdoc-float-pop')?.classList.add('hidden'); if (!body) return;
        const [kind, val] = fpick.dataset.cdocFpick.split('|');
        if (kind === 'block') { cdocRestore(body); const block = cdocBlockOf(cdocRange.startContainer); if (block) { const el = cdocConvertBlock(block, val); cdocFocusBlock(el); } cdocChanged(body); }
        else if (kind === 'align') cdocExec(body, val, null, false);
        else if (kind === 'fg') cdocExec(body, 'foreColor', val || '#191917');
        else if (kind === 'bg') cdocExec(body, 'hiliteColor', val || 'transparent');
        else if (kind === 'insert') { if (val === 'image' || val === 'video') { cdocRestore(body); cdocPickFiles(body, val === 'image' ? 'image/*' : 'video/*'); } else { cdocRestore(body); const block = cdocBlockOf(cdocRange.startContainer) || body.lastElementChild; if (block) cdocInsertBlockAfter(block, val, body); } }
        cdocFloatHide(); return;
      }
      if (!t.closest('#cdoc-block-menu, #cdoc-block-handle')) cdocCloseBlockMenu();
      if (!t.closest('#cdoc-slash')) cdocSlashClose();
      if (!t.closest('#cdoc-float, #cdoc-float-pop')) $('#cdoc-float-pop')?.classList.add('hidden');
    }, true);
    function cdocOpenTemplates(fileId) {
      const mine = cdocUserTemplates();
      const card = (tp, del) => `<button class="import-target" data-cdoc-tpl="${tp.id}"><span class="writing-doc-icon">${BK_TEMPLATE_ICON}</span><span><strong>${escapeHtml(tp.name)}</strong><small>${escapeHtml(tp.hint || '我的模板')}</small></span>${del ? `<span class="tpl-del" role="button" title="删除模板">${CI.close}</span>` : ''}</button>`;
      openFlowDialog('选择模板', `<div class="cdoc-template-grid" id="cdoc-template-grid" data-for-file="${fileId || ''}">${CDOC_BUILTIN_TEMPLATES.map(tp => card(tp, false)).join('')}</div>${mine.length ? `<div class="cdoc-template-title">我的模板</div><div class="cdoc-template-grid">${mine.map(tp => card(tp, true)).join('')}</div>` : '<div class="cdoc-template-title">在任意块的菜单里选「保存为模板」，就会出现在这里。</div>'}`, flowButton('close-dialog', '取消'));
    }

    // —— 块拖拽排序 ——
    document.addEventListener('dragstart', event => {
      if (!event.target.closest?.('#cdoc-block-handle .cdoc-bh-grip') || !cdocHoverBlock) return;
      event.stopImmediatePropagation(); cdocDragBlock = cdocHoverBlock; cdocCloseBlockMenu();
      event.dataTransfer.setData('text/plain', 'cdoc-block'); event.dataTransfer.effectAllowed = 'move';
      try { event.dataTransfer.setDragImage(cdocDragBlock, 20, 10); } catch (_) {}
    }, true);
    document.addEventListener('dragover', event => {
      if (!cdocDragBlock) return; const block = cdocBlockOf(event.target); if (!block || blockHostOf(block) !== blockHostOf(cdocDragBlock)) return;
      event.preventDefault(); event.stopImmediatePropagation(); event.dataTransfer.dropEffect = 'move';
      $$('.cdoc-drop-before, .cdoc-drop-after').forEach(el => el.classList.remove('cdoc-drop-before', 'cdoc-drop-after'));
      if (block === cdocDragBlock) return; const r = block.getBoundingClientRect(); block.classList.add(event.clientY < r.top + r.height / 2 ? 'cdoc-drop-before' : 'cdoc-drop-after');
    }, true);
    document.addEventListener('drop', event => {
      if (!cdocDragBlock) return; const block = cdocBlockOf(event.target); const body = blockHostOf(cdocDragBlock);
      if (block && block !== cdocDragBlock && blockHostOf(block) === body) { event.preventDefault(); event.stopImmediatePropagation(); const r = block.getBoundingClientRect(); block.insertAdjacentElement(event.clientY < r.top + r.height / 2 ? 'beforebegin' : 'afterend', cdocDragBlock); blockHostChanged(cdocDragBlock); }
      $$('.cdoc-drop-before, .cdoc-drop-after').forEach(el => el.classList.remove('cdoc-drop-before', 'cdoc-drop-after')); cdocDragBlock = null; cdocHideHandle();
    }, true);
    document.addEventListener('dragend', () => { if (!cdocDragBlock) return; $$('.cdoc-drop-before, .cdoc-drop-after').forEach(el => el.classList.remove('cdoc-drop-before', 'cdoc-drop-after')); cdocDragBlock = null; }, true);

    // —— 选区浮动工具条 ——
    function cdocFloatEl() {
      let el = $('#cdoc-float');
      if (!el) {
        const b = (cmd, label, inner, extra = '') => `<button type="button" class="cdoc-tool ${extra}" data-cdoc-cmd="${cmd}" title="${label}" aria-label="${label}">${inner}</button>`;
        const dd = (kind, label, inner) => `<button type="button" class="cdoc-tool has-caret" data-cdoc-fpop="${kind}" title="${label}" aria-label="${label}">${inner}${CD.caret}</button>`;
        document.body.insertAdjacentHTML('beforeend', `<div class="cdoc-float hidden" id="cdoc-float" role="toolbar">${dd('block', '文本样式', CD.text)}<span class="cdoc-sep"></span>${dd('align', '对齐', CD.align)}<span class="cdoc-sep"></span>${b('bold', '加粗 ⌘B', '<b>B</b>')}${b('strikeThrough', '删除线', '<s>S</s>')}${b('italic', '斜体 ⌘I', '<i>I</i>')}${b('underline', '下划线 ⌘U', '<u>U</u>')}${b('link', '链接', CD.link)}${b('inlinecode', '行内代码', CD.code)}${dd('color', '文字与背景颜色', '<span style="font:600 14px/1 Georgia,serif">A</span>')}<span class="cdoc-sep"></span>${dd('insert', '插入', CD.more)}${dd('indent', '缩进', CD.indent)}${b('comment', '评论', CI.comment)}</div>`);
        el = $('#cdoc-float');
      }
      return el;
    }
    function cdocFloatHide() { $('#cdoc-float')?.classList.add('hidden'); $('#cdoc-float-pop')?.classList.add('hidden'); }
    function cdocFloatShow(range) {
      const el = cdocFloatEl(); el.classList.remove('hidden');
      const r = range.getBoundingClientRect(); if (!r.width && !r.height) return cdocFloatHide();
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
      el.style.top = (r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10) + 'px';
      ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => { let on = false; try { on = document.queryCommandState(cmd); } catch (_) {} $(`[data-cdoc-cmd="${cmd}"]`, el)?.classList.toggle('active', !!on); });
    }
    function cdocFloatPop(anchor) {
      const kind = anchor.dataset.cdocFpop; let pop = $('#cdoc-float-pop');
      if (!pop) { document.body.insertAdjacentHTML('beforeend', '<div class="cdoc-float-pop hidden" id="cdoc-float-pop"></div>'); pop = $('#cdoc-float-pop'); }
      if (!pop.classList.contains('hidden') && pop.dataset.kind === kind) return pop.classList.add('hidden');
      pop.dataset.kind = kind;
      const item = (val, icon, label, active = false) => `<button type="button" class="cdoc-bm-item ${active ? 'active' : ''}" data-cdoc-fpick="${val}">${icon}<span>${label}</span></button>`;
      let cur = 'text'; if (cdocRange) { const blk = cdocBlockOf(cdocRange.startContainer); cur = cdocBlockType(blk); }
      if (kind === 'block') pop.innerHTML = CDOC_BLOCK_TYPES.filter(t => !t.insertOnly).map(t => item(`block|${t.id}`, t.icon, t.name, t.id === cur)).join('');
      else if (kind === 'align') pop.innerHTML = item('align|justifyLeft', CI.left, '左对齐') + item('align|justifyCenter', CI.center, '居中') + item('align|justifyRight', CI.right, '右对齐');
      else if (kind === 'color') pop.innerHTML = `<div class="cdoc-bm-colors"><span>文字颜色</span>${CDOC_TEXT_COLORS.map(([c, n]) => `<button type="button" style="background:${c || '#fff'}" data-cdoc-fpick="fg|${c}" title="${n}" class="${c ? '' : 'clear'}"></button>`).join('')}<span>背景颜色</span>${CDOC_BG_COLORS.map(([c, n]) => `<button type="button" style="background:${c || '#fff'}" data-cdoc-fpick="bg|${c}" title="${n}" class="${c ? '' : 'clear'}"></button>`).join('')}</div>`;
      else if (kind === 'insert') pop.innerHTML = ['image', 'video', 'table', 'hr', 'callout', 'todo'].map(id => { const t = CDOC_BLOCK_TYPES.find(x => x.id === id); return item(`insert|${id}`, t.icon, t.name); }).join('');
      else if (kind === 'indent') pop.innerHTML = item('align|indent', CD.indent, '增加缩进') + item('align|outdent', CI.outdent, '减少缩进');
      pop.classList.remove('hidden'); cdocPlace(pop, anchor.getBoundingClientRect(), 6);
    }
    let scriptRange = null;
    function scriptFloatEl() {
      let el = $('#script-float');
      if (!el) {
        const b = (cmd, label, inner, extra = '') => `<button type="button" class="cdoc-tool" data-script-cmd="${cmd}" title="${label}" aria-label="${label}" ${extra}>${inner}</button>`;
        document.body.insertAdjacentHTML('beforeend', `<div class="cdoc-float script-float hidden" id="script-float" role="toolbar"><button type="button" class="cdoc-tool has-caret type-pick" data-script-fpop="type" title="段落格式"><span data-script-type-label>格式</span>${CD.caret}</button><span class="cdoc-sep"></span>${b('bold', '加粗', '<b>B</b>')}${b('italic', '斜体', '<i>I</i>')}${b('underline', '下划线', '<u>U</u>')}<span class="cdoc-sep"></span>${b('shot', '用选中文字创建分镜', CD.text.replace('T', '镜') + '<span style="margin-left:4px;font-size:12px">创建分镜</span>')}${b('agent', '询问 Agent', GI.spark)}</div>`);
        el = $('#script-float');
      }
      return el;
    }
    function scriptFloatShow(range) {
      // 剧本选区不再显示新工具条，保留原有的格式工具条（#caret-format-toolbar）
      cdocFloatEl().classList.add('hidden'); scriptFloatHide(); return;
      const el = scriptFloatEl(); el.classList.remove('hidden');
      const r = range.getBoundingClientRect(); if (!r.width && !r.height) return el.classList.add('hidden');
      const block = cdocBlockOf(range.startContainer); const t = SCRIPT_TYPES.find(x => x[0] === (block?.dataset.formatType || 'action')); const lab = $('[data-script-type-label]', el); if (lab) lab.textContent = t ? t[1] : '格式';
      const shotBtn = $('[data-script-cmd="shot"]', el); if (shotBtn) shotBtn.disabled = !state.storyboardEnabled;
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
      el.style.top = (r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10) + 'px';
    }
    function scriptFloatHide() { $('#script-float')?.classList.add('hidden'); }
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection(); if (!sel || !sel.rangeCount) { cdocFloatHide(); scriptFloatHide(); return; }
      const r = sel.getRangeAt(0); const node = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement; const body = node?.closest?.('[data-cdoc-body]');
      const sblock = node?.closest?.('.script-paper .script-block');
      if (sblock) { scriptRange = r.cloneRange(); if (r.collapsed || !r.toString().trim()) { if (!$('#cdoc-float-pop') || $('#cdoc-float-pop').classList.contains('hidden')) scriptFloatHide(); return; } scriptFloatShow(r); return; }
      scriptFloatHide();
      if (!body || r.collapsed || !r.toString().trim()) { if (!$('#cdoc-float-pop') || $('#cdoc-float-pop').classList.contains('hidden')) cdocFloatHide(); return; }
      cdocFloatShow(r);
    });
    document.addEventListener('mousedown', event => { if (event.target.closest('#script-float')) event.preventDefault(); });
    document.addEventListener('click', event => {
      const t = event.target;
      const fpop = t.closest('[data-script-fpop]');
      if (fpop) { event.preventDefault(); event.stopImmediatePropagation(); let pop = $('#cdoc-float-pop'); if (!pop) { document.body.insertAdjacentHTML('beforeend', '<div class="cdoc-float-pop hidden" id="cdoc-float-pop"></div>'); pop = $('#cdoc-float-pop'); } if (!pop.classList.contains('hidden') && pop.dataset.kind === 'script-type') return pop.classList.add('hidden'); pop.dataset.kind = 'script-type'; const block = scriptRange && cdocBlockOf(scriptRange.startContainer); const cur = block?.dataset.formatType; pop.innerHTML = SCRIPT_TYPES.map(([id, name, glyph]) => `<button type="button" class="cdoc-bm-item ${id === cur ? 'active' : ''}" data-script-type-pick="${id}"><span style="font:600 11px/1 var(--font-ui);width:15px;text-align:center">${glyph}</span><span>${name}</span></button>`).join(''); pop.classList.remove('hidden'); cdocPlace(pop, fpop.getBoundingClientRect(), 6); return; }
      const tp = t.closest('[data-script-type-pick]');
      if (tp) { event.preventDefault(); event.stopImmediatePropagation(); $('#cdoc-float-pop')?.classList.add('hidden'); const block = scriptRange && cdocBlockOf(scriptRange.startContainer); if (block) applyScriptFormatTo(block, tp.dataset.scriptTypePick); scriptFloatHide(); return; }
      const cmd = t.closest('[data-script-cmd]');
      if (cmd) {
        event.preventDefault(); event.stopImmediatePropagation();
        const c = cmd.dataset.scriptCmd; const block = scriptRange && cdocBlockOf(scriptRange.startContainer); if (!block) return;
        if (c === 'agent') { $('#agent-panel')?.classList.remove('hidden'); return; }
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(scriptRange);
        if (c === 'shot') { const src = sourceSelection(); if (src) savedShotSelection = src; createShotFromSelection(); scriptFloatHide(); return; }
        document.execCommand('styleWithCSS', false, true); document.execCommand(c); scriptChanged(block);
      }
    }, true);
    // 剧本键盘：回车新段落（按格式规则）、空段落退格删除、Tab 切换格式
    document.addEventListener('keydown', event => {
      const block = event.target.closest?.('.script-paper .script-block') || (event.target.closest?.('.script-paper [data-script-blocks]') ? scriptBlockFromSelection() : null); if (!block) return;
      if ((event.metaKey || event.ctrlKey) && (event.key === 'z' || event.key === 'Z' || event.key === 'y' || event.key === 'Y')) {
        event.preventDefault(); event.stopImmediatePropagation();
        const paper = block.closest('[data-paper]'), file = findFile(paper?.dataset.pageFile); if (file) scriptUndo(paper, file, event.key.toLowerCase() === 'y' || event.shiftKey);
        return;
      }
      if (cdocSlash) return;   // “/” 菜单打开时交给菜单处理
      const type = block.dataset.formatType || 'action';
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const sel = window.getSelection(); let after = '';
        if (sel && sel.rangeCount) { const r = sel.getRangeAt(0); const tail = document.createRange(); tail.setStart(r.endContainer, r.endOffset); tail.setEndAfter(block.lastChild || block); after = tail.toString(); tail.deleteContents(); }
        block.classList.toggle('is-empty', !block.innerText.trim());
        block.insertAdjacentHTML('afterend', scriptNewBlockHtml(scriptNextType(type), after.replace(/^\n+/, '')));
        const next = block.nextElementSibling; scriptFocusBlock(next); scriptChanged(block); return;
      }
      if (event.key === 'Backspace' && !block.innerText.trim()) {
        const paper = block.closest('[data-paper]'); const all = $$('.script-block', paper); if (all.length <= 1) return;
        event.preventDefault(); let prev = block.previousElementSibling; if (!prev) { const wrap = block.parentElement?.previousElementSibling; prev = wrap?.matches('.script-block') ? wrap : wrap?.querySelector('.script-block:last-child') || all[all.indexOf(block) - 1]; }
        block.remove(); scriptChanged(paper.querySelector('.script-block') || paper); if (prev) scriptFocusBlock(prev, true); return;
      }
      if (event.key === 'Tab') { event.preventDefault(); applyScriptFormatTo(block, scriptCycleType(type, event.shiftKey)); return; }
    }, true);
    document.addEventListener('scroll', () => scriptFloatHide(), true);
    // ===== 剧本行手柄：悬浮到某一行时在左侧显示「行号 + ⠿」，拖动可整体移动该行；若选中了多行文字，则一起移动 =====
    let scriptHoverBlock = null, scriptHoverY = 0, scriptDrag = null;
    // 视觉行：一段文字折行后的每一行
    function scriptLineMetrics(block, y) {
      const r = block.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(block).lineHeight) || 26;
      const count = Math.max(1, Math.round(r.height / lh)); const idx = Math.max(0, Math.min(count - 1, Math.floor((y - r.top) / lh)));
      return { lh, count, idx, top: r.top + idx * lh };
    }
    function scriptLineNumber(block, idx) {
      const root = block.closest('[data-script-blocks]'); let n = 0;
      for (const b of $$('.script-block', root)) { if (b === block) return n + idx + 1; const rr = b.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(b).lineHeight) || 26; n += Math.max(1, Math.round(rr.height / lh)); }
      return n + idx + 1;
    }
    // 把鼠标所在的那一行拆成独立的一段（前后文字各自成段，首段沿用原 id），返回该行
    function scriptIsolateLine(block, y) {
      const m = scriptLineMetrics(block, y); if (m.count <= 1) return block;
      const r = block.getBoundingClientRect(), midY = m.top + m.lh / 2;
      const sR = document.caretRangeFromPoint?.(r.left + 12, midY), eR = document.caretRangeFromPoint?.(r.right - 4, midY);
      if (!sR || !eR || !block.contains(sR.startContainer) || !block.contains(eR.startContainer)) return block;
      const rng = (a, ao, b, bo) => { const x = document.createRange(); x.setStart(a, ao); x.setEnd(b, bo); return x.toString(); };
      const bt = rng(block, 0, sR.startContainer, sR.startOffset), lt = rng(sR.startContainer, sR.startOffset, eR.startContainer, eR.startOffset), at = rng(eR.startContainer, eR.startOffset, block, block.childNodes.length);
      if (!lt.trim() || (!bt.trim() && !at.trim())) return block;
      const type = block.dataset.formatType || 'action', parts = [];
      if (bt.trim()) parts.push([bt.trim(), true]); parts.push([lt.trim(), !bt.trim()]); if (at.trim()) parts.push([at.trim(), false]);
      const holder = document.createElement('div'); holder.innerHTML = parts.map(([txt]) => scriptNewBlockHtml(type, txt)).join('');
      const els = Array.from(holder.children); parts.forEach(([, keepId], i) => { if (keepId) els[i].dataset.scriptId = block.dataset.scriptId; });
      block.replaceWith(...els); const lineEl = els[bt.trim() ? 1 : 0]; scriptChanged(lineEl); return lineEl;
    }
    function scriptHandleEl() { let el = $('#script-line-handle'); if (!el) { document.body.insertAdjacentHTML('beforeend', `<div class="script-line-handle hidden" id="script-line-handle"><span class="sl-no"></span><span class="sl-grip" draggable="true" aria-label="拖动以移动">${CD.grip}</span></div>`); el = $('#script-line-handle'); } return el; }
    function scriptShowHandle(block, y) {
      const el = scriptHandleEl(), r = block.getBoundingClientRect(); scriptHoverBlock = block; scriptHoverY = y;
      const m = scriptLineMetrics(block, y); $('.sl-no', el).textContent = scriptLineNumber(block, m.idx);
      el.classList.remove('hidden'); el.style.left = Math.max(4, r.left - 58) + 'px'; el.style.top = (m.top + 2) + 'px';
    }
    function scriptHideHandle() { if (scriptDrag) return; $('#script-line-handle')?.classList.add('hidden'); scriptHoverBlock = null; }
    document.addEventListener('mousemove', event => {
      if (scriptDrag || cdocDragBlock) return;
      if (event.target.closest?.('#script-line-handle')) return;
      const root = event.target.closest?.('.script-paper [data-script-blocks]');
      if (!root) { if (!event.target.closest?.('.paper.script-paper')) scriptHideHandle(); return; }
      const block = event.target.closest('.script-block') || (() => { const y = event.clientY; return $$('.script-block', root).find(b => { const r = b.getBoundingClientRect(); return y >= r.top - 2 && y <= r.bottom + 2; }) || null; })();
      if (!block) return;
      const m = scriptLineMetrics(block, event.clientY); const cur = scriptHoverBlock === block ? scriptLineMetrics(block, scriptHoverY).idx : -1;
      if (block !== scriptHoverBlock || m.idx !== cur) scriptShowHandle(block, event.clientY);
    });
    document.addEventListener('scroll', () => { $('#script-line-handle')?.classList.add('hidden'); scriptHoverBlock = null; }, true);
    function scriptSelectedBlocks(block) {
      const sel = window.getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return [block];
      const r = sel.getRangeAt(0); const root = block.closest('[data-script-blocks]');
      const hit = $$('.script-block', root).filter(b => r.intersectsNode(b));
      return hit.length > 1 && hit.includes(block) ? hit : [block];
    }
    document.addEventListener('dragstart', event => {
      if (!event.target.closest?.('#script-line-handle .sl-grip') || !scriptHoverBlock) return;
      event.stopImmediatePropagation();
      let blocks = scriptSelectedBlocks(scriptHoverBlock);
      if (blocks.length === 1) blocks = [scriptIsolateLine(scriptHoverBlock, scriptHoverY)];   // 单行拖动：只带走鼠标所在的那一行
      scriptDrag = { blocks, root: blocks[0].closest('[data-script-blocks]') };
      blocks.forEach(b => b.classList.add('is-dragging'));
      event.dataTransfer.setData('text/plain', 'script-blocks'); event.dataTransfer.effectAllowed = 'move';
      try { event.dataTransfer.setDragImage(blocks[0], 20, 10); } catch (_) {}
    }, true);
    document.addEventListener('dragover', event => {
      if (!scriptDrag) return; const block = event.target.closest?.('.script-block'); if (!block || !scriptDrag.root.contains(block)) return;
      event.preventDefault(); event.stopImmediatePropagation(); event.dataTransfer.dropEffect = 'move';
      $$('.cdoc-drop-before, .cdoc-drop-after', scriptDrag.root).forEach(b => b.classList.remove('cdoc-drop-before', 'cdoc-drop-after'));
      if (scriptDrag.blocks.includes(block)) return;
      const r = block.getBoundingClientRect(); block.classList.add(event.clientY < r.top + r.height / 2 ? 'cdoc-drop-before' : 'cdoc-drop-after');
    }, true);
    document.addEventListener('drop', event => {
      if (!scriptDrag) return; const { blocks, root } = scriptDrag; const target = event.target.closest?.('.script-block');
      if (target && root.contains(target) && !blocks.includes(target)) {
        event.preventDefault(); event.stopImmediatePropagation();
        const r = target.getBoundingClientRect(), before = event.clientY < r.top + r.height / 2;
        if (before) blocks.forEach(b => target.parentNode.insertBefore(b, target));
        else { let anchor = target; blocks.forEach(b => { anchor.insertAdjacentElement('afterend', b); anchor = b; }); }
        scriptChanged(target); window.getSelection()?.removeAllRanges();
      }
      $$('.cdoc-drop-before, .cdoc-drop-after, .is-dragging', root).forEach(b => b.classList.remove('cdoc-drop-before', 'cdoc-drop-after', 'is-dragging'));
      scriptDrag = null; scriptHideHandle();
    }, true);
    document.addEventListener('dragend', () => { if (!scriptDrag) return; $$('.cdoc-drop-before, .cdoc-drop-after, .is-dragging', scriptDrag.root).forEach(b => b.classList.remove('cdoc-drop-before', 'cdoc-drop-after', 'is-dragging')); scriptDrag = null; scriptHideHandle(); }, true);
    // 点击剧本稿纸的空白处：在末尾新建一段（末段为空则直接聚焦）
    document.addEventListener('click', event => {
      const paper = event.target.closest?.('.paper.script-paper'); if (!paper) return;
      if (event.target.closest('.script-block, .script-meta, button, select, input, .page-drag-handle, .selection-tools, a')) return;
      const container = paper.querySelector('[data-script-blocks]'); if (!container) return;
      const blocks = $$('.script-block', container); const last = blocks[blocks.length - 1];
      const clickBelow = !last || event.clientY >= last.getBoundingClientRect().bottom - 4;
      if (!clickBelow) return;
      if (last && !last.innerText.trim()) { scriptFocusBlock(last, true); return; }
      const trailingEmpty = blocks.slice().reverse().find(b => !b.innerText.trim()); if (trailingEmpty && blocks.indexOf(trailingEmpty) >= blocks.length - 2) { scriptFocusBlock(trailingEmpty, true); return; }
      const nextType = last ? scriptNextType(last.dataset.formatType || 'action') : 'scene';
      const html = scriptNewBlockHtml(nextType === 'dialogue' || nextType === 'character' ? 'action' : nextType);
      if (last) last.insertAdjacentHTML('afterend', html); else container.insertAdjacentHTML('beforeend', `<div class="script-body">${html}</div>`);
      const el = $$('.script-block', container).pop(); scriptFocusBlock(el); scriptChanged(el);
    });
    document.addEventListener('mouseup', () => { setTimeout(() => { const sel = window.getSelection(); if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed && cdocRangePaper()) cdocFloatShow(sel.getRangeAt(0)); }, 10); });

    // —— 键盘：“/” 菜单导航、行内代码 ——
    document.addEventListener('keydown', event => {
      if (cdocSlash) {
        const items = cdocSlashItems(cdocSlash.filter);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopImmediatePropagation(); cdocSlash.index = (cdocSlash.index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % Math.max(1, items.length); cdocSlashRender(); return; }
        if (event.key === 'Enter' && items.length) { event.preventDefault(); event.stopImmediatePropagation(); cdocSlashPick(items[cdocSlash.index].id); return; }
        if (event.key === 'Escape') { event.preventDefault(); cdocSlashClose(); return; }
      }
      if (event.key === 'Escape') { cdocCloseBlockMenu(); cdocFloatHide(); }
    }, true);
    document.addEventListener('input', event => { const body = event.target.closest?.('[data-cdoc-body]'); if (body) return cdocSlashCheck(body); const sb = event.target.closest?.('.script-block') || (event.target.closest?.('[data-script-blocks]') ? scriptBlockFromSelection() : null); if (sb) { sb.classList.toggle('is-empty', !sb.innerText.trim()); if (!sb.innerText.trim() && !sb.querySelector('br')) sb.appendChild(document.createElement('br')); cdocSlashCheck(sb, 'script'); clearTimeout(scriptTypingTimer); scriptTypingTimer = setTimeout(() => scriptChanged(sb), 700); } else if (event.target.closest?.('[data-script-blocks]')) { clearTimeout(scriptTypingTimer); scriptTypingTimer = setTimeout(() => scriptChanged(event.target), 700); } });
    document.addEventListener('click', event => { const tool = event.target.closest('[data-cdoc-cmd="inlinecode"]'); if (!tool) return; event.preventDefault(); event.stopImmediatePropagation(); const paper = cdocRangePaper(), body = paper && $('[data-cdoc-body]', paper); if (!body || !cdocRestore(body) || cdocRange.collapsed) return; const html = `<code style="font-family:Menlo,Consolas,monospace;font-size:.92em;background:#f0f0ee;padding:1px 5px;border-radius:4px">${escapeHtml(cdocRange.toString())}</code>`; cdocExec(body, 'insertHTML', html); cdocFloatHide(); }, true);
    // 空态提示：点击提示文字聚焦正文
    document.addEventListener('click', event => { const hint = event.target.closest('[data-cdoc-empty-hint]'); if (!hint || event.target.closest('button')) return; $('[data-cdoc-body]', hint.closest('[data-paper]'))?.focus(); });

    /* ===== 顶栏头像：同步为用户照片 ===== */
    (function syncTopbarAvatar(){ const el = $('#topbar-me'); if (!el) return; el.title = USER_PROFILE.name; if (USER_PROFILE.avatar) { el.classList.add('has-photo'); el.style.setProperty('background-image', `url("${USER_PROFILE.avatar}")`, 'important'); el.textContent = ''; } else el.textContent = USER_PROFILE.name.slice(0, 1).toUpperCase(); })();

    /* ===== 侧栏底部：当前板块的最近编辑时间 ===== */
    function docUpdatedText(file) {
      if (!file) return '';
      if (file.updatedAt) return `最近编辑 ${cdocFmtTime(file.updatedAt)}`;
      return file.updated ? `最近编辑 ${file.updated}` : '';
    }
    function refreshDocUpdated() {
      const el = $('#doc-updated'); if (!el) return;
      const id = state.view === 'compare' && state.selectedPageSlot === 'right' ? state.compareFileId : state.currentFileId;
      const file = findFile(id) || findFile(state.currentFileId);
      const text = docUpdatedText(file); el.textContent = text; el.title = file ? `${file.title} · ${text || '尚未编辑'}` : '';
    }
    const renderBeforeDocUpdated = render;
    render = () => { renderBeforeDocUpdated(); refreshDocUpdated(); };
    const markSavingBeforeDocUpdated = markSaving;
    markSaving = () => { markSavingBeforeDocUpdated(); refreshDocUpdated(); };
    refreshDocUpdated();

    /* ===== 故事梗概 / 故事大纲：与新建文本一致的云文档编辑器（剧本正文、分镜表保持原结构） ===== */
    const CLOUD_DOC_TYPES = new Set(['synopsis', 'outline', 'episodeOutline']);
    function cdocMigrateTemplate(file, type) {
      if (!file || file.docHtml != null) return;
      if (file.importedText || !state.renderContext === undefined) { cdocPrepare(file); return; }
      try {
        // 用旧模板渲染一次，套上用户此前的编辑，再转成云文档正文
        const holder = document.createElement('div');
        holder.innerHTML = renderDocBeforeCloudTypes(type, { fileId: file.id, slot: 'left' }) || '';
        $$('[contenteditable="true"]', holder).forEach((el, i) => { const key = editableContentKey(el, i); if (file.editableText && Object.prototype.hasOwnProperty.call(file.editableText, key)) el.textContent = file.editableText[key]; });
        const paper = holder.querySelector('[data-paper]') || holder;
        paper.querySelectorAll('.page-drag-handle, .paper-kicker, .paper-page-number, .paper-doc-tabs, .script-meta, .word-count, select, button, h1').forEach(el => el.remove());
        const out = [];
        Array.from(paper.children).forEach(el => {
          const tag = el.tagName;
          if (tag === 'H2' || tag === 'H3' || tag === 'UL' || tag === 'OL' || tag === 'BLOCKQUOTE') { el.removeAttribute('class'); el.removeAttribute('contenteditable'); out.push(el.outerHTML); }
          else if (tag === 'P' || tag === 'DIV') { const text = (el.innerText || el.textContent || '').trim(); if (text) out.push(`<p>${escapeHtml(text)}</p>`); }
        });
        file.docHtml = out.join('');
      } catch (_) { file.docHtml = ''; }
      delete file.editableText; file.comments = file.comments || [];
    }
    const renderDocBeforeCloudTypes = renderDocument;
    renderDocument = (type, options = {}) => {
      if (CLOUD_DOC_TYPES.has(type)) {
        const file = findFile(options.fileId) || latestFile(type);
        if (file && file.type !== 'storyboard') {
          if (file.docHtml == null) { if (file.importedText || !file.editableText && file.content) cdocPrepare(file); else cdocMigrateTemplate(file, type); }
          state.renderContext = { docId: type, normalized: type === 'episodeOutline' ? 'outline' : type, slot: options.slot || 'left', fileId: file.id };
          try { return renderCustomDoc(type); } finally { state.renderContext = null; }
        }
      }
      return renderDocBeforeCloudTypes(type, options);
    };
    // 首屏若打开的是梗概 / 大纲，用新编辑器重画一次
    if ($$('[data-paper]').some(p => CLOUD_DOC_TYPES.has(p.dataset.pageType) && !p.classList.contains('cloud-doc'))) render();

    /* ===== 剧本段落选中态：只在点击剧本文字时出现；点击稿纸 / 画布空白处即消失 ===== */
    state.selectedScriptId = null;   // 打开页面时不预选任何段落
    function clearScriptSelection() {
      clearShotSourceHighlight();
      if (!state.selectedScriptId && !state.locatedScriptId && !$('.script-block.selected, .script-block.located')) return;
      state.selectedScriptId = null; state.locatedScriptId = null;
      $$('.script-block.selected, .script-block.located').forEach(b => b.classList.remove('selected', 'located'));
      try { hideCaretToolbar?.(); } catch (_) {}
    }
    document.addEventListener('click', event => {
      const t = event.target;
      if (!t.closest?.('#canvas-viewport')) return;   // 只处理稿纸 / 画布区域内的点击
      if (t.closest('.script-block, .selection-tools, button, select, input, textarea, label, a, .shot-record, .cdoc-body, .cdoc-title, table.sheet, .paper-doc-tabs, .script-meta, .board-selection, .cv-note, .mm-node, [contenteditable="true"]')) return;
      clearScriptSelection();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.target.closest?.('input, textarea, [contenteditable="true"]')) clearScriptSelection(); });

    // 创建资产：直接在当前分类下生成一张卡片，并紧贴卡片展开详情浮窗供填写
    const ASSET_TYPE_NAME={character:'人物',location:'场景',prop:'道具',style:'其他'};
    document.addEventListener('click',event=>{const pick=event.target.closest('[data-new-asset-type]');if(!pick)return;event.preventDefault();event.stopImmediatePropagation();closeFlowDialog();createAssetInline(pick.dataset.newAssetType);},true);
    function createAssetInline(chosenType){
      assetSearchQuery = ''; // Keep the newly created card visible even after a restrictive search.
      const type=chosenType||(state.assetFilter&&state.assetFilter!=='all'?state.assetFilter:'character');
      const list=(assetCatalog[type]||=[]);const n=list.length+1;
      const asset={id:'asset-'+Date.now().toString(36),name:`未命名${ASSET_TYPE_NAME[type]||'资产'} ${String(n).padStart(2,'0')}`,meta:'',description:'',variants:['默认'],usage:'0 场',dialogue:'0 句',status:'进行中',aliases:[],refVersions:[],selected:[],realPerson:false,activity:[{who:USER_PROFILE.name,text:'创建了资产卡片',at:Date.now()}]};
      list.push(asset);persistWorkspace();renderAssetsPage();
      requestAnimationFrame(()=>{const card=$(`.asset-editor-card [data-asset="${asset.id}"]`)?.closest('.asset-editor-card');card?.scrollIntoView({block:'nearest'});openAssetDetail(asset.id,card);setTimeout(()=>{const inp=$('#asset-detail [data-ad-name]');if(inp){inp.focus();inp.select();}},40);});
    }
    /* ===== 资产详情页（右侧抽屉，参考在线资产卡片） ===== */
    const ASSET_STATUS=['进行中','待审核','已通过','已归档'];
    const ASSET_NAME_LABEL={character:'角色名称',location:'场景名称',prop:'道具名称',style:'名称'};
    let assetDetailId=null;
    // 取目录里的真实对象（assetById 返回的是拷贝，直接改会丢失）
    function assetRef(id){for(const [type,list] of Object.entries(assetCatalog)){const a=list.find(x=>x.id===id);if(a){a.type=type;return a;}}return null;}
    function preserveAssetReferenceName(asset,nextName,originalName=asset.name){
      if(!originalName||!nextName||originalName===nextName)return;
      const referenced=Object.keys(asset.extractions||{}).length||$$('[data-asset-token]').some(token=>token.dataset.assetId===asset.id);
      if(referenced)asset.aliases=[...new Set([...(asset.aliases||[]),originalName])].filter(name=>name!==nextName);
    }
    function assetDetailPrepare(asset){
      asset.status=asset.status||'进行中'; asset.aliases=asset.aliases||[]; asset.refVersions=asset.refVersions||[]; asset.selected=asset.selected||[]; asset.realPerson=!!asset.realPerson;
      if(!asset.activity){asset.activity=[{who:USER_PROFILE.name,text:'创建了资产卡片',at:Date.now()}];}
    }
    function assetLog(asset,text){asset.activity=asset.activity||[];asset.activity.unshift({who:USER_PROFILE.name,text,at:Date.now()});if(asset.activity.length>30)asset.activity.length=30;}
    function assetTypeIcon(type){return flowIcon(type==='character'?'person':type==='location'?'image':'grid');}
    const fmtDay=ts=>{const d=new Date(ts);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;};
    function assetDetailHtml(asset){
      const thumbs=[asset.image,...asset.selected].filter(Boolean);
      const refs=asset.refVersions.map((v,i)=>`<div class="ad-ref" data-ref="${v.id}"><div class="ad-ref-head"><strong>参考版本 ${i+1}</strong><small>${v.images.length} 张图片${v.video?' · 1 段视频':''}${v.audio?' · 音频':''}</small><button type="button" class="ad-x" data-ad-ref-del="${v.id}" title="删除该版本">${GI.close}</button></div><div class="ad-thumbs">${v.images.map((img,j)=>`<div class="ad-thumb"><img src="${img}" alt=""><button type="button" class="ad-thumb-x" data-ad-ref-img-del="${v.id}:${j}" title="移除">${GI.close}</button></div>`).join('')}${v.images.length<4?`<button type="button" class="ad-thumb ad-add" data-ad-ref-add="${v.id}:image" title="添加图片（2–4 张）">${flowIcon('plus')}</button>`:''}</div><div class="ad-ref-media"><button type="button" class="ad-chip-btn ${v.video?'on':''}" data-ad-ref-add="${v.id}:video">${v.video?'已上传视频参考':'上传视频参考（≤10 秒）'}</button><button type="button" class="ad-chip-btn ${v.audio?'on':''}" data-ad-ref-add="${v.id}:audio">${v.audio?'已上传音频参考':'音频参考（可选）'}</button></div></div>`).join('');
      return `<header class="ad-head">${assetTypeIcon(asset.type)}<h2 data-ad-title>${escapeHtml(asset.name||'未命名')}</h2><button type="button" class="ad-close" data-ad-close aria-label="关闭">${GI.close}</button></header>
      <div class="ad-body">
        <div class="ad-row"><label class="ad-field ad-grow">${ASSET_NAME_LABEL[asset.type]||'名称'}<input data-ad-name data-original-name="${escapeHtml(asset.name||'')}" value="${escapeHtml(asset.name||'')}" maxlength="60"></label><label class="ad-field">状态<select data-ad-status>${ASSET_STATUS.map(v=>`<option ${v===asset.status?'selected':''}>${v}</option>`).join('')}</select></label></div>
        <label class="ad-field">属性 / 特征<input data-ad-meta value="${escapeHtml(asset.meta||'')}" maxlength="300" placeholder="身份、外形、环境或材质等"></label>
        <label class="ad-field">描述<textarea data-ad-desc rows="4" placeholder="外形、性格、材质、氛围…">${escapeHtml(asset.description||'')}</textarea></label>
        ${Object.keys(asset.extractions||{}).length?`<section class="ad-section"><h3>剧本来源</h3>${Object.values(asset.extractions).map(s=>`<details class="asset-source-evidence"><summary>${escapeHtml(s.title)} · 场 ${escapeHtml((s.scenes||[]).join('、'))}</summary><p>${escapeHtml(s.sourceText||'')}</p></details>`).join('')}</section>`:''}
        <section class="ad-section"><h3>Kling O3 / 3.0 适配</h3><p class="ad-hint">保存 2–4 张图片参考，或 1 段视频参考（最长 10 秒），再加可选的音频参考，即可在 Kling O3 / Kling 3.0 中使用这张卡片。卡片还需要一段描述。最多可保存 3 个参考版本。</p>${refs}<button type="button" class="ad-btn" data-ad-new-ref ${asset.refVersions.length>=3?'disabled':''}>${flowIcon('plus')} 新建参考版本</button></section>
        <label class="ad-check"><input type="checkbox" data-ad-real ${asset.realPerson?'checked':''}><span>包含真实人物</span><i class="ad-help" title="勾选后，生成时会启用真人肖像合规检查，并要求提供授权说明。">?</i></label>
        <section class="ad-section"><h3>已选资产</h3><p class="ad-hint">将此资产区域内的资产标记为已选择，它们会成为该资产的参考。第一张为封面。</p><div class="ad-thumbs ad-thumbs-lg"><button type="button" class="ad-thumb ad-add" data-ad-sel-add title="添加图片">${flowIcon('plus')}</button>${thumbs.map((img,i)=>`<div class="ad-thumb ${i===0?'is-cover':''}" data-ad-sel-cover="${i}" title="${i===0?'当前封面':'点击设为封面'}"><img src="${img}" alt="">${i===0?'<span class="ad-cover-tag">封面</span>':''}<button type="button" class="ad-thumb-x" data-ad-sel-del="${i}" title="移除">${GI.close}</button></div>`).join('')}</div></section>
        <section class="ad-section"><h3>别名</h3><p class="ad-hint">用于在剧本中关联该实体的其他称呼。</p><input class="ad-input" data-ad-alias-input placeholder="添加别名，回车确认"><div class="ad-chips">${asset.aliases.map((al,i)=>`<span class="ad-chip">${escapeHtml(al)}<button type="button" data-ad-alias-del="${i}" aria-label="删除别名">${GI.close}</button></span>`).join('')}</div></section>
        <section class="ad-section"><h3>${escapeHtml(asset.name||'未命名')} 中的卡片</h3><div class="ad-cards">${[asset.name,...(asset.variants||[]).filter(v=>v&&v!=='默认')].map((n,i)=>`<div class="ad-card ${i===0?'active':''}"><span class="ad-card-thumb">${asset.image?`<img src="${asset.image}" alt="">`:assetTypeIcon(asset.type)}</span><span>${escapeHtml(n)}</span>${i>0?'<small>变体</small>':''}</div>`).join('')}</div></section>
        <section class="ad-section"><h3>动态</h3><ul class="ad-activity">${asset.activity.map(a=>`<li><span><b>${escapeHtml(a.who)}</b> ${escapeHtml(a.text)}</span><time>${fmtDay(a.at)}</time></li>`).join('')}</ul></section>
      </div>`;
    }
    function assetDetailEl(){let el=$('#asset-detail');if(!el){document.body.insertAdjacentHTML('beforeend','<div class="ad-backdrop hidden" id="asset-detail-backdrop"></div><aside class="asset-detail hidden" id="asset-detail" aria-label="资产详情"></aside><input type="file" id="asset-detail-input" hidden>');el=$('#asset-detail');$('#asset-detail-input').addEventListener('change',assetDetailFiles);}return el;}
    function renderAssetDetail(){const asset=assetRef(assetDetailId);const el=assetDetailEl();if(!asset){closeAssetDetail();return;}assetDetailPrepare(asset);const y=el.querySelector('.ad-body')?.scrollTop||0;el.innerHTML=assetDetailHtml(asset);const body=el.querySelector('.ad-body');if(body)body.scrollTop=y;}
    function openAssetDetail(id,anchor){
      $('#asset-more-pop')?.classList.add('hidden');assetDetailId=id;renderAssetDetail();const el=assetDetailEl();el.classList.remove('hidden');
      el.style.right='auto';
      if(anchor?.getBoundingClientRect){
        // 紧贴卡片：优先放在卡片右侧，放不下则放左侧；顶部与卡片对齐，超出视口时上移
        const r=anchor.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight,gap=12;
        let left=r.right+gap;if(left+w>window.innerWidth-8)left=r.left-gap-w;if(left<8)left=Math.max(8,Math.min(r.left,window.innerWidth-w-8));
        const top=Math.max(8,Math.min(r.top,window.innerHeight-h-8));
        el.style.left=left+'px';el.style.top=top+'px';
      }else{el.style.left=(window.innerWidth-el.offsetWidth-24)+'px';el.style.top='calc(var(--topbar) + 16px)';}
    }
    // 浮窗可拖动（按住标题栏）
    document.addEventListener('pointerdown',event=>{const head=event.target.closest?.('#asset-detail .ad-head');if(!head||event.target.closest('button')||event.button!==0)return;const el=$('#asset-detail');const r=el.getBoundingClientRect();const sx=event.clientX-r.left,sy=event.clientY-r.top;el.style.right='auto';const move=e=>{el.style.left=Math.max(0,Math.min(e.clientX-sx,window.innerWidth-r.width))+'px';el.style.top=Math.max(0,Math.min(e.clientY-sy,window.innerHeight-60))+'px';};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);event.preventDefault();});
    function closeAssetDetail(){$('#asset-detail')?.classList.add('hidden');$('#asset-detail-backdrop')?.classList.add('hidden');if(assetDetailId){assetDetailId=null;persistWorkspace();if(state.projectPage==='assets')renderAssetsPage();}}
    function assetDetailPick(target,accept,multiple){const input=$('#asset-detail-input');input.dataset.target=target;input.accept=accept;input.multiple=!!multiple;input.value='';input.click();}
    async function assetDetailFiles(event){
      const input=event.target,asset=assetRef(assetDetailId);if(!asset)return;const [kind,vid,media]=input.dataset.target.split(':');const files=Array.from(input.files||[]);input.value='';
      for(const f of files){
        if(f.size>8*1024*1024){showToast(`${f.name} 超过 8MB`);continue;}
        let blob=f;if(f.type.startsWith('image/'))blob=await cdocDownscale(f);
        const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});
        if(kind==='cover'){asset.image=data;assetLog(asset,'更新了封面');}
        else if(kind==='selected'){if(!asset.image){asset.image=data;assetLog(asset,'更新了封面');}else asset.selected.push(data);}
        else if(kind==='ref'){const v=asset.refVersions.find(x=>x.id===vid);if(!v)continue;if(media==='image'){if(v.images.length<4)v.images.push(data);}else if(media==='video')v.video={name:f.name,data};else if(media==='audio')v.audio={name:f.name,data};}
      }
      if(!persistWorkspace())showToast('本地空间不足，部分媒体未能保存');renderAssetDetail();
    }
    document.addEventListener('click',event=>{
      const t=event.target;
      if(!t.closest('#asset-detail'))return;
      const asset=assetRef(assetDetailId);if(!asset)return;
      const h=(sel)=>t.closest(sel);
      if(h('[data-ad-close]')){closeAssetDetail();return;}
      if(h('[data-ad-new-ref]')){if(asset.refVersions.length>=3)return;asset.refVersions.push({id:'rv'+Date.now().toString(36),images:[],video:null,audio:null});assetLog(asset,`发布了版本 ${asset.refVersions.length}`);persistWorkspace();renderAssetDetail();return;}
      const refAdd=h('[data-ad-ref-add]');if(refAdd){const [vid,media]=refAdd.dataset.adRefAdd.split(':');assetDetailPick(`ref:${vid}:${media}`,media==='image'?'image/*':media==='video'?'video/*':'audio/*',media==='image');return;}
      const refDel=h('[data-ad-ref-del]');if(refDel){asset.refVersions=asset.refVersions.filter(v=>v.id!==refDel.dataset.adRefDel);persistWorkspace();renderAssetDetail();return;}
      const imgDel=h('[data-ad-ref-img-del]');if(imgDel){const [vid,idx]=imgDel.dataset.adRefImgDel.split(':');const v=asset.refVersions.find(x=>x.id===vid);if(v)v.images.splice(+idx,1);persistWorkspace();renderAssetDetail();return;}
      if(h('[data-ad-sel-add]')){assetDetailPick('selected','image/*',true);return;}
      const selDel=h('[data-ad-sel-del]');if(selDel){const i=+selDel.dataset.adSelDel;if(i===0){asset.image=asset.selected.shift()||null;}else asset.selected.splice(i-1,1);persistWorkspace();renderAssetDetail();return;}
      const cover=h('[data-ad-sel-cover]');if(cover){const i=+cover.dataset.adSelCover;if(i>0){const next=asset.selected.splice(i-1,1)[0];if(asset.image)asset.selected.unshift(asset.image);asset.image=next;assetLog(asset,'更新了封面');persistWorkspace();renderAssetDetail();}return;}
      const alDel=h('[data-ad-alias-del]');if(alDel){asset.aliases.splice(+alDel.dataset.adAliasDel,1);persistWorkspace();renderAssetDetail();return;}
    },true);
    document.addEventListener('change',event=>{const t=event.target;if(!t.closest?.('#asset-detail'))return;const asset=assetRef(assetDetailId);if(!asset)return;
      if(t.matches('[data-ad-status]')){asset.status=t.value;assetLog(asset,`将状态设为 ${t.value}`);persistWorkspace();renderAssetDetail();}
      if(t.matches('[data-ad-real]')){asset.realPerson=t.checked;persistWorkspace();}
    });
    document.addEventListener('input',event=>{const t=event.target;if(!t.closest?.('#asset-detail'))return;const asset=assetRef(assetDetailId);if(!asset)return;
      if(t.matches('[data-ad-name]')){const name=t.value.trim()||asset.name;preserveAssetReferenceName(asset,name,t.dataset.originalName);asset.name=name;const h2=$('#asset-detail [data-ad-title]');if(h2)h2.textContent=t.value.trim()||'未命名';}
      if(t.matches('[data-ad-desc]'))asset.description=t.value;
      if(t.matches('[data-ad-meta]'))asset.meta=t.value;
      refreshAssetSurfaces();
      clearTimeout(cdocSaveTimer);cdocSaveTimer=setTimeout(persistWorkspace,400);
    });
    document.addEventListener('keydown',event=>{
      const inp=event.target.closest?.('[data-ad-alias-input]');
      if(inp&&event.key==='Enter'){event.preventDefault();const v=inp.value.trim();const asset=assetRef(assetDetailId);if(!v||!asset)return;if(!asset.aliases.includes(v))asset.aliases.push(v);inp.value='';persistWorkspace();renderAssetDetail();setTimeout(()=>$('#asset-detail [data-ad-alias-input]')?.focus(),20);return;}
      if(event.key==='Escape'&&assetDetailId&&!$('#flow-dialog')?.open)closeAssetDetail();
    });

    // 镜头的场次标签与剧本当前场次编号对齐（一次性）
    try { const cache = {}; state.shots.forEach(sh => { if (!sh.sourceFileId || !findFile(sh.sourceFileId)) return; cache[sh.sourceFileId] = cache[sh.sourceFileId] || sourceBlocks(sh.sourceFileId); const b = cache[sh.sourceFileId].find(x => x.id === sh.sourceId); if (b && sh.scene !== b.scene) sh.scene = b.scene; }); } catch (_) {}

    /* ===== Moodio Agent 浮窗：对话列表 / 新对话 / 固定 / 快捷指令 / 拖动；离线原型回复 ===== */
