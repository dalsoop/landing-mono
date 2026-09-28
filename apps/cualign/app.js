(() => {
  'use strict';

  const EULA_VERSION = '2026-09-28';
  const CONSENT_KEY = 'cualign.eula';
  const LAUNCH_URL = 'https://github.com/dalsoop/nvidia-hackaton-2026-one/tree/main/apps/cualign-prototype#readme';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Nav: border once scrolled, mobile menu toggle.
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => nav && nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Reveal on scroll.
  const revealables = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-visible'));
  }

  // Hero: swap the poster for the live 3D arch once three.js and the case data have loaded.
  // No WebGL or reduced motion: the poster stays.
  const heroStage = document.querySelector('[data-hero-stage]');
  const webgl = () => {
    try {
      const c = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (_) { return false; }
  };
  const bootHero = () => {
    if (!heroStage || reduceMotion || !webgl()) return;
    import('./hero3d.js')
      .then(({ mountHero }) => mountHero({
        stage: heroStage,
        canvas: heroStage.querySelector('[data-hero-canvas]'),
        hud: heroStage.querySelector('[data-hero-hud-text]'),
        dataUrl: 'assets/hero-case.json',
        touch: !finePointer,
      }))
      .then(() => heroStage.classList.add('is-live'))
      .catch(() => { /* keep the poster */ });
  };
  if (document.readyState === 'complete') bootHero();
  else window.addEventListener('load', bootHero, { once: true });

  // Tabs (roving tabindex, arrow keys).
  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = root.querySelector(`#${t.getAttribute('aria-controls')}`);
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in keys) {
          e.preventDefault();
          select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
        } else if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  });

  // Workflow: highlight the step whose card is in view and fill the rail up to it.
  const flow = document.querySelector('[data-flow]');
  if (flow) {
    const steps = [...flow.querySelectorAll('[data-flow-step]')];
    const cards = [...flow.querySelectorAll('[data-flow-card]')];
    const progress = flow.querySelector('[data-flow-progress]');
    const setActive = (index) => {
      steps.forEach((s, i) => {
        s.classList.toggle('is-active', i === index);
        s.classList.toggle('is-done', i < index);
      });
      cards.forEach((c, i) => c.classList.toggle('is-active', i === index));
      if (progress && steps[index]) {
        const rail = progress.parentElement.getBoundingClientRect();
        const dot = steps[index].getBoundingClientRect();
        progress.style.height = `${Math.max(0, dot.top - rail.top)}px`;
        progress.parentElement.style.setProperty('--flow-w', `${(index / (steps.length - 1)) * 100}%`);
      }
    };
    const pick = () => {
      const mid = window.innerHeight * 0.45;
      let best = 0;
      cards.forEach((c, i) => { if (c.getBoundingClientRect().top < mid) best = i; });
      setActive(best);
    };
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    pick();
    steps.forEach((s, i) => {
      s.tabIndex = 0;
      s.setAttribute('role', 'link');
      const go = () => cards[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      s.addEventListener('click', go);
      s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  // Stage scrubber: four real stages from the sample case.
  const STAGES = [
    { stage: 0, text: 'Before treatment. Fourteen upper teeth, 4.2 mm of crowding.' },
    { stage: 6, text: 'Stage 6. The rule checker flags a collision between teeth 13 and 12, and marks the stage on the stage bar.', warn: true },
    { stage: 12, text: 'Stage 12. The last stage where the 13–12 collision is flagged. The agent reports it instead of hiding it.', warn: true },
    { stage: 18, text: 'Final stage. This expansion plan still has 7 rule violations, so the approval button stays locked.', warn: true },
  ];
  const range = document.querySelector('[data-stage-range]');
  const out = document.querySelector('[data-stage-out]');
  const caption = document.querySelector('[data-stage-caption]');
  const imgs = [...document.querySelectorAll('[data-stage-media] img')];
  if (range && out && caption) {
    const show = (i) => {
      const s = STAGES[i];
      out.textContent = String(s.stage);
      caption.textContent = s.text;
      caption.classList.toggle('is-warn', Boolean(s.warn));
      range.setAttribute('aria-valuetext', `Stage ${s.stage} of 18`);
      imgs.forEach((img) => img.classList.toggle('is-active', Number(img.dataset.stage) === i));
    };
    range.addEventListener('input', () => show(Number(range.value)));
    show(Number(range.value));
  }

  // Consent gate before launching.
  const dialog = document.querySelector('[data-consent]');
  const form = document.querySelector('[data-consent-form]');
  const checks = [...document.querySelectorAll('[data-consent-check]')];
  const agree = document.querySelector('[data-consent-agree]');
  const cancel = document.querySelector('[data-consent-cancel]');

  const readConsent = () => {
    try {
      const v = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || 'null');
      return v && v.version === EULA_VERSION;
    } catch (_) { return false; }
  };
  const saveConsent = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: EULA_VERSION, acceptedAt: new Date().toISOString() }));
    } catch (_) { /* storage unavailable: consent is asked again next time */ }
  };
  const launch = () => { window.location.href = LAUNCH_URL; };

  let opener = null;
  const openConsent = (e) => {
    if (readConsent()) { launch(); return; }
    opener = e.currentTarget;
    checks.forEach((c) => { c.checked = false; });
    agree.disabled = true;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    checks[0].focus();
  };
  const closeConsent = () => {
    if (dialog.open) dialog.close();
    if (opener) opener.focus();
  };

  if (dialog && form && agree) {
    document.querySelectorAll('[data-launch]').forEach((b) => b.addEventListener('click', openConsent));
    checks.forEach((c) => c.addEventListener('change', () => { agree.disabled = !checks.every((x) => x.checked); }));
    cancel.addEventListener('click', closeConsent);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeConsent(); });
    dialog.addEventListener('cancel', () => { if (opener) setTimeout(() => opener.focus(), 0); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!checks.every((x) => x.checked)) return;
      saveConsent();
      dialog.close();
      launch();
    });
  }
})();
