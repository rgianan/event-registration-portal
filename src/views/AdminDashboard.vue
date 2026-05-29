<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { API_URL, postJson } from '../lib/api.js'

const loadingResponses = ref(false)
const loadingCheckins = ref(false)
const savingNoteId = ref('')
const resendingId = ref('')
const cancellingId = ref('')
const adminError = ref('')
const adminSuccess = ref('')
const isAdmin = ref(false)
const loggingIn = ref(false)
const responses = ref([])
const checkins = ref([])
const lastLoadedAt = ref('')
const activeView = ref('registrations')

const ADMIN_TOKEN_STORAGE = 'eventRegistrationAdminToken'

const sessionToken = ref('')
const currentUser = ref({ email: '', displayName: '', role: '' })
const restoringSession = ref(false)
const admin = reactive({ email: '', password: '', search: '' })
const stats = ref({ total: 0, today: 0, checkedIn: 0, accommodationYes: 0, sasFaculty: 0, student: 0, chedco: 0, resource: 0, other: 0 })

// Per-table filter + sort state. Separate refs for registrations vs. check-ins so
// switching tabs preserves each view's selection.
const regFilters = reactive({ sex: '', region: '', participantType: '' })
const ciFilters = reactive({ sex: '', region: '', participantType: '' })
const regSort = reactive({ key: 'timestamp', dir: 'desc' })
const ciSort = reactive({ key: 'timestamp', dir: 'desc' })

