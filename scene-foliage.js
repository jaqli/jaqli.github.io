import { inside } from './scene-objects.js?v=20261111-sky43';
import { exteriorField, reflectedSample } from './pixel-surface.js?v=20261111-surface37';
import { prepareWarp } from './scene-deform.js?v=20261111-layer44';
// Leaf tips bend independently; roots, vines and pots remain attached.
export const leafShapes=[
      {anchor:[1448,241],phase:.3,polygon:[[1417,228],[1430,230],[1437,222],[1441,230],[1449,235],[1448,241],[1434,241],[1423,237]]},
      {anchor:[1457,240],phase:2.1,polygon:[[1434,215],[1443,217],[1447,223],[1455,220],[1462,228],[1458,237],[1457,241],[1450,238],[1444,230],[1438,227]]},
      {anchor:[1468,242],phase:4.4,polygon:[[1462,232],[1474,231],[1481,224],[1487,221],[1486,230],[1491,231],[1497,235],[1497,240],[1481,240],[1475,244],[1467,244]]},
      {anchor:[1304,105],phase:1.1,polygon:[[1248,92],[1255,87],[1273,87],[1287,93],[1306,101],[1304,108],[1281,108],[1276,101],[1250,102]]},
      {anchor:[1319,113],phase:3.1,polygon:[[1274,72],[1292,77],[1291,68],[1303,67],[1312,75],[1319,102],[1320,114],[1310,113],[1298,100],[1285,98],[1280,87]]},
      {anchor:[1324,119],phase:5,polygon:[[1322,97],[1326,84],[1335,77],[1343,67],[1358,69],[1355,83],[1352,96],[1340,107],[1329,120]]},
      {anchor:[1317,121],phase:1.9,polygon:[[1254,112],[1261,109],[1266,105],[1282,105],[1282,109],[1294,115],[1306,117],[1318,116],[1318,123],[1299,123],[1293,127],[1281,119],[1263,119],[1261,116],[1254,115]]},
      {anchor:[1341,119],phase:3.9,polygon:[[1341,112],[1355,94],[1367,81],[1384,81],[1384,88],[1394,96],[1394,106],[1369,109],[1362,114],[1343,122]]},
      {anchor:[1348,123],phase:5.8,polygon:[[1349,117],[1372,109],[1388,112],[1386,122],[1379,128],[1379,137],[1370,141],[1366,130],[1356,129],[1348,125]]},
      {anchor:[1300,126],phase:.8,polygon:[[1297,120],[1301,127],[1285,134],[1280,140],[1275,145],[1273,146],[1270,143],[1267,145],[1262,144],[1259,140],[1260,133],[1265,131],[1273,130],[1278,126],[1285,123]]},

      {anchor:[1386,460],phase:1.7,warm:true,polygon:[[1361,455],[1372,454],[1379,451],[1387,454],[1390,460],[1383,462],[1373,462],[1361,460]]},
      {anchor:[1402,472],phase:3.3,warm:true,polygon:[[1384,452],[1397,451],[1402,458],[1401,466],[1393,472],[1384,469]]},
      {anchor:[1416,462],phase:4.7,warm:true,polygon:[[1407,451],[1407,445],[1411,437],[1418,434],[1423,430],[1424,440],[1420,450],[1418,462]]},
      {anchor:[1420,460],phase:.6,warm:true,polygon:[[1421,445],[1437,443],[1438,449],[1432,453],[1427,452],[1423,460]]},
      {anchor:[1404,481],phase:2.5,warm:true,polygon:[[1400,477],[1390,479],[1383,483],[1379,491],[1376,494],[1385,497],[1390,491],[1394,485],[1405,483]]},
      {anchor:[1405,484],phase:5.5,warm:true,polygon:[[1405,484],[1410,488],[1412,498],[1411,510],[1403,508],[1399,503],[1400,491]]},
      {anchor:[1393,516],phase:4.1,warm:true,polygon:[[1388,516],[1381,516],[1375,521],[1367,524],[1368,529],[1379,526],[1390,522],[1394,518]]},
      {anchor:[1400,516],phase:1.2,warm:true,polygon:[[1401,518],[1408,516],[1407,524],[1401,530],[1393,532],[1392,527]]},
      {anchor:[1389,536],phase:3.9,warm:true,polygon:[[1387,536],[1383,542],[1384,552],[1387,560],[1394,567],[1398,556],[1398,546],[1391,544]]},
];

