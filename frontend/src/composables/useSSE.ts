import { ref, onUnmounted } from 'vue';
import { postSSE } from '@/services/sseClient';
import { humanizeError } from '@/services/apiConfig';

export interface SSEProgress {
  current: number;
  total: number;
  status: string;
}

export interface SSEConnectionContext {
  isCurrent: () => boolean;
}

export interface SSECallbacks {
  onChunk?: (content: string) => void;
  onProgress?: (progress: SSEProgress) => void;
  onMessage?: (data: Record<string, unknown>) => void;
  onDone?: (data: unknown, connection: SSEConnectionContext) => void | Promise<void>;
  onError?: (message: string) => void;
}

export function useSSE() {
  const isConnected = ref(false);
  const isLoading = ref(false);
  const progress = ref<SSEProgress>({ current: 0, total: 100, status: '' });
  const content = ref('');
  const error = ref<string | null>(null);

  // 活动请求标识：防止旧连接的 finally/回调覆盖新连接状态
  let activeController: AbortController | null = null;
  let requestSeq = 0;

  const connect = async (
    url: string,
    body: Record<string, unknown>,
    callbacks?: SSECallbacks,
    options?: { signal?: AbortSignal }
  ) => {
    const requestId = ++requestSeq;
    const isCurrent = () => requestId === requestSeq;

    // 取消上一个仍在进行中的连接（仅失效回调不够：旧请求仍在消耗资源）
    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    isLoading.value = true;
    isConnected.value = true;
    content.value = '';
    error.value = null;
    progress.value = { current: 0, total: 100, status: '连接中...' };

    const controller = new AbortController();
    activeController = controller;
    const onOuterAbort = () => controller.abort();
    if (options?.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', onOuterAbort, { once: true });
    }

    try {
      await postSSE(url, body, {
        terminalEvents: ['done'],
        signal: controller.signal,
        onEvent: (type, data) => {
          if (!isCurrent()) return;
          handleEvent({ type, ...(data as object) } as Record<string, unknown>, callbacks);
        },
        onTerminal: async (type, data) => {
          if (!isCurrent()) return;
          handleEvent({ type, ...(data as object) } as Record<string, unknown>, callbacks);
          await callbacks?.onDone?.(data, { isCurrent });
          if (isCurrent()) progress.value = { current: 100, total: 100, status: '完成' };
        },
        onError: (err) => {
          if (!isCurrent()) return;
          error.value = humanizeError(err);
          callbacks?.onError?.(error.value);
        },
      });
    } finally {
      options?.signal?.removeEventListener('abort', onOuterAbort);
      if (isCurrent()) {
        isLoading.value = false;
        isConnected.value = false;
        activeController = null;
      }
    }
  };

  const handleEvent = (data: Record<string, unknown>, callbacks?: SSECallbacks) => {
    callbacks?.onMessage?.(data);
    const eventType = data.type as string;

    switch (eventType) {
      case 'start':
        progress.value = { current: 0, total: (data.totalSteps as number) || 100, status: '开始生成...' };
        break;
      case 'step_start':
        progress.value.status = (data.name as string) || `步骤 ${data.step}`;
        break;
      case 'chunk': {
        const text = (data.chunk ?? data.content ?? '') as string;
        if (text) {
          content.value += text;
          callbacks?.onChunk?.(text);
        }
        break;
      }
      case 'step_done':
        progress.value.current = (data.step as number) || progress.value.current;
        break;
      case 'batch_progress':
        progress.value.status = `生成第${data.startEpisode}-${data.endEpisode}集 (批次 ${data.batch}/${data.totalBatches})`;
        break;
      case 'checkpoint':
        progress.value.status = '已恢复断点内容';
        break;
      case 'progress':
        progress.value = {
          current: (data.current as number) || 0,
          total: (data.total as number) || 100,
          status: (data.status as string) || '',
        };
        callbacks?.onProgress?.(progress.value);
        break;
      case 'done':
        // 由 onTerminal 统一处理（保证仅一次且 await）
        break;
      case 'error':
        // 由消费器统一转为 onError
        break;
      default:
        if (data.content !== undefined) {
          content.value += data.content as string;
          callbacks?.onChunk?.(data.content as string);
        }
        if (data.current !== undefined && data.total !== undefined) {
          progress.value = {
            current: data.current as number,
            total: data.total as number,
            status: (data.status as string) || '',
          };
          callbacks?.onProgress?.(progress.value);
        }
    }
  };

  const disconnect = () => {
    requestSeq++;
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
    isConnected.value = false;
    isLoading.value = false;
  };

  const isClosed = () => !isConnected.value;

  onUnmounted(() => {
    disconnect();
  });

  return {
    isConnected,
    isLoading,
    progress,
    content,
    error,
    connect,
    disconnect,
    isClosed,
  };
}
