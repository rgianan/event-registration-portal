/**
 * Event registration backend.
 *
 * Script Properties:
 * - SPREADSHEET_ID            required
 * - RESPONSES_SHEET_NAME      optional, defaults to Registrations
 * - AUDIT_SHEET_NAME          optional, defaults to Audit
 * - CHECKINS_SHEET_NAME       optional, defaults to Checkins
 * - HEI_LIST_SHEET_NAME       optional, defaults to HEI_List
 * - CHEDRO_SHEET_NAME         optional, defaults to CHEDRO
 * - CHEDCO_SHEET_NAME         optional, defaults to CHEDCO
 * - ADMIN_KEY                 required for admin dashboard actions
 * - SUBMIT_SHARED_TOKEN       optional; if set, must match the value the client sends in submitToken
 * - TURNSTILE_ENABLED         optional, defaults to TRUE. Set to FALSE only for controlled local testing.
 * - TURNSTILE_SECRET_KEY      required when TURNSTILE_ENABLED is not FALSE; verifies the client's turnstileToken
 * - EVENT_NAME                optional, used in confirmation email
 * - EVENT_ORGANIZER_NAME      optional, used in confirmation email sender name
 * - QR_PAYLOAD_PREFIX         optional. Use either a plain prefix or a value containing {{code}}
 */

var ADMIN_FAILED_CACHE_KEY = 'admin:failed_attempts';
var ADMIN_LOCKOUT_CACHE_KEY = 'admin:lockout';
var ADMIN_MAX_ATTEMPTS = 5;
var ADMIN_LOCKOUT_SECONDS = 15 * 60;
var ADMIN_FAIL_WINDOW_SECONDS = 15 * 60;

var STATUS_REGISTERED = 'REGISTERED';
var CHECKIN_STATUS_CHECKED_IN = 'CHECKED_IN';
var CHECKIN_STATUS_NOT_CHECKED_IN = 'NOT_CHECKED_IN';
var EMAIL_PENDING = 'PENDING';
var APP_TIME_ZONE = 'Asia/Singapore';

var SEX_OPTIONS = ['Male', 'Female'];
var ACCOMMODATION_OPTIONS = ['Yes', 'No'];
var PARTICIPANT_TYPES = ['Student', 'SAS Practitioner/Guidance/Faculty', 'Resource Person/Facilitator/Moderator', 'CHED Regional Office', 'CHED Central Office', 'Other'];
var HEI_PARTICIPANT_TYPES = ['SAS Practitioner/Guidance/Faculty', 'Student'];
var TRANSPORTATION_ELIGIBLE_TYPES = ['CHED Regional Office', 'CHED Central Office', 'Resource Person/Facilitator/Moderator'];
var CURRENT_DESIGNATION_REQUIRED_TYPES = ['SAS Practitioner/Guidance/Faculty', 'Resource Person/Facilitator/Moderator', 'CHED Regional Office', 'CHED Central Office'];
var TOPIC_REQUIRED_TYPES = ['Student', 'SAS Practitioner/Guidance/Faculty', 'Other'];
var CHEDRO_OFFICE_OPTIONS = ['CHEDRO I', 'CHEDRO II', 'CHEDRO III', 'CHEDRO IV', 'CHEDRO V', 'CHEDRO VI', 'CHEDRO VII', 'CHEDRO VIII', 'CHEDRO IX', 'CHEDRO X', 'CHEDRO XI', 'CHEDRO XII', 'CHEDRO NCR', 'CHEDRO NIR', 'CHEDRO CAR', 'CHEDRO CARAGA', 'CHEDRO MIMAROPA'];
var CHEDCO_OFFICE_OPTIONS = ['Office of Student Development and Services', 'AFMS', 'GAD', 'HEDFS', 'IAS', 'LLS', 'OCC - Chairman', 'OCC - Comm. Apag III', 'OCC - Comm. Aquino', 'OCC - Comm. Mallari', 'OCC - Comm. Ong', 'OED', 'OIQAG', 'OPRKM', 'OPSD', 'UNIFAST'];
var FOOD_RESTRICTION_OPTIONS = ['Vegan', 'Peanut Allergies', 'Lactose Intolerance', 'Gluten Intolerance', 'N/A', 'Other'];

var REGION_LABELS = {
  '1': 'Region I - Ilocos Region',
  '2': 'Region II - Cagayan Valley',
  '3': 'Region III - Central Luzon',
  '4': 'Region IV-A - CALABARZON',
  '5': 'Region V - Bicol Region',
  '6': 'Region VI - Western Visayas',
  '7': 'Region VII - Central Visayas',
  '8': 'Region VIII - Eastern Visayas',
  '9': 'Region IX - Zamboanga Peninsula',
  '10': 'Region X - Northern Mindanao',
  '11': 'Region XI - Davao Region',
  '12': 'Region XII - SOCCSKSARGEN',
  '13': 'National Capital Region (NCR)',
  '14': 'Cordillera Administrative Region (CAR)',
  '15': 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
  '16': 'Region XIII - Caraga',
  '17': 'MIMAROPA Region',
  '18': 'Region XVIII - Negros Island Region (NIR)'
};

var BREAKOUT_SESSION_1_OPTIONS = [
  'Personal Well Being (Mental health, stress management, coping skills, self care, and help seeking behavior)',
  'Social Well Being (Student engagement, sense of belonging, peer support, inclusion, and healthy relationships)',
  'Academic Life and Well Being (Academic pressure, performance stress, study habits, motivation, and support systems for learning)',
  'Digital Well-Being and Social Media Impact (Responsible technology use, social media impact, online safety, digital boundaries, and managing digital overload)',
  'Career Development'
];

var BREAKOUT_SESSION_4_OPTIONS = [
  'Student support (counseling, referral pathways, crisis response, help seeking mechanisms, and access to student services)',
  'Peer support and mentoring programs (peer facilitation, buddy systems, peer listening groups, student-led support circles, and referral protocols)',
  'Wellness and prevention initiatives (mental health promotion, stress management, prevention of substance use/HIV/AIDS/Hazing, digital well being, healthy lifestyle activities, and awareness campaigns)',
  'Campus engagement and safe spaces (inclusive student activities, belongingness programs, safe reporting channels, anti-discrimination efforts, and student participation mechanisms)',
  'Institutional policies and support mechanisms (student welfare policies, coordination systems, documentation, monitoring, resource allocation, and partnerships with internal and external stakeholders)'
];

