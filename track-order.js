(async()=>{
  const state=document.getElementById('trackingState'),box=document.getElementById('trackingOrder');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const token=new URLSearchParams(location.search).get('t')||'';
  if(!token){state.textContent='This tracking link is incomplete.';state.classList.add('error');return}
  if(!window.SuraeAPI?.configured()){state.textContent='Order tracking is not connected yet. Please contact Surae Digital Shop support.';state.classList.add('error');return}
  try{
    const data=await window.SuraeAPI.track(token),o=data.order;
    document.getElementById('tInvoice').textContent=o.invoiceNo||'—';document.getElementById('tStatus').textContent=o.status||'—';document.getElementById('tStatus').dataset.status=String(o.status||'').toLowerCase().replace(/\s+/g,'-');
    document.getElementById('tGame').textContent=[o.game,o.region].filter(Boolean).join(' • ')||'Digital order';document.getElementById('tPayment').textContent=o.paymentMethod||'—';document.getElementById('tAmount').textContent=money(o.amount);document.getElementById('tCreated').textContent=o.createdAt?new Date(o.createdAt).toLocaleString():'—';
    const items=Array.isArray(o.items)?o.items:[];document.getElementById('tItems').innerHTML=items.length?items.map(x=>`<div class="tracking-item"><div><b>${esc(x.name)}</b><small>${esc([x.game,x.region].filter(Boolean).join(' • '))}</small></div><span>${Number(x.quantity||1)} × ${money(x.unit_price)} <strong>${money(x.subtotal)}</strong></span></div>`).join(''):`<div class="tracking-item"><b>${esc(o.productSummary||'Order')}</b></div>`;
    const events=Array.isArray(o.events)?o.events:[];document.getElementById('tEvents').innerHTML=events.length?events.map(e=>`<div class="tracking-event"><i></i><div><b>${esc(e.status)}</b><p>${esc(e.public_message||'Status updated.')}</p><small>${e.created_at?new Date(e.created_at).toLocaleString():''}</small></div></div>`).join(''):'<div class="tracking-event"><i></i><div><b>'+esc(o.status)+'</b><p>Order received.</p></div></div>';
    state.hidden=true;box.hidden=false;
  }catch(err){state.textContent=err.message||'Unable to retrieve this order.';state.classList.add('error')}
})();
