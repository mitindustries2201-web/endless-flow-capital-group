const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  const page = read('ai-youtube-shorts-generator.html');
  const services = read('services.html');
  const nav = read('nav.js');

  const requiredEndpoints = [
    '/api/v1/jobs/upload',
    '/api/v1/jobs/url',
    '/api/v1/jobs/',
    '/clips',
    '/download'
  ];
  requiredEndpoints.forEach((x) => assert(page.includes(x), `Missing API endpoint reference: ${x}`));

  assert(!page.includes('innerHTML'), 'Untrusted innerHTML usage is not allowed on clipping page.');
  assert(page.includes('id="efRightsAffirmed"'), 'Rights affirmation checkbox missing.');
  assert(page.includes('value="upload"') && page.includes('value="url"'), 'Upload and URL modes are required.');
  assert(page.includes('aria-live="polite"') && page.includes('role="status"'), 'Accessible live status region missing.');
  assert(page.includes('maxPollAttempts'), 'Bounded polling control is required.');

  const blockedClaims = [
    'guaranteed virality',
    'viral-ready',
    'unlimited clips',
    'no subscription caps',
    'all systems operational'
  ];
  blockedClaims.forEach((c) => assert(!page.toLowerCase().includes(c), `Blocked claim present: ${c}`));

  assert(nav.includes('AI Video Clipping Application'), 'nav.js must expose AI Video Clipping Application link.');
  assert(services.includes('AI Video Clipping Application'), 'services.html must mention AI Video Clipping Application.');

  const keepClaims = ['FlowLaunch', 'FlowGrow', 'FlowElite', 'Custom Architecture', 'Starting at approximately $2,500'];
  keepClaims.forEach((c) => assert(services.includes(c), `Services regression detected for ${c}`));

  assert(!services.includes('Marietta'), 'Location regression detected in services.html');
  console.log('PASS ai-video-clipping-page-tests');
}

run();