function doGet(e) {
  try {
    return jsonOutput_({
      ok: true,
      message: 'Event registration backend is running.',
      mode: 'event_registration_with_unique_email_and_qr'
    });
  } catch (err) {
    return jsonOutput_({ ok: false, message: errorMessage_(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(payload.action || '').trim();
    if (action === 'submit') return handleSubmit_(payload);
    if (action === 'getHeiOptions') return handleGetHeiOptions_();
    if (action === 'adminLogin') return handleAdminLogin_(payload);
    if (action === 'listResponses') return handleListResponses_(payload);
    if (action === 'listCheckins') return handleListCheckins_(payload);
    if (action === 'checkInParticipant') return handleCheckInParticipant_(payload);
    if (action === 'updateReviewNote') return handleUpdateReviewNote_(payload);
    if (action === 'resendConfirmation') return handleResendConfirmation_(payload);
    throw new Error('Unsupported action.');
  } catch (err) {
    return jsonOutput_({ ok: false, message: errorMessage_(err) });
  }
}

function handleSubmit_(payload) {
  payload = payload || {};
  verifySubmitToken_(payload.submitToken);
  verifyTurnstile_(payload.turnstileToken);

  var row = sanitizeRegistration_(payload);
  enforceSpamChecks_(row, payload);

  var config = getConfig_();
  var timestamp = new Date();
  var registrationCode = '';
  var qrPayload = '';
  var qrImageUrl = '';
  var appended = false;
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(20000)) throw new Error('The registration system is busy. Please try again.');

  try {
    var sheet = getResponseSheet_(config);
    if (emailAlreadyRegistered_(sheet, row.email)) {
      throw new Error('This email address is already registered. Only one registration per email address is allowed.');
    }

    registrationCode = makeUniqueRegistrationCode_(sheet);
    qrPayload = makeQrPayload_(registrationCode, config);
    qrImageUrl = makeQrImageUrl_(qrPayload);

    var headers = getResponseHeaders_();
    var values = registrationToRow_(headers, {
      timestamp: timestamp,
      registrationCode: registrationCode,
      status: STATUS_REGISTERED,
      row: row,
      emailSent: EMAIL_PENDING,
      emailError: '',
      qrPayload: qrPayload,
      qrImageUrl: qrImageUrl,
      reviewNote: ''
    });

    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, headers.length).setValues([values]);
    appended = true;
    markSubmissionFingerprint_(row, payload || {});
    auditLog_('registration_created', 'ok', registrationCode, row.email, 'Registered via public form.', row.userAgent, row.clientOrigin);
  } finally {
    lock.releaseLock();
  }

  var emailResult = sendConfirmationEmailSafe_({
    eventName: config.eventName,
    organizerName: config.eventOrganizerName,
    timestamp: timestamp,
    registrationCode: registrationCode,
    qrPayload: qrPayload,
    qrImageUrl: qrImageUrl,
    row: row
  });

  if (appended) {
    updateEmailStatus_(registrationCode, emailResult.sent ? 'YES' : 'NO', emailResult.error || '');
  }

  return jsonOutput_({
    ok: true,
    status: STATUS_REGISTERED,
    registrationCode: registrationCode,
    qrPayload: qrPayload,
    qrImageUrl: qrImageUrl,
    emailSent: !!emailResult.sent,
    message: 'Your registration has been recorded. Save your registration code and QR code for check-in.' + (emailResult.sent ? ' A confirmation email was sent to your registered email address.' : ' The record was saved, but the confirmation email could not be sent at this time.')
  });
}

function sanitizeRegistration_(payload) {
  var row = {
    email: cleanText_(payload.email, 150).toLowerCase(),
    firstName: cleanText_(payload.firstName, 80),
    middleInitial: cleanText_(payload.middleInitial, 10),
    lastName: cleanText_(payload.lastName, 80),
    nickName: cleanText_(payload.nickName, 60),
    sexAtBirth: cleanText_(payload.sexAtBirth, 20),
    participantType: cleanText_(payload.participantType, 80),
    participantTypeOther: cleanText_(payload.participantTypeOther, 100),
    currentDesignation: cleanText_(payload.currentDesignation, 150),
    region: cleanText_(payload.region, 120),
    hei: cleanText_(payload.hei, 220),
    affiliation: cleanText_(payload.affiliation || payload.hei, 220),
    chedroOffice: cleanText_(payload.chedroOffice, 140),
    chedcoOffice: cleanText_(payload.chedcoOffice, 160),
    resourceAffiliation: cleanText_(payload.resourceAffiliation, 220),
    transportationFromChedToTagaytay: payload.transportationFromChedToTagaytay === true || String(payload.transportationFromChedToTagaytay || '').toUpperCase() === 'YES',
    transportationFromTagaytayToChed: payload.transportationFromTagaytayToChed === true || String(payload.transportationFromTagaytayToChed || '').toUpperCase() === 'YES',
    contactNumber: cleanText_(payload.contactNumber, 50),
    foodRestrictions: sanitizeList_(payload.foodRestrictions, FOOD_RESTRICTION_OPTIONS, 6),
    foodRestrictionOther: cleanText_(payload.foodRestrictionOther, 120),
    emergencyContact: cleanText_(payload.emergencyContact, 250),
    accommodation: cleanText_(payload.accommodation, 10),
    accommodationCheckInDate: cleanDate_(payload.accommodationCheckInDate),
    accommodationCheckOutDate: cleanDate_(payload.accommodationCheckOutDate),
    breakoutSession1: cleanText_(payload.breakoutSession1, 500),
    breakoutSession4: cleanText_(payload.breakoutSession4, 600),
    privacyConsent: payload.privacyConsent === true,
    website: cleanText_(payload.website, 200),
    userAgent: cleanText_(payload.userAgent, 500),
    clientOrigin: cleanText_(payload.clientOrigin, 200),
    clientReferrer: cleanText_(payload.clientReferrer, 300),
    clientTimezone: cleanText_(payload.clientTimezone, 80),
    clientLocale: cleanText_(payload.clientLocale, 40),
    screen: cleanText_(payload.screen, 40),
    formStartedAt: Number(payload.formStartedAt || 0),
    submittedAtClient: cleanText_(payload.submittedAtClient, 80)
  };

  row.fullName = buildFullName_(row.firstName, row.middleInitial, row.lastName);
  row.formDurationSeconds = row.formStartedAt ? Math.max(0, Math.round((Date.now() - row.formStartedAt) / 1000)) : '';

  var missing = [];
  if (!row.participantType) missing.push('Participant Type');
  if (!row.email) missing.push('Email Address');
  if (!row.firstName) missing.push('First Name');
  if (!row.lastName) missing.push('Last Name');
  if (!row.sexAtBirth) missing.push('Assigned Sex at Birth');
  if (!row.contactNumber) missing.push('Contact Number');
  if (!row.foodRestrictions.length) missing.push('Food Restrictions');
  if (!row.emergencyContact) missing.push('Emergency Contact');
  if (!row.accommodation) missing.push('Accommodation');
  if (topicRequiredForParticipant_(row.participantType)) {
    if (!row.breakoutSession1) missing.push('Topic 1');
    if (!row.breakoutSession4) missing.push('Topic 4');
  }
  if (!row.privacyConsent) missing.push('Privacy Consent');

  if (missing.length) throw new Error('Please complete: ' + missing.join(', '));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('Invalid email format.');
  if (SEX_OPTIONS.indexOf(row.sexAtBirth) === -1) throw new Error('Invalid assigned sex at birth value.');
  if (ACCOMMODATION_OPTIONS.indexOf(row.accommodation) === -1) throw new Error('Invalid accommodation value.');
  if (PARTICIPANT_TYPES.indexOf(row.participantType) === -1) throw new Error('Invalid participant type.');

  if (CURRENT_DESIGNATION_REQUIRED_TYPES.indexOf(row.participantType) !== -1 && !row.currentDesignation) {
    throw new Error('Current designation is required for this participant type.');
  }
  if (CURRENT_DESIGNATION_REQUIRED_TYPES.indexOf(row.participantType) === -1) row.currentDesignation = '';
  if (row.participantType === 'Other' && !row.participantTypeOther) throw new Error('Specify the other participant type.');
  if (row.participantType !== 'Other') row.participantTypeOther = '';

  canonicalizeAffiliationSelection_(row);

  if (TRANSPORTATION_ELIGIBLE_TYPES.indexOf(row.participantType) === -1) {
    row.transportationFromChedToTagaytay = false;
    row.transportationFromTagaytayToChed = false;
  }

  if (row.accommodation === 'Yes') {
    if (HEI_PARTICIPANT_TYPES.indexOf(row.participantType) !== -1) {
      row.accommodationCheckInDate = '2026-06-02';
      row.accommodationCheckOutDate = '2026-06-05';
    } else {
      if (!row.accommodationCheckInDate) throw new Error('Accommodation check-in date is required.');
      if (!row.accommodationCheckOutDate) throw new Error('Accommodation check-out date is required.');
      if (row.accommodationCheckOutDate < row.accommodationCheckInDate) throw new Error('Accommodation check-out date cannot be earlier than check-in date.');
    }
  } else {
    row.accommodationCheckInDate = '';
    row.accommodationCheckOutDate = '';
  }

  if (row.foodRestrictions.indexOf('N/A') !== -1 && row.foodRestrictions.length > 1) throw new Error('Choose either N/A or specific food restrictions, not both.');
  if (row.foodRestrictions.indexOf('Other') !== -1 && !row.foodRestrictionOther) throw new Error('Specify the other food restriction.');
  if (row.foodRestrictions.indexOf('Other') === -1) row.foodRestrictionOther = '';
  if (topicRequiredForParticipant_(row.participantType)) {
    if (BREAKOUT_SESSION_1_OPTIONS.indexOf(row.breakoutSession1) === -1) throw new Error('Invalid Topic 1 selection.');
    if (BREAKOUT_SESSION_4_OPTIONS.indexOf(row.breakoutSession4) === -1) throw new Error('Invalid Topic 4 selection.');
  } else {
    row.breakoutSession1 = '';
    row.breakoutSession4 = '';
  }

  return row;
}

function topicRequiredForParticipant_(participantType) {
  return TOPIC_REQUIRED_TYPES.indexOf(String(participantType || '')) !== -1;
}

function sanitizeList_(value, allowed, maxItems) {
  var list = Array.isArray(value) ? value : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length && out.length < maxItems; i++) {
    var item = cleanText_(list[i], 120);
    if (!item || allowed.indexOf(item) === -1 || seen[item]) continue;
    seen[item] = true;
    out.push(item);
  }
  return out;
}

