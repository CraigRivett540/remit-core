const state = {
  orgId: null,
  orgName: 'Organisation',
  backend: 'memory',
  requests: [],
  hazards: [],
  outcomes: [],
  currentFilter: 'all',
  activeRequestId: null,
  activeHazardId: null,
  activeOutcomeId: null,
  letterCache: {},
  hazardValidation: {},
};

const REQUEST_LABEL = {
  approved: 'Approved',
  refused: 'Refused',
  flagged: 'Flagged',
  pending: 'Awaiting assessment',
  modified: 'Modified',
};

const CONSISTENCY_LABEL = {
  pending: 'Pending',
  clear: 'Consistent',
  flag: 'Flagged',
  resolved: 'Resolved',
};

const GROUNDS = [
  'Select a permitted ground…',
  'Inherent requirements — on-site attendance required',
  'On-site equipment required',
  'In-person client / customer interaction',
  'Supervision of a co-located team',
  'Genuine business operational needs',
];

const ASSESSMENT_TEMPLATE = [
  { key: 'client-interaction', label: 'Client / customer in-person interaction', rating: 'amber', note: 'Assessment captured by decision owner.' },
  { key: 'team-collaboration', label: 'Team collaboration dependency', rating: 'green', note: 'Collaboration expectations reviewed for remote operation.' },
  { key: 'supervision', label: 'Supervision needs', rating: 'green', note: 'Supervision requirements assessed in role context.' },
  { key: 'confidentiality', label: 'Confidentiality / data handling', rating: 'green', note: 'Controls aligned to APP-grade handling requirements.' },
  { key: 'whs-home', label: 'Home-office WHS assessment', rating: 'amber', note: 'Duty checks captured in the request workflow.' },
  { key: 'technology', label: 'Technology provided', rating: 'green', note: 'Required tools and access pathway reviewed.' },
];

const screens = {
  overview: 'Overview',
  requests: 'WFH Requests',
  whs: 'Wellbeing & WHS',
  outcomes: 'Outcomes',
  compliance: 'Compliance Register',
  settings: 'Settings',
};

const sectMap = {
  overview: 'Govern',
  requests: 'Govern',
  whs: 'Govern',
  outcomes: 'Govern',
  compliance: 'Reference',
  settings: 'Reference',
};

const DEMO_STEPS = [
  { t: 'Open Overview', d: 'See live workload and queue metrics from API data.', go: () => showScreen('overview') },
  { t: 'Open WFH Requests', d: 'Review requests and decision files.', go: () => showScreen('requests') },
  { t: 'Open Wellbeing & WHS', d: 'Inspect hazards and complete review events.', go: () => showScreen('whs') },
  { t: 'Open Outcomes', d: 'Record outcome-contract cycle reviews.', go: () => showScreen('outcomes') },
  { t: 'Refresh data', d: 'Reload current API state from the server.', go: () => void resetDemo() },
];
let demoDone = [];

const byId = (id) => document.getElementById(id);
const readValue = (id) => {
  const field = byId(id);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
    ? field.value.trim()
    : '';
};

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toMessage = (error) => error instanceof Error ? error.message : String(error);

