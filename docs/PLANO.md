# Plano — wonderblue

> Onde estamos, onde queremos chegar, e a régua que decide.
> Front lidera; back é consequência. Organizado por domínio, não por sprint.

---

## 1. O propósito, e a régua que ele dá

A rede tem uma frase, e ela já está escrita na porta:

> **"A conversa aqui vira encontro lá fora."**

Isso não é slogan — é **régua**. Toda tela pode ser medida por uma pergunta:
*isso aproxima alguém de um encontro real?* Só há três respostas honestas:

- **É o destino** → Encontros.
- **É caminho até lá** → feed, tribos, bate-papo, DM, Rede, perfil.
- **Não é nem um nem outro** → ou vira caminho, ou sai.

A régua serve principalmente para dizer **não**. Uma rede fechada com poucos
membros não sobrevive carregando um produto grande.

## 2. Como este plano funciona

**O front lidera. O back é consequência.** Com uma exceção, nomeada de propósito:

Nenhuma tela consegue derivar um invariante de privacidade. A tela diz *o que
aparece*; ela não sabe dizer *o que é impossível*. Então o plano tem duas forças:

| Força | Define | Produz |
|---|---|---|
| **A tela** | o que o membro vive | o dado, a query, a tabela |
| **O invariante** | o que nunca pode acontecer | a RLS, a trigger, o portão de build |

Se só a tela mandar, nasce uma API que serve as telas e vaza todo o resto.

## 3. A descoberta: o método já aconteceu aqui

Lendo o repo com essa régua, uma coisa salta:

**O front já correu na frente do back.** As telas de feed, DM, notificações e
moderação estão escritas e **publicadas**. As tabelas delas **não existem no
banco**. Ou seja: "front primeiro, back como consequência" já é o que aconteceu
neste projeto — a consequência é que ficou pendente.

As 7 migrations não aplicadas (0020–0026) não são dívida técnica. São
**exatamente a consequência que o front pediu**, já escrita e revisada,
esperando para entrar.

---

## 4. Os domínios

Cada domínio é uma coisa só, vista de dois lados. Front e back deixam de ser
duas listas.

### 4.1 Porta — identidade e acesso

- **Hoje:** `/aplicar` (público) → fila → a administração confere o Instagram →
  cria o membro com **nome estelar** → manda a senha **por direct** → `/login`
  com @ + senha → troca obrigatória da senha provisória. Não existe e-mail em
  nenhum ponto: o @ vira um e-mail interno invisível.
- **Destino:** o mesmo funil, com **idade decidida** e **aceite de termos** no
  formulário. O gargalo é humano por escolha — serve aos primeiros 50.
- **Invariantes:** ninguém entra pela metade (nome, @, idade, profissão e cidade
  obrigatórios, senão a pessoa nasce invisível na Rede) · o **nome real nunca
  aparece** para outro membro · nome estelar é único · a senha provisória não dá
  acesso à rede antes de ser trocada.

### 4.2 Presença — o feed

- **Hoje:** `/feed` existe e está **apagado no ar** (tabela `posts` não criada).
  Escopos previstos: `geral`, cidade, `tribo:<id>`, `oficial`.
- **Destino:** feed vivo, com o **mural oficial** como voz da casa — é ele que
  resolve o problema da rede vazia no primeiro dia.
- **Invariantes:** autor é sempre `auth.uid()`, nunca o cliente · o nome exibido
  é lido do perfil (selo por trigger) · post de tribo só é visto por quem
  pertence · só a administração publica em `oficial`.

### 4.3 Conversa — bate-papo e DM

- **Hoje:** `/chat` funciona (mensagens efêmeras, janela de 12h). `/dm` está
  escrita e **apagada no ar**.
- **Destino:** o bate-papo é a praça; a **DM é o canal onde o encontro é
  combinado**. Pela régua, a DM é o caminho mais curto até o propósito — logo,
  prioridade acima do feed.
- **Invariantes:** uma thread por par, sem duplicata (par ordenado + unique) ·
  só os dois participantes leem e escrevem · conta invisível não inicia conversa.

### 4.4 Pertencimento — cidade e tribos

- **Hoje:** `/tribos` e `/tribos/[id]` funcionam. O **pedido de entrada** está
  escrito e apagado no ar — hoje só a administração coloca gente.
- **Destino:** a tribo como lugar (página, mural, gente à vista, porta). A porta
  pode fechar (`permite_pedido = false`) e voltar a ser só por convite.
- **Invariantes:** pedir é ato pessoal (só por si, sendo membro, fora da tribo,
  e só se a porta está aberta) · aprovar é atômico (entra e o pedido some).

### 4.5 Encontro — o ápice

- **Hoje:** **funciona, e é a melhor tela do produto.** Propor, "Eu vou",
  cancelar, filtro por cidade, próximos e passados, e — a decisão mais certa da
  interface — **mostrar os rostos de quem já confirmou**, não só o número. Numa
  rede feita para encontrar gente, quem vai pesa mais que quantos vão.
