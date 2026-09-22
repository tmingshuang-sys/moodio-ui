# Moodio 模型网关

Cloudflare Worker，替页面保管所有真实 API key。对外三个接口：

| 接口 | 用途 |
|---|---|
| `POST /v1/chat/completions` | 文本模型，OpenAI 兼容，流式与非流式都透传 |
| `POST /fal/<模型id>`、`GET`、`PUT /fal/<请求路径>` | 图片 / 视频，透传到 fal.ai 的队列接口（提交、查状态、取结果、取消） |
| `GET /media?url=` | 代下载 fal 的生成结果，避开浏览器跨域 |

三者都要求 `Authorization: Bearer <ACCESS_TOKEN>`。

## 部署

```bash
cd gateway
npx wrangler login                      # 浏览器授权一次
npx wrangler secret put DEEPSEEK_API_KEY   # 粘贴 DeepSeek 的 key
npx wrangler secret put FAL_KEY            # fal.ai 的 key，形如 id:secret（不配置则图片 / 视频返回 503）
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
