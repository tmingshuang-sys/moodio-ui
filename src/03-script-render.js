    const SCRIPT_PLACEHOLDER = { scene: 'INT./EXT. 地点 - 时间', action: '双击可召唤格式框', character: '人物', dialogue: '对白', paren: '（括号提示）', transition: 'CUT TO:', subtitle: '字幕' };
    const SCRIPT_TYPES = [['scene', '场景标题', '场'], ['action', '动作', '动'], ['character', '人物', '人'], ['dialogue', '对白', '白'], ['paren', '括号提示', '括'], ['transition', '转场', '转']];
    function scriptBlocksOf(file) {
      if (!file) return [];
      if (!Array.isArray(file.scriptBlocks)) {
        const prev = state.renderContext;
        state.renderContext = { docId: 'script', normalized: 'script', slot: 'left', fileId: file.id };
        const holder = document.createElement('div');
        try { holder.innerHTML = renderScriptTemplate({ fileId: file.id }); } catch (_) {}
        state.renderContext = prev;
        const et = file.editableText || {};
        const blocks = $$('[data-script-id]', holder).map(el => ({ id: el.dataset.scriptId, type: el.dataset.formatType || 'action', text: (Object.prototype.hasOwnProperty.call(et, `script:${el.dataset.scriptId}`) ? et[`script:${el.dataset.scriptId}`] : el.textContent) || '' }));
        const allEmpty = blocks.length && blocks.every(b => !b.text.trim());
        file.scriptBlocks = allEmpty ? [{ id: 'b-' + Date.now().toString(36), type: 'action', text: '' }] : blocks;
        Object.keys(state.formatAssignments || {}).forEach(k => { if (k.startsWith(file.id + ':')) delete state.formatAssignments[k]; });
      }
      return file.scriptBlocks;
    }
    function scriptSceneNumber(blocks, index) { let n = 0; for (let i = 0; i <= index; i++) if (blocks[i].type === 'scene') n++; return String(Math.max(1, n)).padStart(2, '0'); }
    function scriptHasText(text) { return /[^\s\u200b-\u200d\ufeff]/.test(String(text || '')); }
    // 仅在当前剧本交互期间暂时隐藏；点击剧本外部后，空稿重新显示提示，不写入存储。
    function dismissedScriptGuides() { return dismissedScriptGuides.ids || (dismissedScriptGuides.ids = new Set()); }
    function positionScriptEmptyGuide(root) {
      const shell = root?.closest('.script-editor-shell'), guide = shell?.querySelector('[data-script-empty-guide]');
      if (!guide || guide.hidden) return;
      const firstLine = root.querySelector('.script-block') || root;
      const frame = shell.getBoundingClientRect(), line = firstLine.getBoundingClientRect();
      if (!frame.width || !line.width) return;
      const css = getComputedStyle(firstLine);
      guide.style.left = Math.max(0, line.left - frame.left + (parseFloat(css.paddingLeft) || 0)) + 'px';
      guide.style.top = Math.max(0, line.top - frame.top + (parseFloat(css.paddingTop) || 0)) + 'px';
    }
    function syncScriptEmptyGuide(root) {
      const guide = root?.closest('.script-editor-shell')?.querySelector('[data-script-empty-guide]');
      if (!guide) return;
      const fileId = root.closest('[data-page-file]')?.dataset.pageFile;
      const empty = !scriptHasText(root.textContent) && !dismissedScriptGuides().has(fileId);
      guide.hidden = !empty;
      guide.classList.toggle('hidden', !empty);
      if (empty) root.setAttribute('aria-describedby',guide.id);
      else root.removeAttribute('aria-describedby');
      if (empty) positionScriptEmptyGuide(root);
    }
    function renderScript(options = {}) {
      const file = findFile(state.renderContext?.fileId) || latestFile('script');
      const blocks = scriptBlocksOf(file);
      const empty = !blocks.some(block => scriptHasText(block.text)) && !dismissedScriptGuides().has(file?.id);
      const guideId = `script-empty-guide-${state.renderContext?.slot || options.slot || 'left'}-${file?.id || 'script'}`;
      let html = '', open = false, sceneIdx = 0;
      blocks.forEach(b => {
        if (b.type === 'scene') {
          if (open) { html += '</div>'; open = false; }
          html += `<div class="${sceneIdx ? 'scene-gap' : ''}">${renderScriptBlock(b.id, b.text, 'scene', { extraClass: 'scene-heading-text', domId: `scene-${sceneIdx + 1}` })}</div><div class="script-body">`;
          open = true; sceneIdx++;
        } else {
          if (!open) { html += '<div class="script-body">'; open = true; }
          html += renderScriptBlock(b.id, b.text, b.type);
        }
      });
      if (open) html += '</div>';
      return paperWrap(`
        <div class="script-meta">
          ${paperDocTabs('script')}
          <div class="script-meta-controls">
            <button class="link-toggle ${state.storyboardEnabled ? 'on' : ''}" data-toggle-storyboard data-source-file-id="${escapeHtml(file?.id||'')}" aria-haspopup="dialog">${icons.link} 识别分镜</button>
            ${renderRecognizeAssetsButton(file?.id)}
          </div>
        </div>
        <div class="script-editor-shell">
          <div class="script-blocks" data-script-blocks contenteditable="true" spellcheck="false" aria-label="剧本正文" ${empty ? `aria-describedby="${escapeHtml(guideId)}"` : ''}>${html}</div>
          <aside class="script-empty-guide${empty ? '' : ' hidden'}" data-script-empty-guide id="${escapeHtml(guideId)}" contenteditable="false" ${empty ? '' : 'hidden'}>
            <strong>从这里，开始你的故事</strong>
            <p>在这里直接输入正文。双击唤出格式框，选择场景、动作、人物或对白；也可以输入“/”快速选择格式。</p>
            <p>还没有思路？点击 Ask agent，让 Agent 帮你构思故事、塑造角色，或一起创作第一场戏。</p>
          </aside>
        </div>
      `, { page: state.mode === 'film' ? '7' : `${state.episode} · 7` });
    }
    function captureScriptBlocks(paper, file) {
      if (typeof scriptRestoring !== 'undefined' && scriptRestoring) return;   // 撤回重绘时不要把旧 DOM 写回
      const root = $('[data-script-blocks]', paper);
      if (root) Array.from(root.childNodes).forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) { const d = document.createElement('div'); d.className = 'script-block'; d.dataset.scriptId = 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); d.dataset.formatType = 'action'; d.textContent = n.textContent; root.replaceChild(d, n); } else if (n.nodeType === 3 && !n.textContent.trim()) n.remove(); });
      syncScriptEmptyGuide(root);
      const els = $$('.script-block[data-script-id]', paper);
      if (!els.length) {
        // 全选删除可能连段落节点一起移除；空态不能在下次刷新时恢复旧正文。
        if (root && !scriptHasText(root.textContent) && file.scriptBlocks?.length) {
          file.scriptBlocks = []; file.updated = '刚刚'; file.updatedAt = Date.now();
          Object.keys(file.editableText || {}).filter(key => key.startsWith('script:')).forEach(key => delete file.editableText[key]);
        }
        return;
      }
      const blocks = els.map(el => ({ id: el.dataset.scriptId, type: el.dataset.formatType || 'action', text: el.innerText.replace(/\r\n/g, '\n').replace(/\n+$/, '') }));
      const prev = JSON.stringify(file.scriptBlocks || []);
      if (JSON.stringify(blocks) !== prev) { file.scriptBlocks = blocks; file.updated = '刚刚'; file.updatedAt = Date.now(); }
      file.editableText = file.editableText || {}; blocks.forEach(b => { file.editableText[`script:${b.id}`] = b.text; });
    }
    // 同时覆盖点击、键盘输入、粘贴和 Agent 逐字写入；提示不进入可编辑正文。
    (() => {
      const viewport = $('#canvas-viewport'); if (!viewport) return;
      function dismissOnInteraction(event) {
        if ((event.button != null && event.button !== 0) || (event.type === 'pointerdown' && event.isPrimary === false)) return;
        // 浮动格式工具属于编辑过程，操作它们不算离开剧本。
        if (event.target.closest?.('#caret-format-toolbar, #script-format-menu, #cdoc-slash, #cdoc-block-menu, #cdoc-block-handle, #script-float, #script-line-handle')) return;
        const paper = event.target.closest?.('.script-paper');
        const fileId = paper?.dataset.pageFile;
        const dismissed = dismissedScriptGuides();
        // 清除其他剧本（或离开所有剧本）的临时隐藏状态，再按实际正文判断是否显示。
        for (const id of dismissed) if (id !== fileId) dismissed.delete(id);
        if (fileId && !event.target.closest('.script-meta, button, select, input, textarea, a, .page-drag-handle')) dismissed.add(fileId);
        $$('[data-script-blocks]', viewport).forEach(syncScriptEmptyGuide);
      }
      ['pointerdown','click','dblclick'].forEach(type => document.addEventListener(type,dismissOnInteraction,true));
      new MutationObserver(records => {
        const roots = new Set();
        records.forEach(record => {
          const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
          const root = element?.closest('[data-script-blocks]');
          if (root?.isConnected) roots.add(root);
          record.addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE || !node.isConnected) return;
            if (node.matches('[data-script-blocks]')) roots.add(node);
            node.querySelectorAll('[data-script-blocks]').forEach(added => roots.add(added));
          });
        });
        roots.forEach(syncScriptEmptyGuide);
      }).observe(viewport,{subtree:true,childList:true,characterData:true});
      const reposition = () => $$('[data-script-blocks]',viewport).forEach(positionScriptEmptyGuide);
      new ResizeObserver(reposition).observe(viewport);
      window.addEventListener('resize',reposition);
    })();

    const productionTemplateMeta = {
      scriptOrder: { title: '顺场表', en: 'SHOT LIST / SCRIPT ORDER', desc: '按剧本发生顺序逐场排列，人物 A–T 与服化道、食物、车辆同步拆解。', minWidth: 2720 },
      locationBreakdown: { title: '分景表', en: 'SCENE-BY-LOCATION BREAKDOWN', desc: '把所有发生在同一物理场景的 Scene 归并，集中检查人物与制作需求。', minWidth: 2720 },
      dailyReport: { title: '拍摄日报', en: 'DAILY PRODUCTION REPORT', desc: '记录当天实际到离场、开拍收工、完成镜头、页数、素材卷、质量与未完成项。', minWidth: 1840 },
      dailySchedule: { title: '通告单', en: 'CALL SHEET / RUNDOWN', desc: '按当日真实时间线排列拍摄顺序，并统一集合、演员、场地医疗与部门准备。', minWidth: 2100 }
    };

    const productionTableHeaders = {
      scriptOrder: ['顺序','场次','页数','预计分钟','景 / Set','日/夜','内/外','剧情摘要','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','其他 / BG','服化 / W-HMU','道具 / Props','食物 / Food','车辆 / Vehicles','状态'],
      locationBreakdown: ['物理场景 / Set','分区 / Sub-set','集数场次','页数','预计分钟','日/夜','内/外','剧情 / 连续性','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','其他 / BG','服化 / W-HMU','道具 / Props','食物 / Food','车辆 / Vehicles','状态'],
      dailyReport: ['序号','场号','场景 / Setting','地点 / Location','到达','开拍','离开','完成镜头 / Setups','页数','状态','素材卷 / Rolls','质量 / Client','问题 / Issue','备注'],
      dailySchedule: ['计划时间','任务','场号','镜头 / Setup','日/夜','页数','内容','场景 / 地点','演员 / BG','道具 / 服化 / 妆发','特效 / 动作','部门准备 / 器材','拍摄分钟','转场分钟','状态']
    };

    function productionTemplateNav(active) {
      return `<nav class="production-template-nav" aria-label="专业制作模板">${Object.entries(productionTemplateMeta).map(([key, meta]) => `<button class="${active === key ? 'active' : ''}" data-open-production="${key}"><strong>${meta.title}</strong><span>${meta.en}</span></button>`).join('')}</nav>`;
    }

    function productionSheetHeader(type, extra = '') {
      const meta = productionTemplateMeta[type];
      return `${productionTemplateNav(type)}<div class="production-sheet-head"><div class="production-sheet-title"><div class="paper-kicker">PROFESSIONAL PRODUCTION TEMPLATE · AUTO SAVED</div><h1>${meta.title}</h1><p>${meta.en} · ${meta.desc}</p></div><div class="production-sheet-actions"><button class="canvas-action" disabled title="当前原型尚未接入剧本解析；可直接编辑表格内容" data-production-type="${type}">剧本同步 · 待接入</button><button class="canvas-action" data-production-action="add-row" data-production-type="${type}">${icons.plus} 新增一行</button>${extra}<button class="canvas-action primary" data-production-action="export" data-production-type="${type}">导出 CSV</button></div></div>`;
    }

    function productionTable(type, options = {}) {
      const headers = productionTableHeaders[type];
      const rows = state.productionRows[type];
      const minWidth = productionTemplateMeta[type].minWidth;
      return `<div class="production-table-wrap"><table class="production-table" style="--table-min:${minWidth}px"><thead><tr><th style="width:26px"></th>${headers.map((header, index) => `<th style="width:${options.widths?.[index] || 110}px">${header}</th>`).join('')}</tr></thead><tbody>${rows.map((row, rowIndex) => `<tr data-production-row="${type}:${rowIndex}"><td class="production-row-grip"><span draggable="true" data-production-drag="${type}:${rowIndex}">${icons.chevron}</span></td>${row.map((cell, columnIndex) => `<td contenteditable="true" data-production-cell="${type}:${rowIndex}:${columnIndex}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    function productionSummary(type) {
      const rows = state.productionRows[type];
      if (type === 'scriptOrder') {
        const minutes = rows.reduce((sum, row) => sum + (Number.parseFloat(row[3]) || 0), 0);
        const pages = rows.reduce((sum, row) => sum + (Number.parseFloat(row[2]) || 0), 0);
        return [[rows.length,'场次'],[pages.toFixed(3),'剧本页 Pages'],[minutes + ' min','预计拍摄'],[(minutes / 480).toFixed(1) + ' days','折合工作日']];
      }
      if (type === 'locationBreakdown') {
        const locations = new Set(rows.map(row => row[0]).filter(Boolean)).size;
        const pages = rows.reduce((sum, row) => sum + (Number.parseFloat(row[3]) || 0), 0);
        const minutes = rows.reduce((sum, row) => sum + (Number.parseFloat(row[4]) || 0), 0);
        return [[locations,'物理场景 Sets'],[rows.length,'归并场次'],[pages.toFixed(3),'剧本页 Pages'],[(minutes / 480).toFixed(1) + ' days','预计工作日']];
      }
      if (type === 'dailyReport') {
        const shotRows = rows.filter(row => row[1] && row[1] !== '—');
        const complete = shotRows.filter(row => row[9] === '完成').length;
        const pages = shotRows.filter(row => row[9] !== '未拍').reduce((sum,row) => sum + (Number.parseFloat(row[8]) || 0),0);
        const pickups = shotRows.filter(row => String(row[11]).includes('补拍')).length;
        return [[shotRows.length,'计划场次'],[complete,'完成场次'],[pages.toFixed(3),'已拍页数'],[pickups,'需补拍']];
      }
      const minutes = rows.reduce((sum, row) => sum + (Number.parseFloat(row[12]) || 0), 0);
      const scenes = new Set(rows.map(row => row[2]).filter(value => value && value !== '—')).size;
      return [[rows.length,'今日任务'],[scenes,'拍摄场次'],[minutes + ' min','拍摄与准备'],[state.callSheetMeta.estWrap,'预计收工']];
    }

    function renderProductionSummary(type) {
      return `<div class="production-summary">${productionSummary(type).map(([value,label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>`;
    }

    function renderScriptOrder() {
      const widths = [54,58,60,66,116,52,52,220,...Array(20).fill(44),124,152,152,112,128,82];
      return paperWrap(`${productionSheetHeader('scriptOrder')}${renderProductionSummary('scriptOrder')}${productionTable('scriptOrder',{ widths })}<div class="production-note">填写逻辑：Script order → Scene。每行是一场戏；人物 A–T 使用角色简称或数量，随后列出其他演员、服化、道具、食物和车辆。需要逐镜头摄影参数时，进入分镜表或 Shot List 子表。</div>`, { production: true, page: 'AUTO' });
    }

    function renderLocationBreakdown() {
      const widths = [132,116,78,60,66,52,52,220,...Array(20).fill(44),124,152,152,112,128,82];
      return paperWrap(`${productionSheetHeader('locationBreakdown')}${renderProductionSummary('locationBreakdown')}${productionTable('locationBreakdown',{ widths })}<div class="production-note">填写逻辑：Physical Set → Sub-set → Episode / Scene。把同一物理场景发生的全部 Scene 连续归并，用于勘景、部门打包、拍摄日组合，以及人物与服化道连续性核对。</div>`, { production: true, page: 'AUTO' });
    }

    function renderDailyReportMeta() {
      const labels = { shootDay:'拍摄日', date:'拍摄日期', unit:'摄制组', director:'导演', producer:'制片', generalCall:'通告时间', firstShot:'首镜时间', wrap:'实际收工', breakfast:'早餐', lunch:'午餐', dinner:'晚餐', midnightMeal:'夜宵' };
      return `<div class="call-sheet-meta">${Object.entries(labels).map(([key,label]) => `<label><span>${label}</span><input data-report-meta="${key}" value="${escapeHtml(state.dailyReportMeta[key])}"></label>`).join('')}</div>`;
    }

    function renderDailyReportCastActuals() {
      const headers = ['Cast ID','角色 / 演员','抵达','妆发完成','首次上场','收工','状态','备注'];
      return `<div class="production-subsection"><div class="production-subsection-head"><strong>Cast actuals · 演员实际到离场</strong><span>用于日报，不等同于通告时间</span></div><div class="production-table-wrap"><table class="production-table" style="--table-min:980px"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${state.dailyReportCastActuals.map((row,rowIndex) => `<tr>${row.map((cell,columnIndex) => `<td contenteditable="true" data-report-cast-cell="${rowIndex}:${columnIndex}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    }

    function renderDailyReport() {
      const widths = [48,58,120,150,70,70,70,152,58,82,112,126,156,176];
      return paperWrap(`${productionSheetHeader('dailyReport')}${renderDailyReportMeta()}${renderProductionSummary('dailyReport')}${productionTable('dailyReport',{ widths })}${renderDailyReportCastActuals()}<div class="production-ops-grid"><section><strong>计划 / 实拍 / 未完成 / 加拍</strong><p contenteditable="true">计划：场 03、19、02、08\n实拍：场 03、19、02\n未完成：场 02 反打、场 08\n加拍：无</p></section><section><strong>餐时与素材卷</strong><p contenteditable="true">早餐 06:00 · 午餐 12:30 · 晚餐 17:30\nA 机 A001–A007 · B 机 B001–B006</p></section><section><strong>Remarks · 备注</strong><p contenteditable="true">${escapeHtml(state.dailyReportMeta.remarks)}</p></section></div><div class="production-note">日报只填写实际发生的数据：到场、开拍、离场、完成内容、素材卷、质量、问题与补拍项；不得用通告单中的计划时间替代。</div>`, { production: true, page: 'DAY 03 · ACTUAL' });
    }

    function renderCallSheetMeta() {
      const labels = { shootDay:'拍摄日', date:'拍摄日期', unit:'摄制组', generalCall:'全组到场', firstShot:'首镜时间', meal:'用餐时间', estWrap:'预计收工', weather:'天气', sun:'日出 / 日落', basecamp:'集合 / 停车', hospital:'附近医院', safety:'安全提示' };
      return `<div class="call-sheet-meta">${Object.entries(labels).map(([key,label]) => `<label><span>${label}</span><input data-call-meta="${key}" value="${escapeHtml(state.callSheetMeta[key])}"></label>`).join('')}</div>`;
    }

    function renderCastCalls() {
      const headers = ['Cast ID','Role / name','S / W / H / F','Pickup','H / MU','Wardrobe','On set','Wrap','Notes'];
      return `<div class="production-subsection"><div class="production-subsection-head"><strong>Cast calls · 演员通告</strong><span>S/W/H/F：Start / Work / Hold / Finish</span></div><div class="production-table-wrap"><table class="production-table" style="--table-min:1060px"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${state.castCalls.map((row,rowIndex) => `<tr>${row.map((cell,columnIndex) => `<td contenteditable="true" data-cast-cell="${rowIndex}:${columnIndex}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    }

    function renderDailySchedule() {
      const widths = [92,106,58,92,52,54,220,160,128,180,148,174,62,58,86];
      return paperWrap(`${productionSheetHeader('dailySchedule')}${renderCallSheetMeta()}${renderProductionSummary('dailySchedule')}<div class="production-ops-grid"><section><strong>拍摄地址 / Location</strong><p>海港百货西侧装卸口\n转场：Stage B 南门 · 35 min</p></section><section><strong>路线 / 医疗 / 停车</strong><p>${escapeHtml(state.callSheetMeta.basecamp)}\n${escapeHtml(state.callSheetMeta.hospital)}</p></section><section><strong>安全与保密</strong><p>${escapeHtml(state.callSheetMeta.safety)}\n未经授权禁止现场拍摄和传播。</p></section></div>${productionTable('dailySchedule',{ widths })}${renderCastCalls()}<div class="production-note">通告单只写计划：Shoot Day → Planned Time。拍摄顺序、演员 Call、天气、医院、停车、安全说明与部门准备在开拍前统一发布；实际结果回填到拍摄日报。</div>`, { production: true, page: 'DAY 03 · CALL' });
    }

    function renderProduction() {
      const range = state.mode === 'series' ? `<div class="range-control"><button class="range-chip active">全剧</button>${[1,2,3,4].map(ep => `<button class="range-chip">EP ${ep}</button>`).join('')}<button class="range-chip">选择范围</button></div>` : '<div class="range-control"><button class="range-chip active">全片</button><button class="range-chip">第一章</button><button class="range-chip">第二章</button></div>';
      const scenes = [
        { id: 'scene1', code: '02', slug: 'INT · 雨夜车内 · 夜', scope: state.mode === 'series' ? 'EP1 · 2' : '第一章', pages: '2 3/8', cast: ['梦雨','吴老师'], assets: ['旧轿车','记忆文件','雨效'], status: '已分镜' },
        { id: 'scene2', code: '03', slug: 'EXT · 商场后门 · 夜', scope: state.mode === 'series' ? 'EP1 · 3' : '第一章', pages: '1 5/8', cast: ['梦雨','吴老师','披萨'], assets: ['卷帘门','银色芯片'], status: '待确认' },
        { id: 'scene3', code: '08', slug: 'INT · 记忆档案室 · 日', scope: state.mode === 'series' ? 'EP1 · 8' : '第一章', pages: '3 1/4', cast: ['梦雨','Tiffany'], assets: ['存储阵列','透明屏幕'], status: '已分镜' },
        { id: 'scene4', code: '27', slug: 'EXT · 天台温室 · 黎明', scope: state.mode === 'series' ? 'EP8 · 9' : '第三章', pages: '2 1/2', cast: ['梦雨','披萨'], assets: ['雾机','植物','天际线'], status: '待拆解' }
      ];
      return paperWrap(`
        <div class="scene-list-toolbar"><div><h1>Scene list · 统筹表</h1><div class="scene-list-note">剧本场次同步更新，点击场景可在 Writing 中定位。</div></div>${range}</div>
        <div class="breakdown-summary">
          <div><strong>${state.mode === 'series' ? '67' : '36'}</strong><span>场次</span></div>
          <div><strong>11</strong><span>地点 Locations</span></div>
          <div><strong>8</strong><span>主要角色 Cast</span></div>
          <div><strong>24</strong><span>关键道具 Props</span></div>
        </div>
        <div class="scene-list">
          <div class="scene-list-columns"><span>SCENE</span><span>SLUGLINE</span><span>PAGES</span><span>CAST</span><span>ASSETS / NOTES</span><span>STATUS</span></div>
          ${scenes.map(scene => `<button class="scene-list-row ${state.activeScene === scene.id ? 'active' : ''}" data-scene-row="${scene.id}">
            <span class="scene-code">${scene.code}</span>
            <span class="scene-slug"><strong>${scene.slug}</strong><span>${scene.scope}</span></span>
            <span class="scene-cell">${scene.pages} 页</span>
            <span class="scene-cell">${scene.cast.join('、')}</span>
            <span class="scene-tags">${scene.assets.map(asset => `<span class="scene-tag">${asset}</span>`).join('')}</span>
            <span class="scene-status ${scene.status === '已分镜' ? '' : 'pending'}">${scene.status}</span>
          </button>`).join('')}
        </div>
        <div class="word-count"><span>按剧本场次聚合 · 支持导出 XLSX / PDF</span><span>最后同步 · 刚刚</span></div>
      `, { wide: true, page: '1 / 4' });
    }

    function renderProductionLedger() {
      const scope = state.mode === 'series' ? `全剧 · 当前查看 EP ${state.episode}` : '全片 · 当前查看第一章';
      const entries = [
        { date: '08 / 21', type: '决策', className: '', item: '视觉规范 v0.4', detail: '锁定“真实空间先于未来感装饰”；所有生成任务先引用 VISION-SPEC-04，再加载场景变量。', owner: '导演组', version: 'LOCKED', status: '已同步' },
        { date: '08 / 21', type: '资产', className: '', item: '梦雨角色主资产', detail: 'CHR-MENGYU-03 通过正侧脸与全身一致性检查，替代 v02；旧版本仅保留追溯，不再用于生成。', owner: '美术 / AI', version: 'v03', status: '已同步' },
        { date: '08 / 20', type: '成本', className: 'cost', item: '场 02 测试生成', detail: '三轮镜头测试共 42 次生成；保留 6 条可用素材，异常消耗来自雨量与车窗反射不连续。', owner: '制片', version: '¥ 1,286', status: '待复盘' },
        { date: '08 / 20', type: '交付', className: 'delivery', item: '第一章分镜', detail: 'Storyboard v05 已交付摄影与后期预演；镜头 02-07 等待导演确认后锁版。', owner: '分镜组', version: 'v05', status: '待确认' }
      ];
      return paperWrap(`
        <div class="ledger-header">
          <div><h1 contenteditable="true">项目制作账本</h1><div class="ledger-subtitle">把创作决策、Agent 规则、资产版本、成本与交付记录在同一份项目事实源中。统筹表负责“拍什么”，制作账本负责“为什么这样做、现在以哪一版为准”。</div></div>
          <span class="ledger-version">PRODUCTION LEDGER · v0.1</span>
        </div>
        <div class="ledger-principle"><strong>Agent 读取原则</strong><span contenteditable="true">只读取标记为「已锁定 / 已同步」的事实；遇到版本冲突时，以本账本的最新记录为准，并把未决问题返回给负责人，不自行补全。</span></div>
        <div class="ledger-summary" aria-label="项目制作摘要">
          <div><strong>17</strong><span>锁定决策</span></div>
          <div><strong>43 / 51</strong><span>可生产资产</span></div>
          <div><strong>6</strong><span>待确认事项</span></div>
          <div><strong>¥ 28.6k</strong><span>已记录生成成本</span></div>
        </div>
        <section class="ledger-section">
          <div class="ledger-section-head"><h2>当前制作上下文</h2><span>${scope}</span></div>
          <div class="ledger-facts">
            <div class="ledger-fact"><strong>当前里程碑</strong><span contenteditable="true">第一章分镜锁版 + 角色资产进入连续镜头测试</span></div>
            <div class="ledger-fact"><strong>视觉事实源</strong><span contenteditable="true">VISION-SPEC-04 · 风格阐述 v0.4</span></div>
            <div class="ledger-fact"><strong>本轮允许变化</strong><span contenteditable="true">景别、运动速度、表演节拍；不得改变角色、服装、主光与空间方位</span></div>
            <div class="ledger-fact"><strong>未决问题</strong><span contenteditable="true">场 02 雨量等级 R2 / R3；记忆芯片表面反射强度等待摄影确认</span></div>
          </div>
        </section>
        <section class="ledger-section">
          <div class="ledger-section-head"><h2>制作记录</h2><span>按时间倒序 · 自动保存</span></div>
          <div class="ledger-log">
            <div class="ledger-log-head"><span>DATE</span><span>TYPE</span><span>ITEM</span><span>DECISION / CHANGE</span><span>OWNER</span><span>VERSION</span></div>
            ${entries.map(entry => `<div class="ledger-log-row">
              <span>${entry.date}</span>
              <span><span class="ledger-entry-type ${entry.className}">${entry.type}</span></span>
              <strong contenteditable="true">${entry.item}</strong>
              <span contenteditable="true">${entry.detail}</span>
              <span>${entry.owner}</span>
              <span><span class="ledger-status ${entry.status === '已同步' ? '' : 'pending'}">${entry.version}</span></span>
            </div>`).join('')}
          </div>
        </section>
        <section class="ledger-section">
          <div class="ledger-section-head"><h2>交付与追溯规则</h2><span>对人、Agent 与供应商一致</span></div>
          <div class="validation-list">
            <div class="validation-item">每个生成结果必须记录资产 ID、Prompt 版本与负责人</div>
            <div class="validation-item">新版本通过验收后才能替代当前锁定版本</div>
            <div class="validation-item">删除只进入归档，不破坏已交付文件的来源追溯</div>
            <div class="validation-item">成本记录绑定场景、生成批次与最终可用素材</div>
          </div>
        </section>
        <div class="word-count"><span>事实源：剧本、风格阐述、资产库、分镜与交付记录</span><span>最后同步 · 刚刚</span></div>
      `, { wide: true, page: '1 / 6' });
    }

    function syncedTagList(shot) {
      return Object.values(shot.tags).flat().filter(Boolean);
    }

    function renderShotDescription(shot) {
      const tags = syncedTagList(shot);
      return `<div class="shot-panel">
        <textarea class="shot-description" data-shot-description="${shot.id}" aria-label="分镜 ${shot.id} 文字描述">${shot.description}</textarea>
        <div class="synced-language"><strong>镜头语言同步</strong> · ${tags.join(' · ') || '尚未选择镜头语言'}
          <div class="synced-tags">${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
        </div>
      </div>`;
    }

    function renderShotCamera(shot) {
      const fields = Object.entries(cameraOptions).map(([label, options]) => {
        const selected = shot.tags[label] || [];
        const menuId = `${shot.id}-${label}`;
        return `<div class="tag-select">
          <span class="tag-select-label">${label}</span>
          <button class="tag-select-trigger" data-tag-trigger="${menuId}"><span>${selected.length ? selected.join('、') : '请选择（可多选）'}</span>${icons.chevron}</button>
          <div class="tag-menu ${state.openTagMenu === menuId ? '' : 'hidden'}">
            ${options.map(option => `<button class="tag-option ${selected.includes(option) ? 'selected' : ''}" data-tag-option data-shot="${shot.id}" data-category="${label}" data-value="${option}">${option}</button>`).join('')}
          </div>
        </div>`;
      }).join('');
      return `<div class="shot-panel"><div class="camera-grid">${fields}
        <div class="custom-tag-row"><input data-custom-tag-input="${shot.id}" placeholder="添加自定义镜头语言"><button data-add-custom-tag="${shot.id}">添加选项</button></div>
      </div></div>`;
    }

    function renderMediaPreview(shot) {
      if (shot.media === 'visual') return '<div class="media-preview visual"><div><strong>参考图 · rooftop-memory.jpg</strong><br><span>3840 × 2160 · Discovery</span></div></div>';
      if (shot.media === 'audio') return `<div class="media-preview audio"><div><div class="wave">${[18,31,12,38,25,42,17,34,21,39,14,29,19].map(h => `<i style="--h:${h}px"></i>`).join('')}</div><strong>环境参考 · rain-car.wav</strong></div></div>`;
      if (shot.media === 'canvas') return '<div class="media-preview"><div><strong>画布草图已关联</strong><br><span>点击进入画布继续创作</span></div></div>';
      return `<div class="media-placeholder">${icons.image}<strong>添加参考（草图）</strong><span>支持图片、视频与音频</span></div>`;
    }

    function renderShotReference(shot) {
      return `<div class="shot-panel"><div class="media-area">${renderMediaPreview(shot)}
        <div class="media-action-wrap"><button class="media-add" data-media-trigger="${shot.id}" aria-label="添加媒体">${icons.plus}</button>
          <div class="media-menu ${state.openMediaMenu === shot.id ? '' : 'hidden'}">
            <button data-media-action="upload" data-shot="${shot.id}">${icons.upload} 上传</button>
            <button data-media-action="canvas" data-shot="${shot.id}">${icons.canvas} 进入画布创作</button>
            <button data-media-action="discovery" data-shot="${shot.id}">${icons.search} 从 Discovery 搜索</button>
          </div>
        </div>
      </div></div>`;
    }

    function renderShot(shot, storyboardFileId) {
      const active = state.shotTab[shot.id] || 'description';
      const panel = active === 'description' ? renderShotDescription(shot) : active === 'camera' ? renderShotCamera(shot) : renderShotReference(shot);
      return `<section class="shot-card" data-shot-card="${shot.id}">
        <div class="shot-top">
          <div class="shot-title"><span class="shot-code">SHOT ${String(shot.id).padStart(2, '0')}</span><span class="current-kind">${state.mode === 'series' ? `EP ${state.episode}` : 'SCENE 02'}</span></div>
          ${shot.sourceId ? `<button class="source-link" data-source-link="${shot.sourceId}" data-source-file="${storyboardFileId || ''}">${icons.link} 定位剧本 · ${shot.sourceLabel}</button>` : `<button class="source-link" disabled>${icons.link} 尚未关联剧本段落</button>`}
        </div>
        <div class="shot-switches">
          <button class="${active === 'description' ? 'active' : ''}" data-shot-tab="description" data-shot="${shot.id}">文字描述</button>
          <button class="${active === 'camera' ? 'active' : ''}" data-shot-tab="camera" data-shot="${shot.id}">镜头语言</button>
          <button class="${active === 'reference' ? 'active' : ''}" data-shot-tab="reference" data-shot="${shot.id}">参考（草图）</button>
        </div>
        ${panel}
      </section>`;
    }

    function renderStoryboard(options = {}) {
      const storyboardFile = findFile(state.renderContext?.fileId);
      const shot = state.shots.find(item => item.id === storyboardFile?.shotId) || state.shots[0];
      const shotNumber = String(shot?.id || 1).padStart(2, '0');
      return paperWrap(`
        <div class="storyboard-head"><div><div class="paper-kicker">SCENE 02 · STORYBOARD</div><h1>分镜 ${shotNumber}</h1><div class="storyboard-sub">一份分镜稿纸只记录一个镜头。使用“定位剧本”可快速回到对应正文。</div></div>${episodeControl()}</div>
        ${shot ? renderShot(shot, storyboardFile?.id) : '<div class="stack-empty">这份分镜尚未写入镜头信息。</div>'}
      `, { page: `SHOT ${shotNumber}` });
    }

    function renderCustom(id) {
      const file = findFile(state.renderContext?.fileId);
      const title = file?.title || '空白页面';
      const body = file?.content ? escapeHtml(file.content).replace(/\n/g, '<br>') : '从这里开始写下你的创作资料…';
      return paperWrap(`
        <div class="paper-kicker">CUSTOM DOCUMENT · 自动保存</div>
        <h1 contenteditable="true">${escapeHtml(title)}</h1>
        <p class="doc-lead" contenteditable="true" style="color:${file?.content ? '#2e302f' : '#7a807d'}">${body}</p>
      `, { page: '1' });
    }

    function editableContentKey(element, index) {
      return element.dataset.scriptId ? `script:${element.dataset.scriptId}` : `content:${index}`;
    }

    function capturePaperEdits(paper, markUpdated = false) {
      const file = findFile(paper?.dataset.pageFile);
      if (!file || !paper) return;
      if (paper.classList.contains('production-paper')) return;
      if (paper.classList.contains('cloud-doc')) return captureCloudDoc(paper, file);
      if (paper.classList.contains('script-paper')) return captureScriptBlocks(paper, file);
      const editables = $$('[contenteditable="true"]', paper);
      if (!editables.length) return;
      file.editableText = file.editableText || {};
      editables.forEach((element, index) => {
        const key = element.dataset.editKey || editableContentKey(element, index);
        element.dataset.editKey = key;
        file.editableText[key] = element.innerText.replace(/\r\n/g, '\n');
      });
      if (markUpdated) {
        file.updated = '刚刚'; file.updatedAt = Date.now();
        const preview = editables.map(element => element.innerText.trim()).filter(Boolean).join(' ');
        if (preview) file.preview = preview.slice(0, 140);
      }
    }

    function captureVisibleEdits() {
      $$('[data-paper]').filter(paper => paper.getClientRects().length && !paper.closest('.hidden') && getComputedStyle(paper).visibility === 'visible').forEach(paper => capturePaperEdits(paper));
    }

    function hydrateEditableContent() {
      $$('[data-paper]').forEach(paper => {
        if (paper.classList.contains('production-paper') || paper.classList.contains('cloud-doc') || paper.classList.contains('script-paper')) return;
        const file = findFile(paper.dataset.pageFile);
        if (!file) return;
        $$('[contenteditable="true"]', paper).forEach((element, index) => {
          const key = editableContentKey(element, index);
          element.dataset.editKey = key;
          if (!file.editableText || !Object.prototype.hasOwnProperty.call(file.editableText, key)) return;
          const savedText = file.editableText[key];
          if (element.dataset.scriptId) element.innerHTML = renderAssetText(savedText, `${file.id}:${element.dataset.scriptId}`);
          else element.innerText = savedText;
        });
      });
    }

    function bindEditableSave() {
      hydrateEditableContent();
    }

    let saveTimer;
    // 保存状态灯：绿 = 已联网并成功自动保存；红 = 离线或本地存储失败
    let lastPersistOk = true;
    function updateSaveLight(saving = false) {
      const ok = lastPersistOk && navigator.onLine !== false;
      $$('.save-dot').forEach(dot => { dot.classList.toggle('fail', !ok); dot.classList.toggle('saving', saving && ok); dot.title = !ok ? (navigator.onLine === false ? '当前离线，未能自动保存' : '本地存储失败，未能自动保存') : saving ? '正在保存…' : '自动保存正常'; });
    }
    function markSaving() {
      updateSaveLight(true);
      lastPersistOk = persistWorkspace() !== false;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => updateSaveLight(false), 600);
    }
    window.addEventListener('online', () => updateSaveLight(false));
    window.addEventListener('offline', () => updateSaveLight(false));

    let toastTimer;
    const TOASTS_ENABLED = false;   // 黑色提示条默认不出现（用户要求）；需要时改为 true
    function showToast(message) {
      if (!TOASTS_ENABLED) return;
      const toast = $('#toast');
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function safeFileName(value) {
      return String(value || 'Moodio 文档').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Moodio 文档';
    }

    function hydrateDetachedPaper(paper, file) {
      $$('[contenteditable="true"]', paper).forEach((element, index) => {
        const key = editableContentKey(element, index);
        if (!file.editableText || !Object.prototype.hasOwnProperty.call(file.editableText, key)) return;
        const savedText = file.editableText[key];
        if (element.dataset.scriptId) element.innerHTML = renderAssetText(savedText, `${file.id}:${element.dataset.scriptId}`);
        else element.innerText = savedText;
      });
    }

    function exportMarkupForFile(file) {
      if (file.type === 'storyboard') {
        const shots = state.shots.filter(sh => sh.boardFileId === file.id);
        const rows = shots.map(sh => `<tr><td>${escapeHtml(shotLabel(sh))}</td><td>场 ${escapeHtml(sh.scene || '')}</td><td>${escapeHtml(sh.description || '')}</td><td>${escapeHtml((state.chunks || []).filter(c => c.shotIds.includes(sh.id)).map(c => c.title).join('、'))}</td></tr>`).join('');
        return `<section class="export-page"><div class="export-file-heading"><strong>${escapeHtml(file.title)}</strong><span>分镜表 · STORYBOARD</span></div><table><thead><tr><th>镜号</th><th>场次</th><th>画面内容</th><th>生成单元</th></tr></thead><tbody>${rows || '<tr><td colspan="4">（暂无镜头）</td></tr>'}</tbody></table></section>`;
      }
      const holder = document.createElement('div');
      holder.innerHTML = renderDocument(file.type, { compare: false, slot: 'left', fileId: file.id });
      const paper = holder.querySelector('[data-paper]');
      if (!paper) return '';
      hydrateDetachedPaper(paper, file);
      $$('.shot-source-highlight, .shot-source-start', paper).forEach(element => element.classList.remove('shot-source-highlight', 'shot-source-start'));
      $$('.page-drag-handle, .paper-doc-tabs, .paper-page-number, .script-meta, .script-meta-controls, .media-action-wrap, .shot-check, .cdoc-empty-hint, .script-empty-guide, .sh-toolbar, .sh-formula, .sh-fold, .node-port, .gen-delete', paper).forEach(element => element.remove());
      $$('[data-script-blocks]', paper).forEach(element => element.removeAttribute('aria-describedby'));
      $$('select', paper).forEach(select => {
        const replacement = document.createElement('span');
        replacement.className = select.className;
        replacement.textContent = select.options[select.selectedIndex]?.textContent || '';
        select.replaceWith(replacement);
      });
      $$('button', paper).forEach(button => {
        const replacement = document.createElement('span');
        replacement.className = button.className;
        replacement.innerHTML = button.innerHTML;
        button.replaceWith(replacement);
      });
      $$('[contenteditable], [draggable], [tabindex], [role], [aria-label], [aria-expanded]', paper).forEach(element => {
        ['contenteditable', 'draggable', 'tabindex', 'role', 'aria-label', 'aria-expanded'].forEach(attribute => element.removeAttribute(attribute));
      });
      const def = docDef(file.type);
      return `<section class="export-page"><div class="export-file-heading"><strong>${escapeHtml(file.title)}</strong><span>${escapeHtml(def.name)} · ${escapeHtml(def.en)}</span></div>${paper.outerHTML}</section>`;
    }

    function buildWordDocument(files) {
      const pages = files.map(exportMarkupForFile).join('');
      return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Moodio 文档导出</title><style>
        @page { size: A4; margin: 22mm 20mm 22mm; }
        body { margin: 0; color: #202422; background: #fff; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
        .export-page { page-break-after: always; }
        .export-page:last-child { page-break-after: auto; }
        .export-file-heading { margin: 0 0 14mm; padding-bottom: 5mm; border-bottom: 1px solid #dbdbd9; }
        .export-file-heading strong { display: block; font-size: 16pt; }
        .export-file-heading span { display: block; margin-top: 2mm; color: #777; font-size: 8pt; text-transform: uppercase; }
        .paper { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; background: #fff; }
        .paper h1 { margin: 0 0 10mm; font-family: Georgia, "Songti SC", serif; font-size: 30pt; font-weight: 500; }
        .paper h2 { margin: 8mm 0 4mm; font-size: 16pt; }
        .paper p, .script-block { font-size: 12pt; line-height: 1.7; }
        .paper-kicker, .script-meta, .storyboard-sub { color: #6f7773; font-size: 8pt; letter-spacing: .08em; }
        .script-body { margin-top: 8mm; }
        .script-block { margin: 0 0 5mm; white-space: pre-wrap; }
        .scene-line, .scene-heading-text { margin-top: 8mm; font-weight: 700; text-transform: uppercase; }
        .character { width: 48%; margin-left: 42%; font-weight: 700; text-align: left; }
        .dialogue { width: 55%; margin-left: 25%; }
        .parenthetical { width: 45%; margin-left: 34%; }
        .transition { text-align: right; text-transform: uppercase; }
        .asset-token { margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; font-weight: 600; }
        .asset-token.character { color: #694178; }
        .asset-token.location { color: #246d66; }
        .asset-token.prop { color: #8a5b18; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 3mm 2mm; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; font-size: 9pt; }
        svg, input, .view-dock { display: none !important; }
      
  </style></head><body>${pages}</body></html>`;
    }

    function downloadDocuments(files) {
      captureVisibleEdits();
      persistWorkspace();
      const selected = files.filter(Boolean);
      if (!selected.length) return;
      const blob = new Blob(['\ufeff', buildWordDocument(selected)], { type: 'application/msword;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      link.download = selected.length === 1 ? `${safeFileName(selected[0].title)}.doc` : `Moodio-稿纸批量导出-${stamp}.doc`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1500);
      showToast(selected.length === 1 ? `已导出“${selected[0].title}”` : `已合并导出 ${selected.length} 份稿纸`);
    }

    // 导出对象 = 板块：剧本正文（含封面）、故事梗概、故事大纲、分镜表、各空白页面；每个板块可选版本
    const EXPORT_FORMAT_LABEL = { doc: 'Word', pdf: 'PDF', md: 'Markdown', txt: '纯文本' };
    state.exportFormat = state.exportFormat || 'doc';
    state.exportVersions = state.exportVersions || {};
    function exportCategories() {
      const cats = [];
      const base = [['synopsis', '故事梗概'], ['outline', '故事大纲'], ['script', '剧本正文（含封面）'], ['storyboard', '分镜表']];
      base.forEach(([type, name]) => { const files = filesForType(type); if (files.length) cats.push({ key: type, name, type, files }); });
      try { blankPageLineages().forEach(g => { const kind = g.files[0]?.kind || 'doc'; if (kind === 'canvas' || kind === 'mindmap') return; cats.push({ key: 'custom:' + g.key, name: g.files[g.files.length - 1].title, type: 'custom', files: g.files }); }); } catch (_) {}
      return cats;
    }
    function exportCategoryOf(fileId) { const file = findFile(fileId); if (!file) return null; if (file.type === 'cover') return 'script'; if (file.type === 'custom') return 'custom:' + (file.lineageId || file.id); return file.type; }
    function exportFilesFor(cat) {
      const chosen = findFile(state.exportVersions[cat.key]) || cat.files[cat.files.length - 1];
      if (cat.type === 'script') { const cover = latestFile('cover'); return [cover, chosen].filter(Boolean); }
      return [chosen];
    }
    function renderExportDialog() {
      const list = $('#export-file-list'), count = $('#export-selected-count'), confirm = $('#export-confirm-button');
      if (!list || !count || !confirm) return;
      const cats = exportCategories();
      list.innerHTML = cats.map(cat => {
        const latest = cat.files[cat.files.length - 1];
        const pick = state.exportVersions[cat.key] && cat.files.some(f => f.id === state.exportVersions[cat.key]) ? state.exportVersions[cat.key] : latest.id;
        const pickFile = findFile(pick), pickIdx = cat.files.findIndex(f => f.id === pick);
        const pickLabel = `${pickFile === latest ? '最新 · ' : ''}v${pickIdx + 1} · ${escapeHtml(displayFileTitle(pickFile))}`;
        return `<label class="export-file-option"><input type="checkbox" data-export-cat="${escapeHtml(cat.key)}" ${state.exportSelection.has(cat.key) ? 'checked' : ''}><span class="export-file-copy"><strong>${escapeHtml(cat.name)}</strong><span>${pickLabel}${cat.files.length > 1 ? ` · 共 ${cat.files.length} 个版本` : ''}</span></span>${cat.files.length > 1 ? `<button type="button" class="export-version-btn" data-export-version-menu="${escapeHtml(cat.key)}" aria-label="选择导出版本" data-no-tip><svg viewBox="0 0 24 24" class="icon sm"><path d="m7 10 5 5 5-5"/></svg></button>` : ''}</label>`;
      }).join('') || '<p class="writing-folders-empty">还没有可导出的板块</p>';
      const fmtSel = $('[data-export-format]'); if (fmtSel) fmtSel.value = state.exportFormat;
      const n = state.exportSelection.size;
      count.textContent = `已选 ${n} 个板块`;
      confirm.disabled = n === 0;
      confirm.textContent = `导出 ${EXPORT_FORMAT_LABEL[state.exportFormat] || ''}${n > 1 ? `（${n} 个板块）` : ''}`;
      const note = $('#export-foot-note'); if (note) { note.textContent = ''; note.hidden = true; }
    }
    function openExportDialog(fileIds = []) {
      const fallbackId = activeFile(state.view === 'compare' ? state.selectedPageSlot : 'left')?.id;
      const ids = (fileIds.length ? fileIds : [fallbackId]).filter(Boolean);
      state.exportSelection = new Set();
      ids.forEach(id => { const key = exportCategoryOf(id); if (!key) return; state.exportSelection.add(key); if (findFile(id)?.type !== 'cover') state.exportVersions[key] = id; });
      if (!state.exportSelection.size) { const first = exportCategories()[0]; if (first) state.exportSelection.add(first.key); }
      renderExportDialog();
      $('#export-dialog-backdrop').classList.remove('hidden');
    }
    // —— 其他格式 ——
    function exportTextForFiles(files, md) {
      const out = [];
      files.forEach(file => {
        const holder = document.createElement('div'); holder.innerHTML = exportMarkupForFile(file);
        const section = holder.querySelector('.export-page') || holder; if (!section.textContent.trim()) return;
        const title = file.title;
        out.push(md ? `# ${title}` : `${title}\n${'='.repeat(Math.min(40, title.length * 2))}`); out.push('');
        section.querySelector('.export-file-heading')?.remove();
        if (section === holder) holder.querySelector('h1')?.remove();   // 旧版分镜表导出只有 <h1>+<table>
        const sel = 'h1,h2,h3,p,li,.script-block,tr,blockquote,pre,.cover-title,.cover-author,.cover-logline,figcaption,.cdoc-callout';
        section.querySelectorAll(sel).forEach(el => {
          if (el.parentElement?.closest(sel) && el.parentElement.closest(sel) !== section) { const anc = el.parentElement.closest(sel); if (anc && anc !== el && section.contains(anc) && !anc.matches('tr')) return; }
          const text = (el.innerText || el.textContent || '').replace(/\s+\n/g, '\n').trim(); if (!text) return;
          const tag = el.tagName;
          if (tag === 'TR') { const cells = [...el.children].map(c => c.textContent.trim()); out.push(md ? `| ${cells.join(' | ')} |` : cells.join('\t')); if (md && el.parentElement?.tagName === 'THEAD') out.push(`|${cells.map(() => ' --- ').join('|')}|`); return; }
          if (el.classList.contains('script-block')) { const t = el.dataset.formatType; if (t === 'scene') { out.push(''); out.push(md ? `**${text.toUpperCase()}**` : text.toUpperCase()); } else if (t === 'character') { out.push(''); out.push(md ? `**${text}**` : `        ${text}`); } else if (t === 'paren') out.push(md ? `_${text}_` : `      ${text}`); else if (t === 'dialogue') out.push(md ? text : `    ${text}`); else { out.push(''); out.push(text); } return; }
          if (tag === 'H1') out.push((md ? '# ' : '') + text); else if (tag === 'H2') { out.push(''); out.push((md ? '## ' : '') + text); } else if (tag === 'H3') { out.push(''); out.push((md ? '### ' : '') + text); }
          else if (tag === 'LI') out.push((md ? '- ' : '· ') + text); else if (tag === 'BLOCKQUOTE') out.push((md ? '> ' : '') + text); else if (tag === 'PRE') { out.push(md ? '```' : ''); out.push(text); out.push(md ? '```' : ''); }
          else { out.push(text); out.push(''); }
        });
        out.push(''); out.push(md ? '---' : '\n'); out.push('');
      });
      return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }
    function downloadTextDocuments(files, fmt) {
      captureVisibleEdits(); persistWorkspace();
      const text = exportTextForFiles(files, fmt === 'md');
      const blob = new Blob(['\ufeff' + text], { type: fmt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const stamp = new Date().toISOString().slice(0, 10);
      a.download = (files.length === 1 ? safeFileName(files[0].title) : `Moodio-导出-${stamp}`) + (fmt === 'md' ? '.md' : '.txt'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }
    function printDocuments(files) {
      captureVisibleEdits(); persistWorkspace();
      const html = buildWordDocument(files);
      const frame = document.createElement('iframe'); frame.setAttribute('aria-hidden', 'true'); frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
      document.body.appendChild(frame);
      frame.onload = () => { setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (_) { showToast('浏览器阻止了打印，请改用 Word 导出'); } setTimeout(() => frame.remove(), 60000); }, 250); };
      frame.srcdoc = html;
    }

    function closeExportDialog() {
      $('#export-dialog-backdrop')?.classList.add('hidden');
    }

    /* ===== 项目备份：导出 / 导入（localStorage 里的 moodio-* 数据 + IndexedDB 媒体） ===== */
