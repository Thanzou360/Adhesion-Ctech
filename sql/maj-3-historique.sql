-- Mise à jour n°3 : historique des suppressions et décisions (journal du bureau)
alter table public.demandes add column if not exists motif_suppression text;

create table if not exists public.journal (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  action       text not null,          -- 'suppression' ou 'decision'
  membre_email text,
  membre_nom   text,
  reference    text,
  candidat     text,
  details      text                    -- motif de suppression, ou « ancien → nouveau statut »
);
alter table public.journal enable row level security;
drop policy if exists "bureau lit journal" on public.journal;
create policy "bureau lit journal" on public.journal
  for select to authenticated using (public.est_bureau());
-- Aucune règle d'ajout, de modification ou de suppression :
-- seul le déclencheur ci-dessous écrit dans le journal, et personne ne peut l'effacer depuis le site.

create or replace function public.journaliser_demande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nom   text;
begin
  select b.nom into v_nom from public.bureau b where lower(b.email) = v_email;
  v_nom := coalesce(v_nom, nullif(v_email, ''), 'Tableau de bord Supabase');
  if tg_op = 'DELETE' then
    insert into public.journal (action, membre_email, membre_nom, reference, candidat, details)
    values ('suppression', v_email, v_nom, old.reference, old.prenom || ' ' || old.nom, old.motif_suppression);
    return old;
  elsif new.statut is distinct from old.statut then
    insert into public.journal (action, membre_email, membre_nom, reference, candidat, details)
    values ('decision', v_email, v_nom, new.reference, new.prenom || ' ' || new.nom, old.statut || ' → ' || new.statut);
  end if;
  return new;
end;
$$;

drop trigger if exists journal_demandes on public.demandes;
create trigger journal_demandes
  after update or delete on public.demandes
  for each row execute function public.journaliser_demande();
