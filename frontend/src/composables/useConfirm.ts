/**
 * ConfirmDialog composable
 * 提供程序化调用确认对话框的能力
 */

import { ref, createApp, h } from 'vue';
import ConfirmDialog, { type DialogType } from '@/components/common/ConfirmDialog.vue';

interface ConfirmOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export function useConfirm() {
  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const visible = ref(true);
      const loading = ref(false);

      const cleanup = () => {
        visible.value = false;
        setTimeout(() => {
          app.unmount();
          container.remove();
        }, 200);
      };

      const app = createApp({
        render() {
          return h(ConfirmDialog, {
            visible: visible.value,
            title: options.title || '确认',
            message: options.message,
            type: options.type || 'default',
            confirmText: options.confirmText || '确定',
            cancelText: options.cancelText || '取消',
            showCancel: options.showCancel !== false,
            loading: loading.value,
            'onUpdate:visible': (val: boolean) => {
              visible.value = val;
              if (!val) {
                cleanup();
                resolve(false);
              }
            },
            onConfirm: () => {
              cleanup();
              resolve(true);
            },
            onCancel: () => {
              cleanup();
              resolve(false);
            },
          });
        },
      });

      app.mount(container);
    });
  };

  const danger = (message: string, title = '危险操作'): Promise<boolean> => {
    return confirm({
      title,
      message,
      type: 'danger',
      confirmText: '确认删除',
    });
  };

  const warning = (message: string, title = '警告'): Promise<boolean> => {
    return confirm({
      title,
      message,
      type: 'warning',
    });
  };

  return {
    confirm,
    danger,
    warning,
  };
}

// 全局实例
let confirmInstance: ReturnType<typeof useConfirm> | null = null;

export const confirmDialog = {
  confirm: (options: ConfirmOptions) => {
    if (!confirmInstance) {
      confirmInstance = useConfirm();
    }
    return confirmInstance.confirm(options);
  },
  danger: (message: string, title?: string) => {
    if (!confirmInstance) {
      confirmInstance = useConfirm();
    }
    return confirmInstance.danger(message, title);
  },
  warning: (message: string, title?: string) => {
    if (!confirmInstance) {
      confirmInstance = useConfirm();
    }
    return confirmInstance.warning(message, title);
  },
};

export default useConfirm;
