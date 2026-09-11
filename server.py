import os
import json
import time
import shutil
import hashlib
import secrets
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHARACTERS_DIR = os.path.join(BASE_DIR, "characters")
USERS_FILE = os.path.join(BASE_DIR, "users.json")

os.makedirs(CHARACTERS_DIR, exist_ok=True)

# Активные сессии в памяти: token -> username
ACTIVE_SESSIONS = {}

def hash_password(password: str, salt: bytes = None) -> tuple[str, str]:
    """Хэширование пароля через PBKDF2-HMAC-SHA256."""
    if salt is None:
        salt = secrets.token_bytes(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return salt.hex(), pwd_hash.hex()

def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return pwd_hash.hex() == hash_hex

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

class DnDHandler(SimpleHTTPRequestHandler):
    def is_local_request(self):
        """Проверка, запущен ли клиент локально на ПК/Steam Deck."""
        client_ip = self.client_address[0]
        return client_ip in ("127.0.0.1", "localhost", "::1")

    def get_authenticated_user(self):
        """Возвращает (username, role) или (None, None). В локальном режиме авторизация прозрачна."""
        if self.is_local_request():
            return "local_user", "gm"
        token = self.headers.get('X-Auth-Token')
        username = ACTIVE_SESSIONS.get(token)
        if not username:
            return None, None
        users = load_users()
        role = users.get(username, {}).get("role", "player")
        return username, role

    def get_user_char_dir(self, username):
        if self.is_local_request():
            return CHARACTERS_DIR
        user_dir = os.path.join(CHARACTERS_DIR, username)
        os.makedirs(user_dir, exist_ok=True)
        return user_dir

    def do_POST(self):
        if self.path == '/api/auth/register':
            self.handle_register()
        elif self.path == '/api/auth/login':
            self.handle_login()
        elif self.path == '/api/save-character':
            self.handle_save_character()
        elif self.path == '/api/save-all':
            self.handle_save_all()
        elif self.path == '/api/delete-character':
            self.handle_delete_character()
        elif self.path == '/api/catalog/weapon':
            self.handle_save_catalog_weapon()
        else:
            self.send_error(404, "Not Found")

    def do_GET(self):
        if self.path == '/api/characters':
            self.handle_get_characters()
        elif self.path == '/api/auth/me':
            self.handle_auth_check()
        elif self.path == '/api/catalog':
            self.handle_get_catalog()
        else:
            super().do_GET()

    # --- АВТОРИЗАЦИЯ ---
    def handle_register(self):
        length = int(self.headers.get('Content-Length', 0))
        data = json.loads(self.rfile.read(length).decode('utf-8'))
        username = data.get("username", "").strip().lower()
        password = data.get("password", "").strip()
        role = data.get("role", "player")  # "player" или "gm"

        if not username or not password:
            self.respond_json(400, {"error": "Имя пользователя и пароль обязательны"})
            return

        users = load_users()
        if username in users:
            self.respond_json(400, {"error": "Пользователь уже существует"})
            return

        salt, pwd_hash = hash_password(password)
        users[username] = {
            "salt": salt,
            "hash": pwd_hash,
            "role": "gm" if role == "gm" else "player",
            "created_at": time.time()
        }
        save_users(users)

        token = secrets.token_hex(24)
        ACTIVE_SESSIONS[token] = username
        self.respond_json(200, {"token": token, "username": username, "role": users[username]["role"]})

    def handle_login(self):
        length = int(self.headers.get('Content-Length', 0))
        data = json.loads(self.rfile.read(length).decode('utf-8'))
        username = data.get("username", "").strip().lower()
        password = data.get("password", "").strip()

        users = load_users()
        user = users.get(username)
        if not user or not verify_password(password, user["salt"], user["hash"]):
            self.respond_json(401, {"error": "Неверное имя или пароль"})
            return

        token = secrets.token_hex(24)
        ACTIVE_SESSIONS[token] = username
        self.respond_json(200, {"token": token, "username": username, "role": user.get("role", "player")})

    def handle_auth_check(self):
        username, role = self.get_authenticated_user()
        if not username:
            self.respond_json(401, {"authenticated": False})
        else:
            self.respond_json(200, {"authenticated": True, "username": username, "role": role, "is_local": self.is_local_request()})

    # --- РАБОТА С КАРТОЧКАМИ ---
    def handle_get_characters(self):
        username, role = self.get_authenticated_user()
        if not username:
            self.respond_json(401, {"error": "Требуется авторизация"})
            return

        data = []
        if self.is_local_request():
            # Локальный режим: читаем корень characters/
            self.scan_dir_for_json(CHARACTERS_DIR, data)
        elif role == "gm":
            # Мастер видит персонажей всех пользователей
            for user_folder in os.listdir(CHARACTERS_DIR):
                full_path = os.path.join(CHARACTERS_DIR, user_folder)
                if os.path.isdir(full_path):
                    self.scan_dir_for_json(full_path, data, owner=user_folder)
                elif user_folder.endswith(".json") and user_folder != "all_party.json":
                    self.read_char_file(full_path, data, owner="Общие")
        else:
            # Обычный игрок видит только свою папку
            user_dir = self.get_user_char_dir(username)
            self.scan_dir_for_json(user_dir, data, owner=username)

        self.respond_json(200, data)

    def scan_dir_for_json(self, directory, out_list, owner=None):
        if not os.path.exists(directory):
            return
        for fname in sorted(os.listdir(directory)):
            if fname.endswith(".json") and fname != "all_party.json":
                self.read_char_file(os.path.join(directory, fname), out_list, owner)

    def read_char_file(self, filepath, out_list, owner=None):
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                char = json.load(f)
                if not char.get("id"):
                    char["id"] = os.path.basename(filepath).replace(".json", "")
                if owner:
                    char["_owner"] = owner
                out_list.append(char)
        except Exception as e:
            print(f"Ошибка чтения {filepath}: {e}")

    def handle_save_character(self):
        username, role = self.get_authenticated_user()
        if not username:
            self.respond_json(401, {"error": "Unauthorized"})
            return

        length = int(self.headers.get('Content-Length', 0))
        payload = json.loads(self.rfile.read(length).decode('utf-8'))
        char_data = payload.get("data", {})
        char_id = char_data.get("id") or f"char_{int(time.time()*1000)}"
        char_data["id"] = char_id

        target_dir = self.get_user_char_dir(username)
        filename = f"{char_id}.json"
        with open(os.path.join(target_dir, filename), "w", encoding="utf-8") as f:
            json.dump(char_data, f, ensure_ascii=False, indent=2)

        self.respond_json(200, {"status": "ok", "id": char_id, "file": filename})

    def handle_save_all(self):
        username, role = self.get_authenticated_user()
        if not username:
            self.respond_json(401, {"error": "Unauthorized"})
            return

        length = int(self.headers.get('Content-Length', 0))
        chars = json.loads(self.rfile.read(length).decode('utf-8'))
        target_dir = self.get_user_char_dir(username)

        active_files = set()
        for char in chars:
            char_id = char.get("id") or f"char_{int(time.time()*1000)}"
            char["id"] = char_id
            fname = f"{char_id}.json"
            active_files.add(fname)
            with open(os.path.join(target_dir, fname), "w", encoding="utf-8") as f:
                json.dump(char, f, ensure_ascii=False, indent=2)

        for fname in os.listdir(target_dir):
            if fname.endswith(".json") and fname not in active_files:
                try:
                    os.remove(os.path.join(target_dir, fname))
                except Exception:
                    pass

        self.respond_json(200, {"status": "ok", "count": len(chars)})

    def handle_delete_character(self):
        username, role = self.get_authenticated_user()
        if not username:
            self.respond_json(401, {"error": "Unauthorized"})
            return

        length = int(self.headers.get('Content-Length', 0))
        payload = json.loads(self.rfile.read(length).decode('utf-8'))
        char_id = payload.get("id")
        target_dir = self.get_user_char_dir(username)

        if char_id:
            filepath = os.path.join(target_dir, f"{char_id}.json")
            if os.path.exists(filepath):
                os.remove(filepath)

        self.respond_json(200, {"status": "deleted"})

    def respond_json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), DnDHandler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"==================================================")
    print(f" Сервер D&D запущен: локально {url}, открыт порт {PORT}")
    print(f"==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
