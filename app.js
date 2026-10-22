const $=s => document.querySelector(s), esc=s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const CATS=[["Sonhos", "O que você espera ter conquistado quando ler esta carta?"], ["Sentimentos", "Como você está se sentindo nesta fase da sua vida?"], ["Pessoas importantes", "Quem faz parte da sua história hoje?"], ["Memórias", "Qual momento você gostaria de guardar para sempre?"], ["Medos", "O que você tem medo de enfrentar e espera conseguir superar?"], ["Promessas", "O que você gostaria de prometer a si mesmo?"], ["Pequenas coisas", "Qual pequena coisa tem feito você feliz ultimamente?"], ["Uma mensagem para o futuro", "O que você espera que seu eu do futuro nunca esqueça?"]];

/* ---- dados (separados da UI) ---- */
const Store={all() {
  try {
    return JSON.parse(localStorage.getItem('dfm.letters')||'[]')
  } catch {
    return[]
  }
}, save(a) {
  try {
    localStorage.setItem('dfm.letters', JSON.stringify(a))
  } catch {
    toast('Não foi possível salvar: armazenamento cheio.')
  }
}};
const dbp=new Promise(r => {
  try {
    const q=indexedDB.open('dfm', 1);
    q.onupgradeneeded=() => q.result.createObjectStore('img');
    q.onsuccess=() => r(q.result);
    q.onerror=() => r(null)
  } catch {
    r(null)
  }
});
const idb=(m, k, v) => dbp.then(d => d&&new Promise(r => {
  const s=d.transaction('img', m=='get'?'readonly':'readwrite').objectStore('img');
  const q=m=='get'?s.get(k):m=='put'?s.put(v, k):s.delete(k);
  q.onsuccess=() => r(q.result);
  q.onerror=() => r()
}));
function toast(t) {
  const e=$('#toast');
  e.textContent=t;
  e.classList.add('on');
  setTimeout(() => e.classList.remove('on'), 2400)
}
const fmt=(d, t) => new Date(d).toLocaleString('pt-BR', t?{dateStyle:'long', timeStyle:'short'}:{dateStyle:'long'});

/* ---- tempo ---- */
const stateOf=l => Date.now()>=l.open?(l.opened?'Aberta':'Pronta para ser aberta'):'Esperando o momento certo';
const prog=l => Math.min(1, Math.max(0, (Date.now()-l.created)/Math.max(1, l.open-l.created)));
function remain(l) {
  const ms=l.open-Date.now();
  if(ms<=0)return'Chegou o momento';
  const day=s => new Date(s).setHours(0, 0, 0, 0);
  const dd=Math.round((day(l.open)-day(Date.now()))/864e5);
  if(dd==1)return'É amanhã';
  const d=Math.ceil(ms/864e5);
  if(d==1)return'Falta 1 dia';
  if(ms<864e5)return'Faltam '+Math.ceil(ms/36e5)+' horas';
  return'Faltam '+d+' dias'
}
let hid=0;
function hourglass(l) {
  const p=prog(l), i='h'+hid++, G='M10 8H50L34 46V54L50 92H10L26 54V46Z', th=40*(1-p), bh=38*p;
  return`<svg viewBox="0 0 60 100" width="52" height="86" role="img" aria-label="Ampulheta: ${Math.round(p*100)}% do tempo já passou"><defs><clipPath id="${i}"><path d="${G}"/></clipPath></defs>
<path d="${G}" fill="#f7f2e9" fill-opacity=".55"/><g clip-path="url(#${i})"><rect x="0" y="${48-th}" width="60" height="${th}" fill="#B69A78"/><rect x="0" y="${92-bh}" width="60" height="${bh}" fill="#B69A78"/>${p<1?`<line x1="30" y1="${p>0?48:50}" x2="30" y2="${92-bh}" stroke="#B69A78" stroke-width="1.6" stroke-dasharray="3 3"><animate attributeName="stroke-dashoffset" from="6" to="0" dur=".6s" repeatCount="indefinite"/></line>`:''}</g>
<path d="${G}" fill="none" stroke="#343330" stroke-width="2" stroke-linejoin="round"/><rect x="5" y="3" width="50" height="5" rx="2" fill="#632B38"/><rect x="5" y="92" width="50" height="5" rx="2" fill="#632B38"/></svg>`
}
/* ---- folha ---- */
function sheet(l, img) {
  const ph=img?`<figure class="ph"><img src="${img}" alt="Foto da carta" style="object-position:50% ${l.pos??50}%"></figure>`:'';
  const cv=l.layout=='cover'?ph:'';
  return`<article class="sheet t-${l.theme} ly-${l.layout}">${cv}<h2>${esc(l.title)}</h2>${l.layout!='cover'?ph:''}<div class="txt">${esc(l.body)}</div><p class="sig" style="clear:both">Escrita em ${fmt(l.created)}${l.cat?' · '+esc(l.cat):''}</p></article>`
}
/* ---- rotas ---- */
let sel=null, st;
function route() {
  const h=(location.hash||'#/').slice(2)||'home', m={home:'home', escrever:'write', cartas:'list'}, v=m[h.split('?')[0]]||'home';
  document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id=='v-'+v));
  document.querySelectorAll('nav a').forEach(a => a.removeAttribute('aria-current'));
  const a=document.querySelector(`nav a[href="#/${v=='home'?'':v=='write'?'escrever':'cartas'}"]`);
  a&&a.setAttribute('aria-current', 'page');
  window.scrollTo(0, 0);
  if(v=='home')initScroll();
  else {
    st&&st.kill(true);
    st=null
  }
  if(v=='write'){if(!cur)newLetter();else if(!$('#edMain').firstChild)fill()}
  if(v=='list')renderList()
}
addEventListener('hashchange', () => {
  if(!location.hash.startsWith('#/escrever'))cur=cur&&cur.id?null:cur;
  route()
});

