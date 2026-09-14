    /* ===== 剧本格式规则与校验器 =====
     * 两种排版各一套场景标题规则；通用规则：动作行不许虚写（心理、回忆、动机）、不许不可拍内容、不写镜头术语、括注只写演法。
     * 词表可以直接在这里增删。校验器 lintScriptBlocks() 在 Agent 写入前和对话框的格式提示里使用。 */
    var MOODIO_SCRIPT_RULES = {
      american: {
        name: '美式剧本',
        headingRe: /^(INT|EXT|INT\.?\s*\/\s*EXT|I\/E)\.?\s+\S.*?\s+[-–—]\s*(日|夜|晨|清晨|早晨|上午|中午|正午|午后|下午|黄昏|傍晚|晚上|夜晚|夜里|深夜|凌晨|黎明|白天|雨夜|雪夜|同一时间|稍后|片刻后|次日|DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING)\s*$/i,
        headingText: '场景标题只能写成「INT. 地点 - 时间」或「EXT. 地点 - 时间」（内外景同时用 INT./EXT.），时间用 日 / 夜 / 晨 / 黄昏 / 深夜 等，标题里不写编号、不写其他内容。',
        headingExample: 'INT. 雨夜车内 - 夜',
      },
      chinese: {
        name: '中式剧本',
        headingRe: /^(内景|外景|内外景|内|外)[\s、·，,]*\S.*?[\s、·，,\-–—]+(日|夜|晨|清晨|早晨|上午|中午|正午|午后|下午|黄昏|傍晚|晚上|夜晚|夜里|深夜|凌晨|黎明|白天|雨夜|雪夜|同一时间|稍后|片刻后|次日)\s*$/,
        headingText: '场景标题只能写成「内景 地点 时间」或「外景 地点 时间」，时间用 日 / 夜 / 晨 / 黄昏 / 深夜 等；场次编号由系统自动生成，标题里不要写编号。',
        headingExample: '内景 雨夜车内 夜',
      },
      common: {
        // 虚写：镜头拍不到的心理、回忆、动机、判断
        virtual: ['想起', '想到', '回忆起', '回想', '想着', '觉得', '感觉到', '感到', '意识到', '明白了', '心里', '心中', '内心', '暗自', '不由得', '仿佛', '决定', '打算', '希望', '害怕', '担心', '以为', '记得', '忘不了', '知道', '在想', '似乎在'],
        // 不可拍：叙述者视角、时空跳跃说明、对观众说话
        unfilmable: ['与此同时在', '多年前', '多年以后', '若干年后', '很久以前', '观众', '镜头之外', '内心独白', '此时的她', '此时的他', '我们看到', '我们看见', '画外之意'],
        // 镜头术语：除非用户明确要分镜级剧本，否则不写
        camera: ['特写', '近景', '中景', '远景', '全景', '推镜', '拉镜', '摇镜', '移镜', '跟拍', '切至', '切到', '淡入', '淡出', '叠化', '镜头对准', '镜头从', '镜头拉', '镜头推', '画面切换', '俯拍', '仰拍', '空镜'],
        parenMaxChars: 20,
      },
    };
    function scriptRulesFor(layout) { return MOODIO_SCRIPT_RULES[layout === 'chinese' ? 'chinese' : 'american']; }
    function formatRulesText(layout) {
      const r = scriptRulesFor(layout), c = MOODIO_SCRIPT_RULES.common;
      return `【格式硬规则（${r.name}，写入前会自动校验，不合规会被退回修改）】\n1. ${r.headingText} 例：${r.headingExample}\n2. 动作行只写镜头能拍到、话筒能录到的内容：可见的动作、表情、道具、环境、声音。禁止虚写——不写心理活动、回忆、动机、判断，含「${c.virtual.slice(0, 12).join('、')}」等词的句子必须改成外在动作。\n3. 禁止不可拍内容：叙述者口吻、对观众说话、时空跳跃说明（「${c.unfilmable.slice(0, 5).join('、')}」等）。\n4. 不写镜头术语（${c.camera.slice(0, 6).join('、')}等），除非用户明确要求分镜级剧本。\n5. 括注只写演法或说话对象（如「低声」「对吴老师」），不超过 ${c.parenMaxChars} 字，不解释情绪原因。\n6. 人物名首次出场时在动作行里给出年龄与一句外形；对白的人物名必须与人物卡或已出场人物一致。`;
    }
    // blocks: [{id,type,text}]；opts: {layout, knownNames:[...], allowCamera:false}
    function lintScriptBlocks(blocks, opts = {}) {
      const r = scriptRulesFor(opts.layout), c = MOODIO_SCRIPT_RULES.common, issues = [];
      const known = new Set((opts.knownNames || []).map(n => String(n).trim()).filter(Boolean));
      const seen = new Set();
      const push = (i, b, level, rule, message, hit) => issues.push({ index: i, blockId: b.id, type: b.type, level, rule, message, snippet: String(b.text || '').slice(0, 60), hit: hit || '' });
      (blocks || []).forEach((b, i) => {
        const text = String(b.text || '').trim(); if (!text) return;
        if (b.type === 'scene') { if (!r.headingRe.test(text)) push(i, b, 'error', 'heading', `场景标题不符合${r.name}格式，应写成「${r.headingExample}」`); return; }
        if (b.type === 'character') { const name = text.replace(/[（(].*$/, '').trim(); if (name && !known.has(name) && !seen.has(name)) push(i, b, 'info', 'character', `人物「${name}」未在人物卡或前文出现，确认是否新人物`); seen.add(name); return; }
        if (b.type === 'paren') { if (text.replace(/^[（(]|[）)]$/g, '').length > c.parenMaxChars) push(i, b, 'warn', 'paren', `括注过长，只写演法或说话对象`); return; }
        if (b.type === 'action') {
          const v = c.virtual.find(w => text.includes(w)); if (v) push(i, b, 'error', 'virtual', `动作行含虚写「${v}」，镜头拍不到，请改成外在动作或画面`, v);
          const u = c.unfilmable.find(w => text.includes(w)); if (u) push(i, b, 'error', 'unfilmable', `动作行含不可拍内容「${u}」`, u);
          if (!opts.allowCamera) { const cam = c.camera.find(w => text.includes(w)); if (cam) push(i, b, 'warn', 'camera', `动作行含镜头术语「${cam}」，剧本阶段不写镜头`, cam); }
        }
      });
      return issues;
    }
    function lintSummaryText(issues) {
      const e = issues.filter(x => x.level === 'error').length, w = issues.filter(x => x.level === 'warn').length, n = issues.filter(x => x.level === 'info').length;
      return [e ? `${e} 处不合规` : '', w ? `${w} 处提醒` : '', n ? `${n} 处待确认` : ''].filter(Boolean).join('、') || '未发现格式问题';
    }
