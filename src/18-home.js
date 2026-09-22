    /* ===== 首页：点击顶栏 logo 或「返回项目列表」进入，参考正式版首页——左侧栏（素材库 / 项目）+ 主区。
     * 主区三种视图（state.homeView，不持久化）：agent = 问候语 + 居中输入框（输入框就是 Agent 面板自己的：进入首页时面板被搬进 #home-agent-slot，
     * 见 src/11 的 agentHomeMode / homeSync；一旦有对话内容面板铺满整页 body.home-chatting）；projects = 项目总览（「新建项目」直接建项目并重载进剧本工作区）；
     * library = 素材库（当前项目的人物 / 场景 / 道具）。页面切换见 src/06 的 render 覆盖，样式见 styles.css 末尾「首页」段。 ===== */
    function homeTimeAgo(ts){ const d=Date.now()-(ts||0); if(!ts||d<60e3) return '刚刚'; const m=Math.floor(d/60e3); if(m<60) return `${m} 分钟前`; const h=Math.floor(m/60); if(h<24) return `${h} 小时前`; const days=Math.floor(h/24); if(days<30) return `${days} 天前`; const dt=new Date(ts); return `${dt.getMonth()+1} 月 ${dt.getDate()} 日`; }
    var homeProjectMeta=new Map();   // 其他项目的剧集数：按 updatedAt 缓存，避免每次都解析整份工作区
    function homeEpisodeCount(p){
      if(p.id===moodioProjects.active()?.id) return Math.max(1,(state.episodes||[]).length);
      const hit=homeProjectMeta.get(p.id); if(hit&&hit.at===p.updatedAt) return hit.count;
      let count=1; try{ const raw=localStorage.getItem('moodio-ui-refined-storyboard-v1::'+p.id); const eps=raw?JSON.parse(raw)?.episodes:null; if(Array.isArray(eps)&&eps.length) count=eps.length; }catch(_){}
      homeProjectMeta.set(p.id,{at:p.updatedAt,count}); return count;
    }
    const HOME_ICONS={
      clapper:'<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 7l2 4M12 7l2 4M17 7l2 4"/></svg>',
      plus:'<svg class="icon sm" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
      person:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></svg>',
      image:'<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 4 3 7-8"/></svg>'
    };
    function renderHomeProjects(){
      const host=$('#home-projects-view'); if(!host) return;
      const activeId=moodioProjects.active()?.id;
      const list=moodioProjects.list().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      host.innerHTML=`<header class="home-view-head"><div><h2>项目</h2><p>${list.length} 个项目</p></div><button type="button" class="canvas-action primary" data-home-project-new>${HOME_ICONS.plus}新建项目</button></header>`
        +(list.length?`<div class="home-grid">${list.map(p=>`<button type="button" class="home-project${p.id===activeId?' current':''}" data-home-project="${escapeHtml(p.id)}"><span class="home-project-thumb">${p.id===activeId?'<span class="home-project-current-tag">当前</span>':''}${HOME_ICONS.clapper}</span><strong>${escapeHtml(p.title)}</strong><small><span>${homeEpisodeCount(p)} 个剧集</span> · <span>${homeTimeAgo(p.updatedAt||p.createdAt)}</span></small></button>`).join('')}</div>`
        :'<div class="home-empty">还没有项目。点击「新建项目」从空白开始。</div>');
    }
    function renderHomeLibrary(){
      const host=$('#home-library-view'); if(!host) return;
      const assets=allAssets();
      const groups=[['character','人物'],['location','场景'],['prop','道具'],['style','其他']].map(([type,label])=>[type,label,assets.filter(a=>a.type===type)]).filter(g=>g[2].length);
      host.innerHTML=`<header class="home-view-head"><div><h2>素材库</h2><p>${assets.length?`当前项目 · ${assets.length} 个素材`:'当前项目还没有素材'}</p></div><button type="button" class="canvas-action" data-home-open-assets>打开资产板块</button></header>`
        +(groups.length?groups.map(([type,label,items])=>`<h3 class="home-group-title">${label}<small>${items.length}</small></h3><div class="home-grid">${items.map(a=>{ const src=assetCoverSource(a); return `<button type="button" class="home-asset" data-home-asset="${escapeHtml(a.id)}" data-asset-type="${escapeHtml(type)}"><span class="home-asset-thumb">${src?`<img src="${escapeHtml(src)}" alt="">`:(type==='character'?HOME_ICONS.person:HOME_ICONS.image)}</span><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.meta||a.description||'')}</small></button>`; }).join('')}</div>`).join('')
        :'<div class="home-empty">还没有素材。在「资产」板块创建人物、场景与道具，或让 Agent 识别剧本中的资产，它们会出现在这里。</div>');
    }
    function renderHomePage(){
      if(document.body.classList.contains('home-chatting')) state.homeView='agent';   // 对话铺满整页时只能是 Agent 视图（面板在问候页的插槽里）
      const view=state.homeView||'agent';
      $$('#home-surface [data-home-nav]').forEach(b=>b.classList.toggle('active',b.dataset.homeNav===view));
      $('#home-idle')?.classList.toggle('hidden',view!=='agent');
      $('#home-projects-view')?.classList.toggle('hidden',view!=='projects');
      $('#home-library-view')?.classList.toggle('hidden',view!=='library');
      const nameEl=$('#home-user-name'); if(nameEl) nameEl.textContent=(typeof USER_PROFILE!=='undefined'&&USER_PROFILE?.name)||$('#topbar-me')?.title||'Thomas';
      let chats=null; try{ chats=JSON.parse(localStorage.getItem(moodioProjects.key('moodio-agent-chats'))||'null')?.chats; }catch(_){}
      $('#home-history-link')?.toggleAttribute('hidden',!(Array.isArray(chats)&&chats.some(c=>c.messages?.length)));   // 有过对话才显示「查看历史对话」
      if(view==='projects') renderHomeProjects(); else if(view==='library') renderHomeLibrary();
    }
    (function homePage(){
      const openHome=view=>{ state.homeView=view; if(state.projectPage==='home') render(); else selectProjectPage('home'); };
      const goHome=()=>{
        if(state.projectPage==='home'){
          if(document.body.classList.contains('home-chatting')){ const back=$('#agent-back'); if(back?.getAttribute('aria-pressed')==='true') back.click(); else $('#agent-new')?.click(); return; }   // 对话中再点 logo：开始新对话回到问候页，旧对话留在历史里
          if((state.homeView||'agent')!=='agent'){ openHome('agent'); return; }
          $('#agent-input')?.focus({preventScroll:true}); return;
        }
        openHome('agent');
      };
      const logo=$('.topbar .logo[data-go-home]');
      logo?.addEventListener('click',goHome);
      logo?.addEventListener('keydown',event=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); goHome(); } });
      $('.project-identity .bare-button')?.addEventListener('click',event=>{ event.preventDefault(); openHome('projects'); });   // 「返回项目列表」：首页的项目总览
      $('#home-surface')?.addEventListener('click',event=>{
        const t=event.target;
        const nav=t.closest('[data-home-nav]'); if(nav){ openHome(nav.dataset.homeNav); return; }
        if(t.closest('[data-home-project-new]')){ captureVisibleEdits(); persistWorkspace(); showToast('正在创建项目…'); moodioProjects.create('未命名项目'); return; }   // 新建后整页重载，落在新项目的剧本工作区
        const card=t.closest('[data-home-project]');
        if(card){ const id=card.dataset.homeProject; if(id===moodioProjects.active()?.id){ selectProjectPage('scripts'); return; } captureVisibleEdits(); showToast('正在切换项目…'); moodioProjects.switchTo(id); return; }
        if(t.closest('[data-home-open-assets]')){ selectProjectPage('assets'); return; }
        const asset=t.closest('[data-home-asset]'); if(asset){ state.assetFilter=asset.dataset.assetType||'all'; selectProjectPage('assets'); return; }
        if(t.closest('[data-home-history]')){ const back=$('#agent-back'); if(back&&back.getAttribute('aria-pressed')!=='true') back.click(); return; }
        if(t.closest('[data-home-foot]')) showToast('当前设计稿仅演示剧本工作区，此入口待接入');
      });
    })();
