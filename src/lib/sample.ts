// ===== 全新项目的示例文稿：让工作区一打开就有东西可看（用户可随时删除）=====
import type { Doc } from './types';
import { uid } from './types';

const SCRIPT = `# 霸道总裁别爱上我家猫 · 第一集

## INT. 雨夜车内 - 夜

雨打在挡风玻璃上，雨刷一下下扫过，划不干净。梦雨（22 岁，短发、米色风衣，肩上背着一只猫包）坐在副驾，膝盖上放着一份文件，但没有看。

**吴老师**（不抬头）
搜查科新来的轻入者，全 AI 判定，一次搭档。

**梦雨**
所以我就是工具。

猫包里探出一只橘猫的头，披萨。它盯着吴老师看了两秒，打了个哈欠。

**吴老师**
它叫什么？

**梦雨**
披萨。它不喜欢陌生人。

披萨跳到中控台上，把爪子按在吴老师的手背上。吴老师没有缩手。

*车门解锁声。*

## EXT. 商场后门 - 夜

卷帘门只升到人的腰部高度。梦雨弯腰钻过去，披萨先她一步落地，甩了甩尾巴上的雨水。

**梦雨**（低声）
别乱跑。

披萨在装卸坡道尽头停下，对着一扇紧闭的铁门叫了一声。梦雨走过去，门缝里塞着一枚银灰色的记忆芯片。
`;

const STORYBOARD = `# 分镜表 · 第一集

| 镜号 | 场次 | 景别 | 角度 | 运镜 | 时长(秒) | 画面描述 | 台词 / 音效 | 剧本依据 |
|---|---|---|---|---|---|---|---|---|
| 01 | 1 | 全景 | 平视 | 固定 | 4 | 雨夜车内，挡风玻璃上的雨水把城市灯光切碎，两人一猫的剪影 | 雨声、雨刷声 | 雨打在挡风玻璃上 |
| 02 | 1 | 近景 | 平视 | 缓推 | 3 | 梦雨膝盖上的文件，手指按在封面上没有翻开 | — | 膝盖上放着一份文件 |
| 03 | 1 | 中景 | 低位仰拍 | 固定 | 3 | 吴老师侧脸，目光停在前方，嘴角没有表情 | 吴老师：搜查科新来的轻入者… | 不抬头 |
| 04 | 1 | 特写 | 平视 | 固定 | 2 | 猫包拉链缝里探出的橘猫头 | — | 猫包里探出一只橘猫的头 |
| 05 | 1 | 近景 | 高位俯拍 | 固定 | 3 | 披萨的爪子按在吴老师手背上，手背青筋分明 | 车门解锁声 | 把爪子按在吴老师的手背上 |
| 06 | 2 | 全景 | 平视 | 跟拍 | 4 | 卷帘门下的装卸坡道，梦雨弯腰钻过，披萨落地甩尾 | 雨声渐弱 | 卷帘门只升到人的腰部高度 |
`;

const PROMPT = `# 镜头信息

- 镜号：01
- 场次：1 · INT. 雨夜车内 - 夜
- 时长：4 秒
- 画幅：9:16 竖屏

## 画面

夜晚，一辆旧轿车停在城市高架路边。挡风玻璃上布满雨水，雨刷缓慢扫过，把远处的霓虹灯光切成流动的碎块。车内只有仪表盘的微光，副驾坐着一个短发女孩，膝盖上放着一份文件；驾驶座是一个四十多岁的男人，目光望向前方。中控台上探出一只橘猫的头。

## 镜头

全景，平视，固定机位，轻微的手持呼吸感。

## 风格

冷色调、潮湿、写实电影感；主光来自车窗外右侧的街灯，青蓝与琥珀色对比；浅景深，玻璃上的水珠清晰。

## 人物与资产

梦雨（参考 人物小传.md）、吴老师、橘猫披萨。

## 负面约束

不要出现字幕、水印、多余的人物；不要卡通风格；不要过曝的霓虹。

## 英文 Prompt

Night, an old sedan parked on a city overpass in heavy rain. Rain streaks the windshield while wipers slowly sweep, breaking distant neon lights into drifting fragments. Inside, only the dashboard glow: a short-haired young woman in the passenger seat with a folder on her lap, a man in his forties at the wheel staring ahead, an orange cat's head peeking over the center console. Wide shot, eye level, locked-off camera with subtle handheld breathing. Cold, damp, realistic cinematic look, key light from a streetlamp outside the right window, teal and amber contrast, shallow depth of field, crisp raindrops on glass. Vertical 9:16, 4 seconds.
`;

const CHARACTERS = `# 人物小传

## 梦雨

- 概况：女 · 22 岁 · 记忆搜查科新人
- 外形：短发、米色风衣，总背着一只猫包
- 性格：积极、热情，相信体系，渴望参与大案证明自己
- 弧光：从相信"AI 判定"到学会自己做选择

## 吴老师

- 概况：男 · 48 岁 · 记忆搜查科导师
- 外形：灰卫衣、眼下有青影，说话前先看人一眼
- 性格：克制、冷静，习惯把关心包装成控制
- 秘密：掌握旧实验室的关键记录

## 披萨

- 概况：橘猫 · 年龄未知 · 情绪识别载体
- 能听见人最想遗忘的记忆；不是喜剧配角，而是故事里最直接的情绪判断者
`;

export function sampleDocs(): Doc[] {
  const at = Date.now() - 3600e3;
  const mk = (name: string, content: string, offset: number): Doc => ({ id: uid('d'), name, kind: 'md', content, createdAt: at - offset, updatedAt: at - offset, by: 'import' });
  return [
    mk('故事脚本.md', SCRIPT, 0),
    mk('分镜表.md', STORYBOARD, 60e3),
    mk('视频生成Prompt-01.md', PROMPT, 120e3),
    mk('人物小传.md', CHARACTERS, 180e3),
  ];
}
