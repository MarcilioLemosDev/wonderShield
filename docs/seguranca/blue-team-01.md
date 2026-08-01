# Blue team · wonderblue — plano de defesa (rodada 01)

Resposta ao `red-team-01.md`. Cada item aponta o achado que fecha e onde a
correção vive.

## Aplicado nesta rodada

| Achado | Defesa | Onde |
|---|---|---|
| **R1** auto-edição larga | Trigger congela `role, reputation, hidden, must_change_password, handle, instagram, real_name, display_name, sign` no update de quem é dono da linha. Só admin/service_role muda. | `0019` · `protect_profile_privileges()` |
| **R2** nome estelar colidível | `unique index` case-insensitive em `display_name` (não depende mais da aplicação). | `0019` · `profiles_display_name_unico` |
| **R3** bypass do portão de senha | `must_change_password` entrou na lista congelada — o membro não desliga a própria pendência. | `0019` |
| **R4** rate limit global | Contagem **por IP** com backstop global alto; `clientIp()` agora é usado; IP guardado em `applications`/`password_requests`. | `lib/throttle.ts`, `/api/apply`, `/api/forgot`, `0019` |
| **R5** texto sem limite | `check(char_length…)` em display_name(40), real_name(80), profession(80), bio(500), application.name(80)/profession(80). | `0019` |
| **R6** conta invisível vaza pela boca | Trigger impede a conta `hidden` de inserir em `messages` e `presencas`: ela é só comando. | `0019` · `bloqueia_conta_invisivel()` |
| **R8** enumeração de candidatura | `/api/apply` responde 200 mesmo com @ repetido; o índice único barra a duplicata em silêncio. | `/api/apply` |
| **UI** | A página de perfil parou de oferecer edição de nome estelar/@; carrega o próprio @ via `meus_dados()` (as colunas foram revogadas em 0015). | `app/(app)/perfil/page.tsx` |

## Fica para a próxima rodada (operacional / maior)

- **R7** — a FK de `presencas.encontro_id → encontros` já garante que o encontro
  existe; sobra só validar a cidade, de baixo impacto. Adiado.
- **R9** — CSP com nonce exige middleware do Next; hoje `'unsafe-inline'` é
  contido pelo escape do React. Trocar por nonce numa rodada dedicada.
- **R10** — rotação da `service_role` e verificação de que nunca é logada. É
  procedimento, não código.

## Verificação recomendada (do lado do atacante)

Depois de aplicar `0019`, repetir a cadeia principal com um JWT de membro:

```js
const me = (await s.auth.getSession()).data.session.user.id;
await s.from('profiles').update({ display_name: 'Vega' }).eq('id', me); // deve não mudar
await s.from('profiles').update({ hidden: true }).eq('id', me);         // deve não mudar
await s.from('profiles').update({ must_change_password: false }).eq('id', me); // idem
```

Os três `update` retornam sucesso (a linha é do dono), mas o trigger preserva os
valores antigos — nada muda. A cadeia R1→R2→R3 fica neutralizada.
