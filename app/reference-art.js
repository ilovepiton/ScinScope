import {icon as fallbackIcon} from './icons.js?v=ref-20261111';

const nav=['home','photo','progress','leaderboard','profile'];
const glyphs={edit:'edit',friends:'friends',settings:'settings',gallery:'photos',stats:'stats',location:'pin',person:'profile-active',capture:'camera-outline'};
const referenceDirectory=new URL('./reference/',import.meta.url);
export function icon(name,cls=''){
 if(nav.includes(name))return `<span class="ui-icon reference-icon ref-${name} ${cls}" aria-hidden="true"></span>`;
 if(glyphs[name])return `<span class="ui-icon reference-icon" style="--glyph:url('${new URL(`icon-${glyphs[name]}.png`,referenceDirectory).href}')" aria-hidden="true"></span>`;
 return fallbackIcon(name,cls);
}

const aliases={normal:'skin',oily:'feel',dry:'feel',combination:'tone'};
const courses=['skin','concern','breakouts','feel','pores','tone','sun','product','sensitive','goal'];
const mobileCourses=courses.slice(0,6);
export function art(type,cls=''){
 type=aliases[type]||type;
 if(type==='profile')return `<span class="illustration avatar-symbol ${cls}" aria-hidden="true">${fallbackIcon('profile')}</span>`;
 const allowed=[...courses,'crown','flame','phone','camera','gallery','trophy','target'];
 if(!allowed.includes(type))return fallbackIcon('info',cls);
 const picture=mobileCourses.includes(type)?`<source media="(max-width:720px)" srcset="./app/reference/small-${type}.png">`:'';
 return `<picture class="illustration reference-art ${cls}" aria-hidden="true">${picture}<img src="./app/reference/${type}.png" alt="" draggable="false"></picture>`;
}

export function courseFigure(type,{unlocked=false}={}){
 if(unlocked&&['sensitive','goal'].includes(type))return `<span class="unlocked-figure">${art(type)}<span class="unlocked-crown">${art('crown')}<b>1</b></span></span>`;
 return `<picture class="reference-course" aria-hidden="true">${mobileCourses.includes(type)?`<source media="(max-width:720px)" srcset="./app/reference/mobile-${type}.png">`:''}<img src="./app/reference/course-${type}.png" alt="" draggable="false"></picture>`;
}
