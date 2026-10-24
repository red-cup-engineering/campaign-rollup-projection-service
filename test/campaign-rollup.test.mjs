import assert from"node:assert/strict";import test from"node:test";import{projectCampaignRollup}from"../src/campaign-rollup.mjs";import{projectCampaignPretoolContext}from"../src/campaign-pretool.mjs";
const item=(id,title,workKind,contributesTo=[],extra={})=>({id,title,workKind,contributesTo,dependsOn:[],notes:[],intent:"",success:"done",status:"active",workStatus:"open",gate:"record",blockedBy:null,...extra});
test("folds a campaign ladder and exposes the dependency front",()=>{const snapshot={generatedAt:"2026-08-30T00:00:00.000Z",state:"work.json",items:[item("c","Refactor relating","campaign"),item("p","Relating plan","plan",["c"]),item("a","lib relating alpha","task",["p"]),item("b","lib relating beta","task",["p"],{dependsOn:["a"]})]};const reading=projectCampaignRollup(snapshot);assert.equal(reading.counts.tasks,2);assert.deepEqual(reading.campaigns[0].front.advancing.map(({id})=>id),["a"]);const hook=projectCampaignPretoolContext(reading,{tool_name:"Edit",tool_input:{file_path:"lib/relating/src/x.mjs"}});assert.match(hook.hookSpecificOutput.additionalContext,/Relating plan/);});

test("a shared prerequisite in a different campaign prevents false-ready execution",()=>{
 const snapshot={generatedAt:"2026-10-24T05:00:00Z",state:"original Work fixture",items:[
  item("alpha","Alpha campaign","campaign"),
  item("alpha-plan","Alpha plan","plan",["alpha"]),
  item("a","lib relating cross-project task","task",["alpha-plan"],{dependsOn:["b"],session:"focused"}),
  item("c","Independent available task","task",["alpha-plan"]),
  item("beta","Beta campaign","campaign"),
  item("beta-plan","Beta plan","plan",["beta"]),
  item("b","External unfinished prerequisite","task",["beta-plan"]),
 ]};
 const original=JSON.stringify(snapshot);
 const view=projectCampaignRollup(snapshot);
 const alpha=view.campaigns.find(x=>x.id==="alpha");
 assert.deepEqual(alpha.front.stalled.map(x=>x.id),["a"]);
 assert.deepEqual(alpha.front.advancing.map(x=>x.id),["c"]);
 assert.deepEqual(alpha.front.dependencyHolds,[{
   task:{id:"a",title:"lib relating cross-project task"},
   needs:[{id:"b",reason:"not-completed"}],
 }]);
 assert.equal(alpha.front.nextTask.id,"c");
 assert.equal(view.current.task.id,"c","focus must not select the blocked session task");
 assert.equal(view.counts.tasks,3,"shared source subjects are not duplicated");
 assert.equal(JSON.stringify(snapshot),original,"projection cannot mutate original Work");
 const focused=projectCampaignRollup(snapshot,{session:"focused"});
 assert.equal(focused.current.task.id,"c","personal session cannot bypass Work precedence");
 const tool=projectCampaignPretoolContext(view,{tool_name:"Edit",
   tool_input:{file_path:"lib/relating/src/task.mjs"}});
 assert.equal(tool,null,"editor must not manufacture ready work from relevant blocked prose");
 const completed={...snapshot,items:snapshot.items.map(x=>x.id==="b"?{...x,workStatus:"done"}:x)};
 const received=projectCampaignRollup(completed);
 assert.deepEqual(received.campaigns[0].front.advancing.map(x=>x.id).sort(),["a","c"]);
 assert.equal(received.campaigns[0].front.nextTask.id,"a");
 assert.equal(received.current.task.id,"a");
 assert.match(projectCampaignPretoolContext(received,{tool_name:"Edit",
   tool_input:{file_path:"lib/relating/src/task.mjs"}}).hookSpecificOutput.additionalContext,
   /cross-project task/u);
 const withdrawn={...snapshot,items:snapshot.items.map(x=>x.id==="b"?{...x,workStatus:"abandoned"}:x)};
 const held=projectCampaignRollup(withdrawn);
 assert.deepEqual(held.campaigns[0].front.dependencyHolds[0].needs,[{id:"b",reason:"withdrawn-not-completed"}]);
 assert.equal(held.current.task.id,"c","withdrawn source cannot discharge external work");
});

