// Aviso para instalar Control de Turnos como app en el teléfono o la compu.
// - Android / Chrome / Edge: muestra el botón "Instalar app".
// - iPhone / iPad: muestra los pasos (Compartir › Agregar a inicio).
// - Si ya está instalada, no muestra nada.
(function () {
  'use strict';

  var DISMISS_KEY = 'turnos-instalar-cerrado';
  var DISMISS_DAYS = 14;

  var params = new URLSearchParams(window.location.search);
  var asked = params.has('instalar');            // viene desde el botón de la landing
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;
  if (standalone) return;

  var ua = window.navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/.test(ua);

  function dismissedRecently() {
    try {
      var t = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return t && (Date.now() - t) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch (e) { return false; }
  }
  function rememberDismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  var deferredPrompt = null;
  var bar = null;

  function injectStyles() {
    if (document.getElementById('install-bar-styles')) return;
    var css =
      '.install-bar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:10000;' +
      'max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;' +
      'background:#161A20;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.55);color:#F1F3F5;' +
      'font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;animation:installIn .35s ease both}' +
      '@keyframes installIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
      '.install-bar img{width:42px;height:42px;border-radius:11px;flex-shrink:0}' +
      '.install-bar .ib-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}' +
      '.install-bar .ib-title{font-weight:700;font-size:15px;line-height:1.25}' +
      '.install-bar .ib-desc{font-size:13px;line-height:1.4;color:#B4BAC3}' +
      '.install-bar .ib-desc b{color:#F1F3F5;font-weight:600}' +
      '.install-bar .ib-go{flex-shrink:0;min-height:44px;padding:0 18px;border:0;border-radius:999px;background:#C5E01B;' +
      'color:#101307;font:inherit;font-weight:700;font-size:14px;cursor:pointer}' +
      '.install-bar .ib-close{flex-shrink:0;width:44px;height:44px;margin:-6px -8px -6px -6px;border:0;border-radius:12px;' +
      'background:transparent;color:#B4BAC3;font-size:22px;line-height:1;cursor:pointer}' +
      '.install-bar button:focus-visible{outline:2px solid #C5E01B;outline-offset:2px}' +
      '@media (prefers-reduced-motion:reduce){.install-bar{animation:none}}';
    var style = document.createElement('style');
    style.id = 'install-bar-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function hide() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
  }

  // mode: 'prompt' (botón que instala), 'ios' (pasos de iPhone), 'manual' (pasos del menú)
  function show(mode) {
    hide();
    injectStyles();

    bar = document.createElement('div');
    bar.className = 'install-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Instalar la app');

    var icon = document.createElement('img');
    icon.src = '/web/images/icon-192.png';
    icon.alt = '';
    bar.appendChild(icon);

    var text = document.createElement('div');
    text.className = 'ib-text';
    var title = document.createElement('span');
    title.className = 'ib-title';
    title.textContent = 'Instalá la app';
    var desc = document.createElement('span');
    desc.className = 'ib-desc';
    if (mode === 'ios') {
      desc.innerHTML = 'Tocá <b>Compartir</b> (el cuadrado con la flecha) y elegí <b>Agregar a inicio</b>.';
    } else if (mode === 'ios-other') {
      desc.innerHTML = 'Abrí esta página en <b>Safari</b>, tocá <b>Compartir</b> y elegí <b>Agregar a inicio</b>.';
    } else if (mode === 'manual') {
      desc.innerHTML = 'Abrí el <b>menú del navegador</b> (⋮) y elegí <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.';
    } else {
      desc.textContent = 'Control de Turnos, en tu pantalla de inicio.';
    }
    text.appendChild(title);
    text.appendChild(desc);
    bar.appendChild(text);

    if (mode === 'prompt') {
      var go = document.createElement('button');
      go.type = 'button';
      go.className = 'ib-go';
      go.textContent = 'Instalar';
      go.addEventListener('click', function () {
        if (!deferredPrompt) return;
        var p = deferredPrompt;
        deferredPrompt = null;
        p.prompt();
        p.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') hide();
          else { rememberDismiss(); hide(); }
        }).catch(hide);
      });
      bar.appendChild(go);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ib-close';
    close.setAttribute('aria-label', 'Cerrar');
    close.textContent = '×';
    close.addEventListener('click', function () { rememberDismiss(); hide(); });
    bar.appendChild(close);

    document.body.appendChild(bar);
  }

  // Chrome, Edge y Samsung Internet avisan cuando la app se puede instalar.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (asked || !dismissedRecently()) show('prompt');
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hide();
  });

  function start() {
    if (isIOS) {
      if (asked || !dismissedRecently()) show(isIOSSafari ? 'ios' : 'ios-other');
      return;
    }
    // Si vino desde la landing y el navegador no ofrece instalar por su cuenta,
    // mostramos los pasos manuales después de darle un momento.
    if (asked) {
      setTimeout(function () { if (!deferredPrompt && !bar) show('manual'); }, 3500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
