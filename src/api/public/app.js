const state = {
  requests: [],
  hazards: [],
  contracts: [],
  selectedRequestId: null,
};

const DEFAULT_FACTORS = [
  { key: 'client', label: 'Client interaction', rating: 'green', note: 'Low — virtual' },
  { key: 'whs', label: 'Home WHS assessment', rating: 'green', note: 'Pass' },
];

const byId = (id) => document.getElementById(id);
const timestamp = () => new Date().toLocaleTimeString('en-AU', { hour12: false });
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function log(message, payload) {
  const output = byId('activity-log');
  if (!output) return;
  const details = payload === undefined
    ? ''
    : `\n${typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}`;
  const entry = `[${timestamp()}] ${message}${details}`;
  output.textContent = `${entry}\n\n${output.textContent}`.slice(0, 18000);
}

async function api(path, init = {}) {
  const options = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  };
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body.data;
}

const asPill = (value) => `<span class="pill pill-${escapeHtml(value)}">${escapeHtml(value)}</span>`;

function selectedRequest() {
  return state.requests.find((item) => item.id === state.selectedRequestId) ?? null;
}

function requireSelectedRequest() {
  const selected = selectedRequest();
  if (!selected) {
    log('Select a request first.');
    return null;
  }
  return selected;
}

function renderRequests() {
  const body = byId('requests-body');
  if (!body) return;

  if (!state.requests.length) {
    body.innerHTML = '<tr><td colspan="6">No requests available.</td></tr>';
    return;
  }

  body.innerHTML = state.requests.map((request) => {
    const selected = request.id === state.selectedRequestId ? 'selected' : '';
    return `
      <tr class="${selected}" data-request-id="${escapeHtml(request.id)}">
        <td>${escapeHtml(request.id)}</td>
        <td>${escapeHtml(request.employee)}</td>
        <td>${escapeHtml(request.role)}</td>
        <td>${escapeHtml(request.jurisdiction)}</td>
        <td>${asPill(request.status)}</td>
        <td>${asPill(request.consistency.state)}</td>
      </tr>
    `;
  }).join('');
}

function renderSelectedRequest() {
  const title = byId('selected-request-title');
  const detail = byId('selected-request-json');
  if (!title || !detail) return;

  const request = selectedRequest();
  if (!request) {
    title.textContent = 'No request selected';
    detail.textContent = 'Select a request to inspect details.';
    return;
  }

  title.textContent = `${request.id} — ${request.employee}`;
  detail.textContent = JSON.stringify(request, null, 2);
}

function renderHazards() {
  const body = byId('hazards-body');
  if (!body) return;

  if (!state.hazards.length) {
    body.innerHTML = '<tr><td colspan="5">No hazards found.</td></tr>';
    return;
  }

  body.innerHTML = state.hazards.map((hazard) => `
    <tr data-hazard-id="${escapeHtml(hazard.id)}">
      <td>${escapeHtml(hazard.id)}</td>
      <td>${escapeHtml(hazard.name)}</td>
      <td>${asPill(hazard.status)}</td>
      <td><input data-review-date type="date" value="${escapeHtml(hazard.reviewDate)}"></td>
      <td class="inline-actions">
        <button type="button" data-action="validate" data-id="${escapeHtml(hazard.id)}">Validate</button>
        <button type="button" data-action="review" data-id="${escapeHtml(hazard.id)}">Complete review</button>
      </td>
    </tr>
  `).join('');
}

function renderContracts() {
  const body = byId('contracts-body');
  if (!body) return;

  if (!state.contracts.length) {
    body.innerHTML = '<tr><td colspan="5">No outcome contracts found.</td></tr>';
    return;
  }

  body.innerHTML = state.contracts.map((contract) => `
    <tr>
      <td>${escapeHtml(contract.id)}</td>
      <td>${escapeHtml(contract.employee)}</td>
      <td>${escapeHtml(contract.period)}</td>
      <td>${asPill(contract.status)}</td>
      <td>
        <button type="button" data-action="review-contract" data-id="${escapeHtml(contract.id)}">Record cycle review</button>
      </td>
    </tr>
  `).join('');
}

async function refreshStatus() {
  const [health, jurisdictions] = await Promise.all([
    api('/api/health'),
    api('/api/jurisdictions'),
  ]);
  const status = byId('health-status');
  const org = byId('health-org');
  const jurisdictionList = byId('jurisdictions');
  if (status) status.textContent = health.status;
  if (org) org.textContent = health.org;
  if (jurisdictionList) {
    jurisdictionList.textContent = Object.values(jurisdictions).map((item) => item.code).join(', ');
  }
}

async function refreshRequests() {
  state.requests = await api('/api/requests');
  if (!state.requests.find((request) => request.id === state.selectedRequestId)) {
    state.selectedRequestId = state.requests[0]?.id ?? null;
  }
  renderRequests();
  renderSelectedRequest();
}

async function refreshHazards() {
  state.hazards = await api('/api/hazards');
  renderHazards();
}

async function refreshContracts() {
  state.contracts = await api('/api/contracts');
  renderContracts();
}

function stampSync() {
  const lastSync = byId('last-sync');
  if (!lastSync) return;
  lastSync.textContent = `Synced ${new Date().toLocaleString('en-AU')}`;
}

async function refreshAll() {
  await Promise.all([refreshStatus(), refreshRequests(), refreshHazards(), refreshContracts()]);
  stampSync();
}

