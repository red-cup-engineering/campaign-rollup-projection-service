const ranks=Object.freeze({enterprise:0,endeavor:1,campaign:2,project:3,plan:4,task:5});
const markers=new Set(["milestone","sprint","phase"]);
function kindOf(kind){if(kind==="enterprise")return"enterprise";if(["endeavor","expedition"].includes(kind))return"endeavor";if(kind==="campaign")return"campaign";if(kind==="project")return"project";if(["plan","objective"].includes(kind))return"plan";if(markers.has(kind))return null;return"task";}
function rank(item){const kind=kindOf(item.workKind);return kind===null?ranks.task:ranks[kind];}
const array=(value)=>Array.isArray(value)?value:[];
const text=(value)=>typeof value==="string"&&value.trim()!==""?value.trim():null;
const retired=(status)=>status==="abandoned"||status==="deferred";
const settledStatus=(status)=>status==="done"||retired(status);
// A cancelled or deferred prerequisite is not a successfully completed one.
// Conflicting top-level "complete" and explicit "open" remain unresolved.
const completed=(item)=>item?.workStatus==="done" ||
  item?.status==="complete"&&(item.workStatus===undefined||item.workStatus===null);
const settled=(item)=>item.status==="complete"||settledStatus(item.workStatus);
const workType=(item)=>text(item.success)===null?"project":item.blockedBy!==null&&item.blockedBy!==undefined||array(item.dependsOn).length>0?"process":"task";
const ref=(node)=>Object.freeze({id:node.id,title:node.title});

function statedLines(item){return [item.intent,item.success,...array(item.notes)].flatMap((source)=>typeof source!=="string"?[]:source.split(/\r?\n/u).map((line)=>line.trim()).filter(Boolean));}
function field(lines,name){const pattern=new RegExp(`^${name}\\s*:`,`iu`),line=lines.find((candidate)=>pattern.test(candidate));if(line===undefined)return null;return text(line.replace(pattern,""));}
function objective(item){const lines=statedLines(item),target=field(lines,"objective");if(target===null)return null;const statusText=field(lines,"status")?.toLowerCase();const status=statusText?.startsWith("achiev")?"achieved":statusText?.startsWith("miss")?"missed":statusText?.startsWith("on")?"on-track":settled(item)?"achieved":"open";return Object.freeze({target,...(field(lines,"metric")===null?{}:{metric:field(lines,"metric")}),...(field(lines,"deadline")===null?{}:{deadline:field(lines,"deadline")}),status});}
function realChildren(id,byId,children,seen){const out=[];for(const childId of children.get(id)??[]){if(seen.has(childId))continue;const child=byId.get(childId);if(child===undefined||retired(child.workStatus))continue;if(markers.has(child.workKind))out.push(...realChildren(childId,byId,children,new Set([...seen,childId])));else out.push(childId);}return out;}
function progress(item,children){if(children.length===0){if(item.gate!=="record"||retired(item.workStatus))return Object.freeze({done:0,total:0,ratio:0});const done=settled(item);return Object.freeze({done:done?1:0,total:1,ratio:done?1:0});}const done=children.reduce((sum,child)=>sum+child.progress.done,0),total=children.reduce((sum,child)=>sum+child.progress.total,0);return Object.freeze({done,total,ratio:total===0?0:done/total});}
function leaves(node){const out=[];const walk=(value)=>{if(value.children.length===0){if(value.gate==="record")out.push(value);return;}for(const child of value.children)walk(child);};walk(node);return out;}
function dependencyGaps(item,byId){
  const gaps=[];
  for(const id of array(item.dependsOn)){
    const parent=byId.get(id);
    if(id===item.id)gaps.push(Object.freeze({id,reason:"self-dependency"}));
    else if(parent===undefined)gaps.push(Object.freeze({id,reason:"source-unavailable"}));
    else if(retired(parent.workStatus))gaps.push(Object.freeze({id,reason:"withdrawn-not-completed"}));
    else if(!completed(parent))gaps.push(Object.freeze({id,reason:"not-completed"}));
  }
  return Object.freeze(gaps);
}
function front(campaign,byId){
  const all=leaves(campaign);
  if(all.length===0)return Object.freeze({
    advancing:[],stalled:[],blocked:[],done:[],dependencyHolds:[],nextTask:null,
  });
  const advancing=[],stalled=[],blocked=[],done=[],dependencyHolds=[];
  for(const leaf of all){
    const value=ref(leaf),source=byId.get(leaf.id);
    if(completed(source)){done.push(value);continue;}
    if(leaf.blocked){blocked.push(value);continue;}
    const gaps=dependencyGaps(source,byId);
    if(gaps.length){stalled.push(value);dependencyHolds.push(Object.freeze({task:value,needs:gaps}));}
    else advancing.push(value);
  }
  // Every advancing task has independently cleared its predecessors,
  // including cross-project dependencies. A full topological sort of all
  // campaign tasks is unnecessary to pick the next ready task: retain the
  // original in-progress-first rule, then the lexically first ready ID.
  const chosen=advancing.find(({id})=>byId.get(id)?.workStatus==="in-progress")??
    advancing.reduce((best,value)=>best===null||value.id<best.id?value:best,null);
  const node=chosen===null?null:all.find(({id})=>id===chosen.id);
  return Object.freeze({
    advancing:Object.freeze(advancing),stalled:Object.freeze(stalled),
    blocked:Object.freeze(blocked),done:Object.freeze(done),
    dependencyHolds:Object.freeze(dependencyHolds),
    nextTask:node===undefined||node===null?null:Object.freeze({
      id:node.id,title:node.title,...(node.workType===undefined?{}:{workType:node.workType}),
    }),
  });
}
function build(id,byId,children,seen){const item=byId.get(id),childNodes=realChildren(id,byId,children,seen).map((child)=>build(child,byId,children,new Set([...seen,child]))).sort((a,b)=>ranks[a.kind]-ranks[b.kind]||a.title.localeCompare(b.title));const kind=kindOf(item.workKind)??"task",node={id,title:item.title,kind,workKind:item.workKind,workStatus:item.workStatus,gate:item.gate,blocked:item.workStatus==="blocked"||text(item.blockedBy)!==null,progress:progress(item,childNodes),children:Object.freeze(childNodes)};if(childNodes.length===0)node.workType=workType(item);if(kind==="campaign"){node.objective=objective(item);node.horizon=field(statedLines(item),"horizon")??text(item.deadline);node.front=null;}const result=Object.freeze(node);if(kind!=="campaign")return result;return Object.freeze({...result,front:front(result,byId)});}
function findContainer(root,leafId,kinds){let path=[];const walk=(node,ancestors)=>{if(node.id===leafId){path=ancestors;return true;}for(const child of node.children)if(walk(child,[...ancestors,node]))return true;return false;};walk(root,[]);return [...path].reverse().find((node)=>kinds.includes(node.kind))??null;}
function current(campaigns,byId,session){
  const candidates=[];
  for(const campaign of campaigns){
    // The same source-qualified Work frontier powers the campaign board,
    // session focus and editor hook. None may independently invent readiness.
    const ready=new Set(campaign.front?.advancing?.map(value=>value.id)??[]);
    const open=leaves(campaign).filter(node=>ready.has(node.id));
    const leaf=(session===null?undefined:open.find(({id})=>byId.get(id)?.session===session))??
      open.find(node=>node.workStatus==="in-progress")??
      open.find(node=>node.id===campaign.front?.nextTask?.id)??open[0];
    if(leaf)candidates.push({campaign,leaf});
  }
  candidates.sort((a,b)=>a.campaign.progress.ratio-b.campaign.progress.ratio);
  const chosen=candidates[0];if(!chosen)return null;
  const plan=findContainer(chosen.campaign,chosen.leaf.id,["plan","project"]);
  return Object.freeze({
    campaign:ref(chosen.campaign),
    plan:plan===null?null:ref(plan),
    task:Object.freeze({
      id:chosen.leaf.id,title:chosen.leaf.title,workStatus:chosen.leaf.workStatus,
      ...(chosen.leaf.workType===undefined?{}:{workType:chosen.leaf.workType}),
    }),
  });
}
function count(nodes,kind){let value=0;const walk=(node)=>{if(node.kind===kind)value++;for(const child of node.children)walk(child);};for(const node of nodes)walk(node);return value;}
function pointer(campaign){const value=campaign.front,pct=Math.round(campaign.progress.ratio*100),target=campaign.objective?.target;return `${campaign.title}${target?` · ${target.length>60?`${target.slice(0,59)}…`:target}`:""}${value?` · front: ${value.advancing.length} advancing / ${value.stalled.length} stalled / ${value.blocked.length} blocked (${campaign.progress.done}/${campaign.progress.total}, ${pct}%)`:` · ${campaign.progress.done}/${campaign.progress.total} (${pct}%)`}`;}