function buildFullName_(firstName, middleInitial, lastName) {
  return normalizeSpaces_([firstName, middleInitial, lastName].filter(Boolean).join(' '));
}

function handleGetHeiOptions_() {
  var config = getConfig_();
  var master = getHeiMaster_();
  return jsonOutput_({
    ok: true,
    regions: master.regions,
    heis: master.heis,
    chedroOffices: getOfficeOptions_(config.chedroSheetName, CHEDRO_OFFICE_OPTIONS),
    chedcoOffices: getOfficeOptions_(config.chedcoSheetName, CHEDCO_OFFICE_OPTIONS),
    available: master.available,
    message: master.available ? '' : 'HEI_List sheet is missing or has unsupported headers.'
  });
}

function getHeiMaster_() {
  var config = getConfig_();
  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = ss.getSheetByName(config.heiListSheetName);
  if (!sheet || sheet.getLastRow() < 2) return { available: false, regions: [], heis: [] };

  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0];
  var regionCol = findHeaderIndex_(headers, ['Region', 'Region Code', 'Region_Code', 'Region Name', 'region_name', 'CHEDRO Region']);
  var heiCol = findHeaderIndex_(headers, ['Higher Education Institution', 'HEI', 'HEI Name', 'Institution Name', 'Name']);
  var uiiCol = findHeaderIndex_(headers, ['UII', 'Institution Code', 'HEI UII', 'School ID']);
  var provinceCol = findHeaderIndex_(headers, ['Province']);
  var cityCol = findHeaderIndex_(headers, ['City/Municipality', 'City Municipality', 'City', 'Municipality']);
  var statusCol = findHeaderIndex_(headers, ['Status']);

  if (regionCol === -1 || heiCol === -1) return { available: false, regions: [], heis: [] };

  var regionsByValue = {};
  var heis = [];
  var seenHeiByRegion = {};

  for (var i = 1; i < values.length; i++) {
    var region = cleanText_(values[i][regionCol], 120);
    var name = cleanText_(values[i][heiCol], 220);
    var status = statusCol === -1 ? '' : cleanText_(values[i][statusCol], 80);
    if (!region || !name) continue;
    if (status && status.toLowerCase() !== 'existing') continue;

    var dedupeKey = normalizeKey_(region) + '|' + normalizeKey_(name);
    if (seenHeiByRegion[dedupeKey]) continue;
    seenHeiByRegion[dedupeKey] = true;

    if (!regionsByValue[region]) {
      regionsByValue[region] = {
        value: region,
        label: formatRegionLabel_(region),
        count: 0
      };
    }
    regionsByValue[region].count++;

    heis.push({
      region: region,
      regionLabel: formatRegionLabel_(region),
      name: name,
      uii: uiiCol === -1 ? '' : cleanText_(values[i][uiiCol], 80),
      province: provinceCol === -1 ? '' : cleanText_(values[i][provinceCol], 120),
      city: cityCol === -1 ? '' : cleanText_(values[i][cityCol], 120),
      status: status || 'Existing'
    });
  }

  var regions = Object.keys(regionsByValue).map(function (value) { return regionsByValue[value]; });
  regions.sort(function (a, b) { return compareRegionValues_(a.value, b.value); });
  heis.sort(function (a, b) {
    var regionCompare = compareRegionValues_(a.region, b.region);
    if (regionCompare !== 0) return regionCompare;
    return a.name.localeCompare(b.name);
  });

  return { available: true, regions: regions, heis: heis };
}

function canonicalizeHeiSelection_(row) {
  var master = getHeiMaster_();
  if (!master.available || !master.heis.length) return;

  var regionKey = normalizeKey_(row.region);
  var heiKey = normalizeKey_(row.hei);
  for (var i = 0; i < master.heis.length; i++) {
    var item = master.heis[i];
    if (normalizeKey_(item.region) === regionKey && normalizeKey_(item.name) === heiKey) {
      row.region = item.region;
      row.hei = item.name;
      return;
    }
  }

  throw new Error('Select a valid Higher Education Institution from the selected Region based on the HEI_List sheet.');
}

function canonicalizeAffiliationSelection_(row) {
  if (HEI_PARTICIPANT_TYPES.indexOf(row.participantType) !== -1) {
    if (!row.region) throw new Error('Region is required for Student and SAS Practitioner/Guidance/Faculty participants.');
    if (!row.hei) throw new Error('Higher Education Institution is required for Student and SAS Practitioner/Guidance/Faculty participants.');
    canonicalizeHeiSelection_(row);
    row.affiliation = row.hei;
    row.chedroOffice = '';
    row.chedcoOffice = '';
    row.resourceAffiliation = '';
    return;
  }

  row.region = '';
  row.hei = '';

  if (row.participantType === 'CHED Regional Office') {
    validateOfficeOption_(row.chedroOffice, getOfficeOptions_(getConfig_().chedroSheetName, CHEDRO_OFFICE_OPTIONS), 'CHED Regional Office');
    row.affiliation = row.chedroOffice;
    row.chedcoOffice = '';
    row.resourceAffiliation = '';
    return;
  }

  if (row.participantType === 'CHED Central Office') {
    validateOfficeOption_(row.chedcoOffice, getOfficeOptions_(getConfig_().chedcoSheetName, CHEDCO_OFFICE_OPTIONS), 'CHED Central Office');
    row.affiliation = row.chedcoOffice;
    row.chedroOffice = '';
    row.resourceAffiliation = '';
    return;
  }

  if (row.participantType === 'Resource Person/Facilitator/Moderator') {
    if (!row.resourceAffiliation) throw new Error('Affiliation is required for Resource Person/Facilitator/Moderator participants.');
    row.affiliation = row.resourceAffiliation;
    row.chedroOffice = '';
    row.chedcoOffice = '';
    return;
  }

  if (row.participantType === 'Other') {
    row.affiliation = row.resourceAffiliation || row.participantTypeOther;
    row.chedroOffice = '';
    row.chedcoOffice = '';
    return;
  }

  throw new Error('Invalid participant type.');
}

function validateOfficeOption_(value, allowed, label) {
  if (!value) throw new Error(label + ' is required.');
  var key = normalizeKey_(value);
  for (var i = 0; i < allowed.length; i++) {
    if (normalizeKey_(allowed[i]) === key) return;
  }
  throw new Error('Select a valid ' + label + '.');
}


function formatRegionLabel_(region) {
  var raw = cleanText_(region, 120);
  return REGION_LABELS[raw] || raw;
}

function compareRegionValues_(a, b) {
  var aRaw = String(a || '').trim();
  var bRaw = String(b || '').trim();
  var aNum = /^[0-9]+$/.test(aRaw) ? Number(aRaw) : null;
  var bNum = /^[0-9]+$/.test(bRaw) ? Number(bRaw) : null;
  if (aNum !== null && bNum !== null) return aNum - bNum;
  return aRaw.localeCompare(bRaw);
}

function normalizeKey_(value) {
  return normalizeSpaces_(String(value == null ? '' : value).toLowerCase());
}

function handleAdminLogin_(payload) {
  requireAdmin_(payload.adminKey);
  auditLog_('admin_login_success', 'ok', '', '', 'Admin access granted.', '', '');
  return jsonOutput_({ ok: true, message: 'Admin access granted.' });
}

