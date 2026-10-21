import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVER_BIND_HOST = os.environ.get("HOST", "0.0.0.0")
SERVER_PORT = int(os.environ.get("PORT", "8000"))
WEB_ROOT = PROJECT_ROOT / "plugins" / "web"