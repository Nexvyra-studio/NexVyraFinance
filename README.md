# NexVyra Finance

Controle financeiro pessoal, simples e focado no celular: saldo das contas, cartões e faturas,
contas a pagar e a previsão de quanto você vai ter nos próximos meses.

Feito com Next.js 16 (App Router), React 19, TypeScript e Tailwind CSS 4. Já vem preparado para
Firebase, mas funciona 100% sem banco (salva no navegador).

## Rodando

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. Para testar no celular (mesma rede Wi-Fi):

```bash
npm run dev:celular
```

e acesse `http://IP-DO-SEU-PC:3000` no celular (veja o IP com `ipconfig`, em "Endereço IPv4").
Se não abrir, libere o Node.js no Firewall do Windows para redes privadas. No celular dá para "Adicionar à tela inicial" e usar como app.

Quer ver o app cheio? **Ajustes → Dados → Carregar dados de exemplo** (depois use "Apagar tudo" para começar do zero).

## Telas

- **Início** – saldo em contas, previsto para o fim do mês e para daqui a 2 meses, contas, cartões
  (fatura atual + limite), vencimentos dos próximos 15 dias, gastos por categoria e últimos lançamentos.
- **Lançamentos** – mês a mês, agrupado por dia, com filtros (despesas, receitas, cartão, pendentes) e busca.
  Toque no círculo para marcar como pago/recebido.
- **Cartões** – limite usado/disponível, fatura por mês (aberta, fechada, vencida, paga), próximas 6 faturas,
  pagar fatura escolhendo a conta.
- **Futuro** – saldo previsto ao fim de cada mês (6 ou 12 meses), com tudo que entra no cálculo.
- **Ajustes** – contas, fixos mensais, categorias, tema claro/escuro, esconder valores, backup (exportar/importar JSON).

## Como o dinheiro é calculado

- **Lançamento pago** entra no saldo da conta. **Pendente** entra só na previsão.
- **Compra no cartão** não mexe no saldo; ela cai em uma fatura pelo dia de fechamento.
  Comprou no dia do fechamento ou depois → próxima fatura. Dá para mudar a fatura manualmente no formulário.
- **Parcelado** gera uma parcela por mês (no cartão, uma por fatura).
- **Fixo mensal** aparece como "previsto" todo mês até você confirmar.
- **Pagar fatura** desconta o valor da conta escolhida.
- **Previsão** = saldo atual + receitas pendentes − contas pendentes − faturas em aberto, mês a mês.

## Firebase

Veja [`docs/FIREBASE.md`](docs/FIREBASE.md): coleções, campos, regras de segurança e o passo a passo.
Resumo: preencha `.env.local` (a partir do `.env.example`) e troque `NEXT_PUBLIC_DATA_SOURCE=firebase`.

## Estrutura

```
src/
  app/                 páginas (início, lancamentos, cartoes, futuro, ajustes)
  components/          UI (formulários, bottom sheet, navegação…)
  lib/
    types.ts           modelo de dados (= coleções do Firestore)
    finance.ts         regras: saldo, faturas, previsão, fixos
    dates.ts, money.ts utilitários (datas locais, centavos ↔ R$)
    data/              repositórios local e Firebase + dados iniciais/exemplo
    firebase/          config, client e auth
  store/
    finance-store.tsx  estado global + ações (adicionar, pagar, excluir…)
```
