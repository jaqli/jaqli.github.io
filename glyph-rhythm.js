// A shared clock for the letters on moving objects. Position, color and size
// stay independent of the character change; starting at t=0 preserves the poster.
export const alternatives={'.':',',',':'.',':':';',';':':','-':'~','=':'+', '+':'=','*':'+','x':'o','o':'x','%':'#','#':'%','M':'W','W':'M','@':'B'};
export const glyphRateMin=1.2;
export const glyphRateMax=1.5;
export function prepareGlyph(cell){
  const x=cell.sx??cell.x,y=cell.sy??cell.y;
  const n=Math.sin(x*127.1+y*311.7+1729)*43758.5453;
  const rate=Math.sin(x*39.7+y*97.3+91)*21413.173;
  cell.glyphOffset=n-Math.floor(n);cell.glyphVariant=0;
  cell.glyphRate=glyphRateMin+(glyphRateMax-glyphRateMin)*(rate-Math.floor(rate));
}
export function glyphStep(cell,time){return Math.floor(Math.max(0,time)*cell.glyphRate+cell.glyphOffset);}
export function glyphVariant(cell,time){return glyphStep(cell,time)%2;}

