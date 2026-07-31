"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { strFromU8, unzipSync } from "fflate";
import { parseOhrRpg } from "../lib/ohr-lump";

type Screen = "title" | "game" | "load" | "create" | "saves" | "ohr";
type Phase = "explore" | "battle" | "victory";
type ModuleCard = { id: string; title: string; version: string; author: string; playtime: string; verified: boolean; engine: "proof" | "ohr-wasm"; installed?: boolean; saveNamespace?: string; gameHash?: string; builtin?: string; coverArt?: string; artAlt?: string; artLocation?: string; levelRange?: string };
type RuntimeLaunch = { module: ModuleCard; game?: Uint8Array; builtin?: string };
type Hero = { id: string; name: string; job: string; hp: number; maxHp: number; mp: number; maxMp: number; color: string };
type Enemy = { id: string; name: string; hp: number; maxHp: number; intent: string };
type GameState = { phase: Phase; x: number; y: number; round: number; activeHero: number; heroes: Hero[]; enemies: Enemy[]; log: string[]; battleCleared: boolean; startedAt: number };
type SaveSlot = { slot: 1 | 2 | 3 | "auto"; moduleId: string; timestamp: number; location: string; level: number; progress: number; state: GameState };

const DEFAULT_CAVEBABE: ModuleCard = { id: "lhl.cavebabe.wheel-of-fire", title: "Cavebabe: Wheel of Fire", version: "1.0.0", author: "Lunch Hour Legends", playtime: "10–20 MIN", verified: true, engine: "ohr-wasm", builtin: "cavebabe", coverArt: "/cavebabe-key-art.svg", artAlt: "Kara and her stone hot rod racing from a volcanic cave", artLocation: "THE VOLCANO ROAD", levelRange: "COMPLETE MICRO-ADVENTURE" };
const ENGINE_DIAGNOSTIC: ModuleCard = { id: "ohr.upstream.collider", title: "OHRRPGCE Engine Diagnostic", version: "upstream", author: "OHRRPGCE contributors", playtime: "DIAGNOSTIC", verified: true, engine: "ohr-wasm", builtin: "collider", levelRange: "SMOKE TEST" };
const HEROES: Hero[] = [
  { id: "mara", name: "Mara", job: "Front Man", hp: 104, maxHp: 104, mp: 30, maxMp: 30, color: "#3157b7" },
  { id: "jax", name: "Jax", job: "Guitarist", hp: 86, maxHp: 86, mp: 24, maxMp: 24, color: "#df5544" },
  { id: "priya", name: "Priya", job: "Bassist", hp: 118, maxHp: 118, mp: 22, maxMp: 22, color: "#699653" },
  { id: "theo", name: "Theo", job: "Drummer", hp: 96, maxHp: 96, mp: 28, maxMp: 28, color: "#9a68ae" },
];
const ENEMIES: Enemy[] = [
  { id: "wisp", name: "Wire Wisp", hp: 52, maxHp: 52, intent: "Charge Mark" },
  { id: "hound", name: "Glass Hound", hp: 68, maxHp: 68, intent: "Shard Lunge" },
];
const ROOM = ["############", "#..........#", "#..C.......#", "#.......E..#", "#....##....#", "#..........#", "#.P........#", "############"];
const FORBIDDEN = [".js", ".mjs", ".cjs", ".wasm", ".exe", ".dll", ".so", ".sh", ".bat", ".cmd", ".ps1", ".html"];

function freshGame(): GameState {
  return { phase: "explore", x: 2, y: 6, round: 1, activeHero: 0, heroes: HEROES.map(h => ({ ...h })), enemies: ENEMIES.map(e => ({ ...e })), log: ["The loading dock answers with a burst of static."], battleCleared: false, startedAt: Date.now() };
}
const saveKey = (id: string) => `lhl:saves:${id}`;
function readSaves(id: string): SaveSlot[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(saveKey(id)) ?? "[]") as SaveSlot[]; } catch { return []; }
}
const meter = (value: number, max: number) => `${Math.max(0, Math.min(100, value / max * 100))}%`;

