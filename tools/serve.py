from __future__ import annotations

import argparse
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
LEGACY_SCRIPT = re.compile(r"^/src/v\d{3}[^/]*\.js$")


class GreedBitHandler(SimpleHTTPRequestHandler):
    server_version = "GreedBitDevServer/0.0.26"

    def end_headers(self) -> None:
        path = urlsplit(self.path).path.lower()
        if path.endswith((".html", ".js", ".css", ".json")) or path in ("/", ""):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if LEGACY_SCRIPT.match(path):
            body = (
                "throw new Error('GreedBit retired legacy runtime requested: "
                + path.replace("'", "\\'")
                + "');"
            ).encode("utf-8")
            self.send_response(410)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("X-GreedBit-Legacy-Runtime", path)
            self.end_headers()
            self.wfile.write(body)
            print(f"[legacy-blocked] {path}")
            return
        super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser(description="GreedBit local development server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    os.chdir(ROOT)
    server = ThreadingHTTPServer((args.host, args.port), GreedBitHandler)
    print(f"GreedBit dev server: http://{args.host}:{args.port}/")
    print(f"Root: {ROOT}")
    print("Cache policy: no-store for HTML/JS/CSS/JSON")
    print("Legacy /src/v*.js requests: blocked with HTTP 410; no automatic navigation")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
