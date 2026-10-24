#!/usr/bin/env python3
"""Aplica a atualização diária de números (determinística) em data.json e history/snapshots.json.

data.json guarda só os dados DIÁRIOS (os trimestrais ficam em fundamentals.json e nunca são tocados aqui).
Faz a parte mecânica, onde erros de conta/formatação aparecem: market cap por ações implícitas,
pesos, total do grupo, cdsAsOf, numeração do cdsLog (mantém só os últimos CDS_LOG_KEEP), snapshot do dia,
datas em meta.priceNote/priceSource e os níveis "~N bps" de meta.cdsNote. A parte analítica (briefing,
auditoria, texto da nota de CDS) continua sendo escrita/revisada por quem atualiza e vai no mesmo delta.

Uso:   python src/daily.py delta.json [--dry-run]
Depois: python src/validate.py && python src/send_email.py --dry-run

delta.json (campos opcionais exceto tradeDate e prices):
{
  "tradeDate": "2026-10-22",                    # pregão (vira marketSnapshot e a data do snapshot)
  "today": "2026-10-23",                        # meta.generated (padrão: hoje em America/Sao_Paulo)
  "prices": {"AAPL": 348.22, ... 7 tickers},    # fechamento
  "cds": {"META": {"bps": 115, "asOf": "2026-10-22"}, "ORCL": {...}},   # SÓ cotações novas e confiáveis
  "snapshotNote": "texto curto com fontes",
  "cdsLog": "texto da checagem (a numeração 'Nª checagem:' é automática)",
  "dailyBrief": {...}, "audit": [...], "catalysts": [...], "cdsNote": "texto completo (opcional)",
  "priceSource": {"label": "Preços de DD/MM/AAAA (fontes)", "url": "..."}, "priceSourceShort": "StockAnalysis; ..."
}
Sem dado confiável, NÃO inclua o ticker em "cds": o nível e a data anteriores são mantidos.
"""
import json
import re
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import common as C

ISO = r"\d{4}-\d{2}-\d{2}"


def br(iso):
    return "/".join(reversed(iso.split("-")))


def dump_data(d):
    return json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n"


def dump_snaps(doc):
    """Mantém o formato do arquivo: um objeto por snapshot, dicionários numa linha."""
    def one(o):
        return json.dumps(o, ensure_ascii=False)
    out = [' "_doc": ' + one(doc["_doc"]) + ",", ' "snapshots": [']
    items = []
    for s in doc["snapshots"]:
        body = [f'   "date": "{s["date"]}"']
        for k in ("prices", "marketCapB", "cds"):
            if k in s:
                body.append(f'   "{k}": {one(s[k])}')
        if s.get("note"):
            body.append(f'   "note": {one(s["note"])}')
        items.append("  {\n" + ",\n".join(body) + "\n  }")
    out.append(",\n".join(items))
    out.append(" ]")
    return "{\n" + "\n".join(out) + "\n}\n"


def sync_credit_note(n, levels):
    """Atualiza 'Nome ~N' / 'Nome (~N' para o nível vigente (não toca em 'era ~N')."""
    def lvl(v):
        return f"{v:,}".replace(",", ".")
    for t, v in levels.items():
        name = C.NAMES.get(t) or {"ORCL": "Oracle", "CRWV": "CoreWeave"}[t]
        n = re.sub(rf"({name} \(?)~[\d.]+", lambda m: f"{m.group(1)}~{lvl(v)}", n)
    return n


