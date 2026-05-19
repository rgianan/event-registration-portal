<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <main class="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-3 py-6 sm:px-6 sm:py-10">
    <div class="mx-auto w-full max-w-[1400px] min-[1920px]:max-w-none">
      <div class="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">Commission on Higher Education - Office of Student Development and Services</p>
          <h1 class="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">Ginhawa Student Wellbeing Summit</h1>
          <p class="mt-3 max-w-3xl text-sm text-slate-600">
            Inspiring Wellness, Leadership, and Purpose in Higher Education | June 3-4, 2026.
          </p>
        </div>
        <div class="inline-flex w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1 md:w-auto">
          <router-link
            to="/"
            class="flex-1 whitespace-nowrap rounded-2xl px-3 py-2 text-center text-xs font-semibold transition sm:px-4 sm:text-sm md:flex-none"
            :class="route.name === 'public' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'"
          >
            Registration Form
          </router-link>
          <router-link
            to="/admin"
            rel="nofollow"
            class="flex-1 whitespace-nowrap rounded-2xl px-3 py-2 text-center text-xs font-semibold transition sm:px-4 sm:text-sm md:flex-none"
            :class="route.name === 'admin' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'"
          >
            Admin Dashboard
          </router-link>
          <router-link
            to="/checkin"
            rel="nofollow"
            class="flex-1 whitespace-nowrap rounded-2xl px-3 py-2 text-center text-xs font-semibold transition sm:px-4 sm:text-sm md:flex-none"
            :class="route.name === 'checkin' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'"
          >
            Check-in
          </router-link>
        </div>
      </div>

      <router-view v-slot="{ Component }">
        <Suspense>
          <component :is="Component" />
          <template #fallback>
            <div class="mx-auto w-full max-w-5xl rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-xl shadow-slate-200/60 sm:rounded-[2rem]">
              Loading…
            </div>
          </template>
        </Suspense>
      </router-view>
    </div>
  </main>
</template>
