// Routes <site>.<ROOT_DOMAIN> to the files of apps/<site>, which the deploy workflow
// copies to /<site>/ in the Worker's static assets. Unknown sites get a plain 404.
const ROOT_DOMAIN = 'external.kr';
const SITE_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function siteFromHost(hostname) {
  const suffix = `.${ROOT_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  return SITE_LABEL.test(label) ? label : null;
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const site = siteFromHost(url.hostname);
    if (site) return serve(env, request, site, url.pathname);
    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