async function onCreateRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fields = Object.fromEntries(new FormData(form).entries());
  try {
    const created = await api('/api/requests', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
    state.selectedRequestId = created.id;
    await refreshRequests();
    form.reset();
    log(`Created ${created.id}`, created);
  } catch (error) {
    log('Failed to create request', error instanceof Error ? error.message : String(error));
  }
}

function onRequestSelection(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const row = target.closest('tr[data-request-id]');
  if (!(row instanceof HTMLTableRowElement)) return;
  const id = row.dataset.requestId;
  if (!id) return;
  state.selectedRequestId = id;
  renderRequests();
  renderSelectedRequest();
}
async function onAssessRequest() {
  const request = requireSelectedRequest();
  if (!request) return;

  const factorInput = byId('assessment-json');
  if (!(factorInput instanceof HTMLTextAreaElement)) return;
  try {
    const factors = JSON.parse(factorInput.value);
    const updated = await api(`/api/requests/${request.id}/assessment`, {
      method: 'POST',
      body: JSON.stringify({ factors }),
    });
    await refreshRequests();
    log(`Assessment completed for ${request.id}`, { consistency: updated.consistency });
  } catch (error) {
    log('Failed to assess request', error instanceof Error ? error.message : String(error));
  }
}

async function onDistinguish(event) {
  event.preventDefault();
  const request = requireSelectedRequest();
  if (!request) return;

  const input = byId('distinguish-factor');
  if (!(input instanceof HTMLInputElement)) return;
  try {
    const updated = await api(`/api/requests/${request.id}/distinguish`, {
      method: 'POST',
      body: JSON.stringify({ factor: input.value }),
    });
    await refreshRequests();
    log(`Distinguishing factor recorded for ${request.id}`, updated.consistency);
    input.value = '';
  } catch (error) {
    log('Failed to record distinguishing factor', error instanceof Error ? error.message : String(error));
  }
}

async function onDecision(event) {
  event.preventDefault();
  const request = requireSelectedRequest();
  if (!request) return;

  const decisionType = byId('decision-type');
  const decisionGround = byId('decision-ground');
  if (!(decisionType instanceof HTMLSelectElement) || !(decisionGround instanceof HTMLInputElement)) return;

  try {
    const updated = await api(`/api/requests/${request.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        type: decisionType.value,
        ground: decisionGround.value,
      }),
    });
    await refreshRequests();
    log(`Decision saved for ${request.id}`, updated.decision);
  } catch (error) {
    log('Decision blocked or failed', error instanceof Error ? error.message : String(error));
  }
}

async function onLoadLetter() {
  const request = requireSelectedRequest();
  if (!request) return;

  const output = byId('letter-output');
  if (!output) return;
  try {
    const letter = await api(`/api/requests/${request.id}/letter`);
    output.textContent = letter.letter;
    log(`Loaded letter preview for ${request.id}`);
  } catch (error) {
    log('Failed to load letter', error instanceof Error ? error.message : String(error));
  }
}

async function onHazardAction(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (!action || !id) return;

  if (action === 'review-contract') return;

  try {
    if (action === 'validate') {
      const validation = await api(`/api/hazards/${id}/validation`);
      log(`Hazard ${id} validation`, validation);
    } else if (action === 'review') {
      const row = button.closest('tr');
      const dateInput = row?.querySelector('input[data-review-date]');
      const nextReviewDate = dateInput instanceof HTMLInputElement && dateInput.value
        ? dateInput.value
        : new Date().toISOString().slice(0, 10);
      const updated = await api(`/api/hazards/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ nextReviewDate }),
      });
      log(`Hazard ${id} review complete`, { status: updated.status, reviewDate: updated.reviewDate });
      await refreshHazards();
    }
  } catch (error) {
    log('Hazard action failed', error instanceof Error ? error.message : String(error));
  }
}

async function onContractAction(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button[data-action="review-contract"]');
  if (!(button instanceof HTMLButtonElement)) return;
  const id = button.dataset.id;
  if (!id) return;

  try {
    const updated = await api(`/api/contracts/${id}/review`, { method: 'POST' });
    log(`Recorded outcome cycle review for ${id}`, { status: updated.status });
    await refreshContracts();
  } catch (error) {
    log('Outcome action failed', error instanceof Error ? error.message : String(error));
  }
}

async function init() {
  const assessmentInput = byId('assessment-json');
  if (assessmentInput instanceof HTMLTextAreaElement) {
    assessmentInput.value = JSON.stringify(DEFAULT_FACTORS, null, 2);
  }

  byId('create-request-form')?.addEventListener('submit', onCreateRequest);
  byId('requests-body')?.addEventListener('click', onRequestSelection);
  byId('run-assessment')?.addEventListener('click', onAssessRequest);
  byId('distinguish-form')?.addEventListener('submit', onDistinguish);
  byId('decision-form')?.addEventListener('submit', onDecision);
  byId('load-letter')?.addEventListener('click', onLoadLetter);
  byId('hazards-body')?.addEventListener('click', onHazardAction);
  byId('contracts-body')?.addEventListener('click', onContractAction);
  byId('refresh-all')?.addEventListener('click', async () => {
    try {
      await refreshAll();
      log('Manual refresh complete.');
    } catch (error) {
      log('Refresh failed', error instanceof Error ? error.message : String(error));
    }
  });

  try {
    await refreshAll();
    log('Platform ready.');
  } catch (error) {
    log('Initial load failed', error instanceof Error ? error.message : String(error));
  }
}

void init();
