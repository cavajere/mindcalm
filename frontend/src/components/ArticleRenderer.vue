<script setup lang="ts">
defineProps<{ html: string }>()
</script>

<template>
  <div class="article-content" v-html="html"></div>
</template>

<style scoped>
.article-content {
  @apply text-[1.04rem];
}

.article-content :deep(> *:first-child) {
  @apply mt-0;
}

.article-content :deep(h2) {
  @apply mt-12 mb-5 text-2xl font-bold tracking-tight text-slate-950;
}

.article-content :deep(h3) {
  @apply mt-10 mb-4 text-xl font-semibold tracking-tight text-slate-900;
}

.article-content :deep(h4) {
  @apply mt-8 mb-3 text-lg font-semibold text-slate-900;
}

.article-content :deep(p) {
  @apply mb-5 text-[1.04rem] leading-8 text-slate-600;
}

.article-content :deep(p:first-of-type) {
  @apply text-lg leading-8 text-slate-700;
}

.article-content :deep(ul),
.article-content :deep(ol) {
  @apply mb-6 pl-6 text-[1.02rem] leading-8 text-slate-600;
}

.article-content :deep(ul) {
  @apply list-disc;
}

.article-content :deep(ol) {
  @apply list-decimal;
}

.article-content :deep(li) {
  @apply mb-2;
}

.article-content :deep(a) {
  @apply text-primary underline hover:text-primary-dark;
}

.article-content :deep(blockquote) {
  @apply my-8 rounded-r-2xl border-l-4 border-primary/30 bg-primary/5 px-5 py-4 text-slate-700;
}

.article-content :deep(img) {
  @apply my-8 max-w-full rounded-2xl;
}

.article-content :deep(strong) {
  @apply font-semibold text-slate-950;
}

.article-content :deep(hr) {
  @apply my-10 border-t border-slate-200;
}

.article-content :deep(code) {
  @apply rounded bg-slate-100 px-1.5 py-0.5 text-[0.95em] text-slate-800;
}
</style>