async function sha256(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  if (globalThis.crypto?.subtle?.digest) {
    const result = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
    return Array.from(new Uint8Array(result), n => n.toString(16).padStart(2, "0")).join("");
  }
  const data = Array.from(bytes); const bits = data.length * 8; data.push(128);
  while (data.length % 64 !== 56) data.push(0);
  for (let n = 56; n >= 0; n -= 8) data.push(Math.floor(bits / 2 ** n) & 255);
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rr = (v: number, n: number) => (v >>> n) | (v << (32 - n));
  for (let o = 0; o < data.length; o += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) { const p = o + i * 4; w[i] = ((data[p]<<24)|(data[p+1]<<16)|(data[p+2]<<8)|data[p+3]) >>> 0; }
    for (let i = 16; i < 64; i++) { const a = rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3); const b = rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10); w[i]=(w[i-16]+a+w[i-7]+b)>>>0; }
    let [a,b,c,d,e,f,g,z] = h;
    for (let i = 0; i < 64; i++) { const s1=rr(e,6)^rr(e,11)^rr(e,25), ch=(e&f)^(~e&g), t1=(z+s1+ch+k[i]+w[i])>>>0, s0=rr(a,2)^rr(a,13)^rr(a,22), maj=(a&b)^(a&c)^(b&c), t2=(s0+maj)>>>0; z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
    [a,b,c,d,e,f,g,z].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
  }
  return h.map(n=>n.toString(16).padStart(8,"0")).join("");
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [module, setModule] = useState<ModuleCard>(()=>{if(typeof window==="undefined")return DEFAULT_CAVEBABE;const raw=localStorage.getItem("lhl:active-module");if(!raw)return DEFAULT_CAVEBABE;try{const saved=JSON.parse(raw) as ModuleCard;return saved.id==="lhl.battle-of-the-bands.reference"?DEFAULT_CAVEBABE:saved}catch{return DEFAULT_CAVEBABE}});
  const [game, setGame] = useState<GameState>(() => freshGame());
  const [saves, setSaves] = useState<SaveSlot[]>(()=>readSaves(module.id));
  const [notice, setNotice] = useState("Cavebabe cartridge ready.");
  const [help, setHelp] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeLaunch>();
  const latest = useMemo(() => [...saves].sort((a,b)=>b.timestamp-a.timestamp)[0], [saves]);
  const writeSave = useCallback((state: GameState, slot: SaveSlot["slot"]) => {
    const item: SaveSlot = { slot, moduleId: module.id, timestamp: Date.now(), location: state.phase === "battle" ? "Loading Dock — Battle" : state.battleCleared ? "Loading Dock — Cleared" : "Loading Dock", level: 1, progress: state.battleCleared ? 8 : state.phase === "battle" ? 5 : 2, state };
    const next = [...readSaves(module.id).filter(s=>s.slot!==slot),item]; localStorage.setItem(saveKey(module.id),JSON.stringify(next)); setSaves(next);
  },[module.id]);
  const autosave = useCallback((state: GameState) => { writeSave(state,"auto"); setNotice("Safe-node autosave updated."); }, [writeSave]);
  const openModule = () => {
    if (module.engine === "ohr-wasm") { setRuntime({module,builtin:module.builtin}); setScreen("ohr"); return; }
    setGame(freshGame()); setScreen("game");
  };
  const continueModule = () => {
    if (module.engine === "ohr-wasm") { setRuntime({module,builtin:module.builtin}); setScreen("ohr"); return; }
    if (latest) { setGame(latest.state); setScreen("game"); }
  };
  return <main>
    <Topbar onHelp={()=>setHelp(true)} />
    {screen === "title" && <Title module={module} canContinue={module.engine === "ohr-wasm" ? Boolean(module.builtin || module.installed) : Boolean(latest)} notice={notice} onNew={openModule} onContinue={continueModule} onLoad={()=>setScreen("load")} onCreate={()=>setScreen("create")} onDiagnostic={()=>{setRuntime({module:ENGINE_DIAGNOSTIC,builtin:"collider"});setScreen("ohr")}} />}
    {screen === "game" && <Game game={game} setGame={setGame} onTitle={()=>setScreen("title")} onSaves={()=>setScreen("saves")} onAutosave={autosave} />}
    {screen === "saves" && <SaveScreen saves={saves} onBack={()=>setScreen("game")} onSave={(slot)=>{writeSave(game,slot);setNotice(`Manual slot ${slot} saved.`)}} onLoad={(save)=>{setGame(save.state);setScreen("game")}} />}
    {screen === "load" && <LoadScreen current={module} onBack={()=>setScreen("title")} onActivate={(next,gameBytes)=>{setModule(next);setRuntime({module:next,game:gameBytes});setNotice(`${next.title} validated. Installing into the official runtime…`);setSaves([]);setScreen("ohr")}} />}
    {screen === "create" && <CreateScreen onBack={()=>setScreen("title")} onLoad={()=>setScreen("load")} />}
    {screen === "ohr" && runtime && <OhrRuntime launch={runtime} onBack={()=>setScreen("title")} onInstalled={(installed)=>{setModule(installed);localStorage.setItem("lhl:active-module",JSON.stringify(installed));setNotice(`${installed.title} is installed for official OHRRPGCE execution.`)}} />}
    {help && <Help onClose={()=>setHelp(false)} />}
  </main>;
}