function handleListResponses_(payload) {
  requireAdmin_(payload.adminKey);
  var config = getConfig_();
  var sheet = getResponseSheet_(config);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return jsonOutput_({ ok: true, rows: [], stats: emptyStats_() });

  var headers = values[0];
  var rows = [];
  var todayKey = formatDateOnly_(new Date());
  var stats = emptyStats_();

  for (var i = 1; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    var tsLabel = formatDateTime_(obj.Timestamp);
    var participantType = String(obj.Participant_Type || '');
    var accommodation = String(obj.Will_Avail_Accommodation || '');

    rows.push({
      rowNumber: i + 1,
      timestamp: tsLabel,
      registrationCode: String(obj.Registration_Code || ''),
      status: String(obj.Status || ''),
      email: String(obj.Email_Address || ''),
      fullName: String(obj.Full_Name || ''),
      firstName: String(obj.First_Name || ''),
      middleInitial: String(obj.Middle_Initial || ''),
      lastName: String(obj.Last_Name || ''),
      nickName: String(obj.Nick_Name || ''),
      sexAtBirth: String(obj.Assigned_Sex_At_Birth || ''),
      region: String(obj.Region || ''),
      hei: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
      affiliation: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
      chedroOffice: String(obj.CHEDRO_Office || ''),
      chedcoOffice: String(obj.CHEDCO_Office || ''),
      resourceAffiliation: String(obj.Resource_Affiliation || ''),
      contactNumber: String(obj.Contact_Number || ''),
      foodRestrictions: String(obj.Food_Restrictions || ''),
      foodRestrictionOther: String(obj.Food_Restrictions_Other || ''),
      emergencyContact: String(obj.Emergency_Contact || ''),
      accommodation: accommodation,
      accommodationCheckInDate: formatDateOnly_(obj.Accommodation_Check_In_Date),
      accommodationCheckOutDate: formatDateOnly_(obj.Accommodation_Check_Out_Date),
      transportationFromChedToTagaytay: String(obj.Transportation_From_CHED_To_Tagaytay_Venue || ''),
      transportationFromTagaytayToChed: String(obj.Transportation_From_Tagaytay_Venue_To_CHED || ''),
      participantType: participantType,
      participantTypeOther: String(obj.Participant_Type_Other || ''),
      currentDesignation: String(obj.Current_Designation || ''),
      breakoutSession1: String(obj.Breakout_Session_1 || ''),
      breakoutSession4: String(obj.Breakout_Session_4 || ''),
      emailSent: String(obj.Email_Sent || ''),
      emailError: String(obj.Email_Error || ''),
      qrImageUrl: String(obj.QR_Image_URL || ''),
      reviewNote: String(obj.Review_Note || ''),
      checkInStatus: String(obj.Check_In_Status || ''),
      checkInAt: formatDateTime_(obj.Check_In_At),
      checkInBy: String(obj.Check_In_By || ''),
      checkInMethod: String(obj.Check_In_Method || ''),
      checkInNote: String(obj.Check_In_Note || '')
    });

    stats.total++;
    if (tsLabel && tsLabel.slice(0, 10) === todayKey) stats.today++;
    if (String(obj.Check_In_Status || '') === CHECKIN_STATUS_CHECKED_IN) stats.checkedIn++;
    if (accommodation === 'Yes') stats.accommodationYes++;
    if (participantType === 'SAS Practitioner/Guidance/Faculty') stats.sasFaculty++;
    else if (participantType === 'Student') stats.student++;
    else if (participantType === 'CHED Regional Office') stats.chedro++;
    else if (participantType === 'CHED Central Office') stats.chedco++;
    else if (participantType === 'Resource Person/Facilitator/Moderator') stats.resource++;
    else if (participantType === 'Other') stats.other++;
  }

  rows.reverse();
  return jsonOutput_({ ok: true, rows: rows, stats: stats });
}


function handleCheckInParticipant_(payload) {
  requireAdmin_(payload.adminKey);

  var rawQrText = cleanText_(payload.qrText || payload.registrationCode || '', 500);
  var registrationCode = extractRegistrationCodeFromQr_(rawQrText);
  if (!registrationCode) throw new Error('Invalid QR code or registration code. Expected a 16-character alphanumeric code.');

  var method = cleanText_(payload.method, 30).toUpperCase() || 'CAMERA';
  if (['CAMERA', 'MANUAL'].indexOf(method) === -1) method = 'MANUAL';
  var note = cleanText_(payload.note, 250);
  var userAgent = cleanText_(payload.userAgent, 500);
  var clientOrigin = cleanText_(payload.clientOrigin, 200);
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(20000)) throw new Error('The check-in system is busy. Please try again.');

  try {
    var config = getConfig_();
    var sheet = getResponseSheet_(config);
    var found = findRegistrationRow_(sheet, registrationCode);
    if (!found) {
      auditLog_('participant_checkin_missing_code', 'failure', registrationCode, '', 'No registration record found. method=' + method, userAgent, clientOrigin);
      throw new Error('Registration code not found. Check the QR code or ask the participant to present the confirmation email.');
    }

    var map = columnMap_(found.headers);
    var currentStatus = String(found.values[map.Check_In_Status] || '').trim();
    if (currentStatus === CHECKIN_STATUS_CHECKED_IN) {
      var duplicateParticipant = buildParticipantPayload_(found, true);
      auditLog_('participant_checkin_duplicate', 'duplicate', registrationCode, duplicateParticipant.email, 'Already checked in. method=' + method, userAgent, clientOrigin);
      return jsonOutput_({
        ok: true,
        duplicate: true,
        message: 'This participant was already checked in at ' + (duplicateParticipant.checkInAt || 'the recorded check-in time') + '.',
        participant: duplicateParticipant
      });
    }

    var timestamp = new Date();
    sheet.getRange(found.rowNumber, map.Check_In_Status + 1).setValue(CHECKIN_STATUS_CHECKED_IN);
    sheet.getRange(found.rowNumber, map.Check_In_At + 1).setValue(formatDateTime_(timestamp));
    sheet.getRange(found.rowNumber, map.Check_In_By + 1).setValue('admin');
    sheet.getRange(found.rowNumber, map.Check_In_Method + 1).setValue(method);
    sheet.getRange(found.rowNumber, map.Check_In_Note + 1).setValue(note);
    sheet.getRange(found.rowNumber, map.Updated_At + 1).setValue(formatDateTime_(timestamp));
    sheet.getRange(found.rowNumber, map.Updated_By + 1).setValue('admin_checkin');

    var refreshed = findRegistrationRow_(sheet, registrationCode);
    var participant = buildParticipantPayload_(refreshed, false);
    appendCheckinLog_(config, participant, {
      timestamp: timestamp,
      method: method,
      checkedInBy: 'admin',
      sourceQrText: rawQrText,
      clientOrigin: clientOrigin,
      userAgent: userAgent,
      note: note
    });
    auditLog_('participant_checkin', 'ok', registrationCode, participant.email, 'Checked in onsite. method=' + method + (note ? '; note=' + note : ''), userAgent, clientOrigin);

    return jsonOutput_({
      ok: true,
      duplicate: false,
      message: 'Check-in recorded for ' + participant.fullName + '.',
      participant: participant
    });
  } finally {
    lock.releaseLock();
  }
}

function handleListCheckins_(payload) {
  requireAdmin_(payload.adminKey);
  var limit = Number(payload.limit || 30);
  if (!limit || limit < 1) limit = 30;
  if (limit > 200) limit = 200;

  var sheet = getCheckinSheet_(getConfig_());
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return jsonOutput_({ ok: true, rows: [] });

  var headers = values[0];
  var rows = [];
  for (var i = values.length - 1; i >= 1 && rows.length < limit; i--) {
    var obj = rowToObject_(headers, values[i]);
    rows.push({
      timestamp: formatDateTime_(obj.Timestamp),
      checkinId: String(obj.Checkin_ID || ''),
      registrationCode: String(obj.Registration_Code || ''),
      email: String(obj.Email_Address || ''),
      fullName: String(obj.Full_Name || ''),
      region: String(obj.Region || ''),
      hei: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
      affiliation: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
      participantType: String(obj.Participant_Type || ''),
      status: String(obj.Check_In_Status || ''),
      method: String(obj.Method || ''),
      checkedInBy: String(obj.Checked_In_By || ''),
      note: String(obj.Note || '')
    });
  }
  return jsonOutput_({ ok: true, rows: rows });
}

