// Routes <site>.<ROOT_DOMAIN> to the files of apps/<site>, which the deploy workflow
// copies to /<site>/ in the Worker's static assets. Unknown sites get a plain 404.
// /_forms/<form> on any site goes to the form endpoint in forms.js.
// <site>.<LEGACY_ROOT_DOMAIN> answers 301 to the same path on <site>.<ROOT_DOMAIN> until the
// legacy routes are removed (decision 0004, removal 2026-12-10).
import { handleForm } from './forms.js';

const ROOT_DOMAIN = 'ranode.usercontent.kr';
const LEGACY_ROOT_DOMAIN = 'external.kr';
const FORMS_PREFIX = '/_forms/';
const SITE_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// The sites share a registrable domain (usercontent.kr) with untrusted uploaded pages, so every
// response refuses framing and the Worker never hands out cookies (decision 0004).
const SECURITY_HEADERS = {
  'content-security-policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

function siteFromHost(hostname, rootDomain) {
  const suffix = `.${rootDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  return SITE_LABEL.test(label) ? label : null;
}

function secured(response) {
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Static assets redirect /<site>/page.html to /<site>/page. The /<site> prefix is internal to the
// asset layout, so strip it before the browser sees the Location header.
function unprefixRedirect(response, site) {
  const location = response.headers.get('location');
  if (!location) return response;
  const target = new URL(location, 'https://placeholder.invalid');
  const prefix = `/${site}`;
  if (target.pathname !== prefix && !target.pathname.startsWith(`${prefix}/`)) return response;
  const headers = new Headers(response.headers);
  headers.set('location', `${target.pathname.slice(prefix.length) || '/'}${target.search}${target.hash}`);
  return new Response(response.body, { status: response.status, headers });
}

async function serve(env, request, site, pathname) {
  const url = new URL(request.url);
  url.pathname = `/${site}${pathname}`;
  const response = await env.ASSETS.fetch(new Request(url, request));
  if (response.status >= 300 && response.status < 400) return unprefixRedirect(response, site);
  if (response.status !== 404) return response;
  // Static assets serve 404.html at its extensionless path; asking for /404.html answers with a redirect.
  url.pathname = `/${site}/404`;
  const page = await env.ASSETS.fetch(new Request(url, request));
  if (!page.ok) {
    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new Response(page.body, { status: 404, headers: page.headers });
}

async function route(request, env) {
  const url = new URL(request.url);
  const legacy = siteFromHost(url.hostname, LEGACY_ROOT_DOMAIN);
  if (legacy) {
    const target = new URL(url);
    target.protocol = 'https:';
    target.hostname = `${legacy}.${ROOT_DOMAIN}`;
    target.port = '';
    return new Response(null, { status: 301, headers: { location: target.toString(), 'cache-control': 'no-store' } });
  }
  const site = siteFromHost(url.hostname, ROOT_DOMAIN);
  if (site && url.pathname.startsWith(FORMS_PREFIX)) {
    return handleForm(request, env, site, url.pathname.slice(FORMS_PREFIX.length));
  }
  if (site) return serve(env, request, site, url.pathname);
  return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    return secured(await route(request, env));
  },
};