function Topbar({onHelp}:{onHelp:()=>void}) { return <header className="topbar"><div className="brand"><b>◆</b> LHL <span>RUNTIME 0.2</span></div><div><button onClick={onHelp}>How to play</button><span className="audio-note">AUDIO · PLAYER CONTROLLED</span></div></header> }

function Title({module,canContinue,notice,onNew,onContinue,onLoad,onCreate,onDiagnostic}:{module:ModuleCard;canContinue:boolean;notice:string;onNew:()=>void;onContinue:()=>void;onLoad:()=>void;onCreate:()=>void;onDiagnostic:()=>void}) {
  const loadedKind = module.engine === "ohr-wasm" ? "LOADED OHR CARTRIDGE" : "LOADED INTERACTION PROOF";
  return <section className="title-grid" aria-label="Lunch Hour Legends title screen">
    <div className={`key-art ${module.coverArt?"":"generated-key-art"}`}>
      {module.coverArt ? <img src={module.coverArt} alt={module.artAlt??`${module.title} cartridge art`}/> : <div className="generated-cartridge-art" aria-label={`${module.title} cartridge label`}><span>OHR</span><b>{module.title}</b><small>{module.author}</small></div>}
      <div className="art-caption"><span>{loadedKind}</span><strong>{module.artLocation??module.title.toUpperCase()}</strong></div>
    </div>
    <div className="title-panel"><div className="gem">◆</div><p className="lunch">LUNCH HOUR</p><h1>LEGENDS</h1><p className="tagline">A complete little RPG before<br/>the afternoon meeting.</p>
      <nav className="main-menu" aria-label="Main menu"><button className="primary" onClick={onNew}>New Game</button><button className="continue" onClick={onContinue} disabled={!canContinue}>Continue</button>{!canContinue&&<small>No compatible save exists for this module.</small>}<button onClick={onLoad}>Load Module</button><button onClick={onCreate}>Create Module</button></nav>
      <article className="module-card" aria-label={`Active module: ${module.title}`}><div className="cover"><span>{module.builtin==="cavebabe"?"●":"◆"}</span><b>{module.engine==="ohr-wasm"?"OHR":"UI"}</b></div><div className="module-copy"><em>ACTIVE MODULE</em><h2>{module.title}</h2><dl><div><dt>TIME</dt><dd>{module.playtime}</dd></div><div><dt>ENGINE</dt><dd>{module.engine === "ohr-wasm" ? "OHRRPGCE WASM" : "REACT TECH PROOF"}</dd></div><div><dt>RANGE</dt><dd>{module.levelRange??"MODULE DEFINED"}</dd></div></dl></div><div className="verified">◆ {module.verified?"CARTRIDGE VERIFIED":"UNVERIFIED"}</div></article><p className="notice" role="status">{notice}</p>
      <button className="engine-diagnostic" onClick={onDiagnostic}>Run official OHRRPGCE engine diagnostic</button>
    </div>
  </section>;
}

