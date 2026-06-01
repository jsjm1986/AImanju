<template>
  <div class="pagination" :class="{ simple }">
    <button
      class="page-btn prev"
      :disabled="currentPage <= 1"
      @click="changePage(currentPage - 1)"
    >
      <span v-if="simple">‹</span>
      <span v-else>上一页</span>
    </button>

    <div v-if="!simple" class="page-numbers">
      <button
        v-for="page in visiblePages"
        :key="page"
        class="page-btn number"
        :class="{ active: page === currentPage, ellipsis: page === '...' }"
        :disabled="page === '...'"
        @click="page !== '...' && changePage(page as number)"
      >
        {{ page }}
      </button>
    </div>

    <span v-if="simple" class="page-info">
      {{ currentPage }} / {{ totalPages }}
    </span>

    <button
      class="page-btn next"
      :disabled="currentPage >= totalPages"
      @click="changePage(currentPage + 1)"
    >
      <span v-if="simple">›</span>
      <span v-else>下一页</span>
    </button>

    <div v-if="showJumper && !simple" class="page-jumper">
      <span>跳至</span>
      <input
        type="number"
        v-model.number="jumpPage"
        :min="1"
        :max="totalPages"
        @keyup.enter="handleJump"
      />
      <span>页</span>
      <button class="jump-btn" @click="handleJump">确定</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(defineProps<{
  currentPage: number;
  totalPages: number;
  maxVisible?: number;
  showJumper?: boolean;
  simple?: boolean;
}>(), {
  maxVisible: 7,
  showJumper: false,
  simple: false,
});

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void;
  (e: 'change', page: number): void;
}>();

const jumpPage = ref(props.currentPage);

const visiblePages = computed(() => {
  const pages: (number | string)[] = [];
  const total = props.totalPages;
  const current = props.currentPage;
  const max = props.maxVisible;

  if (total <= max) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    const half = Math.floor(max / 2);

    if (current <= half + 1) {
      for (let i = 1; i <= max - 2; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - half) {
      pages.push(1);
      pages.push('...');
      for (let i = total - max + 3; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }

  return pages;
});

const changePage = (page: number) => {
  if (page < 1 || page > props.totalPages) return;
  emit('update:currentPage', page);
  emit('change', page);
};

const handleJump = () => {
  if (jumpPage.value >= 1 && jumpPage.value <= props.totalPages) {
    changePage(jumpPage.value);
  }
};
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pagination.simple {
  gap: 12px;
}

.page-btn {
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  min-width: 36px;
}

.page-btn:hover:not(:disabled):not(.ellipsis) {
  background: var(--bg-elevated);
  border-color: var(--primary);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
  border-color: var(--primary);
}

.page-btn.ellipsis {
  border: none;
  background: none;
  cursor: default;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-info {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 0 8px;
}

.page-jumper {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.page-jumper input {
  width: 50px;
  padding: 6px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  text-align: center;
}

.jump-btn {
  padding: 6px 12px;
  border: 1px solid var(--primary);
  border-radius: 4px;
  background: white;
  color: var(--primary);
  cursor: pointer;
  font-size: 12px;
}

.jump-btn:hover {
  background: var(--info-muted);
}
</style>
