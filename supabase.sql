-- =====================================================================
--  Plateforme d'adhésion — Club C-Tech
--  À coller dans Supabase > SQL Editor > New query, puis « Run ».
--  Le script peut être relancé sans casser ce qui existe déjà.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Membres du bureau (seuls eux voient les demandes)
-- ---------------------------------------------------------------------
create table if not exists public.bureau (
  email      text primary key,
  nom        text not null,
  poste      text,                 -- ex. Président, Secrétaire général…
  created_at timestamptz not null default now()
);

-- Vrai si la personne connectée fait partie du bureau
create or replace function public.est_bureau()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.bureau
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.est_bureau() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Demandes d'adhésion
-- ---------------------------------------------------------------------
create table if not exists public.demandes (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,          -- ex. CT-7F3K2, donné au candidat
  created_at      timestamptz not null default now(),

  prenom          text not null,
  nom             text not null,
  telephone       text not null,                 -- numéro WhatsApp
  tel_cle         text generated always as
                    (right(regexp_replace(telephone, '\D', '', 'g'), 8)) stored,
  email           text not null,                 -- le bureau répond par e-mail
  etablissement   text not null,
  filiere         text not null,
  niveau          text not null,

  domaines        text[] not null default '{}',  -- centres d'intérêt tech
  niveau_tech     text not null,                 -- Débutant / Intermédiaire / Avancé
  projets         text,                          -- réalisations, liens GitHub…
  motivation      text not null,
  apport          text not null,                 -- ce qu'il/elle apportera au club
  disponibilite   text not null,
  source          text,                          -- comment il/elle a connu le club

  photo_path      text not null,                 -- chemin dans le stockage « adhesions »

  statut          text not null default 'en_attente'
                    check (statut in ('en_attente','entretien','acceptee','refusee')),
  note_bureau     text,
  traite_par      text,
  traite_le       timestamptz,

  accuse_envoye_le timestamptz,                  -- e-mail « demande bien reçue »
  bureau_notifie_le timestamptz,                 -- e-mail « nouvelle demande » au bureau
  email_envoye_le  timestamptz,                  -- dernier e-mail de décision
  email_statut     text,                         -- statut annoncé dans ce dernier e-mail
  email_envoye_par text,

  constraint motivation_assez_longue check (char_length(motivation) >= 80),
  constraint apport_assez_long      check (char_length(apport) >= 30)
);

-- Mise à jour d'une table créée avec une ancienne version du script
alter table public.demandes add column if not exists accuse_envoye_le timestamptz;
alter table public.demandes add column if not exists bureau_notifie_le timestamptz;
alter table public.demandes add column if not exists email_envoye_le  timestamptz;
alter table public.demandes add column if not exists email_statut     text;
alter table public.demandes add column if not exists email_envoye_par text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'email_valide') then
    alter table public.demandes add constraint email_valide
      check (email is not null and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') not valid;
  end if;
end $$;

-- Une seule demande par numéro WhatsApp
create unique index if not exists demandes_tel_unique on public.demandes (tel_cle);
create index if not exists demandes_statut_idx on public.demandes (statut, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Avis des membres du bureau sur chaque demande
-- ---------------------------------------------------------------------
create table if not exists public.avis (
  demande_id   uuid not null references public.demandes(id) on delete cascade,
  membre_email text not null default lower(auth.jwt() ->> 'email'),
  vote         text not null check (vote in ('pour','reserve','contre')),
  commentaire  text,
  updated_at   timestamptz not null default now(),
  primary key (demande_id, membre_email)
);

-- ---------------------------------------------------------------------
-- 4. Sécurité (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.bureau   enable row level security;
alter table public.demandes enable row level security;
alter table public.avis     enable row level security;

drop policy if exists "bureau se voit"              on public.bureau;
drop policy if exists "candidat depose"             on public.demandes;
drop policy if exists "bureau lit demandes"         on public.demandes;
drop policy if exists "bureau traite demandes"      on public.demandes;
drop policy if exists "bureau supprime demandes"    on public.demandes;
drop policy if exists "bureau lit avis"             on public.avis;
drop policy if exists "membre donne son avis"       on public.avis;
drop policy if exists "membre modifie son avis"     on public.avis;

create policy "bureau se voit" on public.bureau
  for select to authenticated using (public.est_bureau());

-- N'importe qui peut DÉPOSER une demande (mais jamais la relire ni la modifier)
create policy "candidat depose" on public.demandes
  for insert to anon, authenticated
  with check (
    statut = 'en_attente'
    and note_bureau is null and traite_par is null and traite_le is null
    and accuse_envoye_le is null and bureau_notifie_le is null and email_envoye_le is null
    and email_statut is null and email_envoye_par is null
    and photo_path like 'demandes/%'
  );

create policy "bureau lit demandes" on public.demandes
  for select to authenticated using (public.est_bureau());

create policy "bureau traite demandes" on public.demandes
  for update to authenticated using (public.est_bureau()) with check (public.est_bureau());

create policy "bureau supprime demandes" on public.demandes
  for delete to authenticated using (public.est_bureau());

create policy "bureau lit avis" on public.avis
  for select to authenticated using (public.est_bureau());

create policy "membre donne son avis" on public.avis
  for insert to authenticated
  with check (public.est_bureau() and membre_email = lower(auth.jwt() ->> 'email'));

create policy "membre modifie son avis" on public.avis
  for update to authenticated
  using (membre_email = lower(auth.jwt() ->> 'email'))
  with check (public.est_bureau() and membre_email = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------
-- 5. Suivi : le candidat consulte le statut avec sa référence + son numéro
-- ---------------------------------------------------------------------
create or replace function public.suivi_demande(p_reference text, p_telephone text)
returns table (prenom text, statut text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select d.prenom, d.statut, d.created_at
  from public.demandes d
  where upper(d.reference) = upper(trim(p_reference))
    and d.tel_cle = right(regexp_replace(p_telephone, '\D', '', 'g'), 8);
$$;
grant execute on function public.suivi_demande(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Stockage des photos (privé : seul le bureau peut les voir)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adhesions', 'adhesions', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "candidat depose sa photo" on storage.objects;
drop policy if exists "bureau voit les photos"   on storage.objects;
drop policy if exists "bureau supprime photos"   on storage.objects;

create policy "candidat depose sa photo" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'adhesions' and (storage.foldername(name))[1] = 'demandes');

create policy "bureau voit les photos" on storage.objects
  for select to authenticated using (bucket_id = 'adhesions' and public.est_bureau());

create policy "bureau supprime photos" on storage.objects
  for delete to authenticated using (bucket_id = 'adhesions' and public.est_bureau());

-- ---------------------------------------------------------------------
-- 7. Ajoute ici les membres du bureau (même e-mail que leur compte
--    créé dans Authentication > Users). Décommente et adapte :
-- ---------------------------------------------------------------------
-- insert into public.bureau (email, nom, poste) values
--   ('president@exemple.com',  'Prénom Nom', 'Président'),
--   ('secretaire@exemple.com', 'Prénom Nom', 'Secrétaire général')
-- on conflict (email) do update set nom = excluded.nom, poste = excluded.poste;
