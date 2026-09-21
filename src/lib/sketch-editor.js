/* eslint-disable */
// 약도그림판 편집기. 순수 DOM/SVG로 만든 단일 모듈(의존성 없음).
// React 페이지가 mountSketchEditor(root)로 붙이고, 반환된 함수로 떼어낸다.
// 상태는 브라우저 localStorage("carshare-sketch")에만 저장(서버 미저장).

const CSS = `.skx{
    --bg:#eef1f5; --panel:#ffffff; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0;
    --accent:#2563eb; --shadow:0 1px 0 rgba(255,255,255,.7) inset, 0 12px 30px -18px rgba(15,23,42,.35);
    --inset:inset 0 1px 3px rgba(15,23,42,.08);
  }
.skx *{box-sizing:border-box}
.skx,.skx{height:100%;margin:0;position:relative}
.skx{font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;background:var(--bg);color:var(--ink);overflow:hidden;font-size:13px}
.skx button{font:inherit}
.skx{display:grid;grid-template-rows:56px 1fr;height:100%}
.skx .top{display:flex;align-items:center;gap:8px;padding:0 14px;background:#0f172a;color:#fff;box-shadow:0 8px 24px -12px rgba(15,23,42,.6);z-index:20;overflow-x:auto}
.skx .top h1{font-size:17px;margin:0 8px 0 0;letter-spacing:-.2px;display:flex;align-items:center;gap:8px;white-space:nowrap}
.skx .top h1 span{font-size:10px;font-weight:700;background:#f59e0b;color:#0f172a;padding:2px 7px;border-radius:999px}
.skx .top input{flex:0 0 auto;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;padding:7px 10px;font-size:12px;outline:none;box-shadow:var(--inset);min-width:0}
.skx .top input::placeholder{color:rgba(255,255,255,.4)}
.skx .top input:focus{border-color:#93c5fd}
.skx .tbtn{border:0;border-radius:999px;padding:8px 12px;font-weight:700;font-size:12px;cursor:pointer;color:#fff;background:rgba(255,255,255,.12);transition:all .15s;box-shadow:0 1px 0 rgba(255,255,255,.15) inset;white-space:nowrap}
.skx .tbtn:hover{background:rgba(255,255,255,.22);transform:translateY(-1px)}
.skx .tbtn:active{transform:scale(.96)}
.skx .tbtn.primary{background:var(--accent);box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 8px 18px -6px rgba(37,99,235,.7)}
.skx .sp{flex:1}
.skx .main{display:grid;grid-template-columns:244px minmax(0,1fr) 300px;min-height:0}
.skx .panel{background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;min-width:0}
.skx .panel.right{border-right:0;border-left:1px solid var(--line)}
.skx .tabs{display:flex;gap:4px;padding:10px 10px 0;background:#f8fafc;border-bottom:1px solid var(--line)}
.skx .tab{flex:1;border:0;background:transparent;padding:8px 4px;font-weight:700;font-size:11px;color:var(--muted);border-radius:10px 10px 0 0;cursor:pointer;white-space:nowrap}
.skx .tab.on{background:#fff;color:var(--accent);box-shadow:0 -4px 12px -8px rgba(37,99,235,.5);border:1px solid var(--line);border-bottom-color:#fff;margin-bottom:-1px}
.skx .pal{overflow:auto;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start;flex:1;min-height:0}
.skx .item{border:1px solid var(--line);border-radius:14px;background:#fff;padding:8px 6px 6px;cursor:grab;text-align:center;transition:all .15s;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 4px 12px -8px rgba(15,23,42,.3);user-select:none}
.skx .item:hover{border-color:#93c5fd;transform:translateY(-2px);box-shadow:0 10px 20px -10px rgba(37,99,235,.45)}
.skx .item:active{transform:scale(.97)}
.skx .item svg{width:100%;height:50px;display:block}
.skx .item b{display:block;font-size:11px;margin-top:4px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.skx .hint{padding:10px 12px;font-size:11px;color:var(--muted);border-top:1px solid var(--line);line-height:1.6;background:#f8fafc}
.skx .stage{position:relative;overflow:hidden;background:radial-gradient(circle at 1px 1px, rgba(15,23,42,.10) 1px, transparent 0) 0 0/24px 24px, #e5e9ef;min-width:0}
.skx .stage svg.canvas{width:100%;height:100%;display:block;touch-action:none;cursor:default}
.skx .float{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:6px;background:rgba(15,23,42,.9);color:#fff;padding:6px 8px;border-radius:999px;box-shadow:0 12px 30px -10px rgba(15,23,42,.7);backdrop-filter:blur(6px);white-space:nowrap}
.skx .float button{border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:999px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer}
.skx .float button:hover{background:rgba(255,255,255,.22)}
.skx .float .z{padding:6px 10px;font-variant-numeric:tabular-nums;opacity:.8}
.skx .props{padding:14px;overflow:auto;display:flex;flex-direction:column;gap:12px;flex:1;min-height:0}
.skx .props h3{margin:0;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center}
.skx .props .title{font-size:16px;font-weight:900}
.skx .field{display:flex;flex-direction:column;gap:5px;min-width:0}
.skx .field label{font-size:11px;font-weight:700;color:var(--muted)}
.skx .field input[type=text],.skx .field input[type=number],.skx .field select{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:10px;padding:7px 9px;font-size:13px;outline:none;box-shadow:var(--inset);background:#fff}
.skx .field input:focus,.skx .field select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.15)}
.skx .row{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:0}
.skx .seg{display:flex;background:#f1f5f9;border-radius:10px;padding:3px;box-shadow:var(--inset);flex-wrap:wrap}
.skx .seg button{flex:1;border:0;background:transparent;border-radius:8px;padding:6px 4px;font-weight:700;font-size:11px;color:var(--muted);cursor:pointer;min-width:38px}
.skx .seg button.on{background:#fff;color:var(--ink);box-shadow:0 2px 6px -2px rgba(15,23,42,.3)}
.skx .swatches{display:flex;gap:6px;flex-wrap:wrap}
.skx .sw{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1,0 3px 6px -2px rgba(0,0,0,.3);cursor:pointer}
.skx .sw.on{box-shadow:0 0 0 2px var(--accent),0 3px 6px -2px rgba(0,0,0,.3)}
.skx .btnrow{display:flex;gap:6px;flex-wrap:wrap}
.skx .sbtn{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 10px;font-weight:700;font-size:11px;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 2px 4px -2px rgba(15,23,42,.3)}
.skx .sbtn:hover{background:#f8fafc}
.skx .sbtn.danger{color:#b91c1c;border-color:#fecaca}
.skx .empty{color:var(--muted);font-size:12px;line-height:1.7;background:#f8fafc;border-radius:12px;padding:12px;box-shadow:var(--inset)}
.skx input[type=range]{width:100%}
.skx .lanebox{border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;background:#f8fafc;box-shadow:var(--inset)}
.skx .lanebox .lh{font-size:11px;font-weight:800;color:#334155;display:flex;align-items:center;gap:6px}
.skx .lane{display:grid;grid-template-columns:52px 1fr 44px;gap:6px;align-items:center}
.skx .lane .ln{font-size:11px;font-weight:700;color:var(--muted)}
.skx .lane select{padding:5px 6px !important;font-size:12px !important}
.skx .lane .bus{display:flex;align-items:center;gap:3px;font-size:10px;font-weight:700;color:#1d4ed8;white-space:nowrap}
.skx .legend{position:absolute;right:14px;top:14px;background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:12px;padding:8px 10px;font-size:11px;box-shadow:var(--shadow);display:flex;gap:10px;align-items:center;white-space:nowrap}
.skx .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.skx .toast{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:#059669;color:#fff;padding:8px 14px;border-radius:999px;font-weight:700;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}
.skx .toast.show{opacity:1}
.skx .propsBtn,.skx .closeBtn{display:none}
@media (max-width:1100px){.skx .main{grid-template-columns:minmax(0,1fr);grid-template-rows:150px minmax(0,1fr)}
.skx .panel:not(.right){border-right:0;border-bottom:1px solid var(--line)}
.skx .tabs{padding:6px 8px 0}
.skx .pal{display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;gap:6px;padding:8px}
.skx .item{flex:0 0 92px}
.skx .item svg{height:38px}
.skx .hint{display:none}
.skx .panel.right{position:fixed;right:0;top:113px;bottom:0;width:min(330px,94vw);transform:translateX(105%);transition:transform .22s ease;box-shadow:-16px 0 40px -20px rgba(15,23,42,.5);z-index:15}
.skx .panel.right.open{transform:none}
.skx .propsBtn{display:block;position:absolute;right:12px;bottom:14px;border:0;border-radius:999px;padding:10px 14px;font-weight:800;background:#0f172a;color:#fff;box-shadow:0 12px 30px -10px rgba(15,23,42,.7);cursor:pointer;z-index:10}
.skx .closeBtn{display:inline-block;border:0;background:#f1f5f9;border-radius:999px;padding:4px 9px;font-weight:800;cursor:pointer}
.skx .float{bottom:14px;left:12px;transform:none}
.skx .legend{display:none}
}
`;

const MARKUP = `
  <div class="top">
    <h1>약도그림판 <span>BETA</span></h1>
    <input id="fDate" placeholder="사고 일시" style="width:150px" />
    <input id="fPlace" placeholder="사고 장소" style="width:200px" />
    <div class="sp"></div>
    <button class="tbtn" id="bUndo" title="Ctrl+Z">↶</button>
    <button class="tbtn" id="bRedo" title="Ctrl+Y">↷</button>
    <button class="tbtn" id="bClear">새로</button>
    <button class="tbtn" id="bSample">샘플</button>
    <button class="tbtn" id="bJsonSave">JSON 저장</button>
    <button class="tbtn" id="bJsonLoad">JSON 열기</button>
    <input type="file" id="fJson" accept="application/json" style="display:none" />
    <button class="tbtn primary" id="bPng">⬇ PNG</button>
  </div>
  <div class="main">
    <div class="panel">
      <div class="tabs" id="tabs"></div>
      <div class="pal" id="pal"></div>
      <div class="hint">클릭하면 화면 중앙에 놓임. 드래그 이동 · 위 원 손잡이 회전 · 네 변 손잡이로 그쪽만 늘리기 · Delete 삭제 · Ctrl+D 복제 · Ctrl+Z 취소 · R 15° 회전 · 휠 확대 · 스페이스+드래그 화면 이동</div>
    </div>
    <div class="stage" id="stage">
      <svg class="canvas" id="svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="legend"><span><i style="background:#2563eb"></i>자차</span><span><i style="background:#dc2626"></i>대물 1·2·…</span><span><i style="background:#f59e0b;border-radius:50%"></i>충돌 지점</span></div>
      <div class="float">
        <button id="zOut">−</button><span class="z" id="zLbl">100%</span><button id="zIn">+</button><button id="zFit">맞춤</button>
        <button id="gridBtn">스냅 켬</button>
      </div>
      <button class="propsBtn" id="propsBtn">속성 ▸</button>
      <div class="toast" id="toast">저장됨</div>
    </div>
    <div class="panel right" id="rightPanel"><div class="props" id="props"></div></div>
  </div>`;

