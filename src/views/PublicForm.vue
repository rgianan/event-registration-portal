<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { API_URL, SUBMIT_TOKEN, TURNSTILE_SITE_KEY, postJson } from '../lib/api.js'
import {
  ACCOMMODATION_OPTIONS,
  BREAKOUT_SESSION_1_OPTIONS,
  BREAKOUT_SESSION_4_OPTIONS,
  FOOD_RESTRICTION_OPTIONS,
  PARTICIPANT_TYPES,
  SEX_OPTIONS,
} from '../lib/eventOptions.js'

const submitting = ref(false)
const loadingHeiOptions = ref(false)
const submitError = ref('')
const submitSuccess = ref('')
const registrationCode = ref('')
const qrImageUrl = ref('')
const emailSent = ref(false)
const turnstileToken = ref('')
const turnstileWidgetId = ref(null)
const turnstileHost = ref(null)
const heiOptions = ref([])
const regionOptions = ref([])
const heiOptionsError = ref('')
let startedAt = Date.now()

const form = reactive({
  email: '',
  firstName: '',
  middleInitial: '',
  lastName: '',
  nickName: '',
  sexAtBirth: '',
  region: '',
  hei: '',
  contactNumber: '',
  foodRestrictions: [],
  foodRestrictionOther: '',
  emergencyContact: '',
  accommodation: '',
  participantType: '',
  participantTypeOther: '',
  currentDesignation: '',
  breakoutSession1: '',
  breakoutSession4: '',
  privacyConsent: false,
  website: '',
})

