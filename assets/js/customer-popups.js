let root;
function ensure(){
 if(root)return root;
 root=document.createElement('div');root.className='s4u-popup-layer';root.innerHTML='<div class="s4u-popup" role="dialog" aria-modal="true"><button class="s4u-popup-x" type="button" aria-label="Close">×</button><div class="s4u-popup-mark">S4U</div><h3></h3><p></p><div class="s4u-popup-actions"></div></div>';document.body.appendChild(root);
 root.querySelector('.s4u-popup-x').onclick=()=>close(false);return root;
}
let resolver=null;
function close(v){if(!root)return;root.classList.remove('open');const r=resolver;resolver=null;if(r)r(v)}
export function popup(message,{title='screenings4u',type='info',confirm=false,confirmText='Continue',cancelText='Cancel'}={}){
 ensure();const box=root.querySelector('.s4u-popup');box.dataset.type=type;box.querySelector('h3').textContent=title;box.querySelector('p').textContent=String(message||'');const actions=box.querySelector('.s4u-popup-actions');actions.innerHTML='';
 return new Promise(resolve=>{resolver=resolve;if(confirm){const c=document.createElement('button');c.className='btn btn-outline';c.textContent=cancelText;c.onclick=()=>close(false);actions.appendChild(c)}const ok=document.createElement('button');ok.className='btn btn-orange';ok.textContent=confirm?confirmText:'OK';ok.onclick=()=>close(true);actions.appendChild(ok);root.classList.add('open');ok.focus()});
}
export const toast=(message,type='success',title=type==='error'?'Action needed':'screenings4u')=>popup(message,{title,type});