/* ---- landing ---- */
const qs=$('#qs');
qs.innerHTML=CATS.map((c, i) => `<li><button type="button" aria-pressed="false" data-i="${i}"><b>${c[0]}</b>${c[1]}</button></li>`).join('');
qs.onclick=e => {
  const b=e.target.closest('button');
  if(!b)return;
  sel=CATS[b.dataset.i][0];
  qs.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x==b))
};
$('#goW').onclick=() => {
  newLetter(sel);
  location.hash='#/escrever'
};
$('#start').onclick=() => window.scrollTo({top:innerHeight*.9, behavior:'smooth'});
function initScroll() {
  if(st) {
    st.kill(true)
  }
  gsap.registerPlugin(ScrollTrigger);
  const lp=$('#lp'), H=Math.min(innerHeight*.78, 640), W=Math.min(innerWidth*.92, 600), red=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const end=() => {
    gsap.set('#flap', {rotationX:180, zIndex:0, opacity:0});
    gsap.set(['.front', '#seal', '.back'], {opacity:0});
    gsap.set(lp, {width:W, height:H, marginLeft:-W/2, top:10});
    gsap.set('#env', {y:(230-H)/2-10});
    gsap.set(['.qs li', '.lp h2', '.go'], {opacity:1})
  };
  if(red) {
    end();
    $('.stage').style.height='auto';
    $('.stage').style.minHeight='100vh';
    return
  }
  const tl=gsap.timeline({defaults:{ease:'none'}, scrollTrigger:{trigger:'#stage', start:'top top', end:'+=320%', pin:true, scrub:.6}});
  st=tl.scrollTrigger;
  tl.to('.hero', {opacity:0, y:-30, duration:.5}, 0).to('#start,#cue', {opacity:0, duration:.3}, 0).to('#seal', {opacity:0, scale:.6, duration:.4}, 0).to('#flap', {rotationX:180, duration:1}, .2).set('#flap', {zIndex:0}, .7).to(lp, {y:-34, duration:.8}, 1.2).to(lp, {width:W, height:H, marginLeft:-W/2, top:10, y:0, duration:1.6}, 2).to('#env', {y:(230-H)/2-10, duration:1.6}, 2).to(['.front', '.back', '#flap'], {opacity:0, duration:1}, 2.3).to('.lp h2', {opacity:1, duration:.4}, 3.2).to('.qs li', {opacity:1, stagger:.35, duration:.4}, 3.5).to('.go', {opacity:1, duration:.5}, 6.4)
}
/* ---- editor ---- */
let cur=null, ctx;
function newLetter(cat) {
  cur={title:'', body:'', created:Date.now(), open:Date.now()+864e5, cat:cat||'', theme:'classic', layout:'cover', pos:50, img:null, opened:false};
  cat==null&&(cur.cat='');
  fill()
}
$('#fCat').innerHTML='<option value="">Sem categoria</option>'+CATS.map(c => `<option>${c[0]}</option>`).join('');
$('#qC').innerHTML='<option value="">Todas as categorias</option>'+CATS.map(c => `<option>${c[0]}</option>`).join('');
const loc=t => {
  const d=new Date(t);
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0, 16)
};
function fill() {
  $('#edTitle').textContent=cur.id?'Editar sua carta':'Dê um título à sua carta';
  $('#fOpen').value=loc(cur.open);
  $('#fCat').value=cur.cat;
  $('#fTheme').value=cur.theme;
  $('#fLy').value=cur.layout;
  $('#fPos').value=cur.pos;
  $('#err').textContent='';
  editView()
}
function editView() {
  $('#bPrev').hidden=false;
  $('#edMain').innerHTML=`<div class="sheet paper t-${cur.theme}"><input class="ti" id="eT" maxlength="80" placeholder="Uma mensagem para o meu futuro…" aria-label="Título da carta" value="${esc(cur.title)}"><textarea id="eB" aria-label="Mensagem" placeholder="Comece escrevendo o que está no seu coração. Não precisa ser perfeito, só precisa ser seu.">${esc(cur.body)}</textarea><p class="sig">Escrita em ${fmt(cur.created)}${cur.cat?' · '+esc(cur.cat):''}</p></div>`;
  $('#phOpts').hidden=!cur.img;
  $('#addPh').textContent=cur.img?'Substituir foto':'Adicionar uma foto';
  const p=document.querySelector('.paper');
  $('#eT').oninput=e => cur.title=e.target.value;
  $('#eB').oninput=e => cur.body=e.target.value;
  $('#eB').onkeydown=$('#eT').onkeydown=e => {
    if(!$('#fSnd').checked)return;
    click(e.key=='Enter');
    p.classList.add('hit');
    requestAnimationFrame(() => setTimeout(() => p.classList.remove('hit'), 40))
  };
  if(cat0(cur))$('#eB').focus({preventScroll:true})
}
const cat0=c => c.cat&&!c.body&&!c.id&&matchMedia('(pointer:fine)').matches;
function click(bell) {
  try {
    ctx=ctx||new AudioContext();
    const n=ctx.createBufferSource(), b=ctx.createBuffer(1, 2205, 44100), d=b.getChannelData(0);
    for(let i=0; i<d.length; i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length, 4);
    n.buffer=b;
    const g=ctx.createGain();
    g.gain.value=.25;
    n.connect(g).connect(ctx.destination);
    n.start();
    if(bell) {
      const o=ctx.createOscillator(), h=ctx.createGain();
      o.frequency.value=1760;
      h.gain.setValueAtTime(.15, ctx.currentTime);
      h.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+.6);
      o.connect(h).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime+.6)
    }
  } catch{}
}
$('#fOpen').onchange=e => cur.open=new Date(e.target.value).getTime()||cur.open;
$('#fCat').onchange=e => {
  cur.cat=e.target.value;
  if(e.target.value) {
    const q=CATS.find(c => c[0]==cur.cat)[1];
    toast(q)
  }
};
$('#fTheme').onchange=e => {
  cur.theme=e.target.value;
  const p=document.querySelector('.paper');
  p&&(p.className='sheet paper t-'+cur.theme)
};
$('#fLy').onchange=e => cur.layout=e.target.value;
$('#fPos').oninput=e => cur.pos=+e.target.value;
$('#addPh').onclick=() => $('#fFile').click();
$('#fFile').onchange=e => {
  const f=e.target.files[0];
  if(!f)return;
  if(!f.type.startsWith('image/')) {
    $('#err').textContent='Escolha um arquivo de imagem (JPG, PNG ou WebP).';
    return
  }
  const im=new Image;
  im.onload=() => {
    const s=Math.min(1, 1000/Math.max(im.width, im.height)), c=document.createElement('canvas');
    c.width=im.width*s;
    c.height=im.height*s;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    cur.img=c.toDataURL('image/jpeg', .85);
    $('#err').textContent='';
    $('#phOpts').hidden=false;
    $('#addPh').textContent='Substituir foto';
    prev()
  };
  im.onerror=() => $('#err').textContent='Não foi possível ler esta imagem.';
  im.src=URL.createObjectURL(f);
  e.target.value=''
};
$('#rmPh').onclick=() => {
  cur.img=null;
  $('#phOpts').hidden=true;
  $('#addPh').textContent='Adicionar uma foto'
};
function prev() {
  if(!valid())return;
  $('#edMain').innerHTML=`<div class="pre">${sheet(cur,cur.img)}<p style="text-align:center"><button class="btn alt" id="bBack">Voltar à edição</button></p></div>`;
  $('#bBack').onclick=editView
}
$('#bPrev').onclick=prev;
function valid() {
  const m=!cur.title.trim()?'Dê um título à sua carta.':!cur.body.trim()?'Escreva algo na mensagem antes de continuar.':!(cur.open>Date.now())&&!cur.id?'Escolha uma data de abertura no futuro.':'';
  $('#err').textContent=m;
  return!m
}
$('#bSave').onclick=async() => {
  if(!valid())return;
  const a=Store.all(), {img, ...meta}=cur;
  meta.id=meta.id||'l'+Date.now().toString(36);
  meta.hasImg=!!img;
  meta.opened=meta.opened&&Date.now()>=meta.open;
  img?await idb('put', meta.id, img):await idb('del', meta.id);
  const i=a.findIndex(x => x.id==meta.id);
  i<0?a.push(meta):a[i]=meta;
  Store.save(a);
  cur=null;
  toast('Carta guardada. Até o dia certo.');
  location.hash='#/cartas'
};