function Game({game,setGame,onTitle,onSaves,onAutosave}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onTitle:()=>void;onSaves:()=>void;onAutosave:(s:GameState)=>void}) {
  const move=useCallback((dx:number,dy:number)=>setGame(s=>{if(s.phase!=="explore")return s;const x=s.x+dx,y=s.y+dy;if(ROOM[y]?.[x]==="#")return s;if(x===8&&y===3&&!s.battleCleared)return {...s,x,y,phase:"battle",activeHero:0,log:["A Wire Wisp marks the downbeat. The Glass Hound lunges."]};return {...s,x,y}}),[setGame]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{const m:Record<string,[number,number]>={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};const v=m[e.key.toLowerCase()];if(v){e.preventDefault();move(...v)}};addEventListener("keydown",fn);return()=>removeEventListener("keydown",fn)},[move]);
  useEffect(()=>{if(game.phase==="victory"&&game.battleCleared)onAutosave(game)},[game,onAutosave]);
  return <section className="play-layout"><header className="play-head"><div><span>BATTLE OF THE BANDS</span><h1>{game.phase==="battle"?"Soundcheck Scramble":game.phase==="victory"?"The Dock Falls Quiet":"Loading Dock"}</h1></div><div><button onClick={onSaves}>Save / Load</button><button onClick={onTitle}>Title Screen</button></div></header>
    {game.phase==="explore"&&<Explore game={game} move={move}/>} {game.phase==="battle"&&<Battle game={game} setGame={setGame}/>} {game.phase==="victory"&&<div className="victory"><b>◆</b><span>ENCOUNTER CLEARED</span><h2>The static breaks into rhythm.</h2><p>The freight lift wakes. This proof has completed one room, one battle, and one rotating safe-node autosave.</p><button className="primary compact" onClick={()=>setGame(s=>({...s,phase:"explore"}))}>Return to the Dock</button></div>}
    <Party heroes={game.heroes} active={game.phase==="battle"?game.activeHero:-1}/></section>;
}

function Explore({game,move}:{game:GameState;move:(x:number,y:number)=>void}) { return <div className="explore"><div className="map-frame" role="application" tabIndex={0} aria-label="Loading Dock room. Use arrow keys or WASD to move."><div className="tile-map">{ROOM.flatMap((row,y)=>row.split("").map((t,x)=><div key={`${x}-${y}`} className={`tile ${t==="#"?"wall":t==="C"?"crate-tile":t==="E"?"enemy-tile":"floor"}`}>{t==="C"&&<span className="crate">×</span>}{t==="E"&&!game.battleCleared&&<span className="enemy-sprite">ϟ</span>}{x===game.x&&y===game.y&&<span className="party-sprite" aria-label="Party">♟</span>}</div>))}</div></div><aside className="objective"><span>CURRENT OBJECTIVE</span><h2>{game.battleCleared?"Reach the freight lift":"Trace the static signal"}</h2><p>{game.battleCleared?"The encounter is clear. Explore or save your progress.":"Cross the dock and confront the charged shape near the north wall."}</p><div className="dpad" aria-label="Movement controls"><button aria-label="Move up" onClick={()=>move(0,-1)}>▲</button><button aria-label="Move left" onClick={()=>move(-1,0)}>◀</button><button aria-label="Move down" onClick={()=>move(0,1)}>▼</button><button aria-label="Move right" onClick={()=>move(1,0)}>▶</button></div><small>KEYBOARD · ARROWS / WASD</small></aside></div> }

