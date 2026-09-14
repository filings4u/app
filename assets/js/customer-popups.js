let root;
function ensure(){
  if(root)return root;
  root=document.createElement('div');
  root.className='s4u-popup-layer';
  root.innerHTML=`<div class="s4u-popup" role="dialog" aria-modal="true" aria-labelledby="s4uPopupTitle">
    <button class="s4u-popup-x" type="button" aria-label="Close">×</button>
    <div class="s4u-popup-brand"><img src="/images/logo.png" alt="screenings4u"></div>
    <h3 id="s4uPopupTitle"></h3>
    <p></p>
    <div class="s4u-popup-actions"></div>
  </div>`;
  document.body.appendChild(root);
  root.querySelector('.s4u-popup-x').onclick=()=>close(false);
  root.addEventListener('click',e=>{if(e.target===root)close(false)});
  return root;
}
let resolver=null;
function close(v){
  if(!root)return;
  root.classList.remove('open');
  const r=resolver;
  resolver=null;
  if(r)r(v)
}
export function popup(message,{title='screenings4u',type='info',confirm=false,confirmText='Continue',cancelText='Cancel'}={}){
  ensure();
  const box=root.querySelector('.s4u-popup');
  box.dataset.type=type;
  box.querySelector('h3').textContent=title;
  box.querySelector('p').textContent=String(message||'');
  const actions=box.querySelector('.s4u-popup-actions');
  actions.innerHTML='';
  return new Promise(resolve=>{
    resolver=resolve;
    if(confirm){
      const c=document.createElement('button');
      c.className='btn btn-outline';
      c.textContent=cancelText;
      c.onclick=()=>close(false);
      actions.appendChild(c)
    }
    const ok=document.createElement('button');
    ok.className='btn btn-orange';
    ok.textContent=confirm?confirmText:'OK';
    ok.onclick=()=>close(true);
    actions.appendChild(ok);
    root.classList.add('open');
    ok.focus()
  });
}
export function toast(message,type='success'){
  const wrap=document.querySelector('.s4u-toast-stack')||(()=>{
    const x=document.createElement('div');
    x.className='s4u-toast-stack';
    document.body.appendChild(x);
    return x
  })();
  const item=document.createElement('div');
  item.className=`s4u-toast ${type||'info'}`;
  item.innerHTML=`<img src="/images/logo.png" alt=""><span></span><button type="button" aria-label="Dismiss">×</button>`;
  item.querySelector('span').textContent=String(message||'');
  item.querySelector('button').onclick=()=>item.remove();
  wrap.appendChild(item);
  setTimeout(()=>item.remove(),4200);
  return item;
}
