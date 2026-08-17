import os
import json
import time
import shutil
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHARACTERS_DIR = os.path.join(BASE_DIR, "characters")

os.makedirs(CHARACTERS_DIR, exist_ok=True)

class DnDHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/characters':
            self.handle_get_characters()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/save-character':
            self.handle_save_character()
        elif self.path == '/api/save-all':
            self.handle_save_all()
        elif self.path == '/api/delete-character':
            self.handle_delete_character()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_get_characters(self):
        data = []
        
        # 1. Если .json файлы случайно положили в корень — перемещаем их в characters/
        for fname in os.listdir(BASE_DIR):
            if fname.startswith("char_") and fname.endswith(".json"):
                src = os.path.join(BASE_DIR, fname)
                dst = os.path.join(CHARACTERS_DIR, fname)
                try:
                    shutil.move(src, dst)
                except Exception:
                    pass

        # 2. Считываем все файлы из папки characters/
        for fname in sorted(os.listdir(CHARACTERS_DIR)):
            if fname.endswith(".json") and fname != "all_party.json":
                try:
                    with open(os.path.join(CHARACTERS_DIR, fname), "r", encoding="utf-8-sig") as f:
                        char = json.load(f)
                        if "id" not in char or not char["id"]:
                            char["id"] = fname.replace(".json", "")
                        data.append(char)
                except Exception as e:
                    print(f"Ошибка чтения {fname}: {e}")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def handle_save_character(self):
        length = int(self.headers.get('Content-Length', 0))
        payload = json.loads(self.rfile.read(length).decode('utf-8'))
        
        char_data = payload.get("data", {})
        char_id = char_data.get("id") or payload.get("filename", "").replace(".json", "") or f"char_{int(time.time()*1000)}"
        char_data["id"] = char_id
        
        filename = f"{char_id}.json"
        file_path = os.path.join(CHARACTERS_DIR, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(char_data, f, ensure_ascii=False, indent=2)

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "id": char_id, "file": filename}).encode('utf-8'))

    def handle_save_all(self):
        length = int(self.headers.get('Content-Length', 0))
        chars = json.loads(self.rfile.read(length).decode('utf-8'))

        active_files = set()
        for char in chars:
            char_id = char.get("id")
            if not char_id:
                char_id = f"char_{int(time.time()*1000)}"
                char["id"] = char_id
            
            char_filename = f"{char_id}.json"
            active_files.add(char_filename)
            
            with open(os.path.join(CHARACTERS_DIR, char_filename), "w", encoding="utf-8") as f:
                json.dump(char, f, ensure_ascii=False, indent=2)

        # Удаление файлов персонажей, которых удалили в интерфейсе
        for fname in os.listdir(CHARACTERS_DIR):
            if fname.endswith(".json") and fname != "all_party.json" and fname not in active_files:
                try:
                    os.remove(os.path.join(CHARACTERS_DIR, fname))
                except Exception:
                    pass

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "count": len(chars)}).encode('utf-8'))

    def handle_delete_character(self):
        length = int(self.headers.get('Content-Length', 0))
        payload = json.loads(self.rfile.read(length).decode('utf-8'))
        char_id = payload.get("id") or payload.get("filename", "").replace(".json", "")

        if char_id:
            filename = f"{char_id}.json"
            file_path = os.path.join(CHARACTERS_DIR, filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Ошибка при удалении {filename}: {e}")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "deleted"}).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), DnDHandler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"==================================================")
    print(f" Сервер D&D успешно запущен на {url}")
    print(f" Папка карточек: {CHARACTERS_DIR}")
    print(f"==================================================")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")