function toast(message) {
  const el = byId('toast');
  const msg = byId('toast-msg');
  if (!el || !msg) return;
  msg.textContent = message;
  el.classList.add('show');
  clearTimeout(el._toastTimeout);
  el._toastTimeout = setTimeout(() => el.classList.remove('show'), 2600);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function requestInitials(request) {
  return request.employee
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('') || '—';
}

function frameworkForJurisdiction(jurisdiction) {
  if (jurisdiction === 'VIC') {
    return {
      now: 'Employer hybrid policy + Fair Work Act 2009 (Cth) s 65',
      future: 'Equal Opportunity Act 2010 (Vic) — statutory pathway from 1 Sep 2026',
    };
  }
  const staged = {
    NSW: 'WHS Act 2011 (NSW) + Digital Work Systems Act 2026',
    QLD: 'WHS Act 2011 (Qld) + Psychosocial Risks Amendment Reg 2022',
    WA: 'WHS Act 2020 (WA) + WHS (General) Regs 2022',
    SA: 'WHS Act 2012 (SA) + applicable psychosocial controls',
    TAS: 'WHS Act 2012 (Tas) + applicable psychosocial controls',
    ACT: 'WHS Act 2011 (ACT) + applicable psychosocial controls',
    NT: 'WHS Act 2011 (NT) + applicable psychosocial controls',
  };
  return {
    now: 'Fair Work Act 2009 (Cth) s 65 — right to request',
    future: staged[jurisdiction] ?? 'Jurisdictional profile applied from compliance register',
  };
}

function requestSubmitted(request) {
  return formatDate(request.audit?.[0]?.at);
}

function requestAssessmentRows(request) {
  if (request.assessment?.length) {
    return request.assessment.map((factor) => [factor.label, factor.note, factor.rating]);
  }
  return ASSESSMENT_TEMPLATE.map((factor) => [
    factor.label,
    request.assessmentComplete ? 'Assessment completed.' : 'Pending assessment.',
    request.assessmentComplete ? 'green' : 'amber',
  ]);
}

function requestAuditRows(request) {
  const rows = (request.audit ?? []).map((event) => [formatDateTime(event.at), event.event, 0]);
  if (!request.decision) rows.push(['—', 'Awaiting decision', 1]);
  return rows;
}

function requestPill(status) {
  const klass = status;
  return `<span class="pill ${esc(klass)}">${esc(REQUEST_LABEL[status] ?? status)}</span>`;
}

function consistencyPill(consistencyState) {
  const klass = consistencyState === 'flag'
    ? 'flagged'
    : consistencyState === 'clear'
      ? 'approved'
      : consistencyState === 'resolved'
        ? 'modified'
        : 'pending';
  return `<span class="pill ${klass}">${esc(CONSISTENCY_LABEL[consistencyState] ?? consistencyState)}</span>`;
}

async function api(path, init = {}) {
  const needsOrgHeader = /^\/api\/(requests|hazards|contracts)/.test(path);
  const headers = { 'Content-Type': 'application/json', ...(init.headers ?? {}) };
  if (needsOrgHeader && state.orgId) headers['x-org-id'] = state.orgId;

  const response = await fetch(path, {
    method: 'GET',
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body.data;
}

async function fetchAll(endpoint) {
  const limit = 100;
  let offset = 0;
  const allItems = [];
  for (;;) {
    const data = await api(`${endpoint}?limit=${limit}&offset=${offset}`);
    if (Array.isArray(data)) return data;
    const items = Array.isArray(data?.items) ? data.items : [];
    const page = data?.page ?? {};
    allItems.push(...items);
    if (!page.hasNext) break;
    offset += page.limit ?? limit;
  }
  return allItems;
}

function findRequest(id) {
  return state.requests.find((item) => item.id === id);
}

function findHazard(id) {
  return state.hazards.find((item) => item.id === id);
}

function findOutcome(id) {
  return state.outcomes.find((item) => item.id === id);
}

async function refreshHealth() {
  const health = await api('/api/health');
  state.orgId = health.orgId ?? state.orgId;
  state.orgName = health.org ?? state.orgName;
  state.backend = health.backend ?? state.backend;
}

async function refreshRequests() {
  state.requests = await fetchAll('/api/requests');
  if (state.activeRequestId && !findRequest(state.activeRequestId)) state.activeRequestId = null;
}

async function refreshHazards() {
  state.hazards = await fetchAll('/api/hazards');
  if (state.activeHazardId && !findHazard(state.activeHazardId)) state.activeHazardId = null;
}

async function refreshOutcomes() {
  state.outcomes = await fetchAll('/api/contracts');
  if (state.activeOutcomeId && !findOutcome(state.activeOutcomeId)) state.activeOutcomeId = null;
}

function renderOrgDetails() {
  const orgName = document.querySelector('.org .nm');
  if (orgName) orgName.textContent = state.orgName;

  const counts = state.requests.reduce((acc, request) => {
    acc[request.jurisdiction] = (acc[request.jurisdiction] ?? 0) + 1;
    return acc;
  }, {});
  const ordered = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([jurisdiction, count]) => `${jurisdiction} ${count}`);
  const orgJurisdictions = document.querySelector('.org .ju');
  if (orgJurisdictions) orgJurisdictions.textContent = ordered.length ? ordered.join(' · ') : 'No request records yet';
}

function renderJurisdictionBars() {
  const container = byId('jur-bars');
  if (!container) return;

  const counts = state.requests.reduce((acc, request) => {
    acc[request.jurisdiction] = (acc[request.jurisdiction] ?? 0) + 1;
    return acc;
  }, {});
  const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!ordered.length) {
    container.innerHTML = '<div class="ctrlnote">No jurisdiction data yet. It will populate as requests are added.</div>';
    return;
  }

  const max = ordered[0][1] || 1;
  container.innerHTML = ordered
    .map(([jurisdiction, count]) => {
      const width = Math.max(10, Math.round((count / max) * 100));
      return `<div class="jbar"><span class="jn">${esc(jurisdiction)}</span><div class="track"><div class="fill" style="width:${width}%"></div></div><span class="jv">${count}</span></div>`;
    })
    .join('');
}

function filteredRequests() {
  if (state.currentFilter === 'all') return state.requests;
  return state.requests.filter((request) => request.status === state.currentFilter);
}

function renderFilters() {
  const counts = {
    all: state.requests.length,
    flagged: state.requests.filter((request) => request.status === 'flagged').length,
    pending: state.requests.filter((request) => request.status === 'pending').length,
    approved: state.requests.filter((request) => request.status === 'approved').length,
    refused: state.requests.filter((request) => request.status === 'refused').length,
    modified: state.requests.filter((request) => request.status === 'modified').length,
  };
  const defs = [
    ['all', 'All'],
    ['flagged', 'Flagged'],
    ['pending', 'Awaiting'],
    ['approved', 'Approved'],
    ['refused', 'Refused'],
    ['modified', 'Modified'],
  ];
  const filters = byId('filters');
  if (!filters) return;
  filters.innerHTML = defs
    .filter(([key]) => key === 'all' || counts[key] > 0)
    .map(([key, label]) => (
      `<button class="fchip ${key === state.currentFilter ? 'on' : ''}" onclick="setFilter('${esc(key)}')">${esc(label)} · ${counts[key]}</button>`
    ))
    .join('');
}

function renderRows() {
  const tbody = byId('req-rows');
  if (!tbody) return;
  const rows = filteredRequests()
    .map((request) => (
      `<tr class="clk" onclick="openRequest('${esc(request.id)}')">
        <td class="mono">${esc(request.id)}</td>
        <td>
          <div class="who">
            <div class="av">${esc(requestInitials(request))}</div>
            <div>
              <div class="nm">${esc(request.employee)}</div>
              <div class="rl">${esc(request.role)}</div>
            </div>
          </div>
        </td>
        <td>${esc(request.days)}</td>
        <td><span class="jtag">${esc(request.jurisdiction)}</span></td>
        <td>${requestPill(request.status)}</td>
        <td class="mono">${esc(requestSubmitted(request))}</td>
      </tr>`
    ))
    .join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:24px">No requests in this view.</td></tr>';
}

function renderList() {
  renderFilters();
  renderRows();
}

function hazardPill(status) {
  if (status === 'due') return '<span class="pill flagged">Review due</span>';
  if (status === 'reviewed') return '<span class="pill modified">Reviewed</span>';
  return '<span class="pill approved">On track</span>';
}

function primaryControl(hazard) {
  return hazard.controls?.find((control) => control.primary)?.text
    ?? hazard.controls?.[0]?.text
    ?? 'No controls recorded';
}

function renderHazards() {
  const tbody = byId('haz-rows');
  if (!tbody) return;
  tbody.innerHTML = state.hazards
    .map((hazard) => (
      `<tr class="clk" onclick="openHazard('${esc(hazard.id)}')">
        <td><b>${esc(hazard.name)}</b></td>
        <td class="mono">${esc(hazard.type)}</td>
        <td>${esc(primaryControl(hazard))}</td>
        <td><span class="jtag">${esc(hazard.jurisdiction)}</span></td>
        <td class="mono">${esc(formatDate(hazard.reviewDate))}</td>
        <td>${hazardPill(hazard.status)}</td>
      </tr>`
    ))
    .join('');
  if (!state.hazards.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:24px">No hazards recorded.</td></tr>';
  }
}

function outcomePill(status) {
  if (status === 'review') return '<span class="pill flagged">In review</span>';
  if (status === 'reviewed') return '<span class="pill modified">Reviewed</span>';
  return '<span class="pill approved">On track</span>';
}

function renderOutcomes() {
  const tbody = byId('out-rows');
  if (!tbody) return;
  tbody.innerHTML = state.outcomes
    .map((contract) => {
      const done = contract.outcomes.filter((outcome) => outcome.state === 'done').length;
      return `<tr class="clk" onclick="openOutcome('${esc(contract.id)}')">
        <td>
          <div class="who">
            <div class="av">${esc(requestInitials({ employee: contract.employee }))}</div>
            <div>
              <div class="nm">${esc(contract.employee)}</div>
              <div class="rl">${esc(contract.jurisdiction)}</div>
            </div>
          </div>
        </td>
        <td class="mono">${esc(contract.period)}</td>
        <td>${done} of ${contract.outcomes.length} delivered</td>
        <td class="mono">${esc(contract.signalSource)}</td>
        <td>${outcomePill(contract.status)}</td>
      </tr>`;
    })
    .join('');
  if (!state.outcomes.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-faint);padding:24px">No outcome contracts recorded.</td></tr>';
  }
}

