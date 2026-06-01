import { onMounted, onUnmounted } from 'vue';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

/**
 * 键盘快捷键组合式函数
 *
 * 使用方式:
 * ```ts
 * useKeyboardShortcuts([
 *   { key: 'g', ctrl: true, handler: handleGenerate, description: '生成剧本' },
 *   { key: 'ArrowUp', handler: handlePrevEpisode, description: '上一集' },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeydown = (event: KeyboardEvent) => {
    // 如果在输入框中，不处理快捷键 (除了 Escape)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable;

    if (isInput && event.key !== 'Escape') {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       event.code.toLowerCase() === shortcut.key.toLowerCase();

      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.handler();
        return;
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  return {
    shortcuts,
  };
}

/**
 * 全局保存快捷键
 * 默认阻止浏览器保存行为，调用自定义保存函数
 */
export function useGlobalSave(saveHandler: () => void) {
  useKeyboardShortcuts([
    {
      key: 's',
      ctrl: true,
      handler: saveHandler,
      description: '保存',
    },
  ]);
}

/**
 * 获取快捷键显示文本
 */
export function getShortcutText(shortcut: ShortcutHandler): string {
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }
  if (shortcut.alt) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }

  // 特殊键名处理
  const keyNames: Record<string, string> = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    enter: '↵',
    escape: 'Esc',
    space: 'Space',
  };

  const keyDisplay = keyNames[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase();
  parts.push(keyDisplay);

  return parts.join('+');
}