/** Fold an explicit work snapshot into its campaign forest and actionable front. */
export function projectCampaignRollup(snapshot,params={}){if(!Array.isArray(snapshot?.items))throw new TypeError("snapshot.items must be an array");const byId=new Map();
for(const item of snapshot.items){
  if(!item||typeof item.id!=="string"||!item.id.trim()||byId.has(item.id))
    throw new TypeError("campaign rollup requires distinct canonical Work IDs");
  if(item.dependsOn!==undefined&&item.dependsOn!==null&&
    (!Array.isArray(item.dependsOn)||
      item.dependsOn.some(value=>typeof value!=="string"||!value.trim())||
      new Set(item.dependsOn).size!==item.dependsOn.length))
    throw new TypeError("campaign rollup requires whole distinct dependency Work IDs");
  byId.set(item.id,item);
}
const children=new Map();for(const item of snapshot.items){const parent=array(item.contributesTo).map((id)=>byId.get(id)).find((candidate)=>candidate!==undefined&&rank(candidate)<rank(item));if(parent){const values=children.get(parent.id)??[];values.push(item.id);children.set(parent.id,values);}}const focus=text(params.campaign??params.q),roots=snapshot.items.filter((item)=>item.workKind==="campaign"&&!settled(item)&&(focus===null||item.id.toLowerCase().includes(focus.toLowerCase())||item.title.toLowerCase().includes(focus.toLowerCase()))),campaigns=Object.freeze(roots.map((root)=>build(root.id,byId,children,new Set([root.id]))));const allLeaves=campaigns.flatMap(leaves).filter((node)=>!retired(node.workStatus));return Object.freeze({kind:"campaign-rollup.projection",generatedAt:snapshot.generatedAt,source:snapshot.state??null,campaigns,current:current(campaigns,byId,text(params.session??params.session_id)),pointers:Object.freeze(campaigns.map(pointer)),counts:Object.freeze({campaigns:campaigns.length,projects:count(campaigns,"project"),plans:count(campaigns,"plan"),tasks:allLeaves.length,openTasks:allLeaves.filter((node)=>!settledStatus(node.workStatus)).length})});}
