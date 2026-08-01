// Identidade sem e-mail: o login é o @ do Instagram (o "nick"). Por baixo, o
// Supabase Auth ainda usa um e-mail — então geramos um e-mail interno invisível
// a partir do nick. O usuário nunca vê nem digita esse e-mail.
export const INTERNAL_EMAIL_DOMAIN = "wonderblue.app";

// Normaliza um @: remove @ inicial, minúsculas, só caracteres válidos de handle.
export function sanitizeHandle(raw: string): string {
  return (raw ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

export function handleToEmail(handle: string): string {
  return `${sanitizeHandle(handle)}@${INTERNAL_EMAIL_DOMAIN}`;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// No login, o campo aceita "nick ou e-mail". Se for um e-mail de verdade (caso
// do admin), usa direto; senão, trata como nick e resolve para o e-mail interno.
export function resolveLoginEmail(input: string): string {
  const v = (input ?? "").trim();
  if (EMAIL_RE.test(v)) return v.toLowerCase();
  return handleToEmail(v);
}
