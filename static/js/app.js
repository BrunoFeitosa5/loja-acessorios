const CART_KEY = 'bella_cart';

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

const productsGrid  = document.getElementById('productsGrid');
const cartItems     = document.getElementById('cartItems');
const cartBadge     = document.getElementById('cartBadge');
const cartFooter    = document.getElementById('cartFooter');
const cartTotal     = document.getElementById('cartTotal');
const cartSidebar   = document.getElementById('cartSidebar');
const cartToggle    = document.getElementById('cartToggle');
const closeCart     = document.getElementById('closeCart');
const btnCheckout   = document.getElementById('btnCheckout');
const modalOverlay  = document.getElementById('modalOverlay');
const modalMsg      = document.getElementById('modalMsg');
const btnModalClose = document.getElementById('btnModalClose');

function fmt(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(product) {
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

function cartTotalValue() {
  return cart.reduce((sum, i) => sum + i.preco * i.quantidade, 0);
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
  cartTotal.textContent = fmt(cartTotalValue());

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

function renderProducts(products) {
  productsGrid.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-image">
        <img src="${p.imagem}" alt="${p.nome}" onerror="this.parentElement.textContent='&#128142;'">
      </div>
      <div class="product-info">
        <div class="product-name">${p.nome}</div>
        <div class="product-desc">${p.descricao}</div>
        <div class="product-price">${fmt(p.preco)}</div>
        <button class="btn-add" onclick='addToCart(${JSON.stringify(p)})'>
          Adicionar ao Carrinho
        </button>
      </div>
    </div>
  `).join('');
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
  btnCheckout.disabled = true;
  btnCheckout.textContent = 'Processando...';
  try {
    const resp = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens: cart, total: cartTotalValue() })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.erro || 'Erro ao criar pedido');
    cart = [];
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

cartToggle.addEventListener('click', () => cartSidebar.classList.toggle('open'));
closeCart.addEventListener('click',  () => cartSidebar.classList.remove('open'));
btnCheckout.addEventListener('click', checkout);
btnModalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; });

renderCart();
loadProducts();
handlePaymentReturn();
