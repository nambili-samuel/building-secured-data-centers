# Setting up ratings and reviews (about 20 minutes, free tier)

GitHub Pages can only host static files, so it cannot store ratings, create
accounts or send verification emails. Those need a small backend. This site
uses **Supabase** (free plan is enough). Your book's reviewer profiles live in
that database, not on GitHub.

Until you finish this, the page runs in **preview mode**: everything works for
you to try, but data stays in each visitor's own browser, no emails are sent,
and a notice on the page says so.

## 1. Create the project
1. Sign up at supabase.com and create a new project (pick a region near your readers).
2. Open **SQL Editor > New query**, paste all of `reviews-setup.sql`, and press **Run**.

## 2. Allow your website
**Authentication > URL Configuration**
- *Site URL*: your GitHub Pages address, e.g. `https://nambili-samuel.github.io/building-secured-data-centers/`
- *Redirect URLs*: add the same address. Without this, the confirmation link cannot return to your page.

## 3. Email verification
**Authentication > Providers > Email**: keep **Confirm email** switched ON (default). Reviewers sign up with email and password, so this is what proves the email is real.
Supabase's built-in mailer is limited to a few emails per hour, which is fine for testing
but too low for real launches. Before promoting the book, add your own sender under
**Project Settings > Authentication > SMTP** (Resend, Brevo, Mailgun, etc.).
Optional: edit the email wording under **Authentication > Email Templates**.

## 4. Connect the page
**Project Settings > API**: copy the *Project URL* and the *anon public* key into `index.html`:

```js
backend: {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "eyJ..."
}
```
The anon key is meant to be public. What protects your data are the rules created
by `reviews-setup.sql`. **Never put the `service_role` key in the page.**
Replace the whole example text, including the quotes' contents. `YOUR-PROJECT` and `eyJ...` are only examples.
Commit `index.html`, `book-knowledge.md` and push. The yellow notice above the reviews disappears
once the backend is connected.

## Check that it is really saving
1. Rate the book, then open the site in a private/incognito window. The rating and count must be there.
2. In Supabase **Table Editor > ratings**, you should see one row per rating.
3. If the page shows a yellow notice, read it: it says whether the URL or key is wrong, the library was blocked,
   or the server could not be reached.

## If ratings or reviews disappear when the browser closes
The page is in preview mode and is saving to that visitor's browser only. Causes, most likely first:
- `supabaseUrl` or `supabaseAnonKey` still holds the example text, or is empty.
- You edited a copy of `index.html` that is not the one published on GitHub Pages (or have not pushed yet). Hard-refresh the page (Ctrl+Shift+R).
- An ad blocker blocked the Supabase library; try a window without extensions.
The yellow notice names which of these applies.

## Keeping it permanent (do this once)
Free Supabase projects are paused after about a week of low activity (Supabase's docs say a few database
requests a day is enough to prevent it, and a paused project can be restored from the dashboard for a limited
window, currently 90 days). Visitors count as activity, but a quiet week would not. The files below fix that and
also keep a copy of every rating and review inside your GitHub repo.

1. Put these in your repo, keeping the folder names:
   - `.github/workflows/keep-reviews-alive.yml`
   - `scripts/backup-reviews.mjs`
   - `data/reviews-backup.json`
2. In GitHub: **Settings > Secrets and variables > Actions > New repository secret**. Add two secrets:
   - `SUPABASE_URL`: your Project URL
   - `SUPABASE_ANON_KEY`: your anon public key (the same one used in `index.html`)
3. Open the **Actions** tab, choose **Keep reviews alive and back them up**, and press **Run workflow**.
   After a minute it should show a green tick, and `data/reviews-backup.json` in your repo is updated.
   If the last step fails to push, go to **Settings > Actions > General > Workflow permissions** and choose
   **Read and write permissions**.
4. From then on it runs twice a day. It contacts the database (so the project stays awake), saves approved
   reviews and the rating totals to `data/reviews-backup.json`, and fails loudly (GitHub emails you) if the
   database cannot be reached.

What the backup gives you:
- **A permanent copy in GitHub.** Names, headlines, photos' addresses and review text are in the file.
  No email addresses and no passwords are ever in it.
- **A safety net on the page.** If Supabase is ever unreachable, the page shows the saved copy
  (read-only, with a notice) instead of an empty reviews section.
- **Restore point.** If a project were ever lost, you still have every review's text and the totals.

Limits to know:
- GitHub switches off scheduled jobs in a public repo after 60 days with no repository activity. The job
  updates the backup file weekly, which normally counts as activity. If GitHub ever disables it, you will
  get an email; open the Actions tab and press **Enable workflow**.
- The backup holds review content and rating totals. Accounts and individual star votes live only in Supabase.
- Upgrading Supabase to a paid plan removes pausing altogether, if you ever want a guarantee instead.
- Export reviews yourself now and then as well: **Table Editor > reviews > Export to CSV**.

## Why not a GitHub Gist as the database?
Anyone can read a public gist, but writing to one needs an access token. A token inside a web page is visible
to every visitor, who could then edit or delete your gists, so a gist cannot safely accept reviews straight from
the browser. Keeping the live data in Supabase and the permanent copy in GitHub (above) gives you both.

## Moderation
- Reviews publish immediately. To hide one: **Table Editor > reviews**, set `approved` to `false`.
- To approve every review before it appears, run once in the SQL Editor:
  `alter table public.reviews alter column approved set default false;`
  then set `approved = true` on each review you want shown.
- Remove an account entirely: **Authentication > Users > delete** (their profile and review are deleted with it).

## What this can and cannot guarantee
- **One review per account**, and only from a confirmed email: enforced by the database.
- **One star rating per device**: enforced per browser (a stored device ID checked by the database).
  A browser cannot truly identify a computer, so someone who clears their browser data or
  uses a private window can rate again. This is a reasonable deterrent, not a lock.
- Ratings need no account by design. If you would rather allow only signed-in readers to
  rate, tell me and I will change it to one rating per verified account.
- Reviewers should be told their name, photo and headline are public. The dialog asks for
  their consent before saving.
