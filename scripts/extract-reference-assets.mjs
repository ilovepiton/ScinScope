import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_PATH||'sharp');
const [mobile,desktop]=process.argv.slice(2);
if(!mobile||!desktop)throw new Error('Pass the mobile reference PNG and desktop reference PNG.');
const output=resolve('app/reference');
await mkdir(output,{recursive:true});
const manifest=[];

async function crop(name,source,box,{round=false,mask=false,background=false}={}){
 const [left,top,width,height]=box;
 let pipeline=sharp(source).extract({left,top,width,height}).ensureAlpha();
 if(round){
  const circle=Buffer.from(`<svg width="${width}" height="${height}"><ellipse cx="${width/2}" cy="${height/2}" rx="${width/2}" ry="${height/2}" fill="white"/></svg>`);
  pipeline=pipeline.composite([{input:circle,blend:'dest-in'}]);
 }
 let {data,info}=await pipeline.raw().toBuffer({resolveWithObject:true});
 if(mask){
  const samples=[0,(width-1)*4,(height-1)*width*4,(height*width-1)*4];
  const bg=[0,1,2].map(c=>samples.map(i=>data[i+c]).sort((a,b)=>a-b)[2]);
  for(let i=0;i<data.length;i+=4){
   const difference=Math.max(...bg.map((b,c)=>Math.abs(data[i+c]-b)));
   data[i+3]=Math.round(Math.max(0,Math.min(1,(difference-5)/90))*255);
   data[i]=data[i+1]=data[i+2]=255;
  }
 }else if(background){
  // Remove only the connected outside background; enclosed white detail stays.
  const bg=[data[0],data[1],data[2]],seen=new Uint8Array(width*height),queue=[];
  const visit=p=>{if(seen[p])return;seen[p]=1;const i=p*4;if(bg.every((b,c)=>Math.abs(data[i+c]-b)<7)){data[i+3]=0;queue.push(p);}};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  for(let n=0;n<queue.length;n++){const p=queue[n],x=p%width,y=Math.floor(p/width);if(x)visit(p-1);if(x<width-1)visit(p+1);if(y)visit(p-width);if(y<height-1)visit(p+width);}
 }
 await sharp(data,{raw:info}).png().toFile(resolve(output,name+'.png'));
 manifest.push({name,source:source===mobile?'mobile reference':'desktop reference',box,round,mask,background});
}

const mobileCourses={skin:[66,132,80,77],concern:[197,132,80,77],breakouts:[66,236,80,77],feel:[197,236,80,77],pores:[66,340,80,77],tone:[197,340,80,77]};
const desktopCourses={skin:[689,178,119,119],concern:[840,178,119,119],breakouts:[990,178,119,119],feel:[1141,178,119,119],pores:[689,407,119,119],tone:[840,407,119,119],sun:[990,407,119,119],product:[1141,407,119,119],sensitive:[689,636,119,119],goal:[840,636,119,119]};
const inner={skin:[706,194,82,82],concern:[856,194,82,82],breakouts:[1008,194,82,82],feel:[1158,194,82,82],pores:[706,424,82,82],tone:[856,424,82,82],sun:[1008,424,82,82],product:[1158,424,82,82],sensitive:[706,655,82,82],goal:[856,655,82,82]};
for(const[name,box]of Object.entries(mobileCourses))await crop('mobile-'+name,mobile,box);
for(const[name,box]of Object.entries(desktopCourses))await crop('course-'+name,desktop,box);
for(const[name,box]of Object.entries(inner))await crop(name,desktop,[box[0]+9,box[1]+9,64,64],{round:true});
for(const[name,box]of Object.entries({skin:[82,149,48,48],concern:[212,149,48,48],breakouts:[82,253,48,48],feel:[212,253,48,48],pores:[82,356,48,48],tone:[212,356,48,48]}))await crop('small-'+name,mobile,box,{round:true});
for(const[name,box]of Object.entries({flame:[1214,74,33,39],crown:[1310,74,40,39],phone:[1412,73,29,40],trophy:[1283,473,46,43],target:[1281,325,52,51]}))await crop(name,desktop,box,{background:true});
await crop('podium',desktop,[1276,518,225,155]);
await crop('camera',mobile,[393,347,44,44],{background:true});
await crop('gallery',mobile,[520,348,44,43],{background:true});
await crop('photo-skin',mobile,[660,165,114,104]);
await crop('photo-product',mobile,[788,165,111,104]);
const glyphs={home:[368,469,25,25],'home-active':[54,469,25,25],photo:[123,469,25,25],'photo-active':[433,469,25,25],'camera-outline':[455,173,45,40],progress:[192,469,25,25],'progress-active':[1092,474,25,25],profile:[263,469,25,25],'profile-active':[263,965,25,25],edit:[193,697,24,24],stats:[54,831,24,24],photos:[54,864,24,24],friends:[54,897,24,24],settings:[54,930,24,24],pin:[365,759,25,29]};
for(const[name,box]of Object.entries(glyphs))await crop('icon-'+name,mobile,box,{mask:true});
for(const[name,box]of Object.entries({home:[497,146,32,32],photo:[497,201,32,32],progress:[497,256,32,32],leaderboard:[497,311,32,33],profile:[497,365,32,33]}))await crop('desktop-icon-'+name,desktop,box,{mask:true});
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Extracted ${manifest.length} literal reference assets. No generated UI art.`);
if(process.argv[4]){
 const layers=[];
 for(let i=0;i<manifest.length;i++){
  const name=manifest[i].name,left=i%8*110,top=Math.floor(i/8)*125;
  layers.push({input:await sharp(resolve(output,name+'.png')).resize(96,96,{fit:'contain',background:'#0000'}).toBuffer(),left:left+7,top});
  layers.push({input:Buffer.from(`<svg width="110" height="23"><text x="4" y="15" font-size="10" fill="#14213d">${name}</text></svg>`),left,top:top+97});
 }
 await sharp({create:{width:880,height:Math.ceil(manifest.length/8)*125,channels:4,background:'#f7fbff'}}).composite(layers).png().toFile(process.argv[4]);
}
