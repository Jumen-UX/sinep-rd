create table if not exists public.assignment_canonical_reviews (
  assignment_id uuid primary key references public.position_assignments(id) on delete cascade,
  review_status text not null default 'pending' check (review_status in ('pending','acknowledged','resolved','closed')),
  resolution_type text null check (resolution_type in ('person_corrected','office_rules_adjusted','assignment_closed','accepted_exception','other')),
  review_notes text null,
  last_reason_code text null,
  last_message text null,
  reviewed_by uuid null references auth.users(id),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assignment_canonical_reviews enable row level security;
revoke all on table public.assignment_canonical_reviews from public, anon;
grant select on table public.assignment_canonical_reviews to authenticated;
