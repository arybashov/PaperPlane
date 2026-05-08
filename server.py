#!/usr/bin/env python3
"""
Простой HTTP-сервер для PaperPlane.
Запускает локальный сервер и открывает браузер автоматически.
"""

import http.server
import socketserver
import webbrowser
import os
import threading
import time

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Отключаем кэш для удобства разработки
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def open_browser():
    time.sleep(0.5)
    url = f"http://localhost:{PORT}"
    print(f"Открываем {url} ...")
    webbrowser.open(url)

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n🛩️  PaperPlane сервер запущен на http://localhost:{PORT}")
        print("Нажмите Ctrl+C для остановки\n")
        
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер остановлен.")