const MOVES = [[{name:"Work the Crowd",power:18,cost:4},{name:"Hype",power:12,cost:2}],[{name:"Power Chord",power:25,cost:5},{name:"Build Feedback",power:15,cost:2}],[{name:"Hold the Line",power:17,cost:3},{name:"Low End",power:21,cost:5}],[{name:"Downbeat",power:20,cost:4},{name:"Beat Pattern",power:16,cost:2}]];
function Battle({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}) { const act=(mi:number)=>setGame(s=>{const hero=s.heroes[s.activeHero],move=MOVES[s.activeHero][mi];if(hero.mp<move.cost)return {...s,log:[`${hero.name} needs ${move.cost} MP.`]};const ti=s.enemies.findIndex(e=>e.hp>0);if(ti<0)return s;const heroes=s.heroes.map((h,i)=>i===s.activeHero?{...h,mp:h.mp-move.cost}:h);const enemies=s.enemies.map((e,i)=>i===ti?{...e,hp:Math.max(0,e.hp-move.power)}:e);const line=`${hero.name} uses ${move.name}. ${enemies[ti].name} takes ${move.power}.`;if(enemies.every(e=>e.hp<=0))return {...s,heroes,enemies,phase:"victory",battleCleared:true,log:[line,"Victory. The freight lift answers."]};if(s.activeHero+1<heroes.length)return {...s,heroes,enemies,activeHero:s.activeHero+1,log:[line]};const alive=enemies.filter(e=>e.hp>0).length;return {...s,heroes:heroes.map((h,i)=>({...h,hp:Math.max(1,h.hp-(i===s.round%4?11+alive*3:4))})),enemies,activeHero:0,round:s.round+1,log:[line,"Enemy phase: static pressure ripples across the party."]}}); const active=game.heroes[game.activeHero]; return <div className="battle"><div className="battle-stage"><div className="beams"/><div className="enemy-row">{game.enemies.map(e=><article key={e.id} className={e.hp<=0?"defeated":""}><div>{e.id==="wisp"?"ϟ":"◇"}</div><h3>{e.name}</h3><div className="hp"><i style={{width:meter(e.hp,e.maxHp)}}/></div><small>{e.hp} / {e.maxHp} HP</small>{e.hp>0&&<p>INTENT · {e.intent}</p>}</article>)}</div><div className="battle-log" role="status">{game.log.map((x,i)=><p key={i}>{x}</p>)}</div></div><aside className="commands"><span>ROUND {game.round} · {active.name.toUpperCase()}</span><h2>Choose a command</h2>{MOVES[game.activeHero].map((m,i)=><button key={m.name} onClick={()=>act(i)} disabled={active.mp<m.cost}><b>{m.name}</b><small>{m.cost} MP</small></button>)}<div className="tip"><b>READ THE FIELD</b><p>Enemy intent is declared before action. Every choice should explain itself.</p></div></aside></div> }

function Party({heroes,active}:{heroes:Hero[];active:number}) { return <div className="party" aria-label="Party status">{heroes.map((h,i)=><article key={h.id} className={i===active?"active":""} style={{"--hero":h.color} as React.CSSProperties}><b>{h.name[0]}</b><div><h3>{h.name} <small>{h.job}</small></h3><div className="hp"><i style={{width:meter(h.hp,h.maxHp)}}/></div><span>{h.hp}/{h.maxHp} HP · {h.mp}/{h.maxMp} MP</span></div></article>)}</div> }

function SaveScreen({saves,onBack,onSave,onLoad}:{saves:SaveSlot[];onBack:()=>void;onSave:(n:1|2|3)=>void;onLoad:(s:SaveSlot)=>void}) { return <Shell back={onBack} kicker="LOCAL · MODULE-SCOPED" title="Save / Load"><div className="save-list">{([1,2,3] as const).map(n=>{const s=saves.find(x=>x.slot===n);return <article key={n}><div><span>SLOT {n}</span><h2>{s?s.location:"Empty slot"}</h2>{s&&<p>{new Date(s.timestamp).toLocaleString()} · {s.progress}% proof</p>}</div><div><button onClick={()=>onSave(n)}>Save</button>{s&&<button className="primary" onClick={()=>onLoad(s)}>Load</button>}</div></article>})}{saves.find(x=>x.slot==="auto")&&<article><div><span>SAFE-NODE AUTOSAVE</span><h2>{saves.find(x=>x.slot==="auto")!.location}</h2></div><button className="primary" onClick={()=>onLoad(saves.find(x=>x.slot==="auto")!)}>Load</button></article>}</div></Shell> }

