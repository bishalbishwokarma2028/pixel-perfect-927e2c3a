INSERT INTO public.module_permissions (user_id, module, can_view, can_edit)
SELECT p.id, 'add', true, true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions mp WHERE mp.user_id = p.id AND mp.module = 'add'
);