function updateOverview() {
  const openCount = state.requests.filter((request) => request.status === 'pending' || request.status === 'flagged').length;
  const pendingCount = state.requests.filter((request) => request.status === 'pending').length;
  const flaggedCount = state.requests.filter((request) => request.status === 'flagged').length;
  const dueHazards = state.hazards.filter((hazard) => hazard.status === 'due').length;
  const onTrackOutcomes = state.outcomes.filter((contract) => contract.status === 'ontrack').length;

  const openNode = byId('ov-open');
  const flaggedNode = byId('ov-flag');
  const openMeta = byId('ov-open-m');
  if (openNode) openNode.textContent = String(openCount);
  if (flaggedNode) flaggedNode.textContent = String(flaggedCount);
  if (openMeta) openMeta.textContent = `${pendingCount} awaiting assessment`;

  const statNumbers = document.querySelectorAll('#screen-overview .stat .n');
  const statMeta = document.querySelectorAll('#screen-overview .stat .meta');
  if (statNumbers.length >= 5) {
    if (statNumbers[2]) statNumbers[2].textContent = String(state.hazards.length);
    if (statNumbers[3]) statNumbers[3].textContent = String(state.outcomes.length);
    if (statNumbers[4]) statNumbers[4].textContent = state.outcomes.length ? `${Math.round((onTrackOutcomes / state.outcomes.length) * 100)}%` : '—';
  }
  if (statMeta.length >= 5) {
    if (statMeta[2]) statMeta[2].textContent = `${dueHazards} review due`;
    if (statMeta[3]) statMeta[3].textContent = state.outcomes.length ? `${onTrackOutcomes} on track` : 'No contracts yet';
    if (statMeta[4]) statMeta[4].textContent = state.outcomes.length ? 'Outcome-state proxy' : 'No data yet';
  }
  renderJurisdictionBars();

  const badge = byId('nav-badge');
  if (badge) {
    badge.textContent = String(openCount);
    badge.style.display = openCount ? 'inline-block' : 'none';
  }

  const queue = byId('att-queue');
  if (!queue) return;
  const items = [];
  state.requests
    .filter((request) => request.status === 'flagged')
    .forEach((request) => {
      items.push(`<div class="item">
        <div class="ic o">!</div>
        <div>
          <div class="tt">Consistency flag — ${esc(request.employee)} (${esc(request.id)})</div>
          <div class="ds">Resolve the consistency flag before issuing adverse decisions.</div>
        </div>
        <button class="btn ghost sm go" onclick="openRequest('${esc(request.id)}')">Review</button>
      </div>`);
    });
  state.hazards
    .filter((hazard) => hazard.status === 'due')
    .forEach((hazard) => {
      items.push(`<div class="item">
        <div class="ic a">⏱</div>
        <div>
          <div class="tt">Hazard review due — ${esc(hazard.name)}</div>
          <div class="ds">Review date ${esc(formatDate(hazard.reviewDate))} is due.</div>
        </div>
        <button class="btn ghost sm go" onclick="openHazard('${esc(hazard.id)}')">Open</button>
      </div>`);
    });
  state.requests
    .filter((request) => request.status === 'pending')
    .forEach((request) => {
      items.push(`<div class="item">
        <div class="ic r">▢</div>
        <div>
          <div class="tt">Assessment outstanding — ${esc(request.employee)} (${esc(request.id)})</div>
          <div class="ds">Role-suitability assessment is not yet complete.</div>
        </div>
        <button class="btn ghost sm go" onclick="openRequest('${esc(request.id)}')">Open</button>
      </div>`);
    });
  if (items.length) {
    queue.innerHTML = items.join('');
    return;
  }
  queue.innerHTML = state.requests.length || state.hazards.length || state.outcomes.length
    ? '<div class="empty">Nothing needs attention right now.</div>'
    : '<div class="empty">No records yet. Add your first request, hazard, or outcome contract to begin.</div>';
}