function handleUpdateReviewNote_(payload) {
  requireAdmin_(payload.adminKey);
  var code = cleanText_(payload.registrationCode, 40);
  if (!code) throw new Error('Missing registration code.');
  var note = cleanText_(payload.reviewNote, 2000);

  var sheet = getResponseSheet_(getConfig_());
  var found = findRegistrationRow_(sheet, code);
  if (!found) throw new Error('Registration record not found.');

  var headers = found.headers;
  var map = columnMap_(headers);
  var oldNote = String(found.values[map.Review_Note] || '');
  sheet.getRange(found.rowNumber, map.Review_Note + 1).setValue(note);
  sheet.getRange(found.rowNumber, map.Updated_At + 1).setValue(formatDateTime_(new Date()));
  sheet.getRange(found.rowNumber, map.Updated_By + 1).setValue('admin');

  auditLog_('update_review_note', 'ok', code, String(found.object.Email_Address || ''), 'old="' + oldNote + '" -> new="' + note + '"', '', '');
  return jsonOutput_({ ok: true, message: 'Review note updated.', reviewNote: note });
}

function handleResendConfirmation_(payload) {
  requireAdmin_(payload.adminKey);
  var code = cleanText_(payload.registrationCode, 40);
  if (!code) throw new Error('Missing registration code.');

  var found = findRegistrationRow_(getResponseSheet_(getConfig_()), code);
  if (!found) throw new Error('Registration record not found.');

  var obj = found.object;
  var row = rowObjectToRegistration_(obj);
  var emailResult = sendConfirmationEmailSafe_({
    eventName: getConfig_().eventName,
    organizerName: getConfig_().eventOrganizerName,
    timestamp: obj.Timestamp || new Date(),
    registrationCode: code,
    qrPayload: String(obj.QR_Payload || code),
    qrImageUrl: String(obj.QR_Image_URL || makeQrImageUrl_(String(obj.QR_Payload || code))),
    row: row
  });
  updateEmailStatus_(code, emailResult.sent ? 'YES' : 'NO', emailResult.error || '');
  auditLog_('resend_confirmation', emailResult.sent ? 'ok' : 'failure', code, row.email, emailResult.error || 'Confirmation resent by admin.', '', '');

  return jsonOutput_({
    ok: true,
    message: emailResult.sent ? 'Confirmation email resent.' : 'Resend attempted, but email failed.',
    emailSent: !!emailResult.sent,
    emailError: emailResult.error || ''
  });
}

function rowObjectToRegistration_(obj) {
  return {
    email: String(obj.Email_Address || ''),
    fullName: String(obj.Full_Name || ''),
    firstName: String(obj.First_Name || ''),
    middleInitial: String(obj.Middle_Initial || ''),
    lastName: String(obj.Last_Name || ''),
    nickName: String(obj.Nick_Name || ''),
    sexAtBirth: String(obj.Assigned_Sex_At_Birth || ''),
    region: String(obj.Region || ''),
    hei: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
    affiliation: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
    chedroOffice: String(obj.CHEDRO_Office || ''),
    chedcoOffice: String(obj.CHEDCO_Office || ''),
    resourceAffiliation: String(obj.Resource_Affiliation || ''),
    contactNumber: String(obj.Contact_Number || ''),
    foodRestrictions: String(obj.Food_Restrictions || '').split('; ').filter(Boolean),
    foodRestrictionOther: String(obj.Food_Restrictions_Other || ''),
    emergencyContact: String(obj.Emergency_Contact || ''),
    accommodation: String(obj.Will_Avail_Accommodation || ''),
    accommodationCheckInDate: formatDateOnly_(obj.Accommodation_Check_In_Date),
    accommodationCheckOutDate: formatDateOnly_(obj.Accommodation_Check_Out_Date),
    transportationFromChedToTagaytay: String(obj.Transportation_From_CHED_To_Tagaytay_Venue || '').toUpperCase() === 'YES',
    transportationFromTagaytayToChed: String(obj.Transportation_From_Tagaytay_Venue_To_CHED || '').toUpperCase() === 'YES',
    participantType: String(obj.Participant_Type || ''),
    participantTypeOther: String(obj.Participant_Type_Other || ''),
    currentDesignation: String(obj.Current_Designation || ''),
    breakoutSession1: String(obj.Breakout_Session_1 || ''),
    breakoutSession4: String(obj.Breakout_Session_4 || '')
  };
}

function registrationToRow_(headers, data) {
  var row = data.row;
  var valuesByHeader = {
    Timestamp: formatDateTime_(data.timestamp),
    Registration_Code: data.registrationCode,
    Status: data.status,
    Email_Address: row.email,
    Full_Name: row.fullName,
    First_Name: row.firstName,
    Middle_Initial: row.middleInitial,
    Last_Name: row.lastName,
    Nick_Name: row.nickName,
    Assigned_Sex_At_Birth: row.sexAtBirth,
    Region: row.region,
    Affiliation: row.affiliation || row.hei,
    Contact_Number: row.contactNumber,
    Food_Restrictions: row.foodRestrictions.join('; '),
    Food_Restrictions_Other: row.foodRestrictionOther,
    Emergency_Contact: row.emergencyContact,
    Will_Avail_Accommodation: row.accommodation,
    Accommodation_Check_In_Date: row.accommodationCheckInDate,
    Accommodation_Check_Out_Date: row.accommodationCheckOutDate,
    Transportation_From_CHED_To_Tagaytay_Venue: row.transportationFromChedToTagaytay ? 'YES' : 'NO',
    Transportation_From_Tagaytay_Venue_To_CHED: row.transportationFromTagaytayToChed ? 'YES' : 'NO',
    CHEDRO_Office: row.chedroOffice,
    CHEDCO_Office: row.chedcoOffice,
    Resource_Affiliation: row.resourceAffiliation,
    Participant_Type: row.participantType,
    Participant_Type_Other: row.participantTypeOther,
    Current_Designation: row.currentDesignation,
    Breakout_Session_1: row.breakoutSession1,
    Breakout_Session_4: row.breakoutSession4,
    Consent_Privacy: row.privacyConsent ? 'YES' : 'NO',
    Email_Sent: data.emailSent,
    Email_Error: data.emailError,
    QR_Payload: data.qrPayload,
    QR_Image_URL: data.qrImageUrl,
    Client_Origin: row.clientOrigin,
    Client_Referrer: row.clientReferrer,
    Client_Timezone: row.clientTimezone,
    Client_Locale: row.clientLocale,
    Client_Screen: row.screen,
    Form_Duration_Seconds: row.formDurationSeconds,
    User_Agent: row.userAgent,
    Created_By: 'public_form',
    Updated_At: '',
    Updated_By: '',
    Review_Note: data.reviewNote || ''
  };

  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : '';
  });
}

