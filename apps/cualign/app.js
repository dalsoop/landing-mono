(() => {
  'use strict';

  const EULA_VERSION = '2026-09-28';
  const CONSENT_KEY = 'cualign.eula';
  const LAUNCH_URL = 'https://cualign-proto.external.kr/';   // hosted prototype, behind Basic auth
  const DEMO_FORM_URL = '/request/';   // demo request form; the buttons are hidden while this is empty
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Demo request buttons: shown only once the form URL is set.
  document.querySelectorAll('[data-demo-request]').forEach((a) => {
    if (DEMO_FORM_URL) a.href = DEMO_FORM_URL;
    else a.hidden = true;
  });

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

  // Hero: fade in the live 3D arch once three.js and the case data have loaded.
  // No WebGL or reduced motion: the stage stays empty.
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
        dataUrl: 'assets/hero-case.json',
        touch: !finePointer,
      }))
      .then(() => heroStage.classList.add('is-live'))
      .catch(() => { /* leave the stage empty */ });
  };
  if (document.readyState === 'complete') bootHero();
  else window.addEventListener('load', bootHero, { once: true });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Agent demo: messages appear in order, user lines are typed, tool rows tick one by one,
  // and the capture beside the chat follows the step. Plays once when scrolled into view; Replay restarts it.
  const demo = document.querySelector('[data-demo]');
  if (demo) {
    const msgs = [...demo.querySelectorAll('[data-demo-chat] > .msg')];
    const figures = [...demo.querySelectorAll('[data-demo-media] figure')];
    const replay = demo.querySelector('[data-demo-replay]');
    const texts = msgs.map((m) => { const t = m.querySelector('[data-type]'); return t ? t.textContent : null; });
    let run = 0;

    const rail = [...document.querySelectorAll('[data-demo-steps] [data-step-for]')];
    const STEP_OF_MSG = [0, 1, 1, 2, 3];   // message index → step on the rail (draft and check share a step)
    const MEDIA_OF_MSG = [0, 1, 2, 2, 3];  // message index → figure (the revision request keeps the collision in view)
    const showMedia = (fig, msg = figures.length) => {
      figures.forEach((f) => f.classList.toggle('is-active', Number(f.dataset.media) === fig));
      const at = STEP_OF_MSG[msg] ?? rail.length - 1;
      rail.forEach((r) => {
        const k = Number(r.dataset.stepFor);
        r.classList.toggle('is-active', k === at);
        r.classList.toggle('is-done', k < at);
      });
    };
    const reset = () => {
      msgs.forEach((m, i) => {
        m.classList.remove('is-shown', 'is-typing');
        m.querySelectorAll('.tools li').forEach((li) => li.classList.remove('is-done'));
        const t = m.querySelector('[data-type]');
        if (t) t.textContent = texts[i];
      });
      showMedia(0, 0);
    };
    const showAll = () => {
      msgs.forEach((m) => {
        m.classList.add('is-shown');
        m.querySelectorAll('.tools li').forEach((li) => li.classList.add('is-done'));
      });
      showMedia(figures.length - 1);
    };

    const play = async () => {
      const id = ++run;
      const alive = () => id === run;
      reset();
      demo.classList.add('is-playing');
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        await wait(i === 0 ? 300 : 650);
        if (!alive()) return;
        m.classList.add('is-shown');
        showMedia(MEDIA_OF_MSG[i] ?? 0, i);
        const t = m.querySelector('[data-type]');
        if (t) {
          m.classList.add('is-typing');
          t.textContent = '';
          for (let c = 1; c <= texts[i].length; c++) {
            t.textContent = texts[i].slice(0, c);
            await wait(32);
            if (!alive()) return;
          }
          m.classList.remove('is-typing');
        }
        for (const li of m.querySelectorAll('.tools li')) {
          await wait(420);
          if (!alive()) return;
          li.classList.add('is-done');
        }
      }
      demo.classList.remove('is-playing');
    };

    msgs.forEach((m, i) => m.addEventListener('click', () => { if (m.classList.contains('is-shown')) showMedia(MEDIA_OF_MSG[i] ?? 0, i); }));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      showAll();
      if (replay) replay.addEventListener('click', showAll);
    } else {
      reset();
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { io.disconnect(); play(); }
      }, { threshold: 0.35 });
      io.observe(demo);
      if (replay) replay.addEventListener('click', () => { play(); });
    }
  }


  // Stage scrubber: every stage of a real sample plan. Plays on its own while the section is on screen;
  // moving the slider or pressing the button stops it. Reduced motion: no autoplay.
  const range = document.querySelector('[data-stage-range]');
  const imgs = [...document.querySelectorAll('[data-stage-media] img')];
  const playBtn = document.querySelector('[data-stage-play]');
  if (range) {
    const last = Number(range.max);
    const label = (i) => (i === 0 ? 'Before treatment' : i === last ? 'Final stage'
      : `Stage ${i} of ${last}${i >= 6 && i <= 12 ? ', collision flagged' : ''}`);
    const show = (i) => {
      range.value = String(i);
      range.setAttribute('aria-valuetext', label(i));
      imgs.forEach((img) => img.classList.toggle('is-active', Number(img.dataset.stage) === i));
    };
    const STEP_MS = 900, END_PAUSE_MS = 1500;
    let wanted = !reduceMotion, onScreen = false, timer = 0;
    const running = () => wanted && onScreen && !document.hidden;
    const tick = () => {
      timer = 0;
      if (!running()) return;
      const i = Number(range.value);
      show(i >= last ? 0 : i + 1);
      timer = setTimeout(tick, Number(range.value) >= last ? END_PAUSE_MS : STEP_MS);
    };
    const sync = () => {
      if (playBtn) {
        playBtn.classList.toggle('is-paused', !wanted);
        playBtn.setAttribute('aria-label', wanted ? 'Pause stage playback' : 'Play stage playback');
      }
      if (running() && !timer) timer = setTimeout(tick, STEP_MS);
      if (!running() && timer) { clearTimeout(timer); timer = 0; }
    };
    range.addEventListener('input', () => { wanted = false; show(Number(range.value)); sync(); });
    if (playBtn) playBtn.addEventListener('click', () => { wanted = !wanted; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }, { threshold: 0.3 })
        .observe(range.closest('section') || range);
    }
    document.addEventListener('visibilitychange', sync);
    show(0);
    sync();
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
