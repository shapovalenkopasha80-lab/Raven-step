import assert from 'node:assert/strict';
import {overlaps,inside,rangeInUnits} from '../scripts/geometry.mjs';
assert.equal(overlaps({x:0,y:0,w:100,h:100},{x:100,y:0,w:100,h:100}),false);
assert.equal(overlaps({x:0,y:0,w:100,h:100},{x:99,y:0,w:100,h:100}),true);
assert.equal(inside({x:900,y:0,w:101,h:100},{x:0,y:0,width:1000,height:1000}),false);
assert.equal(rangeInUnits('ft'),30);assert.equal(rangeInUnits('m'),9.144);
assert.throws(()=>rangeInUnits('km'));
let choice='accept', block=false, teardown, removed=0;
const ctx = new Proxy({measureText:()=>({width:200})},{get:(o,k)=>o[k]??(()=>{})});
globalThis.innerWidth=1200;globalThis.innerHeight=900;
globalThis.document={
 createElement:()=>({style:{},getContext:()=>ctx,remove:()=>removed++}),
 addEventListener(){},removeEventListener(){},
 body:{append(el){setTimeout(()=>{if(choice==='cancel')el.oncontextmenu({preventDefault(){}});else {el.onpointermove({clientX:250,clientY:50});el.onpointerdown({button:0,preventDefault(){},stopPropagation(){}});}},1);}}
};
const hooks=new Map();
globalThis.Hooks={once(){},on(name,fn){hooks.set(name,fn);if(name==='canvasTearDown')teardown=fn;return name;},off(){}};
globalThis.ui={notifications:{info(){},warn(){},error(){}}};
globalThis.game={paused:false,user:{isGM:true},settings:{get:()=>0},socket:{emit(){}}};
globalThis.foundry={utils:{escapeHTML:s=>s,randomID:()=>String(Math.random())}};
let messages=0;globalThis.ChatMessage={getSpeaker:()=>({}),create:async()=>messages++};
const actor={uuid:'Actor.a',system:{attributes:{prof:3}}};
const doc={x:0,y:0,elevation:0,getSnappedPosition:p=>p,update:async p=>{if(!block)Object.assign(doc,p);}};
const token={id:'t',actor,isOwner:true,visible:true,w:100,h:100,document:doc,checkCollision:()=>false,get center(){return{x:doc.x+50,y:doc.y+50};}};
const rect={x:0,y:0,width:1000,height:1000,contains:()=>true};
globalThis.canvas={ready:true,scene:{id:'s',grid:{units:'ft'}},tokens:{controlled:[token],placeables:[token],get:()=>token},dimensions:{sceneRect:rect,size:100},stage:{toLocal:p=>p,toGlobal:p=>p,scale:{x:1}},app:{view:{getBoundingClientRect:()=>({left:0,top:0})}},grid:{type:1,measurePath:([a,b])=>({distance:Math.hypot(a.x-b.x,a.y-b.y)/100*5})}};
const item={uuid:'Item.i',actor,isOwner:true,name:'Blessing',system:{uses:{max:'@prof',spent:0}},update:async v=>{item.system.uses.spent=v['system.uses.spent'];}};
const {use}=await import('../scripts/raven-step.mjs');
choice='cancel';await use(item);assert.equal(item.system.uses.spent,0);assert.equal(doc.x,0);
choice='accept';await use(item);assert.equal(item.system.uses.spent,1);assert.equal(doc.x,200);assert.equal(messages,1);
doc.x=0;block=true;await assert.rejects(use(item),/заблоковано/);assert.equal(item.system.uses.spent,1);assert.equal(doc.x,0);
item.system.uses.spent=3;await assert.rejects(use(item),/Не залишилося/);assert.equal(doc.x,0);
assert.equal(removed,3);
console.log('PASS: geometry, scene bounds, unit conversion, cancellation, formula limit, success spends once, blocked movement refunds, exhausted uses, picker cleanup.');

const {isMisty}=await import('../scripts/raven-step.mjs');
let slots=2,casts=0,castMode='normal',free=false;
const spell={uuid:'Item.spell',id:'spell',type:'spell',actor,isOwner:true,name:'Misty Step',system:{identifier:'misty-step',activities:new Map()}};
const act={id:'activity',item:spell,
 async use(usage,dialog,message){
   casts++;
   assert.notEqual(hooks.get('dnd5e.preUseActivity')(act,usage,dialog,message),false,'native reentry allowed');
   if(castMode==='cancel' || (!free && slots===0)) return;
   if(castMode==='move') doc.x=100;
   if(hooks.get('dnd5e.preActivityConsumption')(act,usage)===false)return;
   if(!free)slots--;
   const deltas={actor:free?[]:[{keyPath:'slots',delta:-1}]};
   hooks.get('dnd5e.postActivityConsumption')(act,usage,{data:{system:{deltas}}});
   return {message:{system:{deltas}}};
 },
 async refund(deltas){slots-=deltas.actor.reduce((sum,d)=>sum+d.delta,0);}
};
spell.system.activities.set(act.id,act);
assert.equal(isMisty(spell),true);assert.equal(isMisty({...spell,name:'Other',system:{identifier:'other'}}),false);
choice='cancel';block=false;doc.x=0;await use(spell);assert.equal(casts,0);assert.equal(slots,2);
choice='accept';castMode='cancel';await use(spell);assert.equal(slots,2);assert.equal(doc.x,0);
castMode='normal';await use(spell);assert.equal(slots,1);assert.equal(doc.x,200);
doc.x=0;block=true;await assert.rejects(use(spell),/заблоковано/);assert.equal(slots,1);assert.equal(doc.x,0);
block=false;slots=0;await use(spell);assert.equal(doc.x,0);assert.equal(slots,0);
free=true;await use(spell);assert.equal(doc.x,200);assert.equal(slots,0);
free=false;slots=1;doc.x=0;castMode='move';await use(spell);assert.equal(slots,1);assert.equal(doc.x,100);
console.log('PASS: Misty Step identification, picker cancellation, slot dialog cancellation, single native cast, refund, exhausted slot, free cast, revalidation before consumption.');
