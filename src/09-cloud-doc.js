    const CDOC_FONTS = [['', '默认字体'], ['"PingFang SC", "Helvetica Neue", Arial, sans-serif', '苹方 / 无衬线'], ['"Songti SC", SimSun, serif', '宋体'], ['"Heiti SC", SimHei, sans-serif', '黑体'], ['"Kaiti SC", KaiTi, serif', '楷体'], ['Georgia, "Times New Roman", serif', 'Georgia'], ['Menlo, Consolas, monospace', '等宽']];
    const CDOC_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36];
    const CDOC_BLOCKS = [['p', '正文'], ['h1', '标题 1'], ['h2', '标题 2'], ['h3', '标题 3'], ['blockquote', '引用']];
    const CDOC_COLORS = ['#191917', '#696764', '#b34d46', '#c9762b', '#9a9a98', '#191917', '#2f6db3', '#6b4fa3', '#c4478a', '#8a6d3b', '#4a7a3a', '#9a9a95'];
    const CDOC_HILITES = ['#fff3a3', '#ffd9a8', '#ffc9c4', '#d8f0d3', '#cfe6f8', '#e5d9f5', '#f9d3e6', '#e8e6e0'];
    const CI = {
      undo: '<svg viewBox="0 0 24 24" class="icon"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
      redo: '<svg viewBox="0 0 24 24" class="icon"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg>',
      color: '<svg viewBox="0 0 24 24" class="icon"><path d="m6 16 6-13 6 13M8.5 10.5h7"/><path d="M4 21h16"/></svg>',
      highlight: '<svg viewBox="0 0 24 24" class="icon"><path d="M3 21h6l11-11-6-6L3 15z"/><path d="m12 6 6 6"/></svg>',
      left: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M4 12h10M4 18h14"/></svg>',
      center: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M7 12h10M5 18h14"/></svg>',
      right: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M10 12h10M6 18h14"/></svg>',
      ul: '<svg viewBox="0 0 24 24" class="icon"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
      ol: '<svg viewBox="0 0 24 24" class="icon"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.5h1.5V8M4 8h3M4 11.5h2.5l-2.5 3h2.5M4 16.5h2.5l-1.2 1.5 1.2 1.5H4"/></svg>',
      todo: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m4.5 8 1.5 1.5L8.5 6M12 8h9M12 16h9"/><rect x="3" y="13" width="6" height="6" rx="1"/></svg>',
      indent: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M10 12h10M4 18h16"/><path d="m4 10 3 2-3 2"/></svg>',
      outdent: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M10 12h10M4 18h16"/><path d="m7 10-3 2 3 2"/></svg>',
      image: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 9"/></svg>',
      video: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>',
      table: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg>',
      hr: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 12h16"/><path d="M8 6h8M8 18h8" opacity=".35"/></svg>',
      code: '<svg viewBox="0 0 24 24" class="icon"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 5l-2 14"/></svg>',
      comment: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
      clear: '<svg viewBox="0 0 24 24" class="icon"><path d="m4 15 8-8 5 5-6 6H7z"/><path d="M4 21h16"/></svg>',
      close: '<svg viewBox="0 0 24 24" class="icon sm"><path d="M6 6l12 12M18 6 6 18"/></svg>'
    };

    function cdocPrepare(file) {
      if (!file) return;
      if (file.docHtml == null) {
        const et = file.editableText || {};
        const placeholder = '从这里开始写下你的创作资料…';
        if (typeof et['content:0'] === 'string' && et['content:0'].trim()) file.title = et['content:0'].trim();
        const raw = typeof et['content:1'] === 'string' ? et['content:1'] : (file.content || '');
        const txt = raw.trim() === placeholder ? '' : raw;
        file.docHtml = txt.split(/\n+/).filter(x => x.trim()).map(x => `<p>${escapeHtml(x)}</p>`).join('');
        delete file.editableText;
      }
      file.comments = file.comments || [];
    }
    function cdocFmtModified(ts) {
      if (!ts) return '今天修改';
      const d = new Date(ts), n = new Date();
      if (d.toDateString() === n.toDateString()) return '今天修改';
      const y = new Date(n); y.setDate(n.getDate() - 1); if (d.toDateString() === y.toDateString()) return '昨天修改';
      return `${d.getMonth() + 1}月${d.getDate()}日修改`;
    }
    const BK_TEMPLATE_ICON = '<svg viewBox="0 0 24 24" class="icon sm"><path d="M4 8l4-4 4 4-4 4zM12 4h8v8h-8zM4 14h8v6H4zM14 14h6v6h-6z"/></svg>';
    // 当前用户：名字 + 头像（头像为 data URI；为空时显示首字母）
    const USER_PROFILE = { name: 'Thomas', avatar: 'data:image/jpeg;base64,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' };
    function cdocAvatarHtml(cls = 'cdoc-avatar') { return USER_PROFILE.avatar ? `<img class="${cls}" src="${USER_PROFILE.avatar}" alt="${escapeHtml(USER_PROFILE.name)}">` : `<span class="${cls}">${escapeHtml(USER_PROFILE.name.slice(0, 1).toUpperCase())}</span>`; }
    function cdocMetaRow(file, extra = '') {
      return `<div class="cdoc-meta-row">${cdocAvatarHtml()}<span class="cdoc-author">${escapeHtml(USER_PROFILE.name)}</span><span class="cdoc-vsep"></span><span data-cdoc-updated>${cdocFmtModified(file?.updatedAt)}</span>${extra ? `<span class="cdoc-vsep"></span>${extra}` : ''}</div>`;
    }
    function cdocFmtTime(ts) {
      if (!ts) return '刚刚';
      const d = new Date(ts), n = new Date(), hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return d.toDateString() === n.toDateString() ? `今天 ${hm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
    }
    function cdocToolbar(file) {
      const b = (cmd, label, inner) => `<button type="button" class="cdoc-tool" data-cdoc-cmd="${cmd}" aria-label="${label}" title="${label}">${inner}</button>`;
      const sep = '<span class="cdoc-sep"></span>';
      const open = (file?.comments || []).filter(c => !c.resolved).length;
      return `<div class="cdoc-toolbar" role="toolbar" aria-label="文档工具">
        ${b('undo', '撤销', CI.undo)}${b('redo', '重做', CI.redo)}${sep}
        <select class="cdoc-select" data-cdoc-block aria-label="段落样式" title="段落样式">${CDOC_BLOCKS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>
        <select class="cdoc-select cdoc-font" data-cdoc-font aria-label="字体" title="字体">${CDOC_FONTS.map(([v, n]) => `<option value="${escapeHtml(v)}">${n}</option>`).join('')}</select>
        <select class="cdoc-select cdoc-size" data-cdoc-size aria-label="字号" title="字号"><option value="">字号</option>${CDOC_SIZES.map(v => `<option value="${v}">${v}</option>`).join('')}</select>${sep}
        ${b('bold', '加粗 ⌘B', '<b>B</b>')}${b('italic', '斜体 ⌘I', '<i>I</i>')}${b('underline', '下划线 ⌘U', '<u>U</u>')}${b('strikeThrough', '删除线', '<s>S</s>')}${b('palette:fore', '文字颜色', CI.color)}${b('palette:back', '高亮', CI.highlight)}${sep}
        ${b('justifyLeft', '左对齐', CI.left)}${b('justifyCenter', '居中', CI.center)}${b('justifyRight', '右对齐', CI.right)}${sep}
        ${b('insertUnorderedList', '无序列表', CI.ul)}${b('insertOrderedList', '有序列表', CI.ol)}${b('todo', '任务清单', CI.todo)}${b('outdent', '减少缩进', CI.outdent)}${b('indent', '增加缩进 Tab', CI.indent)}${sep}
        ${b('link', '插入链接', icons.link)}${b('image', '插入图片', CI.image)}${b('video', '插入视频', CI.video)}${b('table', '插入表格', CI.table)}${b('hr', '分割线', CI.hr)}${b('code', '代码块', CI.code)}${sep}
        ${b('comment', '划线评论', CI.comment + (open ? `<i class="cdoc-badge">${open}</i>` : ''))}${b('removeFormat', '清除格式', CI.clear)}
      </div>`;
    }
    renderCustom = function (id) {
      const file = findFile(state.renderContext?.fileId);
      cdocPrepare(file);
      const open = (file?.comments || []).filter(c => !c.resolved).length;
      const html = paperWrap(`
        <div class="cdoc-head cdoc-head-clean">
          <div class="cdoc-title" contenteditable="true" data-cdoc-title data-placeholder="请输入标题" spellcheck="false">${escapeHtml(file?.title || '')}</div>
          ${cdocMetaRow(file, `<span data-cdoc-count>— 字</span><span data-cdoc-open>${open ? `${open} 条评论` : ''}</span>`)}
        </div>
        <div class="cdoc-body-wrap">
          <div class="cdoc-body" contenteditable="true" data-cdoc-body spellcheck="false">${file?.docHtml || ''}</div>
          <div class="cdoc-empty-hint" data-cdoc-empty-hint>输入“/”快速插入内容，或点击 <button type="button" data-cdoc-templates>${BK_TEMPLATE_ICON} 选择模板</button></div>
        </div>
      `, { page: '1' });
      return html.replace('class="paper', 'class="paper cloud-doc doc-clean');
    };

    function cdocClean(body) {
      const c = body.cloneNode(true);
      c.querySelectorAll('.cdoc-selected').forEach(e => e.classList.remove('cdoc-selected'));
      c.querySelectorAll('mark.cdoc-comment.is-open').forEach(e => e.classList.remove('is-open'));
      c.querySelectorAll('[data-media-id] img, [data-media-id] video').forEach(e => e.removeAttribute('src'));
      c.querySelectorAll('[data-cdoc-h]').forEach(e => e.removeAttribute('data-cdoc-h'));
      c.querySelectorAll('font[size]').forEach(f => { const span = document.createElement('span'); span.style.fontSize = (CDOC_SIZES[Number(f.getAttribute('size')) - 1] || 15) + 'px'; span.innerHTML = f.innerHTML; f.replaceWith(span); });
      // 顶层零散的文字 / 行内元素统一包进 <p>，保证结构和云文档一致
      const BLOCK = /^(P|H1|H2|H3|H4|UL|OL|LI|BLOCKQUOTE|PRE|TABLE|FIGURE|HR|DIV)$/;
      let run = null;
      Array.from(c.childNodes).forEach(node => {
        const isBlock = node.nodeType === 1 && BLOCK.test(node.tagName);
        if (isBlock) { run = null; return; }
        if (node.nodeType === 3 && !node.textContent.trim() && !run) { node.remove(); return; }
        if (node.nodeType === 1 && node.tagName === 'BR' && !run) { node.remove(); return; }
        if (!run) { run = document.createElement('p'); c.insertBefore(run, node); }
        run.appendChild(node);
      });
      return c.innerHTML;
    }
    function captureCloudDoc(paper, file) {
      const body = $('[data-cdoc-body]', paper), title = $('[data-cdoc-title]', paper);
      if (body) { const html = cdocClean(body); if (html !== file.docHtml) { file.docHtml = html; file.updatedAt = Date.now(); file.updated = '刚刚'; } }
      if (title) { const t = title.innerText.replace(/\s+/g, ' ').trim(); if (t !== file.title) { file.title = t; file.updatedAt = Date.now(); } }
    }
    function cdocUpdateInfo(paper, file) {
      const body = $('[data-cdoc-body]', paper), title = $('[data-cdoc-title]', paper);
      if (!body) return;
      const chars = (body.innerText || '').replace(/\s+/g, '').length;
      body.classList.toggle('is-empty', !chars && !body.querySelector('figure, table, hr, img, video'));
      if (title) title.classList.toggle('is-empty', !title.innerText.trim());
      const count = $('[data-cdoc-count]', paper); if (count) count.textContent = `${chars.toLocaleString()} 字`;
      const upd = $('[data-cdoc-updated]', paper); if (upd) upd.textContent = cdocFmtModified(file?.updatedAt);
      const open = (file?.comments || []).filter(c => !c.resolved).length;
      const openEl = $('[data-cdoc-open]', paper); if (openEl) openEl.textContent = open ? `${open} 条评论` : '';
      const btn = $('[data-cdoc-cmd="comment"]', paper); if (btn) { btn.querySelector('.cdoc-badge')?.remove(); if (open) btn.insertAdjacentHTML('beforeend', `<i class="cdoc-badge">${open}</i>`); }
    }
    let cdocSaveTimer = null;
    function cdocChanged(el) {
      const paper = el?.closest?.('[data-paper]'); if (!paper) return;
      const file = findFile(paper.dataset.pageFile); if (!file) return;
      clearTimeout(cdocSaveTimer);
      cdocSaveTimer = setTimeout(() => {
        captureCloudDoc(paper, file);
        cdocUpdateInfo(paper, file);
        $$(`[data-writing-file="${file.id}"] .writing-folder-name`).forEach(n => { n.textContent = displayFileTitle(file); });
        try { fillContextSections(); } catch (_) {}
        markSaving();
      }, 350);
    }

    /* --- 媒体：图片 / 视频存 IndexedDB，正文里只保留 data-media-id --- */
    const cdocUrlCache = new Map();
    function cdocDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('moodio-cdoc-media', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
    }
    async function cdocPutMedia(id, blob) { const db = await cdocDb(); await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
    async function cdocGetMedia(id) { const db = await cdocDb(); return new Promise((res, rej) => { const q = db.transaction('files').objectStore('files').get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
    async function cdocHydrateMedia(root) {
      for (const fig of $$('[data-media-id]', root)) {
        const id = fig.dataset.mediaId, el = fig.querySelector('img, video');
        if (!el || el.getAttribute('src')) continue;
        let url = cdocUrlCache.get(id);
        if (!url) { try { const blob = await cdocGetMedia(id); if (!blob) { fig.classList.add('missing'); continue; } url = URL.createObjectURL(blob); cdocUrlCache.set(id, url); } catch (_) { fig.classList.add('missing'); continue; } }
        el.src = url; fig.classList.remove('missing');
      }
    }
    function cdocDownscale(file) {
      return new Promise(resolve => {
        const img = new Image(), u = URL.createObjectURL(file);
        img.onload = () => {
          const max = 1800; const w = img.naturalWidth, h = img.naturalHeight;
          if ((w <= max && h <= max && file.size < 1.5e6) || file.type === 'image/gif' || file.type === 'image/svg+xml') { URL.revokeObjectURL(u); return resolve(file); }
          const k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(b => { URL.revokeObjectURL(u); resolve(b || file); }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', .88);
        };
        img.onerror = () => { URL.revokeObjectURL(u); resolve(file); };
        img.src = u;
      });
    }
    async function cdocInsertFiles(files, body) {
      let inserted = 0;
      for (const f of Array.from(files || [])) {
        const isImg = f.type.startsWith('image/'), isVid = f.type.startsWith('video/');
        if (!isImg && !isVid) { showToast(`${f.name}：仅支持图片或视频`); continue; }
        if (f.size > 200 * 1024 * 1024) { showToast(`${f.name} 超过 200MB，请压缩后再上传`); continue; }
        const blob = isImg ? await cdocDownscale(f) : f;
        const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        try { await cdocPutMedia(id, blob); } catch (_) { showToast('媒体保存失败：浏览器本地存储不可用'); continue; }
        const url = URL.createObjectURL(blob); cdocUrlCache.set(id, url);
        const inner = isImg ? `<img src="${url}" alt="${escapeHtml(f.name)}">` : `<video src="${url}" controls preload="metadata"></video>`;
        const html = `<figure class="cdoc-media" contenteditable="false" data-media-id="${id}" data-kind="${isImg ? 'image' : 'video'}">${inner}<figcaption contenteditable="true"></figcaption></figure><p><br></p>`;
        body.focus(); cdocRestore(body);
        document.execCommand('insertHTML', false, html);
        if (!body.querySelector(`[data-media-id="${id}"]`)) body.insertAdjacentHTML('beforeend', html);
        inserted++;
      }
      if (inserted) { cdocChanged(body); showToast(`已插入 ${inserted} 个媒体文件`); }
    }
    let cdocPendingBody = null;
    function cdocPickFiles(body, accept) {
      let input = $('#cdoc-file-input');
      if (!input) { document.body.insertAdjacentHTML('beforeend', '<input type="file" id="cdoc-file-input" multiple hidden>'); input = $('#cdoc-file-input'); input.addEventListener('change', () => { const b = cdocPendingBody; const files = Array.from(input.files); input.value = ''; if (b && files.length) cdocInsertFiles(files, b); }); }
      input.accept = accept; cdocPendingBody = body; input.click();
    }

    /* --- 选区与命令 --- */
    let cdocRange = null;
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      const node = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      const body = node?.closest?.('[data-cdoc-body]');
      if (!body) return;
      cdocRange = r.cloneRange();
      cdocSyncToolbar(body.closest('[data-paper]'));
    });
    function cdocRestore(body) {
      if (!cdocRange) return false;
      const node = cdocRange.startContainer.nodeType === 1 ? cdocRange.startContainer : cdocRange.startContainer.parentElement;
      if (body && !body.contains(node)) return false;
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(cdocRange); return true;
    }
    function cdocExec(body, cmd, value = null, css = true) {
      body.focus(); cdocRestore(body);
      document.execCommand('styleWithCSS', false, css);
      document.execCommand(cmd, false, value);
      cdocChanged(body);
    }
    function cdocSyncToolbar(paper) {
      if (!paper) return;
      ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'].forEach(cmd => {
        const btn = $(`[data-cdoc-cmd="${cmd}"]`, paper); if (!btn) return;
        let on = false; try { on = document.queryCommandState(cmd); } catch (_) {}
        btn.classList.toggle('active', !!on);
      });
      const block = $('[data-cdoc-block]', paper);
      if (block) { let v = ''; try { v = (document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (_) {} block.value = CDOC_BLOCKS.some(([id]) => id === v) ? v : 'p'; }
    }
    function cdocFileOf(el) { const paper = el?.closest?.('[data-paper]'); return paper ? findFile(paper.dataset.pageFile) : null; }
    function cdocRangePaper() { if (!cdocRange) return null; const n = cdocRange.startContainer.nodeType === 1 ? cdocRange.startContainer : cdocRange.startContainer.parentElement; return n?.closest?.('[data-paper]') || null; }
    function cdocPop(id, cls) {
      let pop = $('#' + id);
      if (!pop) { document.body.insertAdjacentHTML('beforeend', `<div class="cdoc-pop ${cls} hidden" id="${id}"></div>`); pop = $('#' + id); }
      return pop;
    }
    function cdocPlace(pop, rect, gap = 6) {
      pop.classList.remove('hidden');
      const w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) + 'px';
      pop.style.top = (rect.bottom + gap + h > window.innerHeight ? Math.max(8, rect.top - h - gap) : rect.bottom + gap) + 'px';
    }
    function cdocCloseSmallPops() { ['cdoc-palette-pop', 'cdoc-media-pop'].forEach(id => $('#' + id)?.classList.add('hidden')); $$('.cdoc-media.cdoc-selected').forEach(f => f.classList.remove('cdoc-selected')); }
    function cdocOpenPalette(anchor, kind, body) {
      const pop = cdocPop('cdoc-palette-pop', '');
      const colors = kind === 'fore' ? CDOC_COLORS : CDOC_HILITES;
      pop.innerHTML = `<div class="cdoc-palette">${colors.map(c => `<button type="button" style="background:${c}" data-cdoc-color="${c}" data-kind="${kind}" aria-label="${c}"></button>`).join('')}<button type="button" class="clear" data-cdoc-color="" data-kind="${kind}" aria-label="清除"></button></div>`;
      pop.dataset.forBody = body.closest('[data-paper]').dataset.pageFile;
      cdocPlace(pop, anchor.getBoundingClientRect());
    }
    function cdocOpenMediaBar(fig) {
      const pop = cdocPop('cdoc-media-pop', '');
      const w = fig.style.width || '100%';
      const al = fig.classList.contains('align-left') ? 'left' : fig.classList.contains('align-right') ? 'right' : 'center';
      pop.innerHTML = `<div class="cdoc-media-bar">${[['40%', '小'], ['65%', '中'], ['100%', '大']].map(([v, n]) => `<button type="button" class="${w === v ? 'active' : ''}" data-cdoc-media-width="${v}">${n}</button>`).join('')}<span class="cdoc-sep"></span>${[['left', '居左'], ['center', '居中'], ['right', '居右']].map(([v, n]) => `<button type="button" class="${al === v ? 'active' : ''}" data-cdoc-media-align="${v}">${n}</button>`).join('')}<span class="cdoc-sep"></span><button type="button" class="danger" data-cdoc-media-remove>删除</button></div>`;
      const r = fig.getBoundingClientRect();
      pop.classList.remove('hidden');
      pop.style.left = Math.max(8, Math.min(r.left + r.width / 2 - pop.offsetWidth / 2, window.innerWidth - pop.offsetWidth - 8)) + 'px';
      pop.style.top = Math.max(8, r.top - pop.offsetHeight - 8) + 'px';
    }

    /* --- 划线评论 --- */
    let cdocOpenComment = null;   // { id, fileId }
    function cdocCommentPop() { return cdocPop('cdoc-comment-pop', 'cdoc-comment-pop'); }
    function cdocCloseComment() { const pop = $('#cdoc-comment-pop'); if (pop) pop.classList.add('hidden'); $$('mark.cdoc-comment.is-open').forEach(m => m.classList.remove('is-open')); cdocOpenComment = null; }
    function cdocRenderComment(mark, file, comment, focusInput = false) {
      const pop = cdocCommentPop();
      pop.innerHTML = `<header><span>评论</span><button type="button" data-cdoc-comment-close aria-label="关闭">${CI.close}</button></header>
        <div class="cdoc-comment-quote">${escapeHtml(comment.quote || mark.textContent.trim().slice(0, 80))}</div>
        <div class="cdoc-thread">${comment.thread.length ? comment.thread.map(t => `<div class="cdoc-thread-item"><div class="who"><b>${escapeHtml(t.author)}</b><span>${cdocFmtTime(t.time)}</span></div>${escapeHtml(t.text)}</div>`).join('') : '<div class="cdoc-thread-empty">写下你的评论，回车发送</div>'}</div>
        <div class="cdoc-comment-input"><textarea rows="1" placeholder="${comment.thread.length ? '回复…' : '评论…'}" data-cdoc-comment-text></textarea><button type="button" data-cdoc-comment-send>发送</button></div>
        <footer><button type="button" data-cdoc-comment-resolve>✓ 解决</button><button type="button" class="danger" data-cdoc-comment-delete>删除评论</button></footer>`;
      $$('mark.cdoc-comment.is-open').forEach(m => m.classList.remove('is-open')); mark.classList.add('is-open');
      cdocOpenComment = { id: comment.id, fileId: file.id };
      cdocPlace(pop, mark.getBoundingClientRect(), 8);
      const ta = $('[data-cdoc-comment-text]', pop);
      if (focusInput) setTimeout(() => ta.focus(), 30);
    }
    function cdocUnwrap(mark) { const parent = mark.parentNode; while (mark.firstChild) parent.insertBefore(mark.firstChild, mark); parent.removeChild(mark); parent.normalize?.(); }
    function cdocAddComment(body) {
      const file = cdocFileOf(body); if (!file) return;
      if (!cdocRestore(body) || cdocRange.collapsed || !cdocRange.toString().trim()) { showToast('先选中要评论的文字'); return; }
      const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const quote = cdocRange.toString().replace(/\s+/g, ' ').trim().slice(0, 80);
      const mark = document.createElement('mark'); mark.className = 'cdoc-comment'; mark.dataset.commentId = id;
      const range = cdocRange.cloneRange();
      try { range.surroundContents(mark); } catch (_) { const frag = range.extractContents(); mark.appendChild(frag); range.insertNode(mark); }
      file.comments.push({ id, quote, thread: [], time: Date.now(), resolved: false });
      window.getSelection()?.removeAllRanges();
      cdocChanged(body);
      cdocRenderComment(mark, file, file.comments[file.comments.length - 1], true);
    }

    /* --- 事件 --- */
    document.addEventListener('mousedown', event => {
      // 工具栏按钮不抢走正文选区
      if (event.target.closest('.cdoc-toolbar button, #cdoc-palette-pop, #cdoc-media-pop, #cdoc-float, #cdoc-float-pop, #cdoc-block-handle, #cdoc-block-menu, #cdoc-slash')) event.preventDefault();
    });
    document.addEventListener('click', event => {
      const t = event.target;
      // 工具栏命令
      const tool = t.closest('[data-cdoc-cmd]');
      if (tool) {
        event.preventDefault(); event.stopImmediatePropagation();
        const paper = tool.closest('[data-paper]') || cdocRangePaper(), body = paper && $('[data-cdoc-body]', paper); if (!body) return;
        const cmd = tool.dataset.cdocCmd;
        cdocCloseSmallPops();
        if (cmd === 'undo' || cmd === 'redo') { body.focus(); document.execCommand(cmd); cdocChanged(body); return; }
        if (cmd.startsWith('palette:')) return cdocOpenPalette(tool, cmd.slice(8), body);
        if (cmd === 'todo') return cdocExec(body, 'insertHTML', '<ul class="cdoc-todo"><li><input type="checkbox" contenteditable="false"><span>&#8203;</span></li></ul><p><br></p>');
        if (cmd === 'table') return cdocExec(body, 'insertHTML', `<table class="cdoc-table"><tbody>${'<tr>' + '<td><br></td>'.repeat(3) + '</tr>'}${('<tr>' + '<td><br></td>'.repeat(3) + '</tr>').repeat(2)}</tbody></table><p><br></p>`);
        if (cmd === 'hr') return cdocExec(body, 'insertHorizontalRule');
        if (cmd === 'code') return cdocExec(body, 'formatBlock', '<pre>', false);
        if (cmd === 'image') return cdocPickFiles(body, 'image/*');
        if (cmd === 'video') return cdocPickFiles(body, 'video/*');
        if (cmd === 'comment') return cdocAddComment(body);
        if (cmd === 'link') {
          if (!cdocRestore(body) || cdocRange.collapsed) return showToast('先选中要加链接的文字');
          const saved = cdocRange.cloneRange();
          openFlowDialog('插入链接', `<label>链接地址<input id="cdoc-link-url" type="url" placeholder="https://" value="https://"></label>`, flowButton('close-dialog', '取消') + flowButton('cdoc-apply-link', '插入', '', true));
          $('#cdoc-link-url').dataset.forFile = paper.dataset.pageFile; cdocRange = saved;
          setTimeout(() => $('#cdoc-link-url')?.select(), 30);
          return;
        }
        return cdocExec(body, cmd, null, cmd !== 'removeFormat');
      }
      // 调色板
      const swatch = t.closest('[data-cdoc-color]');
      if (swatch) {
        event.preventDefault(); event.stopImmediatePropagation();
        const pop = swatch.closest('#cdoc-palette-pop'), body = $(`[data-paper][data-page-file="${pop.dataset.forBody}"] [data-cdoc-body]`);
        pop.classList.add('hidden'); if (!body) return;
        const kind = swatch.dataset.kind, color = swatch.dataset.cdocColor;
        if (kind === 'fore') cdocExec(body, 'foreColor', color || '#191917');
        else cdocExec(body, 'hiliteColor', color || 'transparent');
        return;
      }
      // 媒体工具条
      const mw = t.closest('[data-cdoc-media-width], [data-cdoc-media-align], [data-cdoc-media-remove]');
      if (mw) {
        event.preventDefault(); event.stopImmediatePropagation();
        const fig = $('.cdoc-media.cdoc-selected'); if (!fig) return;
        const body = fig.closest('[data-cdoc-body]');
        if (mw.dataset.cdocMediaWidth) fig.style.width = mw.dataset.cdocMediaWidth;
        else if (mw.dataset.cdocMediaAlign) { fig.classList.remove('align-left', 'align-right'); if (mw.dataset.cdocMediaAlign !== 'center') fig.classList.add('align-' + mw.dataset.cdocMediaAlign); }
        else { fig.remove(); cdocCloseSmallPops(); cdocChanged(body); return; }
        cdocOpenMediaBar(fig); cdocChanged(body); return;
      }
      // 选中媒体
      const fig = t.closest('.cdoc-media');
      if (fig && fig.closest('[data-cdoc-body]') && !t.closest('figcaption')) {
        cdocCloseSmallPops(); fig.classList.add('cdoc-selected'); cdocOpenMediaBar(fig); return;
      }
      // 评论弹层内操作
      if (t.closest('#cdoc-comment-pop')) {
        const pop = $('#cdoc-comment-pop'); const file = cdocOpenComment && findFile(cdocOpenComment.fileId); const comment = file?.comments.find(c => c.id === cdocOpenComment.id);
        const mark = comment && $(`mark.cdoc-comment[data-comment-id="${comment.id}"]`);
        if (t.closest('[data-cdoc-comment-close]')) return cdocCloseComment();
        if (!file || !comment) return cdocCloseComment();
        if (t.closest('[data-cdoc-comment-send]')) {
          const ta = $('[data-cdoc-comment-text]', pop), text = ta.value.trim(); if (!text) return ta.focus();
          comment.thread.push({ author: USER_PROFILE.name, text, time: Date.now() }); ta.value = '';
          if (mark) { cdocRenderComment(mark, file, comment, true); cdocChanged(mark); } else markSaving();
          return;
        }
        if (t.closest('[data-cdoc-comment-resolve]') || t.closest('[data-cdoc-comment-delete]')) {
          const del = !!t.closest('[data-cdoc-comment-delete]');
          if (del) file.comments = file.comments.filter(c => c !== comment); else comment.resolved = true;
          const body = mark?.closest('[data-cdoc-body]'); if (mark) cdocUnwrap(mark);
          cdocCloseComment(); if (body) cdocChanged(body); else markSaving();
          showToast(del ? '评论已删除' : '评论已标记为解决');
          return;
        }
        return;
      }
      // 点正文里的高亮 → 打开评论
      const mark = t.closest('mark.cdoc-comment');
      if (mark && mark.closest('[data-cdoc-body]')) {
        const file = cdocFileOf(mark), comment = file?.comments.find(c => c.id === mark.dataset.commentId);
        if (!comment) { const body = mark.closest('[data-cdoc-body]'); cdocUnwrap(mark); cdocChanged(body); return; }
        cdocRenderComment(mark, file, comment, false); return;
      }
      // 侧栏评论列表 → 定位
      const jump = t.closest('[data-cdoc-comment-jump]');
      if (jump) {
        event.preventDefault(); event.stopImmediatePropagation();
        const mark = $(`mark.cdoc-comment[data-comment-id="${jump.dataset.cdocCommentJump}"]`); if (!mark) return showToast('评论对应的文字不在当前稿纸上');
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const file = cdocFileOf(mark), comment = file?.comments.find(c => c.id === mark.dataset.commentId);
        setTimeout(() => comment && cdocRenderComment(mark, file, comment, false), 350); return;
      }
      // 任务清单勾选框
      if (t.matches('.cdoc-todo input[type="checkbox"]')) { t.toggleAttribute('checked', t.checked); t.closest('li')?.classList.toggle('done', t.checked); cdocChanged(t); return; }
      // 其他地方点击：收起小弹层
      if (!t.closest('#cdoc-palette-pop, #cdoc-media-pop')) cdocCloseSmallPops();
      if (!t.closest('#cdoc-comment-pop, mark.cdoc-comment')) cdocCloseComment();
    }, true);
    // 链接对话框确认
    document.addEventListener('click', event => {
      const ok = event.target.closest('[data-flow="cdoc-apply-link"]'); if (!ok) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const input = $('#cdoc-link-url'); const url = (input?.value || '').trim(); const body = $(`[data-paper][data-page-file="${input?.dataset.forFile}"] [data-cdoc-body]`);
      closeFlowDialog();
      if (!url || url === 'https://' || !body) return;
      cdocExec(body, 'createLink', url, false);
      $$('a[href]', body).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    }, true);
    document.addEventListener('change', event => {
      const sel = event.target;
      const paper = sel.closest?.('[data-paper]'), body = paper && $('[data-cdoc-body]', paper); if (!body) return;
      if (sel.matches('[data-cdoc-block]')) return cdocExec(body, 'formatBlock', `<${sel.value}>`, false);
      if (sel.matches('[data-cdoc-font]')) return sel.value ? cdocExec(body, 'fontName', sel.value) : cdocExec(body, 'fontName', 'inherit');
      if (sel.matches('[data-cdoc-size]')) {
        if (!sel.value) return;
        body.focus(); cdocRestore(body);
        document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7');
        $$('font[size="7"]', body).forEach(f => { const span = document.createElement('span'); span.style.fontSize = sel.value + 'px'; span.innerHTML = f.innerHTML; f.replaceWith(span); });
        sel.value = ''; cdocChanged(body);
      }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (el.closest?.('[data-cdoc-body], [data-cdoc-title]')) cdocChanged(el);
    });
    // 空正文获得焦点时先放一个段落，保证输入的文字落在 <p> 里；回车分段也用 <p>
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}
    document.addEventListener('focusin', event => {
      const body = event.target.closest?.('[data-cdoc-body]'); if (!body || body !== event.target) return;
      if (!body.innerHTML.trim() || body.innerHTML === '<br>') {
        body.innerHTML = '<p><br></p>';
        const r = document.createRange(); r.setStart(body.firstChild, 0); r.collapse(true);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }
    });
    document.addEventListener('keydown', event => {
      const title = event.target.closest?.('[data-cdoc-title]');
      if (title && event.key === 'Enter') { event.preventDefault(); const body = $('[data-cdoc-body]', title.closest('[data-paper]')); body?.focus(); return; }
      const body = event.target.closest?.('[data-cdoc-body]');
      if (body && event.key === 'Tab') { event.preventDefault(); document.execCommand(event.shiftKey ? 'outdent' : 'indent'); cdocChanged(body); return; }
      if (event.key === 'Escape') { cdocCloseSmallPops(); cdocCloseComment(); }
      const ta = event.target.closest?.('[data-cdoc-comment-text]');
      if (ta && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('[data-cdoc-comment-send]')?.click(); }
    });
    document.addEventListener('paste', event => {
      const body = event.target.closest?.('[data-cdoc-body]'); if (!body) return;
      const files = Array.from(event.clipboardData?.files || []).filter(f => /^(image|video)\//.test(f.type));
      if (files.length) { event.preventDefault(); cdocInsertFiles(files, body); }
    });
    document.addEventListener('dragover', event => { if (event.target.closest?.('[data-cdoc-body]') && event.dataTransfer?.types?.includes('Files')) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    document.addEventListener('drop', event => {
      const body = event.target.closest?.('[data-cdoc-body]'); if (!body) return;
      const files = Array.from(event.dataTransfer?.files || []); if (!files.length) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const r = document.caretRangeFromPoint?.(event.clientX, event.clientY); if (r && body.contains(r.startContainer)) cdocRange = r;
      cdocInsertFiles(files, body);
    }, true);
    document.addEventListener('scroll', () => {
      cdocCloseSmallPops();
      if (cdocOpenComment) { const mark = $(`mark.cdoc-comment[data-comment-id="${cdocOpenComment.id}"]`), pop = $('#cdoc-comment-pop'); if (mark && pop && !pop.classList.contains('hidden')) cdocPlace(pop, mark.getBoundingClientRect(), 8); }
    }, true);

    // 渲染后：补媒体、空态、字数
    const renderBeforeCloudDoc = render;
    render = () => {
      renderBeforeCloudDoc();
      cdocCloseSmallPops(); cdocCloseComment();
      $$('.paper.cloud-doc').forEach(paper => { const file = findFile(paper.dataset.pageFile); cdocUpdateInfo(paper, file); cdocHydrateMedia(paper); });
    };
    if ($('[data-paper][data-page-type="custom"]:not(.cloud-doc)')) render();

    /* ===== 空白页面 × 四种类型：文档 / 表格 / 画布 / 思维导图 ===== */
    var BK = {   // var：首屏渲染时侧栏就会调用 blankKindIcon，需要可提前访问
      doc: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
      sheet: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg>',
      canvas: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15c2-4 4-4 6 0s4 4 4-2"/><circle cx="8" cy="8.5" r="1.3"/></svg>',
      mindmap: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="9" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="5" rx="1.5"/><rect x="15" y="10" width="6" height="5" rx="1.5"/><rect x="15" y="17" width="6" height="4" rx="1.5"/><path d="M9 12h3M12 12V5.5h3M12 12h3M12 12v7h3"/></svg>',
      rowAdd: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="7" rx="1.5"/><path d="M12 14v6M9 17h6"/></svg>',
      colAdd: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="3" width="7" height="18" rx="1.5"/><path d="M17 9v6M14 12h6"/></svg>',
      rowDel: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="7" rx="1.5"/><path d="M9 17h6"/></svg>',
      colDel: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="3" width="7" height="18" rx="1.5"/><path d="M14 12h6"/></svg>',
      download: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 4v11M7 10l5 5 5-5M4 19h16"/></svg>',
      cursor: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 3l14 8-6 2-3 6z"/></svg>',
      note: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/></svg>',
      pen: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/></svg>',
      eraser: '<svg viewBox="0 0 24 24" class="icon"><path d="M7 20h13M4 15l9-9 5 5-6 6H8z"/></svg>',
      child: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="9" width="7" height="6" rx="1.5"/><rect x="14" y="4" width="7" height="6" rx="1.5"/><path d="M10 12h2V7h2M14 18h7M17.5 15v6"/></svg>',
      sibling: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="3" y="14" width="7" height="6" rx="1.5"/><path d="M14 17h7M17.5 13.5v7"/></svg>',
      expand: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
      collapse: '<svg viewBox="0 0 24 24" class="icon"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
      edit: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
      trash: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'
    };
    var BLANK_KINDS = [
      { id: 'doc', name: '文档', hint: '标题 + 富文本正文，图片视频与划线评论', icon: 'doc', init: f => { f.docHtml = ''; f.comments = []; } },
      { id: 'sheet', name: '表格', hint: '多工作表、公式、筛选排序、条件格式、导出 CSV', icon: 'sheet', init: f => { f.sheets = [sheetNewSheet('Sheet1')]; f.activeSheet = 0; } },
      { id: 'canvas', name: '画布', hint: '自由白板：便签、画笔、拖拽排布', icon: 'canvas', init: f => { f.canvas = { notes: [], strokes: [], w: 1600, h: 1100 }; } },
      { id: 'mindmap', name: '思维导图', hint: '中心主题向外发散，Tab / Enter 快速加节点', icon: 'mindmap', init: f => { f.mindmap = { root: { id: 'root', text: '中心主题', children: [], collapsed: false }, selected: 'root' }; } }
    ];
    function blankKindDef(kind) { const list = BLANK_KINDS || []; return list.find(k => k.id === (kind || 'doc')) || list[0] || { id: 'doc', name: '文档', icon: 'doc' }; }
    function blankKindIcon(kind) { return BK ? BK[blankKindDef(kind).icon] : icons.custom; }
    function blankPageContext(file) {
      const kind = file?.kind || 'doc';
      if (kind === 'sheet') return '';   // 表格页的侧栏信息区暂时留空（用户要求）
      if (kind === 'canvas') return ctxSection('便签', navHead('便签号', '— 张'), `<div data-context-fill="cv-notes"></div>`) + ctxSection('画布概览', '实时', `<div data-context-fill="cv-stats"></div>`);
      if (kind === 'mindmap') return ctxSection('节点目录', navHead('节点号', '— 节点'), `<div data-context-fill="mm-outline"></div>`);
      return ctxSection('文档目录', navHead('标题号', '— 节'), `<div data-context-fill="doc-outline"></div>`);
    }
    // 新建：先选类型
    const createBlankPageBase = createBlankPage;
    createBlankPage = function (kind) {
      if (!kind) {
        openFlowDialog('新建空白页面', `<div class="blank-kind-grid">${BLANK_KINDS.map(k => `<button class="import-target" data-blank-kind="${k.id}"><span class="writing-doc-icon">${BK[k.icon]}</span><span><strong>${k.name}</strong></span></button>`).join('')}</div>`, flowButton('close-dialog', '取消'));
        $('#flow-dialog').dataset.kind = 'blank-page';   // 该弹窗只列名称、不要上下分割线（样式见 styles.css 末尾）
        return;
      }
      captureVisibleEdits?.();
      const def = blankKindDef(kind);
      const n = blankPageLineages().filter(g => (g.files[0]?.kind || 'doc') === def.id).length + 1;
      const file = addFile('custom', { title: def.id === 'doc' ? '' : `${def.name} ${String(n).padStart(2, '0')}`, preview: def.hint });
      file.lineageId = file.id; file.kind = def.id; def.init(file); file.updatedAt = Date.now();
      state.workspaceMode = 'document'; state.view = 'focus'; state.selectedPageSlot = 'left';
      state.currentDoc = 'custom'; state.currentFileId = file.id; state.expandedStack = 'custom';
      render(); persistWorkspace(); $('#canvas-viewport').scrollTop = 0;
      showToast(`已新建「${file.title}」`);
      if (def.id === 'mindmap') setTimeout(() => $(`[data-paper][data-page-file="${file.id}"] .mm-viewport`)?.focus({ preventScroll: true }), 50);
    };
    document.addEventListener('click', event => {
      const pick = event.target.closest('[data-blank-kind]'); if (!pick) return;
      event.preventDefault(); event.stopImmediatePropagation();
      closeFlowDialog(); createBlankPage(pick.dataset.blankKind);
    }, true);

    // 共用外壳：吸顶工具栏 + 标题 + 信息行
    function blankPaper(file, toolbar, body, cls) {
      const html = paperWrap(`
        <div class="script-meta cdoc-meta">${toolbar}</div>
        <div class="cdoc-head">
          <div class="cdoc-title" contenteditable="true" data-cdoc-title data-placeholder="请输入标题" spellcheck="false">${escapeHtml(file?.title || '')}</div>
          ${cdocMetaRow(file, '<span data-blank-info></span>')}
        </div>${body}`, { page: '1' });
      return html.replace('class="paper', `class="paper cloud-doc ${cls}`);
    }
    function blankInfo(paper, text) { const el = $('[data-blank-info]', paper); if (el) el.textContent = text; const upd = $('[data-cdoc-updated]', paper); const file = findFile(paper.dataset.pageFile); if (upd && file) upd.textContent = cdocFmtModified(file.updatedAt); }
    function blankSaved(paper, file) { file.updatedAt = Date.now(); file.updated = '刚刚'; try { fillContextSections(); } catch (_) {} markSaving(); }
    const renderCustomDoc = renderCustom;
    renderCustom = function (id) {
      const file = findFile(state.renderContext?.fileId);
      const kind = file?.kind || 'doc';
      if (kind === 'sheet') return renderSheetPage(file);
      if (kind === 'canvas') return renderCanvasPage(file);
      if (kind === 'mindmap') return renderMindmapPage(file);
      return renderCustomDoc(id);
    };

    /* ---------- 表格（参考在线表格：工作表 tab · 工具栏 · 名称框/公式栏 · 可横向滚动的网格） ---------- */
    const SH_FONTS = [['', '默认字体'], ['"PingFang SC","Helvetica Neue",sans-serif', '苹方'], ['"Songti SC",SimSun,serif', '宋体'], ['"Heiti SC",SimHei,sans-serif', '黑体'], ['Georgia,serif', 'Georgia'], ['Menlo,Consolas,monospace', '等宽']];
    const SH_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
    const SH_FORMATS = [['general', '常规'], ['number', '数字'], ['currency', '货币'], ['percent', '百分比'], ['text', '文本']];
    const SH_COLORS = ['#191917', '#696764', '#b34d46', '#c9762b', '#9a9a98', '#191917', '#2f6db3', '#6b4fa3'];
    const SH_FILLS = ['', '#fff3c4', '#fde8e6', '#fdebd9', '#e3f1de', '#dcefe9', '#dfe9f7', '#ebe3f6', '#f0f0ee'];
    const SI = {
      menu: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="9"/><path d="M8 10h8M8 14h8"/></svg>',
      brush: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 4h10v6H5zM10 10v4M8 14h4v6H8z"/></svg>',
      clear: '<svg viewBox="0 0 24 24" class="icon"><path d="m4 15 8-8 5 5-6 6H7z"/><path d="M4 21h16"/></svg>',
      insert: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
      border: '<svg viewBox="0 0 24 24" class="icon"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/></svg>',
      vtop: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h16M12 9v11M8 13l4-4 4 4"/></svg>',
      vmid: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 12h16M12 4v5M12 15v5M9 7l3 2 3-2M9 17l3-2 3 2"/></svg>',
      vbot: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 19h16M12 4v11M8 11l4 4 4-4"/></svg>',
      wrap: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 6h16M4 12h10a3 3 0 0 1 0 6h-2M4 18h5M14 16l-2 2 2 2"/></svg>',
      merge: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M9 12h6M11 10l-2 2 2 2M13 10l2 2-2 2"/></svg>',
      yen: '<span style="font:600 14px/1 var(--font-ui)">¥</span>', pct: '<span style="font:600 14px/1 var(--font-ui)">%</span>',
      decInc: '<span style="font:600 11px/1 var(--font-ui)">.00<sup>+</sup></span>', decDec: '<span style="font:600 11px/1 var(--font-ui)">.0<sup>−</sup></span>',
      freeze: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 4v16" stroke-width="2.4"/></svg>',
      filter: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h16l-6 7v6l-4 2v-8z"/></svg>',
      sort: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 4v16M3 17l3 3 3-3M12 6h9M12 12h7M12 18h5"/></svg>',
      cond: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16"/><path d="M12 12h6v3h-6z" fill="currentColor" opacity=".35"/></svg>',
      list: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 10h6M7 14h4M16 11l2 2 2-2"/></svg>',
      sigma: '<span style="font:600 15px/1 Georgia,serif">Σ</span>',
      multi: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/></svg>',
      find: '<svg viewBox="0 0 24 24" class="icon"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M6 8h9M6 11h6"/></svg>',
      comment: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
      caret: '<svg viewBox="0 0 24 24" class="icon caret"><path d="m7 10 5 5 5-5"/></svg>',
      fold: '<svg viewBox="0 0 24 24" class="icon"><path d="m6 15 6-6 6 6"/></svg>',
      book: '<svg viewBox="0 0 24 24" class="icon"><path d="m4 8 8-4 8 4-8 4z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg>'
    };
    function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
    function colIndex(name) { let n = 0; for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
    const cellRef = (r, c) => `${colName(c)}${r + 1}`;
    function sheetNewSheet(name) { return { name, cols: 26, rows: 50, cells: {}, widths: {}, rules: [], frozenRows: 0, frozenCols: 0, filter: null }; }
    function sheetBook(file) {
      if (!file.sheets) { const first = file.sheet ? { ...file.sheet } : sheetNewSheet('Sheet1'); first.name = first.name || 'Sheet1'; file.sheets = [first]; delete file.sheet; file.activeSheet = 0; }
      file.sheets.forEach(sh => { sh.widths = sh.widths || {}; sh.rules = sh.rules || []; sh.frozenRows = sh.frozenRows || 0; sh.frozenCols = sh.frozenCols || 0; sh.cols = Math.max(sh.cols || 0, 26); sh.rows = Math.max(sh.rows || 0, 50); sh.cells = sh.cells || {}; });
      file.activeSheet = Math.min(file.activeSheet || 0, file.sheets.length - 1);
      return file.sheets[file.activeSheet];
    }
    function sheetRaw(sh, r, c) { return sh.cells[`${r},${c}`]?.v ?? ''; }
    function sheetNum(sh, r, c, depth) { const raw = sheetRaw(sh, r, c); const v = raw.startsWith('=') ? sheetEval(sh, raw, depth + 1) : raw; const n = parseFloat(String(v).replace(/[,¥%\s]/g, '')); return Number.isFinite(n) ? n : NaN; }
    function sheetEval(sh, raw, depth = 0) {
      if (depth > 30) return '#循环';
      let expr = raw.slice(1).toUpperCase().replace(/\s+/g, '');
      try {
        expr = expr.replace(/(SUM|AVERAGE|AVG|MAX|MIN|COUNT)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (m, fn, c1, r1, c2, r2) => {
          const vals = [], ca = colIndex(c1), cb = colIndex(c2), ra = +r1 - 1, rb = +r2 - 1;
          for (let r = Math.min(ra, rb); r <= Math.max(ra, rb); r++) for (let c = Math.min(ca, cb); c <= Math.max(ca, cb); c++) { const n = sheetNum(sh, r, c, depth); if (!isNaN(n)) vals.push(n); }
          if (fn === 'COUNT') return String(vals.length);
          if (!vals.length) return '0';
          if (fn === 'SUM') return String(vals.reduce((a, b) => a + b, 0));
          if (fn === 'MAX') return String(Math.max(...vals));
          if (fn === 'MIN') return String(Math.min(...vals));
          return String(vals.reduce((a, b) => a + b, 0) / vals.length);
        });
        expr = expr.replace(/([A-Z]+)(\d+)/g, (m, c, r) => { const n = sheetNum(sh, +r - 1, colIndex(c), depth); return isNaN(n) ? '0' : String(n); });
        if (!/^[-\d+*/().%]*$/.test(expr) || !expr) return '#错误';
        const v = Function('"use strict";return (' + expr + ')')();
        return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '#错误';
      } catch (_) { return '#错误'; }
    }
    function sheetDisplay(sh, cell) {
      const raw = cell?.v || ''; let v = raw.startsWith('=') ? sheetEval(sh, raw) : raw;
      const fmt = cell?.fmt || 'general'; if (fmt === 'general' || fmt === 'text' || v.startsWith('#')) return v;
      const n = parseFloat(String(v).replace(/[,¥%\s]/g, '')); if (!Number.isFinite(n)) return v;
      const dec = cell?.dec ?? (fmt === 'percent' ? 0 : 2);
      if (fmt === 'percent') return (n * 100).toFixed(dec) + '%';
      const num = n.toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      return fmt === 'currency' ? '¥' + num : num;
    }
    function sheetRuleHit(rule, sh, r, c, text) {
      if (r < rule.r1 || r > rule.r2 || c < rule.c1 || c > rule.c2) return false;
      if (rule.op === 'contains') return !!text && text.includes(rule.val);
      const n = parseFloat(String(text).replace(/[,¥%\s]/g, '')), t = parseFloat(rule.val); if (!Number.isFinite(n) || !Number.isFinite(t)) return false;
      return rule.op === '>' ? n > t : rule.op === '<' ? n < t : n === t;
    }
    // —— 每张稿纸的界面状态（选区、编辑中） ——
    const sheetUI = new Map();
    function shUI(file) { if (!sheetUI.has(file.id)) sheetUI.set(file.id, { r: 0, c: 0, r1: 0, c1: 0, r2: 0, c2: 0, editing: null, brush: null, collapsed: false }); return sheetUI.get(file.id); }
    function shRange(ui) { return { r1: Math.min(ui.r1, ui.r2), r2: Math.max(ui.r1, ui.r2), c1: Math.min(ui.c1, ui.c2), c2: Math.max(ui.c1, ui.c2) }; }
    function shCells(sh, rg, create = false) { const out = []; for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) { const k = `${r},${c}`; if (!sh.cells[k] && create) sh.cells[k] = {}; if (sh.cells[k]) out.push([k, sh.cells[k]]); } return out; }
    function shCleanCell(sh, k) { const cell = sh.cells[k]; if (cell && !Object.keys(cell).some(x => cell[x] !== undefined && cell[x] !== '' && cell[x] !== false && cell[x] !== null)) delete sh.cells[k]; }
    // —— 历史 ——
    const sheetHist = new Map();
    function shHist(file) { if (!sheetHist.has(file.id)) sheetHist.set(file.id, { past: [], future: [] }); return sheetHist.get(file.id); }
    function sheetMutate(paper, file, fn, opts = {}) {
      const h = shHist(file); if (!opts.noHistory) { h.past.push(JSON.stringify({ sheets: file.sheets, active: file.activeSheet })); if (h.past.length > 80) h.past.shift(); h.future = []; }
      fn(sheetBook(file)); sheetRefresh(paper, file); blankSaved(paper, file);
    }
    function sheetUndo(paper, file, redo = false) {
      const h = shHist(file), from = redo ? h.future : h.past, to = redo ? h.past : h.future; if (!from.length) return showToast(redo ? '没有可重做的操作' : '没有可撤销的操作');
      to.push(JSON.stringify({ sheets: file.sheets, active: file.activeSheet })); const snap = JSON.parse(from.pop()); file.sheets = snap.sheets; file.activeSheet = snap.active; sheetRefresh(paper, file); blankSaved(paper, file);
    }
    // —— 渲染 ——
    function sheetToolbarHtml(file, sh, ui) {
      const tb = (cmd, label, icon, opts = {}) => `<button type="button" class="sh-tool ${opts.active ? 'active' : ''}" data-sheet-cmd="${cmd}" title="${label}" aria-label="${label}"><span class="sh-tool-icon">${icon}${opts.dd ? SI.caret : ''}</span><span class="sh-tool-label">${label}</span></button>`;
      const ib = (cmd, label, icon, opts = {}) => `<button type="button" class="sh-tool sh-tool-sm ${opts.active ? 'active' : ''}" data-sheet-cmd="${cmd}" title="${label}" aria-label="${label}"><span class="sh-tool-icon">${icon}${opts.dd ? SI.caret : ''}</span></button>`;
      const sep = '<span class="sh-sep"></span>';
      const cell = sh.cells[`${ui.r},${ui.c}`] || {};
      return `<div class="sh-toolbar ${ui.collapsed ? 'collapsed' : ''}" data-sheet-toolbar>
        ${tb('menu', '菜单', SI.menu, { dd: true })}${sep}
        ${tb('undo', '撤销', CI.undo)}${tb('redo', '重做', CI.redo)}${tb('brush', '格式刷', SI.brush, { active: !!ui.brush })}${tb('clearfmt', '清除格式', SI.clear)}${sep}
        ${tb('insert', '插入', SI.insert, { dd: true })}${sep}
        <select class="sh-select sh-font" data-sheet-font title="字体">${SH_FONTS.map(([v, n]) => `<option value="${escapeHtml(v)}" ${(cell.font || '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select class="sh-select sh-size" data-sheet-size title="字号">${SH_SIZES.map(v => `<option value="${v}" ${(cell.size || 10) === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        ${ib('border', '边框', SI.border, { dd: true })}${sep}
        ${ib('va:top', '顶端对齐', SI.vtop, { active: cell.va === 'top' })}${ib('va:middle', '垂直居中', SI.vmid, { active: !cell.va || cell.va === 'middle' })}${ib('va:bottom', '底端对齐', SI.vbot, { active: cell.va === 'bottom' })}${sep}
        ${ib('bold', '加粗', '<b>B</b>', { active: !!cell.b })}${ib('strike', '删除线', '<s>S</s>', { active: !!cell.s })}${ib('italic', '斜体', '<i>I</i>', { active: !!cell.i })}${ib('underline', '下划线', '<u>U</u>', { active: !!cell.u })}${ib('color', '文字颜色', `<span class="sh-color-a" style="border-bottom-color:${cell.fg || '#d33'}">A</span>`, { dd: true })}${ib('fill', '填充颜色', `<span class="sh-fill-a" style="background:${cell.bg || '#f4d35e'}"></span>`, { dd: true })}${sep}
        ${ib('ha:left', '左对齐', CI.left, { active: !cell.a || cell.a === 'left' })}${ib('ha:center', '居中对齐', CI.center, { active: cell.a === 'center' })}${ib('ha:right', '右对齐', CI.right, { active: cell.a === 'right' })}${ib('wrap', '自动换行', SI.wrap, { active: !!cell.wrap })}${tb('merge', '合并单元格', SI.merge, { active: !!(cell.cs > 1 || cell.rs > 1) })}${sep}
        <select class="sh-select sh-fmt" data-sheet-fmt title="数字格式">${SH_FORMATS.map(([v, n]) => `<option value="${v}" ${(cell.fmt || 'general') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
        ${ib('fmt:currency', '货币', SI.yen, { active: cell.fmt === 'currency' })}${ib('fmt:percent', '百分比', SI.pct, { active: cell.fmt === 'percent' })}${ib('dec+', '增加小数位', SI.decInc)}${ib('dec-', '减少小数位', SI.decDec)}${sep}
        ${tb('freeze', '冻结', SI.freeze, { dd: true, active: !!(sh.frozenRows || sh.frozenCols) })}${tb('filter', '筛选', SI.filter, { active: !!sh.filter })}${tb('sort', '排序', SI.sort, { dd: true })}${tb('cond', '条件格式', SI.cond, { active: !!sh.rules.length })}${tb('list', '下拉列表', SI.list)}${tb('formula', '公式', SI.sigma, { dd: true })}${sep}
        ${tb('find', '查找和替换', SI.find)}
      </div>`;
    }
    function sheetGrid(file) {
      const sh = sheetBook(file), ui = shUI(file), rg = shRange(ui);
      const covered = new Set(); Object.entries(sh.cells).forEach(([k, cell]) => { if (cell.cs > 1 || cell.rs > 1) { const [r, c] = k.split(',').map(Number); for (let i = 0; i < (cell.rs || 1); i++) for (let j = 0; j < (cell.cs || 1); j++) if (i || j) covered.add(`${r + i},${c + j}`); } });
      let left = 38; const colLeft = [];
      for (let c = 0; c < sh.cols; c++) { colLeft.push(left); left += sh.widths[c] || 100; }
      let html = `<table class="sheet" style="width:${left}px"><colgroup><col style="width:38px">${Array.from({ length: sh.cols }, (_, c) => `<col style="width:${sh.widths[c] || 100}px">`).join('')}</colgroup><thead><tr><th class="sheet-corner" data-sheet-corner></th>${Array.from({ length: sh.cols }, (_, c) => `<th data-sheet-col="${c}" class="${c >= rg.c1 && c <= rg.c2 ? 'hl' : ''} ${c < sh.frozenCols ? 'fz-c' : ''}" style="${c < sh.frozenCols ? `left:${colLeft[c]}px` : ''}">${colName(c)}<i class="col-resizer" data-col-resize="${c}"></i></th>`).join('')}</tr></thead><tbody>`;
      const filterText = sh.filter?.text?.toLowerCase();
      for (let r = 0; r < sh.rows; r++) {
        let hidden = false;
        if (filterText && r > 0) { const cell = sh.cells[`${r},${sh.filter.col}`]; hidden = !sheetDisplay(sh, cell).toLowerCase().includes(filterText); }
        html += `<tr class="${hidden ? 'hidden-row' : ''} ${r < sh.frozenRows ? 'fz-r' : ''}" style="${r < sh.frozenRows ? `--fz-top:${26 + r * 28}px` : ''}"><th data-sheet-row="${r}" class="${r >= rg.r1 && r <= rg.r2 ? 'hl' : ''}">${r + 1}</th>`;
        for (let c = 0; c < sh.cols; c++) {
          const k = `${r},${c}`; if (covered.has(k)) continue;
          const cell = sh.cells[k] || {}, raw = cell.v || '', isF = raw.startsWith('='), text = sheetDisplay(sh, cell);
          let bg = cell.bg || ''; sh.rules.forEach(rule => { if (sheetRuleHit(rule, sh, r, c, text)) bg = rule.bg; });
          const inSel = r >= rg.r1 && r <= rg.r2 && c >= rg.c1 && c <= rg.c2, active = r === ui.r && c === ui.c;
          const style = [bg ? `background:${bg}` : '', cell.fg ? `color:${cell.fg}` : '', cell.font ? `font-family:${cell.font}` : '', cell.size ? `font-size:${cell.size}pt` : '', c < sh.frozenCols ? `left:${colLeft[c]}px` : ''].filter(Boolean).join(';');
          html += `<td data-cell="${k}" class="${cell.b ? 'b' : ''} ${cell.i ? 'i' : ''} ${cell.u ? 'u' : ''} ${cell.s ? 's' : ''} ${cell.a ? 'a-' + cell.a : ''} ${cell.va ? 'va-' + cell.va : ''} ${cell.wrap ? 'wrap' : ''} ${isF ? 'f' : ''} ${text.startsWith('#') ? 'err' : ''} ${cell.bd ? 'bd-' + cell.bd : ''} ${cell.note ? 'has-note' : ''} ${cell.list ? 'has-list' : ''} ${inSel ? 'sel' : ''} ${active ? 'active' : ''} ${c < sh.frozenCols ? 'fz-c' : ''}" ${cell.cs > 1 ? `colspan="${cell.cs}"` : ''} ${cell.rs > 1 ? `rowspan="${cell.rs}"` : ''} style="${style}" ${cell.note ? `title="${escapeHtml(cell.note)}"` : ''}>${escapeHtml(text)}</td>`;
        }
        html += '</tr>';
      }
      return html + '</tbody></table>';
    }
    function renderSheetPage(file) {
      const sh = sheetBook(file), ui = shUI(file);
      const html = paperWrap(`
        <div class="sh-tabs" data-sheet-tabs>
          <span class="sh-book-icon">${SI.book}</span>
          <div class="cdoc-title sh-title" contenteditable="false" data-cdoc-title data-sheet-title data-placeholder="未命名表格" spellcheck="false" title="双击重命名">${escapeHtml(file.title || '')}</div>
          <span class="sh-vsep"></span>
          ${file.sheets.map((x, i) => `<button type="button" class="sh-tab ${i === file.activeSheet ? 'active' : ''}" data-sheet-tab="${i}" title="双击重命名">${escapeHtml(x.name)}</button>`).join('')}
          <button type="button" class="sh-tab-add" data-sheet-add title="新建工作表">${CI.undo ? '' : ''}<svg viewBox="0 0 24 24" class="icon sm"><path d="M12 5v14M5 12h14"/></svg></button>
          <span class="sh-tabs-right">${cdocAvatarHtml()}<span data-cdoc-updated>${cdocFmtModified(file.updatedAt)}</span><button type="button" class="sh-fold ${ui.collapsed ? 'is-collapsed' : ''}" data-sheet-cmd="fold" title="${ui.collapsed ? '展开工具栏' : '收起工具栏'}" aria-label="${ui.collapsed ? '展开工具栏' : '收起工具栏'}">${SI.fold}</button></span>
        </div>
        ${sheetToolbarHtml(file, sh, ui)}
        <div class="sh-formula"><input class="sh-namebox" data-sheet-namebox value="${cellRef(ui.r, ui.c)}" readonly aria-label="当前单元格"><span class="sh-fx">fx</span><input class="sh-fbar" data-sheet-fbar value="${escapeHtml(sheetRaw(sh, ui.r, ui.c))}" placeholder="" aria-label="公式栏" spellcheck="false"></div>
        <div class="sheet-wrap" data-sheet-wrap tabindex="0">${sheetGrid(file)}</div>
      `, { page: '1' });
      return html.replace('class="paper', 'class="paper cloud-doc sheet-doc');
    }
    function sheetRefresh(paper, file, opts = {}) {
      const wrap = $('[data-sheet-wrap]', paper); if (!wrap) return;
      const sh = sheetBook(file), ui = shUI(file);
      if (!opts.gridOnly) { const tbOld = $('[data-sheet-toolbar]', paper); if (tbOld) tbOld.outerHTML = sheetToolbarHtml(file, sh, ui); }
      const tabs = $('[data-sheet-tabs]', paper); if (tabs && !opts.gridOnly) { $$('.sh-tab, .sh-tab-add', tabs).forEach(el => el.remove()); $('.sh-vsep', tabs).insertAdjacentHTML('afterend', file.sheets.map((x, i) => `<button type="button" class="sh-tab ${i === file.activeSheet ? 'active' : ''}" data-sheet-tab="${i}" title="双击重命名">${escapeHtml(x.name)}</button>`).join('') + `<button type="button" class="sh-tab-add" data-sheet-add title="新建工作表"><svg viewBox="0 0 24 24" class="icon sm"><path d="M12 5v14M5 12h14"/></svg></button>`); }
      const x = wrap.scrollLeft, y = wrap.scrollTop; wrap.innerHTML = sheetGrid(file); wrap.scrollLeft = x; wrap.scrollTop = y;
      ui.editing = null;
      const nb = $('[data-sheet-namebox]', paper); if (nb) nb.value = cellRef(ui.r, ui.c);
      const fb = $('[data-sheet-fbar]', paper); if (fb && document.activeElement !== fb) fb.value = sheetRaw(sh, ui.r, ui.c);
      const upd = $('[data-cdoc-updated]', paper); if (upd) upd.textContent = cdocFmtModified(file.updatedAt);
    }
    function sheetPaint(paper, file) {   // 只更新选区高亮、名称框、公式栏，不重画网格
      const ui = shUI(file), rg = shRange(ui), sh = sheetBook(file);
      $$('.sel, .active, th.hl', paper).forEach(el => el.classList.remove('sel', 'active', 'hl'));
      $$('td[data-cell]', paper).forEach(td => { const [r, c] = td.dataset.cell.split(',').map(Number); if (r >= rg.r1 && r <= rg.r2 && c >= rg.c1 && c <= rg.c2) td.classList.add('sel'); if (r === ui.r && c === ui.c) td.classList.add('active'); });
      $$('th[data-sheet-col]', paper).forEach(th => { const c = +th.dataset.sheetCol; th.classList.toggle('hl', c >= rg.c1 && c <= rg.c2); });
      $$('th[data-sheet-row]', paper).forEach(th => { const r = +th.dataset.sheetRow; th.classList.toggle('hl', r >= rg.r1 && r <= rg.r2); });
      const nb = $('[data-sheet-namebox]', paper); if (nb) nb.value = rg.r1 === rg.r2 && rg.c1 === rg.c2 ? cellRef(ui.r, ui.c) : `${cellRef(rg.r1, rg.c1)}:${cellRef(rg.r2, rg.c2)}`;
      const fb = $('[data-sheet-fbar]', paper); if (fb && document.activeElement !== fb) fb.value = sheetRaw(sh, ui.r, ui.c);
      const tbOld = $('[data-sheet-toolbar]', paper); if (tbOld) tbOld.outerHTML = sheetToolbarHtml(file, sh, ui);
    }
    function sheetSelect(paper, file, r, c, extend = false) {
      const sh = sheetBook(file), ui = shUI(file); r = Math.max(0, Math.min(r, sh.rows - 1)); c = Math.max(0, Math.min(c, sh.cols - 1));
      if (extend) { ui.r2 = r; ui.c2 = c; } else { ui.r = r; ui.c = c; ui.r1 = ui.r2 = r; ui.c1 = ui.c2 = c; }
      sheetPaint(paper, file);
      $(`td[data-cell="${ui.r},${ui.c}"]`, paper)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function sheetTd(paper, r, c) { return $(`td[data-cell="${r},${c}"]`, paper); }
    function sheetStartEdit(paper, file, initial = null) {
      const ui = shUI(file), sh = sheetBook(file), td = sheetTd(paper, ui.r, ui.c); if (!td) return;
      const cell = sh.cells[`${ui.r},${ui.c}`];
      if (cell?.list && initial === null) return sheetListPop(paper, file, td, cell);
      td.contentEditable = 'true'; td.textContent = initial !== null ? initial : sheetRaw(sh, ui.r, ui.c); td.classList.add('editing'); ui.editing = td; td.focus();
      const r = document.createRange(); r.selectNodeContents(td); r.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const fb = $('[data-sheet-fbar]', paper); if (fb) fb.value = td.textContent;
    }
    function sheetCommitEdit(paper, file, cancel = false) {
      const ui = shUI(file); const td = ui.editing; if (!td) return false;
      const raw = td.innerText.replace(/\n+$/, ''); td.contentEditable = 'false'; td.classList.remove('editing'); ui.editing = null;
      const [r, c] = td.dataset.cell.split(',').map(Number); const sh = sheetBook(file);
      if (cancel || sheetRaw(sh, r, c) === raw) { sheetRefresh(paper, file, { gridOnly: true }); return false; }
      sheetMutate(paper, file, s => { const k = `${r},${c}`; s.cells[k] = s.cells[k] || {}; s.cells[k].v = raw; shCleanCell(s, k); }); return true;
    }
    function sheetListPop(paper, file, td, cell) {
      const pop = cdocPop('sheet-list-pop', 'cdoc-float-pop');
      pop.innerHTML = cell.list.map(opt => `<button type="button" class="cdoc-bm-item ${opt === cell.v ? 'active' : ''}" data-sheet-listpick="${escapeHtml(opt)}"><span>${escapeHtml(opt)}</span></button>`).join('') + `<button type="button" class="cdoc-bm-item" data-sheet-listpick=""><span style="color:var(--ink-3)">清空</span></button>`;
      pop.dataset.forFile = file.id; cdocPlace(pop, td.getBoundingClientRect(), 4);
    }
    function sheetRemap(sh, fn) {   // fn(r,c) -> [r,c] | null ；同时平移公式引用、列宽、规则
      const next = {}; Object.entries(sh.cells).forEach(([k, v]) => { const [r, c] = k.split(',').map(Number); const m = fn(r, c); if (m) next[`${m[0]},${m[1]}`] = v; });
      Object.values(next).forEach(cell => { if ((cell.v || '').startsWith('=')) cell.v = cell.v.replace(/([A-Z]+)(\d+)/gi, (mm, col, row) => { const m = fn(+row - 1, colIndex(col.toUpperCase())); return m ? colName(m[1]) + (m[0] + 1) : '#REF'; }); });
      sh.cells = next;
      const widths = {}; Object.entries(sh.widths).forEach(([c, w]) => { const m = fn(0, +c); if (m) widths[m[1]] = w; }); sh.widths = widths;
      sh.rules = sh.rules.map(rule => { const a = fn(rule.r1, rule.c1), b = fn(rule.r2, rule.c2); return a && b ? { ...rule, r1: a[0], c1: a[1], r2: b[0], c2: b[1] } : null; }).filter(Boolean);
      if (sh.filter) { const m = fn(0, sh.filter.col); sh.filter = m ? { ...sh.filter, col: m[1] } : null; }
    }
    function sheetPop(anchor, items, kind) {
      const pop = cdocPop('sheet-pop', 'cdoc-float-pop'); if (!pop.classList.contains('hidden') && pop.dataset.kind === kind) return pop.classList.add('hidden');
      pop.dataset.kind = kind; pop.innerHTML = items; pop.classList.remove('hidden'); cdocPlace(pop, anchor.getBoundingClientRect(), 6);
    }
    const shItem = (val, label, icon = '', active = false) => `<button type="button" class="cdoc-bm-item ${active ? 'active' : ''}" data-sheet-pick="${escapeHtml(val)}">${icon}<span>${label}</span></button>`;
    function sheetPaperOf(el) { return el.closest?.('[data-paper]') || $(`[data-paper][data-page-file="${$('#sheet-pop')?.dataset.forFile || ''}"]`); }
    function sheetAutoRange(sh, ui) {   // 选区多格用选区；单格则向上找连续的数字
      const rg = shRange(ui); if (rg.r1 !== rg.r2 || rg.c1 !== rg.c2) return `${cellRef(rg.r1, rg.c1)}:${cellRef(rg.r2, rg.c2)}`;
      let r = ui.r - 1; while (r >= 0 && !isNaN(sheetNum(sh, r, ui.c, 0))) r--; if (r === ui.r - 1) return `${cellRef(Math.max(0, ui.r - 1), ui.c)}:${cellRef(Math.max(0, ui.r - 1), ui.c)}`; return `${cellRef(r + 1, ui.c)}:${cellRef(ui.r - 1, ui.c)}`;
    }
    function sheetCommand(paper, file, cmd, anchor) {
      const sh = sheetBook(file), ui = shUI(file), rg = shRange(ui), k = `${ui.r},${ui.c}`;
      const styleSel = fn => sheetMutate(paper, file, s => { shCells(s, rg, true).forEach(([key, cell]) => { fn(cell); shCleanCell(s, key); }); });
      const toggle = prop => styleSel(cell => { cell[prop] = !cell[prop]; });
      if (ui.editing) sheetCommitEdit(paper, file);
      if (cmd === 'fold') { ui.collapsed = !ui.collapsed; sheetPaint(paper, file); const fb = $('.sh-fold', paper); if (fb) { fb.classList.toggle('is-collapsed', ui.collapsed); fb.title = fb.ariaLabel = ui.collapsed ? '展开工具栏' : '收起工具栏'; } return; }
      if (cmd === 'undo') return sheetUndo(paper, file); if (cmd === 'redo') return sheetUndo(paper, file, true);
      if (cmd === 'bold') return toggle('b'); if (cmd === 'italic') return toggle('i'); if (cmd === 'underline') return toggle('u'); if (cmd === 'strike') return toggle('s'); if (cmd === 'wrap') return toggle('wrap');
      if (cmd.startsWith('ha:')) return styleSel(cell => { cell.a = cmd.slice(3) === 'left' ? undefined : cmd.slice(3); });
      if (cmd.startsWith('va:')) return styleSel(cell => { cell.va = cmd.slice(3) === 'middle' ? undefined : cmd.slice(3); });
      if (cmd.startsWith('fmt:')) return styleSel(cell => { cell.fmt = cell.fmt === cmd.slice(4) ? undefined : cmd.slice(4); });
      if (cmd === 'dec+' || cmd === 'dec-') return styleSel(cell => { const cur = cell.dec ?? (cell.fmt === 'percent' ? 0 : 2); cell.dec = Math.max(0, Math.min(6, cur + (cmd === 'dec+' ? 1 : -1))); if (!cell.fmt || cell.fmt === 'general') cell.fmt = 'number'; });
      if (cmd === 'clearfmt') return styleSel(cell => { Object.keys(cell).forEach(x => { if (x !== 'v' && x !== 'cs' && x !== 'rs' && x !== 'note' && x !== 'list') delete cell[x]; }); });
      if (cmd === 'brush') { if (ui.brush) ui.brush = null; else { const src = sh.cells[k] || {}; ui.brush = {}; ['b', 'i', 'u', 's', 'a', 'va', 'wrap', 'fg', 'bg', 'font', 'size', 'fmt', 'dec', 'bd'].forEach(x => { if (src[x] !== undefined) ui.brush[x] = src[x]; }); showToast('格式刷已开启：点击目标单元格应用格式'); } sheetPaint(paper, file); return; }
      if (cmd === 'merge') {
        const top = sh.cells[k];
        if (top && (top.cs > 1 || top.rs > 1)) return sheetMutate(paper, file, s => { const c = s.cells[k]; delete c.cs; delete c.rs; shCleanCell(s, k); });
        if (rg.r1 === rg.r2 && rg.c1 === rg.c2) return showToast('先选中要合并的多个单元格');
        return sheetMutate(paper, file, s => { const key = `${rg.r1},${rg.c1}`; s.cells[key] = s.cells[key] || {}; const first = s.cells[key]; if (!first.v) { const withText = shCells(s, rg).find(([kk, cc]) => cc.v); if (withText) first.v = withText[1].v; } shCells(s, rg).forEach(([kk, cc]) => { if (kk !== key) { delete cc.v; delete cc.cs; delete cc.rs; shCleanCell(s, kk); } }); first.cs = rg.c2 - rg.c1 + 1; first.rs = rg.r2 - rg.r1 + 1; ui.r = rg.r1; ui.c = rg.c1; });
      }
      if (cmd === 'menu') return sheetPop(anchor, shItem('rename', '重命名工作表') + shItem('dup', '复制工作表') + shItem('delsheet', '删除工作表') + shItem('csv', '导出 CSV') + shItem('clearsheet', '清空工作表'), 'menu');
      if (cmd === 'insert') return sheetPop(anchor, shItem('row-above', '在上方插入行') + shItem('row-below', '在下方插入行') + shItem('col-left', '在左侧插入列') + shItem('col-right', '在右侧插入列') + shItem('del-row', `删除第 ${rg.r1 + 1}${rg.r2 > rg.r1 ? '–' + (rg.r2 + 1) : ''} 行`) + shItem('del-col', `删除 ${colName(rg.c1)}${rg.c2 > rg.c1 ? '–' + colName(rg.c2) : ''} 列`), 'insert');
      if (cmd === 'border') return sheetPop(anchor, shItem('bd:all', '所有框线', SI.border, (sh.cells[k] || {}).bd === 'all') + shItem('bd:outer', '外侧框线') + shItem('bd:bottom', '下框线') + shItem('bd:', '无框线'), 'border');
      if (cmd === 'color') return sheetPop(anchor, `<div class="cdoc-bm-colors"><span>文字颜色</span>${SH_COLORS.map(c => `<button type="button" style="background:${c}" data-sheet-pick="fg:${c}" title="${c}"></button>`).join('')}<button type="button" class="clear" style="background:#fff" data-sheet-pick="fg:" title="默认"></button></div>`, 'color');
      if (cmd === 'fill') return sheetPop(anchor, `<div class="cdoc-bm-colors"><span>填充颜色</span>${SH_FILLS.map(c => `<button type="button" style="background:${c || '#fff'}" class="${c ? '' : 'clear'}" data-sheet-pick="bg:${c}" title="${c || '无'}"></button>`).join('')}</div>`, 'fill');
      if (cmd === 'freeze') return sheetPop(anchor, shItem('fz:row', '冻结首行', '', sh.frozenRows === 1) + shItem('fz:col', '冻结首列', '', sh.frozenCols === 1) + shItem('fz:both', '冻结首行和首列', '', sh.frozenRows === 1 && sh.frozenCols === 1) + shItem('fz:none', '取消冻结'), 'freeze');
      if (cmd === 'sort') return sheetPop(anchor, shItem('sort:asc', `按 ${colName(ui.c)} 列升序（首行为表头）`) + shItem('sort:desc', `按 ${colName(ui.c)} 列降序（首行为表头）`), 'sort');
      if (cmd === 'formula') return sheetPop(anchor, ['SUM', 'AVERAGE', 'MAX', 'MIN', 'COUNT'].map(f => shItem(`fx:${f}`, `${f}（${{ SUM: '求和', AVERAGE: '平均值', MAX: '最大值', MIN: '最小值', COUNT: '计数' }[f]}）`)).join(''), 'formula');
      if (cmd === 'filter') {
        if (sh.filter) return sheetMutate(paper, file, s => { s.filter = null; }, { noHistory: true });
        openFlowDialog('筛选', `<label>按 ${colName(ui.c)} 列筛选，仅显示包含以下文字的行（首行视为表头，始终显示）<input id="sh-filter-text" placeholder="输入关键字"></label>`, flowButton('close-dialog', '取消') + flowButton('sheet-apply-filter', '应用筛选', '', true)); $('#sh-filter-text').dataset.forFile = file.id; setTimeout(() => $('#sh-filter-text')?.focus(), 30); return;
      }
      if (cmd === 'cond') {
        openFlowDialog('条件格式', `<p>对 <strong>${cellRef(rg.r1, rg.c1)}${rg.r2 > rg.r1 || rg.c2 > rg.c1 ? ':' + cellRef(rg.r2, rg.c2) : ''}</strong> 设置规则：</p><label>条件<select id="sh-cond-op"><option value=">">单元格值 大于</option><option value="<">单元格值 小于</option><option value="=">单元格值 等于</option><option value="contains">文本 包含</option></select></label><label>数值 / 文字<input id="sh-cond-val" placeholder="例如 100"></label><label>标记颜色<select id="sh-cond-bg">${SH_FILLS.filter(Boolean).map(c => `<option value="${c}" style="background:${c}">${c}</option>`).join('')}</select></label>${sh.rules.length ? `<p>当前已有 ${sh.rules.length} 条规则。</p>` : ''}`, flowButton('close-dialog', '取消') + (sh.rules.length ? flowButton('sheet-clear-rules', '清除全部规则') : '') + flowButton('sheet-apply-rule', '添加规则', '', true)); $('#sh-cond-op').dataset.forFile = file.id; return;
      }
      if (cmd === 'list') {
        const cur = (sh.cells[k] || {}).list || [];
        openFlowDialog('下拉列表', `<p>为 <strong>${cellRef(rg.r1, rg.c1)}${rg.r2 > rg.r1 || rg.c2 > rg.c1 ? ':' + cellRef(rg.r2, rg.c2) : ''}</strong> 设置选项，双击单元格即可选择。</p><label>选项（每行一个）<textarea id="sh-list-opts" placeholder="待定&#10;进行中&#10;完成">${escapeHtml(cur.join('\n'))}</textarea></label>`, flowButton('close-dialog', '取消') + (cur.length ? flowButton('sheet-clear-list', '移除下拉') : '') + flowButton('sheet-apply-list', '保存', '', true)); $('#sh-list-opts').dataset.forFile = file.id; return;
      }
      if (cmd === 'find') { openFlowDialog('查找和替换', `<label>查找<input id="sh-find-text" placeholder="要查找的内容"></label><label>替换为<input id="sh-replace-text" placeholder="留空则只查找"></label><p id="sh-find-result" style="min-height:18px"></p>`, flowButton('close-dialog', '关闭') + flowButton('sheet-find-next', '查找') + flowButton('sheet-replace-all', '全部替换', '', true)); $('#sh-find-text').dataset.forFile = file.id; setTimeout(() => $('#sh-find-text')?.focus(), 30); return; }
      if (cmd === 'note') { const cur = (sh.cells[k] || {}).note || ''; openFlowDialog(`评论 · ${cellRef(ui.r, ui.c)}`, `<label>评论内容<textarea id="sh-note-text" placeholder="写下对这个单元格的备注…">${escapeHtml(cur)}</textarea></label>`, flowButton('close-dialog', '取消') + (cur ? flowButton('sheet-del-note', '删除评论') : '') + flowButton('sheet-save-note', '保存', '', true)); $('#sh-note-text').dataset.forFile = file.id; setTimeout(() => $('#sh-note-text')?.focus(), 30); return; }
      if (cmd === 'multi') return showToast('多维表格视图在原型中暂未提供');
    }
    function sheetPick(paper, file, val) {
      const sh = sheetBook(file), ui = shUI(file), rg = shRange(ui);
      const styleSel = fn => sheetMutate(paper, file, s => { shCells(s, rg, true).forEach(([key, cell]) => { fn(cell); shCleanCell(s, key); }); });
      const [kind, arg] = val.includes(':') ? [val.slice(0, val.indexOf(':')), val.slice(val.indexOf(':') + 1)] : [val, ''];
      if (kind === 'bd') return styleSel(cell => { cell.bd = arg || undefined; });
      if (kind === 'fg') return styleSel(cell => { cell.fg = arg || undefined; });
      if (kind === 'bg') return styleSel(cell => { cell.bg = arg || undefined; });
      if (kind === 'fz') return sheetMutate(paper, file, s => { s.frozenRows = arg === 'row' || arg === 'both' ? 1 : 0; s.frozenCols = arg === 'col' || arg === 'both' ? 1 : 0; });
      if (kind === 'fx') { const range = sheetAutoRange(sh, ui); const target = rg.r1 === rg.r2 && rg.c1 === rg.c2 ? { r: ui.r, c: ui.c } : { r: rg.r2 + 1, c: rg.c1 }; return sheetMutate(paper, file, s => { const key = `${target.r},${target.c}`; s.cells[key] = s.cells[key] || {}; s.cells[key].v = `=${arg}(${range})`; ui.r = ui.r1 = ui.r2 = target.r; ui.c = ui.c1 = ui.c2 = target.c; }); }
      if (kind === 'sort') { const asc = arg === 'asc'; return sheetMutate(paper, file, s => { const rows = []; for (let r = 1; r < s.rows; r++) { const row = {}; for (let c = 0; c < s.cols; c++) { const cell = s.cells[`${r},${c}`]; if (cell) row[c] = cell; } rows.push(row); } const keyOf = row => { const cell = row[ui.c]; const t = cell ? sheetDisplay(s, cell) : ''; const n = parseFloat(String(t).replace(/[,¥%\s]/g, '')); return [Number.isFinite(n) ? 0 : t ? 1 : 2, Number.isFinite(n) ? n : t]; }; rows.sort((a, b) => { const ka = keyOf(a), kb = keyOf(b); if (ka[0] !== kb[0]) return ka[0] - kb[0]; const cmp = typeof ka[1] === 'number' ? ka[1] - kb[1] : String(ka[1]).localeCompare(String(kb[1]), 'zh'); return asc ? cmp : -cmp; }); const next = {}; for (let c = 0; c < s.cols; c++) { const head = s.cells[`0,${c}`]; if (head) next[`0,${c}`] = head; } rows.forEach((row, i) => Object.entries(row).forEach(([c, cell]) => { next[`${i + 1},${c}`] = cell; })); s.cells = next; }); }
      if (kind === 'row-above' || kind === 'row-below') { const at = kind === 'row-above' ? rg.r1 : rg.r2 + 1; return sheetMutate(paper, file, s => { sheetRemap(s, (r, c) => [r >= at ? r + 1 : r, c]); s.rows++; }); }
      if (kind === 'col-left' || kind === 'col-right') { const at = kind === 'col-left' ? rg.c1 : rg.c2 + 1; return sheetMutate(paper, file, s => { sheetRemap(s, (r, c) => [r, c >= at ? c + 1 : c]); s.cols++; }); }
      if (kind === 'del-row') { const n = rg.r2 - rg.r1 + 1; if (sh.rows - n < 1) return; return sheetMutate(paper, file, s => { sheetRemap(s, (r, c) => r >= rg.r1 && r <= rg.r2 ? null : [r > rg.r2 ? r - n : r, c]); s.rows -= n; ui.r = ui.r1 = ui.r2 = Math.min(rg.r1, s.rows - 1); }); }
      if (kind === 'del-col') { const n = rg.c2 - rg.c1 + 1; if (sh.cols - n < 1) return; return sheetMutate(paper, file, s => { sheetRemap(s, (r, c) => c >= rg.c1 && c <= rg.c2 ? null : [r, c > rg.c2 ? c - n : c]); s.cols -= n; ui.c = ui.c1 = ui.c2 = Math.min(rg.c1, s.cols - 1); }); }
      if (kind === 'rename') { openFlowDialog('重命名工作表', `<label>名称<input id="sh-rename" value="${escapeHtml(sh.name)}" maxlength="30"></label>`, flowButton('close-dialog', '取消') + flowButton('sheet-rename-ok', '保存', '', true)); $('#sh-rename').dataset.forFile = file.id; setTimeout(() => $('#sh-rename')?.select(), 30); return; }
      if (kind === 'dup') return sheetMutate(paper, file, () => { const copy = JSON.parse(JSON.stringify(sh)); copy.name = sh.name + ' 副本'; file.sheets.splice(file.activeSheet + 1, 0, copy); file.activeSheet++; });
      if (kind === 'delsheet') { if (file.sheets.length <= 1) return showToast('至少保留一张工作表'); return sheetMutate(paper, file, () => { file.sheets.splice(file.activeSheet, 1); file.activeSheet = Math.max(0, file.activeSheet - 1); }); }
      if (kind === 'clearsheet') return sheetMutate(paper, file, s => { s.cells = {}; s.rules = []; s.filter = null; });
      if (kind === 'csv') {
        const esc = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; const lines = [];
        for (let r = 0; r < sh.rows; r++) { const row = []; for (let c = 0; c < sh.cols; c++) row.push(esc(sheetDisplay(sh, sh.cells[`${r},${c}`]))); lines.push(row.join(',')); }
        while (lines.length && !lines[lines.length - 1].replace(/,/g, '').trim()) lines.pop();
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${file.title || '表格'} - ${sh.name}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); showToast('已导出 CSV'); return;
      }
    }
    // —— 事件 ——
    let sheetDragSel = null, sheetColResize = null;
    document.addEventListener('pointerdown', event => {
      const paper = event.target.closest?.('.paper.sheet-doc'); if (!paper || event.button !== 0) return;
      const file = findFile(paper.dataset.pageFile); if (!file) return; const ui = shUI(file);
      const resizer = event.target.closest('[data-col-resize]');
      if (resizer) { event.preventDefault(); event.stopImmediatePropagation(); const c = +resizer.dataset.colResize; sheetColResize = { paper, file, c, startX: event.clientX, startW: sheetBook(file).widths[c] || 100 }; return; }
      const td = event.target.closest('td[data-cell]');
      if (td) {
        if (ui.editing === td) return;
        if (ui.editing) sheetCommitEdit(paper, file);
        const [r, c] = td.dataset.cell.split(',').map(Number);
        if (ui.brush) { const props = ui.brush; sheetMutate(paper, file, s => { const k = `${r},${c}`; s.cells[k] = s.cells[k] || {}; Object.assign(s.cells[k], props); }); ui.brush = null; sheetPaint(paper, file); event.preventDefault(); return; }
        sheetSelect(paper, file, r, c, event.shiftKey); sheetDragSel = { paper, file }; event.preventDefault(); $('[data-sheet-wrap]', paper)?.focus({ preventScroll: true }); return;
      }
      const colTh = event.target.closest('th[data-sheet-col]'), rowTh = event.target.closest('th[data-sheet-row]');
      if (colTh || rowTh) { if (ui.editing) sheetCommitEdit(paper, file); const sh = sheetBook(file); if (colTh) { const c = +colTh.dataset.sheetCol; ui.r = 0; ui.c = c; ui.r1 = 0; ui.r2 = sh.rows - 1; ui.c1 = ui.c2 = c; } else { const r = +rowTh.dataset.sheetRow; ui.r = r; ui.c = 0; ui.c1 = 0; ui.c2 = sh.cols - 1; ui.r1 = ui.r2 = r; } sheetPaint(paper, file); event.preventDefault(); $('[data-sheet-wrap]', paper)?.focus({ preventScroll: true }); return; }
      if (event.target.closest('[data-sheet-corner]')) { const sh = sheetBook(file); ui.r = ui.c = 0; ui.r1 = ui.c1 = 0; ui.r2 = sh.rows - 1; ui.c2 = sh.cols - 1; sheetPaint(paper, file); event.preventDefault(); }
    }, true);
    document.addEventListener('pointermove', event => {
      if (sheetColResize) { const { paper, file, c, startX, startW } = sheetColResize; const w = Math.max(40, Math.round(startW + event.clientX - startX)); $$(`table.sheet col`, paper)[c + 1]?.style.setProperty('width', w + 'px'); sheetColResize.w = w; return; }
      if (!sheetDragSel) return; const td = event.target.closest?.('td[data-cell]'); if (!td || !sheetDragSel.paper.contains(td)) return;
      const [r, c] = td.dataset.cell.split(',').map(Number); const ui = shUI(sheetDragSel.file); if (r !== ui.r2 || c !== ui.c2) { ui.r2 = r; ui.c2 = c; sheetPaint(sheetDragSel.paper, sheetDragSel.file); }
    }, true);
    document.addEventListener('pointerup', () => {
      if (sheetColResize) { const { paper, file, c, w } = sheetColResize; sheetColResize = null; if (w) sheetMutate(paper, file, s => { s.widths[c] = w; }, { noHistory: true }); }
      sheetDragSel = null;
    }, true);
    document.addEventListener('dblclick', event => {
      const t = event.target.closest?.('[data-sheet-title]');
      if (t) { event.preventDefault(); t.contentEditable = 'true'; t.focus(); const r = document.createRange(); r.selectNodeContents(t); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
    });
    document.addEventListener('keydown', event => {
      const t = event.target.closest?.('[data-sheet-title][contenteditable="true"]'); if (!t) return;
      if (event.key === 'Enter') { event.preventDefault(); t.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); const file = findFile(t.closest('[data-paper]')?.dataset.pageFile); if (file) t.textContent = file.title; t.blur(); }
    });
    document.addEventListener('focusout', event => {
      const t = event.target.closest?.('[data-sheet-title][contenteditable="true"]'); if (!t) return;
      t.contentEditable = 'false';
      const paper = t.closest('[data-paper]'), file = findFile(paper?.dataset.pageFile); if (!file) return;
      const name = t.innerText.replace(/\s+/g, ' ').trim() || '未命名表格'; t.textContent = name;
      if (name !== file.title) { file.title = name; file.updatedAt = Date.now(); $$(`[data-writing-file="${file.id}"] .writing-folder-name`).forEach(n => { n.textContent = name; }); markSaving(); }
    });
    document.addEventListener('dblclick', event => {
      const td = event.target.closest?.('td[data-cell]'); const paper = td?.closest('.paper.sheet-doc'); if (!paper) { const tab = event.target.closest?.('[data-sheet-tab]'); if (tab) { const p2 = tab.closest('[data-paper]'), f2 = findFile(p2.dataset.pageFile); sheetPick(p2, f2, 'rename'); } return; }
      const file = findFile(paper.dataset.pageFile); const ui = shUI(file); if (ui.editing === td) return;
      const [r, c] = td.dataset.cell.split(',').map(Number); sheetSelect(paper, file, r, c); sheetStartEdit(paper, file);
    });
    document.addEventListener('click', event => {
      const t = event.target;
      const cmd = t.closest('[data-sheet-cmd]');
      if (cmd) { event.preventDefault(); event.stopImmediatePropagation(); const paper = cmd.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file) return; $('#sheet-pop')?.setAttribute('data-for-file', file.id); const pop = $('#sheet-pop'); if (pop) pop.dataset.forFile = file.id; sheetCommand(paper, file, cmd.dataset.sheetCmd, cmd); return; }
      const pick = t.closest('[data-sheet-pick]');
      if (pick) { event.preventDefault(); event.stopImmediatePropagation(); const pop = $('#sheet-pop'); pop.classList.add('hidden'); const paper = $(`[data-paper][data-page-file="${pop.dataset.forFile}"]`), file = findFile(pop.dataset.forFile); if (paper && file) sheetPick(paper, file, pick.dataset.sheetPick); return; }
      const lp = t.closest('[data-sheet-listpick]');
      if (lp) { event.preventDefault(); event.stopImmediatePropagation(); const pop = $('#sheet-list-pop'); pop.classList.add('hidden'); const paper = $(`[data-paper][data-page-file="${pop.dataset.forFile}"]`), file = findFile(pop.dataset.forFile); if (!file) return; const ui = shUI(file); sheetMutate(paper, file, s => { const k = `${ui.r},${ui.c}`; s.cells[k] = s.cells[k] || {}; s.cells[k].v = lp.dataset.sheetListpick; }); return; }
      const tab = t.closest('[data-sheet-tab]');
      if (tab) { event.preventDefault(); event.stopImmediatePropagation(); const paper = tab.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file) return; if (shUI(file).editing) sheetCommitEdit(paper, file); file.activeSheet = +tab.dataset.sheetTab; const ui = shUI(file); ui.r = ui.c = ui.r1 = ui.c1 = ui.r2 = ui.c2 = 0; sheetRefresh(paper, file); persistWorkspace(); return; }
      const add = t.closest('[data-sheet-add]');
      if (add) { event.preventDefault(); event.stopImmediatePropagation(); const paper = add.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file) return; sheetMutate(paper, file, () => { file.sheets.push(sheetNewSheet(`Sheet${file.sheets.length + 1}`)); file.activeSheet = file.sheets.length - 1; }); return; }
      // 对话框确认按钮
      const flow = t.closest('[data-flow^="sheet-"]');
      if (flow) {
        event.preventDefault(); event.stopImmediatePropagation();
        const a = flow.dataset.flow; const input = $('#sh-filter-text, #sh-cond-op, #sh-list-opts, #sh-find-text, #sh-note-text, #sh-rename'); const fileId = input?.dataset.forFile; const paper = $(`[data-paper][data-page-file="${fileId}"]`), file = findFile(fileId); if (!file || !paper) return closeFlowDialog();
        const ui = shUI(file), rg = shRange(ui), sh = sheetBook(file);
        if (a === 'sheet-apply-filter') { const text = $('#sh-filter-text').value.trim(); closeFlowDialog(); if (!text) return; sheetMutate(paper, file, s => { s.filter = { col: ui.c, text }; }, { noHistory: true }); return; }
        if (a === 'sheet-apply-rule') { const op = $('#sh-cond-op').value, val = $('#sh-cond-val').value.trim(), bg = $('#sh-cond-bg').value; closeFlowDialog(); if (!val) return showToast('请填写条件的数值或文字'); sheetMutate(paper, file, s => { s.rules.push({ ...rg, op, val, bg }); }); return; }
        if (a === 'sheet-clear-rules') { closeFlowDialog(); sheetMutate(paper, file, s => { s.rules = []; }); return; }
        if (a === 'sheet-apply-list' || a === 'sheet-clear-list') { const opts = a === 'sheet-clear-list' ? [] : $('#sh-list-opts').value.split(/\n/).map(x => x.trim()).filter(Boolean); closeFlowDialog(); sheetMutate(paper, file, s => { shCells(s, rg, true).forEach(([key, cell]) => { if (opts.length) cell.list = opts; else delete cell.list; shCleanCell(s, key); }); }); return; }
        if (a === 'sheet-find-next' || a === 'sheet-replace-all') {
          const q = $('#sh-find-text').value, rep = $('#sh-replace-text').value, out = $('#sh-find-result'); if (!q) { out.textContent = '请输入要查找的内容'; return; }
          const hits = Object.entries(sh.cells).filter(([k, cell]) => (cell.v || '').includes(q)).map(([k]) => k.split(',').map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
          if (a === 'sheet-replace-all') { if (!hits.length) { out.textContent = '没有找到匹配内容'; return; } sheetMutate(paper, file, s => { hits.forEach(([r, c]) => { const cell = s.cells[`${r},${c}`]; cell.v = cell.v.split(q).join(rep); }); }); out.textContent = `已替换 ${hits.length} 处`; return; }
          if (!hits.length) { out.textContent = '没有找到匹配内容'; return; }
          const cur = hits.findIndex(([r, c]) => r > ui.r || (r === ui.r && c > ui.c)); const [r, c] = hits[cur < 0 ? 0 : cur]; sheetSelect(paper, file, r, c); out.textContent = `共 ${hits.length} 处匹配，当前 ${cellRef(r, c)}`; return;
        }
        if (a === 'sheet-save-note' || a === 'sheet-del-note') { const text = a === 'sheet-del-note' ? '' : $('#sh-note-text').value.trim(); closeFlowDialog(); sheetMutate(paper, file, s => { const k = `${ui.r},${ui.c}`; s.cells[k] = s.cells[k] || {}; if (text) s.cells[k].note = text; else delete s.cells[k].note; shCleanCell(s, k); }); return; }
        if (a === 'sheet-rename-ok') { const name = $('#sh-rename').value.trim(); closeFlowDialog(); if (!name) return; sheetMutate(paper, file, s => { s.name = name; }); return; }
        return;
      }
      if (!t.closest('#sheet-pop')) $('#sheet-pop')?.classList.add('hidden');
      if (!t.closest('#sheet-list-pop')) $('#sheet-list-pop')?.classList.add('hidden');
    }, true);
    document.addEventListener('change', event => {
      const sel = event.target; const paper = sel.closest?.('.paper.sheet-doc'); if (!paper) return; const file = findFile(paper.dataset.pageFile); if (!file) return;
      const ui = shUI(file), rg = shRange(ui);
      const styleSel = fn => sheetMutate(paper, file, s => { shCells(s, rg, true).forEach(([key, cell]) => { fn(cell); shCleanCell(s, key); }); });
      if (sel.matches('[data-sheet-font]')) return styleSel(cell => { cell.font = sel.value || undefined; });
      if (sel.matches('[data-sheet-size]')) return styleSel(cell => { cell.size = +sel.value === 10 ? undefined : +sel.value; });
      if (sel.matches('[data-sheet-fmt]')) return styleSel(cell => { cell.fmt = sel.value === 'general' ? undefined : sel.value; });
      if (sel.matches('[data-sheet-fbar]')) { const raw = sel.value; if (ui.editing) { ui.editing.textContent = raw; sheetCommitEdit(paper, file); return; } sheetMutate(paper, file, s => { const k = `${ui.r},${ui.c}`; s.cells[k] = s.cells[k] || {}; s.cells[k].v = raw; shCleanCell(s, k); }); }
    });
    document.addEventListener('input', event => {
      const el = event.target;
      if (el.matches?.('td[data-cell].editing')) { const paper = el.closest('[data-paper]'); const fb = $('[data-sheet-fbar]', paper); if (fb) fb.value = el.innerText; return; }
      if (el.matches?.('[data-sheet-fbar]')) { const paper = el.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); const ui = shUI(file); const td = sheetTd(paper, ui.r, ui.c); if (td) { if (!ui.editing) { td.contentEditable = 'true'; td.classList.add('editing'); ui.editing = td; } td.textContent = el.value; } }
    });
    document.addEventListener('keydown', event => {
      const paper = event.target.closest?.('.paper.sheet-doc'); if (!paper) return;
      const file = findFile(paper.dataset.pageFile); if (!file) return; const ui = shUI(file), sh = sheetBook(file), k = event.key, meta = event.metaKey || event.ctrlKey;
      if (event.target.closest('[data-sheet-fbar]')) { if (k === 'Enter') { event.preventDefault(); event.target.blur(); event.target.dispatchEvent(new Event('change', { bubbles: true })); sheetSelect(paper, file, ui.r + 1, ui.c); $('[data-sheet-wrap]', paper)?.focus({ preventScroll: true }); } if (k === 'Escape') { event.preventDefault(); if (ui.editing) sheetCommitEdit(paper, file, true); event.target.value = sheetRaw(sh, ui.r, ui.c); } return; }
      if (event.target.closest('[data-cdoc-title], .sh-select, input, textarea')) return;
      if (ui.editing) {
        if (k === 'Enter' && !event.altKey) { event.preventDefault(); sheetCommitEdit(paper, file); sheetSelect(paper, file, ui.r + 1, ui.c); $('[data-sheet-wrap]', paper)?.focus({ preventScroll: true }); }
        else if (k === 'Tab') { event.preventDefault(); sheetCommitEdit(paper, file); sheetSelect(paper, file, ui.r, ui.c + 1); $('[data-sheet-wrap]', paper)?.focus({ preventScroll: true }); }
        else if (k === 'Escape') { event.preventDefault(); sheetCommitEdit(paper, file, true); $('[data-sheet-wrap]', paper)?.focus({ preventScroll: true }); }
        return;
      }
      if (!event.target.closest('[data-sheet-wrap]')) return;
      const move = (dr, dc) => { event.preventDefault(); if (event.shiftKey) { ui.r2 = Math.max(0, Math.min(sh.rows - 1, ui.r2 + dr)); ui.c2 = Math.max(0, Math.min(sh.cols - 1, ui.c2 + dc)); sheetPaint(paper, file); } else sheetSelect(paper, file, ui.r + dr, ui.c + dc); };
      if (k === 'ArrowUp') return move(-1, 0); if (k === 'ArrowDown') return move(1, 0); if (k === 'ArrowLeft') return move(0, -1); if (k === 'ArrowRight') return move(0, 1);
      if (k === 'Tab') { event.preventDefault(); return sheetSelect(paper, file, ui.r, ui.c + (event.shiftKey ? -1 : 1)); }
      if (k === 'Enter' || k === 'F2') { event.preventDefault(); return sheetStartEdit(paper, file); }
      if (k === 'Delete' || k === 'Backspace') { event.preventDefault(); const rg = shRange(ui); return sheetMutate(paper, file, s => { shCells(s, rg).forEach(([key, cell]) => { delete cell.v; shCleanCell(s, key); }); }); }
      if (meta && (k === 'z' || k === 'Z')) { event.preventDefault(); return sheetUndo(paper, file, event.shiftKey); }
      if (meta && (k === 'y' || k === 'Y')) { event.preventDefault(); return sheetUndo(paper, file, true); }
      if (meta && k === 'b') { event.preventDefault(); return sheetCommand(paper, file, 'bold'); }
      if (meta && k === 'i') { event.preventDefault(); return sheetCommand(paper, file, 'italic'); }
      if (meta && k === 'u') { event.preventDefault(); return sheetCommand(paper, file, 'underline'); }
      if (meta && k === 'a') { event.preventDefault(); ui.r1 = ui.c1 = 0; ui.r2 = sh.rows - 1; ui.c2 = sh.cols - 1; return sheetPaint(paper, file); }
      if (meta) return;
      if (k.length === 1 && !event.altKey) { event.preventDefault(); return sheetStartEdit(paper, file, k); }
    }, true);
    document.addEventListener('copy', event => {
      const wrap = event.target.closest?.('[data-sheet-wrap]'); if (!wrap) return; const paper = wrap.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); const ui = shUI(file); if (ui.editing) return;
      const sh = sheetBook(file), rg = shRange(ui); const lines = []; for (let r = rg.r1; r <= rg.r2; r++) { const row = []; for (let c = rg.c1; c <= rg.c2; c++) row.push(sheetDisplay(sh, sh.cells[`${r},${c}`])); lines.push(row.join('\t')); }
      event.clipboardData.setData('text/plain', lines.join('\n')); event.preventDefault();
    });
    document.addEventListener('paste', event => {
      const wrap = event.target.closest?.('[data-sheet-wrap]'); if (!wrap) return; const paper = wrap.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); const ui = shUI(file); if (ui.editing) return;
      const text = event.clipboardData?.getData('text/plain'); if (!text) return; event.preventDefault();
      const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
      sheetMutate(paper, file, s => { rows.forEach((cols, i) => cols.forEach((v, j) => { const r = ui.r + i, c = ui.c + j; if (r >= s.rows) s.rows = r + 1; if (c >= s.cols) s.cols = c + 1; const key = `${r},${c}`; s.cells[key] = s.cells[key] || {}; s.cells[key].v = v; shCleanCell(s, key); })); ui.r1 = ui.r; ui.c1 = ui.c; ui.r2 = ui.r + rows.length - 1; ui.c2 = ui.c + Math.max(...rows.map(x => x.length)) - 1; });
    });
    document.addEventListener('focusout', event => {
      const td = event.target.closest?.('td[data-cell].editing'); if (!td) return;
      const paper = td.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file) return;
      setTimeout(() => { const ui = shUI(file); if (ui.editing === td && document.activeElement !== td && !document.activeElement?.closest?.('[data-sheet-fbar]')) sheetCommitEdit(paper, file); }, 0);
    });

    /* ---------- 画布 ---------- */
    const CV_NOTE_COLORS = [['#fff6bf', '黄'], ['#ffe1d6', '橙'], ['#dcefe0', '绿'], ['#dbe8f8', '蓝'], ['#eee2f7', '紫'], ['#ffffff', '白']];
    const CV_PEN_COLORS = ['#191917', '#b34d46', '#2f6db3', '#191917', '#c9762b'];
    let cvTool = 'select', cvNoteColor = '#fff6bf', cvPenColor = '#191917', cvDrag = null;
    const strokePath = pts => pts.length ? 'M' + pts.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' L') : '';
    function cvNoteHtml(n) { return `<div class="cv-note" data-cv-note="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;background:${n.color}"><div class="cv-note-grip" data-cv-grip="${n.id}" title="拖动移动"><button type="button" class="cv-note-del" data-cv-del="${n.id}" title="删除便签">${CI.close}</button></div><div class="cv-note-text" contenteditable="true" data-cv-text="${n.id}" spellcheck="false">${escapeHtml(n.text || '')}</div><span class="cv-note-resize" data-cv-resize="${n.id}" title="拖动调整大小"></span></div>`; }
    function renderCanvasPage(file) {
      file.canvas = file.canvas || { notes: [], strokes: [], w: 1600, h: 1100 }; const cv = file.canvas;
      const tb = (id, label, inner) => `<button type="button" class="cdoc-tool ${cvTool === id ? 'active' : ''}" data-cv-tool="${id}" title="${label}" aria-label="${label}">${inner}</button>`;
      const toolbar = `<div class="cdoc-toolbar">${tb('select', '选择 / 移动', BK.cursor)}${tb('note', '便签：点击画布添加', BK.note)}${tb('pen', '画笔', BK.pen)}${tb('eraser', '橡皮：点击笔画删除', BK.eraser)}<span class="cdoc-sep"></span><span class="cv-swatches">${CV_NOTE_COLORS.map(([c, n]) => `<button type="button" class="cv-swatch ${cvNoteColor === c ? 'active' : ''}" style="background:${c}" data-cv-note-color="${c}" title="便签颜色：${n}"></button>`).join('')}</span><span class="cdoc-sep"></span><span class="cv-swatches">${CV_PEN_COLORS.map(c => `<button type="button" class="cv-swatch ${cvPenColor === c ? 'active' : ''}" style="background:${c}" data-cv-pen-color="${c}" title="画笔颜色"></button>`).join('')}</span><span class="cdoc-sep"></span><button type="button" class="cdoc-tool" data-cv-cmd="clear-strokes" title="清除全部笔画" aria-label="清除全部笔画">${CI.clear}</button><span class="cdoc-hint">双击空白处添加便签 · 拖便签顶部移动</span></div>`;
      const body = `<div class="cv-viewport" data-cv-viewport><div class="cv-world tool-${cvTool}" data-cv-world style="width:${cv.w}px;height:${cv.h}px"><svg class="cv-strokes" width="${cv.w}" height="${cv.h}">${cv.strokes.map(s => `<path d="${strokePath(s.points)}" stroke="${s.color}" stroke-width="${s.width || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" data-cv-stroke="${s.id}"/>`).join('')}</svg>${cv.notes.map(cvNoteHtml).join('')}</div></div>`;
      return blankPaper(file, toolbar, body, 'canvas-doc');
    }
    function cvInfo(paper, file) { blankInfo(paper, `${file.canvas.notes.length} 张便签 · ${file.canvas.strokes.length} 条笔画`); }
    function cvAddNote(paper, file, x, y, focus = true) {
      const cv = file.canvas, n = { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), x: Math.max(0, Math.min(x - 80, cv.w - 170)), y: Math.max(0, Math.min(y - 20, cv.h - 130)), w: 170, h: 120, text: '', color: cvNoteColor };
      cv.notes.push(n); $('[data-cv-world]', paper).insertAdjacentHTML('beforeend', cvNoteHtml(n));
      cvInfo(paper, file); blankSaved(paper, file);
      if (focus) setTimeout(() => $(`[data-cv-text="${n.id}"]`, paper)?.focus(), 20);
    }
    document.addEventListener('pointerdown', event => {
      const world = event.target.closest('[data-cv-world]'); if (!world || event.button !== 0) return;
      const paper = world.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file?.canvas) return;
      const cv = file.canvas, wr = world.getBoundingClientRect(), px = event.clientX - wr.left, py = event.clientY - wr.top;
      if (event.target.closest('[data-cv-del]')) return;
      const resize = event.target.closest('[data-cv-resize]'), grip = event.target.closest('[data-cv-grip]');
      if (resize) { const n = cv.notes.find(n => n.id === resize.dataset.cvResize); cvDrag = { kind: 'resize', n, el: resize.closest('.cv-note'), world, sx: px, sy: py, w: n.w, h: n.h, file, paper }; event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (grip) { const n = cv.notes.find(n => n.id === grip.dataset.cvGrip), el = grip.closest('.cv-note'); cv.notes.splice(cv.notes.indexOf(n), 1); cv.notes.push(n); world.appendChild(el); cvDrag = { kind: 'move', n, el, world, dx: px - n.x, dy: py - n.y, file, paper }; event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (event.target.closest('.cv-note')) return;
      if (cvTool === 'pen') {
        const s = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), points: [[px, py]], color: cvPenColor, width: 3 };
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', s.color); path.setAttribute('stroke-width', s.width); path.setAttribute('fill', 'none'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.dataset.cvStroke = s.id;
        world.querySelector('svg').appendChild(path);
        cvDrag = { kind: 'pen', s, path, world, file, paper }; event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (cvTool === 'eraser') { const p = event.target.closest('[data-cv-stroke]'); if (p) { cv.strokes = cv.strokes.filter(s => s.id !== p.dataset.cvStroke); p.remove(); cvInfo(paper, file); blankSaved(paper, file); } event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (cvTool === 'note') { cvAddNote(paper, file, px, py); event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('pointermove', event => {
      if (!cvDrag) return;
      const wr = cvDrag.world.getBoundingClientRect(), px = event.clientX - wr.left, py = event.clientY - wr.top, cv = cvDrag.file.canvas;
      if (cvDrag.kind === 'move') { const n = cvDrag.n; n.x = Math.round(Math.max(0, Math.min(px - cvDrag.dx, cv.w - n.w))); n.y = Math.round(Math.max(0, Math.min(py - cvDrag.dy, cv.h - n.h))); cvDrag.el.style.left = n.x + 'px'; cvDrag.el.style.top = n.y + 'px'; }
      else if (cvDrag.kind === 'resize') { const n = cvDrag.n; n.w = Math.round(Math.max(120, Math.min(cvDrag.w + (px - cvDrag.sx), cv.w - n.x))); n.h = Math.round(Math.max(80, Math.min(cvDrag.h + (py - cvDrag.sy), cv.h - n.y))); cvDrag.el.style.width = n.w + 'px'; cvDrag.el.style.height = n.h + 'px'; }
      else if (cvDrag.kind === 'pen') { const last = cvDrag.s.points[cvDrag.s.points.length - 1]; if (Math.hypot(px - last[0], py - last[1]) < 2) return; cvDrag.s.points.push([px, py]); cvDrag.path.setAttribute('d', strokePath(cvDrag.s.points)); }
      event.preventDefault();
    }, true);
    document.addEventListener('pointerup', () => {
      if (!cvDrag) return;
      const { file, paper } = cvDrag;
      if (cvDrag.kind === 'pen') { if (cvDrag.s.points.length > 1) file.canvas.strokes.push(cvDrag.s); else cvDrag.path.remove(); }
      cvDrag = null; cvInfo(paper, file); blankSaved(paper, file);
    }, true);
    document.addEventListener('dblclick', event => {
      const world = event.target.closest('[data-cv-world]'); if (!world || event.target.closest('.cv-note') || cvTool !== 'select') return;
      const paper = world.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file?.canvas) return;
      const wr = world.getBoundingClientRect(); cvAddNote(paper, file, event.clientX - wr.left, event.clientY - wr.top);
    });
    document.addEventListener('input', event => {
      const t = event.target.closest?.('[data-cv-text]'); if (!t) return;
      const paper = t.closest('[data-paper]'), file = findFile(paper.dataset.pageFile), n = file?.canvas?.notes.find(n => n.id === t.dataset.cvText); if (!n) return;
      n.text = t.innerText.replace(/\n+$/, '');
      clearTimeout(cdocSaveTimer); cdocSaveTimer = setTimeout(() => blankSaved(paper, file), 400);
    });
    document.addEventListener('click', event => {
      const t = event.target;
      const tool = t.closest('[data-cv-tool]'), noteColor = t.closest('[data-cv-note-color]'), penColor = t.closest('[data-cv-pen-color]'), cmd = t.closest('[data-cv-cmd]'), del = t.closest('[data-cv-del]'), jump = t.closest('[data-cv-jump]');
      if (!tool && !noteColor && !penColor && !cmd && !del && !jump) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (jump) {
        const note = $(`[data-cv-note="${jump.dataset.cvJump}"]`); if (!note) return showToast('便签不在当前稿纸上');
        note.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); note.classList.add('cv-flash'); setTimeout(() => note.classList.remove('cv-flash'), 1200); return;
      }
      const paper = (tool || noteColor || penColor || cmd || del).closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file?.canvas) return;
      if (tool) { cvTool = tool.dataset.cvTool; $$('[data-cv-tool]', paper).forEach(b => b.classList.toggle('active', b === tool)); const w = $('[data-cv-world]', paper); w.className = `cv-world tool-${cvTool}`; return; }
      if (noteColor) { cvNoteColor = noteColor.dataset.cvNoteColor; $$('[data-cv-note-color]', paper).forEach(b => b.classList.toggle('active', b === noteColor)); const sel = document.activeElement?.closest?.('.cv-note'); if (sel) { const n = file.canvas.notes.find(n => n.id === sel.dataset.cvNote); if (n) { n.color = cvNoteColor; sel.style.background = cvNoteColor; blankSaved(paper, file); } } return; }
      if (penColor) { cvPenColor = penColor.dataset.cvPenColor; $$('[data-cv-pen-color]', paper).forEach(b => b.classList.toggle('active', b === penColor)); return; }
      if (del) { file.canvas.notes = file.canvas.notes.filter(n => n.id !== del.dataset.cvDel); del.closest('.cv-note')?.remove(); cvInfo(paper, file); blankSaved(paper, file); return; }
      if (cmd?.dataset.cvCmd === 'clear-strokes') { if (!file.canvas.strokes.length) return; file.canvas.strokes = []; $$('[data-cv-stroke]', paper).forEach(p => p.remove()); cvInfo(paper, file); blankSaved(paper, file); showToast('已清除全部笔画'); }
    }, true);

    /* ---------- 思维导图 ---------- */
    const MM_H = 34, MM_VGAP = 10, MM_HGAP = 48;
    function mmNew(text) { return { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, children: [], collapsed: false }; }
    function mmFind(node, id, parent = null) { if (node.id === id) return { node, parent }; for (const c of node.children) { const r = mmFind(c, id, node); if (r) return r; } return null; }
    function mmWidth(n) { const len = [...(n.text || '')].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 1 : .58), 0); return Math.min(280, Math.max(72, Math.round(len * 14) + 30)); }
    function mmMeasure(n) { if (n.collapsed || !n.children.length) return MM_H; return Math.max(MM_H, n.children.reduce((a, c) => a + mmMeasure(c), 0) + MM_VGAP * (n.children.length - 1)); }
    function mmLayout(n, x, top, depth, out) { const h = mmMeasure(n), w = mmWidth(n); out.push({ n, x, y: top + (h - MM_H) / 2, w, depth }); if (n.collapsed) return; let cur = top; n.children.forEach(c => { mmLayout(c, x + w + MM_HGAP, cur, depth + 1, out); cur += mmMeasure(c) + MM_VGAP; }); }
    function mmMap(file) {
      const mm = file.mindmap, out = []; mmLayout(mm.root, 40, 40, 0, out);
      const W = Math.max(...out.map(o => o.x + o.w)) + 80, H = Math.max(...out.map(o => o.y)) + MM_H + 80, pos = new Map(out.map(o => [o.n.id, o])), edges = [];
      out.forEach(o => { if (o.n.collapsed) return; o.n.children.forEach(c => { const p = pos.get(c.id); if (!p) return; const x1 = o.x + o.w, y1 = o.y + MM_H / 2, x2 = p.x, y2 = p.y + MM_H / 2, mx = (x1 + x2) / 2; edges.push(`<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`); }); });
      return `<div class="mm-world" style="width:${W}px;height:${H}px"><svg class="mm-edges" width="${W}" height="${H}">${edges.join('')}</svg>${out.map(o => `<div class="mm-node depth-${Math.min(o.depth, 3)} ${mm.selected === o.n.id ? 'selected' : ''}" data-mm-node="${o.n.id}" style="left:${o.x}px;top:${o.y}px;width:${o.w}px"><span class="mm-text" data-mm-text="${o.n.id}">${escapeHtml(o.n.text || '')}</span>${o.n.children.length ? `<button type="button" class="mm-toggle" data-mm-toggle="${o.n.id}" title="${o.n.collapsed ? '展开' : '折叠'}">${o.n.collapsed ? o.n.children.length : '−'}</button>` : ''}</div>`).join('')}</div>`;
    }
    function mmCount(n) { return 1 + n.children.reduce((a, c) => a + mmCount(c), 0); }
    function renderMindmapPage(file) {
      file.mindmap = file.mindmap || { root: { id: 'root', text: '中心主题', children: [], collapsed: false }, selected: 'root' };
      const b = (cmd, label, inner) => `<button type="button" class="cdoc-tool" data-mm-cmd="${cmd}" title="${label}" aria-label="${label}">${inner}</button>`;
      const toolbar = `<div class="cdoc-toolbar">${b('child', '添加子节点 (Tab)', BK.child)}${b('sibling', '添加同级节点 (Enter)', BK.sibling)}${b('edit', '编辑节点 (双击)', BK.edit)}${b('delete', '删除节点 (Delete)', BK.trash)}<span class="cdoc-sep"></span>${b('expand', '全部展开', BK.expand)}${b('collapse', '全部折叠', BK.collapse)}<span class="cdoc-hint">Tab 子节点 · Enter 同级 · 双击改名 · 方向键移动</span></div>`;
      return blankPaper(file, toolbar, `<div class="mm-viewport" data-mm-viewport tabindex="0" aria-label="思维导图">${mmMap(file)}</div>`, 'mindmap-doc');
    }
    function mmRefresh(paper, file) { const vp = $('[data-mm-viewport]', paper); if (vp) vp.innerHTML = mmMap(file); blankInfo(paper, `${mmCount(file.mindmap.root)} 个节点`); }
    function mmSelect(paper, file, id) { file.mindmap.selected = id; $$('.mm-node', paper).forEach(n => n.classList.toggle('selected', n.dataset.mmNode === id)); $(`[data-mm-node="${id}"]`, paper)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); try { fillContextSections(); } catch (_) {} }
    function mmEdit(paper, file, id) {
      const span = $(`[data-mm-text="${id}"]`, paper); if (!span) return;
      span.contentEditable = 'true'; span.focus();
      const r = document.createRange(); r.selectNodeContents(span); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const done = () => { span.removeEventListener('blur', done); const f = mmFind(file.mindmap.root, id); if (f) f.node.text = span.innerText.replace(/\s+/g, ' ').trim() || '未命名'; mmRefresh(paper, file); blankSaved(paper, file); $('[data-mm-viewport]', paper)?.focus({ preventScroll: true }); };
      span.addEventListener('blur', done);
    }
    function mmAdd(paper, file, asChild) {
      const mm = file.mindmap, f = mmFind(mm.root, mm.selected) || { node: mm.root, parent: null };
      const node = mmNew('新节点');
      if (asChild || !f.parent) { f.node.children.push(node); f.node.collapsed = false; } else { const i = f.parent.children.indexOf(f.node); f.parent.children.splice(i + 1, 0, node); }
      mm.selected = node.id; mmRefresh(paper, file); blankSaved(paper, file); mmEdit(paper, file, node.id);
    }
    function mmDelete(paper, file) {
      const mm = file.mindmap, f = mmFind(mm.root, mm.selected); if (!f || !f.parent) return showToast('中心主题不能删除');
      const i = f.parent.children.indexOf(f.node); f.parent.children.splice(i, 1);
      mm.selected = f.parent.children[Math.min(i, f.parent.children.length - 1)]?.id || f.parent.id;
      mmRefresh(paper, file); blankSaved(paper, file);
    }
    document.addEventListener('click', event => {
      const t = event.target;
      const cmd = t.closest('[data-mm-cmd]'), toggle = t.closest('[data-mm-toggle]'), node = t.closest('[data-mm-node]'), jump = t.closest('[data-mm-jump]');
      if (!cmd && !toggle && !node && !jump) return;
      if (t.closest('[data-mm-text][contenteditable="true"]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (jump) { const el = $(`[data-mm-node="${jump.dataset.mmJump}"]`); if (!el) return showToast('节点已折叠或不在当前稿纸上'); const paper = el.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); mmSelect(paper, file, jump.dataset.mmJump); el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); return; }
      const paper = (cmd || toggle || node).closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file?.mindmap) return;
      if (toggle) { const f = mmFind(file.mindmap.root, toggle.dataset.mmToggle); if (f) { f.node.collapsed = !f.node.collapsed; mmRefresh(paper, file); blankSaved(paper, file); } return; }
      if (node) { mmSelect(paper, file, node.dataset.mmNode); $('[data-mm-viewport]', paper)?.focus({ preventScroll: true }); return; }
      const c = cmd.dataset.mmCmd;
      if (c === 'child') return mmAdd(paper, file, true);
      if (c === 'sibling') return mmAdd(paper, file, false);
      if (c === 'edit') return mmEdit(paper, file, file.mindmap.selected);
      if (c === 'delete') return mmDelete(paper, file);
      if (c === 'expand' || c === 'collapse') { (function walk(n) { if (n.children.length && n !== file.mindmap.root) n.collapsed = c === 'collapse'; n.children.forEach(walk); })(file.mindmap.root); mmRefresh(paper, file); blankSaved(paper, file); }
    }, true);
    document.addEventListener('dblclick', event => {
      const node = event.target.closest('[data-mm-node]'); if (!node || event.target.closest('[contenteditable="true"]')) return;
      const paper = node.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file?.mindmap) return;
      mmSelect(paper, file, node.dataset.mmNode); mmEdit(paper, file, node.dataset.mmNode);
    });
    document.addEventListener('keydown', event => {
      const editing = event.target.closest?.('[data-mm-text][contenteditable="true"]');
      if (editing) { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); editing.blur(); } return; }
      const vp = event.target.closest?.('[data-mm-viewport]'); if (!vp) return;
      const paper = vp.closest('[data-paper]'), file = findFile(paper.dataset.pageFile); if (!file?.mindmap) return;
      const mm = file.mindmap, f = mmFind(mm.root, mm.selected) || { node: mm.root, parent: null };
      const k = event.key;
      if (k === 'Tab') { event.preventDefault(); return mmAdd(paper, file, true); }
      if (k === 'Enter') { event.preventDefault(); return mmAdd(paper, file, false); }
      if (k === 'F2' || k === ' ') { event.preventDefault(); return mmEdit(paper, file, mm.selected); }
      if (k === 'Delete' || k === 'Backspace') { event.preventDefault(); return mmDelete(paper, file); }
      if (k === 'ArrowLeft' && f.parent) { event.preventDefault(); return mmSelect(paper, file, f.parent.id); }
      if (k === 'ArrowRight' && f.node.children.length) { event.preventDefault(); if (f.node.collapsed) { f.node.collapsed = false; mmRefresh(paper, file); } return mmSelect(paper, file, f.node.children[0].id); }
      if ((k === 'ArrowUp' || k === 'ArrowDown') && f.parent) { event.preventDefault(); const sib = f.parent.children, i = sib.indexOf(f.node), next = sib[i + (k === 'ArrowDown' ? 1 : -1)]; if (next) mmSelect(paper, file, next.id); }
    });

    // 渲染后：填信息行
    const renderBeforeBlankKinds = render;
    render = () => {
      renderBeforeBlankKinds();
      $$('.paper.sheet-doc').forEach(paper => { const f = findFile(paper.dataset.pageFile); if (f) { const ui = shUI(f); $(`td[data-cell="${ui.r},${ui.c}"]`, paper)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } });
      $$('.paper.canvas-doc').forEach(paper => { const f = findFile(paper.dataset.pageFile); if (f?.canvas) cvInfo(paper, f); });
      $$('.paper.mindmap-doc').forEach(paper => { const f = findFile(paper.dataset.pageFile); if (f?.mindmap) blankInfo(paper, `${mmCount(f.mindmap.root)} 个节点`); });
      $$('.paper.cloud-doc [data-cdoc-title]').forEach(t => t.classList.toggle('is-empty', !t.innerText.trim()));
    };
    // 首屏若已打开表格 / 画布 / 思维导图，用对应渲染器重画一次（首屏渲染早于本段代码）
    if ($$('[data-paper][data-page-type="custom"]').some(p => (findFile(p.dataset.pageFile)?.kind || 'doc') !== 'doc')) render();

    /* ===== 云文档交互（参考在线文档）：“/”菜单、块手柄菜单、选区浮动工具条、模板、块拖拽 ===== */
