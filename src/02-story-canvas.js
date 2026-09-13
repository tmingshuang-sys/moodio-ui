    function storyEdgeGeometry(from,to,edge = {}) {
      if (!from || !to) return null;
      const start = cardPortPoint(from,edge.fromPort || 'auto',to),end = cardPortPoint(to,edge.toPort || 'auto',from);
      const dx = end.x - start.x,dy = end.y - start.y,distance = Math.max(1,Math.hypot(dx,dy));
      const curve = Math.max(44,Math.min(180,distance * .42));
      const bend = Number(edge.bend) || 0,nx = -dy / distance,ny = dx / distance;
      const c1 = { x:start.x + start.vx * curve + nx * bend,y:start.y + start.vy * curve + ny * bend };
      const c2 = { x:end.x + end.vx * curve + nx * bend,y:end.y + end.vy * curve + ny * bend };
      const handle = {
        x:(start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
        y:(start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
        normalX:nx,normalY:ny
      };
      return { start,end,c1,c2,handle,path:`M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}` };
    }

    function cardEdgePath(from,to,edge = {}) {
      return storyEdgeGeometry(from,to,edge)?.path || '';
    }

    function renderStoryEdges() {
      return `<svg class="story-edge-layer" viewBox="0 0 2700 1260" aria-hidden="true"><defs><marker id="story-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#929996"/></marker></defs>${state.storyEdges.map(edge => {
        const from = state.storyBeats.find(card => card.id === edge.from), to = state.storyBeats.find(card => card.id === edge.to);
        if (!from || !to) return '';
        const geometry = storyEdgeGeometry(from,to,edge),selected = state.selectedStoryEdge === edge.id;
        const dashed = edge.dashed ?? edge.kind === 'branch';
        return `<g data-story-edge-group="${edge.id}"><path class="story-edge-hit" data-story-edge-select="${edge.id}" data-story-edge-path="${edge.id}" d="${geometry.path}"></path><path class="story-edge ${edge.kind || 'branch'} ${dashed ? 'dashed' : ''} ${selected ? 'selected' : ''}" data-story-edge-path="${edge.id}" d="${geometry.path}" ${edge.arrow === false ? '' : 'marker-end="url(#story-arrow)"'}></path>${selected ? `<circle class="story-edge-handle" data-story-edge-handle="${edge.id}" cx="${geometry.handle.x}" cy="${geometry.handle.y}" r="6"></circle>` : ''}</g>`;
      }).join('')}<path class="story-wire-preview" data-story-wire-preview d="" marker-end="url(#story-arrow)"></path></svg>`;
    }

    function renderStoryMap() {
      const target = state.storyTargetPages || 110;
      const ticks = [0,.25,.5,.75,1];
      const structures = [.25,.5,.75];
      const markers = state.storyBeats.filter(card => card.kind === 'beat').map(card => {
        const left = Math.max(0,Math.min(100,((card.pageGoal || 1) / target) * 100));
        return `<button class="story-map-marker ${state.selectedStoryCard === card.id ? 'active' : ''}" data-story-map-beat="${card.id}" style="left:${left}%;--marker-color:${card.color}" title="p.${card.pageGoal || '—'} · ${escapeHtml(card.title)}"></button>`;
      }).join('');
      return `<section class="story-map-strip" aria-label="Story Map 页目标结构轨"><div class="story-map-head"><strong>剧本页码</strong><span>目标 ${target} 页 · 点击节点定位故事卡</span></div><div class="story-map-rail"><span class="story-map-lane-label">故事主线</span>${ticks.map(value => `<i class="story-map-tick" style="left:${value * 100}%"><span>${Math.round(value * target)}</span></i>`).join('')}${structures.map(value => `<i class="story-map-structure" style="left:${value * 100}%" title="结构参考点 · 第 ${Math.round(value * target)} 页"></i>`).join('')}${markers}</div></section>`;
    }

    function renderStoryCard(card) {
      const meta = card.kind === 'beat' ? `<div class="story-card-meta"><span class="page-goal">p.${card.pageGoal || '—'}</span><span>Scene ${escapeHtml(card.scenes || '—')}</span><span>${escapeHtml(card.plot || '主线')}</span></div>` : '';
      const ports = ['left','right','top','bottom'].map(port => `<button class="story-connect-port ${state.storyConnectFrom?.cardId === card.id && state.storyConnectFrom?.port === port ? 'active' : ''}" data-story-connect-port="${card.id}" data-port="${port}" title="按住拖拽：从${{left:'左',right:'右',top:'上',bottom:'下'}[port]}侧连接；落到空白新建卡片"></button>`).join('');
      return `<article class="story-card ${card.kind === 'sub' ? 'sub' : ''} ${state.selectedStoryCard === card.id ? 'selected' : ''}" data-story-card="${card.id}" style="left:${card.x}px;top:${card.y}px;width:${card.w}px;height:${card.h}px;--card-color:${card.color}"><div class="story-card-type">${escapeHtml(({ 'OPENING IMAGE':'开场画面','INCITING INCIDENT':'诱发事件','PROGRESSIVE COMPLICATION':'冲突升级','REVELATION':'信息揭示','MIDPOINT':'中点转折','ALL IS LOST':'至暗时刻','FINALE':'结局','FORESHADOW':'伏笔','CHARACTER QUESTION':'人物动机','WORLD RULE':'世界观','RELATIONSHIP BRANCH':'人物关系','SUB CARD':'支线卡','NEW BEAT':'故事节拍','AGENT DRAFT':'建议草稿','FROM IDEA':'来自灵感' })[card.type] || card.type)}</div>${card.kind === 'beat' ? `<span class="story-card-order">${String(card.order).padStart(2,'0')}</span>` : ''}<h3 contenteditable="true" data-beat-field="title" data-beat-id="${card.id}">${escapeHtml(card.title)}</h3><p contenteditable="true" data-beat-field="summary" data-beat-id="${card.id}">${escapeHtml(card.summary)}</p><span class="story-card-source">${escapeHtml(card.source || '自由创建')}</span>${meta}<button class="story-card-port" data-add-subcard="${card.id}" title="新增支线卡：创建一张与当前卡相连的卡片">＋</button>${ports}</article>`;
    }

    function storyPortLabel(port) {
      return ({ auto:'自动',left:'左',right:'右',top:'上',bottom:'下' })[port || 'auto'] || '自动';
    }

    function renderStoryConnectionTools() {
      if (state.storyConnectFrom) {
        const source = state.storyBeats.find(card => card.id === state.storyConnectFrom.cardId);
        return `<div class="story-connect-session"><span>连续连线源：<strong>${escapeHtml(source?.title || '卡片')}</strong> · 可点击多个目标</span><button data-finish-story-connect>完成 Esc</button></div>`;
      }
      if (state.selectedStoryEdge) {
        const edge = state.storyEdges.find(item => item.id === state.selectedStoryEdge);
        if (!edge) return '';
        return `<div class="story-edge-toolbar"><button data-story-edge-action="reverse">反转方向</button><button data-story-edge-action="from-port">起点 ${storyPortLabel(edge.fromPort)}</button><button data-story-edge-action="to-port">终点 ${storyPortLabel(edge.toPort)}</button><button data-story-edge-action="arrow">${edge.arrow === false ? '显示箭头' : '隐藏箭头'}</button><button data-story-edge-action="style">${(edge.dashed ?? edge.kind === 'branch') ? '改为实线' : '改为虚线'}</button><button data-story-edge-action="reset-bend">重置弧度</button><button class="danger" data-story-edge-action="delete">取消连线</button></div>`;
      }
      return '';
    }

    function renderStoryEdgeMenu() {
      if (!state.storyEdgeMenu || !state.selectedStoryEdge) return '';
      const edge = state.storyEdges.find(item => item.id === state.selectedStoryEdge);
      if (!edge) return '';
      return `<div class="story-edge-menu" style="left:${state.storyEdgeMenu.clientX}px;top:${state.storyEdgeMenu.clientY}px"><button data-story-edge-action="reverse"><span>反转连接方向</span><span>⇄</span></button><button data-story-edge-action="from-port"><span>切换起点端口</span><span>${storyPortLabel(edge.fromPort)}</span></button><button data-story-edge-action="to-port"><span>切换终点端口</span><span>${storyPortLabel(edge.toPort)}</span></button><button data-story-edge-action="arrow"><span>${edge.arrow === false ? '显示箭头' : '隐藏箭头'}</span><span>→</span></button><button data-story-edge-action="style"><span>${(edge.dashed ?? edge.kind === 'branch') ? '改为实线' : '改为虚线'}</span><span>⌁</span></button><button data-story-edge-action="reset-bend"><span>重置曲线弧度</span><span>0</span></button><button class="danger" data-story-edge-action="delete"><span>取消这条连线</span><span>⌫</span></button></div>`;
    }

    function workspaceIcon(name) {
      const paths = {select:'<path d="m5 3 14 10-7 1-3 7z"/>',note:'<path d="M4 4h16v11l-5 5H4zM15 20v-5h5M8 8h8M8 12h5"/>',connect:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h4v12h6"/>',grid:'<path d="M4 8h16M4 16h16M8 4v16M16 4v16"/>',align:'<rect x="3" y="8" width="4" height="8"/><rect x="10" y="8" width="4" height="8"/><rect x="17" y="8" width="4" height="8"/><path d="M3 20h18"/>'};
      return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.note}</svg>`;
    }
    function canvasHelp(kind) {
      return `<details class="canvas-menu"><summary class="canvas-action ghost" title="查看画布操作说明">操作说明</summary><div class="canvas-menu-popover">${kind === 'story' ? '<p><strong>移动与编辑</strong><br>拖动卡片边框移动；点击标题或正文编辑。</p><p><strong>点对点连线</strong><br>拖动卡片四边的连接点到另一张卡；拖到空白处创建支线卡。</p><p><strong>一对多与断开</strong><br>切到「连线」，点击源卡再选多个目标；按 Esc 结束。点击连线可改方向或删除。</p><p><strong>缩放</strong><br>Ctrl / ⌘ + 滚轮，或使用底部缩放按钮。</p>' : '<p><strong>随手记</strong><br>选择「便签」后点击画布空白处，也可以右键新建。</p><p><strong>添加标签</strong><br>在文字中输入 #人物、#对白 或自定义标签，退出编辑后自动识别。</p><p><strong>收集媒体</strong><br>上传图片、视频或音频，每个文件最大 2 MB；拖动图片或媒体卡的「移动」手柄调整位置。</p><p><strong>整理与撤销</strong><br>「按标签整理」按第一个标签分组；无标签的便签放入未分类。可撤销最近一次整理。</p>'}</div></details>`;
    }
    function canvasFooter(kind) {
      const story = kind === 'story', zoom = Math.round((story ? state.storyZoom || .72 : state.ideaZoom || .72)*100);
      const hint = story ? (state.storyTool === 'connect' ? '连线模式：点击源卡，再选择多个目标；Esc 结束' : '拖动边框移动 · 拖连接点到空白处创建支线') : (state.ideaTool === 'note' ? '便签模式：点击画布空白处放置便签' : state.ideaTool === 'connect' ? '连线模式：依次点击两张卡片的边框' : '右键新建便签 · 输入 # 添加标签');
      return `<footer class="canvas-status"><span class="canvas-status-copy">${hint}</span><div class="${story ? 'story' : 'idea'}-zoom" aria-label="画布缩放"><button data-canvas-action="${story ? 'story-' : ''}zoom-out" title="缩小画布" aria-label="缩小画布">−</button><span ${story ? 'data-story-zoom-label' : 'data-idea-zoom-label'}>${zoom}%</span><button data-canvas-action="${story ? 'story-' : ''}zoom-in" title="放大画布" aria-label="放大画布">＋</button><button data-canvas-action="${story ? 'story-' : ''}zoom-fit" title="缩放并居中显示全部卡片">适应</button></div></footer>`;
    }

    function renderStoryBeatBoard() {
      state.storyBeats.forEach(card => {card.h=Math.max(card.h,card.kind === 'beat' ? 244 : 220);card.w=Math.max(card.w,card.kind === 'beat' ? 260 : 220);});
      return `<section class="script-canvas-shell" aria-label="故事结构板">
        <header class="script-canvas-head"><div class="script-canvas-title"><strong>故事结构板</strong><span>串联故事节拍，让每条支线都有来处。</span></div>
        <div class="script-canvas-actions">${canvasHelp('story')}<details class="canvas-menu"><summary class="canvas-action" title="结构排版与示例功能">更多操作 ▾</summary><div class="canvas-menu-popover"><button data-canvas-action="align-story-chain" title="按当前编号将主线卡片排列成一行，支线位置保留">${workspaceIcon('align')} 整理主线</button><button data-canvas-action="undo-canvas-layout" ${state.canvasLayoutUndo?.kind === 'story' ? '' : 'disabled'}>撤销最近一次整理</button><button disabled title="当前原型尚未接入剧本解析，不能自动更新故事内容">从剧本更新 · 待接入</button><button data-canvas-action="analyze-beats" title="查看预置的结构诊断示例">${icons.spark} 结构诊断示例</button></div></details><button class="canvas-action primary" data-canvas-action="add-beat" title="添加一张主线故事节拍卡">${icons.plus} 新建故事卡</button></div></header>
        <div class="canvas-body"><div class="canvas-center"><details class="story-map-details" open><summary>故事页码轨 <span>查看故事节拍在剧本中的位置</span></summary>${renderStoryMap()}</details>${renderStoryConnectionTools()}<div class="canvas-frame"><nav class="story-canvas-tools" aria-label="故事结构工具"><span class="tool-group-label">画布工具</span><button class="story-tool ${state.storyTool === 'select' ? 'active' : ''}" data-story-tool="select" aria-pressed="${state.storyTool === 'select'}" title="选择卡片；拖动边框调整位置">${workspaceIcon('select')} 选择</button><button class="story-tool ${state.storyTool === 'connect' ? 'active' : ''}" data-story-tool="connect" aria-pressed="${state.storyTool === 'connect'}" title="先选源卡，再选多个目标；Esc 结束">${workspaceIcon('connect')} 连线</button><div class="story-tool-separator"></div><button class="story-tool ${state.storyGridSnap ? 'active' : ''}" data-story-grid-snap aria-pressed="${!!state.storyGridSnap}" title="开关网格吸附；开启后移动按网格对齐">${workspaceIcon('grid')} 吸附</button><button class="story-tool" data-canvas-action="align-story-chain" title="按故事顺序将主线卡排成一行">${workspaceIcon('align')} 整理主线</button></nav><div class="story-board-viewport"><div class="story-board ${state.storyTool === 'connect' ? 'connecting' : ''}" style="transform:scale(${state.storyZoom || .72})"><span class="story-chain-label">故事主线 · 按横向位置排列</span>${renderStoryEdges()}${state.storyBeats.map(renderStoryCard).join('')}</div></div>${renderStoryEdgeMenu()}</div>${canvasFooter('story')}</div>${renderCanvasAgent('beat')}</div></section>`;
    }

    function renderIdeaEdges() {
      return `<svg class="idea-edge-layer" viewBox="0 0 1800 1120" aria-hidden="true">${state.ideaEdges.map(edge => {
        const from = state.ideaNodes.find(node => node.id === edge.from), to = state.ideaNodes.find(node => node.id === edge.to);
        return from && to ? `<path class="idea-edge" data-idea-edge="${edge.from}:${edge.to}" d="${cardEdgePath(from,to)}"></path>` : '';
      }).join('')}</svg>`;
    }

    function renderIdeaTagPicker(node) {
      if (state.ideaTagMenu !== node.id) return '';
      const suggestions = allIdeaTags().filter(tag => !(node.tags || []).includes(tag));
      return `<div class="idea-tag-picker" data-tag-picker><input data-idea-tag-input="${node.id}" placeholder="# 输入 Tag，回车创建" autocomplete="off"><div class="idea-tag-suggestions">${suggestions.map(tag => `<button data-apply-idea-tag="${node.id}" data-tag-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div></div>`;
    }

    function renderIdeaNode(node) {
      const media = node.type === 'media';
      const tagBar = `<div class="idea-note-tags">${(node.tags || []).map(tag => `<button class="idea-tag-chip" data-remove-idea-tag="${node.id}" data-tag-value="${escapeHtml(tag)}" title="点击移除这个标签，保留便签文字">${escapeHtml(tag)}</button>`).join('')}<button class="idea-tag-trigger" data-toggle-idea-tags="${node.id}" title="添加标签：输入 # 后写标签名称"># 标签</button></div>`;
      const body = media
        ? `${tagBar}${node.mediaType === 'video' ? `<video controls draggable="false" src="${node.src || ''}"></video>` : node.mediaType === 'audio' ? `<audio controls draggable="false" src="${node.src || ''}"></audio>` : `<img draggable="false" src="${node.src || ''}" alt="${escapeHtml(node.text || '媒体灵感')}">`}<div class="idea-node-caption">${escapeHtml(node.text || '媒体灵感')}</div><button class="idea-media-drag-handle" data-idea-drag-handle title="拖动媒体卡片" aria-label="拖动媒体卡片">⠿ 移动</button>${renderIdeaTagPicker(node)}`
        : `${tagBar}<div class="idea-node-copy" contenteditable="true" data-idea-text="${node.id}">${escapeHtml(node.text)}</div>${renderIdeaTagPicker(node)}`;
      return `<article class="idea-node ${node.type} ${state.selectedIdea === node.id ? 'selected' : ''}" data-idea-node="${node.id}" style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px;--node-color:${node.color}"><button class="idea-node-remove" data-remove-idea="${node.id}" aria-label="删除灵感">×</button>${body}</article>`;
    }

    function renderIdeaLayoutGroups() {
      return state.ideaLayoutGroups.map(group => `<div class="idea-auto-group" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><span>${escapeHtml(group.tag)}</span></div>`).join('');
    }

    function renderIdeaContextMenu() {
      if (!state.ideaContextMenu) return '';
      return `<div class="canvas-context-menu" style="left:${state.ideaContextMenu.clientX}px;top:${state.ideaContextMenu.clientY}px"><button data-context-create-note>▤ 在这里创建便签</button><button data-canvas-action="upload-idea-media">${icons.upload} 上传媒体</button></div>`;
    }

    function renderIdeaCanvas() {
      return `<section class="script-canvas-shell" aria-label="灵感画布"><header class="script-canvas-head"><div class="script-canvas-title"><strong>灵感画布</strong><span>先留住想法，再让故事慢慢成形。</span></div><div class="script-canvas-actions">${canvasHelp('idea')}<button class="canvas-action" data-canvas-action="auto-arrange-ideas" title="按第一个标签分组排版；无标签放入未分类">${workspaceIcon('align')} 按标签整理</button>${state.canvasLayoutUndo?.kind === 'idea' ? '<button class="canvas-action ghost" data-canvas-action="undo-canvas-layout" title="恢复整理前的位置">撤销整理</button>' : ''}<button class="canvas-action primary" data-canvas-action="add-sticky" title="在当前视野中央添加便签">${icons.plus} 新建便签</button></div></header><div class="canvas-body"><div class="canvas-center"><div class="canvas-frame"><nav class="idea-toolbar" aria-label="灵感画布工具"><span class="tool-group-label">画布工具</span><button class="idea-tool ${state.ideaTool === 'select' ? 'active' : ''}" data-idea-tool="select" aria-pressed="${state.ideaTool === 'select'}" title="选择卡片；拖动边框或媒体画面移动">${workspaceIcon('select')} 选择</button><button class="idea-tool ${state.ideaTool === 'note' ? 'active' : ''}" data-idea-tool="note" aria-pressed="${state.ideaTool === 'note'}" title="选择后点击画布空白处创建便签">${workspaceIcon('note')} 便签</button><button class="idea-tool" data-canvas-action="upload-idea-media" title="上传图片、视频或音频，每个文件最大 2 MB">${icons.upload} 上传媒体</button><div class="idea-tool-separator"></div><button class="idea-tool ${state.ideaTool === 'connect' ? 'active' : ''}" data-idea-tool="connect" aria-pressed="${state.ideaTool === 'connect'}" title="依次点击两张卡片的边框，建立灵感关联">${workspaceIcon('connect')} 连线</button></nav><div class="idea-canvas-viewport"><div class="idea-canvas-surface" style="transform:scale(${state.ideaZoom || .72})">${renderIdeaLayoutGroups()}${renderIdeaEdges()}${state.ideaNodes.map(renderIdeaNode).join('')}</div></div>${renderIdeaContextMenu()}</div>${canvasFooter('idea')}</div></div></section>`;
    }

    function setStoryZoom(value, anchor = null) {
      const previous = state.storyZoom || .72;
      const next = Math.max(.2,Math.min(1.6,Math.round(value * 100) / 100));
      if (Math.abs(next - previous) < .001) return;
      const viewport = $('.story-board-viewport'), board = $('.story-board');
      if (!viewport || !board) { state.storyZoom = next; render(); return; }
      const rect = viewport.getBoundingClientRect();
      const screenX = (anchor?.clientX ?? rect.left + rect.width / 2) - rect.left;
      const screenY = (anchor?.clientY ?? rect.top + rect.height / 2) - rect.top;
      const worldX = (viewport.scrollLeft + screenX) / previous;
      const worldY = (viewport.scrollTop + screenY) / previous;
      state.storyZoom = next;
      board.style.transform = `scale(${next})`;
      const label = $('[data-story-zoom-label]');
      if (label) label.textContent = `${Math.round(next * 100)}%`;
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0,worldX * next - screenX);
        viewport.scrollTop = Math.max(0,worldY * next - screenY);
      });
      persistWorkspace();
    }

    function fitStoryZoom() { return fitCanvasContents('story'); }

    function handleStoryZoomWheel(event) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * .0025);
      setStoryZoom((state.storyZoom || .72) * factor,{ clientX:event.clientX,clientY:event.clientY });
    }

    function bindScriptCanvasInteractions() {
      const ideaViewport=$('.idea-canvas-viewport');
      if (ideaViewport) ideaViewport.addEventListener('wheel',e=>{if(e.ctrlKey || e.metaKey){e.preventDefault();setIdeaZoom((state.ideaZoom || .72)*Math.exp(-e.deltaY*.0025),e);}},{passive:false});
      const surface=$('.idea-canvas-surface');
      if(surface){surface.style.width=`${Math.max(1800,...state.ideaNodes.map(n=>n.x+n.w+80))}px`;surface.style.height=`${Math.max(1120,...state.ideaNodes.map(n=>n.y+n.h+80))}px`;}
      const storyBoard=$('.story-board');
      if(storyBoard){storyBoard.style.width=`${Math.max(2700,...state.storyBeats.map(n=>n.x+n.w+80))}px`;storyBoard.style.height=`${Math.max(1260,...state.storyBeats.map(n=>n.y+n.h+80))}px`;}
      const storyViewport = $('.story-board-viewport');
      if (storyViewport) storyViewport.addEventListener('wheel',handleStoryZoomWheel,{ passive:false });
      $$('[data-beat-field]').forEach(field => field.addEventListener('input', () => {
        const beat = state.storyBeats.find(item => item.id === field.dataset.beatId);
        if (beat) { beat[field.dataset.beatField] = field.innerText; markSaving(); }
      }));
      $$('[data-story-card]').forEach(card => {
        card.addEventListener('pointerdown', startStoryCardDrag);
        card.addEventListener('click', event => {
          if (event.target.closest('button,[contenteditable="true"]')) return;
          const id = card.dataset.storyCard;
          state.selectedStoryCard = id;
          state.selectedStoryEdge = null;
          if (state.storyTool === 'connect') connectStoryCard(id,'auto');
        });
      });
      $$('[data-story-connect-port]').forEach(port => port.addEventListener('pointerdown',startStoryPortDrag));
      $$('[data-story-edge-handle]').forEach(handle => { handle.addEventListener('pointerdown',startStoryEdgeBend);handle.addEventListener('click',event => event.stopPropagation()); });
      $$('[data-idea-text]').forEach(field => field.addEventListener('input', () => {
        const node = state.ideaNodes.find(item => item.id === field.dataset.ideaText);
        if (node) { node.text = field.innerText; markSaving(); }
      }));
      $$('[data-idea-text]').forEach(field => field.addEventListener('blur', () => syncHashTags(field.dataset.ideaText)));
      $$('[data-idea-node]').forEach(nodeElement => {
        nodeElement.addEventListener('pointerdown', startIdeaNodeDrag);
        nodeElement.addEventListener('click', event => {
          if (event.target.closest('button,[contenteditable="true"],audio,video')) return;
          const id = nodeElement.dataset.ideaNode;
          state.selectedIdea = id;
          if (state.ideaTool === 'connect') {
            if (!state.ideaConnectFrom) { state.ideaConnectFrom = id; render(); }
            else if (state.ideaConnectFrom !== id && !state.ideaEdges.some(edge => edge.from === state.ideaConnectFrom && edge.to === id)) { state.ideaEdges.push({ id:uid('idea-edge'),from:state.ideaConnectFrom,to:id }); state.ideaConnectFrom = null; render(); }
          }
        });
      });
    }

    function refreshCanvasEdges(kind) {
      if (kind === 'story') {
        $$('[data-story-edge-path]').forEach(path => {
          const edge = state.storyEdges.find(item => item.id === path.dataset.storyEdgePath);
          if (!edge) return;
          const geometry = storyEdgeGeometry(state.storyBeats.find(card => card.id === edge.from),state.storyBeats.find(card => card.id === edge.to),edge);
          if (geometry) path.setAttribute('d',geometry.path);
        });
        $$('[data-story-edge-handle]').forEach(handle => {
          const edge = state.storyEdges.find(item => item.id === handle.dataset.storyEdgeHandle);
          if (!edge) return;
          const geometry = storyEdgeGeometry(state.storyBeats.find(card => card.id === edge.from),state.storyBeats.find(card => card.id === edge.to),edge);
          if (geometry) { handle.setAttribute('cx',geometry.handle.x); handle.setAttribute('cy',geometry.handle.y); }
        });
      }
      else $$('[data-idea-edge]').forEach(path => { const [fromId,toId] = path.dataset.ideaEdge.split(':'); path.setAttribute('d',cardEdgePath(state.ideaNodes.find(node => node.id === fromId),state.ideaNodes.find(node => node.id === toId))); });
    }

    function storyWirePreviewPath(card,port,x,y) {
      const start = cardPortPoint(card,port),dx = x - start.x,dy = y - start.y,distance = Math.max(1,Math.hypot(dx,dy));
      const curve = Math.max(44,Math.min(180,distance * .42)),endControl = { x:x - dx / distance * curve,y:y - dy / distance * curve };
      return `M ${start.x} ${start.y} C ${start.x + start.vx * curve} ${start.y + start.vy * curve}, ${endControl.x} ${endControl.y}, ${x} ${y}`;
    }

    function clearStoryWireTargets() {
      $$('.story-card.wire-target,.story-connect-port.wire-target').forEach(element => element.classList.remove('wire-target'));
    }

    function startStoryPortDrag(event) {
      if (event.button !== 0) return;
      const element = event.currentTarget,sourceId = element.dataset.storyConnectPort,fromPort = element.dataset.port;
      const source = state.storyBeats.find(card => card.id === sourceId),board = element.closest('.story-board'),preview = $('[data-story-wire-preview]',board);
      if (!source || !board || !preview) return;
      event.stopPropagation();
      const startX = event.clientX,startY = event.clientY,wasConnecting = board.classList.contains('connecting');
      let moved = false;
      board.classList.add('connecting','wire-dragging');
      element.classList.add('active');
      element.setPointerCapture(event.pointerId);

      const pointInBoard = pointerEvent => {
        const rect = board.getBoundingClientRect();
        const zoom = state.storyZoom || .72;
        return { x:(pointerEvent.clientX - rect.left) / zoom,y:(pointerEvent.clientY - rect.top) / zoom,inside:pointerEvent.clientX >= rect.left && pointerEvent.clientX <= rect.right && pointerEvent.clientY >= rect.top && pointerEvent.clientY <= rect.bottom };
      };
      const move = moveEvent => {
        if (!moved && Math.hypot(moveEvent.clientX - startX,moveEvent.clientY - startY) < 4) return;
        moved = true;moveEvent.preventDefault();
        const point = pointInBoard(moveEvent);
        preview.setAttribute('d',storyWirePreviewPath(source,fromPort,point.x,point.y));
        preview.classList.add('visible');
        clearStoryWireTargets();
        const hit = document.elementFromPoint(moveEvent.clientX,moveEvent.clientY);
        const targetPort = hit?.closest?.('[data-story-connect-port]');
        const targetCard = hit?.closest?.('[data-story-card]');
        if (targetPort && targetPort.dataset.storyConnectPort !== sourceId) targetPort.classList.add('wire-target');
        else if (targetCard && targetCard.dataset.storyCard !== sourceId) targetCard.classList.add('wire-target');
      };
      const cleanup = () => {
        element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',cancel);
        element.classList.remove('active');preview.classList.remove('visible');preview.setAttribute('d','');clearStoryWireTargets();
        board.classList.remove('wire-dragging');if (!wasConnecting) board.classList.remove('connecting');
      };
      const resolveDrop = upEvent => {
        const point = pointInBoard(upEvent),hit = document.elementFromPoint(upEvent.clientX,upEvent.clientY);
        const targetPort = hit?.closest?.('[data-story-connect-port]'),targetCard = hit?.closest?.('[data-story-card]');
        let edge = null,newCard = null;
        if (targetPort && targetPort.dataset.storyConnectPort !== sourceId) edge = createStoryFlowEdge(sourceId,targetPort.dataset.storyConnectPort,fromPort,targetPort.dataset.port);
        else if (targetCard && targetCard.dataset.storyCard !== sourceId) edge = createStoryFlowEdge(sourceId,targetCard.dataset.storyCard,fromPort,'auto');
        else if (point.inside) ({ card:newCard,edge } = createStorySubCardFromWire(sourceId,point.x,point.y,fromPort));
        if (!edge) return false;
        state.storyConnectFrom = null;state.storyTool = 'select';state.storyEdgeMenu = null;
        state.selectedStoryEdge = newCard ? null : edge.id;state.selectedStoryCard = newCard?.id || null;
        render();
        if (newCard) requestAnimationFrame(() => $(`[data-beat-field="title"][data-beat-id="${newCard.id}"]`)?.focus());
        showToast(newCard ? '已在落点创建支线卡并完成连接' : '已通过端口完成点对点连接');
        return true;
      };
      const up = upEvent => {
        if (moved) {
          state.suppressStoryPortClick = true;
          resolveDrop(upEvent);
          setTimeout(() => { state.suppressStoryPortClick = false; },0);
        }
        cleanup();
      };
      const cancel = () => { if (moved) { state.suppressStoryPortClick = true;setTimeout(() => { state.suppressStoryPortClick = false; },0); }cleanup(); };
      element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',cancel);
    }

    function startStoryEdgeBend(event) {
      if (event.button !== 0) return;
      const edge = state.storyEdges.find(item => item.id === event.currentTarget.dataset.storyEdgeHandle);
      const from = edge && state.storyBeats.find(card => card.id === edge.from),to = edge && state.storyBeats.find(card => card.id === edge.to);
      const geometry = edge && storyEdgeGeometry(from,to,edge);
      if (!edge || !geometry) return;
      event.preventDefault();event.stopPropagation();
      const element = event.currentTarget,startX = event.clientX,startY = event.clientY,origin = Number(edge.bend) || 0,zoom = state.storyZoom || .72;
      element.setPointerCapture(event.pointerId);
      const move = moveEvent => {
        const projected = ((moveEvent.clientX - startX) * geometry.handle.normalX + (moveEvent.clientY - startY) * geometry.handle.normalY) / zoom;
        edge.bend = Math.max(-360,Math.min(360,origin + projected));
        refreshCanvasEdges('story');
      };
      const up = () => { element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);persistWorkspace(); };
      element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);
    }

    function startStoryCardDrag(event) {
      if (event.button !== 0 || state.storyTool === 'connect' || event.target.closest('button,[contenteditable="true"]')) return;
      const element = event.currentTarget, card = state.storyBeats.find(item => item.id === element.dataset.storyCard);
      if (!card) return;
      event.preventDefault(); state.selectedStoryCard = card.id;
      $$('.story-card').forEach(item => item.classList.toggle('selected',item === element));
      const startX = event.clientX,startY = event.clientY,originX = card.x,originY = card.y,zoom = state.storyZoom || .72;
      element.setPointerCapture(event.pointerId);
      const move = moveEvent => { card.x = Math.max(0,originX + (moveEvent.clientX - startX) / zoom); card.y = Math.max(0,originY + (moveEvent.clientY - startY) / zoom); element.style.left = `${card.x}px`; element.style.top = `${card.y}px`; refreshCanvasEdges('story'); };
      const up = () => {
        element.removeEventListener('pointermove',move);
        element.removeEventListener('pointerup',up);
        if (state.storyGridSnap) { card.x = Math.round(card.x / 20) * 20; card.y = Math.round(card.y / 20) * 20; }
        if (card.kind === 'beat') normalizeStoryOrderByPosition();
        render();
      };
      element.addEventListener('pointermove',move); element.addEventListener('pointerup',up);
    }

    function startIdeaNodeDrag(event) {
      const dragHandle = event.target.closest('[data-idea-drag-handle]');
      if (event.button !== 0 || state.ideaTool === 'connect' || (!dragHandle && event.target.closest('button,input,[contenteditable="true"],audio,video'))) return;
      const element = event.currentTarget;
      const node = state.ideaNodes.find(item => item.id === element.dataset.ideaNode);
      if (!node) return;
      event.preventDefault();
      state.selectedIdea = node.id;
      $$('.idea-node').forEach(item => item.classList.toggle('selected', item === element));
      const startX = event.clientX, startY = event.clientY, originX = node.x, originY = node.y, zoom = state.ideaZoom || .72;
      element.setPointerCapture(event.pointerId);
      const move = moveEvent => { node.x = Math.max(0, originX + (moveEvent.clientX - startX) / zoom); node.y = Math.max(0, originY + (moveEvent.clientY - startY) / zoom); element.style.left = `${node.x}px`; element.style.top = `${node.y}px`; refreshCanvasEdges('idea'); };
      const up = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up); if (state.ideaLayoutGroups.length) { state.ideaLayoutGroups = []; render(); } else persistWorkspace(); };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', up);
    }

    function renderDocument(id, options = {}) {
      const normalized = id === 'episodeOutline' ? 'outline' : id === 'episodeScript' ? 'script' : id;
      state.renderContext = { docId: id, normalized, slot: options.slot || 'left', fileId: options.fileId || null };
      let result;
      if (normalized === 'cover') result = renderCover(options);
      else if (normalized === 'synopsis') result = renderSynopsis(options);
      else if (normalized === 'outline') result = renderOutline(options, id === 'episodeOutline');
      else if (normalized === 'treatment') result = renderTreatment(options);
      else if (normalized === 'styleTreatment') result = renderStyleTreatment(options);
      else if (normalized === 'script') result = renderScript(options);
      else if (normalized === 'production' || normalized === 'scriptOrder') result = renderScriptOrder(options);
      else if (normalized === 'locationBreakdown') result = renderLocationBreakdown(options);
      else if (normalized === 'dailyReport') result = renderDailyReport(options);
      else if (normalized === 'dailySchedule') result = renderDailySchedule(options);
      else if (normalized === 'productionLedger') result = renderProductionLedger(options);
      else if (normalized === 'storyboard') result = renderStoryboard(options);
      else result = renderCustom(id, options);
      state.renderContext = null;
      return result;
    }

    function paperWrap(content, options = {}) {
      const classes = ['paper'];
      if (options.wide) classes.push('wide');
      if (options.cover) classes.push('cover-page');
      if (options.production) classes.push('production-paper');
      const context = state.renderContext || {};
      if (context.normalized === 'script') classes.push('script-paper', state.scriptLayout === 'chinese' ? 'chinese-layout' : 'american-layout');
      if (state.paginationMode === 'continuous') classes.push('continuous-paper');
      if ((context.slot || 'left') === state.selectedPageSlot) classes.push('selected-paper');
      return `<article class="${classes.join(' ')}" data-paper data-page-slot="${context.slot || 'left'}" data-page-type="${context.docId || ''}" data-page-file="${context.fileId || ''}"><button class="page-drag-handle" data-page-drag draggable="true" aria-label="选中或拖拽这张稿纸" title="单击选中 · 按住拖拽"><svg viewBox="0 0 24 24" class="icon sm"><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg></button>${content}<div class="paper-page-number">${options.page || '1'}</div></article>`;
    }

    function episodeControl(label = '第 1 集') {
      if (state.mode !== 'series') return '<select class="tiny-select" aria-label="选择电影章节"><option>第一章</option><option>第二章</option><option>第三章</option></select>';
      return `<select class="tiny-select" data-episode-select aria-label="选择集数">${[1,2,3,4,5,6,7,8].map(ep => `<option value="${ep}" ${ep === state.episode ? 'selected' : ''}>第 ${ep} 集</option>`).join('')}</select>`;
    }

    function renderCover(options) {
      // 新剧集的封面（file.blank）从空白开始，只显示占位符；示例项目的封面保留演示文案
      const file = findFile(state.renderContext?.fileId || options?.fileId) || latestFile('cover');
      const d = file?.blank ? { title: '', author: '', logline: '' } : { title: '霸道总裁别爱上我家猫', author: '编剧 · 李孟哲 Koi', logline: '一个拒绝被定义的女孩，意外继承了能读取人类记忆的猫，也因此被卷进一场关于选择与自由的城市阴谋。' };
      return paperWrap(`
        ${paperDocTabs('cover')}
        <div class="cover-type">${state.mode === 'film' ? 'FEATURE FILM' : 'SERIES'}</div>
        <div class="cover-title" contenteditable="true" spellcheck="false" data-placeholder="剧本标题">${d.title}</div>
        <div class="cover-author" contenteditable="true" spellcheck="false" data-placeholder="编剧 · 姓名">${d.author}</div>
        <div class="cover-logline"><span>一句话故事 · LOGLINE</span><div contenteditable="true" spellcheck="false" data-placeholder="用一句话概括主角、目标与冲突">${d.logline}</div></div>
      `, { cover: true, page: '封面' });
    }

    function renderSynopsis(options) {
      return paperWrap(`
        <div class="paper-kicker">创作资料 · 自动保存</div>
        <h1 contenteditable="true">故事梗概</h1>
        <p class="doc-lead" contenteditable="true">梦雨一直相信，记忆是唯一不该被买卖的东西。直到一只名叫“披萨”的猫闯进她的生活——它不仅会说话，还能听见陌生人最想遗忘的那段记忆。</p>
        <p contenteditable="true">在一次失败的记忆修复任务中，梦雨发现城市里正有一家公司通过“情绪适配”技术复制人的选择。她被迫与曾经背叛自己的吴老师重新合作，从被篡改的片段里寻找真相。</p>
        <p contenteditable="true">越接近核心，梦雨越意识到：她最确信的童年也可能是一段被写好的故事。最终，她必须决定，是恢复所有人的真实记忆，还是保留那些让人得以活下去的谎言。</p>
        <h2>创作意图</h2>
        <p contenteditable="true">这是一个关于“人是否有权选择自己的过去”的都市奇幻故事。悬疑推进是外壳，人物关系与选择的代价是核心。</p>
        <div class="word-count"><span>742 字</span><span>最后编辑 · 刚刚</span></div>
      `, { page: '1' });
    }

    function renderOutline(options, episodic = false) {
      const title = episodic || state.mode === 'series' ? `第 ${state.episode} 集大纲` : '故事大纲';
      return paperWrap(`
        <div class="paper-kicker">${episodic ? `EPISODE ${String(state.episode).padStart(2, '0')}` : 'STORY STRUCTURE'}</div>
        <h1 contenteditable="true">${title}</h1>
        <h2>开端 · 被闯入的日常</h2>
        <p contenteditable="true">梦雨在记忆修复工作室接下一个匿名委托。夜里回家时，她发现披萨坐在门口，脖子上挂着一枚属于失踪客户的储存芯片。</p>
        <h2>发展 · 错误的同盟</h2>
        <p contenteditable="true">芯片将她带回吴老师的实验室。两人互不信任，却都发现同一组记忆被重复写入了不同的人生。披萨成为唯一能识别原始情绪的人。</p>
        <h2>转折 · 记忆里的自己</h2>
        <p contenteditable="true">梦雨在档案中看见年幼的自己。她意识到这不是第一次追查真相，而是第一次成功记住自己曾经追查过。</p>
        <h2>结局 · 选择留下什么</h2>
        <p contenteditable="true">梦雨没有摧毁系统，而是公开了修改记录。所有人获得了恢复的权利，也必须承担知道真相的后果。</p>
        <div class="word-count"><span>${episodic ? '本集 8 场' : '四幕 · 36 节拍'}</span><span>最后编辑 · 1 天前</span></div>
      `, { page: episodic ? `EP ${state.episode}` : '1' });
    }

    function renderTreatment() {
      return paperWrap(`
        <div class="paper-kicker">TREATMENT · 草稿</div>
        <h1 contenteditable="true">故事阐述</h1>
        <p class="doc-lead" contenteditable="true">影片从一场没有被看见的雨开始。我们先听见雨刷，再看见被雨切碎的城市，最后才看见坐在副驾的梦雨。</p>
        <p contenteditable="true">影像不把记忆做成闪回，而把它留在现实空间的细微错位里：一盏不该亮着的灯、一句别人先说完的台词、镜面里提前半拍的动作。观众和梦雨一样，直到最后才确定哪些是真相。</p>
        <h2>人物与关系</h2>
        <p contenteditable="true">梦雨和吴老师的关系不是师徒和解，而是两个都相信自己在保护对方的人，逐渐承认保护也可能是一种控制。披萨不是喜剧配角，它承担着最直接的情绪判断。</p>
        <h2>视听方向</h2>
        <p contenteditable="true">前半段保持观察距离，以车窗、玻璃、监控屏幕制造观看层级；后半段逐渐减少遮挡，让人物必须在同一空间里直面选择。</p>
        <div class="word-count"><span>1,126 字</span><span>草稿 · 未完成</span></div>
      `, { page: '1' });
    }

    function renderStyleTreatment() {
      return paperWrap(`
        <div class="style-header">
          <div><h1 contenteditable="true">风格阐述</h1><div class="ledger-subtitle">Agent vision specification · 这是生成与验收共同使用的视觉事实源，不是只给人阅读的情绪散文。</div></div>
          <span class="style-version">VISION SPEC · v0.4 · 已锁定</span>
        </div>
        <div class="style-thesis" contenteditable="true">视觉北极星：城市像一段被反复覆盖的记忆——冷静、潮湿、秩序严密；每个反射面都保留人物尚未承认的情绪，让真实与复制品始终同时存在于画面里。</div>
        <div class="agent-spec-strip" aria-label="Agent 执行上下文">
          <div><span>Output target</span><strong>写实都市奇幻 · 电影质感</strong></div>
          <div><span>Invariant</span><strong>真实空间先于未来感装饰</strong></div>
          <div><span>Agent reads</span><strong>规则 → 资产 ID → 场景变量 → 验收</strong></div>
        </div>
        <section class="style-section">
          <h2>色彩与材质</h2>
          <div class="palette-row" aria-label="影片色板">
            <div class="palette-swatch" style="background:#182426">夜雨墨青</div>
            <div class="palette-swatch" style="background:#41676a">记忆蓝绿</div>
            <div class="palette-swatch light" style="background:#b8c7c4">玻璃冷灰</div>
            <div class="palette-swatch" style="background:#8f4c43">危险锈红</div>
            <div class="palette-swatch light" style="background:#ddd2b8">残留暖光</div>
          </div>
        </section>
        <section class="style-section">
          <h2>不可漂移的影像语法</h2>
          <div class="style-rule-grid">
            <div class="style-rule"><strong>画幅与构图</strong><p contenteditable="true">2.00:1。人物常被门框、车窗和屏幕二次切割；关键选择发生时，遮挡逐步退出。</p></div>
            <div class="style-rule"><strong>镜头与运动</strong><p contenteditable="true">28 / 40 / 75 mm 为主。前半段稳定观察、克制横移；记忆失控后才允许焦点转移与轻微手持。</p></div>
            <div class="style-rule"><strong>光线</strong><p contenteditable="true">动机光来自真实空间，不用无来源的轮廓光。冷光负责秩序，残留钨丝暖光负责人物关系。</p></div>
            <div class="style-rule"><strong>材质与颗粒</strong><p contenteditable="true">潮湿玻璃、磨损金属和旧显示屏形成触感；数字记忆不做透明全息，而像物理介质一样有重量。</p></div>
            <div class="style-rule"><strong>表演与人物连续性</strong><p contenteditable="true">情绪主要落在视线、停顿和手部动作；同一场景沿用角色资产的脸型、发型、年龄、服装层级与磨损状态。</p></div>
            <div class="style-rule"><strong>空间与时间连续性</strong><p contenteditable="true">保持门窗方向、主光方位、雨量与地面湿度连续；除非剧本标记记忆错位，不改变空间拓扑。</p></div>
          </div>
        </section>
        <section class="style-section">
          <h2>生产资产与引用 ID</h2>
          <div class="style-assets">
            <div class="style-asset-row"><strong>CHR-MENGYU-03</strong><span contenteditable="true">梦雨：干净克制的轮廓，旧灰蓝风衣；情绪留在眼神与手部动作，禁止高饱和纯色服装。</span><span class="style-asset-link">角色主资产</span></div>
            <div class="style-asset-row"><strong>LOC-CAR-RAIN-02</strong><span contenteditable="true">雨夜车内：旧轿车、右侧街灯、湿玻璃反射；主光方位固定，连续镜头沿用雨量等级 R2。</span><span class="style-asset-link">场 02 已引用</span></div>
            <div class="style-asset-row"><strong>PROP-MEM-CHIP-01</strong><span contenteditable="true">记忆芯片：银灰金属、磨砂半透明保护层、边角有实际磨损；禁止透明发光 HUD。</span><span class="style-asset-link">道具主资产</span></div>
          </div>
        </section>
        <section class="style-section">
          <h2>Agent Prompt 组装规则</h2>
          <div class="prompt-spec">
            <div class="prompt-spec-row"><strong>固定前缀</strong><code contenteditable="true">cinematic live action, grounded urban fantasy, motivated practical lighting, tactile worn materials, restrained performance</code></div>
            <div class="prompt-spec-row"><strong>场景变量</strong><code contenteditable="true">[角色资产 ID] + [地点资产 ID] + [景别/机位/运动] + [动作节拍] + [主光方位] + [连续性状态]</code></div>
            <div class="prompt-spec-row"><strong>负面约束</strong><code contenteditable="true">no floating HUD, no cyberpunk neon wash, no plastic skin, no random costume change, no unmotivated rim light, no spatial discontinuity</code></div>
          </div>
        </section>
        <section class="style-section">
          <h2>禁止项与验收</h2>
          <div class="avoid-list"><span class="avoid-item">无动机霓虹</span><span class="avoid-item">透明悬浮 HUD</span><span class="avoid-item">过度青橙</span><span class="avoid-item">无差别浅景深</span><span class="avoid-item">为炫技而运动</span><span class="avoid-item">过度光滑的 AI 质感</span></div>
          <div class="validation-list" style="margin-top:14px">
            <div class="validation-item">角色脸型、发型、服装与引用资产一致</div>
            <div class="validation-item">主光方向、雨量和空间方位连续</div>
            <div class="validation-item">镜头选择服务当前叙事节拍</div>
            <div class="validation-item">画面未触发任何禁止项</div>
          </div>
        </section>
        <div class="word-count"><span>Agent 可读 · 3 个资产引用 · 4 项验收</span><span>规范版本 v0.4 · 刚刚</span></div>
      `, { wide: true, page: '1 / 4' });
    }

    const allAssets = () => Object.entries(assetCatalog).flatMap(([type, assets]) => assets.map(asset => ({ ...asset, type })));
    const assetById = id => allAssets().find(asset => asset.id === id) || null;
    const assetByName = name => allAssets().find(asset => asset.name === name) || null;
    const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function hasRecognizedScriptAssets(fileId){return state.assetRecognition?.[fileId]?.version===1;}
    function assetHighlightsEnabled(fileId){return !!(hasRecognizedScriptAssets(fileId)&&(state.assetRecognition[fileId].highlightsEnabled??state.assetsRecognized));}
    function renderRecognizeAssetsButton(fileId){
      const recognized=hasRecognizedScriptAssets(fileId),active=assetHighlightsEnabled(fileId);
      return `<button type="button" class="recognize-assets-button ${active?'active':''}" data-recognize-assets data-no-tip ${recognized?`role="switch" aria-checked="${active}" aria-description="在剧本中高亮显示已识别的资产"`:'aria-haspopup="dialog"'} data-source-file-id="${escapeHtml(fileId||'')}" aria-label="识别资产"><svg viewBox="0 0 24 24" class="icon sm"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><circle cx="12" cy="12" r="3"/><path d="M12 7v2M12 15v2M7 12h2M15 12h2"/></svg>识别资产${recognized?'<span class="asset-visibility-track" aria-hidden="true"></span>':''}</button>`;
    }
    function renderAssetText(text, contextId) {
      const fileId=Object.keys(state.assetRecognition||{}).find(id=>contextId.startsWith(id+':'));
      if (!assetHighlightsEnabled(fileId)) return escapeHtml(text);
      const blockId=contextId.slice(fileId.length+1),record=state.assetRecognition[fileId],byName=new Map();
      (record.assetIds||[]).forEach(id=>{
        const asset=assetById(id);if(!asset)return;
        const evidence=asset.extractions?.[record.sourceKey];
        if(!evidence?.sourceIds?.includes(blockId))return;
        [asset.name,...(asset.aliases||[])].filter(Boolean).forEach(name=>{if(!byName.has(name))byName.set(name,asset);});
      });
      const names=[...byName.keys()].sort((a,b)=>b.length-a.length);
      if(!names.length)return escapeHtml(text);
      const pattern = new RegExp(names.map(escapeRegExp).join('|'), 'g');
      let cursor = 0;
      let occurrence = 0;
      let result = '';
      text.replace(pattern, (name, offset) => {
        result += escapeHtml(text.slice(cursor, offset));
        const original = byName.get(name);
        const instance = `${contextId}-${occurrence++}-${original.id}`;
        const asset = assetById(state.assetOverrides[instance]) || original;
        result += `<span class="asset-token ${asset.type}" data-asset-token data-asset-id="${escapeHtml(asset.id)}" data-asset-type="${asset.type}" data-asset-instance="${escapeHtml(instance)}" role="button" tabindex="0" aria-haspopup="dialog" aria-controls="asset-hover-card" aria-expanded="false">${escapeHtml(state.assetOverrides[instance]?asset.name:name)}</span>`;
        cursor = offset + name.length;
        return name;
      });
      return result + escapeHtml(text.slice(cursor));
    }

    // 分镜来源高亮仅存在本次页面交互中，不写入文稿或工作区存储。
    let shotSourceHighlight = null;
    function renderScriptBlock(blockId, text, defaultFormat = 'action', options = {}) {
      const fileId = state.renderContext?.fileId || 'script';
      const formatType = state.formatAssignments[`${fileId}:${blockId}`] || state.formatAssignments[blockId] || defaultFormat;
      const format = screenplayFormats.find(item => item.id === formatType) || screenplayFormats[1];
      const classes = ['script-block'];
      if (format.className) classes.push(format.className);
      if (options.extraClass) classes.push(options.extraClass);
      if (state.selectedScriptId === blockId) classes.push('selected');
      if (state.locatedScriptId === blockId) classes.push('located');
      if (shotSourceHighlight?.visible && shotSourceHighlight.fileId === fileId && shotSourceHighlight.ids.includes(blockId)) {
        classes.push('shot-source-highlight');
        if (blockId === shotSourceHighlight.ids[0]) classes.push('shot-source-start');
      }
      if (!String(text || '').trim()) classes.push('is-empty');
      return `<div class="${classes.join(' ')}" ${options.domId ? `id="${options.domId}"` : ''} data-script-id="${blockId}" data-format-type="${formatType}" data-placeholder="${SCRIPT_PLACEHOLDER[formatType] || ''}">${String(text || '').trim() ? renderAssetText(text, `${fileId}:${blockId}`) : '<br>'}</div>`;
    }

    function renderSceneHeading(sceneId, domId) {
      const scene = state.scenes[sceneId];
      return renderScriptBlock(`${sceneId}-heading`, `${scene.interior}. ${scene.location} - ${scene.time}`, 'scene', { domId, extraClass: 'scene-heading-text' });
    }

    function renderCharacterBlock(blockId) {
      return renderScriptBlock(blockId, state.characterAssignments[blockId] || '选择人物', 'character');
    }

    function paperDocTabs(active) {
      const layoutName = state.scriptLayout === 'chinese' ? '中式剧本' : '美式剧本';
      return `<div class="paper-doc-tabs" role="tablist" aria-label="切换封面或剧本"><button role="tab" aria-selected="${active === 'cover'}" class="${active === 'cover' ? 'active' : ''}" data-paper-doc="cover">${icons.cover}封面</button><span class="paper-doc-split ${active === 'script' ? 'active' : ''}"><button role="tab" aria-selected="${active === 'script'}" class="${active === 'script' ? 'active' : ''}" data-paper-doc="script">${icons.script}剧本</button><button class="paper-doc-format" data-script-format-menu aria-haspopup="menu" aria-expanded="false" aria-label="切换剧本格式（当前：${layoutName}）">${icons.chevron}</button></span></div>`;
    }

    function renderScriptTemplate(options = {}) {
      return paperWrap(`
        <div class="script-meta">
          ${paperDocTabs('script')}
          <div class="script-meta-controls">
            <button class="link-toggle ${state.storyboardEnabled ? 'on' : ''}" data-toggle-storyboard data-source-file-id="${escapeHtml(options.fileId||state.renderContext?.fileId||'')}" aria-haspopup="dialog">${icons.link} 识别分镜</button>
            ${renderRecognizeAssetsButton(options.fileId||state.renderContext?.fileId)}
          </div>
        </div>
        ${renderSceneHeading('scene1', 'scene-1')}
        <div class="script-body">
          ${renderScriptBlock('s1', '雨打在挡风玻璃上。雨刷一下下扫过，刮不干净。')}
          ${renderScriptBlock('s2', '梦雨坐在副驾，膝盖上放着一份文件，但她没有看。她看着窗外模糊成一团的街灯。')}
          ${renderCharacterBlock('s4')}
          ${renderScriptBlock('s5', '搜查科新来的侵入者。全 AI 判定，一你搭档。', 'dialogue')}
          ${renderCharacterBlock('s6')}
          ${renderScriptBlock('s7', '所以我就是工具。', 'dialogue')}
          ${renderScriptBlock('s3', '前景越过肩拍梦雨，后景吴老师在前排。他说出“适配者就是工具”时，梦雨的目光从窗外收回，短暂看了他一眼——但吴老师没有看她。')}
          ${renderScriptBlock('s7p', '（车门解锁声）', 'paren')}
          ${renderScriptBlock('s8', '梦雨推门下车。远处商场的冷光切进车内，吴老师停顿半拍才跟上。')}
        </div>
        <div style="margin-top:54px">${renderSceneHeading('scene2', 'scene-2')}</div>
        <div class="script-body">
          ${renderScriptBlock('s9', '卷帘门只升到一半。披萨从缝隙里钻出来，嘴里叼着一枚银色的记忆芯片。')}
        </div>
      `, { page: state.mode === 'film' ? '7' : `${state.episode} · 7` });
    }

    // ===== 剧本块模型：file.scriptBlocks = [{id, type, text}]，沿用原有块 id =====
