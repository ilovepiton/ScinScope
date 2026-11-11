const core=['skin','concern','breakouts','feel','pores','tone','sun','product'];
export const coreCompleted=tests=>core.filter(id=>tests[id]?.completedAt).length;
export const isCourseLocked=(id,tests)=>['sensitive','goal'].includes(id)&&!tests[id]?.completedAt&&coreCompleted(tests)<8;
export const dailyGoalCount=(activity,now=new Date())=>Number(activity.some(item=>item.type==='test'&&new Date(item.date).toDateString()===now.toDateString()));
