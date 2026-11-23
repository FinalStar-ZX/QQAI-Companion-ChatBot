// dsh-fallback-proxy.mjs
// 本地 OpenAI 兼容转发层：为 dsh 的 provider 提供「双模型自动故障转移」。
//
// 策略：顺序尝试 [上次成功的模型, 另一个模型]，任一成功即返回，并把成功者设为新一轮首选。
// 因此：主模型容量满 -> 用备用；备用容量满 -> 自动回到主模型。命中率自适应，无需重启 bot。
//
// 用法：
//   1. 设置环境变量（或在下方默认值里改）
//        FALLBACK_UPSTREAM = https://你的上游/v1
//        FALLBACK_MODELS   = 主模型ID,备用模型ID
//        FALLBACK_PORT     = 8799
//   2. node dsh-fallback-proxy.mjs
//   3. 把 cordis.patch.yml 里 provider 的 baseURL 改为 http://127.0.0.1:8799/v1
//
// 注意：本脚本只支持「两个模型互切」，因为它们互为对方的替补（用 1 - index 取另一个）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');

// ---------------------------------------------------------------
// 配置区：优先读环境变量，未设置时用这里的默认值
// ---------------------------------------------------------------
const UPSTREAM = process.env.FALLBACK_UPSTREAM || 'https://your-upstream.example.com/v1';
const MODELS = (process.env.FALLBACK_MODELS || 'YOUR_PRIMARY_MODEL,YOUR_SECONDARY_MODEL')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);              // [0] 主模型，[1] 备用模型
const LISTEN_PORT = Number(process.env.FALLBACK_PORT || 8799);
const LOG = process.env.FALLBACK_LOG || path.join(LOG_DIR, 'fallback-proxy.log');

if (MODELS.length < 2) {
  console.error('[fatal] 需要两个模型才能互切，请设置 FALLBACK_MODELS=主模型,备用模型');
  process.exit(1);
}

let preferred = 0;             // 当前首选模型下标
const cooldownUntil = [0, 0];  // 每个模型 429 后的冷却截止时间

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); fs.appendFileSync(LOG, line); } catch {}
  process.stdout.write(line);
}

function order() {
  const now = Date.now();
  // 若首选模型处于冷却期，则先试另一个
  const first = (now < cooldownUntil[preferred]) ? 1 - preferred : preferred;
  return [first, 1 - first];
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function callUpstream(p, method, headers, rawBody, model) {
  const outHeaders = { ...headers };
  delete outHeaders['host'];
  delete outHeaders['content-length'];
  delete outHeaders['connection'];
  let body = rawBody;
  if (rawBody && rawBody.length && /json/.test(headers['content-type'] || '')) {
    const obj = JSON.parse(rawBody.toString('utf8'));
    if (model) obj.model = model;          // 关键：改写请求里的 model 字段
    body = Buffer.from(JSON.stringify(obj), 'utf8');
    outHeaders['content-length'] = Buffer.byteLength(body);
  }
  return fetch(UPSTREAM + p, { method, headers: outHeaders, body: method === 'GET' ? undefined : body });
}

function isCapacityError(status, text) {
  if (status === 429) return true;
  const t = text || '';
  return /at capacity|model_concurrency_rate_limit|rate_limit_error/i.test(t) && status >= 400;
}

const server = http.createServer(async (req, res) => {
  const rawPath = (req.url || '/');
  // 客户端的 baseURL 可能带 /v1，dsh 又会拼一层，因此统一规范化：
  // 无论 /v1/chat/completions 还是 /v1/v1/chat/completions，都收敛到 /chat/completions
  const isChat = /\/chat\/completions$/.test(rawPath);
  const p = isChat ? '/chat/completions' : rawPath.replace(/^\/v1/, '');
  const method = req.method || 'POST';
  const headers = { ...req.headers };
  log(`req ${method} ${rawPath}`);

  let rawBody = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try { rawBody = await readBody(req); }
    catch { res.writeHead(400); return res.end('bad body'); }
  }

  // 非对话端点：直接透传，不改模型
  if (!p.endsWith('/chat/completions')) {
    try {
      const r = await callUpstream(p, method, headers, rawBody, null);
      res.writeHead(r.status, Object.fromEntries(
        [...r.headers].filter(([k]) => !['content-encoding', 'transfer-encoding', 'content-length'].includes(k))
      ));
      return res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      log(`passthrough error ${p}: ${e.message}`);
      res.writeHead(502);
      return res.end(JSON.stringify({ error: { message: String(e) } }));
    }
  }

  const seq = order();
  let lastErr = null;
  for (const idx of seq) {
    const model = MODELS[idx];
    try {
      const r = await callUpstream(p, method, headers, rawBody, model);
      if (r.status >= 200 && r.status < 300) {
        if (idx !== preferred) { log(`switch -> ${model}`); preferred = idx; }
        cooldownUntil[idx] = 0;
        res.writeHead(r.status, Object.fromEntries(
          [...r.headers].filter(([k]) => !['content-encoding', 'transfer-encoding', 'content-length'].includes(k))
        ));
        if (r.body) { for await (const chunk of r.body) res.write(chunk); }
        return res.end();
      }
      const text = await r.text();
      lastErr = { status: r.status, text };
      if (isCapacityError(r.status, text)) {
        cooldownUntil[idx] = Date.now() + 30000;   // 冷却 30 秒
        log(`capacity-limit on ${model} (${r.status}); trying fallback`);
        continue;                                  // 换另一个模型
      }
      // 非容量类错误：原样返回，不掩盖真实原因
      log(`upstream error on ${model}: ${r.status}`);
      res.writeHead(r.status, { 'content-type': 'application/json' });
      return res.end(text);
    } catch (e) {
      lastErr = { status: 502, text: JSON.stringify({ error: { message: String(e) } }) };
      log(`transport error on ${model}: ${e.message}`);
      continue;
    }
  }

  log('both models unavailable');
  res.writeHead(lastErr?.status || 429, { 'content-type': 'application/json' });
  res.end(lastErr?.text || JSON.stringify({ error: { message: 'both models unavailable', type: 'rate_limit_error' } }));
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  log(`fallback proxy listening on 127.0.0.1:${LISTEN_PORT}, primary=${MODELS[0]}, secondary=${MODELS[1]}`);
});
