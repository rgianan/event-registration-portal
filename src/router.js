import { createRouter, createWebHistory } from 'vue-router'
import PublicForm from './views/PublicForm.vue'

const routes = [
  { path: '/', name: 'public', component: PublicForm },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/AdminDashboard.vue'),
    meta: { noindex: true },
  },
  {
    path: '/checkin',
    name: 'checkin',
    component: () => import('./views/AdminCheckIn.vue'),
    meta: { noindex: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  if (typeof document === 'undefined') return
  let robotsMeta = document.querySelector('meta[name="robots"]')
  if (to.meta?.noindex) {
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.setAttribute('name', 'robots')
      document.head.appendChild(robotsMeta)
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow')
  } else if (robotsMeta) {
    robotsMeta.parentNode.removeChild(robotsMeta)
  }
})

export default router