- **Destino:** é o destino de tudo. Toda outra tela deve ter um caminho curto
  até aqui. Duas coisas que faltam e que a régua pede: **um encontro nasce de
  uma conversa** (propor encontro direto de uma DM ou de uma tribo) e
  **memória** (o encontro que aconteceu vira história da rede, não só uma linha
  em "já aconteceram").
- **Invariantes:** só data futura · quem propõe já está confirmado · autor ou
  administração cancelam · quem confirmou precisa saber do cancelamento.

### 4.6 Governança — administração e moderação

- **Hoje:** `/admin` funciona (candidaturas, pedidos de senha, usuários, chat).
  A **moderação está escrita e apagada no ar**: denúncia, fila e suspensão.
- **Destino:** ligar a moderação **antes** do primeiro convite. Uma rede que
  leva estranhos a se encontrarem pessoalmente sem botão de denúncia é risco de
  gente, não de produto.
- **Invariantes:** só a administração lê a fila (nem o denunciado nem os outros
  sabem quem sinalizou) · denúncia nasce sempre `aberta`, selada no banco · a
  conta suspensa **não escreve em lugar nenhum** e some da vista dos outros.

### 4.7 Fundação — o que sustenta tudo

- **Hoje:** CSP, HSTS, frame-deny e `noindex` no `vercel.json`; PWA instalável;
  throttle por IP nas rotas públicas; `requireAdmin` no servidor; `my_role()`
  para que membro não enumere administradores. **Falta:** termos e privacidade
  (zero ocorrências no repo), decisão de idade, observabilidade, e um portão que
  quebre o build sem as variáveis do Supabase.
- **Destino:** toda regra com um **portão que falha**. Estrutura que se descreve
  mas não pode falhar é só documentação mais bonita.
- **Invariante-mãe:** **verdade derivada, nunca declarada.** Tudo que um humano
  precisa lembrar de atualizar vai divergir. Ver `supabase/conferencia.sql`: ele
  pergunta ao banco em vez de acreditar num documento.

---

## 5. O estado real do back hoje

| | |
|---|---|
| Aplicadas no Supabase | 0001–0019 (a confirmar rodando a conferência) |
| **Escritas e apagadas no ar** | **0020–0026** — feed, engajamento, notificações, DM, grupos, **moderação**, mural oficial |

O `bloqueia_conta_invisivel()` é o melhor exemplo de arquitetura do repo: **uma
função, pendurada em toda superfície de escrita**. Quando a 0025 entrar, ela
passa a barrar a conta suspensa e **a rede inteira fica coberta de uma vez** —
sem varredura, sem "será que esqueci algum lugar". É o padrão a repetir.

## 6. A ordem

**Movimento 1 — acender.** Rodar 0020→0026 (bloco pronto em
`supabase/rodadas/`). A rede passa a ter feed, DM, notificações, grupos e
moderação. A conferência prova o que entrou.

**Movimento 2 — a verdade num lugar só.** Com o banco completo, gerar o
**baseline declarativo** do schema (extraído do banco, não escrito à mão),
organizado pelos 7 domínios acima. As 26 migrations viram história arquivada.
Aqui morre a arqueologia: `0015_anonimato` → `0017_invisivel` →
`0018_invisivel_de_verdade` deixa de ser a única forma de saber o que é verdade.

**Movimento 3 — os portões.** Build que quebra sem variável de ambiente; termos,
privacidade e idade decidida; observabilidade. Só depois disso, convidar gente.

## 7. O que a régua manda cortar (ou adiar)

Opiniões de produto, para você decidir:

- **`/buscar` global** (pessoas + tribos + posts) resolve um problema de rede
  grande. Com poucos membros, `/rede` já mostra todo mundo. Candidata a esperar.
- **Seis tipos de reação** (`like, love, haha, wow, sad, grr`) é vocabulário de
  rede grande. Uma rede cujo objetivo é tirar as pessoas da tela provavelmente
  vive melhor com uma ou duas.
- **Notificação de reação.** Pela sua própria régua, o app é meio, não fim.
  Então notificação deveria chamar para **encontro** e para **conversa direta** —
  não para curtida. Notificação de curtida é o que prende na tela.

## 8. Decisões abertas

1. **Idade mínima.** Hoje aceita 13, numa rede que leva a encontro presencial.
2. **O `engine/` Python** (arena/pentest) continua no repo e não está ligado a
   nada no app. Fica, sai, ou vira outro projeto?
3. **`noindex` no site inteiro.** Coerente com rede fechada — mas então ninguém
   acha nem o `/aplicar`. A landing deveria ser indexável?
4. **Nome.** O repo é `wonderShield`, o produto é `wonderblue`.

---

*Este plano é derivado do código, não da memória. Se divergir do repo, o repo
está certo.*
