"""
Automated Multi-Viewport Screenshot Capture Suite
Uses Chrome DevTools Protocol (CDP) to guarantee exact 1:1 viewport dimensions
(preventing Windows window-frame clipping from distorting headless viewports).
"""

import http.server
import socketserver
import threading
import subprocess
import time
import json
import urllib.request
import os

PORT = 4182
CHROME_DEBUG_PORT = 9255
DIRECTORY = os.path.join(os.path.dirname(__file__), 'dist')
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass  # suppress request logs

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
print(f"Local static server started on port {PORT}")
time.sleep(1)

viewports = [
    {"filename": "phase1_panoramic_3to1_clean.png", "width": 1024, "height": 341, "url": f"http://localhost:{PORT}/?clean=1"},
    {"filename": "current_preview.png", "width": 1024, "height": 341, "url": f"http://localhost:{PORT}/?clean=1"},
    {"filename": "phase1_panoramic_3to1_guide.png", "width": 1024, "height": 341, "url": f"http://localhost:{PORT}/"},
    {"filename": "phase1_desktop_16to9_guide.png", "width": 1920, "height": 1080, "url": f"http://localhost:{PORT}/"},
    {"filename": "phase1_tablet_4to3_guide.png", "width": 1024, "height": 768, "url": f"http://localhost:{PORT}/"},
    {"filename": "phase1_mobile_guide.png", "width": 504, "height": 1000, "url": f"http://localhost:{PORT}/"},
]

# Launch Headless Chrome with Remote Debugging
chrome_proc = subprocess.Popen([
    CHROME,
    "--headless=new",
    "--disable-gpu",
    f"--remote-debugging-port={CHROME_DEBUG_PORT}",
    "about:blank"
])
time.sleep(1.5)

try:
    tabs_res = urllib.request.urlopen(f"http://127.0.0.1:{CHROME_DEBUG_PORT}/json").read()
    tabs = json.loads(tabs_res)
    ws_url = tabs[0]["webSocketDebuggerUrl"]

    for vp in viewports:
        filename = vp["filename"]
        w = vp["width"]
        h = vp["height"]
        url = vp["url"]
        outpath = os.path.join(os.path.dirname(__file__), filename).replace("\\", "/")

        node_script = f"""
        import fs from 'fs';
        const ws = new WebSocket('{ws_url}');
        let id = 1;
        function send(method, params = {{}}) {{
            return new Promise((resolve, reject) => {{
                const cur = ++id;
                function handler(e) {{
                    const d = JSON.parse(e.data);
                    if (d.id === cur) {{
                        ws.removeEventListener('message', handler);
                        if (d.error) reject(d.error);
                        else resolve(d.result);
                    }}
                }}
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({{ id: cur, method, params }}));
            }});
        }}

        ws.onopen = async () => {{
            await send('Page.enable');
            await send('Runtime.enable');
            await send('Emulation.setDeviceMetricsOverride', {{
                width: {w},
                height: {h},
                deviceScaleFactor: 1,
                mobile: false
            }});
            await send('Page.navigate', {{ url: '{url}' }});
            await new Promise(r => setTimeout(r, 1200));

            const metrics = await send('Runtime.evaluate', {{
                expression: `({{
                    innerW: window.innerWidth,
                    innerH: window.innerHeight,
                    stageW: document.querySelector('[data-testid="neural-stage"]')?.clientWidth,
                    stageH: document.querySelector('[data-testid="neural-stage"]')?.clientHeight
                }})`,
                returnByValue: true
            }});

            const snap = await send('Page.captureScreenshot', {{ format: 'png' }});
            fs.writeFileSync('{outpath}', Buffer.from(snap.data, 'base64'));
            console.log(JSON.stringify({{
                filename: '{filename}',
                size: {w} + 'x' + {h},
                domMetrics: metrics.result.value,
                bytes: fs.statSync('{outpath}').size
            }}));
            ws.close();
            process.exit(0);
        }};
        """
        res = subprocess.run(["node", "--input-type=module", "-e", node_script], capture_output=True, text=True)
        if res.stdout.strip():
            print(f"Captured {filename}: {res.stdout.strip()}")
        if res.stderr.strip():
            print(f"Error capturing {filename}: {res.stderr.strip()}")

finally:
    chrome_proc.kill()

print("All screenshots captured successfully via CDP.")
