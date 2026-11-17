import subprocess
import time
import os
from PIL import Image

server = subprocess.Popen(["npx.cmd", "vite", "--port", "5199"], shell=True)
time.sleep(3)
chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
res = subprocess.run([
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1024,341",
    "--screenshot=dev_screenshot.png",
    "--dump-dom",
    "http://localhost:5199/"
], capture_output=True, text=True)

print("DOM length:", len(res.stdout))
if 'id="root"' in res.stdout:
    idx = res.stdout.index('id="root"')
    print("DOM snippet:\n", res.stdout[idx:idx+600])

if os.path.exists("dev_screenshot.png"):
    img = Image.open("dev_screenshot.png")
    print("dev_screenshot.png size:", img.size, "extrema:", img.getextrema())

subprocess.run(["taskkill", "/F", "/T", "/PID", str(server.pid)], capture_output=True)