function OhrRuntime({launch,onBack,onInstalled}:{launch:RuntimeLaunch;onBack:()=>void;onInstalled:(m:ModuleCard)=>void}) {
  const diagnostic = launch.builtin === "collider";
  const frame = useRef<HTMLIFrameElement>(null);
  const [status,setStatus] = useState(launch.game ? "Waiting for the official runtime to accept the cartridge…" : "Loading the official OHRRPGCE runtime…");
  const [installed,setInstalled] = useState(Boolean(launch.module.installed));
  const src = launch.builtin
    ? `/ohr/lhl-player.html?builtin=${encodeURIComponent(launch.builtin)}`
    : `/ohr/lhl-player.html?module=${encodeURIComponent(launch.module.id)}${!launch.game && launch.module.installed ? "&installed=1" : ""}`;
  useEffect(()=>{
    const receive = (event:MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.moduleId !== (launch.builtin ? "unassigned" : launch.module.id)) return;
      if (event.data.type === "lhl:ohr-ready" && launch.game) {
        const copy = launch.game.slice();
        frame.current?.contentWindow?.postMessage({type:"lhl:mount-cartridge",moduleId:launch.module.id,game:copy.buffer},location.origin,[copy.buffer]);
        setStatus("Installing validated game.rpg into module-scoped browser storage…");
      } else if (event.data.type === "lhl:ohr-mounted") {
        setInstalled(true);
        setStatus("Cartridge installed. Start OHRRPGCE inside the player to enable audio.");
        onInstalled({...launch.module,installed:true});
      } else if (event.data.type === "lhl:ohr-runtime-ready") {
        setStatus("Runtime ready. Use the blue start control inside the player; that click unlocks engine audio.");
      } else if (event.data.type === "lhl:ohr-running") {
        setStatus("Official OHRRPGCE execution active · SDL2 graphics and SDL_mixer audio");
      } else if (event.data.type === "lhl:ohr-error") {
        setStatus(`Runtime error · ${event.data.message}`);
      }
    };
    addEventListener("message",receive);
    return ()=>removeEventListener("message",receive);
  },[launch,onInstalled]);
  return <section className="ohr-shell">
    <header className="ohr-head"><div><span>OFFICIAL WEB PLAYER · WASM</span><h1>{diagnostic ? "OHRRPGCE Engine Diagnostic" : launch.module.title}</h1><p>{diagnostic ? "Bundled upstream collider.rpg smoke cartridge" : `${launch.module.author} · ${launch.module.version}`}</p></div><button onClick={onBack}>← Title Screen</button></header>
    <div className="runtime-frame"><iframe ref={frame} src={src} title={`Official OHRRPGCE player — ${launch.module.title}`} allow="autoplay; fullscreen" /></div>
    <footer className="runtime-status"><div><b className={installed||launch.builtin?"good":""}>{installed||launch.builtin?"◆ READY":"◇ INSTALLING"}</b><span role="status">{status}</span></div><dl><div><dt>ENGINE</dt><dd>OHRRPGCE wip 20260512.14297</dd></div><div><dt>EXECUTION</dt><dd>WebAssembly · <a href="https://rpg.hamsterrepublic.com/ohrrpgce/Web_port" target="_blank" rel="noreferrer">upstream build ↗</a></dd></div><div><dt>SAVES</dt><dd>IndexedDB · module-scoped</dd></div></dl></footer>
  </section>;
}

