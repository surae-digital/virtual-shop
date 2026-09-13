(() => {
  // Cart contents are intentionally device-local. Prices and order totals are
  // always re-resolved by the Supabase backend at checkout.
  const KEY='surae_cart_v1',MAX_QTY=99;
  const clampQty=v=>Math.max(1,Math.min(MAX_QTY,Math.floor(Number(v)||1)));
  const parse=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
  const save=v=>{localStorage.setItem(KEY,JSON.stringify(v));window.dispatchEvent(new CustomEvent('surae-cart-change',{detail:getItems()}));};
  function getItems(){
    const merged=new Map();
    for(const x of parse()){
      const id=String(x?.productId||'').trim();if(!id)continue;
      merged.set(id,Math.min(MAX_QTY,(merged.get(id)||0)+clampQty(x.qty)));
    }
    return [...merged].map(([productId,qty])=>({productId,qty}));
  }
  function add(productId,qty=1){
    productId=String(productId||'').trim();if(!productId)return getItems();
    const list=getItems(),i=list.findIndex(x=>x.productId===productId),n=clampQty(qty);
    if(i>=0)list[i].qty=Math.min(MAX_QTY,list[i].qty+n);else list.push({productId,qty:n});save(list);return list;
  }
  function setQty(productId,qty){
    const list=getItems(),i=list.findIndex(x=>x.productId===productId);if(i<0)return list;
    const raw=Math.floor(Number(qty)||0);if(raw<=0)list.splice(i,1);else list[i].qty=Math.min(MAX_QTY,raw);save(list);return list;
  }
  function remove(productId){save(getItems().filter(x=>x.productId!==productId));}
  function clear(){save([])}
  window.SuraeCart={getItems,add,setQty,remove,clear,KEY,MAX_QTY};
})();
