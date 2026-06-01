<template>
  <div class="search-input" :class="{ focused, hasValue: modelValue }">
    <div class="input-wrapper">
      <span class="search-icon">🔍</span>
      <input
        ref="inputRef"
        type="text"
        :value="modelValue"
        :placeholder="placeholder"
        @input="handleInput"
        @focus="focused = true"
        @blur="focused = false"
        @keyup.enter="handleSearch"
        @keyup.escape="handleClear"
      />
      <button
        v-if="modelValue && clearable"
        class="clear-btn"
        @click="handleClear"
      >
        ×
      </button>
      <button
        v-if="showButton"
        class="search-btn"
        @click="handleSearch"
      >
        搜索
      </button>
    </div>

    <!-- 搜索建议 -->
    <div
      v-if="showSuggestions && suggestions.length > 0"
      class="suggestions-dropdown"
    >
      <div
        v-for="(suggestion, index) in suggestions"
        :key="index"
        class="suggestion-item"
        :class="{ active: activeSuggestion === index }"
        @click="selectSuggestion(suggestion)"
        @mouseenter="activeSuggestion = index"
      >
        {{ suggestion }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  clearable?: boolean;
  showButton?: boolean;
  suggestions?: string[];
  debounce?: number;
}>(), {
  placeholder: '搜索...',
  clearable: true,
  showButton: false,
  suggestions: () => [],
  debounce: 300,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'search', value: string): void;
  (e: 'clear'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const focused = ref(false);
const showSuggestions = ref(false);
const activeSuggestion = ref(-1);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (props.debounce > 0) {
    debounceTimer = setTimeout(() => {
      emit('search', value);
    }, props.debounce);
  }
};

const handleSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  emit('search', props.modelValue);
  showSuggestions.value = false;
};

const handleClear = () => {
  emit('update:modelValue', '');
  emit('clear');
  inputRef.value?.focus();
};

const selectSuggestion = (suggestion: string) => {
  emit('update:modelValue', suggestion);
  emit('search', suggestion);
  showSuggestions.value = false;
};

watch(() => props.suggestions, (newVal) => {
  showSuggestions.value = newVal.length > 0 && focused.value;
  activeSuggestion.value = -1;
});

watch(focused, (val) => {
  if (val && props.suggestions.length > 0) {
    showSuggestions.value = true;
  } else {
    setTimeout(() => {
      showSuggestions.value = false;
    }, 200);
  }
});
</script>

<style scoped>
.search-input {
  position: relative;
  width: 100%;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: var(--transition-fast);
}

.focused .input-wrapper {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--primary-muted);
}

.search-icon {
  padding: 0 var(--space-3);
  font-size: 13px;
  color: var(--text-muted);
}

input {
  flex: 1;
  padding: var(--space-2) 0;
  border: none;
  outline: none;
  font-size: 13px;
  background: transparent;
  color: var(--text-primary);
}

input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  padding: var(--space-1) var(--space-3);
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: var(--transition-fast);
}

.clear-btn:hover {
  color: var(--text-secondary);
}

.search-btn {
  padding: var(--space-2) var(--space-4);
  border: none;
  background: var(--primary);
  color: var(--text-on-primary);
  cursor: pointer;
  font-size: 12px;
  transition: var(--transition-fast);
}

.search-btn:hover {
  background: var(--primary-hover);
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: var(--space-1);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
}

.suggestion-item {
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: var(--transition-fast);
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--bg-hover);
}
</style>
