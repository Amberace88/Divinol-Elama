-- the admin save used to reset is_public → visitors could not read {public, model}
update public.settings set is_public = true where key = 'assistant';
