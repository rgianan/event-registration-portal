<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { API_URL, postJson } from '../lib/api.js'

const ADMIN_KEY_STORAGE = 'eventRegistrationAdminKey'
const route = useRoute()

const admin = reactive({ key: '' })
const isAdmin = ref(false)
const loggingIn = ref(false)
const checkingIn = ref(false)
const loadingRecent = ref(false)
const adminError = ref('')
const adminSuccess = ref('')
const manualCode = ref('')
const checkInNote = ref('')
const recentCheckins = ref([])
const lastResult = ref(null)

const scannerActive = ref(false)
const scannerError = ref('')
const scannerStatus = ref('Scanner is off.')
const videoRef = ref(null)
let stream = null
let detector = null
let scanFrame = 0
let lastScanText = ''
let lastScanAt = 0

const canUseScanner = computed(() => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator?.mediaDevices?.getUserMedia)

function resetMessages() {
  adminError.value = ''
  adminSuccess.value = ''
}

async function adminLogin() {
  if (loggingIn.value) return
  resetMessages()
  if (!API_URL) return (adminError.value = 'Missing VITE_GAS_WEB_APP_URL.')
  if (!admin.key.trim()) return (adminError.value = 'Enter the admin key.')
  loggingIn.value = true
  try {
    const data = await postJson({ action: 'adminLogin', adminKey: admin.key.trim() })
    isAdmin.value = true
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(ADMIN_KEY_STORAGE, admin.key.trim())
    adminSuccess.value = data.message || 'Admin access granted.'
    await loadRecentCheckins()
  } catch (error) {
    adminError.value = error?.message || 'Admin login failed.'
    isAdmin.value = false
  } finally {
    loggingIn.value = false
  }
}

function logoutAdmin() {
  stopScanner()
  isAdmin.value = false
  admin.key = ''
  manualCode.value = ''
  lastResult.value = null
  recentCheckins.value = []
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ADMIN_KEY_STORAGE)
  resetMessages()
}

async function loadRecentCheckins() {
  if (!isAdmin.value) return
  loadingRecent.value = true
  resetMessages()
  try {
    const data = await postJson({ action: 'listCheckins', adminKey: admin.key.trim(), limit: 30 })
    recentCheckins.value = Array.isArray(data.rows) ? data.rows : []
  } catch (error) {
    adminError.value = error?.message || 'Failed to load recent check-ins.'
  } finally {
    loadingRecent.value = false
  }
}

function compactCode(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase()
}

async function submitManualCheckIn() {
  await checkInParticipant(manualCode.value, 'MANUAL')
}

async function checkInParticipant(qrText, method = 'CAMERA') {
  if (!isAdmin.value || checkingIn.value) return
  const value = compactCode(qrText)
  if (!value) return (adminError.value = 'Scan or enter a registration code first.')

  checkingIn.value = true
  resetMessages()
  scannerStatus.value = 'Checking registration…'
  try {
    const data = await postJson({
      action: 'checkInParticipant',
      adminKey: admin.key.trim(),
      qrText: value,
      method,
      note: checkInNote.value.trim(),
      userAgent: navigator.userAgent || '',
      clientOrigin: window.location.origin || '',
    })
    lastResult.value = data.participant || null
    if (data.duplicate) {
      adminError.value = data.message || 'Participant was already checked in.'
      scannerStatus.value = 'Already checked in. Ready for next QR.'
    } else {
      adminSuccess.value = data.message || 'Participant checked in.'
      scannerStatus.value = 'Check-in recorded. Ready for next QR.'
    }
    manualCode.value = ''
    await loadRecentCheckins()
  } catch (error) {
    adminError.value = error?.message || 'Check-in failed.'
    scannerStatus.value = 'Check-in failed. Ready for another scan.'
  } finally {
    checkingIn.value = false
  }
}

