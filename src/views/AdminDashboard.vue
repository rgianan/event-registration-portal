<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { API_URL, postJson } from '../lib/api.js'

const loadingResponses = ref(false)
const loadingCheckins = ref(false)
const savingNoteId = ref('')
const resendingId = ref('')
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

const filteredResponses = computed(() => {
  const q = admin.search.trim().toLowerCase()
  if (!q) return responses.value
  return responses.value.filter((row) =>
    [
      row.timestamp,
      row.registrationCode,
      row.status,
      row.fullName,
      row.email,
      row.region,
      row.affiliation || row.hei,
      row.contactNumber,
      row.foodRestrictions,
      row.emergencyContact,
      row.accommodation,
      row.accommodationCheckInDate,
      row.accommodationCheckOutDate,
      row.transportationFromChedToTagaytay,
      row.transportationFromChedToTagaytayJune3,
      row.transportationFromTagaytayToChed,
      row.participantType,
      row.currentDesignation,
      row.breakoutSession1,
      row.breakoutSession4,
      row.checkInStatus,
      row.checkInAt,
      row.checkInMethod,
      row.reviewNote,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
})

const filteredCheckins = computed(() => {
  const q = admin.search.trim().toLowerCase()
  if (!q) return checkins.value
  return checkins.value.filter((row) =>
    [
      row.timestamp,
      row.checkinId,
      row.registrationCode,
      row.email,
      row.fullName,
      row.region,
      row.affiliation || row.hei,
      row.participantType,
      row.status,
      row.method,
      row.checkedInBy,
      row.note,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
})

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
    const data = await postJson({ action: 'listCheckins', sessionToken: sessionToken.value, limit: 200 })
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
    ? ['Timestamp', 'Check-in ID', 'Registration Code', 'Email Address', 'Full Name', 'Region', 'Affiliation', 'Participant Type', 'Check-in Status', 'Method', 'Checked In By', 'Note']
    : ['Timestamp', 'Registration Code', 'Status', 'Email Address', 'Full Name', 'Nick Name', 'Assigned Sex at Birth', 'Region', 'Affiliation', 'Contact Number', 'Food Restrictions', 'Emergency Contact', 'Accommodation', 'Accommodation Check-in Date', 'Accommodation Check-out Date', 'CHED to Tagaytay Venue 02 June 2026, 2:00PM', 'CHED to Tagaytay Venue 03 June 2026, 6:00AM', 'Tagaytay Venue to CHED 05 June 2026, 10:00AM', 'Participant Type', 'Current Designation', 'Topic 1', 'Topic 4', 'Email Sent', 'Check-in Status', 'Check-in At', 'Check-in Method', 'Review Note']

  const rows = isCheckins
    ? filteredCheckins.value.map((row) => [row.timestamp, row.checkinId, row.registrationCode, row.email, row.fullName, row.region, row.affiliation || row.hei, row.participantType, row.status, row.method, row.checkedInBy, row.note])
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

      <div class="mb-4 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="grid grid-cols-2 gap-2 sm:flex">
          <button class="rounded-2xl px-4 py-2 text-sm font-bold transition" :class="activeView === 'registrations' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'" @click="switchView('registrations')">
            Registrations
          </button>
          <button class="rounded-2xl px-4 py-2 text-sm font-bold transition" :class="activeView === 'checkins' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'" @click="switchView('checkins')">
            Check-ins
          </button>
        </div>
        <input v-model="admin.search" type="search" :placeholder="activeView === 'checkins' ? 'Search check-ins by code, name, email, method, note' : 'Search registrations by code, name, email, region, affiliation, session, food restriction'" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 lg:max-w-xl" />
      </div>

      <div v-if="adminError" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
      <div v-if="adminSuccess" class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>

      <div v-if="activeView === 'registrations'" class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        <div class="w-full overflow-x-auto">
          <table class="w-full min-w-[1650px] table-fixed divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="w-[140px] px-3 py-3">Timestamp</th>
                <th class="w-[140px] px-3 py-3">Code</th>
                <th class="w-[230px] px-3 py-3">Participant</th>
                <th class="w-[260px] px-3 py-3">Region / Affiliation</th>
                <th class="w-[230px] px-3 py-3">Logistics</th>
                <th class="w-[300px] px-3 py-3">Topics Interested to Join</th>
                <th class="w-[210px] px-3 py-3">Email / QR</th>
                <th class="w-[190px] px-3 py-3">Check-in</th>
                <th class="w-[240px] px-3 py-3">Review Note</th>
                <th class="w-[130px] px-3 py-3">Actions</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-if="loadingResponses">
                <td colspan="10" class="px-4 py-10 text-center text-slate-500">Loading registrations…</td>
              </tr>
              <tr v-else-if="!filteredResponses.length">
                <td colspan="10" class="px-4 py-10 text-center text-slate-500">No registrations found.</td>
              </tr>

              <tr v-for="row in filteredResponses" :key="row.registrationCode" class="align-top">
                <td class="px-3 py-4 text-slate-600 break-words">{{ row.timestamp }}</td>
                <td class="px-3 py-4 font-mono font-bold text-slate-900 break-all">{{ row.registrationCode }}</td>
                <td class="px-3 py-4 text-slate-700">
                  <p class="font-semibold text-slate-900 break-words">{{ row.fullName }}</p>
                  <p class="text-xs text-slate-500 break-all">{{ row.email }}</p>
                  <p class="mt-2 text-xs text-slate-500">Nickname: {{ row.nickName || '—' }}</p>
                  <p class="text-xs text-slate-500">Sex: {{ row.sexAtBirth || '—' }}</p>
                  <p class="text-xs text-slate-500">Contact: {{ row.contactNumber || '—' }}</p>
                  <p class="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{{ row.participantType }}</p>
                  <p v-if="row.currentDesignation" class="mt-1 text-xs text-slate-500">{{ row.currentDesignation }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">
                  <p class="font-medium text-slate-900">{{ row.region }}</p>
                  <p class="mt-1">{{ row.affiliation || row.hei }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">
                  <p><span class="font-semibold">Food:</span> {{ row.foodRestrictions || '—' }}</p>
                  <p class="mt-2"><span class="font-semibold">Accommodation:</span> {{ row.accommodation || '—' }}</p>
                  <p v-if="row.accommodation === 'Yes'" class="mt-1 text-xs text-slate-500">{{ row.accommodationCheckInDate || '—' }} to {{ row.accommodationCheckOutDate || '—' }}</p>
                  <p v-if="row.transportationFromChedToTagaytay === 'YES'" class="mt-1 text-xs text-slate-500"><span class="font-semibold">CHED to Tagaytay Venue 02 June 2026, 2:00PM:</span> YES</p>
                  <p v-if="row.transportationFromChedToTagaytayJune3 === 'YES'" class="mt-1 text-xs text-slate-500"><span class="font-semibold">CHED to Tagaytay Venue 03 June 2026, 6:00AM:</span> YES</p>
                  <p v-if="row.transportationFromTagaytayToChed === 'YES'" class="mt-1 text-xs text-slate-500"><span class="font-semibold">Tagaytay Venue to CHED 05 June 2026, 10:00AM:</span> YES</p>
                  <p class="mt-2"><span class="font-semibold">Emergency:</span> {{ row.emergencyContact || '—' }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">
                  <p><span class="font-semibold">Topic 1:</span> {{ row.breakoutSession1 }}</p>
                  <p class="mt-3"><span class="font-semibold">Topic 4:</span> {{ row.breakoutSession4 }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">
                  <p>Email sent: <span class="font-semibold">{{ row.emailSent || '—' }}</span></p>
                  <p v-if="row.emailError" class="mt-1 text-xs text-rose-600">{{ row.emailError }}</p>
                  <a v-if="row.qrImageUrl" :href="row.qrImageUrl" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex text-xs font-semibold text-slate-900 underline">Open QR</a>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">
                  <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold" :class="row.checkInStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'">
                    {{ row.checkInStatus || 'NOT_CHECKED_IN' }}
                  </span>
                  <p v-if="row.checkInAt" class="mt-2 text-xs text-slate-600">{{ row.checkInAt }}</p>
                  <p v-if="row.checkInMethod" class="mt-1 text-xs text-slate-500">{{ row.checkInMethod }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700">
                  <textarea v-model="row.reviewNote" rows="4" placeholder="Internal note" class="min-h-[96px] w-full min-w-[200px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900"></textarea>
                </td>
                <td class="px-3 py-4">
                  <div class="flex flex-col gap-2">
                    <button class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="savingNoteId === row.registrationCode" @click="saveReviewNote(row)">
                      {{ savingNoteId === row.registrationCode ? 'Saving…' : 'Save note' }}
                    </button>
                    <button class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="resendingId === row.registrationCode" @click="resendConfirmation(row)">
                      {{ resendingId === row.registrationCode ? 'Sending…' : 'Resend QR' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
          <table class="w-full min-w-[1200px] table-fixed divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="w-[150px] px-3 py-3">Timestamp</th>
                <th class="w-[140px] px-3 py-3">Code</th>
                <th class="w-[250px] px-3 py-3">Participant</th>
                <th class="w-[280px] px-3 py-3">Region / Affiliation</th>
                <th class="w-[150px] px-3 py-3">Type</th>
                <th class="w-[140px] px-3 py-3">Method</th>
                <th class="w-[130px] px-3 py-3">Checked By</th>
                <th class="w-[220px] px-3 py-3">Note</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-if="loadingCheckins">
                <td colspan="8" class="px-4 py-10 text-center text-slate-500">Loading check-ins…</td>
              </tr>
              <tr v-else-if="!filteredCheckins.length">
                <td colspan="8" class="px-4 py-10 text-center text-slate-500">No check-ins found.</td>
              </tr>
              <tr v-for="row in filteredCheckins" :key="row.checkinId || `${row.registrationCode}-${row.timestamp}`" class="align-top">
                <td class="px-3 py-4 text-slate-600 break-words">{{ row.timestamp }}</td>
                <td class="px-3 py-4 font-mono font-bold text-slate-900 break-all">{{ row.registrationCode }}</td>
                <td class="px-3 py-4 text-slate-700">
                  <p class="font-semibold text-slate-900 break-words">{{ row.fullName }}</p>
                  <p class="text-xs text-slate-500 break-all">{{ row.email }}</p>
                  <p class="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">{{ row.status || 'CHECKED_IN' }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">
                  <p class="font-medium text-slate-900">{{ row.region }}</p>
                  <p class="mt-1">{{ row.affiliation || row.hei }}</p>
                </td>
                <td class="px-3 py-4 text-slate-700 break-words">{{ row.participantType || '—' }}</td>
                <td class="px-3 py-4 text-slate-700 break-words">{{ row.method || '—' }}</td>
                <td class="px-3 py-4 text-slate-700 break-words">{{ row.checkedInBy || '—' }}</td>
                <td class="px-3 py-4 text-slate-700 break-words">{{ row.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
