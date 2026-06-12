const CART_KEY = 'bella_cart';

let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
let freteAtual = 0;

// Cart refs
const productsGrid  = document.getElementById('productsGrid');
const cartItems     = document.getElementById('cartItems');
const cartBadge     = document.getElementById('cartBadge');
const cartFooter    = document.getElementById('cartFooter');
const cartTotal     = document.getElementById('cartTotal');
const cartSidebar   = document.getElementById('cartSidebar');
const cartToggle    = document.getElementById('cartToggle');
const closeCart     = document.getElementById('closeCart');
const btnCheckout   = document.getElementById('btnCheckout');

// Success/failure modal refs
const modalOverlay  = document.getElementById('modalOverlay');
const modalMsg      = document.getElementById('modalMsg');
const btnModalClose = document.getElementById('btnModalClose');

// Checkout overlay refs
const checkoutOverlay = document.getElementById('checkoutOverlay');
const closeCheckout   = document.getElementById('closeCheckout');
const ckCep           = document.getElementById('ckCep');
const ckCepStatus     = document.getElementById('ckCepStatus');
const ckRua           = document.getElementById('ckRua');
const ckNumero        = document.getElementById('ckNumero');
const ckComp          = document.getElementById('ckComp');
const ckBairro        = document.getElementById('ckBairro');
const ckCidade        = document.getElementById('ckCidade');
const ckEstado        = document.getElementById('ckEstado');
const freteCard       = document.getElementById('freteCard');
const fretePrazo      = document.getElementById('fretePrazo');
const freteCardValor  = document.getElementById('freteCardValor');
const ckSubtotal      = document.getElementById('ckSubtotal');
const ckFreteRow      = document.getElementById('ckFreteRow');
const ckFreteVal      = document.getElementById('ckFreteVal');
const ckTotal         = document.getElementById('ckTotal');
const btnConfirmPay   = document.getElementById('btnConfirmPay');

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// ── Cart ──────────────────────────────────────────────────────────────────────

function addToCart(product) {
  if (product.estoque === 0) return;
  const existing = cart.find(i => i.produto_id === product.id);
  if (existing) {
    existing.quantidade += 1;
  } else {
    cart.push({ produto_id: product.id, nome: product.nome, preco: product.preco, quantidade: 1 });
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

function renderCart() {
  const totalQty = cart.reduce((sum, i) => sum + i.quantidade, 0);
  cartBadge.textContent = totalQty;

  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Seu carrinho está vazio</p>';
    cartFooter.style.display = 'none';
    return;
  }

  cartFooter.style.display = 'block';
  cartTotal.textContent = fmt(cartSubtotalValue());

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

// ── Products ──────────────────────────────────────────────────────────────────

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
    if (!resp.ok) throw new Error();
    renderProducts(await resp.json());
  } catch {
    productsGrid.innerHTML = '<p class="loading">Erro ao carregar produtos. Tente novamente.</p>';
  }
}

// ── Checkout overlay ──────────────────────────────────────────────────────────

function calcFrete(uf, cidade) {
  const SUL_SUDESTE     = ['MG','RJ','ES','PR','SC','RS'];
  const CENTRO_NORDESTE = ['GO','MT','MS','DF','MA','PI','CE','RN','PB','PE','AL','SE','BA'];
  const NORTE           = ['PA','AM','RO','AC','RR','AP','TO'];

  if (uf === 'SP' && cidade === 'São Paulo') return { valor: 12, prazo: '3 dias úteis' };
  if (uf === 'SP')                           return { valor: 18, prazo: '5 dias úteis' };
  if (SUL_SUDESTE.includes(uf))              return { valor: 22, prazo: '7 dias úteis' };
  if (CENTRO_NORDESTE.includes(uf))          return { valor: 28, prazo: '10 dias úteis' };
  if (NORTE.includes(uf))                    return { valor: 35, prazo: '12 dias úteis' };
  return { valor: 22, prazo: '7 dias úteis' };
}

function formatCep(v) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
}

function updateCheckoutSummary() {
  const sub = cartSubtotalValue();
  ckSubtotal.textContent = fmt(sub);
  if (freteAtual > 0) {
    ckFreteVal.textContent = fmt(freteAtual);
    ckFreteRow.style.display = 'flex';
  } else {
    ckFreteRow.style.display = 'none';
  }
  ckTotal.textContent = fmt(sub + freteAtual);
}

function resetAddressFields() {
  freteAtual = 0;
  freteCard.style.display = 'none';
  ckRua.value = ckBairro.value = ckCidade.value = ckEstado.value = '';
  [ckRua, ckBairro, ckCidade, ckEstado].forEach(el => { el.readOnly = true; });
  updateCheckoutSummary();
}