test("unobserved or cyclic dependencies remain held instead of becoming ready",()=>{
 const snapshot={generatedAt:"2026-10-24T05:00:00Z",items:[
   item("c","Campaign","campaign"),item("p","Plan","plan",["c"]),
   item("a","lib relating edit","task",["p"],{dependsOn:["foreign"]}),
 ]};
 const missing=projectCampaignRollup(snapshot);
 assert.deepEqual(missing.campaigns[0].front.dependencyHolds[0].needs,[{id:"foreign",reason:"source-unavailable"}]);
 assert.equal(missing.campaigns[0].front.nextTask,null);
 assert.equal(missing.current,null);
 assert.equal(projectCampaignPretoolContext(missing,{tool_name:"Edit",
  tool_input:{file_path:"lib/relating/src/x.mjs"}}),null);
 const self={...snapshot,items:snapshot.items.map(x=>x.id==="a"?{...x,dependsOn:["a"]}:x)};
 assert.deepEqual(projectCampaignRollup(self).campaigns[0].front.dependencyHolds[0].needs,
  [{id:"a",reason:"self-dependency"}]);
 const mutual={...snapshot,items:[...snapshot.items.map(x=>x.id==="a"?{...x,dependsOn:["b"]}:x),
  item("b","lib relating other","task",["p"],{dependsOn:["a"]})]};
 const view=projectCampaignRollup(mutual);
 assert.equal(view.campaigns[0].front.advancing.length,0);
 assert.deepEqual(view.campaigns[0].front.stalled.map(x=>x.id).sort(),["a","b"]);
 assert.equal(view.current,null,"a cycle cannot be turned into an arbitrary runnable task");
});

test("duplicate Work identities or malformed dependency statements refuse before projection",()=>{
 const base=[item("c","Campaign","campaign"),item("p","Plan","plan",["c"]),
  item("a","First","task",["p"])];
 const read=items=>projectCampaignRollup({generatedAt:"2026-10-24T05:00:00Z",items});
 assert.throws(()=>read([...base,{...base[2],title:"Conflicting source"}]),/distinct canonical Work IDs/u);
 assert.throws(()=>read([...base,{...base[2],id:""}]),/distinct canonical Work IDs/u);
 assert.throws(()=>read(base.map(x=>x.id==="a"?{...x,dependsOn:"p"}:x)),
  /whole distinct dependency Work IDs/u);
 assert.throws(()=>read(base.map(x=>x.id==="a"?{...x,dependsOn:["p","p"]}:x)),
  /whole distinct dependency Work IDs/u);
 assert.throws(()=>read(base.map(x=>x.id==="a"?{...x,dependsOn:[3]}:x)),
  /whole distinct dependency Work IDs/u);
});

test("bounded multi-project source work preserves cross-project holds without quadratic duplicate work",()=>{
 const items=[item("campaign","Source campaign","campaign"),
   item("plan","Program plan","plan",["campaign"]),
   item("outside","Separate source","task",[],{workStatus:"open"})];
 for(let i=0;i<512;i++)items.push(item("task-"+i,"Work "+i,"task",["plan"],
   {dependsOn:i%2===0?["outside"]:[]}));
 const view=projectCampaignRollup({generatedAt:"2026-10-24T05:00:00Z",items});
 assert.equal(view.counts.tasks,512);
 assert.equal(view.campaigns[0].front.stalled.length,256);
 assert.equal(view.campaigns[0].front.advancing.length,256);
 assert.equal(view.campaigns[0].front.dependencyHolds.length,256);
 assert.ok(view.campaigns[0].front.dependencyHolds.every(x=>x.needs[0].id==="outside"));
 assert.equal(view.current.task.id,"task-1");
});