/* ---- coleção ---- */
async function renderList() {
  const L=$('#list'), all=Store.all();
  if(!all.length) {
    L.innerHTML=`<div class="empty"><p>Você ainda não escreveu sua primeira carta. Que tal deixar uma mensagem para a pessoa que você será amanhã?</p><button class="btn" onclick="cur=null;location.hash='#/escrever'">Escrever minha primeira carta</button></div>`;
    return
  }
  const q=$('#qS').value.toLowerCase(), s=$('#qSt').value, c=$('#qC').value, o=$('#qO').value;
  let a=all.filter(l => (!q||(l.title+l.body).toLowerCase().includes(q))&&(!s||stateOf(l)==s)&&(!c||l.cat==c));
  a.sort((x, y) => o=='a'?x.open-y.open:o=='d'?y.open-x.open:y.created-x.created);
  if(!a.length) {
    L.innerHTML='<p class="empty">Nenhuma carta encontrada com estes filtros.</p>';
    return
  }
  const imgs=await Promise.all(a.map(l => l.hasImg?idb('get', l.id):null));
  L.innerHTML=a.map((l, i) => {
    const s=stateOf(l), th=['Carta clássica', 'Memórias em kraft', 'Diário vintage', 'Minimalista'][['classic', 'kraft', 'diary', 'minimal'].indexOf(l.theme)];
    return`<div class="card"><div class="hg">${hourglass(l)}<span>${remain(l)}</span></div>${imgs[i]?`<img class="thumb" src="${imgs[i]}" alt="">`:''}<div style="flex:1;min-width:0"><h3>${esc(l.title)}</h3><span class="badge ${s=='Pronta para ser aberta'?'ready':''}">${s}</span><small>Criada em ${fmt(l.created)}</small><small>Abre em ${fmt(l.open,1)} · ${th}</small><div class="row" style="margin-top:8px">${Date.now()>=l.open?`<button class="btn" data-a="open" data-id="${l.id}">Abrir carta</button>`:''}<button class="btn alt" data-a="edit" data-id="${l.id}">Editar</button><button class="btn alt" data-a="del" data-id="${l.id}">Excluir</button></div></div></div>`
  }).join('')
}
['#qS', '#qSt', '#qC', '#qO'].forEach(s => $(s).oninput=renderList);
$('#list').onclick=async e => {
  const b=e.target.closest('button[data-a]');
  if(!b)return;
  const a=Store.all(), l=a.find(x => x.id==b.dataset.id);
  if(!l)return;
  if(b.dataset.a=='edit') {
    cur={...l, img:l.hasImg?await idb('get', l.id):null};
    location.hash='#/escrever';
    fill()
  }
  if(b.dataset.a=='del')modal(`<h2>Excluir esta carta?</h2><p>“${esc(l.title)}” será apagada para sempre.</p><div class="row"><button class="btn" id="yes">Excluir</button><button class="btn alt" id="no">Cancelar</button></div>`, () => {
    $('#no').focus();
    $('#no').onclick=closeM;
    $('#yes').onclick=async() => {
      Store.save(a.filter(x => x.id!=l.id));
      await idb('del', l.id);
      closeM();
      renderList();
      toast('Carta excluída.')
    }
  });
  if(b.dataset.a=='open')reveal(l)
}
/* ---- abertura ---- */
function modal(h, f) {
  $('#box').innerHTML=h;
  $('#modal').classList.add('on');
  f&&f()
}
function closeM() {
  $('#modal').classList.remove('on')
}
$('#modal').onclick=e => {
  if(e.target.id=='modal')closeM()
};
addEventListener('keydown', e => e.key=='Escape'&&closeM());
async function reveal(l) {
  const img=l.hasImg?await idb('get', l.id):null, show=() => {
    $('#box').innerHTML=`<p class="slide"><i>O tempo passou. Agora é hora de reencontrar quem você era.</i></p><div class="slide">${sheet(l,img)}</div><p><button class="btn" id="cl">Fechar</button></p>`;
    $('#cl').onclick=() => {
      closeM();
      renderList()
    };
    $('#cl').focus()
  };
  if(l.opened)return modal('', show);
  modal(`<h2>Chegou o momento</h2><p>Toque no envelope para abrir.</p><button class="renv" id="re" aria-label="Abrir o envelope"><span class="fl"></span></button>`, () => {
    $('#re').focus();
    $('#re').onclick=() => {
      $('#re').classList.add('open');
      const a=Store.all(), x=a.find(y => y.id==l.id);
      x.opened=true;
      Store.save(a);
      l.opened=true;
      setTimeout(show, matchMedia('(prefers-reduced-motion:reduce)').matches?0:1000)
    }
  })
}
setInterval(() => $('#v-list').classList.contains('on')&&!$('#modal').classList.contains('on')&&renderList(), 60000);
route();