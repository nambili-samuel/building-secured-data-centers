// Runs on a schedule in GitHub Actions. It does two jobs at once:
//   1. Talks to your Supabase database, which counts as activity and keeps a
//      free project from being paused.
//   2. Saves every rating total and approved review into
//      data/reviews-backup.json, so a permanent copy lives in your repo and the
//      website can show it if Supabase is ever unreachable.
// It only reads data that is already public on your website, using the public
// anon key. Nothing secret is needed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const base = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
const file = process.env.BACKUP_FILE || 'data/reviews-backup.json';
if (!base || !key){
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add them under Settings > Secrets and variables > Actions.');
  process.exit(1);
}

async function call(path, init = {}){
  const res = await fetch(base + path, {
    ...init,
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  if (!res.ok) throw new Error(path.split('?')[0] + ' answered HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

const summary = await call('/rest/v1/rpc/rating_summary', { method: 'POST', body: '{}' });
const rows = await call('/rest/v1/reviews?select=body,created_at,profiles(display_name,headline,organization,country,avatar_url,linkedin_url)&approved=eq.true&order=created_at.desc&limit=1000');

const now = new Date();
const monday = new Date(now); monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
const out = {
  version: 1,
  weekOf: monday.toISOString().slice(0, 10),   // changes weekly, so the repo shows regular activity
  rating: {
    avg: Number(summary.avg) || 0,
    count: summary.count || 0,
    dist: [summary.d1, summary.d2, summary.d3, summary.d4, summary.d5].map(n => n || 0)
  },
  reviews: rows.map(r => ({ body: r.body, created_at: r.created_at, profile: r.profiles || {} }))
};

let previous = null;
if (existsSync(file)){ try{ previous = JSON.parse(readFileSync(file, 'utf8')); }catch(e){} }
// Safety: never replace a backup that has reviews with an empty one (for example
// if the database was reset by mistake). To really clear it, delete the file first.
if (previous && previous.reviews && previous.reviews.length > 0 && out.reviews.length === 0){
  console.warn('The database returned no reviews but the backup has ' + previous.reviews.length + '. Keeping the existing backup.');
  process.exit(0);
}
const text = JSON.stringify(out, null, 2) + '\n';
if (!previous || JSON.stringify(previous, null, 2) + '\n' !== text){
  mkdirSync(file.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(file, text);
  console.log('Backup updated: ' + out.reviews.length + ' reviews, ' + out.rating.count + ' ratings.');
} else {
  console.log('Backup already up to date.');
}
