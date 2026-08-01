#!/usr/bin/env python3
"""Envia o e-mail do dashboard Magnificent 7 via SMTP (Gmail).
Le data.json, monta o resumo de CDS (com alerta se algum das 7 > 100 bps)
e envia. Roda no GitHub Actions -- nao precisa de navegador aberto.

Secrets esperados (repo Settings -> Secrets and variables -> Actions):
  MAG7_SMTP_USER          -> endereco Gmail remetente (ex.: seuemail@gmail.com)
  MAG7_SMTP_APP_PASSWORD  -> senha de app do Gmail (16 caracteres)
  MAG7_EMAIL_DEST         -> destinatario(s), separados por virgula
  MAG7_EMAIL_BCC          -> (opcional) copia oculta
"""
import os
import json
import ssl
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

URL = "https://jmagomez.github.io/mag7-financial-dashboard/"
REPO = "https://github.com/jmagomez/mag7-financial-dashboard"


def fmt(v):
    return "n/d" if v is None else f"{v:g}"


def main():
    user = os.environ["MAG7_SMTP_USER"]
    pwd = os.environ["MAG7_SMTP_APP_PASSWORD"]
    dest = [x.strip() for x in os.environ.get("MAG7_EMAIL_DEST", user).split(",") if x.strip()]
    bcc = [x.strip() for x in os.environ.get("MAG7_EMAIL_BCC", "").split(",") if x.strip()]

    with open("data.json", encoding="utf-8") as f:
        d = json.load(f)
    gen = d["meta"].get("generated", "")
    comps = d["companies"]
    ref = d["meta"].get("cdsRef", [])

    breaches = [(c["ticker"], c["cds"]) for c in comps
                if c.get("cds") is not None and c["cds"] > 100]
    alert_html = ""
    prefix = ""
    if breaches:
        prefix = "⚠️ ALERTA — "
        items = ", ".join(f"{t} {v:g} bps" for t, v in breaches)
        alert_html = (
            '<div style="background:#fdecea;border:1px solid #f5c2c0;border-radius:10px;'
            'padding:12px 16px;margin:0 0 16px;color:#a11;font-size:14px">'
            f'<b>⚠️ ALERTA:</b> CDS acima de 100 bps — {items}.</div>'
        )

    def row(name, ticker, cds):
        return (
            '<tr style="text-align:right"><td style="text-align:left;padding:8px;'
            f'border-bottom:1px solid #eee">{name} <span style="color:#888">{ticker}</span></td>'
            f'<td style="padding:8px;border-bottom:1px solid #eee">{fmt(cds)}</td></tr>'
        )

    rows = "".join(row(c["name"], c["ticker"], c.get("cds")) for c in comps)
    rows += "".join(row(r["name"], r["ticker"] + " (ref.)", r.get("cds")) for r in ref)

    html = (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;max-width:720px">'
        '<h2 style="margin:0 0 6px">Magnificent 7 — Dashboard (CDS / credito)</h2>'
        f'<p style="color:#555;margin:0 0 14px">Atualizado em {gen}</p>'
        f'{alert_html}'
        f'<p style="margin:0 0 16px"><a href="{URL}" style="background:#6c7cff;color:#fff;'
        'padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">'
        'Abrir dashboard</a></p>'
        '<h3 style="margin:14px 0 8px">CDS 5 anos (bps)</h3>'
        '<table style="border-collapse:collapse;width:100%;font-size:13px">'
        '<thead><tr style="background:#f1f4f9;text-align:right">'
        '<th style="text-align:left;padding:8px;border-bottom:2px solid #e2e8f0">Empresa</th>'
        '<th style="padding:8px;border-bottom:2px solid #e2e8f0">CDS 5a</th></tr></thead>'
        f'<tbody>{rows}</tbody></table>'
        '<p style="font-size:12px;color:#999;margin-top:16px">CDS sao cotacoes pontuais de '
        'imprensa (dado proprietario). Conteudo informativo, sem recomendacao de investimento. '
        f'Repositorio: {REPO}</p></div>'
    )

    text = f"Magnificent 7 - Dashboard\nAtualizado em {gen}\n{URL}\n"
    if breaches:
        text += "ALERTA: " + ", ".join(f"{t} {v:g} bps" for t, v in breaches) + "\n"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{prefix}Magnificent 7 — Dashboard ({gen})"
    msg["From"] = user
    msg["To"] = ", ".join(dest)
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(user, pwd)
        s.sendmail(user, dest + bcc, msg.as_string())
    print(f"E-mail enviado para {dest} | alerta: {bool(breaches)}")


if __name__ == "__main__":
    main()
