import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { useGenerationStore } from '../../frontend/src/stores/generationStore';
import { useProjectStore } from '../../frontend/src/stores/projectStore';
import { useEpisodeStore } from '../../frontend/src/stores/episodeStore';

const api = vi.hoisted(() => ({
  projects: vi.fn(), episodes: vi.fn(), episode: vi.fn(), generate: vi.fn(),
}));
vi.mock('@/services/api', () => ({
  projectApi: { getAll: api.projects },
  episodeApi: { getByProject: api.episodes, getByNumber: api.episode },
  worldStateApi: { generateEnhanced: api.generate },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = <T>(value: T) => ({ data: { success: true, data: value } });
const disposals: Array<() => void> = [];
function track<T extends { $dispose(): void }>(store: T): T {
  disposals.push(() => store.$dispose());
  return store;
}

beforeEach(() => {
  setActivePinia(createPinia());
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.clearAllMocks();
});
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  vi.unstubAllGlobals();
});

describe('project and episode request ownership', () => {
  it('late project success cannot overwrite the newer refresh', async () => {
    const old = deferred<unknown>();
    const latest = deferred<unknown>();
    api.projects.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const store = track(useProjectStore());
    const first = store.fetchProjects();
    const second = store.fetchProjects();
    latest.resolve(response([{ _id: 'new' }]));
    expect(await second).toBe(true);
    old.resolve(response([{ _id: 'old' }]));
    expect(await first).toBe(false);
    expect(store.projects.map(project => project._id)).toEqual(['new']);
    expect(store.loading).toBe(false);
  });

  it('old failure/finally cannot clear the active refresh loading state or set its error', async () => {
    const old = deferred<unknown>();
    const latest = deferred<unknown>();
    api.projects.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const store = track(useProjectStore());
    const first = store.fetchProjects();
    const second = store.fetchProjects();
    old.reject(new Error('old request failed'));
    expect(await first).toBe(false);
    expect(store.loading).toBe(true);
    expect(store.error).toBeNull();
    latest.resolve(response([]));
    expect(await second).toBe(true);
    expect(store.loading).toBe(false);
  });

  it('late episode list from project A cannot contaminate project B', async () => {
    const old = deferred<unknown>();
    api.episodes.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response([
      { _id: 'b1', projectId: 'b', episodeNumber: 1, content: 'B only' },
    ]));
    const store = track(useEpisodeStore());
    const first = store.fetchEpisodes('a');
    expect(await store.fetchEpisodes('b')).toBe(true);
    old.resolve(response([{ _id: 'a1', projectId: 'a', episodeNumber: 1, content: 'A stale' }]));
    expect(await first).toBe(false);
    expect(store.projectId).toBe('b');
    expect(store.getEpisodeByNumber(1)?.content).toBe('B only');
  });

  it('stale per-number 404 cannot clear the newer current episode', async () => {
    const old = deferred<unknown>();
    api.episode.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(
      { _id: 'b2', projectId: 'b', episodeNumber: 2, content: 'B episode 2' }
    ));
    const store = track(useEpisodeStore());
    const first = store.fetchEpisodeByNumber('a', 1);
    await store.fetchEpisodeByNumber('b', 2);
    old.reject(Object.assign(new Error('not found'), { response: { status: 404 } }));
    expect(await first).toBeNull();
    expect(store.currentEpisode?.content).toBe('B episode 2');
    expect(store.error).toBeNull();
  });

  it('clearing episodes invalidates pending responses, and network failures are readable', async () => {
    const old = deferred<unknown>();
    api.episodes.mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error('Network Error'));
    const store = track(useEpisodeStore());
    const pending = store.fetchEpisodes('a');
    store.clearEpisodes();
    old.resolve(response([{ _id: 'late' }]));
    expect(await pending).toBe(false);
    expect(store.episodes).toEqual([]);
    expect(await store.fetchEpisodes('b')).toBe(false);
    expect(store.error).toContain('网络连接失败');
  });
});

describe('generation terminal persistence boundary', () => {
  it('uses the exact persisted final version, not the concatenated streamed attempts', async () => {
    const finalContent = '最终选定版本\n第二行保留空白  \nEND';
    api.episode.mockResolvedValue(response({ content: finalContent, wordCount: 99 }));
    api.generate.mockImplementation(async (_pid, _episode, callbacks) => {
      callbacks.onChunk('first failed draft + second attempt');
      await callbacks.onComplete({});
    });
    const store = track(useGenerationStore());
    expect(await store.startGeneration('p', 1)).toBe(true);
    expect(store.generatedContent).toBe(finalContent);
    expect(store.wordCount).toBe(99);
    expect(store.progress.current).toBe(100);
  });

  it('failed persisted read is not reported as successful completion', async () => {
    api.episode.mockRejectedValue(new Error('Network Error'));
    api.generate.mockImplementation(async (_pid, _episode, callbacks) => {
      callbacks.onChunk('unverified preview');
      await callbacks.onComplete({});
    });
    const store = track(useGenerationStore());
    expect(await store.startGeneration('p', 1)).toBe(false);
    expect(store.error).toContain('读取已保存剧本失败');
    expect(store.error).toContain('网络连接失败');
    expect(store.progress.current).not.toBe(100);
    expect(store.logs.some(log => log.message.startsWith('✅'))).toBe(false);
  });

  it('reset while final saved content is loading aborts and invalidates that callback', async () => {
    const saved = deferred<unknown>();
    let signal!: AbortSignal;
    api.episode.mockReturnValue(saved.promise);
    api.generate.mockImplementation(async (_pid, _episode, callbacks, options) => {
      signal = options.signal;
      await callbacks.onComplete({});
    });
    const store = track(useGenerationStore());
    const pending = store.startGeneration('a', 1);
    await nextTick();
    expect(api.episode).toHaveBeenCalledTimes(1);
    store.reset();
    expect(signal.aborted).toBe(true);
    saved.resolve(response({ content: 'stale persisted A' }));
    expect(await pending).toBe(false);
    expect(store.generatedContent).toBe('');
    expect(store.progress.current).toBe(0);
    expect(store.logs).toEqual([]);
  });

  it('a stopped run cannot overwrite or end a newer run while its saved read finishes', async () => {
    const oldSaved = deferred<unknown>();
    const finishNew = deferred<void>();
    api.episode.mockReturnValueOnce(oldSaved.promise).mockResolvedValueOnce(response({ content: 'B saved' }));
    api.generate.mockImplementationOnce(async (_pid, _episode, callbacks) => {
      await callbacks.onComplete({});
    }).mockImplementationOnce(async (_pid, _episode, callbacks) => {
      callbacks.onChunk('B preview');
      await finishNew.promise;
      await callbacks.onComplete({});
    });
    const store = track(useGenerationStore());
    const first = store.startGeneration('a', 1);
    store.stopGeneration();
    const second = store.startGeneration('b', 1);
    oldSaved.resolve(response({ content: 'A late' }));
    expect(await first).toBe(false);
    expect(store.isGenerating).toBe(true);
    expect(store.generatedContent).toBe('B preview');
    finishNew.resolve();
    expect(await second).toBe(true);
    expect(store.generatedContent).toBe('B saved');
  });
});
