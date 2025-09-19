const LS_USERS = 'mf_users';
const LS_SESSION = 'mf_session';
const LS_MEDIT_PREFIX = 'mf_medit_'; 

function nowISO(){ return new Date().toISOString(); }
function toMMSS(sec){ const m=String(Math.floor(sec/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; }
function formatDateTime(iso){
  const d=new Date(iso);
  return d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'})+
         ' '+
         d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function dayKey(date){ const d=new Date(date); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
function periodOfDay(date){
  const h=new Date(date).getHours();
  if(h>=5 && h<12) return 'manhã';
  if(h>=12 && h<18) return 'tarde';
  return 'noite';
}
function formatMemberSince(iso){
  const d=new Date(iso||nowISO());
  const month = d.toLocaleString('pt-BR',{month:'long'});
  return `${month.charAt(0).toUpperCase()+month.slice(1)} ${d.getFullYear()}`;
}

function getUsers(){ return JSON.parse(localStorage.getItem(LS_USERS)||'[]'); }
function saveUsers(list){ localStorage.setItem(LS_USERS, JSON.stringify(list)); }

function registerUser({name,email,password,avatar}){
  const users = getUsers();
  if(users.some(u=>u.email===email)) return {success:false,message:'Este email já está cadastrado.'};
  const user = { name, email, pass: password, avatar: avatar || 'https://justpresspause.com/wp-content/uploads/2022/08/Meditation.png', createdAt: nowISO() };
  users.push(user); saveUsers(users);
  return {success:true};
}

function login(email, pass){
  const users = getUsers();
  const u = users.find(u=>u.email===email && u.pass===pass);
  if(!u) return false;
  localStorage.setItem(LS_SESSION, JSON.stringify({email:u.email, loginAt: nowISO()}));
  return true;
}
function logout(){ localStorage.removeItem(LS_SESSION); }
function getSession(){ return JSON.parse(localStorage.getItem(LS_SESSION)||'null'); }
function getCurrentUser(){
  const s=getSession(); if(!s) return null;
  const u = getUsers().find(u=>u.email===s.email);
  if(u) return u;
  return { email: s.email, name: s.email.split('@')[0], avatar: 'https://justpresspause.com/wp-content/uploads/2022/08/Meditation.png', createdAt: nowISO() };
}


function requireLogin(){
  const local = getSession();
  if (local) return;

  if (typeof sbGetSession === 'function') {
    sbGetSession()
      .then(s => {
        if (s) {
          location.reload();
        } else {
          location.replace('index.html');
        }
      })
      .catch(() => location.replace('index.html'));
  } else {
    setTimeout(() => {
      if (!getSession()) location.replace('index.html');
    }, 200);
  }
}

function requireLoggedOut(){
  const local = getSession();
  if (local) { location.replace('home.html'); return; }

  if (typeof sbGetSession === 'function') {
    sbGetSession()
      .then(s => { if (s) location.replace('home.html'); })
      .catch(() => {});
  }
}

function meditKey(email){ return LS_MEDIT_PREFIX+email; }
function getMeditations(email){ return JSON.parse(localStorage.getItem(meditKey(email))||'[]'); }
function saveMeditations(email, list){ localStorage.setItem(meditKey(email), JSON.stringify(list)); }

function addMeditation(email, durationSec){
  const list = getMeditations(email);
  const endAt = nowISO();
  list.push({
    id: cryptoRandom(),
    type: '478',
    duration: durationSec,
    endAt,
    period: periodOfDay(endAt)
  });
  saveMeditations(email, list);
}

function deleteMeditation(email, id){
  const list = getMeditations(email).filter(x=>x.id!==id);
  saveMeditations(email, list);
}

function getStats(email){
  const list = getMeditations(email);
  const totalSeconds = list.reduce((s,x)=>s+x.duration,0);
  const sessions = list.length;
  const streakDays = computeStreak(list);
  return { totalSeconds, sessions, streakDays, list };
}

function computeStreak(list){
  if(!list.length) return 0;
  const days = new Set(list.map(x=>dayKey(x.endAt)));
  let streak=0;
  let d=new Date(); d.setHours(0,0,0,0);
  while(true){
    const key=d.toISOString().slice(0,10);
    if(days.has(key)){ streak++; d.setDate(d.getDate()-1); }
    else{
      if(streak===0){ d.setDate(d.getDate()-1); const key2=d.toISOString().slice(0,10); if(days.has(key2)){ streak++; d.setDate(d.getDate()-1); continue; } }
      break;
    }
  }
  return streak;
}

function renderAchievements(containerId, stats){
  const el=document.getElementById(containerId);
  const unlocked = {
    iniciante: stats.sessions>=1,
    cincoHoras: (stats.totalSeconds/3600)>=5,
    seteDias: stats.streakDays>=7,
    manha: stats.list.some(x=>x.period==='manhã')
  };
  const items = [
    {key:'iniciante', icon:'award', label:'Iniciante'},
    {key:'cincoHoras', icon:'clock', label:'5 horas'},
    {key:'seteDias', icon:'star', label:'7 dias'},
    {key:'manha', icon:'sun', label:'Manhã'}
  ];
  el.innerHTML = items.map(it=>{
    const locked = !unlocked[it.key];
    return `
      <div class="flex flex-col items-center ${locked?'badge-locked':''}">
        <div class="w-12 h-12 rounded-full ${locked?'bg-gray-100':'bg-yellow-100'} flex items-center justify-center mb-2">
          <i data-feather="${it.icon}" class="${locked?'text-gray-400':'text-yellow-500'}"></i>
        </div>
        <span class="text-xs text-center">${it.label}</span>
      </div>
    `;
  }).join('');
  if(window.feather){ feather.replace(); }
}

function cryptoRandom(){
  if(window.crypto?.randomUUID) return crypto.randomUUID();
  return 'id_'+Math.random().toString(36).slice(2);
}

function bindHeaderUser(avatarSel, nameSel){
  const u = getCurrentUser(); if(!u) return;
  const imgEls = document.querySelectorAll(avatarSel || '.js-avatar');
  imgEls.forEach(el=>{ el.src = u.avatar || 'https://justpresspause.com/wp-content/uploads/2022/08/Meditation.png'; });
  const nameEl = nameSel ? document.querySelector(nameSel) : null;
  if(nameEl) nameEl.textContent = u.name || 'Usuário';
}

function updateCurrentUser(patch){
  const s = getSession(); 
  if(!s) return null;

  const users = getUsers();
  let idx = users.findIndex(u => u.email === s.email);

  if (idx < 0) {
    const base = getCurrentUser() || {
      email: s.email,
      name: (s.email || '').split('@')[0] || 'Usuário',
      avatar: 'https://justpresspause.com/wp-content/uploads/2022/08/Meditation.png',
      createdAt: nowISO()
    };
    const created = { ...base, ...patch };
    users.push(created);
    saveUsers(users);
    return created;
  }

  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);
  return users[idx];
}

function setAvatarForCurrentUser(url){
  const u = updateCurrentUser({ avatar: url });
  if(u){ document.querySelectorAll('.js-avatar').forEach(el => { el.src = u.avatar; }); }
  return u;
}

