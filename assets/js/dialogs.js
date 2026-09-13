
let activeResolve = null;

function ensureDialog(){
  let el=document.querySelector('#s4uSystemDialog');
  if(el) return el;
  el=document.createElement('div');
  el.id='s4uSystemDialog';
  el.className='s4u-dialog';
  el.setAttribute('aria-hidden','true');
  el.innerHTML=`
    <div class="s4u-dialog-backdrop" data-s4u-cancel></div>
    <section class="s4u-dialog-card" role="dialog" aria-modal="true" aria-labelledby="s4uDialogTitle">
      <div class="s4u-dialog-head">
        <div class="s4u-dialog-icon" id="s4uDialogIcon">i</div>
        <div class="s4u-dialog-copy">
          <h3 id="s4uDialogTitle">Screenings4u</h3>
          <p id="s4uDialogMessage"></p>
        </div>
      </div>
      <div class="s4u-dialog-actions">
        <button type="button" class="s4u-dialog-btn" id="s4uDialogCancel">Cancel</button>
        <button type="button" class="s4u-dialog-btn primary" id="s4uDialogConfirm">Continue</button>
      </div>
    </section>`;
  document.body.appendChild(el);
  el.querySelectorAll('[data-s4u-cancel]').forEach(x=>x.addEventListener('click',()=>finish(false)));
  el.querySelector('#s4uDialogCancel').addEventListener('click',()=>finish(false));
  el.querySelector('#s4uDialogConfirm').addEventListener('click',()=>finish(true));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el.classList.contains('open'))finish(false)});
  return el;
}
function finish(value){
  const el=ensureDialog();
  el.classList.remove('open'); el.setAttribute('aria-hidden','true');
  const resolve=activeResolve; activeResolve=null;
  if(resolve) resolve(value);
}
export function s4uConfirm({title='Please confirm',message='',confirmText='Continue',cancelText='Cancel',tone='warning'}={}){
  const el=ensureDialog(), icon=el.querySelector('#s4uDialogIcon'), confirm=el.querySelector('#s4uDialogConfirm');
  el.querySelector('#s4uDialogTitle').textContent=title;
  el.querySelector('#s4uDialogMessage').textContent=message;
  el.querySelector('#s4uDialogCancel').textContent=cancelText;
  confirm.textContent=confirmText;
  confirm.className='s4u-dialog-btn '+(tone==='danger'?'danger':'primary');
  icon.className='s4u-dialog-icon '+tone;
  icon.textContent=tone==='danger'?'!':'?';
  el.classList.add('open'); el.setAttribute('aria-hidden','false');
  return new Promise(resolve=>{activeResolve=resolve});
}
export function s4uAlert({title='Screenings4u',message='',buttonText='OK',tone='info'}={}){
  const el=ensureDialog(), icon=el.querySelector('#s4uDialogIcon'), cancel=el.querySelector('#s4uDialogCancel'), confirm=el.querySelector('#s4uDialogConfirm');
  el.querySelector('#s4uDialogTitle').textContent=title;
  el.querySelector('#s4uDialogMessage').textContent=message;
  cancel.style.display='none';
  confirm.textContent=buttonText; confirm.className='s4u-dialog-btn primary';
  icon.className='s4u-dialog-icon '+tone; icon.textContent=tone==='danger'?'!':'i';
  el.classList.add('open'); el.setAttribute('aria-hidden','false');
  return new Promise(resolve=>{activeResolve=(v)=>{cancel.style.display='';resolve(v)}});
}
