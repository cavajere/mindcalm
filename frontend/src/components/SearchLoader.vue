<script setup lang="ts">
interface Props {
  visible?: boolean
  message?: string
}

withDefaults(defineProps<Props>(), {
  visible: false,
  message: 'Ricerca in corso...'
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-95 translate-y-2"
    enter-to-class="opacity-100 scale-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 scale-100 translate-y-0"
    leave-to-class="opacity-0 scale-95 translate-y-2"
  >
    <div v-if="visible" class="relative overflow-hidden">
      <!-- Background overlay -->
      <div class="card relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 p-8 backdrop-blur-sm">
        <!-- Animated background pattern -->
        <div class="absolute inset-0 opacity-30">
          <div class="absolute h-32 w-32 animate-pulse rounded-full bg-primary/20 -top-8 -left-8"></div>
          <div class="absolute h-24 w-24 animate-pulse rounded-full bg-secondary/20 -bottom-6 -right-6 animation-delay-1000"></div>
          <div class="absolute h-16 w-16 animate-pulse rounded-full bg-accent/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animation-delay-500"></div>
        </div>
        
        <!-- Content -->
        <div class="relative flex flex-col items-center justify-center text-center">
          <!-- Spinner with multiple rings -->
          <div class="relative mb-6">
            <!-- Outer ring -->
            <div class="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
            <!-- Inner ring -->
            <div class="absolute inset-2 h-12 w-12 animate-spin rounded-full border-4 border-secondary/20 border-b-secondary" style="animation-direction: reverse; animation-duration: 1.5s;"></div>
            <!-- Core -->
            <div class="absolute inset-6 h-4 w-4 animate-pulse rounded-full bg-gradient-to-r from-primary to-secondary"></div>
          </div>
          
          <!-- Text -->
          <div class="space-y-2">
            <p class="text-lg font-semibold text-text-primary">{{ message }}</p>
            <p class="text-sm text-text-secondary animate-pulse">Elaborazione dei risultati più rilevanti</p>
          </div>
          
          <!-- Progress dots -->
          <div class="mt-6 flex space-x-2">
            <div class="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
            <div class="h-2 w-2 animate-bounce rounded-full bg-primary animation-delay-100"></div>
            <div class="h-2 w-2 animate-bounce rounded-full bg-primary animation-delay-200"></div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.animation-delay-100 {
  animation-delay: 0.1s;
}
.animation-delay-200 {
  animation-delay: 0.2s;
}
.animation-delay-500 {
  animation-delay: 0.5s;
}
.animation-delay-1000 {
  animation-delay: 1s;
}
</style>