      
/* ====================================================
   nav.js — Endless Flow Capital Group
   Handles: nav injection, footer injection, particle
   canvas, scroll reveal, mobile menu, smooth scroll
   Add ONE script tag to every page: <script src="nav.js"></script>
   ==================================================== */

(function () {
  'use strict';

  /* ===== ACTIVE PAGE DETECTION ===== */
  var p = window.location.pathname;
  function isActive(slug) {
    if (slug === 'index' && (p === '/' || p.endsWith('/index.html') || p === '/index.html')) return true;
    return p.indexOf(slug) !== -1;
  }
  function lc(slug) { return isActive(slug) ? ' class="ef-nav-active"' : ''; }

  /* ===== NAV INJECTION ===== */
  var navMount = document.getElementById('ef-nav-mount');
  if (navMount) {
    navMount.innerHTML = [
      '<nav class="ef-nav" id="efNav">',
      '  <a href="index.html" class="ef-nav-brand">',
      '    <img src="logo.png" alt="Endless Flow Capital Group" class="ef-nav-logo"',
      '      onerror="this.style.display=\'none\';document.getElementById(\'efNavTxt\').style.display=\'inline\'" />',
      '    <span id="efNavTxt" class="ef-nav-logo-text">Endless Flow <em>Capital Group</em></span>',
      '  </a>',
      '  <ul class="ef-nav-links">',
      '    <li><a href="services.html"' + lc('services') + '>Services</a></li>',
      '    <li><a href="about.html"' + lc('about') + '>About</a></li>',
      '    <li><a href="contact.html"' + lc('contact') + '>Contact</a></li>',
      '    <li><a href="audit.html"' + lc('audit') + '>Audit</a></li>',
      '  </ul>',
      '  <div class="ef-nav-right">',
      '    <a href="audit.html" class="ef-nav-cta">&#9889; Start Audit</a>',
      '    <button class="ef-hamburger" id="efHam" aria-label="Open menu">',
      '      <span></span><span></span><span></span>',
      '    </button>',
      '  </div>',
      '</nav>',
      '<nav class="ef-mobile-nav" id="efMobNav">',
      '  <a href="index.html">Home</a>',
      '  <a href="services.html">Services</a>',
      '  <a href="about.html">About</a>',
      '  <a href="contact.html">Contact</a>',
      '  <a href="audit.html" class="ef-mobile-nav-cta">&#9889; Start Your AI Business Audit</a>',
      '</nav>'
    ].join('\n');
  }

  /* ===== FOOTER INJECTION ===== */
  var footerMount = document.getElementById('ef-footer-mount');
  if (footerMount) {
    footerMount.innerHTML = [
      '<footer class="ef-footer">',
      '  <div class="ef-footer-inner">',
      '    <div class="ef-footer-top">',
      '      <div>',
      '        <img src="logo.png" alt="Endless Flow Capital Group" class="ef-footer-logo"',
      '          onerror="this.style.display=\'none\';document.getElementById(\'efFtTxt\').style.display=\'block\'" />',
      '        <div id="efFtTxt" class="ef-footer-logo-text">Endless Flow <em>Capital Group</em></div>',
      '        <p class="ef-footer-tagline">AI-powered business operating systems for founders, creators, and growing businesses. From first lead to full ecosystem automation.</p>',
      '        <div class="ef-footer-online"><span class="ef-footer-online-dot"></span> All systems operational</div>',
      '      </div>',
      '      <div class="ef-footer-col"><h4>Systems</h4><ul>',
      '        <li><a href="services.html">Endless Flow Systems</a></li>',
      '        <li><a href="services.html">FlowCore AI</a></li>',
      '        <li><a href="services.html">CRM + Pipeline</a></li>',
      '        <li><a href="services.html">Automation Engine</a></li>',
      '      </ul></div>',
      '      <div class="ef-footer-col"><h4>Packages</h4><ul>',
      '        <li><a href="audit.html">Starter Flow Bundle</a></li>',
      '        <li><a href="audit.html">Growth Automation Bundle</a></li>',
      '        <li><a href="audit.html">Full Ecosystem Bundle</a></li>',
      '        <li><a href="audit.html">&Agrave; La Carte</a></li>',
      '      </ul></div>',
      '      <div class="ef-footer-col"><h4>Company</h4><ul>',
      '        <li><a href="about.html">About</a></li>',
      '        <li><a href="contact.html">Contact</a></li>',
      '        <li><a href="audit.html">AI Business Audit</a></li>',
      '        <li><a href="privacy.html">Privacy &amp; Terms</a></li>',
      '      </ul></div>',
      '    </div>',
      '    <div class="ef-footer-bottom">',
      '      <span>&copy; 2025 Endless Flow Capital Group &nbsp;&middot;&nbsp; Endless Flow Systems &nbsp;&middot;&nbsp; FlowCore AI</span>',
      '      <span>Marietta, GA &nbsp;&middot;&nbsp; AI Automation &amp; Business Systems</span>',
      '    </div>',
      '  </div>',
      '</footer>'
    ].join('\n');
  }

  /* ===== NAV SCROLL BEHAVIOR ===== */
  var nav = document.getElementById('efNav');
  window.addEventListener('scroll', function () {
    if (nav) nav.classList.toggle('ef-scrolled', window.scrollY > 50);
  }, { passive: true });

  /* ===== MOBILE MENU ===== */
  var ham = document.getElementById('efHam');
  var mob = document.getElementById('efMobNav');
  if (ham && mob) {
    ham.addEventListener('click', function () {
      ham.classList.toggle('ef-open');
      mob.classList.toggle('ef-open');
    });
    mob.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        ham.classList.remove('ef-open');
        mob.classList.remove('ef-open');
      });
    });
  }

  /* ===== SMOOTH ANCHOR SCROLL ===== */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) { e.preventDefault(); window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' }); }
    });
  });

  /* ===== PARTICLE CANVAS ===== */
  var cv = document.getElementById('efCanvas');
  if (cv) {
    var ctx = cv.getContext('2d'), pts = [], W, H;
    var COLS = ['#77d7ff','#8b5cf6','#f8d27c','#ffffff','#77d7ff','#77d7ff'];
    function rsz() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
    function mk() {
      return { x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.4+0.25,
        a:Math.random()*0.45+0.07, vx:(Math.random()-0.5)*0.15, vy:(Math.random()-0.5)*0.15,
        c:COLS[0|Math.random()*COLS.length] };
    }
    function init() { rsz(); pts=[]; for(var i=0;i<130;i++) pts.push(mk()); }
    function draw() {
      ctx.clearRect(0,0,W,H);
      var g = ctx.createRadialGradient(W*.5,H*.25,0,W*.5,H*.25,W*.8);
      g.addColorStop(0,'rgba(7,17,38,0.16)'); g.addColorStop(1,'rgba(4,7,20,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      for(var i=0;i<pts.length;i++) {
        var pt=pts[i];
        ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2);
        ctx.fillStyle=pt.c; ctx.globalAlpha=pt.a; ctx.fill();
        pt.x+=pt.vx; pt.y+=pt.vy;
        if(pt.x<-2)pt.x=W+2; if(pt.x>W+2)pt.x=-2;
        if(pt.y<-2)pt.y=H+2; if(pt.y>H+2)pt.y=-2;
      }
      for(var i=0;i<pts.length;i++) {
        for(var j=i+1;j<pts.length;j++) {
          var dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.sqrt(dx*dx+dy*dy);
          if(d<88) { ctx.globalAlpha=0.042*(1-d/88); ctx.strokeStyle='#77d7ff'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
        }
      }
      ctx.globalAlpha=1; requestAnimationFrame(draw);
    }
    window.addEventListener('resize', init);
    init(); draw();
  }

  /* ===== SCROLL REVEAL ===== */
  var reveals = document.querySelectorAll('.ef-reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('ef-in'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('ef-in'); });
  }
  /* Hero elements are above the fold — show immediately */
  setTimeout(function () {
    document.querySelectorAll('.ef-hero .ef-reveal, .ef-page-hero .ef-reveal').forEach(function (el) {
      el.classList.add('ef-in');
    });
  }, 80);

})();

    