function updateCountdown() {
  const target = new Date('2026-09-01T00:00:00+10:00');
  const now = new Date();
  const days = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
  const el = byId('countdown');
  if (!el) return;
  el.innerHTML = `${days > 0 ? days : 'Now'}<small>${days > 0 ? 'days' : 'in force'}</small>`;
}

function renderAll() {
  renderOrgDetails();
  renderList();
  renderHazards();
  renderOutcomes();
  updateOverview();
}

async function refreshAll() {
  await refreshHealth();
  await Promise.all([refreshRequests(), refreshHazards(), refreshOutcomes()]);
  renderAll();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  const target = byId(`screen-${name}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('#nav button').forEach((button) => {
    button.classList.toggle('active', button.dataset.s === name);
  });
  const title = byId('title');
  const crumb = byId('crumb');
  if (title) title.textContent = screens[name] ?? 'Overview';
  if (crumb) crumb.textContent = `${sectMap[name] ?? 'Govern'} / ${screens[name] ?? 'Overview'}`;

  if (name === 'requests') backToList();
  if (name === 'whs') backHaz();
  if (name === 'outcomes') backOut();
  byId('side')?.classList.remove('open');
}

function backToList() {
  state.activeRequestId = null;
  const detail = byId('req-detail');
  const list = byId('req-list');
  if (detail) {
    detail.classList.remove('active');
    detail.innerHTML = '';
  }
  if (list) list.style.display = 'block';
}

async function loadLetterPreview(id, silent = false) {
  try {
    const response = await api(`/api/requests/${id}/letter`);
    state.letterCache[id] = response.letter;
    const pre = byId(`letter-pre-${id}`);
    if (pre) pre.textContent = response.letter;
    if (!silent) toast('Letter preview refreshed');
  } catch (error) {
    toast(toMessage(error));
  }
}

async function openRequest(id) {
  const request = findRequest(id);
  if (!request) return;
  state.activeRequestId = id;
  showScreen('requests');

  if (request.decision && !state.letterCache[id]) {
    await loadLetterPreview(id, true);
  }

  const framework = frameworkForJurisdiction(request.jurisdiction);
  const assessments = requestAssessmentRows(request)
    .map((factor) => `<div class="ar"><span class="dotf ${esc(factor[2])}"></span><span class="aq">${esc(factor[0])}</span><span class="aa">${esc(factor[1])}</span></div>`)
    .join('');

  let consistencyBlock = '';
  if (request.consistency.state === 'flag') {
    consistencyBlock = `<div class="ccheck flag">
      <div class="cct"><span class="cci">!</span> Inconsistency flagged</div>
      <p>${esc(request.consistency.rationale ?? 'Comparable record conflict detected.')}</p>
      <div class="cmp">Comparable decision: ${esc(request.consistency.comparatorId ?? 'record found')}</div>
      <div class="rec"><b>Recommended:</b> ${esc(request.consistency.recommendation ?? 'Align or record a distinguishing factor before refusing.')}</div>
    </div>`;
  } else if (request.consistency.state === 'clear') {
    consistencyBlock = `<div class="ccheck clear"><div class="cct"><span class="cci">✓</span> Consistent</div><p>${esc(request.consistency.rationale ?? 'No conflicting comparator found.')}</p></div>`;
  } else if (request.consistency.state === 'resolved') {
    consistencyBlock = `<div class="ccheck resolved"><div class="cct"><span class="cci">✓</span> Flag resolved</div><p>${esc(request.consistency.note ?? 'Consistency concern has been resolved.')}</p></div>`;
  } else {
    consistencyBlock = `<div class="ccheck idle"><div class="cct"><span class="cci">…</span> Not yet run</div><p>${esc(request.consistency.rationale ?? 'Runs after assessment completes.')}</p></div>`;
  }

  let decisionBlock = '';
  if (!request.assessmentComplete) {
    decisionBlock = `<div class="locknote">Complete the role-suitability assessment to run the consistency check and unlock the decision.</div>
      <div class="dec-actions"><button class="btn" onclick="completeAssessment('${esc(id)}')">Complete assessment</button></div>`;
  } else if (request.decision) {
    decisionBlock = `<div style="margin-bottom:10px">${requestPill(request.decision.type)}</div>
      <div class="grounds"><div class="gl">Recorded ground</div><div style="font-size:12.5px;line-height:1.5">${esc(request.decision.ground)}</div></div>`;
  } else if (request.consistency.state === 'flag') {
    decisionBlock = `<div class="dec-actions">
        <button class="btn" onclick="decide('${esc(id)}','approved')">Align with comparator &amp; approve</button>
        <button class="btn ghost" onclick="toggleDistinguish('${esc(id)}')">Record distinguishing factor</button>
        <button class="btn ghost" disabled title="Locked by the consistency flag">Refuse</button>
      </div>
      <div id="dz-${esc(id)}" class="distinguish" style="display:none">
        <div class="dl">Material factor distinguishing this role from the comparator</div>
        <textarea id="dt-${esc(id)}" class="ta" placeholder="Describe the material distinction for the record..."></textarea>
        <div style="margin-top:9px"><button class="btn sm" onclick="saveDistinguish('${esc(id)}')">Save factor &amp; unlock refusal</button></div>
      </div>
      <div class="locknote">Refusal is locked until the flag is resolved.</div>`;
  } else {
    const options = GROUNDS.map((ground) => `<option>${esc(ground)}</option>`).join('');
    decisionBlock = `<div class="grounds">
        <div class="gl">Refusal / modification ground (controlled vocabulary)</div>
        <select class="sel" id="g-${esc(id)}">${options}</select>
      </div>
      <div class="dec-actions">
        <button class="btn" onclick="decide('${esc(id)}','approved')">Approve</button>
        <button class="btn ghost" onclick="decide('${esc(id)}','modified')">Modify</button>
        <button class="btn ghost" onclick="decide('${esc(id)}','refused')">Refuse</button>
      </div>`;
  }

  const letterPreview = state.letterCache[id];
  const letterBlock = request.decision
    ? `<div class="lettercard issued">
        <div class="lt">Decision letter</div>
        <div class="lm">Generated from live API output for this request.</div>
        <div class="dec-actions" style="margin-top:10px">
          <button class="btn ghost sm" onclick="loadLetterPreview('${esc(id)}')">Refresh letter preview</button>
        </div>
        <pre id="letter-pre-${esc(id)}" style="margin-top:10px;max-height:220px">${esc(letterPreview ?? 'No letter cached yet.')}</pre>
      </div>`
    : `<div class="lettercard"><div class="lt">Decision letter</div><div class="lm">Letter generation is available once a decision is recorded.</div></div>`;

  const auditRail = requestAuditRows(request)
    .map((event) => `<div class="ev ${event[2] ? 'pending' : ''}"><div class="et">${esc(event[0])}</div><div class="ee">${esc(event[1])}</div></div>`)
    .join('');

  const detail = byId('req-detail');
  const list = byId('req-list');
  if (!detail || !list) return;
  detail.innerHTML = `
    <button class="back" onclick="backToList()">‹ Back to requests</button>
    <div class="dhead">
      <div class="who"><div class="av">${esc(requestInitials(request))}</div></div>
      <div>
        <div class="nm2">${esc(request.employee)}</div>
        <div class="rl2">${esc(request.role)}</div>
        <div class="idln">${esc(request.id)} · submitted ${esc(requestSubmitted(request))} · Home (${esc(request.jurisdiction)})</div>
      </div>
      <div class="rt">${requestPill(request.status)}<span class="jtag">${esc(request.jurisdiction)}</span></div>
    </div>
    <div class="framew mt16">
      <div class="fw"><div class="fl">Applicable framework — now</div><div class="fv">${esc(framework.now)}</div></div>
      <div class="fw future"><div class="fl">Staged</div><div class="fv">${esc(framework.future)}</div></div>
    </div>
    <div class="dgrid">
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="panel"><div class="ph"><span class="step">1</span><span class="pt">The request</span></div><div class="pb"><div class="reqline"><div><div class="rl3">Days</div><div class="rv3">${esc(request.days)}</div></div><div><div class="rl3">Pattern</div><div class="rv3">${esc(request.pattern)}</div></div><div><div class="rl3">Place of work</div><div class="rv3">Home (${esc(request.jurisdiction)})</div></div></div></div></div>
        <div class="panel"><div class="ph"><span class="step">2</span><span class="pt">Role-suitability assessment</span><span class="pmeta">${request.assessmentComplete ? `${request.assessment.length} factors` : 'incomplete'}</span></div><div class="pb"><div class="asmt">${assessments}</div></div></div>
        <div class="panel"><div class="ph"><span class="step">3</span><span class="pt">Consistency check</span><span class="pmeta">adverse-action guardrail</span></div><div class="pb">${consistencyBlock}</div></div>
        <div class="panel"><div class="ph"><span class="step">4</span><span class="pt">Decision</span></div><div class="pb">${decisionBlock}</div></div>
        <div class="panel"><div class="ph"><span class="step">5</span><span class="pt">Decision letter</span></div><div class="pb">${letterBlock}</div></div>
      </div>
      <div>
        <div class="panel">
          <div class="ph"><span class="step" style="background:var(--ochre)">∎</span><span class="pt">Audit trail</span></div>
          <div class="pb">
            <div class="rail">${auditRail}</div>
            <div class="ctrlnote" style="text-align:center;margin-top:8px">Timestamped, 7-year retained, dispute-ready.</div>
          </div>
        </div>
      </div>
    </div>`;
  list.style.display = 'none';
  detail.classList.add('active');
  window.scrollTo(0, 0);
}

function toggleDistinguish(id) {
  const panel = byId(`dz-${id}`);
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function assessmentTemplateFor(request) {
  return ASSESSMENT_TEMPLATE.map((factor) => ({
    ...factor,
    note: factor.key === 'client-interaction' && /manager|lead|operations/i.test(request.role)
      ? 'Role has in-person dependencies recorded in assessment.'
      : factor.note,
  }));
}

async function completeAssessment(id) {
  const request = findRequest(id);
  if (!request) return;
  try {
    await api(`/api/requests/${id}/assessment`, {
      method: 'POST',
      body: JSON.stringify({ factors: assessmentTemplateFor(request) }),
    });
    await refreshAll();
    toast('Assessment completed');
    await openRequest(id);
  } catch (error) {
    toast(toMessage(error));
  }
}

async function saveDistinguish(id) {
  const factor = readValue(`dt-${id}`);
  if (!factor) {
    toast('Add a distinguishing factor first');
    return;
  }
  try {
    await api(`/api/requests/${id}/distinguish`, {
      method: 'POST',
      body: JSON.stringify({ factor }),
    });
    await refreshAll();
    toast('Factor recorded');
    await openRequest(id);
  } catch (error) {
    toast(toMessage(error));
  }
}

async function decide(id, type) {
  let ground = 'Role can reasonably be performed remotely on the nominated days.';
  if (type !== 'approved') {
    const selected = readValue(`g-${id}`);
    if (!selected || selected.startsWith('Select')) {
      toast('Select a permitted ground first');
      return;
    }
    ground = type === 'modified' ? `Modified — ${selected}. Reviewable in 3 months.` : `Refused — ${selected}.`;
  }
  try {
    await api(`/api/requests/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ type, ground }),
    });
    await loadLetterPreview(id, true);
    await refreshAll();
    toast(`${REQUEST_LABEL[type] ?? type} recorded`);
    await openRequest(id);
  } catch (error) {
    toast(toMessage(error));
  }
}

