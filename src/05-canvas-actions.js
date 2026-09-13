    function finishStoryConnect() {
      state.storyConnectFrom = null;
      state.storyTool = 'select';
      render();
    }

    function deleteStoryEdge(edgeId = state.selectedStoryEdge) {
      if (!edgeId) return;
      state.storyEdges = state.storyEdges.filter(edge => edge.id !== edgeId);
      state.selectedStoryEdge = null;
      state.storyEdgeMenu = null;
      render();
      showToast('连线已取消，卡片内容保留');
    }

    function applyStoryEdgeAction(action) {
      const edge = state.storyEdges.find(item => item.id === state.selectedStoryEdge);
      if (!edge) return;
      if (action === 'delete') return deleteStoryEdge(edge.id);
      if (action === 'reverse') {
        [edge.from,edge.to] = [edge.to,edge.from];
        [edge.fromPort,edge.toPort] = [edge.toPort || 'auto',edge.fromPort || 'auto'];
        edge.bend = -(Number(edge.bend) || 0);
      }
      const ports = ['auto','right','bottom','left','top'];
      if (action === 'from-port') edge.fromPort = ports[(ports.indexOf(edge.fromPort || 'auto') + 1) % ports.length];
      if (action === 'to-port') edge.toPort = ports[(ports.indexOf(edge.toPort || 'auto') + 1) % ports.length];
      if (action === 'arrow') edge.arrow = edge.arrow === false;
      if (action === 'style') edge.dashed = !(edge.dashed ?? edge.kind === 'branch');
      if (action === 'reset-bend') edge.bend = 0;
      state.storyEdgeMenu = null;
      render();
    }

    function addStoryBeat() {
      const mainCards = state.storyBeats.filter(card => card.kind === 'beat').sort((a,b) => a.order - b.order);
      const previous = mainCards.at(-1);
      const card = { id:uid('beat'),kind:'beat',parentId:null,order:mainCards.length + 1,pageGoal:Math.min(state.storyTargetPages || 110,(previous?.pageGoal || 0) + 12),x:previous ? previous.x + 300 : 180,y:previous ? previous.y : 420,w:238,h:178,act:'act3',type:'NEW BEAT',title:'未命名节拍',summary:'写下这里发生了什么变化，以及它为什么必须存在。',scenes:'待关联',plot:'A 线',characters:'—',shift:'—',color:'#858b87',source:'自由创建' };
      state.storyBeats.push(card);
      if (previous) state.storyEdges.push({ id:uid('story-edge'),from:previous.id,to:card.id,kind:'main' });
      render();
    }

    function rebuildMainStoryEdges(orderedCards) {
      state.storyEdges = state.storyEdges.filter(edge => edge.kind !== 'main');
      orderedCards.slice(0,-1).forEach((card,index) => state.storyEdges.push({ id:uid('story-edge'),from:card.id,to:orderedCards[index + 1].id,kind:'main' }));
    }

    function normalizeStoryOrderByPosition() {
      const mainCards = state.storyBeats.filter(card => card.kind === 'beat');
      const pageSlots = mainCards.map(card => card.pageGoal || 1).sort((a,b) => a - b);
      const ordered = [...mainCards].sort((a,b) => a.x - b.x || a.y - b.y);
      ordered.forEach((card,index) => { card.order = index + 1; card.pageGoal = pageSlots[index] || Math.round(((index + 1) / ordered.length) * (state.storyTargetPages || 110)); });
      rebuildMainStoryEdges(ordered);
    }

    function rememberCanvasLayout(kind) {
      const nodes = kind === 'story' ? state.storyBeats : state.ideaNodes;
      state.canvasLayoutUndo = {kind, positions:nodes.map(n => ({id:n.id,x:n.x,y:n.y})),groups:JSON.parse(JSON.stringify(state.ideaLayoutGroups || [])),edges:kind === 'story' ? JSON.parse(JSON.stringify(state.storyEdges)) : null};
    }
    function undoCanvasLayout() {
      const saved = state.canvasLayoutUndo;
      if (!saved) return;
      const nodes = saved.kind === 'story' ? state.storyBeats : state.ideaNodes;
      saved.positions.forEach(pos => { const node = nodes.find(n => n.id === pos.id); if (node) { node.x = pos.x; node.y = pos.y; } });
      if (saved.kind === 'idea') state.ideaLayoutGroups = saved.groups;
      else state.storyEdges = saved.edges.filter(e => nodes.some(n => n.id === e.from) && nodes.some(n => n.id === e.to));
      state.canvasLayoutUndo = null;
      render(); showToast('已恢复整理前的布局，文字和媒体内容保留');
    }
    function setIdeaZoom(value,anchor = null) {
      const viewport = $('.idea-canvas-viewport'),surface = $('.idea-canvas-surface');
      const previous = state.ideaZoom || .72, next = Math.max(.2,Math.min(1.6,Math.round(value*100)/100));
      state.ideaZoom = next;
      if (!viewport || !surface) return;
      const rect = viewport.getBoundingClientRect();
      const x = (anchor?.clientX ?? rect.left+rect.width/2)-rect.left,y = (anchor?.clientY ?? rect.top+rect.height/2)-rect.top;
      const worldX = (viewport.scrollLeft+x)/previous,worldY = (viewport.scrollTop+y)/previous;
      surface.style.transform = `scale(${next})`;
      $('[data-idea-zoom-label]').textContent = `${Math.round(next*100)}%`;
      viewport.scrollLeft = Math.max(0,worldX*next-x); viewport.scrollTop = Math.max(0,worldY*next-y);
      persistWorkspace();
    }
    function fitCanvasContents(kind) {
      const story = kind === 'story',viewport = $(story ? '.story-board-viewport' : '.idea-canvas-viewport');
      const nodes = story ? state.storyBeats : state.ideaNodes;
      if (!viewport || !nodes.length) return story ? setStoryZoom(1) : setIdeaZoom(1);
      const left=Math.min(...nodes.map(n=>n.x)),top=Math.min(...nodes.map(n=>n.y));
      const right=Math.max(...nodes.map(n=>n.x+n.w)),bottom=Math.max(...nodes.map(n=>n.y+n.h));
      const zoom=Math.max(.2,Math.min(1,(viewport.clientWidth-64)/(right-left),(viewport.clientHeight-64)/(bottom-top)));
      if (story) setStoryZoom(zoom); else setIdeaZoom(zoom);
      requestAnimationFrame(()=> { const z=story ? state.storyZoom : state.ideaZoom; viewport.scrollLeft=Math.max(0,(left+right)*z/2-viewport.clientWidth/2); viewport.scrollTop=Math.max(0,(top+bottom)*z/2-viewport.clientHeight/2); });
    }
    function ideaViewportCenter() {
      const viewport=$('.idea-canvas-viewport'),zoom=state.ideaZoom || .72;
      return viewport ? {x:Math.max(24,(viewport.scrollLeft+viewport.clientWidth/2)/zoom-115),y:Math.max(24,(viewport.scrollTop+viewport.clientHeight/2)/zoom-80)} : {x:360,y:230};
    }

    function alignStoryChain() {
      rememberCanvasLayout('story');
      const ordered = state.storyBeats.filter(card => card.kind === 'beat').sort((a,b) => a.order - b.order);
      ordered.forEach((card,index) => { card.x = 150 + index * 300; card.y = 420; });
      rebuildMainStoryEdges(ordered);
      render();
      showToast('已整理主线，支线位置保留；可从更多操作中撤销');
    }

    function addStorySubCard(parentId) {
      const parent = state.storyBeats.find(card => card.id === parentId);
      if (!parent) return;
      const siblings = state.storyBeats.filter(card => card.parentId === parentId).length;
      const card = { id:uid('sub'),kind:'sub',parentId,order:null,x:parent.x + 80 + siblings * 210,y:parent.y + parent.h + 110 + (siblings % 2) * 26,w:190,h:112,act:parent.act,type:'SUB CARD',title:'新的发散卡片',summary:'补充伏笔、人物动机、世界观规则或另一种可能。',scenes:'待关联',plot:'支线',characters:parent.characters,shift:'—',color:parent.color,source:'从 Beat 发散' };
      state.storyBeats.push(card);
      state.storyEdges.push({ id:uid('story-edge'),from:parentId,to:card.id,kind:'branch' });
      state.selectedStoryCard = card.id;
      render();
    }

    function syncStoryStructure() {
      state.storyBeats.filter(card => card.kind === 'beat').forEach((card,index) => { card.source = index < 2 ? '剧本正文 + 故事大纲 · 已同步' : '故事大纲 + Scene 关联 · 已同步'; });
      render();
      showToast('已从剧本正文与故事大纲更新主 Beat 链');
    }

    function addIdeaNode(position = {}) {
      const palette = ['#f1e5bc','#e4e9ee','#ffffff','#e5e5e3','#eee4df'];
      const node = { id:uid('idea'),type:'note',x:position.x ?? ideaViewportCenter().x,y:position.y ?? ideaViewportCenter().y,w:230,h:142,text:'新的灵感，输入 #人物、#对白 或任意自定义 Tag。',tags:[],color:palette[state.ideaNodes.length % palette.length] };
      state.ideaNodes.push(node);
      state.selectedIdea = node.id;
      state.ideaTool = 'select';
      state.ideaContextMenu = null;
      state.ideaLayoutGroups = [];
      render();
    }

    function arrangeIdeaNodes() {
      rememberCanvasLayout('idea');
      const groups=new Map();
      state.ideaNodes.forEach(n=>{const key=n.tags?.[0] || (n.type === 'media' ? '媒体' : '未分类'); if(!groups.has(key)) groups.set(key,[]);groups.get(key).push(n);});
      state.ideaLayoutGroups=[];
      let groupY=48;
      for(const [tag,nodes] of groups) {
        const width=Math.max(260,...nodes.map(n=>n.w)),height=Math.max(160,...nodes.map(n=>n.h));
        nodes.forEach((n,i)=>{n.x=72+(i%3)*(width+24);n.y=groupY+48+Math.floor(i/3)*(height+24);});
        const groupH=72+Math.ceil(nodes.length/3)*(height+24);
        state.ideaLayoutGroups.push({tag,x:48,y:groupY,w:48+Math.min(3,nodes.length)*(width+24),h:groupH});
        groupY+=groupH+32;
      }
      state.canvasAgentOpen=false;render();fitCanvasContents('idea');showToast('已按第一个标签分组排版，可点击「撤销整理」恢复');
    }

    function syncHashTags(nodeId) {
      const node = state.ideaNodes.find(item => item.id === nodeId);
      if (!node) return;
      const found = Array.from(node.text.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map(match => match[1]);
      if (found.length) { node.tags = Array.from(new Set([...(node.tags || []),...found])); render(); }
    }

    function addIdeaTag(nodeId,value) {
      const node = state.ideaNodes.find(item => item.id === nodeId);
      const tag = String(value || '').trim().replace(/^#+/,'').replace(/\s+/g,'');
      if (!node || !tag) return;
      node.tags = Array.from(new Set([...(node.tags || []),tag]));
      state.ideaTagMenu = null;
      render();
    }

    function applyCanvasAction(action) {
      if (action === 'undo-canvas-layout') return undoCanvasLayout();
      if (action === 'back-to-script') return switchScriptWorkspace('document');
      if (action === 'add-beat') return addStoryBeat();
      if (action === 'sync-story-structure') return syncStoryStructure();
      if (action === 'align-story-chain') return alignStoryChain();
      if (action === 'add-sticky') return addIdeaNode();
      if (action === 'upload-idea-media') {
        state.ideaUploadPosition = state.ideaContextMenu ? { x:state.ideaContextMenu.x, y:state.ideaContextMenu.y } : null;
        state.ideaContextMenu = null;
        return $('#idea-media-input').click();
      }
      if (action === 'analyze-beats') { state.canvasAgentOpen = true; return render(); }
      if (action === 'close-canvas-agent') { state.canvasAgentOpen = false; return render(); }
      if (action === 'arrange-ideas' || action === 'auto-arrange-ideas') return arrangeIdeaNodes();
      if (action === 'apply-beat-agent') {
        if (!state.storyBeats.some(beat => beat.id === 'beat-agent-draft')) { const parent = state.storyBeats.find(card => card.id === 'beat-4'); const card = { id:'beat-agent-draft',kind:'sub',parentId:'beat-4',order:null,x:(parent?.x || 1050) + 60,y:(parent?.y || 420) + 250,w:190,h:112,act:'act2a',type:'AGENT DRAFT',title:'披萨拒绝读取一段记忆',summary:'它第一次违抗梦雨的命令，主动保护一个秘密。',scenes:'待写',plot:'B 线',characters:'披萨、梦雨',shift:'服从 → 主动拒绝',color:'#7a6f9b',source:'Agent 结构建议' }; state.storyBeats.push(card); state.storyEdges.push({ id:uid('story-edge'),from:'beat-4',to:card.id,kind:'branch' }); }
        state.canvasAgentOpen = false; render(); showToast('结构提案已应用，可继续拖拽调整'); return;
      }
      if (action === 'idea-to-beat') {
        const parent = state.storyBeats.find(card => card.id === 'beat-2'); const card = { id:uid('sub'),kind:'sub',parentId:'beat-2',order:null,x:(parent?.x || 450) + 100,y:(parent?.y || 420) + 250,w:190,h:112,act:'act1',type:'FROM IDEA',title:'全城流浪猫同时说话',summary:'它们在同一秒说出不同失踪者留下的最后一句记忆。',scenes:'待写',plot:'A 线',characters:'梦雨、披萨',shift:'旁观 → 被迫行动',color:'#7a6f9b',source:'灵感画布' }; state.storyBeats.push(card); state.storyEdges.push({ id:uid('story-edge'),from:'beat-2',to:card.id,kind:'branch' });
        state.workspaceMode = 'beatboard'; state.canvasAgentOpen = false; render(); showToast('已生成 Beat 草案，并保留灵感来源'); return;
      }
      if (action === 'story-zoom-out') return setStoryZoom((state.storyZoom || .72) - .1);
      if (action === 'story-zoom-in') return setStoryZoom((state.storyZoom || .72) + .1);
      if (action === 'story-zoom-fit') return fitStoryZoom();
      if (action === 'zoom-out') return setIdeaZoom((state.ideaZoom || .72)-.1);
      if (action === 'zoom-in') return setIdeaZoom((state.ideaZoom || .72)+.1);
      if (action === 'zoom-fit') return fitCanvasContents('idea');
    }

    function openProductionTemplate(type) {
      const file = latestFile(type);
      if (!file) return;
      state.workspaceMode = 'document';
      state.currentDoc = type;
      state.currentFileId = file.id;
      state.view = 'focus';
      state.expandedStack = type;
      render();
      $('#canvas-viewport').scrollTop = 0;
    }

    function addProductionRow(type) {
      const columns = productionTableHeaders[type].length;
      const row = Array(columns).fill('—');
      if (type === 'scriptOrder') { row[0] = String(state.productionRows.scriptOrder.length + 1); row[1] = String(state.productionRows.scriptOrder.length + 1).padStart(2,'0'); row[2] = '0'; row[3] = '30'; row[33] = 'DRAFT'; }
      if (type === 'locationBreakdown') { row[0] = '新场景 Set'; row[2] = 'E1S01'; row[3] = '0'; row[4] = '30'; row[33] = 'SCOUTING'; }
      if (type === 'dailyReport') { row[0] = String(state.productionRows.dailyReport.length + 1); row[8] = '0'; row[9] = '未拍'; row[11] = '待审 / Review'; }
      if (type === 'dailySchedule') { row[0] = '待计算'; row[1] = '拍摄'; row[12] = '30'; row[13] = '10'; row[14] = 'NOT STARTED'; }
      state.productionRows[type].push(row);
      if (type === 'dailySchedule') recalcDailySchedule();
      render();
    }

    function timeToMinutes(value) {
      const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : 6 * 60 + 30;
    }

    function recalcDailySchedule() {
      let minutes = timeToMinutes(state.callSheetMeta.generalCall);
      const format = value => `${String(Math.floor(value / 60) % 24).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}`;
      state.productionRows.dailySchedule.forEach(row => {
        const duration = Number.parseFloat(row[12]) || 0;
        const move = Number.parseFloat(row[13]) || 0;
        row[0] = `${format(minutes)}–${format(minutes + duration)}`;
        minutes += duration + move;
      });
      state.callSheetMeta.estWrap = format(minutes);
    }

    function exportProductionCSV(type) {
      const meta = productionTemplateMeta[type];
      const rows = [productionTableHeaders[type], ...state.productionRows[type]];
      const csv = '\ufeff' + rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv],{ type:'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${meta.title}-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
      showToast(`已导出“${meta.title}”CSV`);
    }

    function applyProductionAction(action,type) {
      if (action === 'add-row') return addProductionRow(type);
      if (action === 'export') return exportProductionCSV(type);
      if (action === 'sync') return showToast('已从剧本同步 Scene、页数、Set、D/N、Cast 与 Shot 关联');
      if (action === 'call-sheet') return showToast('已用当天日程、演员 Call、天气、医院和安全信息生成通告预览');
    }

    function bindProductionInteractions() {
      $$('[data-production-drag]').forEach(grip => {
        grip.addEventListener('dragstart', () => { state.draggedProductionRow = grip.dataset.productionDrag; grip.closest('tr')?.classList.add('dragging'); });
        grip.addEventListener('dragend', () => { grip.closest('tr')?.classList.remove('dragging'); state.draggedProductionRow = null; });
      });
      $$('[data-production-row]').forEach(row => {
        row.addEventListener('dragover', event => event.preventDefault());
        row.addEventListener('drop', event => {
          event.preventDefault();
          if (!state.draggedProductionRow) return;
          const [fromType,fromIndexValue] = state.draggedProductionRow.split(':');
          const [toType,toIndexValue] = row.dataset.productionRow.split(':');
          if (fromType !== toType) return;
          const fromIndex = Number(fromIndexValue), toIndex = Number(toIndexValue);
          if (fromIndex === toIndex) return;
          const rows = state.productionRows[fromType];
          rows.splice(toIndex,0,rows.splice(fromIndex,1)[0]);
          if (fromType === 'dailySchedule') recalcDailySchedule();
          render();
        });
      });
    }

    document.addEventListener('click', event => {
      const scriptWorkspace = event.target.closest('[data-script-workspace]');
      if (scriptWorkspace) return switchScriptWorkspace(scriptWorkspace.dataset.scriptWorkspace);

      const storyEdgeAction = event.target.closest('[data-story-edge-action]');
      if (storyEdgeAction) return applyStoryEdgeAction(storyEdgeAction.dataset.storyEdgeAction);

      if (event.target.closest('[data-finish-story-connect]')) return finishStoryConnect();

      const storyConnectPort = event.target.closest('[data-story-connect-port]');
      if (storyConnectPort) {
        if (state.suppressStoryPortClick) return;
        connectStoryCard(storyConnectPort.dataset.storyConnectPort,storyConnectPort.dataset.port);
        return;
      }

      const storyEdge = event.target.closest('[data-story-edge-select]');
      if (storyEdge) {
        state.selectedStoryEdge = storyEdge.dataset.storyEdgeSelect;
        state.selectedStoryCard = null;
        state.storyConnectFrom = null;
        state.storyTool = 'select';
        state.storyEdgeMenu = null;
        render();
        return;
      }

      const storyTool = event.target.closest('[data-story-tool]');
      if (storyTool) {
        const requestedTool = storyTool.dataset.storyTool;
        state.storyTool = requestedTool === 'connect' && state.storyTool === 'connect' ? 'select' : requestedTool;
        state.storyConnectFrom = null;
        state.selectedStoryEdge = null;
        state.storyEdgeMenu = null;
        render();
        return;
      }

      const ideaTool = event.target.closest('[data-idea-tool]');
      if (ideaTool) {
        state.ideaTool = ideaTool.dataset.ideaTool;
        state.ideaConnectFrom = null;
        state.ideaContextMenu = null;
        render();
        return;
      }

      if (event.target.closest('[data-story-grid-snap]')) {
        state.storyGridSnap = !state.storyGridSnap;
        render();
        showToast(state.storyGridSnap ? '已开启网格吸附' : '已关闭网格吸附');
        return;
      }

      const storyMapBeat = event.target.closest('[data-story-map-beat]');
      if (storyMapBeat) {
        state.selectedStoryCard = storyMapBeat.dataset.storyMapBeat;
        state.selectedStoryEdge = null;
        state.storyConnectFrom = null;
        state.storyEdgeMenu = null;
        render();
        requestAnimationFrame(() => $(`[data-story-card="${state.selectedStoryCard}"]`)?.scrollIntoView({ behavior:'smooth',block:'center',inline:'center' }));
        return;
      }

      const addSubcard = event.target.closest('[data-add-subcard]');
      if (addSubcard) return addStorySubCard(addSubcard.dataset.addSubcard);

      const toggleIdeaTags = event.target.closest('[data-toggle-idea-tags]');
      if (toggleIdeaTags) {
        const nodeId = toggleIdeaTags.dataset.toggleIdeaTags;
        state.selectedIdea = nodeId;
        state.ideaTagMenu = state.ideaTagMenu === nodeId ? null : nodeId;
        render();
        if (state.ideaTagMenu) requestAnimationFrame(() => $(`[data-idea-tag-input="${nodeId}"]`)?.focus());
        return;
      }

      const applyIdeaTag = event.target.closest('[data-apply-idea-tag]');
      if (applyIdeaTag) return addIdeaTag(applyIdeaTag.dataset.applyIdeaTag,applyIdeaTag.dataset.tagValue);

      const removeIdeaTag = event.target.closest('[data-remove-idea-tag]');
      if (removeIdeaTag) {
        const node = state.ideaNodes.find(item => item.id === removeIdeaTag.dataset.removeIdeaTag);
        if (node) node.tags = (node.tags || []).filter(tag => tag !== removeIdeaTag.dataset.tagValue);
        render();
        return;
      }

      if (event.target.closest('[data-context-create-note]')) {
        const point = state.ideaContextMenu ? { x:state.ideaContextMenu.x, y:state.ideaContextMenu.y } : {};
        return addIdeaNode(point);
      }

      const canvasAction = event.target.closest('[data-canvas-action]');
      if (canvasAction) return applyCanvasAction(canvasAction.dataset.canvasAction);

      const addBeat = event.target.closest('[data-add-beat-act]');
      if (addBeat) return addStoryBeat(addBeat.dataset.addBeatAct);

      const addIdea = event.target.closest('[data-add-idea]');
      if (addIdea) return addIdeaNode(addIdea.dataset.addIdea);

      const removeIdea = event.target.closest('[data-remove-idea]');
      if (removeIdea) {
        const nodeId = removeIdea.dataset.removeIdea;
        state.ideaNodes = state.ideaNodes.filter(node => node.id !== nodeId);
        state.ideaEdges = state.ideaEdges.filter(edge => edge.from !== nodeId && edge.to !== nodeId);
        state.selectedIdea = null;
        state.ideaTagMenu = null;
        render();
        return;
      }

      const blankIdeaCanvas = event.target.closest('.idea-canvas-surface');
      if (state.workspaceMode === 'ideas' && blankIdeaCanvas && !event.target.closest('[data-idea-node]')) {
        if (state.ideaTool === 'note') {
          const rect = blankIdeaCanvas.getBoundingClientRect();
          const zoom = state.ideaZoom || .72;
          return addIdeaNode({ x:Math.max(0,(event.clientX - rect.left) / zoom - 115), y:Math.max(0,(event.clientY - rect.top) / zoom - 70) });
        }
        if (state.selectedIdea || state.ideaTagMenu || state.ideaContextMenu) {
          state.selectedIdea = null;
          state.ideaTagMenu = null;
          state.ideaContextMenu = null;
          render();
        }
        return;
      }

      const blankStoryCanvas = event.target.closest('.story-board');
      if (state.workspaceMode === 'beatboard' && blankStoryCanvas && !event.target.closest('[data-story-card]')) {
        state.selectedStoryCard = null;
        state.selectedStoryEdge = null;
        state.storyConnectFrom = null;
        state.storyEdgeMenu = null;
        render();
        return;
      }

      const productionNav = event.target.closest('[data-open-production]');
      if (productionNav) return openProductionTemplate(productionNav.dataset.openProduction);

      const productionAction = event.target.closest('[data-production-action]');
      if (productionAction) return applyProductionAction(productionAction.dataset.productionAction,productionAction.dataset.productionType);

      if (event.target.closest('[data-close-asset-card]')) {
        hideAssetCard(true);
        return;
      }

      const assetOption = event.target.closest('[data-asset-option]');
      if (assetOption) return switchAsset(assetOption.dataset.assetInstance, assetOption.dataset.assetOption);

      const assetAction = event.target.closest('[data-asset-action]');
      if (assetAction) {
        const asset = assetById(assetAction.dataset.assetCardId);
        showToast(`已打开资产编辑入口：${asset?.name || '当前资产'}`);
        return;
      }

      const assetToken = event.target.closest('[data-asset-token]');
      if (assetToken) {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) return;
        event.preventDefault();
        return showAssetCard(assetToken);
      }

      if (event.target.closest('[data-recognize-assets]')) return recognizeAssetsWithConfirm(event.target.closest('[data-recognize-assets]'));

      const formatButton = event.target.closest('.format-button[data-format-type]');
      if (formatButton) return applyScriptFormat(formatButton.dataset.formatType);

      if (!event.target.closest('#asset-dropdown-menu, #asset-hover-card')) closeAssetMenu();
      if (!event.target.closest('#asset-dropdown-menu, #asset-hover-card, [data-asset-token]')) hideAssetCard();
      if (!event.target.closest('.script-block, .editor-ribbon, .selection-tools, #asset-dropdown-menu, #asset-hover-card')) hideCaretToolbar();

      const createTrigger = event.target.closest('#create-template-trigger');
      if (createTrigger) {
        state.createMenuVisible = !state.createMenuVisible;
        state.openCreateMenu = null;
        renderCreationToolbar();
        return;
      }

      const createGroup = event.target.closest('[data-create-group]');
      if (createGroup) {
        state.openCreateMenu = createGroup.dataset.createGroup;
        return renderCreationToolbar();
      }

      if (event.target.closest('[data-create-menu-back]')) {
        state.openCreateMenu = null;
        renderCreationToolbar();
        return;
      }

      const createTemplateButton = event.target.closest('[data-create-template]');
      if (createTemplateButton) return createTemplate(createTemplateButton.dataset.createTemplate);

      if (!event.target.closest('.stack-create') && state.createMenuVisible) {
        state.openCreateMenu = null;
        state.createMenuVisible = false;
        renderCreationToolbar();
      }

      if (event.target.closest('#export-documents-button')) {
        openExportDialog();
        return;
      }

      if (event.target.closest('[data-export-close]') || event.target === $('#export-dialog-backdrop')) {
        closeExportDialog();
        return;
      }

      if (event.target.closest('[data-export-select-all]')) {
        const cats = exportCategories();
        state.exportSelection = state.exportSelection.size === cats.length ? new Set() : new Set(cats.map(c => c.key));
        renderExportDialog();
        return;
      }

      if (event.target.closest('[data-export-confirm]')) {
        const cats = exportCategories().filter(c => state.exportSelection.has(c.key));
        const files = cats.flatMap(exportFilesFor).filter(Boolean);
        if (!files.length) return;
        const fmt = state.exportFormat || 'doc';
        if (fmt === 'doc') downloadDocuments(files); else if (fmt === 'pdf') exportPdfDocuments(files); else downloadTextDocuments(files, fmt);
        closeExportDialog();
        return;
      }

      const sidebarToggle = event.target.closest('#sidebar-toggle');
      if (sidebarToggle) {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        render();
        showToast(state.sidebarCollapsed ? '写作信息侧栏已收起' : '写作信息侧栏已展开');
        return;
      }

      const pageHandle = event.target.closest('[data-page-drag]');
      if (pageHandle) {
        if (state.suppressPageHandleClick) return;
        const page = pageHandle.closest('[data-paper], .board-shell');
        const file = findFile(page?.dataset.pageFile);
        if (!page || !file) return;
        state.selectedPageSlot = page.dataset.pageSlot || 'left';
        state.expandedStack = file.type;
        render();
        showToast(`已选中“${file.title}”，底部已定位对应文件`);
        return;
      }

      const stackBack = event.target.closest('#stack-back');
      if (stackBack) {
        state.expandedStack = null;
        renderStack();
        return;
      }

      const stackScroll = event.target.closest('[data-stack-scroll]');
      if (stackScroll) {
        $('#stack-list').scrollBy({ left: Number(stackScroll.dataset.stackScroll) * 360, behavior: 'smooth' });
        return;
      }

      const paginationButton = event.target.closest('[data-pagination]');
      if (paginationButton) {
        state.paginationMode = paginationButton.dataset.pagination;
        render();
        showToast(`分页视图已切换为“${paginationButton.textContent.trim()}”`);
        return;
      }

      const writingScene = event.target.closest('[data-writing-scene]');
      if (writingScene) {
        state.activeScene = writingScene.dataset.writingScene;
        const scriptType = state.mode === 'film' ? 'script' : 'episodeScript';
        // 对照视图里已有剧本板块时，直接在该板块内定位，不切回专注模式
        const scriptInCompare = state.view === 'compare' && (state.currentDoc === scriptType || state.compareDoc === scriptType);
        if (!scriptInCompare) {
          state.currentDoc = scriptType;
          state.currentFileId = latestFile(state.currentDoc)?.id || state.currentFileId;
          state.expandedStack = state.currentDoc;
          state.view = 'focus';
        }
        state.locatedScriptId = writingScene.dataset.scene;
        render();
        setTimeout(() => {
          const targets = $$(`[data-script-id="${writingScene.dataset.scene}"]`).filter(el => el.closest('[data-paper], .page-slot'));
          (targets[0] || $(`[data-script-id="${writingScene.dataset.scene}"]`))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        showToast('已在剧本中定位所选场次');
        return;
      }

      const sceneRow = event.target.closest('[data-scene-row]');
      if (sceneRow) {
        state.activeScene = sceneRow.dataset.sceneRow;
        render();
        showToast('Writing 已同步当前场景信息');
        return;
      }

      const modeBtn = event.target.closest('[data-mode]');
      if (modeBtn) return switchMode(modeBtn.dataset.mode);

      const viewBtn = event.target.closest('[data-view]');
      if (viewBtn) return requestViewFromDock(viewBtn.dataset.view);

      const stackType = event.target.closest('[data-stack-type]');
      if (stackType) {
        state.expandedStack = stackType.dataset.stackType;
        renderStack();
        return;
      }

      const stackFile = event.target.closest('[data-file-id]');
      if (stackFile && !event.target.closest('[data-rename-input]')) return selectFile(stackFile.dataset.fileId);

      const fileAction = event.target.closest('[data-file-action]');
      if (fileAction) {
        const fileId = state.contextFileId;
        closeFileContextMenu();
        if (fileAction.dataset.fileAction === 'rename') {
          state.renamingFileId = fileId;
          const file = findFile(fileId);
          state.expandedStack = file?.type || state.expandedStack;
          renderStack();
        } else if (fileAction.dataset.fileAction === 'duplicate') duplicateFile(fileId);
        else if (fileAction.dataset.fileAction === 'export') downloadDocuments([findFile(fileId)]);
        else if (fileAction.dataset.fileAction === 'delete') deleteFile(fileId);
        return;
      }

      if (!event.target.closest('#file-context-menu')) closeFileContextMenu();

      const navDoc = event.target.closest('[data-doc]');
      if (navDoc && !event.target.closest('[data-episode-select]')) return selectDoc(navDoc.dataset.doc);

      const scriptBlock = event.target.closest('[data-script-id]');
      if (scriptBlock && !event.target.closest('button')) {
        state.selectedScriptId = scriptBlock.dataset.scriptId;
        $$('.script-block').forEach(block => block.classList.toggle('selected', block === scriptBlock));
        requestAnimationFrame(() => positionCaretToolbar(scriptBlock));
      }

      if (event.target.closest('[data-create-shot]')) return createShotFromSelection();
      if (event.target.closest('[data-ask-selection]')) return $('#agent-panel').classList.remove('hidden');
      if (event.target.closest('[data-ask-agent]')) {
        const sel = window.getSelection(); let text = sel && !sel.isCollapsed ? sel.toString().trim() : '';
        const block = state.activeScriptElement?.isConnected ? state.activeScriptElement : $(`[data-script-id="${state.selectedScriptId}"]`);
        if (!text && block) text = block.innerText.trim();
        let source = '剧本正文';
        try { const paper = block?.closest('[data-paper]'); const file = findFile(paper?.dataset.pageFile); if (file && block) { const sb = sourceBlocks(file.id).find(b => b.id === block.dataset.scriptId); source = `${file.title}${sb ? ` · 第 ${parseInt(sb.scene, 10)} 场` : ''}`; } } catch (_) {}
        document.dispatchEvent(new CustomEvent('moodio:agent-quote', { detail: { text, source } }));
        try { hideCaretToolbar(); } catch (_) {}
        return;
      }
      if (event.target.closest('[data-format-selection]')) {
        const block = event.target.closest('.script-block') || $(`[data-script-id="${state.selectedScriptId}"]`);
        if (block) positionCaretToolbar(block);
        return;
      }

      const source = event.target.closest('[data-source-link]');
      if (source) return locateSource(source.dataset.sourceLink, source.dataset.sourceFile);

      const tab = event.target.closest('[data-shot-tab]');
      if (tab) {
        state.shotTab[Number(tab.dataset.shot)] = tab.dataset.shotTab;
        state.openTagMenu = null;
        state.openMediaMenu = null;
        return render();
      }

      const trigger = event.target.closest('[data-tag-trigger]');
      if (trigger) {
        state.openTagMenu = state.openTagMenu === trigger.dataset.tagTrigger ? null : trigger.dataset.tagTrigger;
        state.openMediaMenu = null;
        return render();
      }

      const option = event.target.closest('[data-tag-option]');
      if (option) return toggleTag(Number(option.dataset.shot), option.dataset.category, option.dataset.value);

      const customTag = event.target.closest('[data-add-custom-tag]');
      if (customTag) return addCustomTag(Number(customTag.dataset.addCustomTag));

      const mediaTrigger = event.target.closest('[data-media-trigger]');
      if (mediaTrigger) {
        const id = Number(mediaTrigger.dataset.mediaTrigger);
        state.openMediaMenu = state.openMediaMenu === id ? null : id;
        state.openTagMenu = null;
        return render();
      }

      const mediaAction = event.target.closest('[data-media-action]');
      if (mediaAction) {
        const shot = state.shots.find(item => item.id === Number(mediaAction.dataset.shot));
        state.openMediaMenu = null;
        if (mediaAction.dataset.mediaAction === 'upload') {
          $('#media-input').dataset.shot = shot.id;
          $('#media-input').click();
        } else if (mediaAction.dataset.mediaAction === 'canvas') {
          shot.media = 'canvas'; render(); showToast('已创建并关联分镜画布草图');
        } else {
          shot.media = 'visual'; render(); showToast('已从 Discovery 添加参考图');
        }
        return;
      }

      const insert = event.target.closest('[data-insert-shot]');
      if (insert) return insertShot(Number(insert.dataset.insertShot));
      if (event.target.closest('[data-merge-shots]')) return mergeSelectedShots();

      const scene = event.target.closest('[data-scene]');
      if (scene) {
        state.currentDoc = state.mode === 'film' ? 'script' : 'episodeScript';
        state.currentFileId = latestFile(state.currentDoc)?.id || state.currentFileId;
        state.view = 'focus';
        state.locatedScriptId = scene.dataset.scene;
        render();
        setTimeout(() => { const target = $(`[data-script-id="${scene.dataset.scene}"]`); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
      }
    });

    document.addEventListener('change', event => {
      if (event.target.matches('[data-script-layout]')) {
        state.scriptLayout = event.target.value;
        render();
        showToast(`剧本版式已切换为${state.scriptLayout === 'american' ? '美式剧本' : '中式剧本'}`);
      }
      if (event.target.matches('[data-episode-select]')) {
        state.episode = Number(event.target.value);
        render();
        showToast(`已切换到第 ${state.episode} 集`);
      }
      if (event.target.matches('[data-shot-check]')) {
        const id = Number(event.target.dataset.shotCheck);
        if (event.target.checked) state.selectedShots.add(id); else state.selectedShots.delete(id);
        render();
      }
      if (event.target.id === 'media-input' && event.target.files[0]) {
        const shot = state.shots.find(item => item.id === Number(event.target.dataset.shot));
        const type = event.target.files[0].type;
        shot.media = type.startsWith('audio') ? 'audio' : 'visual';
        event.target.value = '';
        render();
        showToast('媒体参考已上传到当前分镜');
      }
      if (event.target.id === 'idea-media-input' && event.target.files[0]) {
        const file = event.target.files[0];
        if (file.size > 2 * 1024 * 1024) { event.target.value = ''; showToast('单文件原型中，媒体请控制在 2 MB 内'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          const mediaType = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
          const point = state.ideaUploadPosition || ideaViewportCenter();
          const node = { id:uid('idea'),type:'media',x:point.x,y:point.y,w:330,h:230,text:file.name,tags:['媒体'],color:'#d5d5d3',src:reader.result,mediaType };
          state.ideaNodes.push(node);
          state.selectedIdea = node.id;
          state.ideaUploadPosition = null;
          state.ideaLayoutGroups = [];
          event.target.value = '';
          render();
          showToast('媒体已放入灵感画布');
        };
        reader.readAsDataURL(file);
      }
      if (event.target.id === 'text-import-input' && event.target.files[0]) {
        const imported = event.target.files[0];
        const extension = imported.name.split('.').pop()?.toLowerCase() || '';
        const textLike = ['txt', 'md', 'markdown', 'fountain', 'fdx', 'rtf'].includes(extension);
        const finishImport = content => {
          const title = imported.name.replace(/\.(txt|md|markdown|fountain|fdx|rtf|doc|docx|pdf)$/i, '') || '导入文档';
          const fallback = `已导入 ${extension.toUpperCase() || '文档'} 文件“${imported.name}”。原文件已保留，等待转换为可编辑稿纸。`;
          const body = content || fallback;
          const target = state.importTarget || 'custom';
          state.importTarget = null;
          const file = addFile(target, { title, content: body, preview: body.slice(0, 120) });
          file.importedText = true; file.sourceName = imported.name;
          if (target === 'custom') file.lineageId = file.id;
          state.currentDoc = target;
          state.currentFileId = file.id;
          state.view = 'focus';
          state.selectedPageSlot = 'left';
          state.expandedStack = target;
          event.target.value = '';
          render();
          persistWorkspace();
          showToast(`已导入“${imported.name}”，放入「${docDef(target).name === '新建空白页面' ? '空白页面' : docDef(target).name}」`);
        };
        if (textLike) {
          const reader = new FileReader();
          reader.onload = () => finishImport(String(reader.result || ''));
          reader.onerror = () => showToast('文档读取失败，请重新选择文件');
          reader.readAsText(imported);
        } else {
          finishImport('');
        }
      }
    });

    document.addEventListener('input', event => {
      if (event.target.matches('[data-production-cell]')) {
        const [type,rowIndex,columnIndex] = event.target.dataset.productionCell.split(':');
        state.productionRows[type][Number(rowIndex)][Number(columnIndex)] = event.target.innerText;
        if (type === 'dailySchedule' && (Number(columnIndex) === 12 || Number(columnIndex) === 13)) recalcDailySchedule();
        markSaving();
      }
      if (event.target.matches('[data-cast-cell]')) {
        const [rowIndex,columnIndex] = event.target.dataset.castCell.split(':').map(Number);
        state.castCalls[rowIndex][columnIndex] = event.target.innerText;
        markSaving();
      }
      if (event.target.matches('[data-report-cast-cell]')) {
        const [rowIndex,columnIndex] = event.target.dataset.reportCastCell.split(':').map(Number);
        state.dailyReportCastActuals[rowIndex][columnIndex] = event.target.innerText;
        markSaving();
      }
      if (event.target.matches('[data-call-meta]')) {
        state.callSheetMeta[event.target.dataset.callMeta] = event.target.value;
        if (event.target.dataset.callMeta === 'generalCall') recalcDailySchedule();
        markSaving();
      }
      if (event.target.matches('[data-report-meta]')) {
        state.dailyReportMeta[event.target.dataset.reportMeta] = event.target.value;
        markSaving();
      }
      if (event.target.matches('[data-shot-description]')) {
        const shot = state.shots.find(item => item.id === Number(event.target.dataset.shotDescription));
        shot.description = event.target.value;
        markSaving();
      }
      const editable = event.target.closest('[contenteditable="true"]');
      if (editable) {
        capturePaperEdits(editable.closest('[data-paper]'), true);
        markSaving();
      }
      const scriptBlock = scriptBlockFromEvent(event);
      if (scriptBlock) positionCaretToolbar(scriptBlock);
    });

    document.addEventListener('keydown', event => {
      const ideaTagInput = event.target.closest('[data-idea-tag-input]');
      if (ideaTagInput && event.key === 'Enter') {
        event.preventDefault();
        addIdeaTag(ideaTagInput.dataset.ideaTagInput,ideaTagInput.value);
        return;
      }
      const isTyping = event.target.closest('input,textarea,select,[contenteditable="true"]');
      if (!isTyping && state.workspaceMode === 'beatboard' && (event.ctrlKey || event.metaKey) && ['+','=','-','0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === '0') fitStoryZoom();
        else setStoryZoom((state.storyZoom || .72) + (event.key === '-' ? -.1 : .1));
        return;
      }
      if (!isTyping && state.workspaceMode === 'beatboard' && state.selectedStoryEdge && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        deleteStoryEdge();
        return;
      }
      if (event.key === 'Escape' && (state.ideaTagMenu || state.ideaContextMenu || state.ideaConnectFrom || state.storyConnectFrom || state.storyEdgeMenu)) {
        event.preventDefault();
        state.ideaTagMenu = null;
        state.ideaContextMenu = null;
        state.ideaConnectFrom = null;
        state.storyConnectFrom = null;
        state.storyEdgeMenu = null;
        state.storyTool = state.workspaceMode === 'beatboard' ? 'select' : state.storyTool;
        render();
        return;
      }
      if (event.key === 'Escape' && state.workspaceMode === 'beatboard' && state.selectedStoryEdge) {
        state.selectedStoryEdge = null;
        render();
        return;
      }
      const assetToken = event.target.closest('[data-asset-token]');
      if (assetToken && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        showAssetCard(assetToken);
        $('#asset-hover-card [data-asset-preview-action="edit"]')?.focus();
        return;
      }
      if(event.key==='Escape'&&$('#asset-hover-card')?.classList.contains('visible')){
        event.preventDefault();hideAssetCard(true);return;
      }
      if (event.key === 'Escape' && state.activeAssetInstance) {
        event.preventDefault();
        closeAssetMenu();
        return;
      }
      if (event.key === 'Tab' && $('#caret-format-toolbar')?.classList.contains('visible') && !event.target.closest('input, textarea, select')) {
        event.preventDefault();
        cycleScriptFormat(event.shiftKey ? -1 : 1);
        return;
      }
      const renameInput = event.target.closest('[data-rename-input]');
      if (renameInput && event.key === 'Enter') {
        event.preventDefault();
        renameFile(renameInput.dataset.renameInput, renameInput.value);
        return;
      }
      if (renameInput && event.key === 'Escape') {
        event.preventDefault();
        state.renamingFileId = null;
        renderStack();
        return;
      }
    });
    function closeFileContextMenu() { const menu = $('#file-context-menu'); if (menu) moodioMenuFx.close(menu, () => menu.classList.add('hidden')); }
