(() => {
  const cfg=()=>window.SURAE_CONFIG||{};
  const SESSION_KEY='surae_supabase_session_v1';
  const getSession=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  const setSession=s=>s?localStorage.setItem(SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(SESSION_KEY);
  const base=()=>String(cfg().supabaseUrl||'').replace(/\/$/,'');
  const key=()=>String(cfg().supabaseAnonKey||'');
  function configured(){return /^https:\/\//i.test(base())&&key().length>20}
  async function call(action,body={},opts={}){
    if(!configured())throw new Error('Supabase is not configured.');
    let session=getSession();
    if(session?.expires_at && Date.now()/1000 > Number(session.expires_at)-60 && session.refresh_token){session=await refresh(session.refresh_token)}
    const token=session?.access_token||key();
    const url=`${base()}/functions/v1/shop-api`;
    let init={method:'POST',headers:{apikey:key(),authorization:`Bearer ${token}`}};
    if(opts.formData){init.body=opts.formData}else{init.headers['content-type']='application/json';init.body=JSON.stringify({action,...body})}
    const r=await fetch(url,init);let d={};try{d=await r.json()}catch{}
    if(!r.ok){const e=new Error(d.error||`Request failed (${r.status}).`);e.code=d.code||'ERROR';if(d.balance!==undefined)e.balance=Number(d.balance);if(d.required!==undefined)e.required=Number(d.required);throw e}
    return d;
  }
  async function refresh(refreshToken){
    const r=await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:key(),'content-type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})});const d=await r.json();if(!r.ok){setSession(null);throw new Error(d.error_description||d.msg||'Session expired. Please log in again.')}setSession(d);return d
  }
  async function login(identity,password){setSession(null);const d=await call('auth-login',{identity,password});setSession(d.session);return d}
  async function register(data){setSession(null);const d=await call('auth-register',data);if(d.session)setSession(d.session);return d}
  function logout(){setSession(null)}
  async function bootstrap(){return call('bootstrap')}
  async function myAccount(){return call('my-account')}
  async function checkout(payload,proof){const fd=new FormData();fd.append('payload',JSON.stringify({action:'checkout',...payload}));if(proof)fd.append('proof',proof,proof.name);return call('checkout',{}, {formData:fd})}
  async function submitPiloting(payload,signature){const fd=new FormData();fd.append('payload',JSON.stringify({action:'piloting-agreement',...payload}));if(signature)fd.append('signature',signature,'signature.png');return call('piloting-agreement',{}, {formData:fd})}
  async function adminSnapshot(){return call('admin-snapshot')}
  async function admin(adminAction,data={}){return call('admin',{adminAction,...data})}
  async function track(token){const r=await fetch(`${base()}/functions/v1/track-order`,{method:'POST',headers:{apikey:key(),'content-type':'application/json'},body:JSON.stringify({token})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Unable to track this order.');return d}
  window.SuraeAPI={configured,getSession,setSession,login,register,logout,bootstrap,myAccount,checkout,submitPiloting,adminSnapshot,admin,track,refresh};
})();
