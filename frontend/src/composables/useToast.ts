/**
 * Toast 消息通知 composable
 */

import { ref, createApp, h } from 'vue';
import Toast, { type ToastType } from '@/components/common/Toast.vue';

interface ToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  closable?: boolean;
}

const toasts = ref<ToastOptions[]>([]);

let toastContainer: HTMLElement | null = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(options: ToastOptions) {
  const container = getContainer();
  const wrapper = document.createElement('div');
  wrapper.style.marginBottom = '10px';
  container.appendChild(wrapper);

  const app = createApp({
    render() {
      return h(Toast, {
        ...options,
        onClose: () => {
          app.unmount();
          wrapper.remove();
        },
      });
    },
  });

  app.mount(wrapper);
}

export function useToast() {
  const success = (message: string, title?: string, duration = 3000) => {
    showToast({ message, title, type: 'success', duration });
  };

  const error = (message: string, title?: string, duration = 5000) => {
    showToast({ message, title, type: 'error', duration });
  };

  const warning = (message: string, title?: string, duration = 4000) => {
    showToast({ message, title, type: 'warning', duration });
  };

  const info = (message: string, title?: string, duration = 3000) => {
    showToast({ message, title, type: 'info', duration });
  };

  const show = (options: ToastOptions) => {
    showToast(options);
  };

  return {
    success,
    error,
    warning,
    info,
    show,
    toasts,
  };
}

// 全局实例
export const toast = {
  success: (message: string, title?: string) => showToast({ message, title, type: 'success' }),
  error: (message: string, title?: string) => showToast({ message, title, type: 'error', duration: 5000 }),
  warning: (message: string, title?: string) => showToast({ message, title, type: 'warning' }),
  info: (message: string, title?: string) => showToast({ message, title, type: 'info' }),
};

export default useToast;