function getResponseSheet_(config) {
  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = ss.getSheetByName(config.sheetName);
  var headers = getResponseHeaders_();
  if (!sheet) {
    sheet = ss.insertSheet(config.sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  ensureHeaders_(sheet, headers);
  return sheet;
}


function getCheckinSheet_(config) {
  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = ss.getSheetByName(config.checkinsSheetName);
  var headers = getCheckinHeaders_();
  if (!sheet) {
    sheet = ss.insertSheet(config.checkinsSheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  ensureHeaders_(sheet, headers);
  return sheet;
}


function getOfficeSheet_(sheetName, defaultOffices) {
  var ss = SpreadsheetApp.openById(getConfig_().spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1).setValue('Office_Name');
    if (defaultOffices && defaultOffices.length) {
      sheet.getRange(2, 1, defaultOffices.length, 1).setValues(defaultOffices.map(function (name) { return [name]; }));
    }
    sheet.setFrozenRows(1);
    return sheet;
  }

  var firstHeader = String(sheet.getRange(1, 1).getValue() || '').trim();
  if (firstHeader !== 'Office_Name') sheet.getRange(1, 1).setValue('Office_Name');
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() < 2 && defaultOffices && defaultOffices.length) {
    sheet.getRange(2, 1, defaultOffices.length, 1).setValues(defaultOffices.map(function (name) { return [name]; }));
  } else if (defaultOffices && defaultOffices.length) {
    var existing = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getDisplayValues().map(function (row) { return cleanText_(row[0], 160); }).filter(Boolean);
    var existingMap = {};
    for (var e = 0; e < existing.length; e++) existingMap[normalizeKey_(existing[e])] = true;
    var missing = [];
    for (var i = 0; i < defaultOffices.length; i++) {
      if (!existingMap[normalizeKey_(defaultOffices[i])]) missing.push([defaultOffices[i]]);
    }
    if (missing.length) sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 1).setValues(missing);
  }
  return sheet;
}

function getOfficeOptions_(sheetName, defaultOffices) {
  try {
    var sheet = getOfficeSheet_(sheetName, defaultOffices);
    var values = sheet.getDataRange().getDisplayValues();
    if (!values || values.length < 2) return defaultOffices.slice();
    var out = [];
    var seen = {};
    for (var i = 1; i < values.length; i++) {
      var name = cleanText_(values[i][0], 160);
      if (!name || seen[normalizeKey_(name)]) continue;
      seen[normalizeKey_(name)] = true;
      out.push(name);
    }
    return out.length ? out : defaultOffices.slice();
  } catch (err) {
    return defaultOffices.slice();
  }
}

function getCheckinHeaders_() {
  return [
    'Timestamp',
    'Checkin_ID',
    'Registration_Code',
    'Email_Address',
    'Full_Name',
    'Region',
    'Affiliation',
    'Participant_Type',
    'Check_In_Status',
    'Method',
    'Checked_In_By',
    'Source_QR_Text',
    'Client_Origin',
    'User_Agent',
    'Note'
  ];
}

function appendCheckinLog_(config, participant, meta) {
  var sheet = getCheckinSheet_(config);
  var headers = getCheckinHeaders_();
  var valuesByHeader = {
    Timestamp: formatDateTime_(meta.timestamp),
    Checkin_ID: Utilities.getUuid(),
    Registration_Code: participant.registrationCode,
    Email_Address: participant.email,
    Full_Name: participant.fullName,
    Region: participant.region,
    Affiliation: participant.affiliation || participant.hei,
    Participant_Type: participant.participantType,
    Check_In_Status: CHECKIN_STATUS_CHECKED_IN,
    Method: meta.method,
    Checked_In_By: meta.checkedInBy,
    Source_QR_Text: String(meta.sourceQrText || '').slice(0, 500),
    Client_Origin: String(meta.clientOrigin || '').slice(0, 200),
    User_Agent: String(meta.userAgent || '').slice(0, 500),
    Note: String(meta.note || '').slice(0, 250)
  };
  sheet.appendRow(headers.map(function (h) { return Object.prototype.hasOwnProperty.call(valuesByHeader, h) ? valuesByHeader[h] : ''; }));
}

function getResponseHeaders_() {
  return [
    'Timestamp',
    'Registration_Code',
    'Status',
    'Email_Address',
    'Full_Name',
    'First_Name',
    'Middle_Initial',
    'Last_Name',
    'Nick_Name',
    'Assigned_Sex_At_Birth',
    'Region',
    'Affiliation',
    'Contact_Number',
    'Food_Restrictions',
    'Food_Restrictions_Other',
    'Emergency_Contact',
    'Will_Avail_Accommodation',
    'Participant_Type',
    'Participant_Type_Other',
    'Current_Designation',
    'Breakout_Session_1',
    'Breakout_Session_4',
    'Consent_Privacy',
    'Email_Sent',
    'Email_Error',
    'QR_Payload',
    'QR_Image_URL',
    'Client_Origin',
    'Client_Referrer',
    'Client_Timezone',
    'Client_Locale',
    'Client_Screen',
    'Form_Duration_Seconds',
    'User_Agent',
    'Created_By',
    'Updated_At',
    'Updated_By',
    'Review_Note',
    'Check_In_Status',
    'Check_In_At',
    'Check_In_By',
    'Check_In_Method',
    'Check_In_Note',
    'Accommodation_Check_In_Date',
    'Accommodation_Check_Out_Date',
    'Transportation_From_CHED_To_Tagaytay_Venue',
    'Transportation_From_Tagaytay_Venue_To_CHED',
    'CHEDRO_Office',
    'CHEDCO_Office',
    'Resource_Affiliation'
  ];
}

function ensureHeaders_(sheet, headers) {
  var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  var isDifferent = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || '') !== headers[i]) {
      isDifferent = true;
      break;
    }
  }
  if (isDifferent) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function emailAlreadyRegistered_(sheet, email) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return false;
  var headers = values[0];
  var emailCol = findExactHeaderIndex_(headers, 'Email_Address');
  if (emailCol === -1) return false;
  var target = String(email || '').trim().toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][emailCol] || '').trim().toLowerCase() === target) return true;
  }
  return false;
}

function findRegistrationRow_(sheet, code) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return null;
  var headers = values[0];
  var codeCol = findExactHeaderIndex_(headers, 'Registration_Code');
  if (codeCol === -1) throw new Error('Sheet is missing Registration_Code column.');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][codeCol] || '') === code) {
      return {
        rowNumber: i + 1,
        headers: headers,
        values: values[i],
        object: rowToObject_(headers, values[i])
      };
    }
  }
  return null;
}


function buildParticipantPayload_(found, duplicate) {
  var obj = found.object;
  return {
    duplicate: !!duplicate,
    registrationCode: String(obj.Registration_Code || ''),
    status: String(obj.Status || ''),
    email: String(obj.Email_Address || ''),
    fullName: String(obj.Full_Name || ''),
    region: String(obj.Region || ''),
    hei: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
    affiliation: String(obj.Affiliation || obj.Higher_Education_Institution || ''),
    chedroOffice: String(obj.CHEDRO_Office || ''),
    chedcoOffice: String(obj.CHEDCO_Office || ''),
    resourceAffiliation: String(obj.Resource_Affiliation || ''),
    contactNumber: String(obj.Contact_Number || ''),
    participantType: String(obj.Participant_Type || ''),
    checkInStatus: String(obj.Check_In_Status || ''),
    checkInAt: formatDateTime_(obj.Check_In_At),
    checkInBy: String(obj.Check_In_By || ''),
    checkInMethod: String(obj.Check_In_Method || ''),
    checkInNote: String(obj.Check_In_Note || '')
  };
}

function extractRegistrationCodeFromQr_(value) {
  var raw = String(value || '').trim();
  if (!raw) return '';
  var decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch (err) {}
  var candidates = [raw, decoded];

  for (var i = 0; i < candidates.length; i++) {
    var item = String(candidates[i] || '').trim();
    var compact = item.replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z0-9]{16}$/.test(compact)) return compact;

    var queryMatch = item.match(/(?:^|[?&])(?:code|registrationCode|registration_code|reg)=([A-Za-z0-9]{16})(?:[&#]|$)/i);
    if (queryMatch && queryMatch[1]) return String(queryMatch[1]).toUpperCase();

    var genericMatch = item.match(/\b([A-Za-z0-9]{16})\b/);
    if (genericMatch && genericMatch[1]) return String(genericMatch[1]).toUpperCase();
  }
  return '';
}

function formatDateTime_(value) {
  if (!value) return '';
  var raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  var date = value instanceof Date ? value : new Date(value);
  if (!date || isNaN(date.getTime())) return raw;
  return Utilities.formatDate(date, APP_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
}

function formatDateOnly_(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, APP_TIME_ZONE, 'yyyy-MM-dd');
  var raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  var date = new Date(raw);
  if (!date || isNaN(date.getTime())) return raw;
  return Utilities.formatDate(date, APP_TIME_ZONE, 'yyyy-MM-dd');
}

function cleanDate_(value) {
  var raw = cleanText_(value, 20);
  if (!raw) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Invalid date format. Use YYYY-MM-DD.');
  var date = new Date(raw + 'T00:00:00Z');
  if (!date || isNaN(date.getTime())) throw new Error('Invalid date value.');
  var normalized = Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
  if (normalized !== raw) throw new Error('Invalid date value.');
  return raw;
}

function updateEmailStatus_(registrationCode, sentValue, errorValue) {
  var sheet = getResponseSheet_(getConfig_());
  var found = findRegistrationRow_(sheet, registrationCode);
  if (!found) return;
  var map = columnMap_(found.headers);
  sheet.getRange(found.rowNumber, map.Email_Sent + 1).setValue(sentValue);
  sheet.getRange(found.rowNumber, map.Email_Error + 1).setValue(errorValue || '');
  sheet.getRange(found.rowNumber, map.Updated_At + 1).setValue(formatDateTime_(new Date()));
  sheet.getRange(found.rowNumber, map.Updated_By + 1).setValue('system');
}

function makeUniqueRegistrationCode_(sheet) {
  for (var i = 0; i < 20; i++) {
    var code = makeRegistrationCode_();
    if (!registrationCodeExists_(sheet, code)) return code;
  }
  throw new Error('Could not generate a unique registration code. Please try again.');
}

function makeRegistrationCode_() {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + '|' + new Date().getTime() + '|' + Math.random()
  );
  var raw = Utilities.base64EncodeWebSafe(digest).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return raw.slice(0, 16);
}

