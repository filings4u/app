import { supabase } from './supabase.js';

const tbody=document.querySelector('[data-order-history-body]');
const empty=document.querySelector('[data-order-history-empty]');
const errorBox=document.querySelector('[data-order-history-error]');
const search=document.querySelector('[data-order-search]');
const filter=document.querySelector('[data-order-filter]');
const total=document.querySelector('[data-order-total]');
const paid=document.querySelector('[data-order-paid]');
const open=document.querySelector('[data-order-open]');
let rows=[];

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const fmtMoney=(n,c='USD')=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD'}).format(Number(n||0));
const pretty=v=>String(v||'unknown').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const isPaid=r=>['paid','provisioned','completed','active'].includes(String(r.status||'').toLowerCase()) || !!r.paid_at;

function render(){
 const q=(search?.value||'').trim().toLowerCase(), f=filter?.value||'all';
 const list=rows.filter(r=>{
   const hay=[r.order_number,r.title,r.description,r.status,r.type].join(' ').toLowerCase();
   return (!q||hay.includes(q)) && (f==='all'||r.type===f);
 });
 if(tbody) tbody.innerHTML=list.map(r=>`<tr>
   <td><strong>${esc(r.order_number||'—')}</strong><small>${esc(pretty(r.type))}</small></td>
   <td><strong>${esc(r.title||'Order')}</strong><small>${esc(r.description||'')}</small></td>
   <td>${esc(fmtDate(r.created_at))}</td>
   <td>${esc(fmtMoney(r.amount,r.currency))}</td>
   <td><span class="order-status ${isPaid(r)?'paid':'open'}">${esc(pretty(r.status))}</span></td>
   <td class="order-actions">${r.view_url?`<a class="btn btn-outline btn-small" href="${esc(r.view_url)}">View</a>`:''}${r.payment_url?`<a class="btn btn-orange btn-small" href="${esc(r.payment_url)}" target="_blank" rel="noopener">Pay</a>`:''}</td>
 </tr>`).join('');
 if(empty) empty.hidden=list.length>0;
}

async function load(){
 try{
   const {data,error}=await supabase.functions.invoke('workforce-order-history',{body:{portal:'employer'}});
   if(error) throw error;
   rows=data?.orders||[];
   if(total) total.textContent=String(rows.length);
   if(paid) paid.textContent=String(rows.filter(isPaid).length);
   if(open) open.textContent=String(rows.filter(r=>!isPaid(r)).length);
   render();
 }catch(e){
   console.error(e);
   if(errorBox){errorBox.hidden=false;errorBox.textContent='We could not load your order history. Please refresh the page or contact support.';}
 }
}
search?.addEventListener('input',render);filter?.addEventListener('change',render);load();
