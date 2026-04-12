<script setup lang="ts">
defineProps<{
  columns: { key: string; label: string; align?: 'left' | 'center' | 'right' }[]
  data: any[]
  loading?: boolean
}>()
</script>

<template>
  <div class="table-container">
    <table class="w-full">
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="[
              'px-4 py-3 text-xs font-medium text-text-secondary uppercase',
              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
            ]"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-50">
        <tr v-if="loading">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-text-secondary">Caricamento...</td>
        </tr>
        <tr v-else-if="!data.length">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-text-secondary">Nessun dato</td>
        </tr>
        <template v-else>
          <tr v-for="(row, i) in data" :key="i" class="hover:bg-gray-50/50">
            <td
              v-for="col in columns"
              :key="col.key"
              :class="[
                'px-4 py-3 text-sm',
                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
              ]"
            >
              <slot :name="col.key" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
