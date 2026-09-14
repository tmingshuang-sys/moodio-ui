    /* ===== 分镜规范与校验：按类型的拆镜规范、结构化镜头字段、草案预检（查重 / 错配 / 覆盖）、规则检查、用户风格样例 =====
     * 想调整 Agent 拆镜头的口味：改 MOODIO_SHOT_GUIDES；想调预检松紧：改 precheckShotDrafts 里的阈值。 */
    var MOODIO_SHOT_GUIDES = {
      ad: { name: '广告', rules: '前 3 秒必须有视觉钩子（产品、冲突或反差画面）；单镜 1–3 秒，15 秒约 6–10 个镜头；产品或品牌至少露出 2 次，结尾定帧留 1 秒给 logo；口播 / 字幕对应的画面用近景或特写承接；节奏由快到稳，最后一镜承接行动号召。' },
      short: { name: '短剧', rules: '开场第一镜直接进冲突，不铺陈环境；对白场用正反打加反应镜头，每句关键台词至少一个近景；单镜 2–5 秒，节奏快；情绪转折点给特写；每场结尾留一个钩子镜头（悬念或反转）。' },
      series: { name: '剧集', rules: '每场先给定场镜头交代空间关系，再进中景、近景；对白按信息差安排正反打与过肩；关键动作和道具给插入特写；情绪高点用推镜或特写；一场 6–15 个镜头，单镜 3–8 秒。' },
      film: { name: '电影', rules: '镜头服务于视点与情绪：先决定这一场是谁的视点，景别由远到近推进或有意反向；长镜头与场面调度优先于碎切；动作段落按空间逻辑分解、保持轴线一致；关键道具、手部动作、眼神给特写；控制镜头数量，宁少勿碎。' },
      other: { name: '通用', rules: '每场先定场（全景或中景交代空间与人物位置），再按叙事节拍推进景别；每句关键对白有承接镜头；动作段落分解为可拍的单一动作；情绪转折给特写或推镜；单镜 2–8 秒；一段正文一般不超过 3 个镜头，也不要一段一镜地机械切分。' },
    };
    function shotGuideText(format) { const g = MOODIO_SHOT_GUIDES[format] || MOODIO_SHOT_GUIDES.other; return `【${g.name}分镜规范】${g.rules}`; }

    // 结构化镜头字段 → 分镜表的取值（camera 用分镜表下拉的写法，tags 用标签库的 5 档）
    var MOODIO_SHOT_FIELDS = {
      size: { '大远景': '大远景 (EWS)', '远景': '远景 (WS)', '全景': '全景 (FS)', '中景': '中景 (MS)', '近景': '近景 (MCU)', '特写': '特写 (CU)', '大特写': '大特写 (ECU)' },
      angle: ['平视', '低位仰拍', '高位俯拍', '俯视', '荷兰角', 'POV'],
      movement: ['固定', '推拉', '推镜', '拉镜', '横摇', '俯仰', '跟拍', '手持', '环绕'],
    };
    function normalizeShotFields(d) {
      d = d || {};
      const sizeKey = ['大特写', '大远景', '远景', '全景', '中景', '近景', '特写'].find(k => String(d.size || '').includes(k)) || null;
      const angleRaw = String(d.angle || '');
      const angle = MOODIO_SHOT_FIELDS.angle.find(a => angleRaw.includes(a)) || (/仰/.test(angleRaw) ? '低位仰拍' : /俯/.test(angleRaw) ? '高位俯拍' : '平视');
      const moveRaw = String(d.movement || '');
      const movement = MOODIO_SHOT_FIELDS.movement.find(m => moveRaw.includes(m)) || (/推/.test(moveRaw) ? '推镜' : /拉/.test(moveRaw) ? '拉镜' : /摇|移/.test(moveRaw) ? '横摇' : /跟|手持/.test(moveRaw) ? '跟拍' : '固定');
      const seconds = parseFloat(d.duration);
      const duration = Number.isFinite(seconds) && seconds > 0 ? Math.max(0.5, Math.min(120, seconds)) : null;
      const tagSize = sizeKey ? (['大远景', '远景'].includes(sizeKey) ? '大全景' : sizeKey === '大特写' ? '特写' : sizeKey) : null;
      const tagAngle = { '平视': '平视', '低位仰拍': '低角度', '高位俯拍': '高角度', '俯视': '鸟瞰', '荷兰角': '荷兰角', 'POV': '平视' }[angle];
      const tagMove = { '固定': '固定', '推拉': '推镜', '推镜': '推镜', '拉镜': '拉镜', '横摇': '横移', '俯仰': '固定', '跟拍': '跟拍', '手持': '跟拍', '环绕': '环绕' }[movement];
      const tags = { '摄影机角度': [tagAngle], '镜头运动': [tagMove] }; if (tagSize) tags['景别'] = [tagSize];
      return { sizeName: sizeKey, camera: { size: sizeKey ? MOODIO_SHOT_FIELDS.size[sizeKey] : '中景 (MS)', angle, movement, lens: '35mm' }, tags, duration, purpose: String(d.purpose || '').trim().slice(0, 80), dialogue: String(d.dialogue || '').trim().slice(0, 120) };
    }
    function shotFieldLine(s) { const c = s.camera || {}; return [c.size, c.angle, c.movement, s.duration ? `${s.duration} 秒` : ''].filter(Boolean).join(' · '); }

    // 文本相似度：去标点后按 2-gram 比较（中文够用）
    function textGrams(t) { const s = String(t || '').replace(/[\s，。、！？；：“”‘’（）()\[\]【】,.!?;:"'\-—·…]/g, ''); const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; }
    function textSimilarity(a, b) { const A = textGrams(a), B = textGrams(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return 2 * n / (A.size + B.size); }
    function textOverlap(part, whole) { const A = textGrams(part), B = textGrams(whole); if (!A.size) return 1; let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n / A.size; }

    // 预检：每条草案是 新增 / 重复（已有镜头覆盖同一段落、描述相近或段落已被覆盖）/ 待确认（描述与依据段落对不上、没有依据）
    function precheckShotDrafts(drafts, existingShots, blocks) {
      const byId = new Map((blocks || []).map(b => [b.id, b]));
      const label = s => (typeof shotLabel === 'function' ? shotLabel(s) : `镜头 ${s.id}`);
      return drafts.map(d => {
        const reasons = []; let status = 'new';
        const ids = d.sourceIds || [], src = ids.map(id => byId.get(id)).filter(Boolean);
        if (!src.length || src.length !== ids.length || new Set(src.map(b=>b.scene)).size > 1) return { status: 'suspect', reasons: ['没有有效的同场剧本依据段落，不能确定对应哪一段'] };
        const shared = (existingShots || []).filter(s => (!d.sourceFileId || !s.sourceFileId || s.sourceFileId === d.sourceFileId) && (s.sourceIds || [s.sourceId]).some(id => ids.includes(id)));
        const twin = shared.find(s => textSimilarity(s.description, d.description) >= 0.5);
        if (twin) { status = 'duplicate'; reasons.push(`与已有 ${label(twin)} 描述相近，属于重复`); }
        else if (shared.length && ids.every(id => shared.some(s => (s.sourceIds || []).includes(id)))) { status = 'duplicate'; reasons.push(`这段正文已有镜头（${shared.slice(0, 3).map(label).join('、')}），默认跳过；要重拆请勾选`); }
        else {
          const overlap = textOverlap(d.description, src.map(b => b.text).join('\n'));
          // 镜头语言通常不是原文复述；词面相似度只能提醒，不能作为拒绝写入的依据。
          if (overlap < 0.12 && String(d.description || '').length >= 12) reasons.push('画面描述与原文字面差异较大，请在确认前核对剧情是否一致');
        }
        return { status, reasons };
      });
    }
    // 规则检查：覆盖、定场、跨段、字段、数量（error 会退回模型修一轮，其余提示用户）
    function lintShotDrafts(drafts, blocks, existingShots) {
      const issues = [];
      const covered = new Set([...drafts.flatMap(d => d.sourceIds || []), ...(existingShots || []).flatMap(s => s.sourceIds || [])]);
      const content = (blocks || []).filter(b => !['scene', 'transition'].includes(b.format) && String(b.text || '').trim());
      content.filter(b => !covered.has(b.id) && ['dialogue', 'action'].includes(b.format)).forEach(b => issues.push({ level: 'error', rule: 'coverage', blockId: b.id, message: `段落 ${b.id}（${b.format === 'dialogue' ? '对白' : '动作'}）没有任何镜头覆盖：${String(b.text).slice(0, 30)}` }));
      [...new Set(drafts.map(d => d.scene))].forEach(sc => {
        const first = drafts.find(d => d.scene === sc);
        const hasExisting = (existingShots || []).some(s => s.scene === sc);
        if (first && !hasExisting && ['近景', '特写', '大特写'].includes(first.sizeName)) issues.push({ level: 'warn', rule: 'establish', message: `场 ${sc} 的第一个镜头是${first.sizeName}，缺少交代空间的定场镜头` });
      });
      drafts.forEach((d, i) => {
        if ((d.sourceIds || []).length > 3) issues.push({ level: 'warn', rule: 'span', index: i, message: `镜头 ${i + 1} 跨了 ${d.sourceIds.length} 段正文，信息过多，建议拆开` });
        if (!d.sizeName) issues.push({ level: 'warn', rule: 'fields', index: i, message: `镜头 ${i + 1} 没有给出景别` });
      });
      if (drafts.length / Math.max(1, content.length) > 2.5) issues.push({ level: 'info', rule: 'count', message: `镜头数（${drafts.length}）远多于正文段落数（${content.length}），可能切得过碎` });
      return issues;
    }
    function normalizeScenePlans(list, blocks) {
      const scenes = new Set((blocks || []).map(b => b.scene));
      return (Array.isArray(list) ? list : []).slice(0, 40).map(p => ({
        scene: String(p?.scene ?? '').padStart(2, '0'), intent: String(p?.intent || '').trim().slice(0, 120),
        beats: (Array.isArray(p?.beats) ? p.beats : []).slice(0, 8).map(x => String(x).trim().slice(0, 60)).filter(Boolean),
        coverage: String(p?.coverage || '').trim().slice(0, 160),
      })).filter(p => scenes.has(p.scene) && (p.intent || p.beats.length));
    }
    // 用户改过 Agent 写的镜头描述 → 记成风格样例，下次拆镜头时给模型看（最多 12 条，取最近 3 条）
    function recordShotStyleSample(shot) {
      if (!shot || !shot.agentDescription) return;
      const after = String(shot.description || '').trim(), before = String(shot.agentDescription).trim();
      if (!after || after === before || textSimilarity(before, after) > 0.98) return;   // 只要不是几乎原样就记下来（加一个词也是口味）
      const list = (state.shotStyleSamples || []).filter(x => x.shotId !== shot.id);
      list.push({ shotId: shot.id, before: before.slice(0, 160), after: after.slice(0, 160), at: Date.now() });
      state.shotStyleSamples = list.slice(-12);
    }
    function shotStyleSampleText() {
      const list = (state.shotStyleSamples || []).slice(-3);
      return list.length ? `\n【用户改过的镜头写法（学习其措辞与颗粒度，不要照抄内容）】\n${list.map(x => `原：${x.before}\n改：${x.after}`).join('\n')}` : '';
    }
