const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CANONICAL_DOMAIN = 'https://www.endlessflowcapitalgroup.com';

const HTML_FILES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const DEPLOYABLE_FILES = fs.readdirSync(ROOT).filter((f) => {
  if (!/\.(html|xml|txt|json|js)$/i.test(f)) return false;
  if (/tests?\.js$/i.test(f)) return false;
  if (/^FLOWCORE_.*\.md$/i.test(f)) return false;
  return true;
});

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function existsLocalReference(ref) {
  const clean = ref.split('#')[0].split('?')[0].trim();
  if (!clean) return true;
  if (clean === '/') return fs.existsSync(path.join(ROOT, 'index.html'));
  if (clean.startsWith('/')) return fs.existsSync(path.join(ROOT, clean.slice(1)));
  return fs.existsSync(path.join(ROOT, clean));
}

function collectHtmlRefs(html) {
  const refs = [];
  const regex = /\b(?:href|src)=['"]([^'"]+)['"]/gi;
  let m;
  while ((m = regex.exec(html))) {
    const ref = m[1].trim();
    if (!ref || ref.startsWith('#')) continue;
    if (/^(https?:)?\/\//i.test(ref)) continue;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(ref)) continue;
    refs.push(ref);
  }
  return refs;
}

function testLocalReferencesExist() {
  HTML_FILES.forEach((file) => {
    const html = read(file);
    const refs = collectHtmlRefs(html);
    refs.forEach((ref) => {
      assert(existsLocalReference(ref), `${file}: missing local reference ${ref}`);
    });
  });
}

function testNoPlaceholdersOrUnfinishedTokens() {
  const blocked = [
    'yourdomain.com',
    'AUDIT_FORM_URL_TODO',
    'GHL CHAT WIDGET',
    'paste embed code below'
  ];

  DEPLOYABLE_FILES.forEach((file) => {
    const content = read(file);
    blocked.forEach((token) => {
      assert(!content.includes(token), `${file}: contains blocked token ${token}`);
    });
  });
}

function testCanonicalDomainInRobotsAndSitemap() {
  const robots = read('robots.txt');
  const sitemap = read('sitemap.xml');

  const robotsMatch = robots.match(/Sitemap:\s*(\S+)/i);
  assert(robotsMatch, 'robots.txt: sitemap declaration missing');
  assert(robotsMatch[1] === `${CANONICAL_DOMAIN}/sitemap.xml`, 'robots.txt: canonical sitemap URL is incorrect');
  assert(!/\byourdomain\.com\b/i.test(robots), 'robots.txt: placeholder domain found');

  const locMatches = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => m[1].trim());
  assert(locMatches.length > 0, 'sitemap.xml: missing loc entries');
  locMatches.forEach((loc) => {
    assert(loc.startsWith(`${CANONICAL_DOMAIN}/`), `sitemap.xml: non-canonical location found ${loc}`);
  });
  assert(!/\byourdomain\.com\b/i.test(sitemap), 'sitemap.xml: placeholder domain found');
  assert(!locMatches.includes(`${CANONICAL_DOMAIN}/flowcore-report.html`), 'sitemap.xml: flowcore-report.html must not be indexed');
  assert(!locMatches.includes(`${CANONICAL_DOMAIN}/thank-you.html`), 'sitemap.xml: thank-you.html must not be indexed');
}

