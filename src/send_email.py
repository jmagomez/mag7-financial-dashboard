#!/usr/bin/env python3
"""E-mail executivo diário do dashboard Magnificent 7 (SMTP/Gmail, via GitHub Actions).

Regras de envio (nesta ordem):
  1. Commit com "[skip-email]" na mensagem  -> NÃO envia (manutenção / etapas intermediárias).
  2. workflow_dispatch ou MAG7_FORCE_SEND=1 -> envia sempre (teste/reenvio manual).
  3. Trava diária: se history/email_log.json registra envio na data de hoje
     (fuso America/Sao_Paulo) -> NÃO envia. O arquivo é gravado pela rotina diária
     (commit [skip-email]) logo APÓS o commit final de data.json, pois a Action
     não tem permissão de escrita no repositório.

Conteúdo: alerta de CDS (>100 bps), briefing do dia, o que mudou desde o snapshot
anterior (preço e CDS), tabela de indicadores-chave recalculados, CDS com data da
cotação, próximos catalisadores e itens de auditoria de severidade alta.

Antes de enviar, roda src/validate.py: erro de validação BLOQUEIA o envio (exit 1).
Uso local: python src/send_email.py --dry-run   (gera preview.html, não envia)

Secrets: MAG7_SMTP_USER, MAG7_SMTP_APP_PASSWORD, MAG7_EMAIL_DEST, MAG7_EMAIL_BCC (opcional).
"""
import json
import os
import smtplib
import ssl
import sys
from datetime import datetime, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape as esc
from zoneinfo import ZoneInfo

from common import CDS_ALERT, glossary, pd5

URL = "https://jmagomez.github.io/mag7-financial-dashboard/"
REPO = "https://github.com/jmagomez/mag7-financial-dashboard"
LOG = "history/email_log.json"


def today_br():
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


def fmt(v, d=0, suf=""):
    if v is None:
        return "n/d"
    s = f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s + suf


def commit_message():
    ev = os.environ.get("GITHUB_EVENT_PATH")
    if ev and os.path.exists(ev):
        try:
            return ((json.load(open(ev, encoding="utf-8")).get("head_commit") or {}).get("message")) or ""
        except Exception:
            return ""
    return ""


def already_sent_today():
    try:
        return json.load(open(LOG, encoding="utf-8")).get("lastSent") == today_br().isoformat()
    except Exception:
        return False


def load_snapshots():
    try:
        return json.load(open("history/snapshots.json", encoding="utf-8"))["snapshots"]
    except Exception:
        return []


def last_two(snaps, key):
    s = [x for x in snaps if x.get(key)]
    return (s[-2], s[-1]) if len(s) >= 2 else (None, s[-1] if s else None)


def chg(a, b):
    return None if a in (None, 0) or b is None else (b / a - 1) * 100