// Build distinct option lists from the loaded rows so the dropdowns reflect what
// the admin can actually filter by.
function uniqueSortedValues(rows, accessor) {
  const set = new Set()
  for (const row of rows) {
    const v = accessor(row)
    if (v) set.add(String(v).trim())
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}
const regSexOptions = computed(() => uniqueSortedValues(responses.value, (r) => r.sexAtBirth))
const regRegionOptions = computed(() => uniqueSortedValues(responses.value, (r) => r.region))
const regTypeOptions = computed(() => uniqueSortedValues(responses.value, (r) => r.participantType))
const ciSexOptions = computed(() => uniqueSortedValues(checkins.value, (r) => r.sexAtBirth))
const ciRegionOptions = computed(() => uniqueSortedValues(checkins.value, (r) => r.region))
const ciTypeOptions = computed(() => uniqueSortedValues(checkins.value, (r) => r.participantType))

function applySort(list, key, dir) {
  if (!key) return list
  const mul = dir === 'asc' ? 1 : -1
  return list.slice().sort((a, b) => {
    const av = a?.[key] ?? ''
    const bv = b?.[key] ?? ''
    // Numeric-aware string compare handles timestamps, codes, and names well.
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * mul
  })
}
function toggleSort(target, key) {
  if (target.key === key) target.dir = target.dir === 'asc' ? 'desc' : 'asc'
  else { target.key = key; target.dir = 'asc' }
}
function sortIndicator(target, key) {
  if (target.key !== key) return ''
  return target.dir === 'asc' ? '▲' : '▼'
}

const filteredResponses = computed(() => {
  const q = admin.search.trim().toLowerCase()
  const fSex = regFilters.sex
  const fRegion = regFilters.region
  const fType = regFilters.participantType
  const matches = responses.value.filter((row) => {
    if (fSex && String(row.sexAtBirth || '').trim() !== fSex) return false
    if (fRegion && String(row.region || '').trim() !== fRegion) return false
    if (fType && String(row.participantType || '').trim() !== fType) return false
    if (!q) return true
    return [
      row.timestamp, row.registrationCode, row.status, row.fullName, row.email,
      row.region, row.affiliation || row.hei, row.contactNumber, row.foodRestrictions,
      row.emergencyContact, row.accommodation, row.accommodationCheckInDate,
      row.accommodationCheckOutDate, row.transportationFromChedToTagaytay,
      row.transportationFromChedToTagaytayJune3, row.transportationFromTagaytayToChed,
      row.participantType, row.currentDesignation, row.breakoutSession1,
      row.breakoutSession4, row.checkInStatus, row.checkInAt, row.checkInMethod,
      row.reviewNote, row.sexAtBirth,
    ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
  })
  return applySort(matches, regSort.key, regSort.dir)
})

const filteredCheckins = computed(() => {
  const q = admin.search.trim().toLowerCase()
  const fSex = ciFilters.sex
  const fRegion = ciFilters.region
  const fType = ciFilters.participantType
  const matches = checkins.value.filter((row) => {
    if (fSex && String(row.sexAtBirth || '').trim() !== fSex) return false
    if (fRegion && String(row.region || '').trim() !== fRegion) return false
    if (fType && String(row.participantType || '').trim() !== fType) return false
    if (!q) return true
    return [
      row.timestamp, row.checkinId, row.registrationCode, row.email, row.fullName,
      row.region, row.affiliation || row.hei, row.participantType, row.status,
      row.method, row.checkedInBy, row.note, row.sexAtBirth,
    ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
  })
  return applySort(matches, ciSort.key, ciSort.dir)
})

// Page-size + pagination state per table. Tables default to 25 rows per page and
// offer 25 / 50 / 100 / All. Returned as a reactive object so the select v-model
// and the displayed counters unwrap cleanly in the template.
const PAGE_SIZE_OPTIONS = [25, 50, 100, 'all']

function usePagination(sourceComputed) {
  const pageSize = ref(25)
  const page = ref(1)
  const totalPages = computed(() =>
    pageSize.value === 'all' ? 1 : Math.max(1, Math.ceil(sourceComputed.value.length / pageSize.value))
  )
  const currentPage = computed(() => Math.min(Math.max(1, page.value), totalPages.value))
  const paged = computed(() => {
    if (pageSize.value === 'all') return sourceComputed.value
    const start = (currentPage.value - 1) * pageSize.value
    return sourceComputed.value.slice(start, start + pageSize.value)
  })
  const rangeStart = computed(() =>
    sourceComputed.value.length === 0 ? 0 : (pageSize.value === 'all' ? 1 : (currentPage.value - 1) * pageSize.value + 1)
  )
  const rangeEnd = computed(() =>
    pageSize.value === 'all' ? sourceComputed.value.length : Math.min(currentPage.value * pageSize.value, sourceComputed.value.length)
  )
  // Jump back to the first page whenever the result set size or page size changes
  // (e.g. after searching, filtering, or reloading the table).
  watch([() => sourceComputed.value.length, pageSize], () => { page.value = 1 })
  function prev() { if (currentPage.value > 1) page.value = currentPage.value - 1 }
  function next() { if (currentPage.value < totalPages.value) page.value = currentPage.value + 1 }
  return reactive({ pageSize, currentPage, totalPages, paged, rangeStart, rangeEnd, prev, next })
}

const regPg = usePagination(filteredResponses)
const ciPg = usePagination(filteredCheckins)

function resetAdminMessages() {
  adminError.value = ''
  adminSuccess.value = ''
}

async function adminLogin() {
  if (loggingIn.value) return
  resetAdminMessages()
  if (!API_URL) return (adminError.value = 'Missing VITE_GAS_WEB_APP_URL.')
  if (!admin.email.trim() || !admin.password) return (adminError.value = 'Enter your email and password.')
  loggingIn.value = true
  try {
    const data = await postJson({ action: 'adminLogin', email: admin.email.trim().toLowerCase(), password: admin.password })
    sessionToken.value = data.sessionToken || ''
    currentUser.value = { email: data.email || '', displayName: data.displayName || '', role: data.role || '' }
    isAdmin.value = true
    admin.password = '' // never keep the password in memory after login
    if (typeof sessionStorage !== 'undefined' && sessionToken.value) sessionStorage.setItem(ADMIN_TOKEN_STORAGE, sessionToken.value)
    adminSuccess.value = data.message || 'Admin access granted.'
    await loadResponses()
  } catch (error) {
    adminError.value = error?.message || 'Admin login failed.'
    isAdmin.value = false
    sessionToken.value = ''
  } finally {
    loggingIn.value = false
  }
}

async function loadResponses() {
  if (!isAdmin.value) return
  loadingResponses.value = true
  resetAdminMessages()
  try {
    const data = await postJson({ action: 'listResponses', sessionToken: sessionToken.value })
    responses.value = Array.isArray(data.rows) ? data.rows : []
    stats.value = data.stats || stats.value
    lastLoadedAt.value = new Date().toLocaleString()
  } catch (error) {
    adminError.value = error?.message || 'Failed to load registrations.'
  } finally {
    loadingResponses.value = false
  }
}

async function loadCheckins() {
  if (!isAdmin.value) return
  loadingCheckins.value = true
  resetAdminMessages()
  try {
    const data = await postJson({ action: 'listCheckins', sessionToken: sessionToken.value, limit: 'all' })
    checkins.value = Array.isArray(data.rows) ? data.rows : []
    lastLoadedAt.value = new Date().toLocaleString()
  } catch (error) {
    adminError.value = error?.message || 'Failed to load check-ins.'
  } finally {
    loadingCheckins.value = false
  }
}

async function switchView(view) {
  activeView.value = view
  if (view === 'registrations' && !responses.value.length) await loadResponses()
  if (view === 'checkins' && !checkins.value.length) await loadCheckins()
}

async function refreshActiveView() {
  if (activeView.value === 'checkins') await loadCheckins()
  else await loadResponses()
}

async function saveReviewNote(row) {
  if (!row?.registrationCode || savingNoteId.value) return
  savingNoteId.value = row.registrationCode
  resetAdminMessages()
  try {
    const data = await postJson({
      action: 'updateReviewNote',
      sessionToken: sessionToken.value,
      registrationCode: row.registrationCode,
      reviewNote: (row.reviewNote || '').trim(),
    })
    row.reviewNote = data.reviewNote || ''
    adminSuccess.value = data.message || 'Review note updated.'
  } catch (error) {
    adminError.value = error?.message || 'Failed to update review note.'
  } finally {
    savingNoteId.value = ''
  }
}

async function resendConfirmation(row) {
  if (!row?.registrationCode || resendingId.value) return
  resendingId.value = row.registrationCode
  resetAdminMessages()
  try {
    const data = await postJson({ action: 'resendConfirmation', sessionToken: sessionToken.value, registrationCode: row.registrationCode })
    adminSuccess.value = data.message || 'Confirmation email resent.'
    row.emailSent = data.emailSent ? 'YES' : row.emailSent
    row.emailError = data.emailError || ''
  } catch (error) {
    adminError.value = error?.message || 'Failed to resend confirmation email.'
  } finally {
    resendingId.value = ''
  }
}

// Workflow: the admin types the cancellation reason into the internal review note
// for the row, then clicks Cancel. The note text becomes both the audit reason
// (persisted to the sheet) AND the body of the cancellation email to the
// participant. Already-cancelled rows are blocked by the backend.
async function cancelConfirmation(row) {
  if (!row?.registrationCode || cancellingId.value) return
  const reason = String(row.reviewNote || '').trim()
  if (!reason) {
    adminError.value = 'Add the cancellation reason in the internal note for this row, then click Cancel confirmation.'
    return
  }
  if (String(row.status || '').toLowerCase() === 'cancelled') {
    adminError.value = 'This registration is already cancelled.'
    return
  }
  if (typeof window !== 'undefined' && !window.confirm(
    'Cancel this registration and email the participant?\n\n' +
    'Reason (from the internal note):\n' + reason
  )) return
  cancellingId.value = row.registrationCode
  resetAdminMessages()
  try {
    const data = await postJson({
      action: 'cancelConfirmation',
      sessionToken: sessionToken.value,
      registrationCode: row.registrationCode,
      reason,
    })
    row.status = data.status || 'Cancelled'
    row.reviewNote = reason
    adminSuccess.value = data.message || 'Registration cancelled.'
  } catch (error) {
    adminError.value = error?.message || 'Failed to cancel registration.'
  } finally {
    cancellingId.value = ''
  }
}

function csvEscape(value) {
  let str = String(value ?? '')
  // Neutralize spreadsheet formula injection: a cell that starts with =, +, -, @,
  // or a leading tab/CR can execute as a formula in Excel/Sheets. Prefix with a
  // single quote so the value is always treated as text.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
  return `"${str.replaceAll('"', '""')}"`
}

function exportCsvClient() {
  const isCheckins = activeView.value === 'checkins'
  const header = isCheckins
    ? ['Timestamp', 'Check-in ID', 'Registration Code', 'Email Address', 'Full Name', 'Region', 'Assigned Sex at Birth', 'Affiliation', 'Participant Type', 'Check-in Status', 'Method', 'Checked In By', 'Note']
    : ['Timestamp', 'Registration Code', 'Status', 'Email Address', 'Full Name', 'Nick Name', 'Assigned Sex at Birth', 'Region', 'Affiliation', 'Contact Number', 'Food Restrictions', 'Emergency Contact', 'Accommodation', 'Accommodation Check-in Date', 'Accommodation Check-out Date', 'CHED to Tagaytay Venue 02 June 2026, 2:00PM', 'CHED to Tagaytay Venue 03 June 2026, 6:00AM', 'Tagaytay Venue to CHED 05 June 2026, 10:00AM', 'Participant Type', 'Current Designation', 'Topic 1', 'Topic 4', 'Email Sent', 'Check-in Status', 'Check-in At', 'Check-in Method', 'Review Note']

  const rows = isCheckins
    ? filteredCheckins.value.map((row) => [row.timestamp, row.checkinId, row.registrationCode, row.email, row.fullName, row.region, row.sexAtBirth, row.affiliation || row.hei, row.participantType, row.status, row.method, row.checkedInBy, row.note])
    : filteredResponses.value.map((row) => [row.timestamp, row.registrationCode, row.status, row.email, row.fullName, row.nickName, row.sexAtBirth, row.region, row.affiliation || row.hei, row.contactNumber, row.foodRestrictions, row.emergencyContact, row.accommodation, row.accommodationCheckInDate, row.accommodationCheckOutDate, row.transportationFromChedToTagaytay, row.transportationFromChedToTagaytayJune3, row.transportationFromTagaytayToChed, row.participantType, row.currentDesignation, row.breakoutSession1, row.breakoutSession4, row.emailSent, row.checkInStatus, row.checkInAt, row.checkInMethod, row.reviewNote])

  const csv = [header, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${isCheckins ? 'event-checkins' : 'event-registrations'}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function logoutAdmin() {
  isAdmin.value = false
  sessionToken.value = ''
  currentUser.value = { email: '', displayName: '', role: '' }
  admin.password = ''
  responses.value = []
  checkins.value = []
  admin.search = ''
  activeView.value = 'registrations'
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ADMIN_TOKEN_STORAGE)
  resetAdminMessages()
}

async function restoreSession() {
  if (typeof sessionStorage === 'undefined') return
  const savedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE)
  if (!savedToken) return
  restoringSession.value = true
  sessionToken.value = savedToken
  isAdmin.value = true
  try {
    await loadResponses() // a valid token loads; an expired one throws -> logout
  } catch {
    logoutAdmin()
  } finally {
    restoringSession.value = false
  }
}

onMounted(() => {
  restoreSession()
  if (typeof document !== 'undefined') {
    let robotsMeta = document.querySelector('meta[name="robots"]')
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.setAttribute('name', 'robots')
      document.head.appendChild(robotsMeta)
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow')
  }
})
</script>

<template>
  <section class="mx-auto w-full max-w-[1500px] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:p-8 min-[1920px]:max-w-none">
    <div v-if="!isAdmin" class="mx-auto max-w-xl rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:rounded-[1.75rem] sm:p-6">
      <h2 class="text-2xl font-bold text-slate-900">Admin dashboard access</h2>
      <p class="mt-2 text-sm text-slate-600">Sign in with your authorized account to view registrations, check-ins, exports, review notes, and QR resend actions.</p>
      <div class="mt-5 space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Email</label>
          <input v-model="admin.email" type="email" placeholder="you@example.com" :disabled="loggingIn" autocomplete="username" @keyup.enter="adminLogin" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Password</label>
          <input v-model="admin.password" type="password" placeholder="Enter password" :disabled="loggingIn" autocomplete="current-password" @keyup.enter="adminLogin" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </div>
        <div v-if="adminError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
        <div v-if="adminSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>
        <button :disabled="loggingIn" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-900" @click="adminLogin">
          <svg v-if="loggingIn" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="4"></circle>
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
          </svg>
          {{ loggingIn ? 'Signing in…' : 'Sign in' }}
        </button>
      </div>
    </div>

    <div v-else>
      <div class="mb-6 flex flex-col gap-4 rounded-[1.5rem] bg-slate-900 p-4 text-white sm:rounded-[1.75rem] sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <h2 class="text-xl font-bold sm:text-2xl">Admin Dashboard</h2>
          <p class="mt-2 text-sm text-slate-300">View registrations, switch to check-in logs, export the active table, save review notes, and resend QR confirmations.</p>
          <p v-if="lastLoadedAt" class="mt-2 text-xs text-slate-400">Last loaded: {{ lastLoadedAt }}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <RouterLink to="/checkin" class="rounded-2xl bg-emerald-400 px-3 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 sm:px-4 sm:text-sm">Open Check-in Module</RouterLink>
          <button class="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:px-4 sm:text-sm" @click="refreshActiveView">Refresh</button>
          <button class="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 sm:px-4 sm:text-sm" @click="exportCsvClient">Export CSV</button>
          <button class="rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 sm:px-4 sm:text-sm" @click="logoutAdmin">Logout</button>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-8">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p class="text-xs uppercase tracking-wide text-slate-500">Total</p><p class="mt-2 text-3xl font-bold text-slate-900">{{ stats.total }}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p class="text-xs uppercase tracking-wide text-slate-500">Today</p><p class="mt-2 text-3xl font-bold text-slate-900">{{ stats.today }}</p></div>
        <div class="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p class="text-xs uppercase tracking-wide text-violet-700">Checked in</p><p class="mt-2 text-3xl font-bold text-violet-950">{{ stats.checkedIn }}</p></div>
        <div class="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p class="text-xs uppercase tracking-wide text-blue-700">Accommodation</p><p class="mt-2 text-3xl font-bold text-blue-950">{{ stats.accommodationYes }}</p></div>
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p class="text-xs uppercase tracking-wide text-emerald-700">SAS/Guidance/Faculty</p><p class="mt-2 text-3xl font-bold text-emerald-950">{{ stats.sasFaculty }}</p></div>
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p class="text-xs uppercase tracking-wide text-amber-700">Students</p><p class="mt-2 text-3xl font-bold text-amber-950">{{ stats.student }}</p></div>
        <div class="rounded-2xl border border-sky-200 bg-sky-50 p-4"><p class="text-xs uppercase tracking-wide text-sky-700">CHEDCO</p><p class="mt-2 text-3xl font-bold text-sky-950">{{ stats.chedco }}</p></div>
        <div class="rounded-2xl border border-orange-200 bg-orange-50 p-4"><p class="text-xs uppercase tracking-wide text-orange-700">Resource</p><p class="mt-2 text-3xl font-bold text-orange-950">{{ stats.resource }}</p></div>
      </div>

      <div class="mb-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="grid grid-cols-2 gap-2 sm:flex">
            <button class="rounded-2xl px-4 py-2 text-sm font-bold transition" :class="activeView === 'registrations' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'" @click="switchView('registrations')">
              Registrations
            </button>
            <button class="rounded-2xl px-4 py-2 text-sm font-bold transition" :class="activeView === 'checkins' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'" @click="switchView('checkins')">
              Check-ins
            </button>
          </div>
          <input v-model="admin.search" type="search" :placeholder="activeView === 'checkins' ? 'Search check-ins by code, name, email, method, note' : 'Search registrations by code, name, email, region, affiliation, session, food restriction'" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 outline-none transition focus:border-slate-900 lg:max-w-xl" />
        </div>
        <!-- Filters: independent state per view so switching tabs preserves each one's selection -->
        <div v-if="activeView === 'registrations'" class="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span class="font-semibold uppercase tracking-wide text-slate-500">Filter:</span>
          <select v-model="regFilters.sex" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All sex</option>
            <option v-for="opt in regSexOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <select v-model="regFilters.region" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All regions</option>
            <option v-for="opt in regRegionOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <select v-model="regFilters.participantType" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All participant types</option>
            <option v-for="opt in regTypeOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <button v-if="regFilters.sex || regFilters.region || regFilters.participantType" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-900" @click="regFilters.sex = regFilters.region = regFilters.participantType = ''">Clear filters</button>
          <span class="ml-auto text-slate-500">Showing {{ filteredResponses.length }} of {{ responses.length }}</span>
        </div>
        <div v-else class="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span class="font-semibold uppercase tracking-wide text-slate-500">Filter:</span>
          <select v-model="ciFilters.sex" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All sex</option>
            <option v-for="opt in ciSexOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <select v-model="ciFilters.region" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All regions</option>
            <option v-for="opt in ciRegionOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <select v-model="ciFilters.participantType" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All participant types</option>
            <option v-for="opt in ciTypeOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <button v-if="ciFilters.sex || ciFilters.region || ciFilters.participantType" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-900" @click="ciFilters.sex = ciFilters.region = ciFilters.participantType = ''">Clear filters</button>
          <span class="ml-auto text-slate-500">Showing {{ filteredCheckins.length }} of {{ checkins.length }}</span>
        </div>
      </div>

      <div v-if="adminError" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
      <div v-if="adminSuccess" class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>

      <div v-if="activeView === 'registrations'" class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        <div class="w-full overflow-x-auto">
          <table class="w-full min-w-[1780px] table-fixed divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="w-[120px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(regSort, 'timestamp')">Timestamp {{ sortIndicator(regSort, 'timestamp') }}</button></th>
                <th class="w-[110px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(regSort, 'registrationCode')">Code {{ sortIndicator(regSort, 'registrationCode') }}</button></th>
                <th class="w-[220px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(regSort, 'fullName')">Participant {{ sortIndicator(regSort, 'fullName') }}</button></th>
                <th class="w-[210px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(regSort, 'region')">Region / Affiliation {{ sortIndicator(regSort, 'region') }}</button></th>
                <th class="w-[190px] px-2 py-3">Logistics</th>
                <th class="w-[210px] px-2 py-3">Topics</th>
                <th class="w-[170px] px-2 py-3">Email / QR</th>
                <th class="w-[160px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(regSort, 'checkInStatus')">Check-in {{ sortIndicator(regSort, 'checkInStatus') }}</button></th>
                <th class="w-[220px] px-2 py-3">Review Note / Cancellation reason</th>
                <th class="w-[170px] px-2 py-3">Actions</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-if="loadingResponses">
                <td colspan="10" class="px-4 py-10 text-center text-slate-500">Loading registrations…</td>
              </tr>
              <tr v-else-if="!filteredResponses.length">
                <td colspan="10" class="px-4 py-10 text-center text-slate-500">No registrations match the current filters.</td>
              </tr>

              <tr v-for="row in regPg.paged" :key="row.registrationCode" class="align-top" :class="String(row.status || '').toLowerCase() === 'cancelled' ? 'bg-rose-50/40' : ''">
                <td class="px-2 py-3 text-slate-600 break-words">{{ row.timestamp }}</td>
                <td class="px-2 py-3 font-mono font-bold text-slate-900 break-all">{{ row.registrationCode }}</td>
                <td class="px-2 py-3 text-slate-700">
                  <p class="font-semibold text-slate-900 break-words">{{ row.fullName }}</p>
                  <p class="text-xs text-slate-500 break-all">{{ row.email }}</p>
                  <p class="mt-1 text-xs text-slate-500">Sex: {{ row.sexAtBirth || '—' }} · Nick: {{ row.nickName || '—' }}</p>
                  <p class="text-xs text-slate-500">Contact: {{ row.contactNumber || '—' }}</p>
                  <p class="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{{ row.participantType }}</p>
                  <p v-if="String(row.status || '').toLowerCase() === 'cancelled'" class="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold uppercase text-rose-800">Cancelled</p>
                  <p v-if="row.currentDesignation" class="mt-1 text-xs text-slate-500">{{ row.currentDesignation }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words">
                  <p class="font-medium text-slate-900">{{ row.region }}</p>
                  <p class="mt-1">{{ row.affiliation || row.hei }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words text-xs">
                  <p><span class="font-semibold">Food:</span> {{ row.foodRestrictions || '—' }}</p>
                  <p class="mt-1"><span class="font-semibold">Accommodation:</span> {{ row.accommodation || '—' }}</p>
                  <p v-if="row.accommodation === 'Yes'" class="text-slate-500">{{ row.accommodationCheckInDate || '—' }} → {{ row.accommodationCheckOutDate || '—' }}</p>
                  <p v-if="row.transportationFromChedToTagaytay === 'YES'" class="text-slate-500">CHED→Tagaytay 06/02 2PM</p>
                  <p v-if="row.transportationFromChedToTagaytayJune3 === 'YES'" class="text-slate-500">CHED→Tagaytay 06/03 6AM</p>
                  <p v-if="row.transportationFromTagaytayToChed === 'YES'" class="text-slate-500">Tagaytay→CHED 06/05 10AM</p>
                  <p class="mt-1"><span class="font-semibold">Emergency:</span> {{ row.emergencyContact || '—' }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words text-xs">
                  <p><span class="font-semibold">Topic 1:</span> {{ row.breakoutSession1 || '—' }}</p>
                  <p class="mt-2"><span class="font-semibold">Topic 4:</span> {{ row.breakoutSession4 || '—' }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words text-xs">
                  <p>Sent: <span class="font-semibold">{{ row.emailSent || '—' }}</span></p>
                  <p v-if="row.emailError" class="mt-1 text-rose-600">{{ row.emailError }}</p>
                  <a v-if="row.qrImageUrl" :href="row.qrImageUrl" target="_blank" rel="noopener noreferrer" class="mt-1 inline-flex font-semibold text-slate-900 underline">Open QR</a>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold" :class="row.checkInStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'">
                    {{ row.checkInStatus || 'NOT_CHECKED_IN' }}
                  </span>
                  <p v-if="row.checkInAt" class="mt-1 text-xs text-slate-600">{{ row.checkInAt }}</p>
                  <p v-if="row.checkInMethod" class="text-xs text-slate-500">{{ row.checkInMethod }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700">
                  <textarea v-model="row.reviewNote" rows="4" placeholder="Internal note — type the cancellation reason here before clicking Cancel confirmation" class="min-h-[88px] w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none transition focus:border-slate-900"></textarea>
                </td>
                <td class="px-2 py-3">
                  <div class="flex flex-col gap-1.5">
                    <button class="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="savingNoteId === row.registrationCode" @click="saveReviewNote(row)">
                      {{ savingNoteId === row.registrationCode ? 'Saving…' : 'Save note' }}
                    </button>
                    <button class="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="resendingId === row.registrationCode || String(row.status || '').toLowerCase() === 'cancelled'" @click="resendConfirmation(row)">
                      {{ resendingId === row.registrationCode ? 'Sending…' : 'Resend QR' }}
                    </button>
                    <button class="w-full rounded-xl border border-rose-300 px-2 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50" :disabled="cancellingId === row.registrationCode || String(row.status || '').toLowerCase() === 'cancelled'" @click="cancelConfirmation(row)">
                      {{ cancellingId === row.registrationCode ? 'Cancelling…' : (String(row.status || '').toLowerCase() === 'cancelled' ? 'Cancelled' : 'Cancel confirmation') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2 text-slate-600">
            <label class="font-medium">Rows per page</label>
            <select v-model="regPg.pageSize" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <option v-for="opt in PAGE_SIZE_OPTIONS" :key="opt" :value="opt">{{ opt === 'all' ? 'All' : opt }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3 text-slate-600">
            <span>{{ regPg.rangeStart }}–{{ regPg.rangeEnd }} of {{ filteredResponses.length }}</span>
            <div class="flex gap-2">
              <button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="regPg.currentPage <= 1" @click="regPg.prev()">Prev</button>
              <button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="regPg.currentPage >= regPg.totalPages" @click="regPg.next()">Next</button>
            </div>
            <span class="text-slate-500">Page {{ regPg.currentPage }} of {{ regPg.totalPages }}</span>
          </div>
        </div>
      </div>

      <div v-else class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        <div class="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Check-ins Table</h3>
            <p class="mt-1 text-sm text-slate-600">Latest {{ checkins.length }} successful check-ins from the Checkins sheet.</p>
          </div>
          <button class="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900" @click="loadCheckins">{{ loadingCheckins ? 'Loading…' : 'Refresh Check-ins' }}</button>
        </div>
        <div class="w-full overflow-x-auto">
          <table class="w-full min-w-[1320px] table-fixed divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="w-[140px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(ciSort, 'timestamp')">Timestamp {{ sortIndicator(ciSort, 'timestamp') }}</button></th>
                <th class="w-[120px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(ciSort, 'registrationCode')">Code {{ sortIndicator(ciSort, 'registrationCode') }}</button></th>
                <th class="w-[230px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(ciSort, 'fullName')">Participant {{ sortIndicator(ciSort, 'fullName') }}</button></th>
                <th class="w-[240px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(ciSort, 'region')">Region / Affiliation {{ sortIndicator(ciSort, 'region') }}</button></th>
                <th class="w-[160px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(ciSort, 'participantType')">Type {{ sortIndicator(ciSort, 'participantType') }}</button></th>
                <th class="w-[120px] px-2 py-3"><button type="button" class="font-semibold hover:text-slate-900" @click="toggleSort(ciSort, 'method')">Method {{ sortIndicator(ciSort, 'method') }}</button></th>
                <th class="w-[130px] px-2 py-3">Checked By</th>
                <th class="w-[180px] px-2 py-3">Note</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-if="loadingCheckins">
                <td colspan="8" class="px-4 py-10 text-center text-slate-500">Loading check-ins…</td>
              </tr>
              <tr v-else-if="!filteredCheckins.length">
                <td colspan="8" class="px-4 py-10 text-center text-slate-500">No check-ins match the current filters.</td>
              </tr>
              <tr v-for="row in ciPg.paged" :key="row.checkinId || `${row.registrationCode}-${row.timestamp}`" class="align-top">
                <td class="px-2 py-3 text-slate-600 break-words">{{ row.timestamp }}</td>
                <td class="px-2 py-3 font-mono font-bold text-slate-900 break-all">{{ row.registrationCode }}</td>
                <td class="px-2 py-3 text-slate-700">
                  <p class="font-semibold text-slate-900 break-words">{{ row.fullName }}</p>
                  <p class="text-xs text-slate-500 break-all">{{ row.email }}</p>
                  <p class="mt-1 text-xs text-slate-500">Sex: {{ row.sexAtBirth || '—' }}</p>
                  <p class="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{{ row.status || 'CHECKED_IN' }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words">
                  <p class="font-medium text-slate-900">{{ row.region }}</p>
                  <p class="mt-1">{{ row.affiliation || row.hei }}</p>
                </td>
                <td class="px-2 py-3 text-slate-700 break-words">{{ row.participantType || '—' }}</td>
                <td class="px-2 py-3 text-slate-700 break-words">{{ row.method || '—' }}</td>
                <td class="px-2 py-3 text-slate-700 break-words">{{ row.checkedInBy || '—' }}</td>
                <td class="px-2 py-3 text-slate-700 break-words">{{ row.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2 text-slate-600">
            <label class="font-medium">Rows per page</label>
            <select v-model="ciPg.pageSize" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <option v-for="opt in PAGE_SIZE_OPTIONS" :key="opt" :value="opt">{{ opt === 'all' ? 'All' : opt }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3 text-slate-600">
            <span>{{ ciPg.rangeStart }}–{{ ciPg.rangeEnd }} of {{ filteredCheckins.length }}</span>
            <div class="flex gap-2">
              <button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="ciPg.currentPage <= 1" @click="ciPg.prev()">Prev</button>
              <button type="button" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="ciPg.currentPage >= ciPg.totalPages" @click="ciPg.next()">Next</button>
            </div>
            <span class="text-slate-500">Page {{ ciPg.currentPage }} of {{ ciPg.totalPages }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