function registrationCodeExists_(sheet, code) {
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return false;
  var headers = values[0];
  var codeCol = findExactHeaderIndex_(headers, 'Registration_Code');
  if (codeCol === -1) return false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][codeCol] || '') === code) return true;
  }
  return false;
}

function makeQrPayload_(registrationCode, config) {
  var prefix = String(config.qrPayloadPrefix || '').trim();
  if (!prefix) return registrationCode;
  if (prefix.indexOf('{{code}}') !== -1) return prefix.replace(/{{code}}/g, registrationCode);
  return prefix + registrationCode;
}

function makeQrImageUrl_(payload) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=' + encodeURIComponent(String(payload || ''));
}

function sendConfirmationEmailSafe_(data) {
  try {
    sendConfirmationEmail_(data);
    return { sent: true, error: '' };
  } catch (err) {
    return { sent: false, error: errorMessage_(err) };
  }
}

function sendConfirmationEmail_(data) {
  var row = data.row;
  var eventName = data.eventName || 'Event Registration Portal';
  var senderName = data.organizerName || 'Event Registration Portal';
  var timestampLabel = formatDateTime_(data.timestamp);
  var food = (row.foodRestrictions || []).join('; ') + (row.foodRestrictionOther ? ' - ' + row.foodRestrictionOther : '');
  var participantType = row.participantType + (row.participantTypeOther ? ' - ' + row.participantTypeOther : '');
  var regionDisplay = row.region ? formatRegionLabel_(row.region) : 'N/A';

  var subject = '[' + eventName + '] Registration Confirmation - ' + data.registrationCode;
  var topicLines = [];
  if (row.breakoutSession1) topicLines.push('Topic 1: ' + row.breakoutSession1);
  if (row.breakoutSession4) topicLines.push('Topic 4: ' + row.breakoutSession4);
  var htmlBody = '' +
    '<div style="font-family:Arial,sans-serif;color:#0f172a;font-size:14px;line-height:1.5;">' +
    '<p>Good day ' + escapeHtml_(row.fullName) + ',</p>' +
    '<p>Your registration has been recorded. Present the QR code or registration code below during event check-in.</p>' +
    '<div style="margin:18px 0;padding:16px;border:1px solid #dbeafe;background:#eff6ff;border-radius:16px;max-width:760px;">' +
    '<p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#1d4ed8;font-weight:bold;">Registration Code</p>' +
    '<p style="margin:0;font-size:28px;font-weight:800;font-family:Consolas,Monaco,monospace;color:#0f172a;">' + escapeHtml_(data.registrationCode) + '</p>' +
    '</div>' +
    '<p><img src="' + escapeHtml_(data.qrImageUrl) + '" alt="Registration QR Code" width="220" height="220" style="display:block;border:1px solid #e2e8f0;border-radius:16px;padding:8px;background:#fff;" /></p>' +
    '<div style="margin:16px 0;padding:12px 14px;border-left:4px solid #0F6E56;background:#f0faf6;border-radius:4px;font-size:13px;line-height:1.6;color:#0f172a;">' +
    'Please email your approved Certificate of Compliance to OSDS within 5 calendar days, in accordance with CHED Memorandum Order No. 63, series of 2017, as proof that you have been authorized by your institution to participate in the activity.' +
    '</div>' +
    '<table style="border-collapse:collapse;width:100%;max-width:760px;font-family:Arial,sans-serif;font-size:14px;">' +
    rowHtml_('Timestamp', escapeHtml_(timestampLabel)) +
    rowHtml_('Event', escapeHtml_(eventName)) +
    rowHtml_('Full Name', escapeHtml_(row.fullName)) +
    rowHtml_('Email Address', escapeHtml_(row.email)) +
    rowHtml_('Region', escapeHtml_(regionDisplay)) +
    rowHtml_('Affiliation', escapeHtml_(row.affiliation || row.hei)) +
    rowHtml_('Contact Number', escapeHtml_(row.contactNumber)) +
    rowHtml_('Food Restrictions', escapeHtml_(food || 'N/A')) +
    rowHtml_('Emergency Contact', escapeHtml_(row.emergencyContact)) +
    rowHtml_('Accommodation', escapeHtml_(row.accommodation)) +
    rowHtml_('Accommodation Check-in Date', escapeHtml_(row.accommodationCheckInDate || 'N/A')) +
    rowHtml_('Accommodation Check-out Date', escapeHtml_(row.accommodationCheckOutDate || 'N/A')) +
    rowHtml_('CHED to Tagaytay Venue 02 June 2026, 2:00PM', escapeHtml_(row.transportationFromChedToTagaytay ? 'YES' : 'NO')) +
    rowHtml_('Tagaytay Venue to CHED 05 June 2026, 10:00AM', escapeHtml_(row.transportationFromTagaytayToChed ? 'YES' : 'NO')) +
    rowHtml_('Participant Type', escapeHtml_(participantType)) +
    rowHtml_('Current Designation', escapeHtml_(row.currentDesignation || 'N/A')) +
    (row.breakoutSession1 ? rowHtml_('Topic 1', escapeHtml_(row.breakoutSession1)) : '') +
    (row.breakoutSession4 ? rowHtml_('Topic 4', escapeHtml_(row.breakoutSession4)) : '') +
    '</table>' +
    '<p style="margin-top:16px;">Please keep this email for your reference.</p>' +
    '<p>Thank you.</p>' +
    '</div>';

  var plainBody = [
    'Good day ' + row.fullName + ',',
    '',
    'Your registration has been recorded. Present the QR code or registration code during event check-in.',
    '',
    'Registration Code: ' + data.registrationCode,
    'QR Payload: ' + data.qrPayload,
    '',
      'IMPORTANT: Please email your approved Certificate of Compliance to OSDS, in accordance with CHED Memorandum Order No. 63, series of 2017, as proof that you have been authorized by your institution to participate in the activity.',
    '',
    'Timestamp: ' + timestampLabel,
    'Event: ' + eventName,
    'Full Name: ' + row.fullName,
    'Email Address: ' + row.email,
    'Region: ' + regionDisplay,
    'Affiliation: ' + (row.affiliation || row.hei),
    'Contact Number: ' + row.contactNumber,
    'Food Restrictions: ' + (food || 'N/A'),
    'Emergency Contact: ' + row.emergencyContact,
    'Accommodation: ' + row.accommodation,
    'Accommodation Check-in Date: ' + (row.accommodationCheckInDate || 'N/A'),
    'Accommodation Check-out Date: ' + (row.accommodationCheckOutDate || 'N/A'),
    'CHED to Tagaytay Venue 02 June 2026, 2:00PM: ' + (row.transportationFromChedToTagaytay ? 'YES' : 'NO'),
    'Tagaytay Venue to CHED 05 June 2026, 10:00AM: ' + (row.transportationFromTagaytayToChed ? 'YES' : 'NO'),
    'Participant Type: ' + participantType,
    'Current Designation: ' + (row.currentDesignation || 'N/A')
  ].concat(topicLines, [
    '',
    'Please keep this email for your reference.',
    '',
    'Thank you.'
  ]).join('\n');

  MailApp.sendEmail({
    to: row.email,
    subject: subject,
    htmlBody: htmlBody,
    body: plainBody,
    name: senderName
  });
}

function rowHtml_(label, valueHtml) {
  return '<tr>' +
    '<td style="border:1px solid #e2e8f0;padding:8px 10px;background:#f8fafc;font-weight:600;width:210px;vertical-align:top;">' + escapeHtml_(label) + '</td>' +
    '<td style="border:1px solid #e2e8f0;padding:8px 10px;vertical-align:top;">' + valueHtml + '</td>' +
    '</tr>';
}