def build(d, snaps):
    m, comps, der = d["meta"], d["companies"], d.get("derived", {})
    gen = m.get("generated", "")
    refs = m.get("cdsRef", [])
    asof = m.get("cdsAsOf", {})
    ref_day = today_br()

    breaches = [(c["ticker"], c["cds"]) for c in comps if c.get("cds") is not None and c["cds"] > CDS_ALERT]

    def age(t):
        dt = asof.get(t)
        if not dt:
            return None
        return (ref_day - date.fromisoformat(dt)).days

    # variações vs snapshot anterior
    p0, p1 = last_two(snaps, "prices")
    c0, c1 = last_two(snaps, "cds")
    price_rows, cds_moves = {}, []
    if p0 and p1:
        for c in comps:
            t = c["ticker"]
            price_rows[t] = chg(p0["prices"].get(t), p1["prices"].get(t))
    if c0 and c1:
        for t in list(c1["cds"]):
            a, b = c0["cds"].get(t), c1["cds"].get(t)
            if a is not None and b is not None and a != b:
                cds_moves.append((t, a, b))

    # tabela de indicadores-chave (recalculados como no front-end)
    rows = []
    for c in comps:
        t, mc = c["ticker"], c["marketCapB"]
        ttm = sum(c["niHistory"][-4:])
        pe = mc / ttm if ttm > 0 else None
        oo = der.get("oneOffTTM", {}).get(t)
        pe_core = mc / (ttm - oo) if oo is not None and (ttm - oo) > 0 else None
        fcf = der.get("fcfTTM", {}).get(t)
        fy = fcf / mc * 100 if fcf is not None else None
        b = der.get("balanceQ2_2026", {}).get(t)
        net = (b["cash"] - b["debt"]) if b else None
        rows.append((t, c["name"], c["price"], mc, pe, pe_core, fy, net, c.get("cds"), age(t),
                     pd5(c.get("cds")), price_rows.get(t)))

    def td(x, left=False, color=None):
        st = "padding:7px 8px;border-bottom:1px solid #eee;" + ("text-align:left;" if left else "text-align:right;")
        if color:
            st += f"color:{color};"
        return f'<td style="{st}">{x}</td>'

    def th(x, left=False):
        return (f'<th style="padding:7px 8px;border-bottom:2px solid #e2e8f0;background:#f1f4f9;'
                f'text-align:{"left" if left else "right"}">{x}</th>')

    tbl = ('<table style="border-collapse:collapse;width:100%;font-size:12.5px"><thead><tr>'
           + th("Empresa", True) + th("Preço") + th("Δ vs snap.") + th("Mkt cap (US$ bi)") + th("P/E TTM")
           + th("P/E core") + th("FCF yield") + th("Caixa líq. (bi)") + '</tr></thead><tbody>')
    for r in rows:
        dlt = r[11]
        col = None if dlt is None else ("#0a7d3b" if dlt >= 0 else "#b3261e")
        tbl += ("<tr>" + td(f"{esc(r[1])} <span style='color:#888'>{r[0]}</span>", True) + td(fmt(r[2], 2))
                + td("n/d" if dlt is None else fmt(dlt, 1, "%"), color=col) + td(fmt(r[3]))
                + td(fmt(r[4], 1, "x")) + td(fmt(r[5], 1, "x")) + td(fmt(r[6], 1, "%")) + td(fmt(r[7], 0)) + "</tr>")
    tbl += "</tbody></table>"

    ctbl = ('<table style="border-collapse:collapse;width:100%;font-size:12.5px"><thead><tr>'
            + th("Emissor", True) + th("CDS 5a (bps)") + th("Cotação de") + th("PD 5a impl.") + '</tr></thead><tbody>')
    for r in rows:
        a = r[9]
        stale = a is not None and a > 30
        ctbl += ("<tr>" + td(f"{esc(r[1])} <span style='color:#888'>{r[0]}</span>", True)
                 + td(fmt(r[8]) if r[8] is not None else "n/d", color="#b3261e" if (r[8] or 0) > CDS_ALERT else None)
                 + td("—" if a is None else (asof[r[0]] + (" ⚠" if stale else "")), color="#a15c00" if stale else None)
                 + td("n/d" if r[10] is None else "~" + fmt(r[10], 1, "%")) + "</tr>")
    for rf in refs:
        a = age(rf["ticker"])
        ctbl += ("<tr>" + td(f"{esc(rf['name'])} <span style='color:#888'>{rf['ticker']} (ref.)</span>", True)
                 + td(fmt(rf.get("cds"))) + td("—" if a is None else asof[rf["ticker"]]) + td("~" + fmt(pd5(rf.get("cds")), 1, "%")) + "</tr>")
    ctbl += "</tbody></table>"

    alert_html = ""
    if breaches:
        items = ", ".join(f"{t} {v:g} bps" for t, v in breaches)
        alert_html = ('<div style="background:#fdecea;border:1px solid #f5c2c0;border-radius:10px;padding:12px 16px;'
                      f'margin:0 0 16px;color:#a11;font-size:14px"><b>⚠️ ALERTA:</b> CDS acima de {CDS_ALERT} bps — {items}.</div>')

    brief = m.get("dailyBrief") or {}
    brief_html = ""
    if brief:
        lis = "".join(f"<li style='margin:0 0 6px'>{esc(b)}</li>" for b in brief.get("bullets", []))
        src = " · ".join(f"<a href='{esc(s['url'])}' style='color:#4a5bd6'>{esc(s['label'])}</a>" for s in brief.get("sources", []))
        brief_html = (f"<h3 style='margin:18px 0 6px'>Briefing de {esc(brief.get('date',''))}</h3>"
                      f"<p style='margin:0 0 8px;font-weight:600'>{esc(brief.get('headline',''))}</p>"
                      f"<ul style='margin:0 0 6px;padding-left:20px;font-size:13px'>{lis}</ul>"
                      f"<p style='font-size:11.5px;color:#777;margin:0'>Fontes: {src}</p>")

    moves_html = ""
    if cds_moves:
        moves_html = ("<h3 style='margin:18px 0 6px'>O que mudou no crédito</h3><ul style='margin:0;padding-left:20px;font-size:13px'>"
                      + "".join(f"<li>{t}: {a:g} → {b:g} bps ({b-a:+g})</li>" for t, a, b in cds_moves) + "</ul>")

    upcoming = sorted([e for e in m.get("catalysts", []) if e["date"] >= ref_day.isoformat() and not e.get("done")],
                      key=lambda e: e["date"])[:5]
    cat_html = ""
    if upcoming:
        cat_html = ("<h3 style='margin:18px 0 6px'>Próximos catalisadores</h3><ul style='margin:0;padding-left:20px;font-size:13px'>"
                    + "".join(f"<li>{e['date'][8:]}/{e['date'][5:7]} — {e['ticker']}: {esc(e['event'])}"
                              + ("" if e.get("confirmed") else " <i style='color:#a15c00'>(data não confirmada)</i>") + "</li>"
                              for e in upcoming) + "</ul>")

    high = [a for a in m.get("audit", []) if a.get("sev") == "alta"]
    aud_html = ""
    if high:
        aud_html = ("<h3 style='margin:18px 0 6px'>Ressalvas de dados (auditoria)</h3><ul style='margin:0;padding-left:20px;font-size:12.5px;color:#444'>"
                    + "".join(f"<li><b>{esc(a['area'])}:</b> {esc(a['finding'])}</li>" for a in high) + "</ul>")

    # siglas usadas no briefing (glossary.json é a fonte única, a mesma do dashboard)
    gl_html, gl_txt = "", ""
    if brief:
        import re
        blob = brief.get("headline", "") + " " + " ".join(brief.get("bullets", []))
        gl = glossary()
        used = [k for k in gl if re.search(r"(?<![A-Za-z0-9])" + re.escape(k) + r"(?![A-Za-z0-9])", blob)]
        if used:
            gl_html = ("<p style='font-size:11.5px;color:#666;margin:10px 0 0'><b>Siglas neste briefing:</b> "
                       + " · ".join(f"<b>{esc(k)}</b> — {esc(gl[k])}" for k in used) + "</p>")
            gl_txt = "\nSiglas neste briefing:\n" + "\n".join(f"- {k}: {gl[k]}" for k in used)

    html = (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;max-width:760px">'
        '<h2 style="margin:0 0 4px">Magnificent 7 — Briefing diário</h2>'
        f'<p style="color:#555;margin:0 0 14px">Dados de {esc(gen)} · preços de {esc(m.get("marketSnapshot",""))}</p>'
        + alert_html
        + f'<p style="margin:0 0 6px"><a href="{URL}" style="background:#6c7cff;color:#fff;padding:10px 18px;border-radius:10px;'
          'text-decoration:none;font-weight:600;display:inline-block">Abrir dashboard</a></p>'
        + brief_html + gl_html + moves_html
        + '<h3 style="margin:18px 0 6px">Indicadores-chave</h3>' + tbl
        + '<h3 style="margin:18px 0 6px">CDS 5 anos</h3>' + ctbl
        + cat_html + aud_html
        + '<p style="font-size:11.5px;color:#999;margin-top:18px">CDS são cotações pontuais de imprensa (dado proprietário); ⚠ = cotação com mais de 30 dias. '
          'P/E, FCF yield e caixa líquido recalculados do data.json. Conteúdo informativo, sem recomendação de investimento. '
          f'<a href="{REPO}" style="color:#999">Repositório</a></p></div>')

    lines = [f"Magnificent 7 - Briefing diário ({gen})", URL]
    if breaches:
        lines.append("ALERTA: " + ", ".join(f"{t} {v:g} bps" for t, v in breaches))
    if brief:
        lines += ["", brief.get("headline", "")] + ["- " + b for b in brief.get("bullets", [])]
    for t, a, b in cds_moves:
        lines.append(f"CDS {t}: {a:g} -> {b:g} bps")
    text = "\n".join(lines) + "\n" + gl_txt + ("\n" if gl_txt else "")

    prefix = "⚠️ ALERTA — " if breaches else ""
    head = brief.get("headline") if brief else ""
    subject = f"{prefix}Mag 7 · {gen}" + (f" — {head[:80]}" if head else "")
    return subject, text, html, bool(breaches)


