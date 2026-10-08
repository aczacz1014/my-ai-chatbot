const form = document.querySelector('#chat-form');
const input = document.querySelector('#message');
const send = document.querySelector('#send');
const reset = document.querySelector('#reset');
const conversation = document.querySelector('#conversation');
const welcome = document.querySelector('#welcome');
const status = document.querySelector('#status');
let messages = [];
let busy = false;

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  send.disabled = busy || !input.value.trim();
}

function addMessage(role, text, pending = false) {
  welcome.hidden = true;
  const row = document.createElement('div');
  row.className = `message ${role}${pending ? ' pending' : ''}`;
  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = '✳';
    avatar.setAttribute('aria-hidden', 'true');
    row.append(avatar);
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.append(bubble);
  conversation.append(row);
  conversation.scrollTop = conversation.scrollHeight;
  return row;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (busy || !content) return;
  if (messages.length >= 100 || messages.reduce((sum, m) => sum + m.content.length, 0) + content.length > 60000) {
    status.textContent = '대화 길이 제한에 도달했습니다. 새 대화를 시작해 주세요.';
    return;
  }
  busy = true;
  input.disabled = true;
  send.disabled = true;
  reset.disabled = true;
  status.textContent = '';
  const userRow = addMessage('user', content);
  const pendingRow = addMessage('assistant', '생각하고 있어요…', true);
  input.value = '';
  resizeInput();
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...messages, { role: 'user', content }] }),
      signal: AbortSignal.timeout(55000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('답변을 받아오지 못했습니다.');
    messages.push({ role: 'user', content }, { role: 'assistant', content: data.reply });
    pendingRow.remove();
    addMessage('assistant', data.reply);
  } catch (error) {
    pendingRow.remove();
    userRow.remove();
    welcome.hidden = messages.length > 0;
    input.value = content;
    status.textContent = error.name === 'TimeoutError' ? '응답 시간이 초과되었습니다. 다시 전송해 주세요.' : error instanceof TypeError ? '서버와 연결되지 않았습니다. 인터넷 연결을 확인해 주세요.' : error.message;
  } finally {
    busy = false;
    input.disabled = false;
    reset.disabled = false;
    resizeInput();
    input.focus();
  }
});

input.addEventListener('input', resizeInput);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});
reset.addEventListener('click', () => {
  if (busy) return;
  messages = [];
  conversation.querySelectorAll('.message').forEach((row) => row.remove());
  welcome.hidden = false;
  status.textContent = '';
  input.value = '';
  resizeInput();
  input.focus();
});
document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    if (busy) return;
    input.value = button.dataset.prompt;
    resizeInput();
    input.focus();
  });
});
resizeInput();