async function startScanner() {
  resetMessages()
  scannerError.value = ''
  if (scannerActive.value) return
  if (!canUseScanner.value) {
    scannerError.value = 'Camera QR scanning is not supported by this browser. Use Chrome or Edge on HTTPS, or enter the code manually.'
    return
  }

  try {
    const supported = typeof window.BarcodeDetector.getSupportedFormats === 'function' ? await window.BarcodeDetector.getSupportedFormats() : ['qr_code']
    if (Array.isArray(supported) && !supported.includes('qr_code')) {
      scannerError.value = 'This browser supports BarcodeDetector but not QR codes. Use manual code entry.'
      return
    }

    detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    await nextTick()
    if (!videoRef.value) throw new Error('Scanner video element is not ready.')
    videoRef.value.srcObject = stream
    await videoRef.value.play()
    scannerActive.value = true
    scannerStatus.value = 'Scanner is active. Point the camera at the participant QR code.'
    scanFrame = requestAnimationFrame(scanLoop)
  } catch (error) {
    stopScanner()
    scannerError.value = error?.message || 'Camera could not be started. Check browser permissions and HTTPS.'
  }
}

function stopScanner() {
  if (scanFrame) cancelAnimationFrame(scanFrame)
  scanFrame = 0
  scannerActive.value = false
  scannerStatus.value = 'Scanner is off.'
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
  if (videoRef.value) videoRef.value.srcObject = null
}

async function scanLoop() {
  if (!scannerActive.value || !detector || !videoRef.value) return
  try {
    const video = videoRef.value
    if (video.readyState >= 2 && !checkingIn.value) {
      const codes = await detector.detect(video)
      const raw = codes?.[0]?.rawValue || ''
      const now = Date.now()
      if (raw && (raw !== lastScanText || now - lastScanAt > 4500)) {
        lastScanText = raw
        lastScanAt = now
        scannerStatus.value = 'QR detected. Recording check-in…'
        await checkInParticipant(raw, 'CAMERA')
      }
    }
  } catch (error) {
    scannerError.value = error?.message || 'Scanner read failed.'
  } finally {
    if (scannerActive.value) scanFrame = requestAnimationFrame(scanLoop)
  }
}

