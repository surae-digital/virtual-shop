(() => {
  function mapFromCloud(o){return {id:o.invoice_no||o.invoiceNo,cloudId:o.id,orderType:o.order_type,customerType:o.customer_type,customerName:o.customer_name,customerEmail:o.customer_email,customerMobile:o.customer_mobile,accountNumber:o.account_number||'',game:o.game,region:o.region,userInfo:o.user_info,product:o.product_summary,items:(o.order_items||[]).map(i=>({productId:i.product_id,name:i.name,game:i.game,region:i.region,qty:i.quantity,unitPrice:Number(i.unit_price),subtotal:Number(i.subtotal),catalogType:i.catalog_type})),amount:Number(o.total_amount),payment:o.payment_method,paymentReference:o.payment_reference||'',proofUploaded:!!o.proof_path,proofVerified:!!o.proof_verified,status:o.status,handler:o.handler,note:o.note,catalogType:o.catalog_type,walletDebitApplied:!!o.wallet_debit_applied,walletRefundApplied:!!o.wallet_refund_applied,fulfillmentApplied:!!o.fulfillment_applied,createdAt:o.created_at,updatedAt:o.updated_at};}
  let cache=[];
  async function refresh(){const d=await window.SuraeAPI.myAccount();cache=(d.orders||[]).map(mapFromCloud);return cache}
  const ready=(async()=>{if(window.SuraeAPI?.getSession())try{await refresh()}catch{}})();
  function getOrders(){return cache.slice()} function getById(id){return cache.find(x=>x.id===id||x.cloudId===id)||null}
  function setOrders(v){cache=Array.isArray(v)?v:[]}
  window.SuraeOrders={ready,refresh,getOrders,getById,setOrders,mapFromCloud};
})();
