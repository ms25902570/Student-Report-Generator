// Small per-tab state that carries the UI_1 inputs through the following screens.

const DRAFT_KEY = 'srg.draft';
const MANUAL_KEY = 'srg.manual';
const SOURCE_KEY = 'srg.source';
const REPORT_KEY = 'srg.report';

function get(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key, value) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (e.g. private mode); the flow simply restarts from UI_1.
  }
}

export function saveDraft(draft) {
  set(DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft() {
  try {
    return JSON.parse(get(DRAFT_KEY));
  } catch {
    return null;
  }
}

// Manual mode: microphone was denied, so the report is typed in on the review screen.
export function setManualMode(on) {
  set(MANUAL_KEY, on ? '1' : null);
}

export function isManualMode() {
  return get(MANUAL_KEY) === '1';
}

export function setReportSource(source) {
  set(SOURCE_KEY, source || null);
}

export function getReportSource() {
  return get(SOURCE_KEY);
}

// The id of the report just generated, shown on UI_3 and edited on UI_4.
export function setReportId(id) {
  set(REPORT_KEY, id ? String(id) : null);
}

export function getReportId() {
  return get(REPORT_KEY);
}
