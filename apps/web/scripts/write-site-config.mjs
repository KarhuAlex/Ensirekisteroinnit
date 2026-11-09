import { writeFileSync } from 'node:fs';

// Writes site.config.json from environment variables, so publishers set their own details without
// touching the code. Missing variables are left out and the site falls back to neutral wording.
const fields = {
  operator: process.env.SITE_OPERATOR,
  contactUrl: process.env.SITE_CONTACT_URL,
  hosting: process.env.SITE_HOSTING,
  repoUrl: process.env.SITE_REPO_URL,
};
const config = Object.fromEntries(Object.entries(fields).filter(([, value]) => value));
const target = process.argv[2] ?? 'dist/site.config.json';
writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${target} with: ${Object.keys(config).join(', ') || 'no fields'}`);