const emailIsValid = computed(() => !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
const fullName = computed(() => [form.firstName, form.middleInitial, form.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
const turnstileEnabled = computed(() => !!TURNSTILE_SITE_KEY)
const selectedOtherFood = computed(() => form.foodRestrictions.includes('Other'))
const selectedNaFood = computed(() => form.foodRestrictions.includes('N/A'))
const facultySelected = computed(() => form.participantType === 'Faculty')
const otherParticipantSelected = computed(() => form.participantType === 'Other')
const normalizeRegionOption = (option) => {
  if (typeof option === 'string') return { value: option, label: option, count: 0 }
  return {
    value: String(option?.value || '').trim(),
    label: String(option?.label || option?.value || '').trim(),
    count: Number(option?.count || 0),
  }
}

const regionSelectOptions = computed(() => regionOptions.value.map(normalizeRegionOption).filter((option) => option.value))
const selectedRegion = computed(() => regionSelectOptions.value.find((option) => option.value === form.region) || null)
const selectedRegionLabel = computed(() => selectedRegion.value?.label || form.region)
const filteredHeiOptions = computed(() => {
  const region = form.region.trim().toLowerCase()
  if (!region) return []
  return heiOptions.value.filter((hei) => String(hei.region || '').trim().toLowerCase() === region)
})
const heiSelectDisabled = computed(() => !form.region || filteredHeiOptions.value.length === 0)
const heiMasterLoaded = computed(() => regionSelectOptions.value.length > 0 && heiOptions.value.length > 0)

function resetTurnstile() {
  turnstileToken.value = ''
  if (typeof window !== 'undefined' && window.turnstile && turnstileWidgetId.value != null) {
    try {
      window.turnstile.reset(turnstileWidgetId.value)
    } catch (err) {}
  }
}

function renderTurnstile() {
  if (!turnstileEnabled.value || typeof window === 'undefined') return
  if (!window.turnstile || !turnstileHost.value) return
  if (turnstileWidgetId.value != null) return
  turnstileWidgetId.value = window.turnstile.render(turnstileHost.value, {
    sitekey: TURNSTILE_SITE_KEY,
    callback(token) {
      turnstileToken.value = token || ''
    },
    'expired-callback'() {
      turnstileToken.value = ''
    },
    'error-callback'() {
      turnstileToken.value = ''
    },
  })
}

function ensureTurnstileLoaded() {
  if (!turnstileEnabled.value || typeof window === 'undefined') return
  if (window.turnstile) {
    renderTurnstile()
    return
  }
  const existing = document.querySelector('script[data-turnstile-loader="1"]')
  if (existing) {
    existing.addEventListener('load', renderTurnstile, { once: true })
    return
  }
  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.dataset.turnstileLoader = '1'
  script.addEventListener('load', renderTurnstile, { once: true })
  document.head.appendChild(script)
}

function resetPublicMessages() {
  submitError.value = ''
  submitSuccess.value = ''
  registrationCode.value = ''
  qrImageUrl.value = ''
  emailSent.value = false
}

function toggleFoodRestriction(option) {
  const exists = form.foodRestrictions.includes(option)
  if (option === 'N/A') {
    form.foodRestrictions = exists ? [] : ['N/A']
    form.foodRestrictionOther = ''
    return
  }
  const next = form.foodRestrictions.filter((item) => item !== 'N/A')
  if (exists) {
    form.foodRestrictions = next.filter((item) => item !== option)
  } else {
    form.foodRestrictions = [...next, option]
  }
  if (!form.foodRestrictions.includes('Other')) form.foodRestrictionOther = ''
}

function validateForm() {
  const missing = []
  if (!form.email.trim()) missing.push('Email address')
  if (!form.firstName.trim()) missing.push('First name')
  if (!form.lastName.trim()) missing.push('Last name')
  if (!form.sexAtBirth) missing.push('Assigned sex at birth')
  if (!form.region.trim()) missing.push('Region')
  if (!form.hei.trim()) missing.push('Higher Education Institution')
  if (!form.contactNumber.trim()) missing.push('Contact number')
  if (!form.foodRestrictions.length) missing.push('Food restrictions')
  if (!form.emergencyContact.trim()) missing.push('Emergency contact')
  if (!form.accommodation) missing.push('Accommodation choice')
  if (!form.participantType) missing.push('Participant type')
  if (facultySelected.value && !form.currentDesignation.trim()) missing.push('Current designation')
  if (otherParticipantSelected.value && !form.participantTypeOther.trim()) missing.push('Participant type - Other')
  if (selectedOtherFood.value && !form.foodRestrictionOther.trim()) missing.push('Food restrictions - Other')
  if (!form.breakoutSession1) missing.push('Breakout Session 1')
  if (!form.breakoutSession4) missing.push('Breakout Session 4')
  if (!form.privacyConsent) missing.push('Privacy consent')

  if (missing.length) {
    submitError.value = `Please complete: ${missing.join(', ')}`
    return false
  }
  if (!emailIsValid.value) {
    submitError.value = 'Email format is invalid.'
    return false
  }
  if (selectedNaFood.value && form.foodRestrictions.length > 1) {
    submitError.value = 'Choose either N/A or specific food restrictions, not both.'
    return false
  }
  if (!API_URL) {
    submitError.value = 'Missing VITE_GAS_WEB_APP_URL.'
    return false
  }
  if (!heiMasterLoaded.value) {
    submitError.value = 'HEI master list is not loaded. Check the HEI_List sheet and backend deployment.'
    return false
  }
  if (!regionSelectOptions.value.some((option) => option.value === form.region)) {
    submitError.value = 'Select a valid Region from the HEI master list.'
    return false
  }
  if (!filteredHeiOptions.value.some((hei) => hei.name === form.hei)) {
    submitError.value = 'Select a valid HEI under the selected Region.'
    return false
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    submitError.value = 'Complete the CAPTCHA verification.'
    return false
  }
  return true
}

function resetForm() {
  Object.assign(form, {
    email: '',
    firstName: '',
    middleInitial: '',
    lastName: '',
    nickName: '',
    sexAtBirth: '',
    region: '',
    hei: '',
    contactNumber: '',
    foodRestrictions: [],
    foodRestrictionOther: '',
    emergencyContact: '',
    accommodation: '',
    participantType: '',
    participantTypeOther: '',
    currentDesignation: '',
    breakoutSession1: '',
    breakoutSession4: '',
    privacyConsent: false,
    website: '',
  })
  startedAt = Date.now()
  resetTurnstile()
}

async function submitForm() {
  resetPublicMessages()
  if (!validateForm()) return
  submitting.value = true
  try {
    const data = await postJson({
      action: 'submit',
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      middleInitial: form.middleInitial.trim(),
      lastName: form.lastName.trim(),
      nickName: form.nickName.trim(),
      sexAtBirth: form.sexAtBirth,
      region: form.region.trim(),
      hei: form.hei.trim(),
      contactNumber: form.contactNumber.trim(),
      foodRestrictions: form.foodRestrictions,
      foodRestrictionOther: form.foodRestrictionOther.trim(),
      emergencyContact: form.emergencyContact.trim(),
      accommodation: form.accommodation,
      participantType: form.participantType,
      participantTypeOther: form.participantTypeOther.trim(),
      currentDesignation: form.currentDesignation.trim(),
      breakoutSession1: form.breakoutSession1,
      breakoutSession4: form.breakoutSession4,
      privacyConsent: form.privacyConsent,
      website: form.website.trim(),
      formStartedAt: startedAt,
      submittedAtClient: new Date().toISOString(),
      userAgent: navigator.userAgent,
      clientOrigin: window.location.origin,
      clientReferrer: document.referrer || '',
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      clientLocale: navigator.language || '',
      screen: `${window.screen?.width || ''}x${window.screen?.height || ''}`,
      submitToken: SUBMIT_TOKEN,
      turnstileToken: turnstileToken.value,
    })
    registrationCode.value = data.registrationCode || ''
    qrImageUrl.value = data.qrImageUrl || ''
    emailSent.value = !!data.emailSent
    submitSuccess.value = data.message || 'Registration recorded.'
    resetForm()
  } catch (error) {
    submitError.value = error?.message || 'Something went wrong while submitting the form.'
    resetTurnstile()
  } finally {
    submitting.value = false
  }
}

async function fetchHeiOptions() {
  if (!API_URL) return
  loadingHeiOptions.value = true
  heiOptionsError.value = ''
  try {
    const data = await postJson({ action: 'getHeiOptions' })
    heiOptions.value = Array.isArray(data.heis)
      ? data.heis
          .map((hei) => ({
            region: String(hei?.region || '').trim(),
            regionLabel: String(hei?.regionLabel || '').trim(),
            name: String(hei?.name || '').trim(),
            uii: String(hei?.uii || '').trim(),
            province: String(hei?.province || '').trim(),
            city: String(hei?.city || '').trim(),
          }))
          .filter((hei) => hei.region && hei.name)
      : []
    regionOptions.value = Array.isArray(data.regions)
      ? data.regions.map(normalizeRegionOption).filter((option) => option.value)
      : []
    if (!regionOptions.value.length || !heiOptions.value.length) {
      heiOptionsError.value = data.message || 'No HEI master list rows were loaded.'
    }
  } catch (err) {
    heiOptions.value = []
    regionOptions.value = []
    heiOptionsError.value = err?.message || 'Unable to load the HEI master list.'
  } finally {
    loadingHeiOptions.value = false
  }
}

watch(() => form.participantType, () => {
  if (!facultySelected.value) form.currentDesignation = ''
  if (!otherParticipantSelected.value) form.participantTypeOther = ''
})

watch(() => form.region, () => {
  form.hei = ''
})

onMounted(() => {
  ensureTurnstileLoaded()
  fetchHeiOptions()
})

watch(turnstileHost, () => {
  renderTurnstile()
})
</script>

<template>
  <section class="mx-auto w-full max-w-5xl rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:p-8 min-[1920px]:max-w-[1600px]">
    <div class="mb-6 rounded-2xl bg-slate-900 px-4 py-5 text-white sm:px-6">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Event Registration</p>
      <h2 class="mt-2 text-2xl font-bold">Participant Registration Form</h2>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
        Register once using your active email address. After successful submission, the system generates a unique 16-character registration code and sends a QR confirmation to your email.
      </p>
    </div>

    <div class="mb-6 grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 md:grid-cols-3">
      <div>
        <p class="font-semibold">One email, one registration</p>
        <p class="mt-1">Duplicate email addresses are rejected by the backend.</p>
      </div>
      <div>
        <p class="font-semibold">QR confirmation</p>
        <p class="mt-1">The QR code appears after submission and is also sent by email.</p>
      </div>
      <div>
        <p class="font-semibold">HEI master list</p>
        <p class="mt-1">Region and HEI dropdowns are loaded from the configured HEI_List sheet.</p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="submitForm">
      <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />

      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-900">Personal information</h3>
        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Email Address</label>
            <input v-model="form.email" type="email" autocomplete="email" placeholder="name@example.com" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
            <p v-if="form.email && !emailIsValid" class="mt-2 text-sm text-rose-600">Use a valid email address.</p>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Assigned Sex at Birth</label>
            <select v-model="form.sexAtBirth" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
              <option value="" disabled>Select option</option>
              <option v-for="option in SEX_OPTIONS" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
        </div>

        <div class="mt-5 grid gap-5 md:grid-cols-[1fr_120px_1fr]">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">First Name</label>
            <input v-model="form.firstName" type="text" autocomplete="given-name" placeholder="First name" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">M.I.</label>
            <input v-model="form.middleInitial" type="text" maxlength="5" placeholder="M.I." class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Last Name</label>
            <input v-model="form.lastName" type="text" autocomplete="family-name" placeholder="Last name" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
        </div>

        <div class="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Nick Name</label>
            <input v-model="form.nickName" type="text" placeholder="Preferred name" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Contact Number</label>
            <input v-model="form.contactNumber" type="tel" autocomplete="tel" placeholder="09XX-XXX-XXXX" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
        </div>

        <div v-if="fullName" class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span class="font-semibold text-slate-900">Full name preview:</span> {{ fullName }}
        </div>
      </div>

      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Institution details</h3>
            <p class="mt-1 text-sm text-slate-600">Select Region first, then choose only from HEIs under that Region.</p>
          </div>
          <p class="text-xs text-slate-500">{{ loadingHeiOptions ? 'Loading HEI options…' : `${regionSelectOptions.length} regions / ${heiOptions.length} HEIs loaded` }}</p>
        </div>

        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Region</label>
            <select v-model="form.region" :disabled="loadingHeiOptions || !regionSelectOptions.length" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
              <option value="" disabled>{{ loadingHeiOptions ? 'Loading regions…' : 'Select region' }}</option>
              <option v-for="option in regionSelectOptions" :key="option.value" :value="option.value">
                {{ option.label }}{{ option.count ? ` (${option.count} HEIs)` : '' }}
              </option>
            </select>
            <p v-if="heiOptionsError" class="mt-2 text-sm text-rose-600">{{ heiOptionsError }}</p>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Higher Education Institution</label>
            <select v-model="form.hei" :disabled="heiSelectDisabled" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
              <option value="" disabled>{{ !form.region ? 'Select region first' : filteredHeiOptions.length ? 'Select HEI' : 'No HEIs under this region' }}</option>
              <option v-for="hei in filteredHeiOptions" :key="`${hei.region}-${hei.uii || hei.name}`" :value="hei.name">
                {{ hei.name }}
              </option>
            </select>
            <p v-if="form.region" class="mt-2 text-sm text-slate-500">
              Showing {{ filteredHeiOptions.length }} HEIs under {{ selectedRegionLabel }}.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-900">Logistics and emergency details</h3>
        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Food Restrictions</label>
            <div class="grid gap-2 sm:grid-cols-2">
              <label v-for="option in FOOD_RESTRICTION_OPTIONS" :key="option" class="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300">
                <input :checked="form.foodRestrictions.includes(option)" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" @change="toggleFoodRestriction(option)" />
                <span>{{ option }}</span>
              </label>
            </div>
            <input v-if="selectedOtherFood" v-model="form.foodRestrictionOther" type="text" placeholder="Specify other food restriction" class="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
          <div class="space-y-5">
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Person to contact in case of emergency and their contact number</label>
              <textarea v-model="form.emergencyContact" rows="4" placeholder="Juan Dela Cruz / 09XX-XXX-XXXX" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"></textarea>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Will avail accommodation?</label>
              <select v-model="form.accommodation" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
                <option value="" disabled>Select option</option>
                <option v-for="option in ACCOMMODATION_OPTIONS" :key="option" :value="option">{{ option }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-900">Participant profile</h3>
        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Participant Type</label>
            <select v-model="form.participantType" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
              <option value="" disabled>Select participant type</option>
              <option v-for="option in PARTICIPANT_TYPES" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
          <div v-if="otherParticipantSelected">
            <label class="mb-2 block text-sm font-medium text-slate-700">Other participant type</label>
            <input v-model="form.participantTypeOther" type="text" placeholder="Specify participant type" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
          <div v-if="facultySelected">
            <label class="mb-2 block text-sm font-medium text-slate-700">State your current designation in your HEI</label>
            <input v-model="form.currentDesignation" type="text" placeholder="e.g., Guidance Counselor, Dean, Faculty Member" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
          </div>
        </div>
      </div>

      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-slate-900">Breakout sessions</h3>
        <div class="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Breakout Session 1: Focused Discussion Group</label>
            <select v-model="form.breakoutSession1" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
              <option value="" disabled>Select breakout session</option>
              <option v-for="option in BREAKOUT_SESSION_1_OPTIONS" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Breakout Session 4: Solution Lab</label>
            <select v-model="form.breakoutSession4" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
              <option value="" disabled>Select breakout session</option>
              <option v-for="option in BREAKOUT_SESSION_4_OPTIONS" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="turnstileEnabled" class="rounded-2xl border border-slate-200 bg-white p-4">
        <p class="mb-3 text-sm font-medium text-slate-700">CAPTCHA verification</p>
        <div ref="turnstileHost" class="min-h-16"></div>
      </div>

      <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <input v-model="form.privacyConsent" type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
        <span>
          I consent to the collection, processing, storage, use, and retention of my personal data in accordance with Republic Act No. 10173, or the Data Privacy Act of 2012, and its implementing rules and regulations, for event registration, identity and attendance verification, food and accommodation planning, emergency coordination, and related administrative reporting.
        </span>
      </label>

      <div v-if="submitError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ submitError }}</div>

      <div v-if="submitSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p class="text-base font-semibold">Registration successful</p>
        <p class="mt-1">{{ submitSuccess }}</p>
        <div class="mt-4 grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
          <div v-if="qrImageUrl" class="rounded-2xl border border-emerald-200 bg-white p-3">
            <img :src="qrImageUrl" alt="Registration QR code" class="h-36 w-36 object-contain" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Registration Code</p>
            <p class="mt-1 break-all font-mono text-2xl font-bold text-emerald-950">{{ registrationCode }}</p>
            <p class="mt-2 text-sm">Email confirmation: <strong>{{ emailSent ? 'Sent' : 'Not sent' }}</strong></p>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3 pt-2 sm:flex-row">
        <button type="submit" :disabled="submitting" class="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {{ submitting ? 'Submitting…' : 'Submit registration' }}
        </button>
        <button type="button" class="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900" @click="resetForm">
          Reset form
        </button>
      </div>
    </form>
  </section>
</template>
