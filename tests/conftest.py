import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# src/ não é pacote: os scripts importam `common` diretamente (ver CLAUDE.md: rodar sem -I).
sys.path.insert(0, str(ROOT / "src"))
