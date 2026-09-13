(() => {
  const API=window.SuraeAPI;let profile=null,transactions=[],orders=[];
  const CACHE_KEY='surae_account_cache_v2';
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null')}catch{return null}};
  const write=()=>{try{profile?sessionStorage.setItem(CACHE_KEY,JSON.stringify({profile,transactions,orders})):sessionStorage.removeItem(CACHE_KEY)}catch{}};
  function mapProfile(p){return p?{userId:p.user_id,accountNumber:p.account_number,name:p.name,email:p.email,mobile:p.mobile,credits:Number(p.credits||0),status:p.status,createdAt:p.created_at}:null}
  function mapTx(t){return {id:t.id,accountNumber:profile?.accountNumber||'',type:t.type,amount:Number(t.amount),source:t.source,note:t.note,createdAt:t.created_at,status:'Completed'}}
  const cached=API?.getSession()?read():null;if(cached?.profile){profile=cached.profile;transactions=cached.transactions||[];orders=cached.orders||[]}
  async function load(){if(!API?.getSession()){profile=null;transactions=[];orders=[];write();return null}try{const d=await API.myAccount();profile=mapProfile(d.profile);transactions=(d.transactions||[]).map(mapTx);orders=d.orders||[];write();window.dispatchEvent(new CustomEvent('surae-account-ready',{detail:profile}));return profile}catch(e){if(/login|session|jwt/i.test(e.message||'')){API.logout();profile=null;write()}throw e}}
  // If a cached profile exists, let navigation/session UI paint immediately and
  // refresh it in the background. Pages that require fresh account data call refresh().
  const ready=cached?.profile?Promise.resolve(profile):load().catch(()=>null);
  if(cached?.profile)setTimeout(()=>load().catch(()=>{}),80);
  async function register({name,email,mobile,password}){const d=await API.register({name,email,mobile,password});if(d.needsEmailConfirmation&&!d.session)return {needsEmailConfirmation:true,email};await load();return profile}
  async function authenticate(identity,password){await API.login(identity,password);await load();return profile}
  function getCurrentUser(){return profile}
  async function refresh(){return load()}
  function logout(){API.logout();profile=null;transactions=[];orders=[];write()}
  function getTransactions(){return transactions.slice()}
  function getOrders(){return orders.slice()}
  function setCurrentUser(){return !!profile}
  window.SuraeStore={ready,refresh,register,authenticate,getCurrentUser,logout,getTransactions,getOrders,setCurrentUser};
})();
