const clamp = (x, low=0, high=1) => Math.max(low,Math.min(high,x));
// Source-image coordinates keep motion, perspective and hit targets in agreement.
export const birds = [
  { id: 'primary', center: [991,263], phase: 0, lift: 17, duration: 28,
    route: [[991,263],[1155,225],[1200,155],[1065,140],[933,195],[941,295],[1115,315]],
    points: [[939,223],[962,235],[980,250],[1016,237],[1041,241],[1014,254],[1001,270],[1017,275],[1008,283],[982,275],[974,260],[958,250],[944,233]] },
  { id: 'upper', center: [957,112], phase: 1.2, lift: 12, duration: 34,
    route: [[957,112],[1095,125],[1195,210],[1085,275],[935,220],[922,155]],
    points: [[912,94],[936,93],[950,103],[969,94],[977,87],[998,82],[989,94],[977,98],[971,116],[962,124],[966,131],[951,128],[943,113],[925,106]] },
  { id: 'middle', center: [1053,184], phase: 2.4, lift: 9, duration: 31,
    route: [[1053,184],[1178,270],[1120,326],[961,280],[945,160],[1055,130]],
    points: [[1024,181],[1044,178],[1053,182],[1068,164],[1081,163],[1072,174],[1065,189],[1057,194],[1051,190],[1037,190]] },
  { id: 'right', center: [1153,224], phase: .7, lift: 8, duration: 39,
    route: [[1153,224],[1210,165],[1105,120],[976,165],[1006,260],[1165,320],[1240,280]],
    points: [[1134,224],[1145,221],[1152,223],[1164,207],[1175,204],[1173,212],[1165,214],[1161,231],[1153,236],[1147,230]] },
  { id: 'distant', center: [1224,197], phase: 3.4, lift: 11, duration: 37,
    route: [[1224,197],[1160,130],[1018,170],[1068,280],[1215,304],[1260,248]],
    points: [[1201,203],[1211,197],[1222,193],[1227,185],[1238,176],[1243,175],[1241,183],[1236,191],[1230,197],[1224,201],[1223,207],[1220,207],[1220,201],[1212,206],[1201,206]] },
];

const polygonBounds = new WeakMap();
export function inside(x, y, polygon) {
  let bounds = polygonBounds.get(polygon);
  if (!bounds) {
    bounds = [Math.min(...polygon.map(p=>p[0])), Math.min(...polygon.map(p=>p[1])), Math.max(...polygon.map(p=>p[0])), Math.max(...polygon.map(p=>p[1]))];
    polygonBounds.set(polygon,bounds);
  }
  if (x < bounds[0] || y < bounds[1] || x > bounds[2] || y > bounds[3]) return false;
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) contained = !contained;
  }
  return contained;
}
function flight(bird, time) {
  const route = bird.route, count = route.length;
  const progress = ((time / bird.duration) % 1 + 1) % 1 * count;
  const index = Math.floor(progress), t = progress - index;
  const p0 = route[(index + count - 1) % count], p1 = route[index];
  const p2 = route[(index + 1) % count], p3 = route[(index + 2) % count];
  const position = [], velocity = [];
  for (let axis = 0; axis < 2; axis++) {
    const a = 2 * p1[axis], b = p2[axis] - p0[axis];
    const c = 2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis];
    const d = -p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis];
    position.push(.5 * (a + b * t + c * t * t + d * t * t * t));
    velocity.push(.5 * (b + 2 * c * t + 3 * d * t * t));
  }
  return { position, bank: Math.atan2(velocity[1], Math.abs(velocity[0]) + 1) * .14 };
}
export function birdPose(bird, time) {
  const path = flight(bird, time);
  // A short sequence of wingbeats, followed by an extended glide. Different
  // routes and rhythms prevent the flock moving like a synchronized wave.
  const stroke = t => {
    const cycle = (t + bird.phase) % 7.6;
    const envelope = Math.sin(Math.PI * clamp(cycle / 3.2)) ** 2;
    return Math.sin(t * 4.6 + bird.phase) * envelope;
  };
  const bank = path.bank - flight(bird, 0).bank;
  return { position: path.position, flap: (stroke(time) - stroke(0)) * bird.lift,
    scale: clamp(1 + (path.position[1] - bird.center[1]) * .0008, .86, 1.12),
    cos: Math.cos(bank), sin: Math.sin(bank) };
}
export function birdPoint(bird, x, y, time, pose = birdPose(bird, time)) {
  const [cx, cy] = bird.center;
  const wing = clamp(Math.abs(x - cx) / 40) * clamp((cy - y) / 18);
  const dx = x - cx, dy = y - cy + pose.flap * wing;
  return [pose.position[0] + (dx * pose.cos - dy * pose.sin) * pose.scale,
    pose.position[1] + (dx * pose.sin + dy * pose.cos) * pose.scale];
}

export const waterAreas = [
  [[870,436],[1367,433],[1363,548],[1200,578],[1120,659],[995,657],[984,579],[875,572]],
  [[716,697],[1007,686],[1114,652],[1200,696],[1126,775],[1010,800],[966,854],[865,908],[725,900],[630,836],[555,827]],
  [[255,804],[428,815],[605,863],[725,902],[866,902],[948,884],[1074,929],[1234,931],[1349,986],[1069,1023],[694,1023],[535,948],[372,938],[242,899],[154,850]],
];
export const screenOccluder = [[722,460],[724,457],[727,457],[725,454],[728,452],[729,449],
  [726,445],[723,443],[724,441],[729,444],[732,447],[733,450],[743,449],[751,446],
  [757,440],[762,440],[759,444],[758,448],[757,451],[768,451],[769,449],[770,452],
  [769,457],[778,464],[781,463],[780,466],[785,466],[801,478],[801,540],[710,540],
  [710,515],[713,512],[708,509],[708,505],[706,501],[702,504],[699,503],[701,499],
  [703,495],[704,488],[699,488],[696,484],[697,482],[699,485],[704,486],[705,480],
  [707,476],[707,474],[701,475],[700,474],[700,472],[704,472],[707,470],[708,466],
  [713,462],[719,460]];
export const hemArea = [[815,617],[848,615],[848,629],[839,637],[818,634]];

export const distantCity = [
  [[1114,447],[1134,437],[1143,437],[1143,416],[1152,415],[1152,404],[1162,404],[1163,420],[1171,419],
   [1171,376],[1178,373],[1179,357],[1186,356],[1187,345],[1191,345],[1191,359],[1197,359],[1198,376],
   [1205,379],[1205,402],[1211,402],[1211,384],[1222,384],[1222,412],[1229,406],[1238,407],[1239,417],
   [1251,418],[1251,398],[1266,397],[1266,415],[1279,413],[1279,423],[1293,425],[1293,402],[1306,399],
   [1306,423],[1317,421],[1317,435],[1324,434],[1325,411],[1335,412],[1335,423],[1341,423],[1341,412],
   [1352,411],[1352,397],[1362,397],[1362,451],[1335,452],[1318,448],[1280,453],[1256,449],[1224,450],
   [1195,450],[1160,447],[1133,453]],
  [[1384,399],[1393,391],[1394,379],[1403,377],[1403,347],[1411,337],[1411,431],[1384,431]],
  [[1427,360],[1439,360],[1439,332],[1448,332],[1448,314],[1464,314],[1464,325],[1477,325],
   [1477,307],[1496,307],[1496,300],[1527,300],[1527,332],[1512,338],[1512,351],[1494,354],
   [1471,355],[1460,351],[1450,358],[1444,361],[1427,367]],
];