def apply(d, snaps, delta):
    if d["companies"] and "annual" in d["companies"][0]:
        raise SystemExit("data.json no formato antigo (tudo em um arquivo): migre para data.json + fundamentals.json")
    m, comps = d["meta"], d["companies"]
    trade = delta["tradeDate"]
    today = delta.get("today") or datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
    px = delta["prices"]
    missing = [t for t in C.TICKERS if t not in px]
    if missing:
        raise SystemExit(f"prices sem: {missing}")
    if trade > today:
        raise SystemExit("tradeDate no futuro")

    # market cap = preço × ações implícitas (razão cap/preço do estado atual); peso = cap ÷ total
    caps = {}
    for c in comps:
        t = c["ticker"]
        caps[t] = round(c["marketCapB"] * px[t] / c["price"])
    total = sum(caps.values())
    for c in comps:
        t = c["ticker"]
        c["price"], c["marketCapB"], c["weight"] = px[t], caps[t], round(caps[t] / total * 100, 2)
    m["totalMarketCapT"] = round(total / 1000, 3)
    m["marketSnapshot"], m["generated"] = trade, today

    # CDS: só cotações novas
    refs = {r["ticker"]: r for r in m["cdsRef"]}
    for t, q in (delta.get("cds") or {}).items():
        if t in refs:
            refs[t]["cds"] = q["bps"]
        else:
            next(c for c in comps if c["ticker"] == t)["cds"] = q["bps"]
        m["cdsAsOf"][t] = q["asOf"]
    levels = {c["ticker"]: c["cds"] for c in comps if c.get("cds") is not None}
    levels.update({t: r["cds"] for t, r in refs.items()})

    # snapshot do dia (substitui o do mesmo dia; ordem cronológica)
    snap = {"date": trade, "prices": px, "marketCapB": caps, "cds": levels}
    prev = next((x for x in snaps["snapshots"] if x["date"] == trade), {})
    if delta.get("snapshotNote") or prev.get("note"):
        snap["note"] = delta.get("snapshotNote") or prev["note"]
    snaps["snapshots"] = sorted([s for s in snaps["snapshots"] if s["date"] != trade] + [snap], key=lambda s: s["date"])

    # cdsLog com numeração automática
    if delta.get("cdsLog"):
        last = m["cdsLog"][-1]["text"] if m["cdsLog"] else ""
        k = re.match(r"(\d+)ª", last)
        n = int(k.group(1)) + 1 if k else len(m["cdsLog"]) + 1
        m["cdsLog"] = ([x for x in m["cdsLog"] if x["date"] != today] + [{"date": today, "text": f"{n}ª checagem: {delta['cdsLog']}"}])[-C.CDS_LOG_KEEP:]

    # nota de CDS: níveis vigentes + data de verificação (ou texto integral)
    if delta.get("cdsNote"):
        m["cdsNote"] = delta["cdsNote"]
    else:
        n3 = sync_credit_note(m["cdsNote"], levels)
        m["cdsNote"] = re.sub(r"\(verificado em " + r"\d{2}/\d{2}/\d{4}", f"(verificado em {br(today)[:6]}{today[:4]}", n3, count=1)

    # datas/total na nota de preços e na fonte de preços
    note = m["priceNote"]
    note = re.sub(r"fechamento de \d{2}/\d{2}/\d{4}", f"fechamento de {br(trade)}", note, count=1)
    note = re.sub(r"cap total do grupo US\$ [\d.,]+ tri", "cap total do grupo US$ " + f"{total/1000:.2f}".replace(".", ",") + " tri", note, count=1)
    note = re.sub(r"preço de \d{2}/\d{2} ×", f"preço de {br(trade)[:5]} ×", note, count=1)
    if delta.get("priceSourceShort"):
        note = re.sub(r"\(fontes: [^)]*\)", f"(fontes: {delta['priceSourceShort']})", note, count=1)
    m["priceNote"] = note
    ps = d.setdefault("priceSource", {"label": "", "url": ""})
    if delta.get("priceSource"):
        ps.update(delta["priceSource"])
    else:
        ps["label"] = re.sub(r"Preços de \d{2}/\d{2}/\d{4}", f"Preços de {br(trade)}", ps["label"], count=1)

    for k in ("dailyBrief", "audit", "catalysts"):
        if k in delta:
            m[k] = delta[k]
    if "dailyBrief" in delta and not delta["dailyBrief"].get("date"):
        m["dailyBrief"]["date"] = today
    return d, snaps


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        raise SystemExit(__doc__)
    delta = json.load(open(args[0], encoding="utf-8"))
    d, snaps = C.load("data.json"), C.load("history/snapshots.json")  # só o arquivo diário
    d, snaps = apply(d, snaps, delta)
    if "--dry-run" in sys.argv:
        print(json.dumps({"total": d["meta"]["totalMarketCapT"], "weights": {c["ticker"]: c["weight"] for c in d["companies"]},
                          "snapshot": snaps["snapshots"][-1]}, ensure_ascii=False, indent=1))
        return
    open(C.path("data.json"), "w", encoding="utf-8").write(dump_data(d))
    open(C.path("history/snapshots.json"), "w", encoding="utf-8").write(dump_snaps(snaps))
    print("data.json e history/snapshots.json atualizados. Rodando validate.py…")
    sys.exit(subprocess.run([sys.executable, C.path("src/validate.py"), "--today", d["meta"]["generated"]]).returncode)


if __name__ == "__main__":
    main()