def main():
    force = os.environ.get("MAG7_FORCE_SEND") == "1" or os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
    if "--dry-run" in sys.argv:
        d = json.load(open("data.json", encoding="utf-8"))
        subj, text, html, al = build(d, load_snapshots())
        print(subj + "\n\n" + text)
        open(os.environ.get("MAG7_PREVIEW", "preview.html"), "w", encoding="utf-8").write(html)
        return
    if not force and "[skip-email]" in commit_message():
        print("Commit marcado com [skip-email]: e-mail NAO enviado.")
        return
    if not force and already_sent_today():
        print("Trava diária: já houve envio hoje (America/Sao_Paulo). E-mail NAO enviado.")
        return

    # Portão de qualidade: dados inválidos bloqueiam o envio (mesmas regras do CI)
    import subprocess
    here = os.path.dirname(os.path.abspath(__file__))
    v = subprocess.run([sys.executable, os.path.join(here, "validate.py")], capture_output=True, text=True)
    print(v.stdout + v.stderr)
    if v.returncode != 0:
        print("VALIDAÇÃO FALHOU: e-mail NAO enviado. Corrija o data.json e faça novo commit.")
        sys.exit(1)

    user = os.environ["MAG7_SMTP_USER"]
    pwd = os.environ["MAG7_SMTP_APP_PASSWORD"]
    dest = [x.strip() for x in os.environ.get("MAG7_EMAIL_DEST", user).split(",") if x.strip()]
    bcc = [x.strip() for x in os.environ.get("MAG7_EMAIL_BCC", "").split(",") if x.strip()]

    d = json.load(open("data.json", encoding="utf-8"))
    subject, text, html, alerted = build(d, load_snapshots())

    msg = MIMEMultipart("alternative")
    msg["Subject"], msg["From"], msg["To"] = subject, user, ", ".join(dest)
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context()) as s:
        s.login(user, pwd)
        s.sendmail(user, dest + bcc, msg.as_string())
    print(f"E-mail enviado para {dest} | alerta: {alerted}")


if __name__ == "__main__":
    main()
