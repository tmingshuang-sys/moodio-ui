    /* ===== 首页：点击顶栏 logo 或「返回项目列表」进入，参考正式版首页——问候语 + 居中输入框 + 项目卡片。
     * 输入框就是 Agent 面板自己的输入框（进入首页时面板被搬进 #home-agent-slot，见 src/11 的 agentHomeMode / homeSync）；
     * 一旦有对话内容，面板铺满整个页面（body.home-chatting，样式见 styles.css 末尾「首页」段）。页面切换见 src/06 的 render 覆盖。 ===== */
    function homeTimeAgo(ts){ const d=Date.now()-(ts||0); if(!ts||d<60e3) return '刚刚'; const m=Math.floor(d/60e3); if(m<60) return `${m} 分钟前`; const h=Math.floor(m/60); if(h<24) return `${h} 小时前`; const days=Math.floor(h/24); if(days<30) return `${days} 天前`; const dt=new Date(ts); return `${dt.getMonth()+1} 月 ${dt.getDate()} 日`; }
    var homeProjectMeta=new Map();   // 其他项目的剧集数：按 updatedAt 缓存，避免每次进首页都解析整份工作区
    function homeEpisodeCount(p){
      if(p.id===moodioProjects.active()?.id) return Math.max(1,(state.episodes||[]).length);
      const hit=homeProjectMeta.get(p.id); if(hit&&hit.at===p.updatedAt) return hit.count;
      let count=1; try{ const raw=localStorage.getItem('moodio-ui-refined-storyboard-v1::'+p.id); const eps=raw?JSON.parse(raw)?.episodes:null; if(Array.isArray(eps)&&eps.length) count=eps.length; }catch(_){}
      homeProjectMeta.set(p.id,{at:p.updatedAt,count}); return count;
    }
    function renderHomePage(){
      const nameEl=$('#home-user-name'); if(nameEl) nameEl.textContent=(typeof USER_PROFILE!=='undefined'&&USER_PROFILE?.name)||$('#topbar-me')?.title||'Thomas';
      const host=$('#home-projects'); if(!host) return;
      const activeId=moodioProjects.active()?.id;
      const clapper='<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 7l2 4M12 7l2 4M17 7l2 4"/></svg>';
      host.innerHTML=`<button type="button" class="home-project home-project-new" data-home-project-new><span class="home-project-thumb"><svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>新建</span></span></button>`
        +moodioProjects.list().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).map(p=>`<button type="button" class="home-project${p.id===activeId?' current':''}" data-home-project="${escapeHtml(p.id)}"><span class="home-project-thumb">${p.id===activeId?'<span class="home-project-current-tag">当前</span>':''}${clapper}</span><strong>${escapeHtml(p.title)}</strong><small><span>${homeEpisodeCount(p)} 个剧集</span> · <span>${homeTimeAgo(p.updatedAt||p.createdAt)}</span></small></button>`).join('');
      let chats=null; try{ chats=JSON.parse(localStorage.getItem(moodioProjects.key('moodio-agent-chats'))||'null')?.chats; }catch(_){}
      $('#home-history-link')?.toggleAttribute('hidden',!(Array.isArray(chats)&&chats.some(c=>c.messages?.length)));   // 有过对话才显示「查看历史对话」
    }
    (function homePage(){
      const goHome=()=>{
        if(state.projectPage==='home'){
          if(document.body.classList.contains('home-chatting')){ const back=$('#agent-back'); if(back?.getAttribute('aria-pressed')==='true') back.click(); else $('#agent-new')?.click(); }   // 对话中再点 logo：开始新对话回到问候页，旧对话留在历史里
          else $('#agent-input')?.focus({preventScroll:true});
          return;
        }
        selectProjectPage('home');
      };
      const logo=$('.topbar .logo[data-go-home]');
      logo?.addEventListener('click',goHome);
      logo?.addEventListener('keydown',event=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); goHome(); } });
      $('.project-identity .bare-button')?.addEventListener('click',event=>{ event.preventDefault(); goHome(); });   // 「返回项目列表」：首页就是项目列表
      $('#home-surface')?.addEventListener('click',event=>{
        const t=event.target;
        if(t.closest('[data-home-project-new]')){ openNewProjectDialog(); return; }
        const card=t.closest('[data-home-project]');
        if(card){ const id=card.dataset.homeProject; if(id===moodioProjects.active()?.id){ selectProjectPage('scripts'); return; } captureVisibleEdits(); showToast('正在切换项目…'); moodioProjects.switchTo(id); return; }
        if(t.closest('[data-home-history]')){ const back=$('#agent-back'); if(back&&back.getAttribute('aria-pressed')!=='true') back.click(); return; }
        if(t.closest('[data-home-foot]')) showToast('当前设计稿仅演示剧本工作区，此入口待接入');
      });
    })();
