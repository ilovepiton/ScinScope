import {randomBytes} from 'node:crypto';

const testIds=['skin','concern','breakouts','feel','pores','tone','sun','product','sensitive','goal'];
const now=()=>new Date().toISOString();
const parse=(text,fallback)=>{try{return JSON.parse(text);}catch{return fallback;}};
const error=(status,message)=>Object.assign(new Error(message),{status});
const safePrivacy=value=>({publicRank:value?.publicRank===true,shareStats:value?.shareStats===true,shareActivity:value?.shareActivity===true});
const summary=activity=>{
 const dates=new Set(activity.map(a=>a.date.slice(0,10)));let date=new Date(),count=0;
 if(!dates.has(date.toISOString().slice(0,10)))date.setUTCDate(date.getUTCDate()-1);
 while(dates.has(date.toISOString().slice(0,10))){count++;date.setUTCDate(date.getUTCDate()-1);}
 return {streak:count,tests:new Set(activity.map(a=>a.testId)).size};
};

export function createJourneyRouter({db,getAuthUser,jsonResponse,readJson}){
 db.exec(`
  CREATE TABLE IF NOT EXISTS journey_journals(user_id TEXT PRIMARY KEY REFERENCES users(id),profile TEXT NOT NULL,tests TEXT NOT NULL,activity TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS journey_friends(sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(sender,recipient));
  CREATE TABLE IF NOT EXISTS journey_groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS journey_members(group_id TEXT NOT NULL REFERENCES journey_groups(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(group_id,user_id));
 `);
 const journal=id=>{const row=db.prepare('SELECT * FROM journey_journals WHERE user_id=?').get(id);return row?{profile:parse(row.profile,{}),tests:parse(row.tests,{}),activity:parse(row.activity,[])}:null;};
 const person=id=>{const row=db.prepare('SELECT id,name,avatar_data_url FROM users WHERE id=? AND verified=1').get(id);if(!row)return null;return {id:row.id,name:row.name,avatar:row.avatar_data_url||'',bio:journal(id)?.profile.bio||''};};
 const friends=(a,b)=>!!db.prepare("SELECT 1 FROM journey_friends WHERE status='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))").get(a,b,b,a);
 const peopleFor=id=>db.prepare("SELECT CASE WHEN sender=? THEN recipient ELSE sender END AS id FROM journey_friends WHERE status='accepted' AND (sender=? OR recipient=?)").all(id,id,id).map(r=>person(r.id)).filter(Boolean);
 const leaderboard=period=>{
  const start=new Date();if(period==='week')start.setUTCDate(start.getUTCDate()-6);else if(period==='month')start.setUTCDate(1);else start.setUTCFullYear(1970);start.setUTCHours(0,0,0,0);
  return db.prepare('SELECT user_id FROM journey_journals').all().flatMap(({user_id})=>{const j=journal(user_id);if(!j?.profile.privacy?.publicRank)return [];const p=person(user_id);if(!p)return [];const score=new Set(j.activity.filter(a=>a.type==='test'&&new Date(a.date)>=start).map(a=>a.testId)).size*10;return [{id:p.id,name:p.name,avatar:p.avatar,score}];}).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,100);
 };
 return async function handleJourney(req,res,url){
  const send=(status,data)=>jsonResponse(req,res,status,data),user=getAuthUser(req);
  if(!user?.verified)return send(401,{ok:false,message:'Please sign in to a verified account.'});
  const path=url.pathname.slice('/api/journey'.length),method=req.method;
  try{
   if(path==='/journal'&&method==='GET')return send(200,{ok:true,journal:journal(user.id)});
   if(path==='/journal'&&method==='PUT'){
    const body=await readJson(req),previous=journal(user.id),profile=body.profile||{},name=String(profile.name||user.name).trim().slice(0,24);
    if(name.length<2)throw error(400,'Use at least 2 characters for your name.');
    const tests={},activity=previous?.activity||[],existingTests=previous?.tests||{};
    // Completion times are assigned by the server, not trusted from browser data.
    for(const id of testIds){const incoming=body.tests?.[id];if(incoming&&Array.isArray(incoming.answers)&&incoming.answers.length===3&&incoming.answers.every(n=>Number.isInteger(n)&&n>=0&&n<=3)){
     const unchanged=existingTests[id]&&JSON.stringify(existingTests[id].answers)===JSON.stringify(incoming.answers);
     const completedAt=unchanged?existingTests[id].completedAt:now();tests[id]={answers:incoming.answers,completedAt};
     if(!existingTests[id])activity.push({type:'test',testId:id,date:completedAt});
    }else if(existingTests[id])tests[id]=existingTests[id];}
    const cleanProfile={name,bio:String(profile.bio||'').trim().slice(0,160),privacy:safePrivacy(profile.privacy)};
    db.prepare('UPDATE users SET name=? WHERE id=?').run(name,user.id);
    db.prepare('INSERT INTO journey_journals(user_id,profile,tests,activity) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile,tests=excluded.tests,activity=excluded.activity').run(user.id,JSON.stringify(cleanProfile),JSON.stringify(tests),JSON.stringify(activity.slice(-1000)));
    return send(200,{ok:true});
   }
   if(path==='/social'&&method==='GET'){
    const requests=db.prepare("SELECT sender FROM journey_friends WHERE recipient=? AND status='pending'").all(user.id).map(r=>person(r.sender)).filter(Boolean);
    const groups=db.prepare('SELECT g.id,g.name,(SELECT count(*) FROM journey_members WHERE group_id=g.id) AS members FROM journey_groups g JOIN journey_members m ON m.group_id=g.id WHERE m.user_id=?').all(user.id);
    const all=leaderboard('all'),index=all.findIndex(p=>p.id===user.id);
    return send(200,{ok:true,friends:peopleFor(user.id),requests,groups,rank:index<0?null:index+1});
   }
   if(path==='/leaderboard'&&method==='GET')return send(200,{ok:true,people:leaderboard(url.searchParams.get('period'))});
   if(path==='/search'&&method==='GET'){
    const q=String(url.searchParams.get('q')||'').trim().slice(0,40);if(q.length<2)return send(200,{ok:true,people:[]});
    const rows=db.prepare("SELECT id FROM users WHERE verified=1 AND id<>? AND instr(lower(name),lower(?))>0 ORDER BY name LIMIT 20").all(user.id,q);
    return send(200,{ok:true,people:rows.map(r=>{const p=person(r.id);return {id:p.id,name:p.name,avatar:p.avatar};})});
   }
   if(path.startsWith('/people/')&&method==='GET'){
    const id=decodeURIComponent(path.slice(8)),p=person(id);if(!p)throw error(404,'This profile could not be found.');
    const isFriend=friends(user.id,id),isSelf=user.id===id,j=journal(id),privacy=j?.profile.privacy||{};
    const pending=!!db.prepare("SELECT 1 FROM journey_friends WHERE sender=? AND recipient=? AND status='pending'").get(user.id,id);
    const result={ok:true,person:p,isFriend,pending};
    if(isSelf||(isFriend&&privacy.shareStats)){const all=leaderboard('all'),position=all.findIndex(r=>r.id===id);result.stats={...summary(j?.activity||[]),rank:position<0?null:position+1};}
    if(isSelf||(isFriend&&privacy.shareActivity))result.activity=(j?.activity||[]).slice(-20).reverse().map(({type,testId,date})=>({type,testId,date}));
    return send(200,result);
   }
   if(path==='/friends'&&method==='POST'){
    const {personId:id}=await readJson(req);if(id===user.id||!person(id))throw error(400,'Choose another verified account.');
    if(friends(user.id,id))return send(200,{ok:true});
    const incoming=db.prepare('SELECT 1 FROM journey_friends WHERE sender=? AND recipient=?').get(id,user.id);
    if(incoming)throw error(409,'This person has already invited you. Accept their request instead.');
    db.prepare("INSERT OR IGNORE INTO journey_friends(sender,recipient,status) VALUES(?,?,'pending')").run(user.id,id);return send(200,{ok:true});
   }
   if(path==='/friends/respond'&&method==='POST'){
    const {personId:id,accept}=await readJson(req);
    if(accept===true)db.prepare("UPDATE journey_friends SET status='accepted' WHERE sender=? AND recipient=? AND status='pending'").run(id,user.id);
    else db.prepare("DELETE FROM journey_friends WHERE sender=? AND recipient=? AND status='pending'").run(id,user.id);
    return send(200,{ok:true});
   }
   if(path==='/friends'&&method==='DELETE'){
    const {personId:id}=await readJson(req);db.prepare('DELETE FROM journey_friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').run(user.id,id,id,user.id);return send(200,{ok:true});
   }
   if(path==='/groups'&&method==='POST'){
    const body=await readJson(req),name=String(body.name||'').trim().slice(0,40);if(name.length<2)throw error(400,'Use at least 2 characters for your group name.');
    if(db.prepare('SELECT count(*) AS n FROM journey_members WHERE user_id=?').get(user.id).n>=20)throw error(400,'You can join up to 20 groups.');
    const id=randomBytes(12).toString('hex'),code=randomBytes(5).toString('hex').toUpperCase();
    db.prepare('INSERT INTO journey_groups(id,name,code,created_by) VALUES(?,?,?,?)').run(id,name,code,user.id);db.prepare('INSERT INTO journey_members(group_id,user_id) VALUES(?,?)').run(id,user.id);return send(200,{ok:true,id,code});
   }
   if(path==='/groups/join'&&method==='POST'){
    const body=await readJson(req),g=db.prepare('SELECT * FROM journey_groups WHERE code=?').get(String(body.code||'').trim().toUpperCase());if(!g)throw error(404,'This group code could not be found.');
    if(db.prepare('SELECT count(*) AS n FROM journey_members WHERE user_id=?').get(user.id).n>=20)throw error(400,'You can join up to 20 groups.');
    db.prepare('INSERT OR IGNORE INTO journey_members(group_id,user_id) VALUES(?,?)').run(g.id,user.id);return send(200,{ok:true});
   }
   if(path==='/groups/leave'&&method==='POST'){
    const {groupId:id}=await readJson(req);db.prepare('DELETE FROM journey_members WHERE group_id=? AND user_id=?').run(id,user.id);if(!db.prepare('SELECT 1 FROM journey_members WHERE group_id=?').get(id))db.prepare('DELETE FROM journey_groups WHERE id=?').run(id);return send(200,{ok:true});
   }
   if(path.startsWith('/groups/')&&method==='GET'){
    const id=path.slice(8);if(!db.prepare('SELECT 1 FROM journey_members WHERE group_id=? AND user_id=?').get(id,user.id))throw error(403,'Only group members can view this group.');
    const group=db.prepare('SELECT id,name,code FROM journey_groups WHERE id=?').get(id),people=db.prepare('SELECT user_id FROM journey_members WHERE group_id=?').all(id).map(r=>person(r.user_id)).filter(Boolean);
    return send(200,{ok:true,group,people});
   }
   return send(404,{ok:false,message:'This SkinScope feature could not be found.'});
  }catch(cause){return send(cause.status||500,{ok:false,message:cause.status?cause.message:'SkinScope could not save this change. Please try again.'});}
 };
}
