/**
 * 主题切换 Hook
 * 支持多个预设主题
 */

import { ref, onMounted, computed } from 'vue';

// 主题类型
export type ThemeId =
    | 'dark' | 'light' | 'tech-blue' | 'forest' | 'sakura' | 'purple-ink'
    | 'ocean' | 'nature' | 'ink' | 'warm' | 'paper' | 'cyberpunk'
    | 'nord' | 'luxury' | 'dracula' | 'coffee' | 'synthwave' | 'lavender';

// 主题配置
export interface ThemeConfig {
    id: ThemeId;
    name: string;
    icon: string;
    description: string;
}

// 可用主题列表
export const THEMES: ThemeConfig[] = [
    { id: 'dark', name: '深色', icon: '🌙', description: '经典深色模式' },
    { id: 'light', name: '浅色', icon: '☀️', description: '明亮清爽' },
    { id: 'nord', name: '北欧', icon: '❄️', description: '高级灰冷淡风' },
    { id: 'dracula', name: '吸血鬼', icon: '🧛', description: '经典极客配色' },
    { id: 'luxury', name: '黑金', icon: '👑', description: '高端商务质感' },
    { id: 'coffee', name: '咖啡', icon: '☕', description: '醇香温暖深色' },
    { id: 'paper', name: '纸张', icon: '📜', description: '护眼阅读' },
    { id: 'lavender', name: '薰衣草', icon: '☂️', description: '淡雅梦幻浅色' },
    { id: 'synthwave', name: '合成波', icon: '👾', description: '80年代复古未来' },
    { id: 'cyberpunk', name: '赛博', icon: '🤖', description: '高对比度霓虹' },
    { id: 'tech-blue', name: '科技蓝', icon: '💎', description: '深邃科技感' },
    { id: 'forest', name: '森林', icon: '🌲', description: '自然护眼' },
    { id: 'nature', name: '自然', icon: '🍃', description: '低饱和护眼' },
    { id: 'ocean', name: '海洋', icon: '🌊', description: '专注模式' },
    { id: 'ink', name: '墨水', icon: '📝', description: '写作模式' },
    { id: 'warm', name: '暖色', icon: '🌅', description: '护眼暖调' },
    { id: 'sakura', name: '樱花', icon: '🌸', description: '温柔文艺' },
    { id: 'purple-ink', name: '墨紫', icon: '✨', description: '创作灵感' },
];

const STORAGE_KEY = 'comic-script-theme';

// 全局状态（跨组件共享）
const currentTheme = ref<ThemeId>('dark');

// 是否已初始化
let initialized = false;

/**
 * 应用主题到 DOM
 */
function applyTheme(themeId: ThemeId): void {
    if (themeId === 'dark') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', themeId);
    }
}

/**
 * 初始化主题（从 localStorage 读取）
 */
function initTheme(): void {
    if (initialized) return;
    initialized = true;

    // 从 localStorage 读取
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEMES.find(t => t.id === saved)) {
        currentTheme.value = saved;
    } else {
        currentTheme.value = 'dark';
    }
    applyTheme(currentTheme.value);
}

/**
 * 主题切换 Hook
 */
export function useTheme() {
    // 确保初始化
    onMounted(() => {
        initTheme();
    });

    // 当前主题配置
    const currentThemeConfig = computed(() => {
        return THEMES.find(t => t.id === currentTheme.value) || THEMES[0];
    });

    /**
     * 设置主题
     */
    const setTheme = (themeId: ThemeId): void => {
        if (!THEMES.find(t => t.id === themeId)) {
            console.warn(`Unknown theme: ${themeId}`);
            return;
        }
        currentTheme.value = themeId;
        localStorage.setItem(STORAGE_KEY, themeId);
        applyTheme(themeId);
    };

    /**
     * 获取所有可用主题
     */
    const getAvailableThemes = (): ThemeConfig[] => {
        return THEMES;
    };

    return {
        theme: currentTheme,
        themeConfig: currentThemeConfig,
        themes: THEMES,
        setTheme,
        getAvailableThemes,
    };
}