async function validateArchive(file: File) {
  if(!file.name.toLowerCase().endsWith(".lhl.zip"))throw new Error("Filename must end in .lhl.zip."); if(file.size>25*1024*1024)throw new Error("Archive exceeds the 25 MB compressed limit.");
  const buf=await file.arrayBuffer();let expanded=0,count=0;let files:Record<string,Uint8Array>;
  try{files=unzipSync(new Uint8Array(buf),{filter(info){count++;expanded+=info.originalSize;if(count>500)throw new Error("Archive contains more than 500 files.");if(expanded>96*1024*1024)throw new Error("Archive exceeds the 96 MB expanded limit.");const name=info.name.replaceAll("\\","/");if(name.startsWith("/")||name.split("/").includes(".."))throw new Error(`Unsafe archive path: ${info.name}`);if(FORBIDDEN.some(ext=>name.toLowerCase().endsWith(ext)))throw new Error(`Forbidden executable content: ${info.name}`);return true}})}catch(error){throw new Error(error instanceof Error?error.message:"This file is not a readable ZIP archive.")}
  const required=["manifest.json","game.rpg","design.md","credits.md","validation/report.json"];const missing=required.filter(x=>!files[x]);if(missing.length)throw new Error(`Missing required files: ${missing.join(", ")}`);
  let parsed:unknown;try{parsed=JSON.parse(strFromU8(files["manifest.json"]))}catch{throw new Error("manifest.json is not valid JSON.")}if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("manifest.json must contain an object.");const manifest=parsed as Record<string,unknown>;
  for(const key of ["id","title","version","author","minimumRuntimeVersion","entryRpg","saveNamespace"]){if(!manifest[key])throw new Error(`Manifest is missing ${key}.`)}
  const id=String(manifest.id),entry=String(manifest.entryRpg).replaceAll("\\","/");if(!/^[a-z0-9][a-z0-9._-]{2,95}$/i.test(id))throw new Error("Manifest id must be 3–96 safe filename characters.");if(entry!=="game.rpg")throw new Error("This runtime profile requires entryRpg to be game.rpg at archive root.");
  const gameBytes=files[entry];if(gameBytes.byteLength<1024)throw new Error("game.rpg is too small to be a valid OHRRPGCE cartridge.");if(gameBytes.byteLength>32*1024*1024)throw new Error("game.rpg exceeds the 32 MB runtime limit.");const lumps=parseOhrRpg(gameBytes,{maxBytes:32*1024*1024});const lumpNames=new Set(lumps.map(lump=>lump.name.toLowerCase()));if(!lumpNames.has("browse.txt")||!lumpNames.has("archinym.lmp"))throw new Error("game.rpg is not a recognizable OHRRPGCE cartridge.");
  const hashes=manifest.hashes&&typeof manifest.hashes==="object"&&!Array.isArray(manifest.hashes)?manifest.hashes as Record<string,unknown>:undefined;const gameHash=await sha256(gameBytes);const declared=hashes?.[entry]??manifest.gameSha256;if(declared&&String(declared).replace(/^sha256:/i,"").toLowerCase()!==gameHash)throw new Error("game.rpg SHA-256 does not match the manifest.");
  const card:ModuleCard={id,title:String(manifest.title),version:String(manifest.version),author:String(manifest.author),playtime:String(manifest.playtime??"60–120 MIN"),verified:true,engine:"ohr-wasm",saveNamespace:String(manifest.saveNamespace),gameHash};
  return {files,gameBytes:gameBytes.slice(),card,expanded,hashVerified:Boolean(declared),lumpCount:lumps.length};
}
function LoadScreen({current,onBack,onActivate}:{current:ModuleCard;onBack:()=>void;onActivate:(m:ModuleCard,game:Uint8Array)=>void}) { const ref=useRef<HTMLInputElement>(null);const [candidate,setCandidate]=useState<{card:ModuleCard;game:Uint8Array}>();const [report,setReport]=useState<{ok:boolean;text:string}>();const inspect=async(file?:File)=>{setCandidate(undefined);if(!file)return;try{const result=await validateArchive(file);setCandidate({card:result.card,game:result.gameBytes});setReport({ok:true,text:`${Object.keys(result.files).length} package files · ${result.lumpCount} native OHR lumps · ${(result.expanded/1048576).toFixed(1)} MB expanded · game.rpg SHA-256 ${result.card.gameHash?.slice(0,12)}…${result.hashVerified?" matched manifest":" computed"}.`})}catch(e){setReport({ok:false,text:e instanceof Error?e.message:"Validation failed."})}};return <Shell back={onBack} kicker="VALIDATE BEFORE ACTIVATION" title="Load Module"><p className="lede">The current module remains active unless the selected <b>.lhl.zip</b> passes fail-closed path, executable, size, manifest, native OHR container, and cartridge checks and you explicitly activate it.</p><div className="drop"><b>◇</b><h2>Drop a module cartridge here</h2><p>25 MB compressed · 96 MB expanded · local validation · no upload</p><button onClick={()=>ref.current?.click()}>Choose .lhl.zip</button><input ref={ref} hidden type="file" accept=".zip,.lhl.zip" onChange={e=>inspect(e.target.files?.[0])}/></div>{report&&<div className={`report ${report.ok?"ok":"bad"}`} role="status"><b>{report.ok?"VALIDATION PASSED":"ACTIVATION BLOCKED"}</b><p>{report.text}</p>{candidate&&<><h2>{candidate.card.title}</h2><p>{candidate.card.author} · {candidate.card.version} · OHRRPGCE WASM</p><button className="primary" onClick={()=>onActivate(candidate.card,candidate.game)}>Activate &amp; run in OHRRPGCE</button></>}</div>}<div className="safe">CURRENTLY SAFE · <b>{current.title}</b> {current.version}</div></Shell> }

