import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OpenAiConnector } from '../openai.connector';
import { AnthropicConnector } from '../anthropic.connector';
import { OllamaConnector } from '../ollama.connector';

/** AI connector contract suites over SYNTHETIC implementation-derived
 *  fixtures (fixtures/{openai,anthropic,ollama}/PROVENANCE.md - both hosted
 *  doc references are JS-rendered and yielded nothing on 2026-11-20 fetch;
 *  shapes carried from the connectors, unverified; never recorded traffic). */

const fixture = (dir: string, name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${dir}/${name}`, import.meta.url)), 'utf8'));

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

const MSG = { messages: [{ role: 'user', content: 'Summarize this company.' }] };

describe('OpenAiConnector contract (synthetic fixtures)', () => {
  it('emits POST /v1/chat/completions with Bearer auth and maps content + usage', async () => {
    const { fn, calls } = mockFetchWith(fixture('openai', 'chat-completion.json'));
    const res = await new OpenAiConnector().run({ ...MSG, model: 'gpt-4o-mini' } as any, { apiKey: 'test-oai-key-aaa', fetch: fn as any });
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(calls[0].init.headers.Authorization).toBe('Bearer test-oai-key-aaa');
    expect(JSON.parse(calls[0].init.body).model).toBe('gpt-4o-mini');
    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('{"summary":"synthetic"}');
    expect(res.data?.finishReason).toBe('stop');
    expect(res.data?.usage).toEqual({ promptTokens: 120, completionTokens: 40, totalTokens: 160 });
  });

  it('429 retryable; network error redacts the key; missing credential/messages fail closed', async () => {
    const oai = new OpenAiConnector();
    const r = await oai.run(MSG as any, { apiKey: 'k', fetch: mockFetchWith({}, 429).fn as any });
    expect(r.error?.code).toBe('RATE_LIMITED');
    expect(r.error?.retryable).toBe(true);
    const fn = vi.fn().mockRejectedValue(new Error('fail test-oai-key-aaa'));
    const net = await oai.run(MSG as any, { apiKey: 'test-oai-key-aaa', fetch: fn as any });
    expect(net.error?.code).toBe('NETWORK_ERROR');
    expect(net.error?.message).not.toContain('test-oai-key-aaa');
    expect((await oai.run(MSG as any, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await oai.run({ messages: [] } as any, { apiKey: 'k' })).error?.code).toBe('INVALID_INPUT');
  });
});

describe('AnthropicConnector contract (synthetic fixtures)', () => {
  it('emits POST /v1/messages with x-api-key + anthropic-version and picks the text block (not thinking)', async () => {
    const { fn, calls } = mockFetchWith(fixture('anthropic', 'message.json'));
    const res = await new AnthropicConnector().run({ ...MSG, model: 'claude-sonnet-4-5', system: 'Be terse.' } as any, { apiKey: 'test-ant-key-bbb', fetch: fn as any });
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].init.headers['x-api-key']).toBe('test-ant-key-bbb');
    expect(calls[0].init.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(calls[0].init.body);
    expect(body.system).toBe('Be terse.');
    expect(body.max_tokens).toBe(1024);
    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Synthetic answer text.');
    expect(res.data?.stopReason).toBe('end_turn');
    expect(res.data?.usage).toEqual({ inputTokens: 88, outputTokens: 21 });
  });

  it('429 retryable; network error redacts the key; missing credential/messages fail closed', async () => {
    const ant = new AnthropicConnector();
    const r = await ant.run(MSG as any, { apiKey: 'k', fetch: mockFetchWith({}, 429).fn as any });
    expect(r.error?.code).toBe('RATE_LIMITED');
    const fn = vi.fn().mockRejectedValue(new Error('fail test-ant-key-bbb'));
    const net = await ant.run(MSG as any, { apiKey: 'test-ant-key-bbb', fetch: fn as any });
    expect(net.error?.message).not.toContain('test-ant-key-bbb');
    expect((await ant.run(MSG as any, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await ant.run({ messages: [] } as any, { apiKey: 'k' })).error?.code).toBe('INVALID_INPUT');
  });
});

describe('OllamaConnector contract (synthetic fixtures, local daemon)', () => {
  it('POSTs /api/chat with stream:false on the loopback default and reports costMicrocents 0', async () => {
    const { fn, calls } = mockFetchWith(fixture('ollama', 'chat.json'));
    const res = await new OllamaConnector().run({ ...MSG, model: 'llama3' } as any, { fetch: fn as any });
    expect(calls[0].url).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(calls[0].init.body);
    expect(body.stream).toBe(false);
    expect(res.success).toBe(true);
    expect(res.data?.content).toBe('Synthetic local answer.');
    expect(res.data?.evalCount).toBe(42);
    expect((res as any).costMicrocents).toBe(0);
  });

  it('daemon down maps to a redacted NETWORK_ERROR; empty messages fail closed', async () => {
    const ol = new OllamaConnector();
    const fn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:11434'));
    const res = await ol.run(MSG as any, { fetch: fn as any });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect((await ol.run({ messages: [] } as any, { fetch: fn as any })).error?.code).toBe('INVALID_INPUT');
  });
});
