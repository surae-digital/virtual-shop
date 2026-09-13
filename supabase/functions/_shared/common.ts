import { createClient } from 'npm:@supabase/supabase-js@2'

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
export const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
export const SITE_URL = (Deno.env.get('SITE_URL') || Deno.env.get('SITE_ORIGIN') || '').replace(/\/$/,'')

export const service = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false, autoRefreshToken:false } })
export const anonClient = () => createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession:false, autoRefreshToken:false } })

export function cors(req:Request){
  const origin=req.headers.get('origin')||''
  const configured=(Deno.env.get('SITE_ORIGIN')||'').split(',').map(x=>x.trim()).filter(Boolean)
  const allowed=!configured.length || configured.includes(origin)
  return {
    'access-control-allow-origin': allowed ? (origin || '*') : 'null',
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods':'POST, OPTIONS',
    'vary':'Origin'
  }
}
export function json(req:Request, body:unknown, status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
export const clean=(v:unknown,max=300)=>String(v??'').trim().slice(0,max)
export const money=(v:unknown)=>Math.round(Number(v||0)*100)/100
export function invoiceNo(){const d=new Date();const stamp=d.toISOString().replace(/[-:TZ.]/g,'').slice(0,14);const r=crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();return `INV-${stamp}-${r}`}
export async function sha256(text:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function token256(){const b=new Uint8Array(32);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function currentUser(req:Request){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token || token===ANON_KEY) return {user:null,token:''}
  const uc=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await uc.auth.getUser(token);if(error||!data.user)return {user:null,token:''};return {user:data.user,token}
}
export async function requireStaff(req:Request){
  const {user}=await currentUser(req);if(!user)throw Object.assign(new Error('Admin login required.'),{status:401,code:'UNAUTHORIZED'});
  const sb=service();const {data,error}=await sb.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
  if(error||!data||!['admin','staff'].includes(data.role))throw Object.assign(new Error('This account is not authorized for Admin.'),{status:403,code:'FORBIDDEN'});
  return {user,role:data.role,sb}
}
export function safeError(e:any){
  if(e?.status){return {error:String(e?.message||'Request failed.'),code:String(e?.code||'ERROR'),status:Number(e.status)}}
  const raw=String(e?.message||'')
  const known:[string,string,string,number][]=[
    ['PAYMENT_NOT_VERIFIED','Payment must be verified before this order can move to Processing or Completed.','PAYMENT_NOT_VERIFIED',409],
    ['FULFILLED_ORDER_LOCKED','A completed/fulfilled order cannot be moved back to another status.','FULFILLED_ORDER_LOCKED',409],
    ['REFUNDED_ORDER_LOCKED','A refunded Surae Credits order cannot be reactivated.','REFUNDED_ORDER_LOCKED',409],
    ['TERMINAL_ORDER_LOCKED','A cancelled or rejected order is final and cannot be reactivated.','TERMINAL_ORDER_LOCKED',409],
    ['INVALID_CREDIT_STATUS','A paid Surae Credits order cannot be moved back to an unpaid status.','INVALID_CREDIT_STATUS',409],
    ['PROOF_MISSING','This order does not have a payment proof to verify.','PROOF_MISSING',409],
    ['ORDER_NOT_FOUND','Order not found.','ORDER_NOT_FOUND',404],
    ['ACCOUNT_NOT_FOUND','Player account not found.','ACCOUNT_NOT_FOUND',404],
    ['ACCOUNT_NOT_ACTIVE','This player account is not active.','ACCOUNT_INACTIVE',403],
    ['TOPUP_ACCOUNT_MISSING','This top-up is not linked to a registered player account.','TOPUP_ACCOUNT_MISSING',409],
    ['FORBIDDEN','You are not authorized to perform this action.','FORBIDDEN',403],
    ['INSUFFICIENT_CREDITS','Insufficient Surae Credits.','INSUFFICIENT_CREDITS',409]
  ]
  for(const [needle,message,code,status] of known)if(raw.includes(needle))return {error:message,code,status}
  return {error:'The request could not be completed. Please try again or contact support.',code:'SERVER_ERROR',status:500}
}