const distance=(x,y,p)=>{
 if(inside(x,y,p))return 0;
 let best=Infinity;
 for(let n=0;n<p.length;n++){const[a,b]=p[n],[c,d]=p[(n+1)%p.length],dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(x-a-t*dx,y-b-t*dy));}
 return best;
};
// Extract each visible pixel once. All leaves share one removal mask per plant,
// so another leaf can never become a repair donor or leave a second silhouette.
export function prepareFoliage(scene){
 const source=scene.original.data,plate=scene.plate.data,leaves=[],mattes=[];
 for(const region of[
  {x:1405,y:205,w:104,h:49,ids:[0,1,2]},
  {x:1235,y:60,w:172,h:104,ids:[3,4,5,6,7,8,9]},
  {x:1351,y:422,w:96,h:155,ids:[10,11,12,13,14,15,16,17,18],warm:true},
 ]){
  const{x,y,w,h,ids}=region,owner=new Int16Array(w*h).fill(-1),nearby=new Int16Array(w*h).fill(-1),strong=new Uint8Array(w*h),foreground=new Uint8Array(w*h);
  const candidates=ids.map(id=>{const leaf=leafShapes[id],xs=leaf.polygon.map(p=>p[0]),ys=leaf.polygon.map(p=>p[1]);return{id,leaf,left:Math.min(...xs)-4,right:Math.max(...xs)+4,top:Math.min(...ys)-4,bottom:Math.max(...ys)+4};});
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
   const n=py*w+px,i=((y+py)*1536+x+px)*4,r=source[i],g=source[i+1],b=source[i+2];
   strong[n]=g>r*(region.warm?.72:.98)&&g>b*1.08&&(region.warm||g-r>5)?1:0;
   let best=Infinity;
   for(const {id,leaf,left,right,top,bottom} of candidates){if(x+px<left||x+px>right||y+py<top||y+py>bottom)continue;const d=distance(x+px,y+py,leaf.polygon);if(d>3.5)continue;const score=d*100+Math.hypot(x+px-leaf.anchor[0],y+py-leaf.anchor[1])*.01;if(score<best){best=score;nearby[n]=id;}}
   if(strong[n]&&nearby[n]>=0)owner[n]=nearby[n];
  }
  // Include the dark anti-aliased rim adjacent to green, but no cyan sky fringe.
  for(let py=1;py<h-1;py++)for(let px=1;px<w-1;px++){
   const n=py*w+px,i=((y+py)*1536+x+px)*4,r=source[i],g=source[i+1],b=source[i+2];
   const adjacent=strong[n-1]||strong[n+1]||strong[n-w]||strong[n+w]||strong[n-w-1]||strong[n+w+1]||strong[n-w+1]||strong[n+w-1];
   foreground[n]=strong[n]||(adjacent&&g<160&&g>r*.8&&g>b*.82)?1:0;
   if(nearby[n]>=0&&foreground[n])owner[n]=nearby[n];
  }
  // Fill one-pixel interior holes without expanding a leaf into its backdrop.
  const before=owner.slice();for(let py=1;py<h-1;py++)for(let px=1;px<w-1;px++){const n=py*w+px;if(before[n]<0&&nearby[n]>=0&&[n-1,n+1,n-w,n+w].every(k=>before[k]>=0)){owner[n]=nearby[n];foreground[n]=1;}}
  const removed=new Uint8Array(w*h),fixed=new Uint8Array(w*h);for(let n=0;n<owner.length;n++){removed[n]=owner[n]>=0?1:0;const wx=x+n%w,wy=y+Math.floor(n/w),stem=region.ids[0]===3?((wx>=1287&&wx<=1352&&wy>=94&&wy<=129)||(wx>=1273&&wx<=1284&&wy>=140&&wy<=163)):region.ids[0]===0&&wx>=1437&&wx<=1498&&wy>=230;fixed[n]=foreground[n]&&!removed[n]&&stem?1:0;}
  const donors=foreground.slice();for(let n=0;n<donors.length;n++)if(removed[n])donors[n]=1;
  const nearest=exteriorField(donors,w,h);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
   const n=py*w+px;if(owner[n]<0)continue;
   const i=((y+py)*1536+x+px)*4,s=reflectedSample(n,nearest,donors,w,h);
   let j=((y+Math.floor(s/w))*1536+x+s%w)*4;
   // This leaf crosses the window mullion: expose its vertical face, not sky.
   if(region.ids[0]===3&&x+px>=1359&&x+px<1385){
    const top=(75*1536+x+px)*4,bottom=(150*1536+x+px)*4,t=Math.max(0,Math.min(1,(y+py-75)/75));
    for(let ch=0;ch<3;ch++)plate[i+ch]=source[top+ch]*(1-t)+source[bottom+ch]*t;
   }else for(let ch=0;ch<3;ch++)plate[i+ch]=source[j+ch];
  }
  for(const id of ids){
   const leaf=leafShapes[id],pixels=[];for(let n=0;n<owner.length;n++)if(owner[n]===id)pixels.push(n);
   const pad=20,left=Math.min(...pixels.map(n=>n%w))-pad,top=Math.min(...pixels.map(n=>Math.floor(n/w)))-pad,right=Math.max(...pixels.map(n=>n%w))+pad,bottom=Math.max(...pixels.map(n=>Math.floor(n/w)))+pad;
   const canvas=document.createElement('canvas');canvas.width=right-left+1;canvas.height=bottom-top+1;const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height);
   for(const n of pixels){const sx=x+n%w,sy=y+Math.floor(n/w),i=(sy*1536+sx)*4,j=((sy-y-top)*canvas.width+sx-x-left)*4;for(let ch=0;ch<3;ch++)image.data[j+ch]=source[i+ch];image.data[j+3]=255;}
   ctx.putImageData(image,0,0);const sprite={canvas,x:x+left,y:y+top,w:canvas.width,h:canvas.height};
   const length=Math.max(...leaf.polygon.map(([x,y])=>Math.hypot(x-leaf.anchor[0],y-leaf.anchor[1])));
   leaves.push({...leaf,...prepareWarp(sprite,(x,y)=>{const free=Math.min(1,Math.hypot(x-leaf.anchor[0],y-leaf.anchor[1])/length)**1.7;return[free,free*free];},10)});
  }
  mattes.push({x,y,w,h,removed,fixed,foreground});
 }
 scene.foliageMattes=mattes;return leaves;
}