export function mountSketchEditor(root) {
  root.classList.add("skx");
  root.innerHTML = "<style>" + CSS + "</style>" + MARKUP;
  const winL = [];
  const onWin = (t, f, o) => { window.addEventListener(t, f, o); winL.push([t, f, o]); };

const PAGE = {w:1123, h:794};
const byId=(id)=>root.querySelector('#'+id);
const SVG = byId('svg');
const $ = (id)=>byId(id);
let objs=[], sel=null, view={x:-40,y:-40,k:1}, snap=true, undo=[], redo=[];
const uid=()=>Math.random().toString(36).slice(2,9);
const clone=(o)=>JSON.parse(JSON.stringify(o));

/* ---------- 팔레트 ---------- */
const CATS=[
 {key:'road',name:'도로',items:[
   {type:'road',name:'직선도로',w:700,h:136,p:{lanes:4,center:'double',oneway:false,marks:{},bus:{}}},
   {type:'cross',name:'교차로 ┼',w:280,h:136,p:{lanes:4,cw:true,marks:{},bus:{},arms:{E:280,S:280,W:280,N:280}}},
   {type:'tee',name:'T자로 ┬',w:280,h:136,p:{lanes:4,cw:true,marks:{},bus:{},arms:{E:280,S:280,W:280}}},
   {type:'round',name:'회전교차로',w:260,h:68,p:{arm:180,lanes:2,armLanes:2,marks:{},bus:{}}},
   {type:'curve',name:'곡선도로',w:420,h:136,p:{}},
   {type:'crosswalk',name:'횡단보도',w:136,h:60,p:{}},
   {type:'stopline',name:'정지선',w:136,h:6,p:{}},
   {type:'zebra',name:'안전지대',w:200,h:50,p:{}},
   {type:'school',name:'어린이 보호구역',w:320,h:70,p:{speed:30}},
   {type:'bump',name:'과속방지턱',w:136,h:16,p:{}},
   {type:'sidewalk',name:'인도',w:700,h:44,p:{}},
   {type:'parking',name:'주차구획',w:320,h:120,p:{slots:5}},
 ]},
 {key:'obj',name:'물체',items:[
   {type:'car',name:'승용',w:64,h:29,p:{kind:'car',role:'대물',n:1,color:'',size:1}},
   {type:'car',name:'화물',w:100,h:34,p:{kind:'truck',role:'대물',n:1,color:'',size:1}},
   {type:'car',name:'버스',w:130,h:37,p:{kind:'bus',role:'대물',n:1,color:'',size:1}},
   {type:'car',name:'이륜차',w:42,h:17,p:{kind:'bike',role:'대물',n:1,color:'',size:1}},
   {type:'person',name:'보행자',w:16,h:16,p:{color:'#0f172a',label:'',size:1.4}},
   {type:'guard',name:'가드레일',w:500,h:12,p:{}},
   {type:'signal',name:'신호등',w:24,h:24,p:{state:'green'}},
   {type:'sign',name:'표지판',w:30,h:30,p:{kind:'stop'}},
   {type:'busstop',name:'버스정류장',w:70,h:22,p:{}},
   {type:'building',name:'건물',w:160,h:110,p:{text:'건물'}},
   {type:'tree',name:'가로수',w:28,h:28,p:{}},
   {type:'view',name:'시야 차단',w:80,h:50,p:{}},
 ]},
 {key:'mark',name:'표시',items:[
   {type:'arrow',name:'진행 화살표',w:120,h:16,p:{color:'#2563eb',curve:0,text:''}},
   {type:'arrow',name:'곡선 화살표',w:140,h:70,p:{color:'#dc2626',curve:60,text:''}},
   {type:'collision',name:'충돌 지점',w:30,h:30,p:{n:0}},
   {type:'skid',name:'스키드마크',w:120,h:16,p:{}},
   {type:'stopbox',name:'정지 위치',w:56,h:28,p:{color:'#2563eb'}},
   {type:'dim',name:'거리 치수',w:110,h:20,p:{text:'약 3.5m'}},
   {type:'num',name:'번호 ①',w:22,h:22,p:{n:1}},
   {type:'compass',name:'방위',w:40,h:40,p:{}},
   {type:'text',name:'텍스트',w:120,h:24,p:{text:'설명 입력',size:13,color:'#0f172a'}},
   {type:'debris',name:'파편',w:40,h:24,p:{}},
 ]},
];
// 세로가 기본값: 방향이 있는 것은 놓을 때 270°(앞·진행이 위쪽, 상행 차로가 오른쪽). 대칭인 것만 0°
const NO_ROT=new Set(['cross','round','collision','num','compass','text','building','tree','view','sign','signal','busstop','debris','person','dim','crosswalk','zebra']);
const defRot=(type)=> NO_ROT.has(type) ? 0 : 270;
// 형태가 고정된 것: 네 변 손잡이 대신 '크기' 슬라이더로 비례 확대(회전만 손잡이)
const FIXED=new Set(['car','person','signal','sign','tree','compass','num','collision','busstop','debris']);
const sizeOf=(o)=> FIXED.has(o.type) ? (o.p.size||1) : 1;
// 층: 도로(0) < 노면 요소(1) < 물체(2) < 표시(3). 맨 앞/맨 뒤는 같은 층 안에서만 움직임
const TIER={road:0,cross:0,tee:0,round:0,curve:0, crosswalk:1,stopline:1,zebra:1,school:1,bump:1,sidewalk:1,parking:1, collision:3,arrow:3,skid:3,stopbox:3,dim:3,num:3,compass:3,text:3,debris:3,view:3};
const tierOf=(o)=> TIER[o.type] ?? 2;
const ordered=()=> objs.map((o,i)=>[o,i]).sort((a,b)=> (tierOf(a[0])-tierOf(b[0])) || (a[1]-b[1])).map(x=>x[0]);
const armLen=(o,k)=> (o.p.arms&&o.p.arms[k]) || o.w;
const ROLE_COLOR={자차:'#2563eb',대물:'#dc2626'};
const carLabel=(o)=> o.p.role==='자차' ? '자차' : `대물${o.p.n||1}`;
const carColor=(o)=> o.p.color || ROLE_COLOR[o.p.role||'대물'];

/* ---------- 차선 표기 글리프 (진행방향 +x, 중심 0,0) ---------- */
const GLYPH_NAMES={none:'없음',s:'직진',l:'좌회전',r:'우회전',sl:'직진·좌',sr:'직진·우',lr:'좌·우',u:'유턴',su:'직진·유턴'};
function glyph(kind,c='#f8fafc'){
  const head=(x,y,dir)=>{ // dir: 'x' → +x 방향, '-y' → 위, '+y' → 아래, '-x' → 뒤
    if(dir==='x') return `<polygon points="${x},${y-6} ${x+11},${y} ${x},${y+6}" fill="${c}"/>`;
    if(dir==='-y') return `<polygon points="${x-6},${y} ${x},${y-11} ${x+6},${y}" fill="${c}"/>`;
    if(dir==='+y') return `<polygon points="${x-6},${y} ${x},${y+11} ${x+6},${y}" fill="${c}"/>`;
    return `<polygon points="${x},${y-6} ${x-11},${y} ${x},${y+6}" fill="${c}"/>`;
  };
  const sh=`stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"`;
  switch(kind){
    case 's': return `<line x1="-16" y1="0" x2="6" y2="0" ${sh}/>${head(6,0,'x')}`;
    case 'l': return `<path d="M -16 0 L -4 0 Q 2 0 2 -6 L 2 -7" ${sh}/>${head(2,-7,'-y')}`;
    case 'r': return `<path d="M -16 0 L -4 0 Q 2 0 2 6 L 2 7" ${sh}/>${head(2,7,'+y')}`;
    case 'sl': return `<line x1="-16" y1="0" x2="6" y2="0" ${sh}/>${head(6,0,'x')}<path d="M -8 0 Q -2 0 -2 -6 L -2 -8" ${sh}/>${head(-2,-8,'-y')}`;
    case 'sr': return `<line x1="-16" y1="0" x2="6" y2="0" ${sh}/>${head(6,0,'x')}<path d="M -8 0 Q -2 0 -2 6 L -2 8" ${sh}/>${head(-2,8,'+y')}`;
    case 'lr': return `<line x1="-16" y1="0" x2="0" y2="0" ${sh}/><path d="M 0 0 L 0 -8" ${sh}/>${head(0,-8,'-y')}<path d="M 0 0 L 0 8" ${sh}/>${head(0,8,'+y')}`;
    case 'u': return `<path d="M -16 0 L 0 0 A 6 6 0 0 0 0 -12 L -6 -12" ${sh}/>${head(-6,-12,'-x')}`;
    case 'su': return `<line x1="-16" y1="0" x2="6" y2="0" ${sh}/>${head(6,0,'x')}<path d="M -10 0 A 6 6 0 0 0 -10 -12 L -13 -12" ${sh}/>${head(-13,-12,'-x')}`;
    default: return '';
  }
}

/* ---------- 도로 그리기 도우미 ---------- */
const ASPH='#4b5563', LINE='#f8fafc', YEL='#facc15', BLUE='#3b82f6';
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
// 가로 도로 구간 [x0,x1], 폭 W, 총 차로 N. 양방향이면 아래쪽(y>0)이 +x 진행(우측통행), 위쪽이 -x 진행.
// marks: {E1:'s', W1:'l', ...} E=+x 진행 차로(아래), W=-x 진행 차로(위). oneway면 전부 +x 진행, 키 E1..EN (위에서부터).
// markX: {E:x, W:x} 표기 위치. 없으면 각 방향의 진행 끝 쪽.
function strip(x0,x1,W,N,p,markX){
  let s=`<rect x="${x0}" y="${-W/2}" width="${x1-x0}" height="${W}" fill="${ASPH}"/>`;
  s+=`<line x1="${x0}" y1="${-W/2+1.5}" x2="${x1}" y2="${-W/2+1.5}" stroke="${LINE}" stroke-width="2"/><line x1="${x0}" y1="${W/2-1.5}" x2="${x1}" y2="${W/2-1.5}" stroke="${LINE}" stroke-width="2"/>`;
  const lw = p.oneway ? W/N : W/N; // 차로폭
  const marks=p.marks||{}, bus=p.bus||{};
  const laneRows=[]; // {key, y, dir(+1|-1)}
  if(p.oneway){ for(let i=1;i<=N;i++) laneRows.push({key:'E'+i, y:-W/2+(i-0.5)*lw, dir:1}); for(let k=1;k<N;k++) s+=`<line x1="${x0}" y1="${-W/2+k*lw}" x2="${x1}" y2="${-W/2+k*lw}" stroke="${LINE}" stroke-width="2" stroke-dasharray="18 14"/>`; }
  else { const half=Math.max(1,Math.floor(N/2)); const lw2=(W/2)/half;
    for(let i=1;i<=half;i++){ laneRows.push({key:'E'+i,y:(i-0.5)*lw2,dir:1}); laneRows.push({key:'W'+i,y:-(i-0.5)*lw2,dir:-1}); }
    for(let k=1;k<half;k++){ s+=`<line x1="${x0}" y1="${k*lw2}" x2="${x1}" y2="${k*lw2}" stroke="${LINE}" stroke-width="2" stroke-dasharray="18 14"/><line x1="${x0}" y1="${-k*lw2}" x2="${x1}" y2="${-k*lw2}" stroke="${LINE}" stroke-width="2" stroke-dasharray="18 14"/>`; }
    if(N>1){ if(p.center==='solid') s+=`<line x1="${x0}" y1="0" x2="${x1}" y2="0" stroke="${YEL}" stroke-width="3"/>`;
      if(p.center==='dashed') s+=`<line x1="${x0}" y1="0" x2="${x1}" y2="0" stroke="${YEL}" stroke-width="3" stroke-dasharray="20 14"/>`;
      if(p.center==='double') s+=`<line x1="${x0}" y1="-3" x2="${x1}" y2="-3" stroke="${YEL}" stroke-width="2.5"/><line x1="${x0}" y1="3" x2="${x1}" y2="3" stroke="${YEL}" stroke-width="2.5"/>`; }
  }
  const laneH = p.oneway ? lw : (W/2)/Math.max(1,Math.floor(N/2));
  for(const L of laneRows){
    if(bus[L.key]){ // 버스전용: 차로 양 경계 파란 실선 + 글자
      s+=`<line x1="${x0}" y1="${L.y-laneH/2}" x2="${x1}" y2="${L.y-laneH/2}" stroke="${BLUE}" stroke-width="3"/><line x1="${x0}" y1="${L.y+laneH/2}" x2="${x1}" y2="${L.y+laneH/2}" stroke="${BLUE}" stroke-width="3"/>`;
      const tx=(x0+x1)/2; s+=`<text x="${tx}" y="${L.y+4}" text-anchor="middle" font-size="10" font-weight="900" fill="${BLUE}" transform="rotate(${L.dir>0?0:180} ${tx} ${L.y})">버스전용</text>`; }
    const m=marks[L.key]; if(m&&m!=='none'){ const mx = markX? markX[L.dir>0?'E':'W'] : (L.dir>0? x1-30 : x0+30); const sc=Math.min(1,laneH/30);
      s+=`<g transform="translate(${mx},${L.y}) rotate(${L.dir>0?0:180}) scale(${sc})">${glyph(m)}</g>`; }
  }
  return s;
}
function crosswalkStripes(x,y,w,h,vertical){ let s=''; const n=Math.max(3,Math.floor((vertical?h:w)/14)); for(let i=0;i<n;i+=2){ if(vertical) s+=`<rect x="${x}" y="${y+i*(h/n)}" width="${w}" height="${h/n}" fill="${LINE}"/>`; else s+=`<rect x="${x+i*(w/n)}" y="${y}" width="${w/n}" height="${h}" fill="${LINE}"/>`; } return s; }
// 교차로 팔: 오른쪽 팔 템플릿(x∈[h, a+h])을 회전해 4방향. 접근 차로 = 위쪽(-x 진행) → 표기 키 prefix+i
function arm(a,h,W,N,p,prefix){
  const marks={}, bus={}; const half=Math.max(1,Math.floor(N/2));
  for(let i=1;i<=half;i++){ if(p.marks&&p.marks[prefix+i]) marks['W'+i]=p.marks[prefix+i]; if(p.bus&&p.bus[prefix+i]) bus['W'+i]=true; }
  let s=strip(h,a+h,W,N,{lanes:N,center:'solid',oneway:false,marks,bus},{W:h+(p.cw?56:38),E:a+h-30});
  // 박스 안쪽으로 중앙선이 이어지지 않게 끊고, 정지선·횡단보도
  s+=`<rect x="${h}" y="-2" width="24" height="4" fill="${ASPH}"/>`;
  if(p.cw){ s+=crosswalkStripes(h+6,-W/2+4,16,W-8,true); s+=`<rect x="${h+26}" y="${-W/2+2}" width="4" height="${W/2-3}" fill="${LINE}"/>`; }
  else s+=`<rect x="${h+4}" y="${-W/2+2}" width="4" height="${W/2-3}" fill="${LINE}"/>`;
  return s;
}
function crossBox(W){ return `<rect x="${-W/2}" y="${-W/2}" width="${W}" height="${W}" fill="${ASPH}"/>`; }

/* ---------- 렌더러 ---------- */
const R={
  road:(o)=>strip(-o.w/2,o.w/2,o.h,o.p.lanes||2,o.p),
  cross:(o)=>{ const W=o.h,h=W/2,N=o.p.lanes||4; return crossBox(W)+[['E',0],['S',90],['W',180],['N',270]].map(([k,r])=>`<g transform="rotate(${r})">${arm(armLen(o,k),h,W,N,o.p,k)}</g>`).join(''); },
  tee:(o)=>{ const W=o.h,h=W/2,N=o.p.lanes||4; return crossBox(W)+`<line x1="${-h}" y1="${-h+1.5}" x2="${h}" y2="${-h+1.5}" stroke="${LINE}" stroke-width="2"/>`+[['E',0],['S',90],['W',180]].map(([k,r])=>`<g transform="rotate(${r})">${arm(armLen(o,k),h,W,N,o.p,k)}</g>`).join(''); },
  round:(o)=>{ const Ro=o.w/2, L=Math.max(1,o.p.lanes||1), rw=o.h, lw=rw/L, Ri=Ro-rw, arm=o.p.arm||90, N=o.p.armLanes||2, half=Math.max(1,Math.floor(N/2)), aw=N*lw; let s='';
    for(const [k,r] of [['E',0],['S',90],['W',180],['N',270]]){ const marks={},bus={}; for(let i=1;i<=half;i++){ if(o.p.marks&&o.p.marks[k+i]) marks['W'+i]=o.p.marks[k+i]; if(o.p.bus&&o.p.bus[k+i]) bus['W'+i]=true; }
      s+=`<g transform="rotate(${r})">${strip(Ri,Ro+arm,aw,N,{lanes:N,center:'solid',oneway:false,marks,bus},{W:Ro+34,E:Ro+arm-30})}<rect x="${Ri}" y="-2" width="${Ro-Ri+8}" height="4" fill="${ASPH}"/><line x1="${Ro+6}" y1="${-aw/2+2}" x2="${Ro+6}" y2="-2" stroke="${LINE}" stroke-width="3" stroke-dasharray="5 4"/></g>`; }
    s+=`<circle r="${Ro}" fill="${ASPH}"/><circle r="${Ro-1.5}" fill="none" stroke="${LINE}" stroke-width="2"/>`;
    for(let k=1;k<L;k++) s+=`<circle r="${Ri+k*lw}" fill="none" stroke="${LINE}" stroke-width="2" stroke-dasharray="12 9"/>`;
    s+=`<circle r="${Ri}" fill="#86efac" stroke="#16a34a" stroke-width="3"/><circle r="${Math.max(4,Ri*0.45)}" fill="#4ade80"/>`;
    const rm=Ri+lw/2; const sc=Math.min(1,lw/30); for(const d of [45,135,225,315]){ const a1=d*Math.PI/180; s+=`<g transform="translate(${Math.cos(a1)*rm},${Math.sin(a1)*rm}) rotate(${d-90}) scale(${sc})">${glyph('s')}</g>`; }
    return s; },
  curve:(o)=>{ const L=o.w,W=o.h; const d=`M ${-L/2} ${W/2} Q 0 ${-W*1.2} ${L/2} ${W/2}`; return `<path d="${d}" fill="none" stroke="${ASPH}" stroke-width="${W}"/><path d="${d}" fill="none" stroke="${LINE}" stroke-width="2" transform="translate(0,${-W/2+2})"/><path d="${d}" fill="none" stroke="${LINE}" stroke-width="2" transform="translate(0,${W/2-2})"/><path d="${d}" fill="none" stroke="${YEL}" stroke-width="3"/>`; },
  crosswalk:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="${ASPH}"/>`+crosswalkStripes(-o.w/2+3,-o.h/2,o.w-6,o.h,false),
  stopline:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="${LINE}"/>`,
  zebra:(o)=>{ let s=`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="${ASPH}" stroke="${LINE}" stroke-width="2.5"/>`; for(let x=-o.w/2+8;x<o.w/2+o.h;x+=14) s+=`<line x1="${x}" y1="${-o.h/2}" x2="${x-o.h}" y2="${o.h/2}" stroke="${LINE}" stroke-width="2.5" clip-path="inset(0)"/>`; return `<g clip-path="url(#clip-${o.id})"><clipPath id="clip-${o.id}"><rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}"/></clipPath>${s}</g>`; },
  guard:(o)=>{ let s=`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/><line x1="${-o.w/2}" y1="0" x2="${o.w/2}" y2="0" stroke="#64748b" stroke-width="1"/>`; for(let x=-o.w/2+10;x<o.w/2;x+=30) s+=`<rect x="${x-2}" y="${-o.h/2-2}" width="4" height="${o.h+4}" rx="1" fill="#334155"/>`; return s; },
  school:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="#dc2626" opacity=".45"/><rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="none" stroke="#fecaca" stroke-width="2" stroke-dasharray="10 6"/><text y="-4" text-anchor="middle" font-size="${Math.min(16,o.h*0.28)}" font-weight="900" fill="#fff" letter-spacing="2">어린이 보호구역</text><g transform="translate(0,${Math.min(16,o.h*0.28)+2})"><circle r="${Math.min(12,o.h*0.2)}" fill="#fff" stroke="#dc2626" stroke-width="2.5"/><text y="4" text-anchor="middle" font-size="${Math.min(11,o.h*0.18)}" font-weight="900" fill="#0f172a">${o.p.speed||30}</text></g>`,
  sidewalk:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="#d6d3d1"/><line x1="${-o.w/2}" y1="${o.h/2-1}" x2="${o.w/2}" y2="${o.h/2-1}" stroke="#78716c" stroke-width="2"/>`,
  parking:(o)=>{ const n=o.p.slots||4,sw=o.w/n; let s=`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="#6b7280"/>`; for(let i=0;i<=n;i++) s+=`<line x1="${-o.w/2+i*sw}" y1="${-o.h/2}" x2="${-o.w/2+i*sw}" y2="${o.h/2}" stroke="${LINE}" stroke-width="2"/>`; s+=`<line x1="${-o.w/2}" y1="${-o.h/2}" x2="${o.w/2}" y2="${-o.h/2}" stroke="${LINE}" stroke-width="2"/>`; return s; },
  bump:(o)=>{ let s=''; const n=Math.floor(o.w/12); for(let i=0;i<n;i++) s+=`<rect x="${-o.w/2+i*12}" y="${-o.h/2}" width="12" height="${o.h}" fill="${i%2?'#facc15':'#f8fafc'}"/>`; return s+`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="none" stroke="#475569"/>`; },
  busstop:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" rx="4" fill="#fff" stroke="${BLUE}" stroke-width="2"/><text y="4" text-anchor="middle" font-size="10" font-weight="900" fill="#1d4ed8">버스정류장</text>`,
  signal:(o)=>{ const st=o.p.state||'green'; const lit=(k)=>st===k?1:0.25; return `<rect x="-8" y="-12" width="16" height="24" rx="4" fill="#111827"/><circle cx="0" cy="-6" r="3" fill="#ef4444" opacity="${lit('red')}"/><circle cx="0" cy="0" r="3" fill="#facc15" opacity="${lit('yellow')}"/><circle cx="0" cy="6" r="3" fill="#22c55e" opacity="${lit('green')}"/>${st==='left'?`<text x="0" y="9" text-anchor="middle" font-size="8" font-weight="900" fill="#22c55e">←</text>`:''}`; },
  sign:(o)=> o.p.kind==='stop' ? `<polygon points="-8,-15 8,-15 15,-8 15,8 8,15 -8,15 -15,8 -15,-8" fill="#dc2626" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">정지</text>`
    : o.p.kind==='yield' ? `<polygon points="-15,-13 15,-13 0,14" fill="#fff" stroke="#dc2626" stroke-width="4"/>`
    : o.p.kind==='noleft' ? `<circle r="15" fill="#fff" stroke="#dc2626" stroke-width="4"/><text y="5" text-anchor="middle" font-size="12" font-weight="900" fill="#0f172a">↰</text><line x1="-9" y1="-9" x2="9" y2="9" stroke="#dc2626" stroke-width="3"/>`
    : `<circle r="15" fill="#fff" stroke="#dc2626" stroke-width="4"/><text y="5" text-anchor="middle" font-size="12" font-weight="900" fill="#0f172a">${o.p.speed||30}</text>`,
  building:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" fill="#e7e5e4" stroke="#78716c" stroke-width="2"/><line x1="${-o.w/2}" y1="${-o.h/2}" x2="${o.w/2}" y2="${o.h/2}" stroke="#a8a29e" stroke-width="1"/><line x1="${o.w/2}" y1="${-o.h/2}" x2="${-o.w/2}" y2="${o.h/2}" stroke="#a8a29e" stroke-width="1"/><rect x="-30" y="-9" width="60" height="18" rx="4" fill="#fff" stroke="#a8a29e"/><text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#44403c">${esc(o.p.text||'건물')}</text>`,
  tree:(o)=>`<circle r="13" fill="#4ade80" stroke="#15803d" stroke-width="2"/><circle cx="-4" cy="-3" r="5" fill="#86efac"/><circle r="2.5" fill="#78350f"/>`,
  view:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" rx="6" fill="rgba(15,23,42,.18)" stroke="#475569" stroke-width="1.5" stroke-dasharray="5 4"/><text y="4" text-anchor="middle" font-size="10" font-weight="800" fill="#334155">시야 차단</text>`,
  car:(o)=>{ const c=carColor(o),k=o.p.kind||'car',op=o.p.opacity??1,w=o.w,h=o.h,label=carLabel(o); let s='';
    if(k==='bike'){ s=`<rect x="${-w/2}" y="-2" width="${w}" height="4" rx="2" fill="${c}"/><circle cx="${-w/2+5}" cy="0" r="5" fill="none" stroke="#111827" stroke-width="2.5"/><circle cx="${w/2-5}" cy="0" r="5" fill="none" stroke="#111827" stroke-width="2.5"/><circle r="4" fill="#111827"/><polygon points="${w/2+1},-6 ${w/2+9},0 ${w/2+1},6" fill="#fff" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`; }
    else { const cab=k==='truck'||k==='bus';
      s=`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${k==='bus'?4:6}" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>`;
      if(k==='truck') s+=`<rect x="${-w/2+2}" y="${-h/2+2}" width="${w*0.66}" height="${h-4}" rx="2" fill="#e5e7eb"/><rect x="${w/2-w*0.3}" y="${-h/2+3}" width="${w*0.12}" height="${h-6}" rx="2" fill="#0f172a" opacity=".7"/>`;
      else if(k==='bus'){ for(let i=0;i<6;i++) s+=`<rect x="${-w/2+8+i*14}" y="${-h/2+3}" width="9" height="${h-6}" rx="1.5" fill="#0f172a" opacity=".55"/>`; }
      else s+=`<rect x="${w*0.08}" y="${-h/2+3}" width="${w*0.16}" height="${h-6}" rx="2" fill="#0f172a" opacity=".65"/><rect x="${-w*0.36}" y="${-h/2+3}" width="${w*0.1}" height="${h-6}" rx="2" fill="#0f172a" opacity=".5"/>`;
      s+=`<rect x="${w/2-3}" y="${-h/2+2}" width="2.5" height="5" fill="#fef08a"/><rect x="${w/2-3}" y="${h/2-7}" width="2.5" height="5" fill="#fef08a"/>`;
      // 앞머리 표시: 차폭만큼 큰 흰 삼각형(진행 방향이 한눈에 보이게)
      s+=`<polygon points="${w/2+1},${-h*0.42} ${w/2+h*0.55},0 ${w/2+1},${h*0.42}" fill="#fff" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    if(k==='bike') s+=`<text y="-9" text-anchor="middle" font-size="9" font-weight="900" fill="${c}" stroke="#fff" stroke-width="2.5" paint-order="stroke">${esc(label)}</text>`;
    else s+=`<text x="${-w*0.14}" y="${h*0.16}" text-anchor="middle" font-size="${Math.min(14,h*0.45)}" font-weight="900" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="2" paint-order="stroke">${esc(label)}</text>`;
    return `<g opacity="${op}">${s}</g>`; },
  person:(o)=>`<circle r="7" fill="${o.p.color||'#0f172a'}"/><circle r="3" fill="#fde68a"/><line x1="-9" y1="0" x2="9" y2="0" stroke="${o.p.color||'#0f172a'}" stroke-width="3" stroke-linecap="round"/>${o.p.label?`<text y="-11" text-anchor="middle" font-size="9" font-weight="900" fill="#0f172a" stroke="#fff" stroke-width="2.5" paint-order="stroke">${esc(o.p.label)}</text>`:''}`,
  arrow:(o)=>{ const c=o.p.color||'#2563eb',L=o.w,cv=o.p.curve||0; const d=cv?`M ${-L/2} ${cv/2} Q 0 ${-cv} ${L/2} ${cv/2}`:`M ${-L/2} 0 L ${L/2} 0`;
    let s=`<defs><marker id="ah-${o.id}" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1 L11,6 L0,11 z" fill="${c}"/></marker></defs><path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" marker-end="url(#ah-${o.id})"/>`;
    if(o.p.text) s+=`<rect x="-26" y="${-cv/2-22}" width="52" height="15" rx="4" fill="#fff" stroke="${c}"/><text y="${-cv/2-11}" text-anchor="middle" font-size="10" font-weight="700" fill="${c}">${esc(o.p.text)}</text>`; return s; },
  collision:(o)=>{ const r=o.h/2; let pts=[]; for(let i=0;i<16;i++){ const a=i*Math.PI/8,rr=i%2?r*0.55:r; pts.push(`${Math.cos(a)*rr},${Math.sin(a)*rr}`);} let s=`<polygon points="${pts.join(' ')}" fill="#f59e0b" stroke="#b45309" stroke-width="2"/>`;
    // 순번: 다중 추돌에서 1차→2차→3차 순서. 회전과 무관하게 글자는 바로 서게
    if(o.p.n>0) s+=`<g transform="rotate(${-(o.rot||0)})"><circle r="${Math.max(7,r*0.42)}" fill="#fff" stroke="#b45309" stroke-width="1.5"/><text y="${Math.max(7,r*0.42)*0.55}" text-anchor="middle" font-size="${Math.max(9,r*0.55)}" font-weight="900" fill="#0f172a">${o.p.n}</text></g>`; else s+=`<circle r="${r*0.22}" fill="#dc2626"/>`;
    return s; },
  skid:(o)=>`<line x1="${-o.w/2}" y1="${-o.h/2+2}" x2="${o.w/2}" y2="${-o.h/2+2}" stroke="#111827" stroke-width="3.5" stroke-dasharray="9 5" opacity=".75"/><line x1="${-o.w/2}" y1="${o.h/2-2}" x2="${o.w/2}" y2="${o.h/2-2}" stroke="#111827" stroke-width="3.5" stroke-dasharray="9 5" opacity=".75"/>`,
  stopbox:(o)=>`<rect x="${-o.w/2}" y="${-o.h/2}" width="${o.w}" height="${o.h}" rx="5" fill="none" stroke="${o.p.color||'#2563eb'}" stroke-width="2.5" stroke-dasharray="7 5"/>`,
  dim:(o)=>`<line x1="${-o.w/2}" y1="0" x2="${o.w/2}" y2="0" stroke="#0f172a" stroke-width="1.5"/><line x1="${-o.w/2}" y1="-6" x2="${-o.w/2}" y2="6" stroke="#0f172a" stroke-width="1.5"/><line x1="${o.w/2}" y1="-6" x2="${o.w/2}" y2="6" stroke="#0f172a" stroke-width="1.5"/><rect x="-28" y="-18" width="56" height="15" rx="4" fill="#fff" stroke="#cbd5e1"/><text y="-7" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">${esc(o.p.text||'')}</text>`,
  num:(o)=>`<circle r="11" fill="#0f172a" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${o.p.n||1}</text>`,
  compass:(o)=>`<circle r="18" fill="#fff" stroke="#0f172a" stroke-width="1.5"/><polygon points="0,-15 4.5,3 0,0 -4.5,3" fill="#dc2626"/><polygon points="0,15 4.5,-3 0,0 -4.5,-3" fill="#94a3b8"/><text y="-21" text-anchor="middle" font-size="10" font-weight="900" fill="#0f172a">N</text>`,
  text:(o)=>`<text text-anchor="middle" y="${(o.p.size||13)*0.35}" font-size="${o.p.size||13}" font-weight="700" fill="${o.p.color||'#0f172a'}">${esc(o.p.text||'')}</text>`,
  debris:(o)=>{ let s=''; for(const [x,y,r] of [[-14,-6,4],[-4,3,3],[6,-8,3.5],[12,5,2.5],[-8,8,2],[2,-2,2.5],[16,-3,2]]) s+=`<polygon points="${x-r},${y} ${x},${y-r} ${x+r},${y} ${x},${y+r}" fill="#6b7280"/>`; return s; },
};
function bbox(o){
  if(o.type==='cross'){const h=o.h/2,E=armLen(o,'E')+h,S=armLen(o,'S')+h,W=armLen(o,'W')+h,N=armLen(o,'N')+h;return {x:-W,y:-N,w:W+E,h:N+S};}
  if(o.type==='tee'){const h=o.h/2,E=armLen(o,'E')+h,S=armLen(o,'S')+h,W=armLen(o,'W')+h;return {x:-W,y:-h,w:W+E,h:h+S};}
  if(o.type==='round'){const e=o.w/2+(o.p.arm||90);return {x:-e,y:-e,w:2*e,h:2*e};}
  if(o.type==='curve'){return {x:-o.w/2,y:-o.h*1.2,w:o.w,h:o.h*2.2};}
  return {x:-o.w/2,y:-o.h/2,w:o.w,h:o.h};
}

/* ---------- 그리기 ---------- */
function render(){
  const {x,y,k}=view; const W=SVG.clientWidth,H=SVG.clientHeight;
  SVG.setAttribute('viewBox',`${x} ${y} ${W/k} ${H/k}`);
  let s=`<defs><filter id="pshadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0f172a" flood-opacity=".18"/></filter></defs><rect x="0" y="0" width="${PAGE.w}" height="${PAGE.h}" fill="#fff" stroke="#cbd5e1" filter="url(#pshadow)"/>`;
  for(const o of ordered()){ const b=bbox(o); s+=`<g class="obj" data-id="${o.id}" transform="translate(${o.x},${o.y}) rotate(${o.rot||0}) scale(${sizeOf(o)})" opacity="${o.type==='car'?1:(o.p.opacity??1)}">${R[o.type](o)}<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="transparent"/></g>`; }
  const so=objs.find(o=>o.id===sel);
  if(so){ const b0=bbox(so),sz=sizeOf(so),b={x:b0.x*sz,y:b0.y*sz,w:b0.w*sz,h:b0.h*sz},hs=8/k;
    s+=`<g transform="translate(${so.x},${so.y}) rotate(${so.rot||0})" pointer-events="none"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#2563eb" stroke-width="${1.5/k}" stroke-dasharray="${4/k} ${3/k}"/><line x1="0" y1="${b.y}" x2="0" y2="${b.y-22/k}" stroke="#2563eb" stroke-width="${1.5/k}"/></g>`;
    const hb=(name,cx,cy,cur)=>`<rect data-h="${name}" x="${cx-hs}" y="${cy-hs}" width="${2*hs}" height="${2*hs}" rx="${2/k}" fill="#2563eb" stroke="#fff" stroke-width="${1.5/k}" style="cursor:${cur}"/>`;
    const vert=Math.round(((so.rot||0)%180+180)%180)===90; // 90/270°면 화면상 가로·세로가 바뀜
    s+=`<g transform="translate(${so.x},${so.y}) rotate(${so.rot||0})"><circle data-h="rot" cx="0" cy="${b.y-22/k}" r="${hs}" fill="#fff" stroke="#2563eb" stroke-width="${2/k}" style="cursor:grab"/>${FIXED.has(so.type)?'':hb('e',b.x+b.w,0,vert?'ns-resize':'ew-resize')+hb('w',b.x,0,vert?'ns-resize':'ew-resize')+hb('s',0,b.y+b.h,vert?'ew-resize':'ns-resize')+hb('n',0,b.y,vert?'ew-resize':'ns-resize')}${extraHandles(so,hs,k)}</g>`;
  }
  SVG.innerHTML=s; $('zLbl').textContent=Math.round(k*100)+'%'; renderProps();
}

// 교차로: 동쪽 팔 아래 변에 '도로 폭' 손잡이(흰 네모). 회전교차로: 45° 대각선에 바깥(지름)·안(회전 차도 폭) 손잡이
function extraHandles(o,hs,k){
  const wh=(name,cx,cy,cur,title)=>`<rect data-h="${name}" x="${cx-hs}" y="${cy-hs}" width="${2*hs}" height="${2*hs}" rx="${2/k}" fill="#fff" stroke="#2563eb" stroke-width="${2/k}" style="cursor:${cur}"><title>${title}</title></rect>`;
  if(o.type==='cross'||o.type==='tee') return wh('wd', o.h/2+armLen(o,'E')/2, o.h/2, 'ns-resize','도로 폭');
  if(o.type==='round'){ const Ro=o.w/2, Ri=Ro-o.h, c=Math.SQRT1_2; return wh('ro',Ro*c,Ro*c,'nwse-resize','지름')+wh('ri',Ri*c,Ri*c,'nwse-resize','회전 차도 폭'); }
  return '';
}

/* ---------- 속성판 ---------- */
const COLORS=['#2563eb','#dc2626','#0f172a','#475569','#059669','#7c3aed','#f59e0b','#94a3b8'];
const laneSelect=(o,key)=>`<select data-lane="${key}">${Object.entries(GLYPH_NAMES).map(([v,l])=>`<option value="${v}" ${(o.p.marks||{})[key]===v?'selected':''}>${l}</option>`).join('')}</select>`;
const laneRow=(o,key,label)=>`<div class="lane"><span class="ln">${label}</span>${laneSelect(o,key)}<label class="bus"><input type="checkbox" data-bus="${key}" ${(o.p.bus||{})[key]?'checked':''}/>버스</label></div>`;
// 회전 상태에 맞춰 방향 이름 (E=로컬 아래쪽·+x 진행, W=로컬 위쪽·-x 진행)
function dirLabel(o,key){ const q=Math.round((((o.rot||0)%360)+360)%360/90)%4; const E=['→ 아래쪽 차로(우행)','↓ 왼쪽 차로(하행)','← 위쪽 차로(좌행)','↑ 오른쪽 차로(상행)'], W=['← 위쪽 차로(좌행)','↑ 오른쪽 차로(상행)','→ 아래쪽 차로(우행)','↓ 왼쪽 차로(하행)']; return (key==='E'?E:W)[q]; }
function laneUI(o){
  const N=o.p.lanes||2; let h='';
  if(o.type==='road'){
    if(N<2 && !o.p.oneway) return '';
    if(o.p.oneway){ h+=`<div class="lanebox"><div class="lh">${dirLabel(o,'E')} · 진행 방향 왼쪽이 1차로</div>${Array.from({length:N},(_,i)=>laneRow(o,'E'+(i+1),(i+1)+'차로')).join('')}</div>`; }
    else { const half=Math.floor(N/2); h+=`<div class="lanebox"><div class="lh">${dirLabel(o,'E')} · 중앙선 쪽이 1차로</div>${Array.from({length:half},(_,i)=>laneRow(o,'E'+(i+1),(i+1)+'차로')).join('')}</div><div class="lanebox"><div class="lh">${dirLabel(o,'W')}</div>${Array.from({length:half},(_,i)=>laneRow(o,'W'+(i+1),(i+1)+'차로')).join('')}</div>`; }
  } else {
    const NN=o.type==='round'?(o.p.armLanes||2):N; const half=Math.max(1,Math.floor(NN/2)); const arms=(o.type==='cross'||o.type==='round')?[['W','서→동 접근(왼쪽 팔)'],['E','동→서 접근(오른쪽 팔)'],['N','북→남 접근(위 팔)'],['S','남→북 접근(아래 팔)']]:[['W','서→동 접근(왼쪽 팔)'],['E','동→서 접근(오른쪽 팔)'],['S','남→북 접근(아래 팔)']];
    for(const [k,l] of arms) h+=`<div class="lanebox"><div class="lh">${l}</div>${Array.from({length:half},(_,i)=>laneRow(o,k+(i+1),(i+1)+'차로')).join('')}</div>`;
  }
  return `<div class="field"><label>차선 바닥 표기 · 전용차선</label>${h}</div>`;
}
function renderProps(){
  const el=$('props'); const o=objs.find(x=>x.id===sel);
  const closeBtn=`<button class="closeBtn" id="closeProps">닫기 ✕</button>`;
  if(!o){ el.innerHTML=`<h3>속성 ${closeBtn}</h3><div class="empty">객체를 선택하면 라벨·색·차로·바닥 표기·회전을 바꿀 수 있음.<br><br>A4 가로 1페이지. PNG는 페이지 영역만 2배 해상도.</div><div class="field"><label>객체 수</label><div>${objs.length}개</div></div>`; bindClose(); return; }
  const name=(CATS.flatMap(c=>c.items).find(i=>i.type===o.type)||{}).name||o.type;
  let h=`<h3>선택 객체 ${closeBtn}</h3><div class="title">${name}</div>`;
  h+=`<div class="row"><div class="field"><label>회전 (°)</label><input type="number" data-k="rot" value="${Math.round(o.rot||0)}" step="5"/></div><div class="field"><label>불투명</label><input type="range" data-p="opacity" min="0.2" max="1" step="0.05" value="${o.p.opacity??1}"/></div></div>`;
  const wl = o.type==='cross'||o.type==='tee' ? '팔 길이' : o.type==='round' ? '지름' : '길이'; const hl = o.type==='round' ? '회전 차도 폭' : '폭';
  if(o.type==='cross'||o.type==='tee'){ const ks=o.type==='cross'?['E','S','W','N']:['E','S','W']; const nm={E:'오른쪽 팔',S:'아래 팔',W:'왼쪽 팔',N:'위 팔'}; h+=`<div class="field"><label>팔 길이 (손잡이로도 조절)</label><div class="row">${ks.map(k=>`<div class="field"><label>${nm[k]}</label><input type="number" data-arm="${k}" value="${Math.round(armLen(o,k))}"/></div>`).join('')}</div></div><div class="field"><label>도로 폭 (흰 손잡이 또는 차로 수)</label><input type="number" data-k="h" value="${Math.round(o.h)}"/></div>`; }
  else if(FIXED.has(o.type)) h+=`<div class="field"><label>크기 <span style="font-weight:400">${Math.round((o.p.size||1)*100)}%</span></label><input type="range" data-p="size" min="0.5" max="3" step="0.05" value="${o.p.size||1}"/></div>`;
  else h+=`<div class="row"><div class="field"><label>${wl}</label><input type="number" data-k="w" value="${Math.round(o.w)}"/></div><div class="field"><label>${hl}</label><input type="number" data-k="h" value="${Math.round(o.h)}"/></div></div>`;
  if(o.type==='car'){ h+=`<div class="field"><label>구분</label><div class="seg" data-seg="role"><button class="${o.p.role==='자차'?'on':''}" data-v="자차">자차</button><button class="${o.p.role!=='자차'?'on':''}" data-v="대물">대물</button></div></div>`;
    if(o.p.role!=='자차') h+=`<div class="field"><label>대물 번호</label><input type="number" data-p="n" value="${o.p.n||1}" min="1" max="20"/></div>`;
    h+=`<div class="field"><label>종류</label><div class="seg" data-seg="kind">${['car','truck','bus','bike'].map(k=>`<button class="${o.p.kind===k?'on':''}" data-v="${k}">${{car:'승용',truck:'화물',bus:'버스',bike:'이륜'}[k]}</button>`).join('')}</div></div>`; }
  if(o.type==='person'){ h+=`<div class="field"><label>라벨(선택)</label><input type="text" data-p="label" value="${esc(o.p.label||'')}" placeholder="보행자 / 대인"/></div>`; }
  if(o.type==='school'){ h+=`<div class="field"><label>제한속도</label><input type="number" data-p="speed" value="${o.p.speed||30}"/></div>`; }
  if(o.type==='road'){ h+=`<div class="field"><label>통행</label><div class="seg" data-seg="oneway"><button class="${!o.p.oneway?'on':''}" data-v="0">양방향</button><button class="${o.p.oneway?'on':''}" data-v="1">일방통행</button></div></div><div class="field"><label>총 차로 수</label><select data-lanes="lanes">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${o.p.lanes===n?'selected':''}>${n}차로${!o.p.oneway&&n>1?` (편도 ${Math.floor(n/2)})`:''}</option>`).join('')}</select></div>`;
    if(!o.p.oneway) h+=`<div class="field"><label>중앙선</label><div class="seg" data-seg="center">${[['none','없음'],['dashed','점선'],['solid','실선'],['double','복선']].map(([v,l])=>`<button class="${o.p.center===v?'on':''}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
    h+=laneUI(o); }
  if(o.type==='cross'||o.type==='tee'){ h+=`<div class="field"><label>차로 수(팔마다 왕복)</label><select data-lanes="lanes">${[2,4,6,8,10,12].map(n=>`<option value="${n}" ${o.p.lanes===n?'selected':''}>왕복 ${n}차로 (편도 ${n/2})</option>`).join('')}</select></div><div class="field"><label>횡단보도</label><div class="seg" data-seg="cw"><button class="${o.p.cw?'on':''}" data-v="1">있음</button><button class="${!o.p.cw?'on':''}" data-v="0">없음</button></div></div>`+laneUI(o); }
  if(o.type==='round'){ h+=`<div class="row"><div class="field"><label>팔 길이</label><input type="number" data-p="arm" value="${o.p.arm||90}"/></div><div class="field"><label>회전 차로 수</label><select data-lanes="lanes">${[1,2,3,4].map(n=>`<option value="${n}" ${(o.p.lanes||1)===n?'selected':''}>${n}차로</option>`).join('')}</select></div></div><div class="field"><label>진입 도로 차로 수(왕복)</label><select data-lanes="armLanes">${[2,4,6,8,10,12].map(n=>`<option value="${n}" ${(o.p.armLanes||2)===n?'selected':''}>왕복 ${n}차로 (편도 ${n/2})</option>`).join('')}</select></div>`+laneUI(o); }
  if(o.type==='signal'){ h+=`<div class="field"><label>신호 상태</label><div class="seg" data-seg="state">${[['red','적'],['yellow','황'],['green','녹'],['left','좌회전']].map(([v,l])=>`<button class="${o.p.state===v?'on':''}" data-v="${v}">${l}</button>`).join('')}</div></div>`; }
  if(o.type==='sign'){ h+=`<div class="field"><label>표지 종류</label><div class="seg" data-seg="kind">${[['stop','정지'],['yield','양보'],['speed','속도'],['noleft','좌회전금지']].map(([v,l])=>`<button class="${o.p.kind===v?'on':''}" data-v="${v}">${l}</button>`).join('')}</div></div>`; if(o.p.kind==='speed') h+=`<div class="field"><label>제한속도</label><input type="number" data-p="speed" value="${o.p.speed||30}"/></div>`; }
  if(o.type==='arrow'){ h+=`<div class="field"><label>곡률</label><input type="range" data-p="curve" min="-120" max="120" step="5" value="${o.p.curve||0}"/></div><div class="field"><label>화살표 라벨(속도 등)</label><input type="text" data-p="text" value="${esc(o.p.text||'')}" placeholder="약 40km/h"/></div>`; }
  if(o.type==='parking'){ h+=`<div class="field"><label>구획 수</label><input type="number" data-p="slots" value="${o.p.slots||4}" min="1" max="12"/></div>`; }
  if(o.type==='dim'||o.type==='text'||o.type==='building'){ h+=`<div class="field"><label>텍스트</label><input type="text" data-p="text" value="${esc(o.p.text||'')}"/></div>`; }
  if(o.type==='text'){ h+=`<div class="field"><label>글자 크기</label><input type="number" data-p="size" value="${o.p.size||13}"/></div>`; }
  if(o.type==='num'){ h+=`<div class="field"><label>번호</label><input type="number" data-p="n" value="${o.p.n||1}" min="1"/></div>`; }
  if(o.type==='collision'){ h+=`<div class="field"><label>충돌 순번 (다중 추돌 · 0=표시 안 함)</label><div class="row"><input type="number" data-p="n" value="${o.p.n||0}" min="0" max="20"/><div class="seg" data-seg="n">${[0,1,2,3,4,5].map(n=>`<button class="${(o.p.n||0)===n?'on':''}" data-v="${n}">${n===0?'없음':n+'차'}</button>`).join('')}</div></div></div>`; }
  if(['car','arrow','stopbox','text','person'].includes(o.type)){ h+=`<div class="field"><label>색${o.type==='car'?' (기본: 자차 파랑 · 대물 빨강)':''}</label><div class="swatches">${COLORS.map(c=>`<div class="sw ${(o.type==='car'?carColor(o):o.p.color)===c?'on':''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>`; }
  h+=`<div class="field"><label>순서·편집</label><div class="btnrow"><button class="sbtn" data-a="front" title="같은 층 안에서 맨 앞 (도로는 항상 맨 뒤 층)">맨 앞</button><button class="sbtn" data-a="back" title="같은 층 안에서 맨 뒤">맨 뒤</button><button class="sbtn" data-a="dup">복제</button><button class="sbtn" data-a="flip">좌우 반전</button><button class="sbtn danger" data-a="del">삭제</button></div></div>`;
  el.innerHTML=h; bindClose();
  el.querySelectorAll('input[data-k]').forEach(i=>i.addEventListener('change',()=>{ push(); o[i.dataset.k]=+i.value; render(); }));
  el.querySelectorAll('input[data-arm]').forEach(i=>i.addEventListener('change',()=>{ push(); o.p.arms=o.p.arms||{E:o.w,S:o.w,W:o.w,N:o.w}; o.p.arms[i.dataset.arm]=Math.max(40,+i.value); render(); save(); }));
  el.querySelectorAll('input[data-p]').forEach(i=>{ i.addEventListener('input',()=>{ o.p[i.dataset.p]= i.type==='text'? i.value : +i.value; renderCanvasOnly(); }); i.addEventListener('change',()=>{ push(); o.p[i.dataset.p]= i.type==='text'? i.value : +i.value; render(); save(); }); });
  el.querySelectorAll('select[data-lanes]').forEach(sl=>sl.addEventListener('change',()=>{ push(); const key=sl.dataset.lanes, v=+sl.value; o.p[key]=v;
    if(o.type==='road') o.h = o.p.oneway ? v*32 : Math.max(50, Math.floor(v/2)*2*34);
    if(o.type==='cross'||o.type==='tee') o.h = v*34;
    if(o.type==='round'&&key==='lanes') o.h = v*30;
    render(); save(); }));
  el.querySelectorAll('select[data-lane]').forEach(sl=>sl.addEventListener('change',()=>{ push(); o.p.marks=o.p.marks||{}; o.p.marks[sl.dataset.lane]=sl.value; render(); save(); }));
  el.querySelectorAll('input[data-bus]').forEach(cb=>cb.addEventListener('change',()=>{ push(); o.p.bus=o.p.bus||{}; if(cb.checked) o.p.bus[cb.dataset.bus]=true; else delete o.p.bus[cb.dataset.bus]; render(); save(); }));
  el.querySelectorAll('[data-seg] button').forEach(b=>b.addEventListener('click',()=>{ push(); const key=b.parentElement.dataset.seg; let v=b.dataset.v; if(['ghost','cw','oneway'].includes(key)) v=v==='1'; else if(key==='lanes'||key==='n') v=+v; o.p[key]=v;
    if(key==='kind'&&o.type==='car'){ const d={car:[64,29],truck:[100,34],bus:[130,37],bike:[42,17]}[v]; o.w=d[0]; o.h=d[1]; }
    if(key==='role'&&o.type==='car'){ o.p.color=''; if(v==='대물'&&!o.p.n) o.p.n=nextObjNo(); }
    if(key==='oneway'&&o.type==='road'){ o.h = v ? (o.p.lanes||2)*32 : Math.max(50,Math.floor((o.p.lanes||2)/2)*2*34); }
    render(); save(); }));
  el.querySelectorAll('.sw').forEach(s=>s.addEventListener('click',()=>{ push(); o.p.color = (o.type==='car'&&o.p.color===s.dataset.c) ? '' : s.dataset.c; render(); save(); }));
  el.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{ const a=b.dataset.a; push();
    if(a==='del'){ objs=objs.filter(x=>x!==o); sel=null; }
    if(a==='front'){ objs=objs.filter(x=>x!==o); objs.push(o); }
    if(a==='back'){ objs=objs.filter(x=>x!==o); objs.unshift(o); }
    if(a==='dup'){ const c=clone(o); c.id=uid(); c.x+=30; c.y+=30; objs.push(c); sel=c.id; }
    if(a==='flip'){ o.rot=((180-(o.rot||0))%360+360)%360; }
    render(); save(); }));
}
function bindClose(){ const b=$('closeProps'); if(b) b.onclick=()=>$('rightPanel').classList.remove('open'); }
$('propsBtn').onclick=()=>$('rightPanel').classList.toggle('open');
function renderCanvasOnly(){ const el=$('props'); const html=el.innerHTML; const active=document.activeElement; const idx=[...el.querySelectorAll('input,select')].indexOf(active); render(); /* props 재생성으로 포커스가 날아가니 복원 */ const list=[...el.querySelectorAll('input,select')]; if(idx>=0&&list[idx]){ list[idx].focus(); if(list[idx].type==='text') list[idx].setSelectionRange(list[idx].value.length,list[idx].value.length);} }

/* ---------- 팔레트 UI ---------- */
let cat='road';
function renderPalette(){
  $('tabs').innerHTML=CATS.map(c=>`<button class="tab ${c.key===cat?'on':''}" data-c="${c.key}">${c.name}</button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(t=>t.onclick=()=>{cat=t.dataset.c;renderPalette();});
  const c=CATS.find(c=>c.key===cat);
  $('pal').innerHTML=c.items.map((it,i)=>{ const o={id:'p'+i,type:it.type,w:it.w,h:it.h,rot:0,p:it.p}; const rot=defRot(it.type); let b=bbox(o); if(rot===270){ b={x:b.y,y:-(b.x+b.w),w:b.h,h:b.w}; } const pad=6; return `<div class="item" data-i="${i}" draggable="true"><svg viewBox="${b.x-pad} ${b.y-pad} ${b.w+pad*2} ${b.h+pad*2}" preserveAspectRatio="xMidYMid meet"><g transform="rotate(${rot})">${R[it.type](o)}</g></svg><b>${it.name}</b></div>`; }).join('');
  $('pal').querySelectorAll('.item').forEach(el=>{ const it=c.items[+el.dataset.i]; el.onclick=()=>addItem(it,null); el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',JSON.stringify(it))); });
}
function nextObjNo(){ return Math.max(0,...objs.filter(o=>o.type==='car'&&o.p.role!=='자차').map(o=>o.p.n||0))+1; }
function addItem(it,at){ push(); const W=SVG.clientWidth,H=SVG.clientHeight; const c=at||{x:view.x+W/view.k/2,y:view.y+H/view.k/2}; const o={id:uid(),type:it.type,w:it.w,h:it.h,rot:defRot(it.type),x:snapv(c.x),y:snapv(c.y),p:clone(it.p)};
  if(o.type==='car'){ if(!objs.some(x=>x.type==='car'&&x.p.role==='자차')) o.p.role='자차'; else { o.p.role='대물'; o.p.n=nextObjNo(); } }
  if(o.type==='collision'){ const nums=objs.filter(x=>x.type==='collision'&&x.p.n>0).map(x=>x.p.n); if(nums.length) o.p.n=Math.max(...nums)+1; }
  objs.push(o); sel=o.id; render(); save(); }
$('stage').addEventListener('dragover',e=>e.preventDefault());
$('stage').addEventListener('drop',e=>{ e.preventDefault(); try{ addItem(JSON.parse(e.dataTransfer.getData('text/plain')),toWorld(e)); }catch{} });

/* ---------- 입력 ---------- */
function toWorld(e){ const r=SVG.getBoundingClientRect(); return {x:view.x+(e.clientX-r.left)/view.k, y:view.y+(e.clientY-r.top)/view.k}; }
function snapv(v){ return snap? Math.round(v/10)*10 : v; }
let drag=null, space=false, pinch=null;
SVG.addEventListener('pointerdown',e=>{
  const w=toWorld(e); SVG.setPointerCapture(e.pointerId);
  if(space||e.button===1){ drag={mode:'pan',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y}; return; }
  const h=e.target.closest('[data-h]'), g=e.target.closest('.obj');
  if(h&&sel){ const o=objs.find(x=>x.id===sel); push(); drag={mode:'h'+h.dataset.h,o}; return; }
  if(g){ const o=objs.find(x=>x.id===g.dataset.id); sel=o.id; push(); drag={mode:'move',o,dx:w.x-o.x,dy:w.y-o.y,moved:false}; render(); return; }
  sel=null; render(); drag={mode:'pan',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y}; // 빈 곳 드래그 = 화면 이동
});
SVG.addEventListener('pointermove',e=>{
  if(!drag) return; const w=toWorld(e);
  if(drag.mode==='pan'){ view.x=drag.vx-(e.clientX-drag.sx)/view.k; view.y=drag.vy-(e.clientY-drag.sy)/view.k; render(); return; }
  const o=drag.o;
  if(drag.mode==='move'){ o.x=snapv(w.x-drag.dx); o.y=snapv(w.y-drag.dy); drag.moved=true; }
  else if(drag.mode==='hrot'){ let a=Math.atan2(w.y-o.y,w.x-o.x)*180/Math.PI+90; if(snap) a=Math.round(a/15)*15; o.rot=((a%360)+360)%360; }
  else { const rad=(o.rot||0)*Math.PI/180, r=-rad, dx=w.x-o.x, dy=w.y-o.y; const lx=dx*Math.cos(r)-dy*Math.sin(r), ly=dx*Math.sin(r)+dy*Math.cos(r); const side=drag.mode.slice(1);
    if(o.type==='cross'||o.type==='tee'){ const h=o.h/2; o.p.arms=o.p.arms||{E:o.w,S:o.w,W:o.w,N:o.w};
      if(side==='e') o.p.arms.E=Math.max(40,snapv(lx-h));
      if(side==='w') o.p.arms.W=Math.max(40,snapv(-lx-h));
      if(side==='s') o.p.arms.S=Math.max(40,snapv(ly-h));
      if(side==='n'){ if(o.type==='cross') o.p.arms.N=Math.max(40,snapv(-ly-h)); else o.h=Math.max(40,snapv(-ly*2)); }
      if(side==='wd') o.h=Math.max(40,snapv(Math.abs(ly)*2));
    } else if(o.type==='round'){ const d=Math.hypot(lx,ly), Ro=o.w/2, Ri=Ro-o.h;
      if(side==='e'||side==='w'||side==='n'||side==='s') o.p.arm=Math.max(20,snapv(Math.max(Math.abs(lx),Math.abs(ly))-Ro));
      if(side==='ro'){ const nRo=Math.max(Ri+20,snapv(d)); o.w=nRo*2; o.h=nRo-Ri; }
      if(side==='ri'){ const nRi=Math.max(10,Math.min(Ro-20,snapv(d))); o.h=Ro-nRi; }
    } else {
      // 잡은 변만 움직이고 반대 변은 고정 → 중심을 그만큼 옮김
      let d=0, axis='x';
      if(side==='e'){ const nw=Math.max(10,snapv(lx+o.w/2)); d=(nw-o.w)/2; o.w=nw; }
      if(side==='w'){ const nw=Math.max(10,snapv(o.w/2-lx)); d=-(nw-o.w)/2; o.w=nw; }
      if(side==='s'){ const nh=Math.max(4,snapv(ly+o.h/2)); d=(nh-o.h)/2; o.h=nh; axis='y'; }
      if(side==='n'){ const nh=Math.max(4,snapv(o.h/2-ly)); d=-(nh-o.h)/2; o.h=nh; axis='y'; }
      if(axis==='x'){ o.x+=d*Math.cos(rad); o.y+=d*Math.sin(rad); } else { o.x+=-d*Math.sin(rad); o.y+=d*Math.cos(rad); }
    }
  }
  render();
});
SVG.addEventListener('pointerup',()=>{ if(drag&&drag.mode==='move'&&window.innerWidth<=1100) $('rightPanel').classList.add('open'); drag=null; save(); });
SVG.addEventListener('wheel',e=>{ e.preventDefault(); const r=SVG.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; const f=Math.exp(-e.deltaY*0.0012); const nk=Math.min(4,Math.max(0.25,view.k*f)); view.x+=mx/view.k-mx/nk; view.y+=my/view.k-my/nk; view.k=nk; render(); },{passive:false});
// 터치 핀치 줌
SVG.addEventListener('touchstart',e=>{ if(e.touches.length===2){ pinch={d:dist(e.touches),k:view.k}; drag=null; } },{passive:true});
SVG.addEventListener('touchmove',e=>{ if(pinch&&e.touches.length===2){ e.preventDefault(); const nk=Math.min(4,Math.max(0.25,pinch.k*dist(e.touches)/pinch.d)); const r=SVG.getBoundingClientRect(); const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-r.left, my=(e.touches[0].clientY+e.touches[1].clientY)/2-r.top; view.x+=mx/view.k-mx/nk; view.y+=my/view.k-my/nk; view.k=nk; render(); } },{passive:false});
SVG.addEventListener('touchend',()=>{ pinch=null; });
const dist=(t)=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
onWin('keydown',e=>{
  if(e.target.matches('input,textarea,select')) return;
  if(e.code==='Space'){ space=true; SVG.style.cursor='grab'; e.preventDefault(); }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); doUndo(); return; }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); doRedo(); return; }
  const o=objs.find(x=>x.id===sel); if(!o) return;
  if(e.key==='Delete'||e.key==='Backspace'){ push(); objs=objs.filter(x=>x!==o); sel=null; render(); save(); }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){ e.preventDefault(); push(); const c=clone(o); c.id=uid(); c.x+=30; c.y+=30; objs.push(c); sel=c.id; render(); save(); }
  const st=e.shiftKey?10:2; if(e.key==='ArrowLeft'){o.x-=st;render();} if(e.key==='ArrowRight'){o.x+=st;render();} if(e.key==='ArrowUp'){o.y-=st;render();} if(e.key==='ArrowDown'){o.y+=st;render();}
  if(e.key==='r'||e.key==='R'){ push(); o.rot=((o.rot||0)+(e.shiftKey?-15:15)+360)%360; render(); }
});
onWin('keyup',e=>{ if(e.code==='Space'){ space=false; SVG.style.cursor='default'; } });

/* ---------- 실행취소·저장 ---------- */
function push(){ undo.push(JSON.stringify(objs)); if(undo.length>100) undo.shift(); redo=[]; }
function doUndo(){ if(!undo.length) return; redo.push(JSON.stringify(objs)); objs=JSON.parse(undo.pop()); sel=null; render(); save(); }
function doRedo(){ if(!redo.length) return; undo.push(JSON.stringify(objs)); objs=JSON.parse(redo.pop()); sel=null; render(); save(); }
$('bUndo').onclick=doUndo; $('bRedo').onclick=doRedo;
const doc=()=>({v:2,objs,date:$('fDate').value,place:$('fPlace').value});
function save(){ try{ localStorage.setItem('carshare-sketch',JSON.stringify(doc())); const t=$('toast'); t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),600);}catch{} }
function applyDoc(d){ let objNo=0; objs=(d.objs||[]).map(o=>{ o.p=o.p||{};
    if(o.type==='car'&&o.w<60&&o.p.kind!=='bike'){ o.w=Math.round(o.w*1.4); o.h=Math.round(o.h*1.4); }
    if(o.type==='car'){ if(!o.p.role){ o.p.role = (o.p.label||'').startsWith('A') ? '자차' : '대물'; if(o.p.role==='대물') o.p.n=++objNo; o.p.color=''; } if(o.p.kind==='suv') o.p.kind='car'; delete o.p.ghost; delete o.p.label; }
    if(o.type==='median') o.type='guard'; if(o.type==='road'){ o.p.marks=o.p.marks||{}; o.p.bus=o.p.bus||{}; if(o.p.oneway==null) o.p.oneway=false; } if(o.type==='cross'||o.type==='tee'){ o.p.marks=o.p.marks||{}; o.p.bus=o.p.bus||{}; if(!o.p.lanes) o.p.lanes=2; if(o.h<50) o.h=90; if(!o.p.arms) o.p.arms={E:o.w,S:o.w,W:o.w,N:o.w}; } if(o.type==='round'){ o.p.marks=o.p.marks||{}; o.p.bus=o.p.bus||{}; o.p.lanes=o.p.lanes||1; o.p.armLanes=o.p.armLanes||2; } return o; }); $('fDate').value=d.date||''; $('fPlace').value=d.place||''; }
function load(){ try{ const d=JSON.parse(localStorage.getItem('carshare-sketch')||'null'); if(d&&d.v===2){ applyDoc(d); return true; } }catch{} return false; }
$('fDate').onchange=$('fPlace').onchange=save;
$('bClear').onclick=()=>{ if(!confirm('현재 약도를 지우고 새로 시작할까요?')) return; push(); objs=[]; sel=null; render(); save(); };
$('bJsonSave').onclick=()=>{ const a=document.createElement('a'); a.download='사고약도.json'; a.href=URL.createObjectURL(new Blob([JSON.stringify(doc(),null,1)],{type:'application/json'})); a.click(); };
$('bJsonLoad').onclick=()=>$('fJson').click();
$('fJson').onchange=async(e)=>{ const f=e.target.files[0]; if(!f) return; try{ push(); applyDoc(JSON.parse(await f.text())); sel=null; render(); save(); fit(); }catch{ alert('JSON을 읽지 못했음'); } e.target.value=''; };

/* ---------- 줌 ---------- */
function zoomTo(k){ const W=SVG.clientWidth,H=SVG.clientHeight; const cx=view.x+W/view.k/2,cy=view.y+H/view.k/2; view.k=k; view.x=cx-W/k/2; view.y=cy-H/k/2; render(); }
$('zIn').onclick=()=>zoomTo(Math.min(4,view.k*1.2)); $('zOut').onclick=()=>zoomTo(Math.max(0.25,view.k/1.2));
$('zFit').onclick=fit; function fit(){ const W=SVG.clientWidth,H=SVG.clientHeight; const k=Math.min(W/(PAGE.w+80),H/(PAGE.h+80)); view.k=k; view.x=(PAGE.w-W/k)/2; view.y=(PAGE.h-H/k)/2; render(); }
$('gridBtn').onclick=()=>{ snap=!snap; $('gridBtn').textContent='스냅 '+(snap?'켬':'끔'); };

/* ---------- PNG ---------- */
$('bPng').onclick=()=>{
  const keep=sel; sel=null;
  let body=''; for(const o of ordered()) body+=`<g transform="translate(${o.x},${o.y}) rotate(${o.rot||0}) scale(${sizeOf(o)})" opacity="${o.type==='car'?1:(o.p.opacity??1)}">${R[o.type](o)}</g>`;
  const info=($('fDate').value||$('fPlace').value)?`<text x="16" y="${PAGE.h-14}" font-size="13" font-weight="700" fill="#334155">${esc([$('fDate').value,$('fPlace').value].filter(Boolean).join(' · '))}</text>`:'';
  const legend=`<g transform="translate(${PAGE.w-230},14)"><rect width="216" height="26" rx="8" fill="#fff" stroke="#e2e8f0"/><rect x="10" y="8" width="10" height="10" rx="3" fill="#2563eb"/><text x="24" y="18" font-size="11" fill="#334155">자차</text><rect x="78" y="8" width="10" height="10" rx="3" fill="#dc2626"/><text x="92" y="18" font-size="11" fill="#334155">대물</text><circle cx="152" cy="13" r="5" fill="#f59e0b"/><text x="162" y="18" font-size="11" fill="#334155">충돌 지점</text></g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.w*2}" height="${PAGE.h*2}" viewBox="0 0 ${PAGE.w} ${PAGE.h}" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif"><rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>${body}${legend}${info}</svg>`;
  const img=new Image(); const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  img.onload=()=>{ const c=document.createElement('canvas'); c.width=PAGE.w*2; c.height=PAGE.h*2; c.getContext('2d').drawImage(img,0,0); URL.revokeObjectURL(url); const a=document.createElement('a'); a.download='사고약도.png'; a.href=c.toDataURL('image/png'); a.click(); sel=keep; render(); };
  img.src=url;
};

/* ---------- 샘플 ---------- */
$('bSample').onclick=()=>{ push(); objs=sample(); sel=null; render(); save(); fit(); };
function sample(){ const o=(type,x,y,w,h,rot,p)=>({id:uid(),type,x,y,w,h,rot,p}); return [
  o('cross',560,400,300,136,0,{lanes:4,cw:true,arms:{E:300,S:300,W:300,N:300},marks:{W1:'sl',W2:'sr',E1:'l',E2:'s',N1:'s',N2:'sr',S1:'sl',S2:'s'},bus:{}}),
  o('sidewalk',330,290,320,26,0,{}), o('signal',470,330,24,24,0,{state:'green'}), o('sign',655,330,30,30,0,{kind:'noleft'}),
  o('building',250,180,160,90,0,{text:'상가'}), o('tree',330,255,28,28,0,{}), o('tree',380,255,28,28,0,{}),
  o('school',300,700,300,60,0,{speed:30}),
  o('car',300,455,64,29,0,{kind:'car',role:'자차',n:1,color:'',opacity:0.4}),
  o('arrow',380,455,70,16,0,{color:'#2563eb',curve:0,text:'약 40km/h'}),
  o('car',450,455,64,29,0,{kind:'car',role:'자차',n:1,color:''}),
  o('car',600,240,64,29,90,{kind:'car',role:'대물',n:1,color:'',opacity:0.4}),
  o('arrow',600,300,60,16,90,{color:'#dc2626',curve:0,text:''}),
  o('car',600,360,64,29,90,{kind:'car',role:'대물',n:1,color:''}),
  o('guard',330,318,320,12,0,{}),
  o('collision',530,425,30,30,0,{n:1}), o('skid',470,470,60,16,0,{}),
  o('dim',470,510,120,20,0,{text:'약 5.2m'}), o('num',300,425,22,22,0,{n:1}), o('num',450,425,22,22,0,{n:2}),
  o('text',560,640,200,24,0,{text:'자차 직진 중 대물1 우측 진입 · 신호 확인 필요',size:13,color:'#0f172a'}),
  o('compass',1040,80,40,40,0,{}),
]; }

renderPalette();
if(!load()) objs=sample();
fit();
onWin('resize',render);

  return () => {
    for (const [t, f, o] of winL) window.removeEventListener(t, f, o);
    root.innerHTML = "";
    root.classList.remove("skx");
  };
}
