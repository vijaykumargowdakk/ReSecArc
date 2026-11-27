import base from './playwright.config';
export default { ...base, grepInvert: /installing it as an app/, use: { ...base.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } };
