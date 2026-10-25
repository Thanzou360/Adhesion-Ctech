-- Mise à jour n°2 : choix club/bureau + suivi sans référence
alter table public.demandes add column if not exists type_demande text not null default 'membre';
alter table public.demandes add column if not exists poste_souhaite text;

-- Suivi sans référence : le candidat retrouve sa demande avec son numéro + son e-mail
create or replace function public.suivi_contact(p_telephone text, p_email text)
returns table (prenom text, statut text, created_at timestamptz, reference text)
language sql
security definer
stable
set search_path = public
as $$
  select d.prenom, d.statut, d.created_at, d.reference
  from public.demandes d
  where d.tel_cle = right(regexp_replace(p_telephone, '\D', '', 'g'), 8)
    and lower(d.email) = lower(trim(p_email))
  order by d.created_at desc
  limit 1;
$$;
grant execute on function public.suivi_contact(text, text) to anon, authenticated;
