const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const indexHtml = read('index.html');
const servicesHtml = read('services.html');
const navJs = read('nav.js');
const privacyHtml = read('privacy.html');
const contactHtml = read('contact.html');
const publicHtmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

function testApprovedOffersOnIndexAndServices() {
  const offerNames = ['FlowLaunch', 'FlowGrow', 'FlowElite', 'Custom Architecture'];
  offerNames.forEach((name) => {
    assert(indexHtml.includes(name), `index.html: missing approved offer name ${name}`);
    assert(servicesHtml.includes(name), `services.html: missing approved offer name ${name}`);
  });
}

function testApprovedPricing() {
  const requiredPrices = [
    '$299 / month',
    '+ $500 setup',
    '$549 / month',
    '+ $750 setup',
    '$899 / month',
    '+ $1,000 setup',
    '$299 per month',
    '$549 per month',
    '$899 per month',
    'Scoped after diagnosis'
  ];

  requiredPrices.forEach((price) => {
    const inIndex = indexHtml.includes(price);
    const inServices = servicesHtml.includes(price);
    assert(inIndex || inServices, `approved price text missing: ${price}`);
  });
}

function testFlowSitesPositioning() {
  assert(servicesHtml.includes('Flow Sites'), 'services.html: missing Flow Sites section');
  assert(
    servicesHtml.includes('Starting at approximately $2,500'),
    'services.html: missing Flow Sites starting price statement'
  );
  assert(
    servicesHtml.includes('distinct from FlowLaunch') || servicesHtml.includes('different from FlowLaunch'),
    'services.html: must distinguish Flow Sites from FlowLaunch'
  );
}

function testLegacyOffersAreAbsent() {
  const blocked = [
    'Starter Flow Bundle',
    'Growth Automation Bundle',
    'Full Ecosystem Bundle',
    '$497 setup',
    '$197 monthly',
    '$997 setup',
    '$397 monthly',
    '$1,997 setup',
    '$797 monthly',
    'Everything in Starter',
    'Everything in Growth'
  ];

  const targets = [...publicHtmlFiles, 'nav.js'];
  targets.forEach((file) => {
    const content = read(file);
    blocked.forEach((token) => {
      assert(!content.includes(token), `${file}: contains legacy offer token ${token}`);
    });
  });
}

function testUnsupportedClaimsAreAbsent() {
  const blocked = [
    'Marietta',
    'headquartered in Marietta',
    'All systems operational',
    'automatically assigns a package',
    'automatic package recommendation'
  ];

  const targets = [...publicHtmlFiles, 'nav.js'];
  targets.forEach((file) => {
    const content = read(file);
    blocked.forEach((token) => {
      assert(!content.toLowerCase().includes(token.toLowerCase()), `${file}: contains blocked claim ${token}`);
    });
  });

  const scoreGuardPresent =
    indexHtml.includes('does not automatically assign a package') ||
    servicesHtml.includes('does not automatically assign a package') ||
    contactHtml.includes('does not automatically assign an implementation path');
  assert(scoreGuardPresent, 'missing explicit diagnosis-first no-auto-assignment statement');
}

function testImplementationPathLinksResolve() {
  const requiredLinks = [
    'services.html#flowlaunch',
    'services.html#flowgrow',
    'services.html#flowelite',
    'services.html#custom-architecture',
    'services.html#flow-sites'
  ];

  requiredLinks.forEach((href) => {
    assert(navJs.includes(`href="${href}"`), `nav.js: missing implementation path link ${href}`);
  });

  const requiredIds = ['flowlaunch', 'flowgrow', 'flowelite', 'custom-architecture', 'flow-sites'];
  requiredIds.forEach((id) => {
    assert(servicesHtml.includes(`id="${id}"`), `services.html: missing destination id ${id}`);
  });
}

function testNoPlatformNamesInSalesOfferCopy() {
  const blockedPlatformTokens = [
    'FlowCore AI',
    'GoHighLevel',
    'HubSpot',
    'Salesforce',
    'Zapier',
    'n8n'
  ];

  const salesTargets = [
    ['index.html', indexHtml],
    ['services.html', servicesHtml],
    ['nav.js', navJs]
  ];

  salesTargets.forEach(([file, content]) => {
    blockedPlatformTokens.forEach((token) => {
      assert(!content.includes(token), `${file}: contains platform token in sales/offer copy: ${token}`);
    });
  });
}

function testPrivacyDistinguishesDiagnosticAndContactData() {
  assert(
    privacyHtml.includes('AI Business Audit responses currently remain in browser storage on your device'),
    'privacy.html: must state diagnostic responses remain in browser storage'
  );
  assert(
    privacyHtml.includes('Contact-form submissions may be processed by the currently configured form service'),
    'privacy.html: must distinguish contact form submission processing'
  );
}

function run() {
  testApprovedOffersOnIndexAndServices();
  testApprovedPricing();
  testFlowSitesPositioning();
  testLegacyOffersAreAbsent();
  testUnsupportedClaimsAreAbsent();
  testImplementationPathLinksResolve();
  testNoPlatformNamesInSalesOfferCopy();
  testPrivacyDistinguishesDiagnosticAndContactData();
  console.log('PASS offer-consistency-tests');
}

run();
