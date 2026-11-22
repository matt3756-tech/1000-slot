#!/usr/bin/env python3
"""Local game server. No dependencies. No browser cache."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import webbrowser,sys,threading
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT),**k)
 def end_headers(self):
  self.send_header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0')
  self.send_header('Pragma','no-cache');self.send_header('Expires','0');super().end_headers()
 def log_message(self,*args):pass
port=int(sys.argv[1]) if len(sys.argv)>1 else 8710
try:server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
except OSError:
 print('Port is in use. If the game is already running, open http://127.0.0.1:%d'%port);sys.exit(1)
url='http://127.0.0.1:%d/'%port
print('COIN 10S running at '+url+' | Ctrl+C to stop',flush=True)
if '--no-browser' not in sys.argv:threading.Timer(.3,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