function openNew() {
  byId('overlay')?.classList.add('open');
  const name = byId('nf-name');
  if (name instanceof HTMLInputElement) name.focus();
}

function closeNew() {
  byId('overlay')?.classList.remove('open');
  ['nf-name', 'nf-role', 'nf-pat'].forEach((id) => {
    const field = byId(id);
    if (field instanceof HTMLInputElement) field.value = '';
  });
}

async function submitNew() {
  const employee = readValue('nf-name');
  const role = readValue('nf-role');
  const jurisdiction = readValue('nf-jur');
  const days = readValue('nf-days');
  const pattern = readValue('nf-pat');
  if (!employee || !role || !jurisdiction || !days || !pattern) {
    toast('Complete all request fields');
    return;
  }
  try {
    const created = await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ employee, role, jurisdiction, days, pattern }),
    });
    closeNew();
    await refreshAll();
    toast(`Request ${created.id} created`);
    await openRequest(created.id);
  } catch (error) {
    toast(toMessage(error));
  }
}

function backHaz() {
  state.activeHazardId = null;
  const detail = byId('whs-detail');
  const list = byId('whs-list');
  if (detail) {
    detail.classList.remove('active');
    detail.innerHTML = '';
  }
  if (list) list.style.display = 'block';
}

async function validateHazard(id) {
  try {
    const validation = await api(`/api/hazards/${id}/validation`);
    state.hazardValidation[id] = validation;
    await openHazard(id);
    toast('Control validation loaded');
  } catch (error) {
    toast(toMessage(error));
  }
}