function enforceSpamChecks_(row, payload) {
  if (row.website) throw new Error('Spam submission blocked.');
  var filledMs = Date.now() - Number(row.formStartedAt || 0);
  if (!row.formStartedAt || filledMs < 3000) throw new Error('Submission blocked by anti-spam timer.');

  var cache = CacheService.getScriptCache();
  var fingerprint = submissionFingerprint_(row, payload);
  if (cache.get(fingerprint)) throw new Error('Duplicate or too-frequent submission blocked. Please wait before trying again.');
}

function markSubmissionFingerprint_(row, payload) {
  CacheService.getScriptCache().put(submissionFingerprint_(row, payload), '1', 60 * 5);
}

function submissionFingerprint_(row, payload) {
  var base = [row.email, row.fullName, row.region, row.affiliation || row.hei, row.userAgent].join('|');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base);
  return 'submit:' + Utilities.base64EncodeWebSafe(digest);
}

function requireAdmin_(adminKey) {
  var cache = CacheService.getScriptCache();
  if (cache.get(ADMIN_LOCKOUT_CACHE_KEY)) {
    throw new Error('Admin access is temporarily locked due to repeated failed logins. Try again in ~15 minutes.');
  }
  var expected = getConfig_().adminKey;
  if (!expected) throw new Error('ADMIN_KEY is not configured in Script Properties.');
  if (String(adminKey || '').trim() !== expected) {
    var attempts = Number(cache.get(ADMIN_FAILED_CACHE_KEY) || 0) + 1;
    if (attempts >= ADMIN_MAX_ATTEMPTS) {
      cache.put(ADMIN_LOCKOUT_CACHE_KEY, '1', ADMIN_LOCKOUT_SECONDS);
      cache.remove(ADMIN_FAILED_CACHE_KEY);
      auditLog_('admin_lockout_triggered', 'failure', '', '', 'attempts=' + attempts, '', '');
      throw new Error('Too many failed admin login attempts. Locked for 15 minutes.');
    }
    cache.put(ADMIN_FAILED_CACHE_KEY, String(attempts), ADMIN_FAIL_WINDOW_SECONDS);
    auditLog_('admin_login_failed', 'failure', '', '', 'attempt ' + attempts + '/' + ADMIN_MAX_ATTEMPTS, '', '');
    throw new Error('Unauthorized admin request.');
  }
  cache.remove(ADMIN_FAILED_CACHE_KEY);
}

function getAuditSheet_() {
  var props = PropertiesService.getScriptProperties();
  var name = props.getProperty('AUDIT_SHEET_NAME') || 'Audit';
  var ss = SpreadsheetApp.openById(getConfig_().spreadsheetId);
  var sheet = ss.getSheetByName(name);
  var headers = ['Timestamp', 'Event_ID', 'Action', 'Status', 'Actor', 'Registration_Code', 'Email_Address', 'Detail', 'User_Agent', 'Client_Origin'];
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders_(sheet, headers);
  }
  return sheet;
}

function auditLog_(action, status, registrationCode, email, detail, userAgent, clientOrigin) {
  try {
    getAuditSheet_().appendRow([
      formatDateTime_(new Date()),
      Utilities.getUuid(),
      String(action || ''),
      String(status || ''),
      'system',
      String(registrationCode || ''),
      String(email || ''),
      String(detail == null ? '' : detail).slice(0, 1000),
      String(userAgent || '').slice(0, 500),
      String(clientOrigin || '').slice(0, 200)
    ]);
  } catch (err) {
    // Best-effort: never let audit failure break the request.
  }
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',
    sheetName: props.getProperty('RESPONSES_SHEET_NAME') || 'Registrations',
    auditSheetName: props.getProperty('AUDIT_SHEET_NAME') || 'Audit',
    checkinsSheetName: props.getProperty('CHECKINS_SHEET_NAME') || 'Checkins',
    heiListSheetName: props.getProperty('HEI_LIST_SHEET_NAME') || 'HEI_List',
    chedroSheetName: props.getProperty('CHEDRO_SHEET_NAME') || 'CHEDRO',
    chedcoSheetName: props.getProperty('CHEDCO_SHEET_NAME') || 'CHEDCO',
    adminKey: props.getProperty('ADMIN_KEY') || '',
    submitSharedToken: props.getProperty('SUBMIT_SHARED_TOKEN') || '',
    turnstileEnabled: String(props.getProperty('TURNSTILE_ENABLED') || 'TRUE').toUpperCase() !== 'FALSE',
    turnstileSecretKey: props.getProperty('TURNSTILE_SECRET_KEY') || '',
    eventName: props.getProperty('EVENT_NAME') || 'Event Registration Portal',
    eventOrganizerName: props.getProperty('EVENT_ORGANIZER_NAME') || 'Event Registration Portal',
    qrPayloadPrefix: props.getProperty('QR_PAYLOAD_PREFIX') || ''
  };
}

function verifySubmitToken_(token) {
  var expected = getConfig_().submitSharedToken;
  if (!expected) return;
  if (String(token || '').trim() !== expected) throw new Error('Submission token invalid.');
}

function verifyTurnstile_(token) {
  var config = getConfig_();
  if (!config.turnstileEnabled) return;
  var secret = config.turnstileSecretKey;
  if (!secret) throw new Error('Turnstile is enabled but TURNSTILE_SECRET_KEY is not configured in Apps Script Properties.');
  if (!token) throw new Error('CAPTCHA verification required.');
  var resp;
  try {
    resp = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: { secret: secret, response: String(token) },
      muteHttpExceptions: true
    });
  } catch (err) {
    throw new Error('CAPTCHA verification could not be completed: ' + (err && err.message ? err.message : 'fetch error'));
  }
  var body = {};
  try { body = JSON.parse(resp.getContentText() || '{}'); } catch (err) {}
  if (!body.success) {
    var codes = (body['error-codes'] || []).join(', ');
    throw new Error('CAPTCHA verification failed' + (codes ? ': ' + codes : '.'));
  }
}

function setupProject_() {
  var config = getConfig_();
  if (!config.spreadsheetId || config.spreadsheetId === 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE') throw new Error('Set SPREADSHEET_ID in Script Properties first.');
  try { SpreadsheetApp.openById(config.spreadsheetId).setSpreadsheetTimeZone(APP_TIME_ZONE); } catch (err) {}
  getResponseSheet_(config);
  getCheckinSheet_(config);
  getOfficeSheet_(config.chedroSheetName, CHEDRO_OFFICE_OPTIONS);
  getOfficeSheet_(config.chedcoSheetName, CHEDCO_OFFICE_OPTIONS);
  getAuditSheet_();
  return 'Setup complete.';
}

function emptyStats_() {
  return { total: 0, today: 0, checkedIn: 0, accommodationYes: 0, sasFaculty: 0, student: 0, chedro: 0, chedco: 0, resource: 0, other: 0 };
}

function columnMap_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) map[String(headers[i])] = i;
  var required = ['Email_Sent', 'Email_Error', 'Updated_At', 'Updated_By', 'Review_Note', 'Check_In_Status', 'Check_In_At', 'Check_In_By', 'Check_In_Method', 'Check_In_Note'];
  for (var r = 0; r < required.length; r++) {
    if (typeof map[required[r]] === 'undefined') throw new Error('Sheet is missing required column: ' + required[r]);
  }
  return map;
}

function findExactHeaderIndex_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '') === name) return i;
  }
  return -1;
}

function findHeaderIndex_(headers, candidates) {
  var normalizedCandidates = candidates.map(function (h) { return normalizeHeader_(h); });
  for (var i = 0; i < headers.length; i++) {
    var current = normalizeHeader_(headers[i]);
    if (normalizedCandidates.indexOf(current) !== -1) return i;
  }
  return -1;
}

function normalizeHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) obj[String(headers[i])] = row[i];
  return obj;
}

function cleanText_(value, maxLen) {
  var out = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  out = normalizeSpaces_(out);
  return maxLen ? out.slice(0, maxLen) : out;
}

function normalizeSpaces_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function errorMessage_(err) {
  return err && err.message ? err.message : 'Unexpected server error.';
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