async function buscarCep(cepDigits) {
  ckCepStatus.innerHTML = '<span class="cep-loading">Consultando CEP...</span>';
  resetAddressFields();

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    if (!resp.ok) throw new Error();
    const data = await resp.json();

    if (data.erro) {
      ckCepStatus.innerHTML = '<span class="cep-error">CEP não encontrado — preencha os campos manualmente</span>';
      [ckRua, ckBairro, ckCidade, ckEstado].forEach(el => { el.readOnly = false; });
      return;
    }

    ckCepStatus.innerHTML = '';
    ckRua.value    = data.logradouro || '';
    ckBairro.value = data.bairro     || '';
    ckCidade.value = data.localidade || '';
    ckEstado.value = data.uf         || '';

    // Libera campos que vieram vazios para edição manual
    ckRua.readOnly    = !!data.logradouro;
    ckBairro.readOnly = !!data.bairro;
    // Cidade e estado sempre readonly quando encontrado pelo ViaCEP
    ckCidade.readOnly = true;
    ckEstado.readOnly = true;

    const frete = calcFrete(data.uf, data.localidade);
    freteAtual = frete.valor;
    fretePrazo.textContent     = frete.prazo;
    freteCardValor.textContent = fmt(frete.valor);
    freteCard.style.display    = 'block';
    updateCheckoutSummary();
  } catch {
    ckCepStatus.innerHTML = '<span class="cep-error">Erro ao consultar CEP. Verifique e tente novamente.</span>';
  }
}

function openCheckout() {
  if (cart.length === 0) return;
  ckCep.value = '';
  ckNumero.value = ckComp.value = '';
  ckCepStatus.innerHTML = '';
  resetAddressFields();
  updateCheckoutSummary();
  checkoutOverlay.style.display = 'flex';
  setTimeout(() => ckCep.focus(), 100);
}

function closeCheckoutModal() {
  checkoutOverlay.style.display = 'none';
}

async function confirmAndPay() {
  const required = [
    { el: ckCep,    label: 'CEP' },
    { el: ckRua,    label: 'Rua' },
    { el: ckNumero, label: 'Número' },
    { el: ckBairro, label: 'Bairro' },
    { el: ckCidade, label: 'Cidade' },
    { el: ckEstado, label: 'Estado' },
  ];
  for (const { el, label } of required) {
    if (!el.value.trim()) {
      el.focus();
      ckCepStatus.innerHTML = `<span class="cep-error">Preencha o campo "${label}".</span>`;
      return;
    }
  }

  const endereco = {
    cep:         ckCep.value.replace(/\D/g, ''),
    rua:         ckRua.value.trim(),
    numero:      ckNumero.value.trim(),
    complemento: ckComp.value.trim(),
    bairro:      ckBairro.value.trim(),
    cidade:      ckCidade.value.trim(),
    estado:      ckEstado.value.trim(),
  };

  btnConfirmPay.disabled = true;
  btnConfirmPay.textContent = 'Processando...';

  try {
    const resp = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens:    cart,
        total:    cartSubtotalValue() + freteAtual,
        cep:      endereco.cep,
        frete:    freteAtual,
        endereco: endereco,
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.erro || 'Erro ao criar pedido');
    cart = [];
    freteAtual = 0;
    saveCart();
    renderCart();
    closeCheckoutModal();
    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      showModal('success', `Pedido #${data.id} criado! Obrigada pela compra 💕`);
    }
  } catch (e) {
    alert('Erro ao finalizar pedido: ' + e.message);
  } finally {
    btnConfirmPay.disabled = false;
    btnConfirmPay.textContent = 'Confirmar e Pagar';
  }
}

// ── Modals ────────────────────────────────────────────────────────────────────

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
  showModal(status, messages[status] || 'Status: ' + status);
}

// ── Event listeners ───────────────────────────────────────────────────────────

ckCep.addEventListener('input', e => {
  e.target.value = formatCep(e.target.value);
  const digits = e.target.value.replace(/\D/g, '');
  if (digits.length < 8) resetAddressFields();
  if (digits.length === 8) buscarCep(digits);
});

cartToggle.addEventListener('click',   () => cartSidebar.classList.toggle('open'));
closeCart.addEventListener('click',    () => cartSidebar.classList.remove('open'));
btnCheckout.addEventListener('click',  openCheckout);
closeCheckout.addEventListener('click', closeCheckoutModal);
checkoutOverlay.addEventListener('click', e => { if (e.target === checkoutOverlay) closeCheckoutModal(); });
btnConfirmPay.addEventListener('click', confirmAndPay);
btnModalClose.addEventListener('click', () => { modalOverlay.style.display = 'none'; });

renderCart();
loadProducts();
handlePaymentReturn();