function testNoindexDirectives() {
  const reportHtml = read('flowcore-report.html');
  const thankYouHtml = read('thank-you.html');

  assert(/<meta\s+name=['"]robots['"]\s+content=['"]noindex,\s*follow['"]/i.test(reportHtml), 'flowcore-report.html: missing robots noindex, follow');
  assert(/<meta\s+name=['"]robots['"]\s+content=['"]noindex,\s*nofollow['"]/i.test(thankYouHtml), 'thank-you.html: missing robots noindex, nofollow');
}

function testOgImageReferencesAreValid() {
  HTML_FILES.forEach((file) => {
    const html = read(file);
    const regex = /<meta\s+property=['"]og:image['"]\s+content=['"]([^'"]+)['"]/gi;
    let m;
    while ((m = regex.exec(html))) {
      const url = m[1].trim();
      if (!url) continue;

      if (/^https?:\/\//i.test(url)) {
        const normalized = url.replace(CANONICAL_DOMAIN, '').replace(/^https?:\/\/[^/]+/i, '');
        if (normalized.startsWith('/')) {
          assert(fs.existsSync(path.join(ROOT, normalized.slice(1))), `${file}: og:image points to missing asset ${url}`);
        }
      } else {
        assert(existsLocalReference(url), `${file}: og:image local asset missing ${url}`);
      }
    }
  });
}

function testNoProhibitedCausalClaimsOnPublicPages() {
  const prohibited = [
    'what breaks next',
    'downstream constraint',
    'future bottleneck',
    'likely next bottleneck',
    'constraint chain'
  ];

  HTML_FILES.forEach((file) => {
    const content = read(file).toLowerCase();
    prohibited.forEach((phrase) => {
      assert(!content.includes(phrase), `${file}: prohibited causal claim phrase found: ${phrase}`);
    });
  });
}

function testNoRenderedLogoPngUsage() {
  const navJs = read('nav.js');
  assert(!navJs.includes('logo.png'), 'nav.js: logo.png must not be referenced');

  HTML_FILES.forEach((file) => {
    const html = read(file);
    assert(!/src=['"]logo\.png['"]/i.test(html), `${file}: rendered logo.png reference must be removed`);
  });
}

function testSharedTextBrandIsPresent() {
  const navJs = read('nav.js');
  const brandMarkup = 'Endless Flow <em>Capital Group</em>';
  const occurrences = (navJs.match(/Endless Flow <em>Capital Group<\/em>/g) || []).length;
  assert(occurrences >= 2, 'nav.js: shared nav and footer must render visible text brand');
  assert(navJs.includes('aria-label="Endless Flow Capital Group"'), 'nav.js: homepage navigation brand must have accessible label');
  assert(navJs.includes(brandMarkup), 'nav.js: visible text brand markup missing');
}

function testManifestIconDeclarations() {
  const manifest = JSON.parse(read('manifest.json'));
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  assert(icons.length === 0, 'manifest.json: icons must be empty until approved brand icon assets exist');
}

function testDuplicateIds() {
  HTML_FILES.forEach((file) => {
    const html = read(file);
    const ids = [];
    const regex = /\bid=['"]([^'"]+)['"]/gi;
    let m;
    while ((m = regex.exec(html))) ids.push(m[1]);

    const seen = new Set();
    const dupes = new Set();
    ids.forEach((id) => {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    });

    assert(dupes.size === 0, `${file}: duplicate IDs found: ${Array.from(dupes).join(', ')}`);
  });
}

function testAuditLinkResolution() {
  assert(fs.existsSync(path.join(ROOT, 'audit.html')), 'audit.html does not exist');

  const navJs = read('nav.js');
  assert(navJs.includes('href="audit.html"'), 'nav.js: shared navigation is missing audit.html link');

  const publicPages = HTML_FILES.filter((f) => f !== 'flowcore-report.html');
  const hasResolvableAuditLink = publicPages.some((file) => {
    const html = read(file);
    return html.includes('href="audit.html"') || html.includes('href="#diagnostic-workspace"') || html.includes('src="nav.js"');
  });

  assert(hasResolvableAuditLink, 'No resolvable public audit links found');
}

function run() {
  const tests = [
    testLocalReferencesExist,
    testNoPlaceholdersOrUnfinishedTokens,
    testCanonicalDomainInRobotsAndSitemap,
    testNoindexDirectives,
    testOgImageReferencesAreValid,
    testNoRenderedLogoPngUsage,
    testSharedTextBrandIsPresent,
    testManifestIconDeclarations,
    testNoProhibitedCausalClaimsOnPublicPages,
    testDuplicateIds,
    testAuditLinkResolution
  ];

  tests.forEach((fn) => fn());
  console.log('PASS site-quality-tests');
}

run();
