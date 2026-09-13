(() => {
  const API=window.SuraeAPI;
  const CACHE_KEY='surae_catalog_cache_v2';
  const CACHE_TTL=10*60*1000;
  let catalog=[],settings={storeOnline:true,announcement:'',allowWallet:true,allowBank:true,allowGCash:true,allowPayMaya:true},rates=[];
  const mapProduct=p=>({id:p.id,game:p.game,region:p.region,name:p.name,category:p.category,description:p.description,price:Number(p.price||0),active:p.active!==false,stockStatus:p.stock_status||p.stockStatus||'Available',catalogType:p.catalog_type||p.catalogType||'regular'});
  const mapSettings=s=>({storeOnline:s?.store_online!==false,announcement:s?.announcement||'',allowWallet:s?.allow_wallet!==false,allowBank:s?.allow_bank!==false,allowGCash:s?.allow_gcash!==false,allowPayMaya:s?.allow_paymaya!==false});
  function apply(d,emit=true){catalog=(d.products||[]).map(mapProduct);settings=mapSettings(d.settings||{});rates=d.rates||[];if(emit)window.dispatchEvent(new CustomEvent('surae-catalog-ready'));return {catalog,settings,rates}}
  function readCache(){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!c||!c.data)return null;return c}catch{return null}}
  function writeCache(d){try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),data:d}))}catch{}}
  async function refresh(){const d=await API.bootstrap();writeCache(d);return apply(d,true)}
  const cached=readCache();
  if(cached)apply(cached.data,false);
  // Cached data paints immediately. Fresh data is fetched in the background when
  // the cache is recent; stale/no-cache visits wait for one bootstrap request.
  const ready=cached&&Date.now()-cached.ts<CACHE_TTL
    ? Promise.resolve({catalog,settings,rates})
    : refresh().catch(e=>{console.error('Catalog bootstrap failed',e);document.body?.classList.add('surae-cloud-error');return {catalog,settings,rates}});
  if(cached){setTimeout(()=>refresh().catch(()=>{}),60)}
  function getCatalog(){return catalog.slice()} function getSettings(){return {...settings}} function getRates(){return rates.slice()}
  async function upsertProduct(p){const d=await API.admin('product-upsert',{product:p});await refresh();return mapProduct(d.product)}
  async function deleteProduct(id){await API.admin('product-delete',{productId:id});await refresh()}
  async function saveSettings(s){const d=await API.admin('settings-save',{settings:s});settings=mapSettings(d.settings);try{const c=readCache();if(c?.data){c.data.settings=d.settings;writeCache(c.data)}}catch{}return getSettings()}
  async function saveRates(r){await API.admin('rates-save',{rates:r});await refresh();return getRates()}
  window.SuraeCatalog={ready,refresh,getCatalog,getSettings,getRates,upsertProduct,deleteProduct,saveSettings,saveRates};
})();
