-- Ejecutar solamente después de publicar y verificar la versión con inicio de sesión en main.
begin;

revoke execute on function public.find_client(text) from anon;
revoke execute on function public.create_client(text, text, smallint) from anon;
revoke execute on function public.update_client(text, text, smallint) from anon;
revoke execute on function public.get_client_history(text, integer) from anon;
revoke execute on function public.redeem_reward(text) from anon;

commit;
