import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api.index import app

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('DB_PATH_OVERRIDE', str(tmp_path / 'test.db'))
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_listar_produtos_retorna_3(client):
    resp = client.get('/api/produtos')
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 3

def test_produtos_tem_campos_esperados(client):
    resp = client.get('/api/produtos')
    p = resp.get_json()[0]
    assert 'id' in p
    assert 'nome' in p
    assert 'preco' in p

def test_criar_pedido_sucesso(client):
    resp = client.post('/api/pedidos', json={
        'itens': [{'produto_id': 1, 'nome': 'Brinco Argola', 'preco': 89.90, 'quantidade': 1}],
        'total': 89.90
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert 'id' in data
    assert data['mensagem'] == 'Pedido criado com sucesso!'

def test_criar_pedido_carrinho_vazio_retorna_400(client):
    resp = client.post('/api/pedidos', json={'itens': [], 'total': 0})
    assert resp.status_code == 400
    assert 'erro' in resp.get_json()