onMounted(() => {
  const queryCode = route.query?.code || route.query?.registrationCode || route.query?.reg || ''
  if (queryCode) manualCode.value = compactCode(Array.isArray(queryCode) ? queryCode[0] : queryCode)
  if (typeof sessionStorage !== 'undefined') {
    const savedKey = sessionStorage.getItem(ADMIN_KEY_STORAGE)
    if (savedKey) admin.key = savedKey
  }
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

onBeforeUnmount(() => stopScanner())
</script>

<template>
  <section class="mx-auto w-full max-w-[1200px] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:p-8">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Protected check-in module</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Onsite Check-in</h1>
        <p class="mt-2 text-sm text-slate-600">Scan the participant QR code or type the 16-character registration code. Successful check-ins are logged once.</p>
      </div>
      <RouterLink to="/admin" class="inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950">Back to admin dashboard</RouterLink>
    </div>

    <div v-if="!isAdmin" class="mx-auto max-w-xl rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:p-6">
      <h2 class="text-xl font-bold text-slate-900">Unlock check-in module</h2>
      <p class="mt-2 text-sm text-slate-600">This check-in module is separate from the admin dashboard, but it still requires the same admin key.</p>
      <div class="mt-5 space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Admin key</label>
          <input v-model="admin.key" type="password" placeholder="Enter admin key" :disabled="loggingIn" autocomplete="current-password" @keyup.enter="adminLogin" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </div>
        <div v-if="adminError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
        <div v-if="adminSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>
        <button :disabled="loggingIn" class="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60" @click="adminLogin">
          {{ loggingIn ? 'Unlocking…' : 'Unlock check-in' }}
        </button>
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <div class="space-y-5">
        <div class="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 text-white sm:p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-xl font-bold">QR scanner</h2>
              <p class="mt-1 text-sm text-slate-300">Requires HTTPS or localhost and a browser with QR BarcodeDetector support.</p>
            </div>
            <div class="flex gap-2">
              <button v-if="!scannerActive" class="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300" @click="startScanner">Start scanner</button>
              <button v-else class="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20" @click="stopScanner">Stop</button>
            </div>
          </div>
          <div class="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref="videoRef" playsinline muted class="aspect-video w-full bg-black object-cover"></video>
          </div>
          <p class="mt-3 text-sm text-slate-300">{{ scannerStatus }}</p>
          <p v-if="scannerError" class="mt-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{{ scannerError }}</p>
        </div>

        <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h2 class="text-xl font-bold text-slate-900">Manual check-in</h2>
          <p class="mt-1 text-sm text-slate-600">Use this when the camera cannot read the QR code or the participant only has the code.</p>
          <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input v-model="manualCode" type="text" maxlength="120" placeholder="Paste QR text or enter registration code" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm uppercase tracking-wider outline-none transition focus:border-slate-900" @keyup.enter="submitManualCheckIn" />
            <button :disabled="checkingIn" class="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60" @click="submitManualCheckIn">
              {{ checkingIn ? 'Checking…' : 'Check in' }}
            </button>
          </div>
          <label class="mt-4 block text-sm font-medium text-slate-700">Optional check-in note</label>
          <input v-model="checkInNote" type="text" maxlength="250" placeholder="Example: arrived late, manual override, QR unreadable" class="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900" />
        </div>
      </div>

      <div class="space-y-5">
        <div v-if="adminError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
        <div v-if="adminSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>

        <div v-if="lastResult" class="rounded-[1.5rem] border p-5" :class="lastResult.duplicate ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'">
          <p class="text-xs font-bold uppercase tracking-[0.2em]" :class="lastResult.duplicate ? 'text-amber-700' : 'text-emerald-700'">{{ lastResult.duplicate ? 'Already checked in' : 'Checked in' }}</p>
          <h2 class="mt-2 text-2xl font-bold text-slate-950">{{ lastResult.fullName }}</h2>
          <p class="mt-1 font-mono text-sm font-semibold text-slate-700">{{ lastResult.registrationCode }}</p>
          <dl class="mt-4 grid gap-3 text-sm">
            <div><dt class="font-semibold text-slate-500">Email</dt><dd class="text-slate-900">{{ lastResult.email }}</dd></div>
            <div><dt class="font-semibold text-slate-500">Region / Affiliation</dt><dd class="text-slate-900">{{ [lastResult.region, lastResult.affiliation || lastResult.hei].filter(Boolean).join(' · ') }}</dd></div>
            <div><dt class="font-semibold text-slate-500">Participant Type</dt><dd class="text-slate-900">{{ lastResult.participantType }}</dd></div>
            <div><dt class="font-semibold text-slate-500">Check-in Time</dt><dd class="text-slate-900">{{ lastResult.checkInAt || '—' }}</dd></div>
          </dl>
        </div>

        <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-slate-900">Recent check-ins</h2>
              <p class="mt-1 text-sm text-slate-600">Latest successful onsite check-ins.</p>
            </div>
            <button class="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900" @click="loadRecentCheckins">{{ loadingRecent ? 'Loading…' : 'Refresh' }}</button>
          </div>
          <div v-if="!recentCheckins.length" class="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No check-ins yet.</div>
          <div v-else class="mt-4 max-h-[460px] space-y-3 overflow-auto pr-1">
            <div v-for="row in recentCheckins" :key="row.checkinId" class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p class="text-sm font-bold text-slate-950">{{ row.fullName }}</p>
              <p class="mt-1 font-mono text-xs font-semibold text-slate-600">{{ row.registrationCode }}</p>
              <p class="mt-2 text-xs text-slate-500">{{ row.timestamp }} · {{ row.method }}</p>
              <p class="mt-1 text-xs text-slate-600">{{ [row.region, row.affiliation || row.hei].filter(Boolean).join(' · ') }}</p>
            </div>
          </div>
          <button class="mt-5 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950" @click="logoutAdmin">Logout</button>
        </div>
      </div>
    </div>
  </section>
</template>
