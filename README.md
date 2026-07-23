# Magnificent 7 — Dashboard de Indicadores Financeiros

Dashboard web comparando os principais indicadores financeiros das **Magnificent 7**:
Apple (AAPL), Microsoft (MSFT), Alphabet (GOOGL), Amazon (AMZN), Meta (META), Nvidia (NVDA) e Tesla (TSLA).

**Dashboard ao vivo:** https://jmagomez.github.io/mag7-financial-dashboard/

## O que mostra

Quatro grupos de indicadores, alternando entre **FY2025 (ano fiscal)** e **Q1 2026 (trimestre)**:

- **Rentabilidade e margens** — receita, lucro operacional, lucro líquido, margem líquida, LPA
- **Crescimento** — crescimento de receita ano a ano
- **Valuation** — valor de mercado, preço, peso no grupo
- **Caixa** — fluxo de caixa operacional / free cash flow (onde disponível)

Inclui KPIs agregados, quatro gráficos (receita, margem, crescimento, market cap), tabela comparativa ordenável e notas de fonte.

## Estrutura

| Arquivo | Descrição |
|---|---|
| `index.html` | Dashboard completo (Chart.js via CDN, lê `data.json`) |
| `data.json` | Dataset versionado com todos os indicadores e fontes |

## Nota importante sobre anos fiscais

As empresas têm calendários fiscais diferentes (Apple fecha em setembro, Microsoft em junho, Nvidia em janeiro; Alphabet, Amazon, Meta e Tesla no ano-calendário). Neste dashboard:

- **FY2025** = o ano fiscal que cada empresa rotula como 2025.
- **Q1 2026** = trimestre-calendário Jan–Mar 2026, alinhado entre todas (Apple = Q2 FY26, Microsoft = Q3 FY26, Nvidia = Q1 FY27; demais = Q1 2026).

Alguns lucros trimestrais contêm itens não recorrentes (ganho da Amazon com a Anthropic, benefício fiscal da Meta, ganhos com participações da Alphabet), sinalizados nas notas.

## Atualização

Os dados são estáticos, provenientes dos releases oficiais de resultados e da SEC (ver seção *Fontes* no rodapé do dashboard). Para atualizar, edite `data.json`.

## Aviso

Conteúdo informativo, **sem recomendação de investimento**. Todos os valores em US$.
