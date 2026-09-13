import { SITE_URL } from './common.ts'
const FROM=Deno.env.get('RESEND_FROM')||'Surae Digital Shop <onboarding@resend.dev>'
const KEY=Deno.env.get('RESEND_API_KEY')||''
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))
const peso=(n:any)=>`₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`
export async function sendMail(to:string,subject:string,html:string){
  if(!KEY) return {id:null,skipped:true}
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${KEY}`,'content-type':'application/json'},body:JSON.stringify({from:FROM,to:[to],subject,html})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||`Resend failed (${r.status})`);return d
}
export function receiptHtml(order:any,items:any[],trackingToken=''){
  const registered=order.customer_type==='registered';const link=registered?`${SITE_URL}/player.html#orders`:`${SITE_URL}/track-order.html?t=${encodeURIComponent(trackingToken)}`;
  const rows=items.length?items.map(i=>`<tr><td style="padding:9px;border-bottom:1px solid #eee">${esc(i.quantity??i.qty??1)}× ${esc(i.name)}</td><td style="padding:9px;border-bottom:1px solid #eee;text-align:right">${peso(i.subtotal)}</td></tr>`).join(''):`<tr><td style="padding:9px">${esc(order.product_summary)}</td><td style="padding:9px;text-align:right">${peso(order.total_amount)}</td></tr>`;
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px;color:#172033"><div style="max-width:640px;margin:auto;background:#fff;border-radius:14px;padding:28px"><h1 style="margin:0 0 6px">Surae Digital Shop</h1><p style="color:#687386">Order receipt</p><h2>${esc(order.invoice_no)}</h2><p>Hi ${esc(order.customer_name)}, we received your order.</p><table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding:12px 9px"><b>Total</b></td><td style="padding:12px 9px;text-align:right"><b>${peso(order.total_amount)}</b></td></tr></table><p><b>Payment:</b> ${esc(order.payment_method)}<br><b>Status:</b> ${esc(order.status)}</p>${SITE_URL?`<p style="margin:28px 0"><a href="${esc(link)}" style="background:#101820;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:bold">${registered?'VIEW MY ORDERS':'TRACK YOUR ORDER'}</a></p>`:''}<p style="font-size:12px;color:#7b8494">Keep this email for your records. Never share your private tracking link.</p></div></body></html>`
}
export function statusHtml(order:any){const link=order.customer_type==='registered'?`${SITE_URL}/player.html#orders`:'';return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px"><div style="max-width:620px;margin:auto;background:#fff;padding:28px;border-radius:14px"><h2>Order ${esc(order.invoice_no)}</h2><p>Hi ${esc(order.customer_name)}, your order status is now:</p><h1>${esc(order.status)}</h1>${link?`<p><a href="${esc(link)}">View your orders</a></p>`:''}<p>Thank you,<br>Surae Digital Shop</p></div></body></html>`}
