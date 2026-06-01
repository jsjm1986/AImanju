import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

// 主题模式
export type ThemeMode = 'dark' | 'light';

// 皮肤类型
export type SkinType = 'default' | 'ocean' | 'sunset' | 'forest' | 'cherry';

// 平台类型
export type PlatformType = 'pc' | 'mobile';

// 皮肤配置
export interface SkinConfig {
    id: SkinType;
    name: string;
    primaryColor: string;
    secondaryColor: string;
}

// 预设皮肤
export const SKIN_PRESETS: SkinConfig[] = [
    { id: 'default', name: '靛紫', primaryColor: '#6366f1', secondaryColor: '#8b5cf6' },
    { id: 'ocean', name: '海蓝', primaryColor: '#0ea5e9', secondaryColor: '#06b6d4' },
    { id: 'sunset', name: '橙红', primaryColor: '#f97316', secondaryColor: '#ef4444' },
    { id: 'forest', name: '翠绿', primaryColor: '#22c55e', secondaryColor: '#10b981' },
    { id: 'cherry', name: '樱粉', primaryColor: '#ec4899', secondaryColor: '#f43f5e' },
];

// 移动端断点
const MOBILE_BREAKPOINT = 768;

export const useThemeStore = defineStore('theme', () => {
    // === 状态 ===
    const mode = ref<ThemeMode>(
        (localStorage.getItem('theme-mode') as ThemeMode) || 'dark'
    );

    const skin = ref<SkinType>(
        (localStorage.getItem('theme-skin') as SkinType) || 'default'
    );

    const platform = ref<PlatformType>('pc');

    // === 计算属性 ===
    const currentSkin = computed(() =>
        SKIN_PRESETS.find(s => s.id === skin.value) || SKIN_PRESETS[0]
    );

    const isDark = computed(() => mode.value === 'dark');
    const isMobile = computed(() => platform.value === 'mobile');

    // === 方法 ===

    // 切换明暗模式
    function toggleMode() {
        mode.value = mode.value === 'dark' ? 'light' : 'dark';
    }

    // 设置模式
    function setMode(newMode: ThemeMode) {
        mode.value = newMode;
    }

    // 设置皮肤
    function setSkin(newSkin: SkinType) {
        skin.value = newSkin;
    }

    // 检测平台
    function detectPlatform() {
        platform.value = window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'pc';
    }

    // 应用到 DOM
    function applyTheme() {
        const html = document.documentElement;
        html.setAttribute('data-theme', mode.value);
        html.setAttribute('data-skin', skin.value);
        html.setAttribute('data-platform', platform.value);
    }

    // === 监听器 ===

    // 监听模式变化
    watch(mode, (newMode) => {
        document.documentElement.setAttribute('data-theme', newMode);
        localStorage.setItem('theme-mode', newMode);
    }, { immediate: true });

    // 监听皮肤变化
    watch(skin, (newSkin) => {
        document.documentElement.setAttribute('data-skin', newSkin);
        localStorage.setItem('theme-skin', newSkin);
    }, { immediate: true });

    // 监听平台变化
    watch(platform, (newPlatform) => {
        document.documentElement.setAttribute('data-platform', newPlatform);
    }, { immediate: true });

    // === 初始化 ===
    if (typeof window !== 'undefined') {
        // 初始检测平台
        detectPlatform();

        // 监听窗口大小变化
        window.addEventListener('resize', detectPlatform);
    }

    return {
        // 状态
        mode,
        skin,
        platform,

        // 计算属性
        currentSkin,
        isDark,
        isMobile,

        // 预设
        SKIN_PRESETS,

        // 方法
        toggleMode,
        setMode,
        setSkin,
        detectPlatform,
        applyTheme,

        // 兼容旧 API
        theme: mode,
        toggleTheme: toggleMode,
        setTheme: setMode,
    };
});
