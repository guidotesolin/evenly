-- Optional emoji per fixed concept (🚗 Auto); without one the app shows the name's initial.
alter table public.fixed_concepts add column emoji text check (emoji <> '');
