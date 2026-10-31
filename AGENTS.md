# 给 AI agent 的说明

**先读 [CLAUDE.md](CLAUDE.md)。** 那份是项目约定的唯一出处，写的不只是代码长什么样，更是「为什么这么写」和「踩过什么坑」—— 不读它你会把别人已经踩平的坑再踩一遍。这份文件只列铁律。

## 铁律

1. **改完必须过两道闸**：`npm run check` 和 `npm test`。不过不许提交。
2. **改了界面，要在浏览器里真的看一眼**再说做完了。改了 Agent 逻辑，用真实模型发一条消息验证。
3. **只有一个分支 `main`。** 开工前 `git pull`，收工 `git push`。
4. **不要直接改服务器上的文件。** 部署脚本第一件事是 `git reset --hard`，手改的东西会被无声冲掉。上线走 `npm run deploy`。
5. **任何 API key 不许进仓库、不许进对话、不许写进代码。** key 在网页的「服务器设置」里填，存在服务器的库里。
6. **`server/vendor/` 下的文件一个字都不要改。** 那是上游仓库（MIT）的原样镜像，改了就再也合不回去。要改写在自己的目录里包一层。
7. **提交信息用中文**，说清楚「改了什么」和「为什么」。末尾加 `Co-Authored-By: <你的模型名> <noreply@anthropic.com>`。
8. **不要提交** `dist/`、`node_modules/`、`.env`。
9. **改了约定、踩了新坑，回头更新 CLAUDE.md。** 下一个 agent 全靠它。

## 别和别人打架

同一时间可能有别的 agent 在改这个仓库。

- 开工前先 `git pull --rebase`，不然你是在旧代码上改。
- 没把握任务之间文件不重叠，就**别并行**。串行慢一点，但不用收拾冲突。
- 大改动先说清楚要碰哪些文件，再动手。

## 跑起来

```bash
npm install && npm run dev     # 前端 http://localhost:5174
npm run check && npm test      # 两道闸
npm run deploy                 # 上线
```

要连后端调同步 / 登录 / 模型网关：

```bash
cd server && npm run db:up && npm run dev     # 后端 8787
WOW_API=http://127.0.0.1:8787 npm run dev     # 前端代理过去
```

架构总览和「想改 X 去哪」的对照表在 [README.md](README.md)。
