#!/usr/bin/env python3
"""Aplica a atualização diária de números (determinística) em data.json e history/snapshots.json.

Faz a parte mecânica, onde erros de conta/formatação aparecem: market cap por ações implícitas,
pesos, total do grupo, cdsAsOf, numeração do cdsLog, snapshot do dia, datas em notas/fontes e os
níveis "~N bps" de meta.creditNotes[3]. A parte analítica (briefing, auditoria, texto da nota de
crédito) continua sendo escrita/revisada por quem atualiza e vai no mesmo delta.

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
  "dailyBrief": {...}, "audit": [...], "catalysts": [...], "creditNote3": "texto completo (opcional)"
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
    """Atualiza 'Nome ~N bps' / 'Nome (~N bps)' para o nível vigente (não toca em 'era ~N')."""
    def lvl(v):
        return f"{v:,}".replace(",", ".")
    for t, v in levels.items():
        name = C.NAMES.get(t) or {"ORCL": "Oracle", "CRWV": "CoreWeave"}[t]
        n = re.sub(rf"({name} )~[\d.]+( bps)", lambda m: f"{m.group(1)}~{lvl(v)}{m.group(2)}", n)
        n = re.sub(rf"({name} \()~[\d.]+( bps\))", lambda m: f"{m.group(1)}~{lvl(v)}{m.group(2)}", n)
    return n


def apply(d, snaps, delta):
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
    if delta.get("snapshotNote"):
        snap["note"] = delta["snapshotNote"]
    snaps["snapshots"] = sorted([s for s in snaps["snapshots"] if s["date"] != trade] + [snap], key=lambda s: s["date"])

    # cdsLog com numeração automática
    if delta.get("cdsLog"):
        last = m["cdsLog"][-1]["text"] if m["cdsLog"] else ""
        k = re.match(r"(\d+)ª", last)
        n = int(k.group(1)) + 1 if k else len(m["cdsLog"]) + 1
        m["cdsLog"] = [x for x in m["cdsLog"] if x["date"] != today] + [{"date": today, "text": f"{n}ª checagem: {delta['cdsLog']}"}]

    # nota de crédito: níveis vigentes + data de verificação (ou texto integral)
    if delta.get("creditNote3"):
        m["creditNotes"][3] = delta["creditNote3"]
    else:
        n3 = sync_credit_note(m["creditNotes"][3], levels)
        m["creditNotes"][3] = re.sub(r"\(verificado em " + r"\d{2}/\d{2}/\d{4}", f"(verificado em {br(today)[:6]}{today[:4]}", n3, count=1)

    # datas/total em notas e fontes que repetem o snapshot
    notes = m["notes"]
    notes[1] = re.sub(r"fechamento de \d{2}/\d{2}/\d{4}", f"fechamento de {br(trade)}", notes[1], count=1)
    notes[1] = re.sub(r"cap total do grupo US\$ [\d.,]+ tri", "cap total do grupo US$ " + f"{total/1000:.2f}".replace(".", ",") + " tri", notes[1], count=1)
    notes[1] = re.sub(r"preço de \d{2}/\d{2} ×", f"preço de {br(trade)[:5]} ×", notes[1], count=1)
    if delta.get("priceSourceShort"):
        notes[1] = re.sub(r"\(fontes: [^)]*\)", f"(fontes: {delta['priceSourceShort']})", notes[1], count=1)
    for s in d["sources"]:
        if delta.get("priceSource") and s["label"].startswith("Preços de ") and "conferência" not in s["label"]:
            s.update(delta["priceSource"])
        elif s["label"].startswith("Preços de ") and "/2026 (" in s["label"] and "conferência" not in s["label"]:
            s["label"] = re.sub(r"Preços de \d{2}/\d{2}/\d{4}", f"Preços de {br(trade)}", s["label"], count=1)

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
    d, snaps = C.load("data.json"), C.load("history/snapshots.json")
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
