export const DEFAULT_TIMEOUT = 600000;
/**
 * Effective "no wall-clock limit" timeout for streaming requests (24h).
 *
 * IMPORTANT: do NOT use 0 here. The OpenAI/Anthropic SDKs treat `timeout: 0`
 * as a literal 0ms deadline (instant `APIConnectionTimeoutError`), not as
 * "disabled" — that aborted every stream after ~3s (the #355 regression).
 * It must also stay <= 2^31-1 ms, or `setTimeout` overflows and clamps to 1ms,
 * reintroducing the same instant-abort bug. Long streams are bounded by the
 * per-chunk stall watchdog and the user abortSignal, not by this value.
 */
export const DEFAULT_STREAMING_TIMEOUT = 86_400_000;
export const DEFAULT_MAX_RETRIES = 3;

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_DASHSCOPE_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
export const DEFAULT_OPEN_ROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
