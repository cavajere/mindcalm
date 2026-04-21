<template>
  <div class="app-shell">
    <header class="topbar">
      <NuxtLink to="/" class="brand">MindCalm</NuxtLink>
      <nav class="nav">
        <NuxtLink to="/audio">Audio</NuxtLink>
        <NuxtLink to="/posts">Articoli</NuxtLink>
        <NuxtLink to="/events">Eventi</NuxtLink>
      </nav>
    </header>

    <main class="container">
      <NuxtPage />
    </main>

    <footer class="footer">
      <NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>
      <NuxtLink to="/termini-e-condizioni">Termini e condizioni</NuxtLink>
    </footer>
  </div>
</template>
