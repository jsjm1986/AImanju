import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderer } from 'vue';
import { useSSE } from '../../frontend/src/composables/useSSE';
import type { PostSSEOptions } from '../../frontend/src/services/sseClient';
import type { SSEConsumeOutcome } from '../../frontend/src/services/sseCore';

const transport = vi.hoisted(() => vi.fn());
vi.mock('../../frontend/src/services/sseClient', () => ({ postSSE: transport }));

interface HostNode { children: HostNode[] }
const renderer = createRenderer<HostNode, HostNode>({
  createElement: () => ({ children: [] }),
  createText: () => ({ children: [] }),
  createComment: () => ({ children: [] }),
  insert: (node, parent) => { parent.children.push(node); },
  remove: () => {},
  setText: () => {},
  setElementText: () => {},
  patchProp: () => {},
  parentNode: () => null,
  nextSibling: () => null,
});
const unmounts = new Set<() => void>();

function mountSSE() {
  let connection!: ReturnType<typeof useSSE>;
  const app = renderer.createApp({
    setup() { connection = useSSE(); return () => null; },
  });
  app.mount({ children: [] });
  const unmount = () => {
    if (unmounts.delete(unmount)) app.unmount();
  };
  unmounts.add(unmount);
  return { connection, unmount };
}

afterEach(() => {
  for (const unmount of [...unmounts]) unmount();
  transport.mockReset();
});

describe('mounted SSE lifecycle', () => {
  it('component unmount aborts the actual transport and resolves without success', async () => {
    let signal!: AbortSignal;
    transport.mockImplementation((_url: string, _body: object, options: PostSSEOptions) => {
      signal = options.signal!;
      return new Promise<SSEConsumeOutcome>(resolve => {
        signal.addEventListener('abort', () => resolve({ status: 'aborted' }), { once: true });
      });
    });
    const { connection, unmount } = mountSSE();
    const onDone = vi.fn();
    const pending = connection.connect('/fixture', {}, { onDone });
    expect(connection.isLoading.value).toBe(true);
    unmount();
    expect(signal.aborted).toBe(true);
    await pending;
    expect(onDone).not.toHaveBeenCalled();
    expect(connection.isLoading.value).toBe(false);
    expect(connection.isConnected.value).toBe(false);
  });

  it('a late awaited terminal callback cannot complete or clear a newer connection', async () => {
    const requests: Array<{ options: PostSSEOptions; resolve: (value: SSEConsumeOutcome) => void }> = [];
    transport.mockImplementation((_url: string, _body: object, options: PostSSEOptions) =>
      new Promise<SSEConsumeOutcome>(resolve => { requests.push({ options, resolve }); }));
    const { connection } = mountSSE();
    let release!: () => void;
    const savedRefresh = new Promise<void>(resolve => { release = resolve; });
    const writes: string[] = [];
    const first = connection.connect('/first', {}, {
      onDone: async (_data, context) => {
        await savedRefresh;
        if (context.isCurrent()) writes.push('stale success');
      },
    });
    const oldTerminal = requests[0].options.onTerminal!('done', {});
    connection.disconnect();
    const second = connection.connect('/second', {}, {
      onDone: async (_data, context) => { if (context.isCurrent()) writes.push('new success'); },
    });
    requests[0].options.onError!(new Error('stale network error'));
    release();
    await oldTerminal;
    requests[0].resolve({ status: 'done', eventType: 'done', data: {} });
    await first;
    expect(writes).toEqual([]);
    expect(connection.isLoading.value).toBe(true);
    expect(connection.progress.value.current).not.toBe(100);
    expect(connection.error.value).toBeNull();
    await requests[1].options.onTerminal!('done', {});
    requests[1].resolve({ status: 'done', eventType: 'done', data: {} });
    await second;
    expect(writes).toEqual(['new success']);
    expect(connection.progress.value.current).toBe(100);
    expect(connection.isLoading.value).toBe(false);
  });
});
