# Firebase — estrutura e como ligar

O app já está pronto para o Firestore. Enquanto `NEXT_PUBLIC_DATA_SOURCE=local`, ele salva no navegador
e nenhum código do Firebase é carregado. Quando você trocar para `firebase`, ele passa a pedir login com
Google e grava tudo na nuvem.

## Como ligar (passo a passo)

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Build → Firestore Database → Criar banco** (modo produção, região `southamerica-east1` / São Paulo).
3. **Build → Authentication → Começar → Método de login** e ative **E-mail/senha** e **Google**.
4. **Configurações do projeto → Seus apps → Web (`</>`)** → registre o app e copie o `firebaseConfig`.
5. Copie `.env.example` para `.env.local` e preencha as chaves `NEXT_PUBLIC_FIREBASE_*`.
6. Em `.env.local` troque para `NEXT_PUBLIC_DATA_SOURCE=firebase` e reinicie o `npm run dev`.
7. Publique as regras de segurança: cole o conteúdo de `firestore.rules` em **Firestore → Regras**
   (ou, com a Firebase CLI: `firebase deploy --only firestore`).
8. Para acessar pelo celular na rede local ou em outro domínio, adicione o endereço em
   **Authentication → Configurações → Domínios autorizados**.
9. Já tem dados no modo local? Abra o app **no mesmo navegador**, vá em **Ajustes → Dados →
   Enviar dados deste navegador para a nuvem**. (Ou exporte o backup JSON no modo local e importe no modo Firebase.)

Não é preciso criar coleções ou índices manualmente: o Firestore cria as coleções no primeiro documento,
e o app carrega cada coleção inteira (sem consultas que exijam índice composto). No primeiro login ele
cria as categorias padrão e uma conta.

## Vários usuários

Cada pessoa cria a própria conta (e-mail/senha ou Google) na tela de login. Os dados de cada uma ficam em
`users/{uid}` e as regras de `firestore.rules` só deixam o próprio usuário ler/escrever ali — ninguém vê
os dados de ninguém. Para ver quem se cadastrou: **Authentication → Usuários** (dá para desativar ou excluir contas por lá).

## Estrutura

```
users/{uid}/
  accounts/{id}
  cards/{id}
  categories/{id}
  transactions/{id}
  recurrences/{id}
  invoices/{cardId_YYYY-MM}
```

Convenções usadas em todos os documentos:

- **Dinheiro em centavos (inteiro)**: R$ 12,34 → `1234`. Evita erro de arredondamento.
- **Datas** `"YYYY-MM-DD"`, **meses** `"YYYY-MM"` (strings, ordenam corretamente).
- `id` (string) também é gravado dentro do documento.
- `createdAt` / `updatedAt`: ISO timestamp (`"2026-10-12T13:45:00.000Z"`).

As definições TypeScript ficam em `src/lib/types.ts`.

### accounts — contas (banco, carteira, poupança)

| campo | tipo | descrição |
|---|---|---|
| name | string | "Nubank Conta" |
| type | string | `corrente` \| `poupanca` \| `carteira` \| `investimento` |
| initialBalance | number | saldo inicial em centavos (pode ser negativo) |
| color | string | hex `#D4F36B` |
| archived | boolean | arquivada some das listas e do saldo total |

O saldo atual **não é gravado**: é calculado = `initialBalance` + receitas pagas − despesas pagas ± transferências − faturas pagas.

### cards — cartões de crédito

| campo | tipo | descrição |
|---|---|---|
| name | string | "Nubank" |
| brand | string | `visa` \| `mastercard` \| `elo` \| `amex` \| `hipercard` \| `outro` |
| limit | number | limite em centavos |
| closingDay | number | dia que a fatura fecha (1–31) |
| dueDay | number | dia que a fatura vence (1–31) |
| color | string | hex |
| paymentAccountId | string \| null | conta padrão para pagar a fatura |
| archived | boolean | |

### categories

| campo | tipo | descrição |
|---|---|---|
| name | string | "Mercado" |
| kind | string | `income` \| `expense` |
| color | string | hex |
| icon | string | chave do ícone (ver `src/components/category-icon.tsx`) |

### transactions — lançamentos

| campo | tipo | descrição |
|---|---|---|
| type | string | `income` \| `expense` \| `transfer` |
| description | string | |
| amount | number | valor positivo em centavos |
| date | string | `YYYY-MM-DD` |
| categoryId | string \| null | |
| accountId | string \| null | conta (origem na despesa/transferência, destino na receita). `null` se for no cartão |
| toAccountId | string \| null | destino da transferência |
| cardId | string \| null | cartão, quando a compra é no crédito |
| invoiceMonth | string \| null | `YYYY-MM` da fatura (mês de vencimento) em que a compra cai |
| paid | boolean | pago/recebido. Compras no cartão são sempre `true` (quem é paga é a fatura) |
| installmentGroupId | string \| null | mesmo valor em todas as parcelas de uma compra |
| installmentNumber | number \| null | 1, 2, 3… |
| installmentTotal | number \| null | total de parcelas |
| recurrenceId | string \| null | fixo mensal que gerou o lançamento |
| notes | string | |

Uma compra parcelada em 10x vira **10 documentos**, um por fatura.

### recurrences — fixos mensais (salário, aluguel, assinaturas)

| campo | tipo | descrição |
|---|---|---|
| type | string | `income` \| `expense` |
| description | string | |
| amount | number | centavos |
| categoryId | string \| null | |
| accountId | string \| null | |
| cardId | string \| null | quando a assinatura é no cartão |
| dayOfMonth | number | 1–31 (meses mais curtos usam o último dia) |
| startMonth | string | `YYYY-MM` |
| endMonth | string \| null | `YYYY-MM` ou `null` (sem fim) |
| skippedMonths | string[] | meses pulados |
| active | boolean | |

Os fixos **não geram documentos antecipados**: o app mostra como "previsto" e só cria a `transaction`
(com `recurrenceId`) quando você confirma/paga ou edita aquele mês.

### invoices — pagamentos de fatura

Documento existe só quando a fatura foi paga. `id = "{cardId}_{YYYY-MM}"`.

| campo | tipo | descrição |
|---|---|---|
| cardId | string | |
| month | string | `YYYY-MM` (mês de vencimento) |
| paid | boolean | |
| paidAt | string \| null | ISO timestamp |
| paidAmount | number | centavos (sai do saldo da conta abaixo) |
| accountId | string \| null | conta debitada |

O valor da fatura em si é calculado somando as `transactions` com aquele `cardId` + `invoiceMonth`.

## Onde está o código

- `src/lib/firebase/config.ts` – lê as variáveis de ambiente
- `src/lib/firebase/client.ts` – inicializa app, Firestore (com cache offline) e Auth
- `src/lib/firebase/auth.ts` – login/logout com Google
- `src/lib/data/firebase-repository.ts` – leitura/escrita no Firestore
- `src/lib/data/local-repository.ts` – mesma interface, usando localStorage
- `src/lib/data/index.ts` – escolhe a fonte pelo `NEXT_PUBLIC_DATA_SOURCE`
