# 动态漫剧本生成系统 - UI 设计规范

## 1. 设计理念

### 1.1 核心原则
- **专业感**: 面向内容创作者的专业工具，界面需要体现专业性和可信度
- **高效性**: 减少视觉噪音，突出核心功能，提升工作效率
- **沉浸感**: 深色主题为主，减少眼睛疲劳，适合长时间创作
- **层次分明**: 通过颜色、阴影、间距建立清晰的视觉层级

### 1.2 设计风格
- **现代暗色系**: 以深色为主基调，搭配高对比度的强调色
- **卡片化布局**: 信息模块化，便于扫描和理解
- **微妙动效**: 适度的过渡动画，提升交互反馈
- **留白呼吸**: 合理的间距，避免信息过载

---

## 2. 颜色系统

### 2.1 主色调
```
品牌蓝 (Primary)
- Primary-500: #6366F1 (主色)
- Primary-400: #818CF8 (悬停)
- Primary-600: #4F46E5 (按下)
- Primary-100: rgba(99, 102, 241, 0.1) (背景)
```

### 2.2 语义色
```
成功绿 (Success)
- Success-500: #10B981
- Success-100: rgba(16, 185, 129, 0.1)

警告橙 (Warning)
- Warning-500: #F59E0B
- Warning-100: rgba(245, 158, 11, 0.1)

错误红 (Error)
- Error-500: #EF4444
- Error-100: rgba(239, 68, 68, 0.1)

信息蓝 (Info)
- Info-500: #3B82F6
- Info-100: rgba(59, 130, 246, 0.1)
```

### 2.3 中性色 (暗色主题)
```
背景层级 (由深到浅)
- bg-base:      #0F0F12    (最底层背景)
- bg-surface:   #16161A    (卡片/面板背景)
- bg-elevated:  #1E1E24    (悬浮/弹窗背景)
- bg-overlay:   #26262E    (下拉菜单/工具提示)

文字层级 (由亮到暗)
- text-primary:   #F4F4F5  (主要文字)
- text-secondary: #A1A1AA  (次要文字)
- text-tertiary:  #71717A  (辅助文字)
- text-disabled:  #52525B  (禁用文字)

边框
- border-default: #27272A  (默认边框)
- border-subtle:  #1F1F23  (微妙边框)
- border-focus:   #6366F1  (聚焦边框)
```

---

## 3. 字体系统

### 3.1 字体族
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
```

### 3.2 字号规范
```
Display:  32px / 40px (页面标题)
H1:       24px / 32px (区块标题)
H2:       20px / 28px (卡片标题)
H3:       16px / 24px (小标题)
Body:     14px / 22px (正文)
Small:    13px / 20px (辅助文字)
Caption:  12px / 18px (标签/提示)
Tiny:     11px / 16px (徽章/角标)
```

---

## 4. 间距系统

基于 4px 网格:
```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

---

## 5. 圆角系统

```
--radius-sm:   4px   (小按钮、标签)
--radius-md:   6px   (输入框、小卡片)
--radius-lg:   8px   (卡片、面板)
--radius-xl:   12px  (大卡片、弹窗)
--radius-2xl:  16px  (特殊容器)
--radius-full: 9999px (圆形)
```

---

## 6. 阴影系统

```css
--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md:  0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg:  0 10px 15px rgba(0, 0, 0, 0.5);
--shadow-xl:  0 20px 25px rgba(0, 0, 0, 0.6);

/* 发光效果 (用于强调) */
--glow-primary: 0 0 20px rgba(99, 102, 241, 0.3);
--glow-success: 0 0 20px rgba(16, 185, 129, 0.3);
```

---

## 7. 页面结构

### 7.1 项目列表页
- 顶部: Logo + 搜索 + 用户操作
- 主体: 项目卡片网格 (响应式 2-4 列)
- 卡片: 封面图 + 标题 + 进度 + 标签

### 7.2 项目详情页
- 顶栏: 返回 + 项目名 + 状态 + 操作按钮
- 侧边: 导航菜单 (大纲/角色/剧本/预览)
- 主区: 内容区域 (根据路由切换)

### 7.3 剧本编辑页
- 左侧: 集数导航 (可折叠)
- 中间: 剧本内容编辑器
- 右侧: 工具面板 (上下文/历史/验证)

---

## 8. 组件规范

### 8.1 按钮
- Primary: 实心主色，用于主要操作
- Secondary: 边框样式，用于次要操作
- Ghost: 透明背景，用于工具栏
- Danger: 红色，用于危险操作

尺寸: sm(28px) / md(36px) / lg(44px)

### 8.2 输入框
- 深色背景 (#1E1E24)
- 边框默认隐藏，聚焦时显示主色边框
- 圆角 6px

### 8.3 卡片
- 背景: bg-surface
- 边框: 1px solid border-subtle
- 圆角: 8-12px
- 悬停: 边框变亮 + 微妙阴影

### 8.4 标签/徽章
- 小圆角 (4px)
- 半透明背景
- 紧凑内边距 (4px 8px)

---

## 9. 动效规范

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
```

使用场景:
- 悬停效果: fast
- 展开/折叠: normal
- 页面切换: slow
