function quad(out,o,x,y,right,bottom,u,v,uu,vv){
  out[o++]=x;out[o++]=y;out[o++]=u;out[o++]=v;out[o++]=right;out[o++]=y;out[o++]=uu;out[o++]=v;
  out[o++]=x;out[o++]=bottom;out[o++]=u;out[o++]=vv;out[o++]=x;out[o++]=bottom;out[o++]=u;out[o++]=vv;
  out[o++]=right;out[o++]=y;out[o++]=uu;out[o++]=v;out[o++]=right;out[o++]=bottom;out[o++]=uu;out[o]=vv;
}
// Draw the existing high-DPI glyph textures as two GPU batches. Geometry,
// colors, positions and raster density stay shared with the Canvas2D path.
export class GlyphBatch {
  constructor(canvas,renderer,allowSoftware=false){
    this.canvas=canvas;this.groups=[];
    const probe=new OffscreenCanvas(1,1).getContext('webgl',{powerPreference:'low-power'});
    if(!probe)return;
    const info=probe.getExtension('WEBGL_debug_renderer_info');
    const name=info?probe.getParameter(info.UNMASKED_RENDERER_WEBGL):'';
    const accelerated=name&&!/swiftshader|software|llvmpipe|lavapipe|softpipe|basic render|warp/i.test(name);
    const precise=probe.getShaderPrecisionFormat(probe.FRAGMENT_SHADER,probe.HIGH_FLOAT).precision>0;
    const sources=[canvas,renderer.glyphMotion.palette.canvas,renderer.spriteAtlas.canvas];
    const fits=sources.every(c=>Math.max(c.width,c.height)<=probe.getParameter(probe.MAX_TEXTURE_SIZE));
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    // Software WebGL is slower than Canvas2D; keep the measured fallback there.
    if((!accelerated&&!allowSoftware)||!precise||!fits)return;
    this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    if(!this.gl)return;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.updatedBase=false;});
    canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.program=null;this.groups=[];this.staticTexture=this.framebuffer=this.fullBuffer=this.restoreBuffer=null;if(this.renderer)this.restoreComplete=this.onRestore?this.onRestore():Promise.resolve(this.configure(this.renderer));});
    this.groups=[];
  }
  shader(type,source){
    const gl=this.gl,shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  configure(renderer){
    const gl=this.gl;this.renderer=renderer;if(this.lost)return;
    if(!this.program){
      const vertex=this.shader(gl.VERTEX_SHADER,'attribute vec2 position; attribute vec2 uv; uniform vec2 resolution; varying highp vec2 texCoord; void main(){vec2 p=position/resolution*2.0-1.0;gl_Position=vec4(p.x,-p.y,0.0,1.0);texCoord=uv;}');
      const fragment=this.shader(gl.FRAGMENT_SHADER,'precision highp float; uniform sampler2D atlas; varying highp vec2 texCoord; void main(){gl_FragColor=texture2D(atlas,texCoord);}');
      this.program=gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      this.position=gl.getAttribLocation(this.program,'position');this.uv=gl.getAttribLocation(this.program,'uv');this.resolution=gl.getUniformLocation(this.program,'resolution');
    }
    for(const group of this.groups){gl.deleteTexture(group.texture);gl.deleteBuffer(group.buffer);}
    this.groups=[this.group(renderer.glyphMotion.cells.filter(c=>c.glyphLayer==='base'),renderer.glyphMotion.palette,true),this.group(renderer.dynamic,renderer.spriteAtlas,false)];
    gl.useProgram(this.program);gl.uniform1i(gl.getUniformLocation(this.program,'atlas'),0);
    gl.uniform2f(this.resolution,this.canvas.width/renderer.pixelRatio,this.canvas.height/renderer.pixelRatio);
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.disable(gl.DITHER);
    if(this.staticTexture)gl.deleteTexture(this.staticTexture);
    if(this.framebuffer)gl.deleteFramebuffer(this.framebuffer);
    if(this.fullBuffer)gl.deleteBuffer(this.fullBuffer);
    if(this.restoreBuffer)gl.deleteBuffer(this.restoreBuffer);
    this.staticTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.staticTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.canvas.width,this.canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    this.framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.staticTexture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Glyph framebuffer unavailable');
    const w=this.canvas.width/renderer.pixelRatio,h=this.canvas.height/renderer.pixelRatio,full=new Float32Array(24),restore=new Float32Array(renderer.dynamic.length*24);
    quad(full,0,0,0,w,h,0,1,1,0);
    renderer.dynamic.forEach((cell,i)=>{const[x,y,cw,ch]=cell.inkBox;quad(restore,i*24,x,y,x+cw,y+ch,x/w,1-y/h,(x+cw)/w,1-(y+ch)/h);});
    this.fullBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.fullBuffer);gl.bufferData(gl.ARRAY_BUFFER,full,gl.STATIC_DRAW);
    this.restoreBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.restoreBuffer);gl.bufferData(gl.ARRAY_BUFFER,restore,gl.STATIC_DRAW);
    this.frame=-1;this.draw(0);
  }
  group(cells,atlas,fixed){
    const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas.canvas);
    const vertices=new Float32Array(cells.length*24),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices.byteLength,gl.DYNAMIC_DRAW);
    return{cells,atlas,fixed,texture,buffer,vertices,variants:new Uint8Array(cells.length).fill(255)};
  }
  update(group){
    const gl=this.gl,{cells,atlas,vertices,variants}=group;let dirty=false;
    for(let i=0;i<cells.length;i++){
      const cell=cells[i],variant=cell.glyphVariant;
      if(group.fixed&&variants[i]===variant)continue;
      variants[i]=variant;dirty=true;if(group.fixed)cell.glyphPresentedVariant=variant;
      const tile=cell.glyphTiles[(cell.glyphStart+variant*cell.glyphStride)%cell.glyphPool.length],m=tile.metric;
      const s=(group.fixed?cell.size:cell.renderSize??cell.size)/atlas.dpr;
      const x=cell.x+(m.x-atlas.tile/2)*s,y=(group.fixed?cell.y:cell.renderY??cell.y)+(m.y-atlas.tile/2)*s;
      quad(vertices,i*24,x,y,x+m.w*s,y+m.h*s,tile.x/atlas.canvas.width,tile.y/atlas.canvas.height,(tile.x+m.w)/atlas.canvas.width,(tile.y+m.h)/atlas.canvas.height);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);if(dirty)gl.bufferSubData(gl.ARRAY_BUFFER,0,vertices);
  }
  render(buffer,texture,count){
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,16,0);
    gl.enableVertexAttribArray(this.uv);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,16,8);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.drawArrays(gl.TRIANGLES,0,count);
  }
  draw(time){
    if(this.lost)return;
    const gl=this.gl,frame=Math.floor(time*6),[base,moving]=this.groups;
    gl.useProgram(this.program);this.updatedBase=frame!==this.frame;
    if(this.updatedBase){
      this.frame=frame;this.update(base);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.clearColor(8/255,13/255,19/255,1);gl.clear(gl.COLOR_BUFFER_BIT);
      this.render(base.buffer,base.texture,base.cells.length*6);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.BLEND);
    if(this.updatedBase)this.render(this.fullBuffer,this.staticTexture,6);
    else this.render(this.restoreBuffer,this.staticTexture,moving.cells.length*6);
    gl.enable(gl.BLEND);this.update(moving);this.render(moving.buffer,moving.texture,moving.cells.length*6);
  }
  get bufferBytes(){if(!this.gl)return 0;return this.canvas.width*this.canvas.height*4+this.groups.reduce((sum,g)=>sum+g.vertices.byteLength+g.atlas.canvas.width*g.atlas.canvas.height*4,0);}
}