async function openHazard(id) {
  const hazard = findHazard(id);
  if (!hazard) return;
  state.activeHazardId = id;
  showScreen('whs');

  const controls = (hazard.controls ?? [])
    .map((control) => `<div class="ar"><span class="dotf ${control.primary ? 'green' : 'amber'}"></span><span class="aq" style="width:30%">${esc(control.tier)}${control.primary ? ' · primary' : ''}</span><span class="aa">${esc(control.text)}</span></div>`)
    .join('');
  const triggers = (hazard.triggers ?? [])
    .map((trigger) => `<div class="ar" style="padding:8px 0"><span class="dotf ${/due/i.test(trigger) ? 'amber' : 'green'}"></span><span class="aa">${esc(trigger)}</span></div>`)
    .join('');
  const validation = state.hazardValidation[id];

  let reviewBlock = '';
  if (hazard.status === 'reviewed') {
    reviewBlock = `<div class="ccheck resolved"><div class="cct"><span class="cci">✓</span> Review completed</div><p>Controls reviewed and retained. Next review ${esc(formatDate(hazard.reviewDate))}.</p></div>`;
  } else if (hazard.status === 'due') {
    reviewBlock = `<div class="ccheck flag"><div class="cct"><span class="cci">!</span> Control review due — ${esc(formatDate(hazard.reviewDate))}</div><p>A scheduled review is due. Confirm effectiveness or revise controls.</p></div>
      <div class="dec-actions"><button class="btn" onclick="completeHazardReview('${esc(id)}')">Mark review complete</button></div>`;
  } else {
    reviewBlock = `<div class="ccheck clear"><div class="cct"><span class="cci">✓</span> On track</div><p>Controls are active. Next review ${esc(formatDate(hazard.reviewDate))}.</p></div>`;
  }

  const rail = (hazard.audit ?? [])
    .map((event) => `<div class="ev"><div class="et">${esc(formatDateTime(event.at))}</div><div class="ee">${esc(event.event)}</div></div>`)
    .join('');

  const detail = byId('whs-detail');
  const list = byId('whs-list');
  if (!detail || !list) return;
  detail.innerHTML = `
    <button class="back" onclick="backHaz()">‹ Back to hazard register</button>
    <div class="dhead">
      <div>
        <div class="nm2">${esc(hazard.name)}</div>
        <div class="rl2">${esc(hazard.type)} hazard · control: ${esc(primaryControl(hazard))}</div>
        <div class="idln">${esc(hazard.id)} · review ${esc(formatDate(hazard.reviewDate))}</div>
      </div>
      <div class="rt">${hazardPill(hazard.status)}<span class="jtag">${esc(hazard.jurisdiction)}</span></div>
    </div>
    <div class="dgrid">
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="panel"><div class="ph"><span class="step">1</span><span class="pt">Hazard identification</span></div><div class="pb"><p style="margin:0;font-size:13px;line-height:1.55">${esc(hazard.name)} is tracked as an active organisational hazard record.</p></div></div>
        <div class="panel"><div class="ph"><span class="step">2</span><span class="pt">Controls applied</span><span class="pmeta">higher-order first</span></div><div class="pb"><div class="asmt">${controls || '<div class="ctrlnote">No controls recorded.</div>'}</div></div></div>
        <div class="panel"><div class="ph"><span class="step">3</span><span class="pt">Consultation</span></div><div class="pb"><p style="margin:0;font-size:13px;line-height:1.55">${esc(hazard.consultation || 'No consultation note recorded.')}</p></div></div>
        <div class="panel"><div class="ph"><span class="step">4</span><span class="pt">Review &amp; triggers</span></div><div class="pb">${reviewBlock}<div style="margin-top:12px">${triggers || '<div class="ctrlnote">No triggers recorded.</div>'}</div></div></div>
        <div class="panel"><div class="ph"><span class="step">5</span><span class="pt">Validation</span></div><div class="pb">
          <div class="dec-actions"><button class="btn ghost" onclick="validateHazard('${esc(id)}')">Run validation</button></div>
          <pre style="margin-top:10px;max-height:180px">${esc(validation ? JSON.stringify(validation, null, 2) : 'No validation run yet.')}</pre>
        </div></div>
      </div>
      <div><div class="panel"><div class="ph"><span class="step" style="background:var(--ochre)">∎</span><span class="pt">Control log</span></div><div class="pb"><div class="rail">${rail || '<div class="ctrlnote">No audit events recorded.</div>'}</div></div></div></div>
    </div>`;
  list.style.display = 'none';
  detail.classList.add('active');
  window.scrollTo(0, 0);
}

