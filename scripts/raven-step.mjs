import {overlaps, inside, rangeInUnits} from "./geometry.mjs";
const ID = "raven-step";
const busy = new Set();
const nativeRuns = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const setting = key => game.settings.get(ID, key);
export const isMisty = item => item?.type === "spell" &&
  (item.system?.identifier === "misty-step" || item.name?.trim().toLowerCase() === "misty step");
const matches = item => isMisty(item) || item?.system?.identifier === "blessing-of-the-raven-queen" ||
  item?.getFlag?.(ID, "enabled") === true;

Hooks.once("init", () => {
  game.settings.register(ID, "enabled", {name: "Перехоплювати Raven Queen та Misty Step", scope: "world", config: true, type: Boolean, default: true});
  game.settings.register(ID, "volume", {name: "Гучність телепортації", scope: "client", config: true, type: Number, range: {min: 0, max: 1, step: 0.05}, default: 0.4});
  game.settings.register(ID, "effects", {name: "Тіньові візуальні ефекти", scope: "client", config: true, type: Boolean, default: true});
});
Hooks.once("ready", () => {
  game.modules.get(ID).api = {use, matches};
  game.socket.on(`module.${ID}`, data => {
    // Socket messages render cosmetics only; never change documents or execute code.
    if (data?.scene !== canvas.scene?.id || !["depart", "arrive"].includes(data.kind)) return;
    const token = canvas.tokens?.get(data.token);
    if (!token || (!game.user.isGM && (!token.visible || token.document.hidden))) return;
    if (![data.x, data.y].every(Number.isFinite)) return;
    if (!canvas.dimensions.sceneRect.contains(data.x, data.y)) return;
    if (!game.user.isGM && !canvas.visibility.testVisibility({x:data.x,y:data.y}, {tolerance:0,object:token})) return;
    renderFX(data);
  });
});
Hooks.on("dnd5e.preUseActivity", (activity, usage={}, dialog={}, message={}) => {
  const run=nativeRuns.get(usage.ravenStepNonce);
  if (run && !run.entered && run.uuid===activity.item.uuid) {run.entered=true;return;}
  if (!setting("enabled") || !matches(activity.item)) return;
  const item=activity.actor?.items?.get(activity.item.id) ?? activity.item.actor?.items?.get(activity.item.id) ?? activity.item;
  const original=item.system.activities?.get(activity.id) ?? activity;
  void use(item,{activity:original,usage,dialog,message}).catch(report);
  return false;
});
Hooks.on("dnd5e.preActivityConsumption", (activity, usage) => {
  const run=nativeRuns.get(usage.ravenStepNonce);
  if (!run || run.uuid!==activity.item.uuid) return;
  try {run.validate();} catch(e) {report(e);return false;}
});
Hooks.on("dnd5e.postActivityConsumption", (activity, usage, message) => {
  const run=nativeRuns.get(usage.ravenStepNonce);
  if (run && run.uuid===activity.item.uuid) run.deltas=message.data?.system?.deltas;
});
async function castNative(item, context, validateNow) {
  const activities=Array.from(item.system.activities?.values() ?? []);
  const activity=context.activity ?? (activities.length===1 ? activities[0] : null);
  if (!activity?.use) throw new Error("Використай конкретну активність Misty Step на листі персонажа.");
  const nonce=foundry.utils.randomID();
  const run={uuid:item.uuid,entered:false,validate:validateNow,deltas:null};
  nativeRuns.set(nonce,run);
  const refund=async()=> {
    if(run.deltas) {await activity.refund(run.deltas);run.deltas=null;}
  };
  try {
    const results=await activity.use({...context.usage,ravenStepNonce:nonce},context.dialog ?? {},context.message ?? {});
    if (!results) {await refund();return null;}
    run.deltas ??= results.message?.system?.deltas;
    return {refund};
  } catch(e) {await refund();throw e;}
  finally {nativeRuns.delete(nonce);}
}
function report(e) { console.error(`${ID} |`, e); ui.notifications.error(`Raven Step: ${e.message}`); }
function chooseToken(actor) {
  const controlled = canvas.tokens.controlled.filter(t => t.actor?.uuid === actor.uuid);
  if (controlled.length === 1) return controlled[0];
  const candidates = canvas.tokens.placeables.filter(t => t.actor?.uuid === actor.uuid && t.isOwner);
  if (candidates.length === 1) return candidates[0];
  throw new Error("Вибери рівно один токен цього персонажа.");
}
function available(item) {
  const raw = item.system.uses.max;
  const max = Number(raw === "@prof" ? item.actor.system.attributes.prof : raw);
  const spent = Number(item.system.uses.spent ?? 0);
  if (!Number.isFinite(max) || !Number.isFinite(spent)) throw new Error("Не вдалося прочитати ліміт використань здібності.");
  if (max - spent < 1) throw new Error("Не залишилося використань здібності.");
  return spent;
}
function destination(token, point) {
  const pos = {x: point.x-token.w/2, y: point.y-token.h/2};
  const snapped = canvas.grid.type === 0 ? pos : token.document.getSnappedPosition(pos);
  return {x:Math.round(snapped.x),y:Math.round(snapped.y)};
}
function validate(token, pos) {
  if (!token.isOwner) throw new Error("Потрібні права власника токена.");
  const rect = {...pos,w:token.w,h:token.h};
  if (!inside(rect, canvas.dimensions.sceneRect)) throw new Error("Точка поза межами сцени.");
  const center = {x:pos.x+token.w/2,y:pos.y+token.h/2};
  const distance = canvas.grid.measurePath([token.center, center]).distance;
  if (distance > rangeInUnits(canvas.scene.grid.units)+0.001) throw new Error("Точка далі ніж 30 футів.");
  if (Math.hypot(pos.x-token.document.x,pos.y-token.document.y)<1) throw new Error("Вибери іншу точку.");
  // Individual token LOS, not combined party vision. Light/vision checked separately.
  if (token.checkCollision(center, {type:"sight", mode:"any"})) throw new Error("Точка закрита від прямого огляду.");
  if (!game.user.isGM && !canvas.visibility.testVisibility(center,{tolerance:0,object:token})) throw new Error("Точку не видно.");
  for (const other of canvas.tokens.placeables) {
    if (other.id === token.id || other.document.elevation !== token.document.elevation) continue;
    if (overlaps(rect, {x:other.document.x,y:other.document.y,w:other.w,h:other.h})) throw new Error("Ця точка недоступна.");
  }
  return {center,distance};
}
function overlay(interactive = false) {
  const el = document.createElement("canvas");
  el.width = innerWidth; el.height = innerHeight;
  Object.assign(el.style,{position:"fixed",inset:"0",width:"100vw",height:"100vh",zIndex:"10000",pointerEvents:interactive?"auto":"none",cursor:interactive?"crosshair":"default"});
  document.body.append(el);
  return el;
}
function screen(p) {
  const q = canvas.stage.toGlobal(p);
  const r = canvas.app.view.getBoundingClientRect();
  return {x:q.x+r.left,y:q.y+r.top};
}
function pick(token) {
  ui.notifications.info("Raven Step: вибери точку. ЛКМ — телепорт; Esc або ПКМ — скасувати.");
  const scene = canvas.scene.id;
  const el=overlay(true), ctx=el.getContext("2d");
  return new Promise(resolve => {
    let pos=null;
    const cleanup = result => {
      clearTimeout(timeout); document.removeEventListener("keydown",key,true);
      Hooks.off("canvasTearDown",tear); el.remove(); resolve(result);
    };
    const key = e => {if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();cleanup(null);}};
    const tear = Hooks.on("canvasTearDown",()=>cleanup(null));
    const timeout=setTimeout(()=>cleanup(null),120000);
    document.addEventListener("keydown",key,true);
    el.oncontextmenu=e=>{e.preventDefault();cleanup(null);};
    el.onpointermove=e=>{
      if(canvas.scene?.id!==scene) return cleanup(null);
      const r=canvas.app.view.getBoundingClientRect();
      const p=canvas.stage.toLocal({x:e.clientX-r.left,y:e.clientY-r.top});
      pos=destination(token,p);
      let error="", result;
      try {result=validate(token,pos);} catch(e){error=e.message;}
      ctx.clearRect(0,0,el.width,el.height);
      const a=screen(pos), b=screen({x:pos.x+token.w,y:pos.y+token.h});
      ctx.strokeStyle=error?"#f87171":"#c4b5fd";ctx.lineWidth=3;
      ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
      ctx.font="bold 16px sans-serif";
      const label=error || `${result.distance.toFixed(1)} ${canvas.scene.grid.units} · ЛКМ підтвердити`;
      const x=Math.min(e.clientX+18,innerWidth-380), y=Math.max(30,e.clientY-15);
      ctx.fillStyle="#100c20";ctx.fillRect(x-8,y-22,ctx.measureText(label).width+16,32);
      ctx.fillStyle=error?"#fca5a5":"#ddd6fe";ctx.fillText(label,x,y);
    };
    el.onpointerdown=e=>{
      e.preventDefault();e.stopPropagation();
      if(e.button!==0 || !pos) return;
      try {validate(token,pos);cleanup(pos);} catch(e){ui.notifications.warn(e.message);}
    };
  });
}
export async function use(item, context={}) {
  if (!canvas.ready || !item?.actor || !item.isOwner) throw new Error("Відкрий сцену й здібність на листі власного персонажа.");
  if (game.paused && !game.user.isGM) throw new Error("Гру поставлено на паузу.");
  const key=item.uuid;
  if (busy.has(key) || busy.size) return ui.notifications.warn("Спочатку заверши поточний вибір точки.");
  busy.add(key);
  try {
    const misty=isMisty(item);
    if (!misty) available(item);
    const token=chooseToken(item.actor), scene=canvas.scene.id;
    const origin={x:token.document.x,y:token.document.y};
    const pos=await pick(token);
    if (!pos) return;
    if (canvas.scene?.id!==scene || !canvas.tokens.get(token.id)) throw new Error("Сцену або токен змінено.");
    if(token.document.x!==origin.x || token.document.y!==origin.y) throw new Error("Токен уже перемістили. Повтори вибір.");
    if(game.paused && !game.user.isGM) throw new Error("Гру поставлено на паузу.");
    const check=()=> {
      if (canvas.scene?.id!==scene || !canvas.tokens.get(token.id)) throw new Error("Сцену або токен змінено.");
      if (game.paused && !game.user.isGM) throw new Error("Гру поставлено на паузу.");
      if (token.document.x!==origin.x || token.document.y!==origin.y) throw new Error("Токен уже перемістили. Повтори вибір.");
      return validate(token,pos);
    };
    const {center,distance}=check();
    let payment, spent;
    if (misty) {
      payment=await castNative(item,context,check);
      if (!payment) return;
    } else {
      spent=available(item);
      await item.update({"system.uses.spent":spent+1});
    }
    let moved=false;
    try {
      check();
      broadcastFX(token,"depart",token.center);
      await wait(360);
      if (canvas.scene?.id !== scene || token.document.x !== origin.x || token.document.y !== origin.y) throw new Error("Сцену або позицію токена змінено під час ефекту.");
      // Foundry v14 retains teleport update compatibility shim, marking the move as teleport.
      await token.document.update(pos,{animate:false,teleport:true});
      moved=Math.abs(token.document.x-pos.x)<1 && Math.abs(token.document.y-pos.y)<1;
      if(!moved) throw new Error("Переміщення заблоковано іншим модулем або регіоном.");
    } catch(e) {
      moved = Math.abs(token.document.x-pos.x)<1 && Math.abs(token.document.y-pos.y)<1;
      // Do not overwrite a resource change made by another client in the meantime.
      if (!moved && misty) await payment.refund();
      else if(!moved && Number(item.system.uses.spent)===spent+1) await item.update({"system.uses.spent":spent});
      throw e;
    }
    broadcastFX(token,"arrive",center);
    const name=foundry.utils.escapeHTML(item.name);
    const details=misty ? "Ресурси закляття оброблено штатною системою D&D5e. Опір шкоді не надається." : "Витрачено 1 використання та бонусну дію. Від 3 рівня: опір усій шкоді до початку наступного ходу (застосуйте вручну).";
    await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:item.actor,token:token.document}),content:`<h3>${name}</h3><p>Телепортація: ${distance.toFixed(1)} ${foundry.utils.escapeHTML(canvas.scene.grid.units)}. ${details}</p>`});
  } finally {busy.delete(key);}
}
function broadcastFX(token,kind,point) {
  const data={scene:canvas.scene.id,token:token.id,kind,x:point.x,y:point.y};
  try {renderFX(data);game.socket.emit(`module.${ID}`,data);} catch(e) {console.warn(ID, "Cosmetic effect failed", e);}
}
function renderFX(data) {
  const token=canvas.tokens?.get(data.token);
  if(!token || (!game.user.isGM && (token.document.hidden || !token.visible))) return;
  if(setting("volume")>0) {
    foundry.audio.AudioHelper.play({src:`modules/${ID}/assets/shadow-step.wav`,volume:setting("volume"),loop:false},false).catch(e=>console.debug(ID,e));
  }
  if(!setting("effects")) return;
  const el=overlay(),ctx=el.getContext("2d"),start=performance.now();
  const particles=Array.from({length:42},()=>({a:Math.random()*Math.PI*2,r:0.2+Math.random(),s:2+Math.random()*7}));
  function frame(now) {
    const t=(now-start)/950;
    if(t>=1 || canvas.scene?.id!==data.scene || !canvas.ready){el.remove();return;}
    ctx.clearRect(0,0,el.width,el.height);
    const p=screen(data),scale=canvas.stage.scale.x, radius=canvas.dimensions.size*scale;
    const fade=Math.sin(t*Math.PI),spread=data.kind==="depart"?t:1-t;
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius*(0.5+t));
    g.addColorStop(0,`rgba(8,3,20,${fade*0.95})`);g.addColorStop(0.45,`rgba(87,43,142,${fade*0.65})`);g.addColorStop(1,"rgba(10,2,30,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,radius*(0.5+t),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(207,183,255,${fade*0.8})`;ctx.lineWidth=2*scale;
    ctx.beginPath();ctx.ellipse(p.x,p.y,radius*(0.3+0.5*spread),radius*(0.14+0.22*spread),0,0,Math.PI*2);ctx.stroke();
    for(const v of particles){
      const a=v.a+t*1.3,x=p.x+Math.cos(a)*radius*v.r*spread,y=p.y+Math.sin(a)*radius*v.r*spread;
      ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=fade;ctx.fillStyle=v.s>6?"#bda2ea":"#11091f";
      ctx.beginPath();ctx.ellipse(0,0,v.s*scale,v.s*0.25*scale,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
