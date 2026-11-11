import { profile } from './Profile.js';
export function openProfile(){
 if(document.getElementById('bung-profile-dialog'))return;
 const root=document.createElement('dialog');root.id='bung-profile-dialog';root.className='bung-garage-ui';root.setAttribute('aria-label','Bung player profile');
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;root.append(e);return e;};
 add('h2','YOUR BUNG PROFILE');
 add('p','One rebar wallet and your trolley builds, across campaign, chapter replay, free roam and multiplayer rooms.');
 const status=add('p',profile.status);status.setAttribute('role','status');
 add('p','Keep your recovery code somewhere private. It restores your wallet on another browser or device. Anyone with it can use your profile.');
 const code=add('input','');code.type='password';code.readOnly=true;code.value=profile.cache?.key||'';code.setAttribute('aria-label','Your private recovery code');code.style.width='100%';
 const reveal=add('button','SHOW RECOVERY CODE');reveal.onclick=()=>{code.type=code.type==='password'?'text':'password';};
 const copy=add('button','COPY RECOVERY CODE');copy.onclick=async()=>{try{await navigator.clipboard.writeText(code.value);status.textContent='Recovery code copied. Keep it private.';}catch{code.type='text';code.select();status.textContent='Copy the selected code.';}};
 const sync=add('button','SYNC NOW');sync.onclick=async()=>{sync.disabled=true;try{await profile.flush();status.textContent=profile.status;}catch{status.textContent=profile.status;}finally{sync.disabled=false;}};
 add('h3','RESTORE ON THIS DEVICE');
 const input=add('input','');input.type='password';input.autocomplete='off';input.setAttribute('aria-label','Recovery code to restore');input.placeholder='Paste your private Bung recovery code';input.style.width='100%';
 const restore=add('button','RESTORE PROFILE');restore.disabled=profile.inRoom;
 restore.onclick=async()=>{restore.disabled=true;try{await profile.restore(input.value);code.value=profile.cache.key;input.value='';status.textContent='Profile restored. Your wallet and trolley builds are ready.';}catch(e){status.textContent=e.message;}finally{restore.disabled=false;}};
 const close=add('button','BACK');close.onclick=()=>{root.close();root.remove();};
 root.addEventListener('cancel',()=>root.remove());document.body.append(root);root.showModal();
}
