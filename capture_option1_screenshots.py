"""
Capture Live Animated Wireframes Across Viewports via CDP.
"""

import http.server
import socketserver
import threading
import subprocess
import time
import json
import urllib.request
import os

PORT = 4192
CHROME_DEBUG_PORT = 9260
DIRECTORY = os.path.join(os.path.dirname(__file__), 'dist')
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
print(f"Local static server started on port {PORT}")
time.sleep(1)

captures = [
    {"filename": "animated_panoramic_3to1_guide.png", "width": 1024, "height": 341, "url": f"http://localhost:{PORT}/"},
    {"filename": "animated_panoramic_3to1_clean.png", "width": 1024, "height": 341, "url": f"http://localhost:{PORT}/?guide=0"},
    {"filename": "animated_desktop_16to9.png", "width": 1920, "height": 1080, "url": f"http://localhost:{PORT}/"},
    {"filename": "animated_tablet_4to3.png", "width": 1024, "height": 768, "url": f"http://localhost:{PORT}/"},
    {"filename": "animated_mobile.png", "width": 504, "height": 1000, "url": f"http://localhost:{PORT}/"},
    {"filename": "spatial_foundation_only.png", "width": 1024, "height": 341, "url": f"http://localhost:{PORT}/?mode=foundation"},
]

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

    for item in captures:
        filename = item["filename"]
        w = item["width"]
        h = item["height"]
        url = item["url"]
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
            // Wait for WebGL wireframe field to render multiple animation frames
            await new Promise(r => setTimeout(r, 2000));

            const metrics = await send('Runtime.evaluate', {{
                expression: `({{
                    innerW: window.innerWidth,
                    innerH: window.innerHeight,
                    stageW: document.querySelector('[data-testid="neural-stage"]')?.clientWidth,
                    stageH: document.querySelector('[data-testid="neural-stage"]')?.clientHeight,
                    modeText: document.getElementById('toggle-view-mode')?.innerText,
                    guideText: document.getElementById('toggle-spatial-guide')?.innerText
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

print("All animated wireframe screenshots captured successfully.")
