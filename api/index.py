import os
import sqlite3
import json

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
except ImportError:
    pass

import mercadopago
from flask import Flask, jsonify, request, send_from_directory

ROOT = os.path.dirname(os.path.dirname(__file__))

app = Flask(__name__,
            static_folder=os.path.join(ROOT, 'static'),
            static_url_path='/static')

PRODUTOS_INICIAIS = [
    {
        'nome': 'Brinco Dourado Argola',
        'descricao': 'Brinco argola banhado a ouro 18k, leve e elegante',
        'preco': 1.00,
        'imagem': '/static/images/brinco.png'
    },
    {
        'nome': 'Colar Pérolas Delicado',
        'descricao': 'Colar delicado com pérolas sintéticas, comprimento ajustável',
        'preco': 1.00,
        'imagem': '/static/images/colar.png'
    },
    {
        'nome': 'Pulseira Zircônia Cristal',
        'descricao': 'Pulseira fina com pedras de zircônia cristal brilhante',
        'preco': 1.00,
        'imagem': '/static/images/pulseira.png'
    }
]

def _db_path():
    override = os.environ.get('DB_PATH_OVERRIDE')
    if override:
        return override
    if os.environ.get('VERCEL'):
        return '/tmp/loja.db'
    return os.path.join(ROOT, 'loja.db')

def get_db():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL,
        imagem TEXT,
        estoque INTEGER NOT NULL DEFAULT 10
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itens TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pendente',
        mp_preference_id TEXT,
        mp_payment_id TEXT,
        cep TEXT,
        frete REAL DEFAULT 0,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    for col_def in [
        "status TEXT DEFAULT 'pendente'",
        "mp_preference_id TEXT",
        "mp_payment_id TEXT",
        "cep TEXT",
        "frete REAL DEFAULT 0",
    ]:
        try:
            cur.execute(f'ALTER TABLE pedidos ADD COLUMN {col_def}')
        except sqlite3.OperationalError:
            pass

    try:
        cur.execute('ALTER TABLE produtos ADD COLUMN estoque INTEGER NOT NULL DEFAULT 10')
    except sqlite3.OperationalError:
        pass

    if cur.execute('SELECT COUNT(*) FROM produtos').fetchone()[0] == 0:
        for p in PRODUTOS_INICIAIS:
            cur.execute(
                'INSERT INTO produtos (nome, descricao, preco, imagem) VALUES (?,?,?,?)',
                (p['nome'], p['descricao'], p['preco'], p['imagem'])
            )
    for p in PRODUTOS_INICIAIS:
        cur.execute('UPDATE produtos SET preco = ?, imagem = ? WHERE nome = ?',
                    (p['preco'], p['imagem'], p['nome']))

    conn.commit()
    conn.close()

@app.before_request
def setup():
    init_db()

@app.route('/api/produtos', methods=['GET'])
def listar_produtos():
    conn = get_db()
    rows = conn.execute('SELECT * FROM produtos').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/pedidos', methods=['POST'])
def criar_pedido():
    data = request.get_json(silent=True) or {}
    itens = data.get('itens', [])
    total = data.get('total', 0)
    cep = data.get('cep', '')
    frete = float(data.get('frete', 0))

    if not itens:
        return jsonify({'erro': 'Carrinho vazio'}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO pedidos (itens, total, status, cep, frete) VALUES (?,?,'pendente',?,?)",
        (json.dumps(itens), total, cep, frete)
    )
    pedido_id = cur.lastrowid
    conn.commit()
    conn.close()

    access_token = os.environ.get('MP_ACCESS_TOKEN', '')
    if not access_token:
        return jsonify({'id': pedido_id, 'mensagem': 'Pedido criado (sem MP configurado)'}), 201

    if os.environ.get('VERCEL'):
        base_url = 'https://loja-teste-rose.vercel.app'
    else:
        base_url = request.host_url.rstrip('/')
    sdk = mercadopago.SDK(access_token)

    is_local = 'localhost' in base_url or '127.0.0.1' in base_url

    mp_items = [
        {
            "title": item.get('nome', 'Produto'),
            "quantity": int(item.get('quantidade', 1)),
            "unit_price": float(item.get('preco', 0)),
            "currency_id": "BRL"
        }
        for item in itens
    ]
    if frete > 0:
        mp_items.append({
            "title": "Frete",
            "quantity": 1,
            "unit_price": frete,
            "currency_id": "BRL"
        })

    preference_data = {
        "items": mp_items,
        "back_urls": {
            "success": f"{base_url}/?payment=success",
            "failure": f"{base_url}/?payment=failure",
            "pending": f"{base_url}/?payment=pending"
        },
        "external_reference": str(pedido_id)
    }

    if not is_local:
        preference_data["auto_return"] = "approved"
        preference_data["notification_url"] = f"{base_url}/api/webhook"

    pref_response = sdk.preference().create(preference_data)
    status_code = pref_response.get("status")
    pref = pref_response.get("response", {})
    init_point = pref.get("init_point", "")
    mp_preference_id = pref.get("id", "")

    if not init_point:
        import sys
        print(f"[MP ERROR] status={status_code} response={pref}", file=sys.stderr)
        return jsonify({'erro': f'Mercado Pago recusou a preferência (status {status_code}): {pref}'}), 502

    conn = get_db()
    conn.execute(
        'UPDATE pedidos SET mp_preference_id = ? WHERE id = ?',
        (mp_preference_id, pedido_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        'id': pedido_id,
        'init_point': init_point,
        'mensagem': 'Pedido criado com sucesso!'
    }), 201

@app.route('/api/debug-token', methods=['GET'])
def debug_token():
    token = os.environ.get('MP_ACCESS_TOKEN', '')
    return jsonify({
        'token_set': bool(token),
        'token_preview': token[:20] + '...' if len(token) > 20 else token,
        'token_length': len(token)
    })

@app.route('/api/webhook', methods=['POST'])
def webhook():
    data = request.get_json(silent=True) or {}
    topic = data.get('type') or request.args.get('topic', '')

    if topic == 'payment':
        payment_id = (data.get('data') or {}).get('id') or request.args.get('id')
        if payment_id:
            sdk = mercadopago.SDK(os.environ.get('MP_ACCESS_TOKEN', ''))
            payment_info = sdk.payment().get(payment_id)
            payment = payment_info.get('response', {})
            status = payment.get('status', 'pendente')
            external_ref = payment.get('external_reference')
            if external_ref:
                conn = get_db()
                if status == 'approved':
                    pedido = conn.execute(
                        'SELECT itens FROM pedidos WHERE id = ?',
                        (int(external_ref),)
                    ).fetchone()
                    if pedido:
                        for item in json.loads(pedido['itens']):
                            pid = item.get('produto_id')
                            qty = int(item.get('quantidade', 1))
                            if pid:
                                conn.execute(
                                    'UPDATE produtos SET estoque = MAX(0, estoque - ?) WHERE id = ?',
                                    (qty, pid)
                                )
                conn.execute(
                    'UPDATE pedidos SET status = ?, mp_payment_id = ? WHERE id = ?',
                    (status, str(payment_id), int(external_ref))
                )
                conn.commit()
                conn.close()

    return jsonify({'ok': True}), 200

@app.route('/')
def index():
    return send_from_directory(ROOT, 'index.html')

# Vercel entry point
handler = app

if __name__ == '__main__':
    app.run(debug=True, port=5000)
