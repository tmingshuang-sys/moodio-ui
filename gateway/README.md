# Moodio 模型网关

Cloudflare Worker，替页面保管模型 API key，对外提供 OpenAI 兼容的 `/v1/chat/completions`。

## 部署

```bash
cd gateway
npx wrangler login                      # 浏览器授权一次
npx wrangler secret put DEEPSEEK_API_KEY   # 粘贴 DeepSeek 的 key
npx wrangler secret put ACCESS_TOKEN       # 自己定一个访问口令，发给使用者
npx wrangler deploy
```

部署完成后会得到一个地址，形如 `https://moodio-gateway.<你的子域>.workers.dev`。

## 页面配置

Agent 面板 → ✦ → 模型设置：

- 服务商：OpenAI 兼容 Chat Completions
- Base URL：`https://moodio-gateway.<你的子域>.workers.dev/v1`
- API Key：上面设置的访问口令
- 模型：`deepseek-flash`
