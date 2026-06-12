const CART_KEY = 'bella_cart';

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let freteAtual = 0;
let cepAtual = '';

const productsGrid  = document.getElementById('productsGrid');
const cartItems     = document.getElementById('cartItems');
const cartBadge     = document.getElementById('cartBadge');
const cartFooter    = document.getElementById('cartFooter');
const cartSubtotal  = document.getElementById('cartSubtotal');
const cartTotal     = document.getElementById('cartTotal');
const freteRow      = document.getElementById('freteRow');
const freteValor    = document.getElementById('freteValor');
const prazoText     = document.getElementById('prazoText');
const cartSidebar   = document.getElementById('cartSidebar');
const cartToggle    = document.getElementById('cartToggle');
const closeCart     = document.getElementById('closeCart');
const btnCheckout   = document.getElementById('btnCheckout');
const modalOverlay  = document.getElementById('modalOverlay');
const modalMsg      = document.getElementById('modalMsg');
const btnModalClose = document.getElementById('btnModalClose');
const cepInput      = document.getElementById('cepInput');
const cepInfo       = document.getElementById('cepInfo');

function fmt(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(product) {
  if (product.estoque === 0) return;
  const existing = cart.find(i => i.produto_id === product.id);
  if (existing) {
    existing.quantidade += 1;
  } else {
    cart.push({
      produto_id: product.id,
      nome: product.nome,
      preco: product.preco,
      quantidade: 1
    });
  }
  saveCart();
  renderCart();
}

function changeQty(produto_id, delta) {
  const item = cart.find(i => i.produto_id === produto_id);
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) cart = cart.filter(i => i.produto_id !== produto_id);
  saveCart();
  renderCart();
}

function cartSubtotalValue() {
  return cart.reduce((sum, i) => sum + i.preco * i.quantidade, 0);
}

function cartTotalValue() {
  return cartSubtotalValue() + freteAtual;
}

function renderCart() {
  const totalQty = cart.reduce((sum, i) => sum + i.quantidade, 0);
  cartBadge.textContent = totalQty;

  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Seu carrinho está vazio</p>';
    cartFooter.style.display = 'none';
    return;
  }

  cartFooter.style.display = 'block';
  const sub = cartSubtotalValue();
  cartSubtotal.textContent = fmt(sub);
  cartTotal.textContent = fmt(sub + freteAtual);

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nome}</div>
        <div class="cart-item-price">${fmt(item.preco)}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="changeQty(${item.produto_id}, -1)">&#8722;</button>
        <span class="qty-num">${item.quantidade}</span>
        <button class="qty-btn" onclick="changeQty(${item.produto_id}, +1)">+</button>
      </div>
    </div>
  `).join('');
}

function calcFrete(uf, cidade) {
  const SUL_SUDESTE    = ['MG','RJ','ES','PR','SC','RS'];
  const CENTRO_NORDESTE = ['GO','MT','MS','DF','MA','PI','CE','RN','PB','PE','AL','SE','BA'];
  const NORTE          = ['PA','AM','RO','AC','RR','AP','TO'];

  if (uf === 'SP' && cidade === 'São Paulo') return { valor: 12, prazo: 3 };
  if (uf === 'SP')                           return { valor: 18, prazo: 3 };
  if (SUL_SUDESTE.includes(uf))              return { valor: 22, prazo: 7 };
  if (CENTRO_NORDESTE.includes(uf))          return { valor: 28, prazo: 7 };
  if (NORTE.includes(uf))                    return { valor: 35, prazo: 7 };
  return { valor: 22, prazo: 7 };
}

function formatCep(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
}

async function buscarCep(cepDigits) {
  if (cepDigits.length !== 8) return;
  cepInfo.innerHTML = '<span class="cep-loading">Consultando CEP...</span>';
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    if (data.erro) {
      cepInfo.innerHTML = '<span class="cep-error">CEP não encontrado</span>';
      freteAtual = 0;
      cepAtual = '';
      freteRow.style.display = 'none';
      renderCart();
      return;
    }
    const frete = calcFrete(data.uf, data.localidade);
    freteAtual = frete.valor;
    cepAtual = cepDigits;
    cepInfo.innerHTML = `<span class="cep-location">&#128205; ${data.localidade} — ${data.uf}</span>`;
    freteValor.textContent = fmt(frete.valor);
    prazoText.textContent = `(${frete.prazo} dias úteis)`;
    freteRow.style.display = 'flex';
    renderCart();
  } catch {
    cepInfo.innerHTML = '<span class="cep-error">Erro ao consultar CEP. Tente novamente.</span>';
  }
}

