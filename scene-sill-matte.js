import { inside } from './scene-objects.js?v=20261111-sky43';

// The small plant, flowerpot, upright tool and sloping board have separate
// silhouettes. Their gaps are open sky, not one solid shelf-shaped polygon.
const board=[[1412,251],[1416,251],[1417,254],[1417,260],[1425,260],[1425,270],[1420,270],[1420,301],[1395,301],[1393,299],[1393,294],[1395,292],[1397,290],[1399,288],[1400,286],[1401,284],[1403,282],[1404,279],[1405,277],[1406,274],[1406,271],[1407,269],[1407,267],[1408,265],[1409,262],[1410,260],[1411,259],[1411,255]];
const pot=[[1451,244],[1486,244],[1486,247],[1488,247],[1488,255],[1486,255],[1486,260],[1485,260],[1485,261],[1484,261],[1484,262],[1483,262],[1483,270],[1452,270],[1448,260],[1448,247],[1450,246]];
const tool=[[1506,231],[1508,231],[1508,250],[1512,251],[1512,255],[1521,254],[1524,256],[1524,259],[1527,259],[1527,267],[1525,267],[1525,271],[1482,271],[1482,262],[1492,259],[1495,257],[1498,257],[1498,254],[1501,254],[1501,237],[1503,234],[1506,234]];
const smallPlant=[[1425,244],[1439,244],[1439,248],[1442,248],[1443,253],[1448,253],[1450,258],[1452,270],[1424,270],[1421,259],[1422,252],[1425,250]];
const sideLeaf=[[1392,269],[1396,267],[1399,264],[1401,263],[1409,263],[1413,265],[1412,268],[1407,271],[1394,273],[1392,272]];

export function prepareSillMatte(scene){
 const x=1388,y=230,w=148,h=72,coverage=new Uint8Array(w*h),src=scene.original.data;
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){
  const wx=x+px,wy=y+py,i=(wy*1536+wx)*4,r=src[i],g=src[i+1],b=src[i+2];
  const point=p=>inside(wx+.5,wy+.5,p);
  // The board's blue-gray side and the shelf face are real painted surfaces.
  // Color rejection is confined to the foliage/pot/tool silhouettes above it.
  const solid=point(board)||(wy>=270&&wx>=1420);
  const oldSky=g-r>6&&b-r>10&&b>=g;
  const object=(point(pot)||point(tool)||point(smallPlant)||point(sideLeaf))&&!oldSky;
  coverage[py*w+px]=solid||object?0:255;
 }
 return{x,y,w,h,coverage};
}
