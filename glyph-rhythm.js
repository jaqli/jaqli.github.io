// A shared clock for the letters on moving objects. Position, color and size
// stay independent of the character change; starting at t=0 preserves the poster.
export const alternatives={'.':',',',':'.',':':';',';':':','-':'~','=':'+', '+':'=','*':'+','x':'o','o':'x','%':'#','#':'%','M':'W','W':'M','@':'B'};
export const spriteGlyphPeriod=6;
export function prepareGlyph(cell){
  const x=cell.sx??cell.x,y=cell.sy??cell.y;
  const n=Math.sin(x*127.1+y*311.7+1729)*43758.5453;
  cell.glyphOffset=n-Math.floor(n);cell.glyphVariant=0;
}
export function glyphVariant(cell,time){return Math.floor(Math.max(0,time)/spriteGlyphPeriod+cell.glyphOffset)%2;}

