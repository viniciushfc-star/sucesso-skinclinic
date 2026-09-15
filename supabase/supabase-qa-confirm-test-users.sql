-- Confirma os usuários de teste criados com alias +funcionario / +gestor.
-- Cole no SQL Editor. Não apaga dados.

UPDATE auth.users
SET email_confirmed_at = coalesce(email_confirmed_at, now())
WHERE email ILIKE '%+funcionario@%'
   OR email ILIKE '%+gestor@%'
   OR email ILIKE '%+gestorqa@%';
