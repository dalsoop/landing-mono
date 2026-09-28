// POST /_forms/<form> stores one form submission in R2 (binding FORMS) as
// <site>/<form>/<ISO time>-<uuid>.json. Each site allows its own forms in apps/<site>/forms.json,
// which the deploy workflow moves to /_forms/<site>.json in the static assets (outside every
// site's folder, so browsers cannot fetch it).
//
// forms.json: { "<form>": { "fields": [...], "required": [...], "email": [...],
//                           "options": { "<field>": [...] }, "max_length": { "<field>": n },
//                           "redirect": "/path" } }
const FORM_NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_LENGTH = 2000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HONEYPOT = 'website';

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Plain HTML for browsers that posted the form without JavaScript.
function errorPage(status, message) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Form not sent</title><link rel="stylesheet" href="/styles.css"></head><body><main class="container" style="min-height:100dvh;display:grid;place-content:center;gap:16px;text-align:center"><h1 style="font-size:28px">Form not sent</h1><p>${escapeHtml(message)}</p><p><a class="btn btn-primary" href="javascript:history.back()">Go back to the form</a></p></main></body></html>`;
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function loadForms(env, site) {
  const response = await env.ASSETS.fetch(new Request(`https://assets.invalid/_forms/${site}.json`));
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readBody(request) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) return { tooLarge: true };
  const text = new TextDecoder().decode(buffer);
  if (type === 'application/json') {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { error: 'Body is not valid JSON.' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Body must be a JSON object.' };
    const values = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === true) values[key] = 'yes';
      else if (value === false || value === null) continue;
      else if (typeof value === 'string' || typeof value === 'number') values[key] = String(value);
      else return { error: `Field ${key} must be text.` };
    }
    return { values };
  }
  if (type === 'application/x-www-form-urlencoded') {
    return { values: Object.fromEntries(new URLSearchParams(text)), plain: true };
  }
  return { unsupported: true };
}

function validate(form, values) {
  const errors = {};
  const allowed = form.fields || [];
  const fields = {};
  for (const name of allowed) {
    const value = (values[name] ?? '').trim();
    if (value) fields[name] = value;
  }
  for (const name of form.required || []) {
    if (!fields[name]) errors[name] = 'required';
  }
  for (const [name, value] of Object.entries(fields)) {
    const max = form.max_length?.[name] ?? MAX_FIELD_LENGTH;
    if (value.length > max) errors[name] = 'too_long';
    else if ((form.email || []).includes(name) && !EMAIL.test(value)) errors[name] = 'invalid_email';
    else if (form.options?.[name] && !form.options[name].includes(value)) errors[name] = 'invalid_option';
  }
  return { fields, errors };
}

export async function handleForm(request, env, site, formName) {
  const url = new URL(request.url);
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const fail = (status, error, extra = {}) =>
    wantsJson ? json(status, { ok: false, error, ...extra }) : errorPage(status, extra.message || error);

  if (!FORM_NAME.test(formName)) return fail(404, 'unknown_form', { message: 'This form does not exist.' });
  const forms = await loadForms(env, site);
  const form = forms && Object.hasOwn(forms, formName) ? forms[formName] : null;
  if (!form) return fail(404, 'unknown_form', { message: 'This form does not exist.' });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, { allow: 'POST' });

  // Same-origin only. The route already pins the host to <site>.<ROOT_DOMAIN>, so the request's own
  // origin is https://<site>.<ROOT_DOMAIN> in production.
  if (request.headers.get('origin') !== url.origin) {
    return fail(403, 'forbidden_origin', { message: 'Send the form from its own page.' });
  }
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return fail(413, 'too_large', { message: 'The form is too large.' });
  const body = await readBody(request);
  if (body.tooLarge) return fail(413, 'too_large', { message: 'The form is too large.' });
  if (body.unsupported) return fail(415, 'unsupported_type', { message: 'Unsupported form encoding.' });
  if (body.error) return fail(400, 'bad_body', { message: body.error });

  const redirect = form.redirect || '/';
  const done = () =>
    body.plain && !wantsJson
      ? new Response(null, { status: 303, headers: { location: redirect, 'cache-control': 'no-store' } })
      : json(200, { ok: true });

  // Bots fill every input; people never see this one. Answer as if it worked.
  if ((body.values[HONEYPOT] || '').trim()) return done();

  const { fields, errors } = validate(form, body.values);
  if (Object.keys(errors).length) {
    return fail(400, 'invalid_fields', { fields: errors, message: `Check these fields: ${Object.keys(errors).join(', ')}.` });
  }
  if (!env.FORMS) return fail(503, 'storage_unavailable', { message: 'The form cannot be saved right now. Try again later.' });

  const receivedAt = new Date().toISOString();
  const key = `${site}/${formName}/${receivedAt}-${crypto.randomUUID()}.json`;
  const record = { site, form: formName, received_at: receivedAt, country: request.cf?.country ?? null, fields };
  await env.FORMS.put(key, JSON.stringify(record, null, 2), { httpMetadata: { contentType: 'application/json' } });
  return done();
}

