# Openhouse — open source app directory

A dense, effects-heavy landing page for an open source app directory.
Plain HTML/CSS/JS, no build step — deploy straight to Vercel.

## Stack

- **GSAP + ScrollTrigger** (CDN) — split-letter title reveal, parallax on the
  hero grid/fog, and the scrub-driven "sticky storytelling" section.
- **Lenis** (CDN) — smooth scroll, wired into the GSAP ticker.
- **Vanilla canvas** (`js/particles.js`) — the monochrome floating-particle
  background, mouse spotlight attraction, and click particle bursts. No
  Three.js/WebGL dependency, so it stays light.
- **`js/main.js`** — everything else: custom physics cursor, magnetic
  buttons, character-scramble brand hover, 3D tilt + mouse-glow cards,
  scroll progress bar, stat count-ups, command palette (⌘K), floating dock
  nav, welcome/shortcuts modals, and toasts.

## Files

```
index.html
style.css
js/particles.js   — canvas background
js/main.js        — cursor, scroll, reveals, palette, modals, toasts
vercel.json       — pins framework to "Other" so Vercel doesn't guess Vite
```

## Customize

- **Content/branding**: it's themed as "Openhouse", a directory of open
  source apps. The six app cards under `#apps` are placeholders (including
  a card for your own `Waveline`/`Rootkit`-style projects) — swap in real
  repos, descriptions, and licenses.
- **Palette**: CSS variables at the top of `style.css` (`--accent` is the
  amber/phosphor tone; swap for your own).
- **Particle density / performance**: `COUNT_DESKTOP` / `COUNT_MOBILE` in
  `js/particles.js`. Heavy effects (cursor, particles, tilt) auto-disable
  on touch devices and respect `prefers-reduced-motion`.
- **Command palette results**: edit the `<li>` list inside
  `#palette-results` in `index.html`.

## Deploy to Vercel

```bash
npm i -g vercel
cd openhouse-site
vercel --prod
```

Framework preset is pinned to "Other" via `vercel.json`, so it will just
serve the static files — no build command needed.

---

## Database setup (Supabase) — makes uploads visible to everyone

Without this, apps you upload are only saved in your own browser
(localStorage) and nobody else can see them.

### 1. Create the project
1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine).
2. Pick any name/password/region and wait for it to provision.

### 2. Run this in the SQL Editor (paste all of it, press Run)

```sql
-- private schema for the owner password (must exist before the tables)
create schema if not exists private;

-- apps table
create table public.apps (
  id          bigint generated always as identity primary key,
  name        text not null,
  cat         text not null,
  icon        text default '•',
  description text default '',
  tags        jsonb default '[]',
  license     text default 'MIT',
  repo        text default '',
  thumb       text default '',
  starred     boolean default false,
  created_at  timestamptz default now()
);

-- site metadata (hidden categories, custom emoji icons)
create table public.site_meta (
  key   text primary key,
  value jsonb
);

-- owner password lives ONLY in the database (change it here!)
create table private.secrets (key text primary key, value text);
insert into private.secrets values ('owner_pass', 'CHANGE_ME_TO_YOUR_PASSWORD');

alter table public.apps enable row level security;
alter table public.site_meta enable row level security;

-- anyone may READ
create policy "public read apps" on public.apps for select using (true);
create policy "public read meta" on public.site_meta for select using (true);
-- nobody may write directly (no insert/update/delete policies) —
-- all writes go through the password-checked functions below.

create or replace function public.owner_check(p_pass text)
returns boolean language sql security definer set search_path = ''
as $$ select exists(select 1 from private.secrets where key='owner_pass' and value=p_pass); $$;

create or replace function public.owner_add_app(p_pass text, p_app jsonb)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare new_id bigint;
begin
  if not public.owner_check(p_pass) then raise exception 'unauthorized'; end if;
  insert into public.apps (name, cat, icon, description, tags, license, repo, thumb)
  values (p_app->>'name', p_app->>'cat', coalesce(p_app->>'icon','•'),
          coalesce(p_app->>'description',''), coalesce(p_app->'tags','[]'::jsonb),
          coalesce(p_app->>'license','MIT'), coalesce(p_app->>'repo',''),
          coalesce(p_app->>'thumb',''))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.owner_delete_app(p_pass text, p_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.owner_check(p_pass) then raise exception 'unauthorized'; end if;
  delete from public.apps where id = p_id;
end $$;

create or replace function public.owner_delete_category(p_pass text, p_cat text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.owner_check(p_pass) then raise exception 'unauthorized'; end if;
  delete from public.apps where cat = p_cat;
end $$;

create or replace function public.owner_set_tags(p_pass text, p_id bigint, p_tags jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.owner_check(p_pass) then raise exception 'unauthorized'; end if;
  update public.apps set tags = coalesce(p_tags, '[]'::jsonb) where id = p_id;
end $$;

create or replace function public.owner_set_star(p_pass text, p_id bigint, p_on boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.owner_check(p_pass) then raise exception 'unauthorized'; end if;
  update public.apps set starred = coalesce(p_on, false) where id = p_id;
end $$;

create or replace function public.owner_set_meta(p_pass text, p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.owner_check(p_pass) then raise exception 'unauthorized'; end if;
  insert into public.site_meta (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;
```

> Already ran the script halfway and got errors? Reset with
> `drop table if exists public.apps, public.site_meta; drop schema if exists private cascade;`
> then run the full block again.

**Set your owner password** in the `insert into private.secrets` line —
that becomes the password you use to sign in on the site. It is checked by
the database on every write, so it never ships in the site's JavaScript.

### 3. Wire the site to the project
1. In Supabase: **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key into `js/config.js`:

```js
window.OPENHOUSE_DB = {
  url: 'https://YOURPROJECT.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

3. Commit + push. Done — uploads are now stored centrally and visible to
   every visitor on every device.

### 4. Rescue apps you added before the database existed
Open the site **in the browser where you added them**, sign in as owner —
you'll be asked whether to publish the locally-saved apps to the database.
Confirm, and they appear for everyone.

**Security note:** the anon key is safe to expose (it only allows reading);
every write re-checks the owner password server-side. Don't ever put the
`service_role` key in the site.