async function completeHazardReview(id) {
  const now = new Date();
  now.setDate(now.getDate() + 90);
  const nextReviewDate = now.toISOString().slice(0, 10);
  try {
    await api(`/api/hazards/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ nextReviewDate }),
    });
    await refreshAll();
    toast('Hazard review recorded');
    await openHazard(id);
  } catch (error) {
    toast(toMessage(error));
  }
}

function backOut() {
  state.activeOutcomeId = null;
  const detail = byId('out-detail');
  const list = byId('out-list');
  if (detail) {
    detail.classList.remove('active');
    detail.innerHTML = '';
  }
  if (list) list.style.display = 'block';
}

async function openOutcome(id) {
  const contract = findOutcome(id);
  if (!contract) return;
  state.activeOutcomeId = id;
  showScreen('outcomes');

  const doneCount = contract.outcomes.filter((outcome) => outcome.state === 'done').length;
  const outcomeRows = contract.outcomes
    .map((outcome) => `<div class="ar"><span class="dotf ${outcome.state === 'done' ? 'green' : outcome.state === 'progress' ? 'amber' : 'red'}"></span><span class="aq" style="width:62%">${esc(outcome.text)}</span><span class="aa" style="font-weight:600;color:${outcome.state === 'done' ? 'var(--green)' : outcome.state === 'progress' ? 'var(--ochre)' : 'var(--ink-faint)'}">${esc(outcome.state)}</span></div>`)
    .join('');

  const reviewBlock = contract.status === 'reviewed'
    ? `<div class="ccheck resolved"><div class="cct"><span class="cci">✓</span> Cycle review recorded</div><p>${doneCount} of ${contract.outcomes.length} outcomes delivered.</p></div>`
    : `<div class="ccheck clear"><div class="cct"><span class="cci">▣</span> Cycle review</div><p>Record the current period review against delivered outcomes.</p></div><div class="dec-actions"><button class="btn" onclick="recordCycleReview('${esc(id)}')">Record cycle review</button></div>`;

  const rail = (contract.audit ?? [])
    .map((event) => `<div class="ev"><div class="et">${esc(formatDateTime(event.at))}</div><div class="ee">${esc(event.event)}</div></div>`)
    .join('');

  const detail = byId('out-detail');
  const list = byId('out-list');
  if (!detail || !list) return;
  detail.innerHTML = `
    <button class="back" onclick="backOut()">‹ Back to contracts</button>
    <div class="dhead">
      <div class="who"><div class="av">${esc(requestInitials({ employee: contract.employee }))}</div></div>
      <div>
        <div class="nm2">${esc(contract.employee)}</div>
        <div class="rl2">${esc(contract.period)} · ${esc(contract.jurisdiction)}</div>
        <div class="idln">${esc(contract.id)} · delivery signal ${esc(contract.signalSource)}</div>
      </div>
      <div class="rt">${outcomePill(contract.status)}<span class="jtag">${esc(contract.jurisdiction)}</span></div>
    </div>
    <div class="dgrid">
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="panel"><div class="ph"><span class="step">1</span><span class="pt">Agreed outcomes</span><span class="pmeta">${doneCount} of ${contract.outcomes.length} delivered</span></div><div class="pb"><div class="asmt">${outcomeRows || '<div class="ctrlnote">No outcomes recorded.</div>'}</div></div></div>
        <div class="panel"><div class="ph"><span class="step">2</span><span class="pt">Delivery signal source</span></div><div class="pb"><p style="margin:0;font-size:13px;line-height:1.55">${esc(contract.signalSource)} delivery-state signal is used as the output proxy.</p></div></div>
        <div class="panel"><div class="ph"><span class="step">3</span><span class="pt">Cycle review</span></div><div class="pb">${reviewBlock}</div></div>
      </div>
      <div><div class="panel"><div class="ph"><span class="step" style="background:var(--ochre)">∎</span><span class="pt">Record</span></div><div class="pb"><div class="rail">${rail || '<div class="ctrlnote">No audit events recorded.</div>'}</div></div></div></div>
    </div>`;
  list.style.display = 'none';
  detail.classList.add('active');
  window.scrollTo(0, 0);
}

async function recordCycleReview(id) {
  try {
    await api(`/api/contracts/${id}/review`, { method: 'POST' });
    await refreshAll();
    toast('Cycle review recorded');
    await openOutcome(id);
  } catch (error) {
    toast(toMessage(error));
  }
}

function showAuth(mode = 'signin') {
  byId('landing')?.style.setProperty('display', 'none');
  byId('app')?.style.setProperty('display', 'none');
  byId('auth')?.classList.add('show');
  setAuthMode(mode);
  window.scrollTo(0, 0);
}

function setAuthMode(mode) {
  const isRegister = mode === 'register';
  byId('tg-signin')?.classList.toggle('on', !isRegister);
  byId('tg-register')?.classList.toggle('on', isRegister);
  const signin = byId('signinBlock');
  const register = byId('regBlock');
  if (signin) signin.style.display = isRegister ? 'none' : 'block';
  if (register) register.style.display = isRegister ? 'block' : 'none';
  if (isRegister) regGo(1);
}

function regGo(step) {
  for (let index = 1; index <= 3; index += 1) {
    byId(`rw${index}`)?.classList.toggle('on', index === step);
    byId(`rp${index}`)?.classList.toggle('on', index <= step);
  }
  const stepLabel = byId('rwiz-n');
  if (stepLabel) stepLabel.textContent = String(step);
}

function regNext(current) {
  if (current === 1 && !readValue('au-org')) {
    toast('Enter your business name');
    return;
  }
  if (current === 2 && !document.querySelectorAll('#au-jchips .jchip.on').length) {
    toast('Select at least one jurisdiction');
    return;
  }
  regGo(current + 1);
}

function regBack(current) {
  regGo(current - 1);
}

function tjc(el) {
  el.classList.toggle('on');
}

function gv(id) {
  return readValue(id);
}

async function createAccount() {
  const consent = byId('au-consent');
  if (!(consent instanceof HTMLInputElement) || !consent.checked) {
    toast('Please confirm the configuration statement');
    return;
  }
  const name = gv('au-name');
  const role = gv('au-role');
  if (name) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? '')
      .join('');
    const avatar = document.querySelector('.side-foot .av');
    const userName = document.querySelector('.side-foot .un');
    if (avatar) avatar.textContent = initials || 'RM';
    if (userName) userName.textContent = name;
  }
  if (role) {
    const userRole = document.querySelector('.side-foot .ur');
    if (userRole) userRole.textContent = role;
  }
  const org = gv('au-org');
  if (org) {
    const orgName = document.querySelector('.org .nm');
    if (orgName) orgName.textContent = org;
  }
  const selectedJurisdictions = [...document.querySelectorAll('#au-jchips .jchip.on')]
    .map((chip) => chip.textContent?.trim())
    .filter(Boolean);
  if (selectedJurisdictions.length) {
    const orgJurisdictions = document.querySelector('.org .ju');
    if (orgJurisdictions) orgJurisdictions.textContent = selectedJurisdictions.join(' · ');
  }
  await enterApp();
  toast('Workspace created');
}

function backToSite() {
  byId('auth')?.classList.remove('show');
  byId('landing')?.style.setProperty('display', 'block');
  window.scrollTo(0, 0);
}

async function enterApp() {
  byId('landing')?.style.setProperty('display', 'none');
  byId('auth')?.classList.remove('show');
  byId('app')?.style.setProperty('display', 'flex');
  byId('demoLaunch')?.classList.add('show');
  showScreen('overview');
  try {
    await refreshAll();
  } catch (error) {
    toast(toMessage(error));
  }
  window.scrollTo(0, 0);
}

function exitApp() {
  byId('app')?.style.setProperty('display', 'none');
  byId('auth')?.classList.remove('show');
  closeDemo();
  byId('demoLaunch')?.classList.remove('show');
  byId('landing')?.style.setProperty('display', 'block');
  window.scrollTo(0, 0);
}

async function resetDemo() {
  try {
    await refreshAll();
    if (state.activeRequestId) await openRequest(state.activeRequestId);
    if (state.activeHazardId) await openHazard(state.activeHazardId);
    if (state.activeOutcomeId) await openOutcome(state.activeOutcomeId);
    toast('Data refreshed from API');
  } catch (error) {
    toast(toMessage(error));
  }
}

function renderDemo() {
  const container = byId('demo-steps');
  if (!container) return;
  container.innerHTML = DEMO_STEPS
    .map((step, index) => (
      `<button class="step ${demoDone.includes(index) ? 'done' : ''}" onclick="demoGo(${index})">
        <span class="num">${demoDone.includes(index) ? '✓' : index + 1}</span>
        <span><span class="st">${esc(step.t)}</span><span class="sd">${esc(step.d)}</span></span>
      </button>`
    ))
    .join('');
}

function demoGo(index) {
  const step = DEMO_STEPS[index];
  if (!step) return;
  step.go();
  if (!demoDone.includes(index)) demoDone.push(index);
  renderDemo();
}

function openDemo() {
  byId('demo')?.classList.add('show');
  byId('demoLaunch')?.classList.remove('show');
  renderDemo();
}

function closeDemo() {
  byId('demo')?.classList.remove('show');
  if (byId('app')?.style.display !== 'none') byId('demoLaunch')?.classList.add('show');
}

async function startDemoFlow() {
  await enterApp();
}

function setFilter(filter) {
  state.currentFilter = filter;
  renderList();
}

function attachEvents() {
  document.querySelectorAll('#nav button[data-s]').forEach((button) => {
    button.addEventListener('click', () => showScreen(button.dataset.s));
  });
  byId('menuBtn')?.addEventListener('click', () => byId('side')?.classList.toggle('open'));
  byId('overlay')?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.id === 'overlay') closeNew();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNew();
      closeDemo();
    }
  });
}

async function init() {
  attachEvents();
  updateCountdown();
  renderDemo();
  try {
    await refreshAll();
  } catch {
    // App can still render; errors are surfaced on entry actions.
  }
}

Object.assign(window, {
  showAuth,
  setAuthMode,
  regNext,
  regBack,
  tjc,
  gv,
  createAccount,
  backToSite,
  enterApp,
  exitApp,
  startDemoFlow,
  openDemo,
  closeDemo,
  demoGo,
  setFilter,
  openRequest,
  backToList,
  completeAssessment,
  toggleDistinguish,
  saveDistinguish,
  decide,
  loadLetterPreview,
  openNew,
  closeNew,
  submitNew,
  openHazard,
  backHaz,
  validateHazard,
  completeHazardReview,
  openOutcome,
  backOut,
  recordCycleReview,
  resetDemo,
  toast,
});

void init();
