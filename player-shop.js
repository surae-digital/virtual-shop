(async()=>{
  const A=window.SuraeStore,C=window.SuraeCatalog,Cart=window.SuraeCart,API=window.SuraeAPI,P=window.SuraeProofs;
  if(!A||!C||!Cart||!API||!P)return;
  await Promise.all([A.ready,C.ready]);
  let user=A.getCurrentUser();
  if(!user)return;

  const money=n=>Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labelGame=g=>({MLBB:'MOBILE LEGENDS',CODM:'CALL OF DUTY MOBILE',VALORANT:'VALORANT',HOK:'HONOR OF KINGS',ROBLOX:'ROBLOX'}[g]||g||'GAME');
  const randomRequestId=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')};
  const ATTEMPT_KEY='surae_player_checkout_attempt_v1';
  function requestIdFor(fingerprint){try{const prev=JSON.parse(sessionStorage.getItem(ATTEMPT_KEY)||'null');if(prev?.fingerprint===fingerprint&&/^[a-f0-9]{64}$/i.test(prev.requestId||''))return prev.requestId}catch{}const requestId=randomRequestId();try{sessionStorage.setItem(ATTEMPT_KEY,JSON.stringify({fingerprint,requestId}))}catch{}return requestId}
  function clearAttempt(){try{sessionStorage.removeItem(ATTEMPT_KEY)}catch{}}

  const grid=document.getElementById('playerProductGrid'),noProducts=document.getElementById('playerNoProducts');
  const cartModal=document.getElementById('playerCartModal'),cartItems=document.getElementById('playerCartItems'),cartEmpty=document.getElementById('playerCartEmpty');
  const count=document.getElementById('playerCartCount'),totalEl=document.getElementById('playerCartTotal');
  let filter='ALL',payment='';

  function availableProducts(){return C.getCatalog().filter(p=>p.active!==false&&Number(p.price)>0&&String(p.stockStatus||'Available').toLowerCase()!=='out of stock')}
  function renderProducts(){
    const settings=C.getSettings();
    if(settings.storeOnline===false){grid.innerHTML='<div class="player-shop-offline">STORE IS TEMPORARILY OFFLINE.</div>';noProducts.hidden=true;return}
    const products=availableProducts().filter(p=>filter==='ALL'||p.game===filter);
    grid.innerHTML=products.map(p=>`<article class="player-product-card"><div class="player-product-meta"><span>${esc(labelGame(p.game))}</span><small>${esc(p.region||'GLOBAL')}${p.catalogType==='skin-gifting'?' • SKIN GIFTING':''}</small></div><h3>${esc(p.name)}</h3><p>${esc(p.description||'Digital product')}</p><div class="player-product-footer"><strong>₱${money(p.price)}</strong><button type="button" data-player-add="${esc(p.id)}">＋ ADD TO CART</button></div></article>`).join('');
    noProducts.hidden=!!products.length;
    grid.querySelectorAll('[data-player-add]').forEach(btn=>btn.onclick=()=>{Cart.add(btn.dataset.playerAdd,1);const original=btn.textContent;btn.textContent='✓ ADDED';btn.classList.add('added');renderCart();setTimeout(()=>{btn.textContent=original;btn.classList.remove('added')},900)});
  }

  function cartLines(){const products=C.getCatalog();return Cart.getItems().map(ci=>{const p=products.find(x=>x.id===ci.productId&&x.active!==false);return p&&Number(p.price)>0?{...ci,p,subtotal:Number(p.price)*ci.qty}:null}).filter(Boolean)}
  function cartTotal(){return cartLines().reduce((s,x)=>s+x.subtotal,0)}
  function renderCart(){
    const lines=cartLines();
    count.textContent=String(lines.reduce((s,x)=>s+x.qty,0));
    totalEl.textContent='₱'+money(cartTotal());
    cartItems.innerHTML=lines.map(x=>`<div class="player-cart-line"><div><small>${esc(labelGame(x.p.game))} • ${esc(x.p.region||'GLOBAL')}</small><h3>${esc(x.p.name)}</h3><span>₱${money(x.p.price)} each</span></div><div class="player-cart-line-actions"><input type="number" min="1" max="99" value="${x.qty}" data-player-qty="${esc(x.p.id)}"><strong>₱${money(x.subtotal)}</strong><button type="button" data-player-remove="${esc(x.p.id)}">REMOVE</button></div></div>`).join('');
    cartEmpty.style.display=lines.length?'none':'block';
    cartItems.querySelectorAll('[data-player-qty]').forEach(i=>i.onchange=()=>{Cart.setQty(i.dataset.playerQty,Math.max(1,Math.min(99,Number(i.value)||1)));renderCart()});
    cartItems.querySelectorAll('[data-player-remove]').forEach(b=>b.onclick=()=>{Cart.remove(b.dataset.playerRemove);renderCart()});
  }

  function openCart(){renderCart();cartModal.classList.add('open');cartModal.setAttribute('aria-hidden','false')}
  function closeCart(){cartModal.classList.remove('open');cartModal.setAttribute('aria-hidden','true')}
  document.getElementById('openPlayerCart').onclick=openCart;
  document.querySelectorAll('[data-close-player-cart]').forEach(x=>x.onclick=closeCart);

  document.querySelectorAll('[data-shop-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.shopFilter;document.querySelectorAll('[data-shop-filter]').forEach(x=>x.classList.toggle('active',x===btn));renderProducts()});
  document.querySelectorAll('[data-player-game]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.playerGame;document.querySelectorAll('[data-shop-filter]').forEach(x=>x.classList.toggle('active',x.dataset.shopFilter===filter));renderProducts();document.getElementById('shop').scrollIntoView({behavior:'smooth',block:'start'})});

  const settings=C.getSettings(),methods=[];
  if(settings.allowBank!==false)methods.push('Bank');if(settings.allowGCash!==false)methods.push('GCash');if(settings.allowPayMaya!==false)methods.push('PayMaya');if(settings.allowWallet!==false)methods.push('Surae Credits');
  const paymentHost=document.getElementById('playerPaymentOptions');
  paymentHost.innerHTML=methods.map(m=>`<label class="player-payment-option"><input type="radio" name="playerPaymentMethod" value="${esc(m)}"><span>${esc(m)}</span></label>`).join('');
  paymentHost.onchange=e=>{if(e.target.name==='playerPaymentMethod'){payment=e.target.value;updatePaymentUI()}};
  function updatePaymentUI(){const wallet=payment==='Surae Credits';document.getElementById('playerExternalPaymentFields').hidden=wallet;document.getElementById('playerWalletCheckout').hidden=!wallet;document.getElementById('playerCheckoutWalletBalance').textContent='₱'+money(user?.credits||0);const msg=document.getElementById('playerCheckoutMessage');msg.className='portal-note';msg.textContent=payment?(wallet?'Surae Credits will be deducted when the order is submitted.':'Upload your payment proof to submit this order.'):'Select a payment method to continue.'}

  const proof=document.getElementById('playerCheckoutProof');
  proof.onchange=()=>{const file=proof.files?.[0],box=document.getElementById('playerCheckoutProofPreview');if(!file){box.hidden=true;return}try{P.validateFile(file)}catch(e){proof.value='';box.hidden=true;alert(e.message);return}const url=URL.createObjectURL(file),img=document.getElementById('playerCheckoutProofImage');img.onload=()=>URL.revokeObjectURL(url);img.src=url;document.getElementById('playerCheckoutProofName').textContent=`${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`;box.hidden=false};

  document.getElementById('playerPlaceOrder').onclick=async()=>{
    const btn=document.getElementById('playerPlaceOrder'),msg=document.getElementById('playerCheckoutMessage');if(btn.disabled)return;
    const lines=cartLines();if(!lines.length){msg.textContent='Your cart is empty.';msg.className='portal-note error';return}
    if(!payment){msg.textContent='Choose a payment method.';msg.className='portal-note error';return}
    const userInfo=document.getElementById('playerCheckoutUserInfo').value.trim();if(!userInfo){msg.textContent='Game account / user information is required.';msg.className='portal-note error';return}
    let file=null,reference='';
    if(payment!=='Surae Credits'){
      reference=document.getElementById('playerCheckoutReference').value.trim();file=proof.files?.[0]||null;const confirmed=document.getElementById('playerCheckoutProofConfirm').checked;
      if(!reference){msg.textContent='Payment reference number is required.';msg.className='portal-note error';return}
      if(!confirmed){msg.textContent='Confirm that the reference number is visible in the payment screenshot.';msg.className='portal-note error';return}
      try{P.validateFile(file)}catch(e){msg.textContent=e.message;msg.className='portal-note error';return}
    }
    const orderItems=lines.map(x=>({productId:x.p.id,qty:x.qty})),fingerprint=JSON.stringify({payment,userInfo,reference,items:orderItems}),requestId=requestIdFor(fingerprint);
    btn.disabled=true;btn.textContent='PROCESSING…';
    try{
      const result=await API.checkout({requestId,orderType:'store-purchase',customerName:user.name,customerEmail:user.email,customerMobile:user.mobile,userInfo,paymentMethod:payment,paymentReference:reference,items:orderItems},file);
      clearAttempt();Cart.clear();await Promise.all([A.refresh().catch(()=>null),C.refresh().catch(()=>null)]);user=A.getCurrentUser();renderCart();renderProducts();
      msg.innerHTML=`Order <strong>${esc(result.order.invoiceNo)}</strong> submitted successfully. Status: <strong>${esc(result.order.status)}</strong>. You can monitor it under My Invoices below.`;msg.className='portal-note success';
      document.getElementById('playerCheckoutReference').value='';document.getElementById('playerCheckoutUserInfo').value='';document.getElementById('playerCheckoutProofConfirm').checked=false;proof.value='';document.getElementById('playerCheckoutProofPreview').hidden=true;
      setTimeout(()=>location.reload(),1200);
    }catch(e){msg.textContent=e.code==='INSUFFICIENT_CREDITS'?`Insufficient Surae Credits. Required ₱${money(e.required||cartTotal())}; available ₱${money(e.balance||user?.credits||0)}.`:(e.message||'Unable to place the order.');msg.className='portal-note error'}finally{btn.disabled=false;btn.textContent='PLACE ORDER'}
  };

  window.addEventListener('surae-cart-change',renderCart);window.addEventListener('surae-catalog-ready',()=>{renderProducts();renderCart()});
  renderProducts();renderCart();updatePaymentUI();
})();
