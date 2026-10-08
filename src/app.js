import express from 'express';
import { fileURLToPath } from 'node:url';

export function createApp({ fetchImpl = globalThis.fetch, getApiKey = () => process.env.OPENAI_API_KEY } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.post('/api/chat', async (req, res) => {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 101 ||
        messages.some((m, i) => !m || m.role !== (i % 2 === 0 ? 'user' : 'assistant') ||
          typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000) ||
        messages.at(-1).role !== 'user' ||
        messages.reduce((sum, m) => sum + m.content.length, 0) > 60000) {
      return res.status(400).json({ error: '대화 형식이 올바르지 않거나 길이 제한을 넘었습니다. 새 대화를 시작해 주세요.' });
    }
    const apiKey = getApiKey();
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return res.status(503).json({ error: '서버에 OPENAI_API_KEY를 설정해 주세요.' });
    }
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          store: false,
          messages: [
            { role: 'system', content: '당신은 친절하고 정확한 AI 도우미입니다. 이전 대화의 맥락을 반영하여 답변하세요. 사용자가 다른 언어를 요청하지 않으면 한국어로 답변하세요.' },
            ...messages.map(({ role, content }) => ({ role, content }))
          ],
          max_completion_tokens: 2000
        })
      });
      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ error: 'API 사용 한도 또는 요청 제한에 도달했습니다. 잠시 후 다시 시도하거나 OpenAI 계정의 사용 한도를 확인해 주세요.' });
        if (response.status === 401 || response.status === 403) return res.status(502).json({ error: 'OpenAI API 키 또는 모델 접근 권한을 확인해 주세요.' });
        return res.status(502).json({ error: 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      }
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty response');
      return res.json({ reply });
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      return res.status(timeout ? 504 : 502).json({ error: timeout ? '응답 시간이 초과되었습니다. 다시 시도해 주세요.' : '답변을 받아오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '존재하지 않는 API입니다.' }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((error, _req, res, _next) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? '요청이 너무 큽니다. 새 대화를 시작해 주세요.' : '올바른 JSON 요청을 보내 주세요.' });
  });
  return app;
}

export const app = createApp();
export default app;
