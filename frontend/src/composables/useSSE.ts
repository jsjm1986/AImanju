import { ref, onUnmounted } from 'vue';

export interface SSEProgress {
  current: number;
  total: number;
  status: string;
}

export interface SSECallbacks {
  onChunk?: (content: string) => void;
  onProgress?: (progress: SSEProgress) => void;
  onMessage?: (data: Record<string, unknown>) => void;  // 通用消息处理
  onDone?: (data: unknown) => void;
  onError?: (message: string) => void;
}

export function useSSE() {
  const isConnected = ref(false);
  const isLoading = ref(false);
  const progress = ref<SSEProgress>({ current: 0, total: 100, status: '' });
  const content = ref('');
  const error = ref<string | null>(null);

  let abortController: AbortController | null = null;

  const connect = async (
    url: string,
    body: Record<string, unknown>,
    callbacks?: SSECallbacks
  ) => {
    // 重置状态
    isLoading.value = true;
    isConnected.value = true;
    content.value = '';
    error.value = null;
    progress.value = { current: 0, total: 100, status: '连接中...' };

    abortController = new AbortController();

    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8333/api';
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // 跳过事件类型行
            continue;
          }

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleEvent(data, callbacks);
            } catch (e) {
              // 解析失败，忽略
            }
          }
        }
      }

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('SSE 连接已取消');
      } else {
        error.value = (err as Error).message;
        callbacks?.onError?.((err as Error).message);
      }
    } finally {
      isLoading.value = false;
      isConnected.value = false;
      abortController = null;
    }
  };

  const handleEvent = (data: Record<string, unknown>, callbacks?: SSECallbacks) => {
    // 首先调用通用消息处理器（用于自定义处理）
    if (callbacks?.onMessage) {
      callbacks.onMessage(data);
    }

    // 处理不同类型的SSE消息
    const eventType = data.type as string;

    switch (eventType) {
      case 'start':
        progress.value = { current: 0, total: (data.totalSteps as number) || 100, status: '开始生成...' };
        break;

      case 'step_start':
        progress.value.status = (data.name as string) || `步骤 ${data.step}`;
        break;

      case 'chunk':
        // 带步骤的chunk (大纲生成)
        if (data.chunk !== undefined) {
          content.value += data.chunk as string;
          callbacks?.onChunk?.(data.chunk as string);
        }
        break;

      case 'step_done':
        progress.value.current = (data.step as number) || progress.value.current;
        break;

      case 'batch_progress':
        progress.value.status = `生成第${data.startEpisode}-${data.endEpisode}集 (批次 ${data.batch}/${data.totalBatches})`;
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
        progress.value = { current: 100, total: 100, status: '完成' };
        callbacks?.onDone?.(data);
        break;

      case 'error':
        error.value = (data.error as string) || (data.message as string) || '未知错误';
        callbacks?.onError?.(error.value);
        break;

      default:
        // 兼容旧格式
        // 处理 chunk 事件（旧格式）
        if (data.content !== undefined) {
          content.value += data.content as string;
          callbacks?.onChunk?.(data.content as string);
        }

        // 处理 progress 事件（旧格式）
        if (data.current !== undefined && data.total !== undefined) {
          progress.value = {
            current: data.current as number,
            total: data.total as number,
            status: (data.status as string) || '',
          };
          callbacks?.onProgress?.(progress.value);
        }

        // 处理 error 事件（旧格式）
        if (data.error !== undefined) {
          error.value = data.error as string;
          callbacks?.onError?.(data.error as string);
        }

        // 处理 done 事件（旧格式）
        if (data.success !== undefined) {
          callbacks?.onDone?.(data);
        }
    }
  };

  const disconnect = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
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
