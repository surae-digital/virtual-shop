(() => {
  const Cart=window.SuraeCart;if(!Cart)return;
  function count(){return Cart.getItems().reduce((n,x)=>n+Number(x.qty||0),0)}
  function update(){
    document.querySelectorAll('[aria-label="Cart"]').forEach(btn=>{
      btn.classList.add('surae-cart-button');
      let badge=btn.querySelector('.surae-cart-count');if(!badge){badge=document.createElement('span');badge.className='surae-cart-count';btn.appendChild(badge)}
      const n=count();badge.textContent=n>99?'99+':String(n);badge.hidden=n<1;
    });
  }
  function toast(text){let t=document.getElementById('suraeCartToast');if(!t){t=document.createElement('div');t.id='suraeCartToast';t.className='surae-cart-toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1800)}
  window.SuraeCartUI={update,toast};
  window.addEventListener('surae-cart-change',update);document.addEventListener('DOMContentLoaded',update);update();
})();