function CreateScreen({onBack,onLoad}:{onBack:()=>void;onLoad:()=>void}) { const [text,setText]=useState("");const [spec,setSpec]=useState("");const [compiled,setCompiled]=useState("");const [status,setStatus]=useState("Your description stays in this browser until you paste it elsewhere.");useEffect(()=>{fetch("/lhl-authoring-spec.txt").then(r=>{if(!r.ok)throw new Error("Static authoring spec is unavailable.");return r.text()}).then(s=>{if(!s.includes("ClassBudget(level)")||!s.includes("manifest.json")||!s.includes("exactly sixteen"))throw new Error("Static authoring spec failed its integrity sentinels.");setSpec(s)}).catch(e=>setStatus(e.message))},[]);const build=async()=>{if(!text||!spec)return;const payload=`${text}\n\n--- BEGIN AUTOMATIC LUNCH HOUR LEGENDS MODULE REQUIREMENTS ---\n\n${spec}`;const hash=await sha256(payload);setCompiled(payload);try{await navigator.clipboard.writeText(payload);setStatus(`Module prompt copied · ${payload.length.toLocaleString()} characters · SHA-256 ${hash.slice(0,12)}…`)}catch{setStatus(`Clipboard unavailable. Use the manual-copy field below · SHA-256 ${hash.slice(0,12)}…`)}};const download=(ext:string)=>{const blob=new Blob([compiled],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`lhl-module-prompt.${ext}`;a.click();URL.revokeObjectURL(url)};return <Shell back={onBack} kicker="PROMPT IN · RPG OUT" title="Create Module"><div className="creator"><div><label htmlFor="idea">Describe the module you want here</label><textarea id="idea" value={text} onChange={e=>setText(e.target.value)} placeholder="A bright, funny RPG about rival bands competing for the last open stage at a cursed municipal festival…"/><button className="primary full" disabled={!text||!spec} onClick={build}>Copy Module Prompt</button><p className="notice" role="status">{status}</p>{compiled&&<details open><summary>Manual-copy fallback and raw prompt</summary><textarea aria-label="Compiled module prompt" readOnly value={compiled}/></details>}</div><aside><span>THE COMPILED PROMPT INCLUDES</span><ul><li>Your text, exactly as entered, at character one</li><li>The embedded versioned authoring specification</li><li>The explicit <code>lhl.zip</code> package tree</li><li>UCS-PB formulas, limits, and validators</li><li>Self-validation and packaging instructions</li><li>The optional provenance link</li></ul><div className="metrics"><p><strong>{compiled?compiled.length.toLocaleString():"—"}</strong> CHARACTERS</p><p><strong>{compiled?Math.ceil(compiled.length/4).toLocaleString():"—"}</strong> EST. TOKENS</p></div>{compiled&&<div className="downloads"><button onClick={()=>download("txt")}>Download TXT</button><button onClick={()=>download("md")}>Download Markdown</button></div>}</aside></div><p className="handoff">Already received an <b>lhl.zip</b>? <button onClick={onLoad}>Validate and load it →</button></p></Shell> }

function Shell({back,kicker,title,children}:{back:()=>void;kicker:string;title:string;children:React.ReactNode}) { return <section className="subscreen"><button className="back" onClick={back}>← Back</button><span className="kicker">{kicker}</span><h1>{title}</h1>{children}</section> }
function Help({onClose}:{onClose:()=>void}) { return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><article><button className="close" onClick={onClose}>×</button><span>QUICK START</span><h2 id="help-title">One room. One battle. One safe return.</h2><ol><li>Choose <b>New Game</b>.</li><li>Move with arrows, WASD, or the on-screen pad.</li><li>Touch the cyan static shape and use each hero’s commands.</li><li>Victory writes the rotating autosave. Manual slots live under Save / Load.</li></ol><p>Load Module validates a local archive before activation. Create Module prepares a self-contained prompt for the external LLM of your choice.</p></article></div> }
