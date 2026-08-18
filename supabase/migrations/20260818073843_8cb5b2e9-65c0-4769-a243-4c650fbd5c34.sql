REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_any(uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_any(uuid, text[]) FROM anon;