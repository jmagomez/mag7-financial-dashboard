"""Trava de e-mail gravada pelo próprio envio (Fase 4): só com MAG7_WRITE_LOG=1; formato lido por already_sent_today()."""
import json
from datetime import date

import send_email as S


def test_write_log_grava_hoje_e_a_trava_le(tmp_path, monkeypatch):
    log = tmp_path / "email_log.json"
    monkeypatch.setattr(S, "LOG", str(log))
    monkeypatch.setattr(S, "today_br", lambda: date(2026, 11, 16))
    assert S.already_sent_today() is False
    S.write_log()
    d = json.loads(log.read_text(encoding="utf-8"))
    assert d["lastSent"] == "2026-11-16" and d["note"]
    assert log.read_text(encoding="utf-8").endswith("}\n")
    assert S.already_sent_today() is True
    monkeypatch.setattr(S, "today_br", lambda: date(2026, 11, 17))
    assert S.already_sent_today() is False


def test_main_so_grava_com_a_variavel(tmp_path, monkeypatch):
    """Simula o envio com SMTP falso: sem MAG7_WRITE_LOG o arquivo não muda; com ela, é gravado."""
    log = tmp_path / "email_log.json"
    log.write_text('{"lastSent": "2026-01-01", "note": "x"}\n', encoding="utf-8")
    monkeypatch.setattr(S, "LOG", str(log))
    monkeypatch.setattr(S, "today_br", lambda: date(2026, 11, 16))

    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def login(self, *a): pass
        def sendmail(self, *a): pass

    class Ok:
        returncode, stdout, stderr = 0, "", ""

    monkeypatch.setattr(S.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr("subprocess.run", lambda *a, **k: Ok())
    monkeypatch.setenv("MAG7_SMTP_USER", "a@b.c")
    monkeypatch.setenv("MAG7_SMTP_APP_PASSWORD", "x")
    monkeypatch.setenv("MAG7_FORCE_SEND", "1")
    monkeypatch.delenv("MAG7_WRITE_LOG", raising=False)
    monkeypatch.setattr("sys.argv", ["send_email.py"])
    S.main()
    assert json.loads(log.read_text())["lastSent"] == "2026-01-01"
    monkeypatch.setenv("MAG7_WRITE_LOG", "1")
    S.main()
    assert json.loads(log.read_text())["lastSent"] == "2026-11-16"
