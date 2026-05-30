<template>
  <main class="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-3 py-6 sm:px-6 sm:py-10">
    <div class="mx-auto w-full max-w-[1400px] min-[1920px]:max-w-none">
      <div class="mb-6 rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:mb-8">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">Commission on Higher Education - Office of Student Development and Services</p>
        <h1 class="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">Ginhawa Student Wellbeing Summit</h1>
        <p class="mt-3 max-w-3xl text-sm text-slate-600">
          Inspiring Wellness, Leadership, and Purpose in Higher Education | June 3-4, 2026 | Twin Lakes Hotel, Tagaytay-Nasugbu Highway, Laurel, Batangas
        </p>
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
