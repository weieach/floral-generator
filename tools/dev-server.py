#!/usr/bin/env python3
"""Local dev server for the Floral Generator.

    python3 tools/dev-server.py [port]      (default 5178, or $PORT)

Serves the repo folder like `python3 -m http.server`, but tells the browser never to cache, so a
reload always runs the current code. While a page is open on localhost, app.js watches the source
files and reloads the page when one changes (the URL keeps the seeds, so the same flowers come back
drawn under the new rules).
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the watcher's polling out of the log
        if self.command != 'HEAD':
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('PORT', 5178))
    with http.server.ThreadingHTTPServer(('', port), NoCacheHandler) as httpd:
        print(f'Serving {ROOT} at http://localhost:{port}/ (no caching)', flush=True)
        httpd.serve_forever()