function renderProducts(products) {
  productsGrid.innerHTML = products.map(p => {
    const esgotado = p.estoque === 0;
    const baixo    = p.estoque > 0 && p.estoque < 3;

    let estoqueHtml;
    if (esgotado) {
      estoqueHtml = '<div class="estoque esgotado">Esgotado</div>';
    } else if (baixo) {
      estoqueHtml = `<div class="estoque baixo">&#9888; Últimas ${p.estoque} unidades!</div>`;
    } else {
      estoqueHtml = `<div class="estoque ok">${p.estoque} em estoque</div>`;
    }

    return `
    <div class="product-card">
      <div class="product-image">
        <img src="${p.imagem}" alt="${p.nome}" onerror="this.parentElement.textContent='&#128142;'">
      </div>
      <div class="product-info">
        <div class="product-name">${p.nome}</div>
        <div class="product-desc">${p.descricao}</div>
        <div class="product-price">${fmt(p.preco)}</div>
        ${estoqueHtml}
        <button class="btn-add" onclick='addToCart(${JSON.stringify(p)})' ${esgotado ? 'disabled' : ''}>
          ${esgotado ? 'Esgotado' : 'Adicionar ao Carrinho'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function loadProducts() {
  try {
    const resp = await fetch('/api/produtos');
    if (!resp.ok) throw new Error('Erro ao carregar produtos');
    const products = await resp.json();
    renderProducts(products);
  } catch (e) {
    productsGrid.innerHTML = '<p class="loading">Erro ao carregar produtos. Tente novamente.</p>';
  }
}

async function checkout() {
  if (cart.length === 0) return;
  if (!cepAtual) {
    cepInput.focus();
    cepInfo.innerHTML = '<span class="cep-error">Informe seu CEP para calcular o frete.</span>';
    return;
  }
  btnCheckout.disabled = true;
  btnCheckout.textContent = 'Processando...';
  try {
    const resp = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: cart,
        total: cartTotalValue(),
        cep: cepAtual,
        frete: freteAtual
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.erro || 'Erro ao criar pedido');
    cart = [];
    freteAtual = 0;
    cepAtual = '';
    saveCart();
    renderCart();
    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      showModal('success', `Pedido #${data.id} criado! Obrigada pela compra 💕`);
    }
  } catch (e) {
    alert('Erro ao finalizar pedido: ' + e.message);
  } finally {
    btnCheckout.disabled = false;
    btnCheckout.textContent = 'Finalizar Pedido';
  }
}

function showModal(type, msg) {
  const icons = { success: '✓', failure: '✕', pending: '⏳' };
  document.querySelector('.modal-icon').textContent = icons[type] || '✓';
  modalMsg.textContent = msg;
  modalOverlay.style.display = 'flex';
}

function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment');
  if (!status) return;
  history.replaceState({}, '', '/');
  const messages = {
    success: 'Pagamento aprovado! Obrigada pela compra 💕',
    failure: 'Pagamento não aprovado. Tente novamente.',
    pending: 'Pagamento pendente. Você receberá uma confirmação em breve.'
  };
  showModal(status, messages[status] || 'Status de pagamento: ' + status);
}

cepInput.addEventListener('input', e => {
  e.target.value = formatCep(e.target.value);
  const digits = e.target.value.replace(/\D/g, '');
  if (digits.length === 8) buscarCep(digits);
});

cartToggle.addEventListener('click', () => cartSidebar.classList.toggle('open'));
closeCart.addEventListener('click',  () => cartSidebar.classList.remove('open'));
btnCheckout.addEventListener('click', checkout);
btnModalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; });

renderCart();
loadProducts();
handlePaymentReturn();
