(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const trail = byId("office-journey"), world = byId("office-world"), surface = byId("scene-surface");
  const poster = byId("office-poster"), mobileSource = poster.parentElement.querySelector("source");
  const stages = [...trail.querySelectorAll(".station")], nav = [...document.querySelectorAll(".studio-nav a")];
  const table = byId("table-pin"), doors = [...world.querySelectorAll("[data-door]")];
  const plates = [...world.querySelectorAll(".project-plate")];
  const wallGallery = byId("project-wall-open");
  const projectControls = [...plates, wallGallery];
  // Five mounted prints on a 2048 x 1056 board, itself registered to
  // the original 1536 x 1024 lens image. Both viewing modes use these edges.
  const printRegions=plates.map((element,index)=>{
    const left=58+(4-index)*391;
    return {element,pixels:toBoardPixels([[left,222],[left+368,222],[left+368,977],[left,977]])};
  });
  // The header of the photographed board is also a large, readable zoom control.
  printRegions.push({element:wallGallery,pixels:toBoardPixels([[45,20],[2005,20],[2005,203],[45,203]])});
  function toBoardPixels(points) {
    return points.map(([x,y])=>[299+x*553/2048,331+y*285/1056]);
  }
  const dial = world.querySelector(".look-dial"), reduce = matchMedia("(prefers-reduced-motion:reduce)");
  const stillControl=byId("static-view");
  let preferStill=false;
  const still=()=>reduce.matches || preferStill;
  const rooms = {
    // The floor contacts of the photographed metal jambs locate the lobby
    // camera. Its lens direction and the other two standing points stay fixed.
    lobby:{pos:[1.866,1.68,2.820],look:[2.456,1.79,-6.490],view:[7.206,1.65,-2.190]},
    showroom:{pos:[8.62,1.65,1.00],look:[12.52,1.53,-.78],door:[7.19,1.55,.72],table:[11.62,1.03,-.66],action:"לפתוח את שולחן ההדגמות",
      path:[[3.72,1.68,2.12],[5.72,1.67,1.12],[6.95,1.66,.77],[7.55,1.65,.76]]},
    projects:{pos:[11.267,1.64,7.99],look:[11.267,1.64,11.35],door:[11.25,1.45,4.65],
      // [centre X, centre Z, clear half-width, clear height]. Both sides of
      // each physical passage share these dimensions and an 18 cm reveal.
      opening:[11.25,4.65,.613,2.52],bounds:[[7.62,0,4.74],[15.67,3.52,11.35]],
      path:[[9.65,1.66,1.78],[10.82,1.65,3.12],[11.23,1.64,4.24],[11.25,1.64,5.30]]},
    contact:{pos:[8.42,1.64,12.64],look:[6.40,1.43,15.98],door:[9.145,1.44,11.44],table:[7.10,1.04,15.06],action:"לכתיבת הודעה לראבן",
      opening:[9.145,11.44,.566,2.50],bounds:[[5.085,0,11.53],[12.395,3.7,19.44]],
      path:[[10.62,1.64,8.90],[9.78,1.64,10.25],[9.30,1.64,11.17],[8.88,1.64,11.88]]}
  };
  const itinerary = stages.map(stage=>stage.dataset.room),legs=itinerary.slice(1);
  const clamp = n => Math.max(0,Math.min(1,n));
  const ease = n => {const x=clamp(n);return x*x*(3-2*x);};
  let stops=[],frame=0,active=-1,engine=null,loading=false,failed=false,posterRoom="";
  let yawOffset=0,pitchOffset=0,lookOrigin=0,activeTable="";
  document.body.classList.add("office-enhanced");
  function drawSoon(){if(!frame)frame=requestAnimationFrame(draw);}
  function measure(){
    if(trail.hidden)return;
    stops=stages.map(stage=>stage.getBoundingClientRect().top+scrollY);
    drawSoon();
  }
  function setNav(index){
    if(active===index)return;
    active=index;
    nav.forEach((a,i)=>{if(i===index)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");});
    world.dataset.room=stages[index].dataset.room;
  }
  function setPoster(room){
    if(posterRoom===room)return;
    posterRoom=room;
    const file=room==="lobby"?"entry-view":room==="projects"?"projects-still":room+"-detail";
    const source="assets/office/"+file+".webp";
    mobileSource.srcset=room==="lobby"?"assets/office/entry-view-mobile.webp":source;
    poster.src=source;
  }
  function placeStillPrints(room){
    if(room!=="projects"){projectControls.forEach(el=>el.hidden=true);return;}
    const w=surface.clientWidth,h=surface.clientHeight,scale=Math.max(w/1536,h/1024);
    const shiftX=(w-1536*scale)*(innerWidth<=680?.33:.5),shiftY=(h-1024*scale)*.5;
    for(const {element,pixels} of printRegions){
      const [[x,y],,[right,bottom]]=pixels;
      Object.assign(element.style,{left:shiftX+x*scale+"px",top:shiftY+y*scale+"px",
        width:(right-x)*scale+"px",height:(bottom-y)*scale+"px",clipPath:"none"});
      element.hidden=false;
    }
  }
  function setMode(){
    const spatial=Boolean(engine && !failed && !still());
    stillControl.checked=still() || failed;
    stillControl.disabled=reduce.matches || failed;
    world.dataset.mode=spatial?"spatial":"still";
    if(engine)engine.canvas.hidden=!spatial;
    dial.hidden=!spatial;
    surface.tabIndex=spatial?0:-1;
    if(!spatial){table.hidden=true;[...doors,...projectControls].forEach(el=>el.hidden=true);}
    drawSoon();
  }
  function draw(){
    frame=0;if(trail.hidden || !stops.length)return;
    const y=scrollY;
    let section=0;
    while(section<stops.length-1 && y>=stops[section+1]-1)section++;
    const next=Math.min(section+1,stops.length-1);
    const overrun=Math.max(0,stages[section].offsetHeight-innerHeight);
    const hold=overrun;
    const interval=Math.max(1,stops[next]-stops[section]-hold-.06*innerHeight);
    const progress=next===section?0:clamp((y-stops[section]-hold)/interval);
    const nearest=progress>.53?next:section;
    setNav(nearest);setPoster(stages[nearest].dataset.room);
    if(!engine || failed || still()){placeStillPrints(stages[nearest].dataset.room);return;}
    const leg=Math.min(section,legs.length-1);
    engine.paint(legs[leg],section===legs.length?1:progress,section+progress);
  }
  function script(src){
    return new Promise((resolve,reject)=>{
      const element=document.createElement("script");element.src=src;
      element.onload=resolve;element.onerror=reject;document.head.append(element);
    });
  }
  async function initialize(){
    if(loading || engine || failed || still() || trail.hidden)return;
    loading=true;
    let context;
    try{
      const canvas=document.createElement("canvas");
      const options={alpha:false,antialias:false,powerPreference:"low-power"};
      context=canvas.getContext("webgl2",options) || canvas.getContext("webgl",options);
      if(!context){failed=true;return;}
      await Promise.all([script("vendor/three-160.min.js"),script("photographic-studio.js")]);
      engine=await buildWorld(window.THREE,canvas,context);
    }catch{failed=true;context?.getExtension("WEBGL_lose_context")?.loseContext();}
    finally{loading=false;setMode();}
  }
  async function buildWorld(T,canvas,context){
    const renderer = new T.WebGLRenderer({canvas,context,antialias:false,alpha:false,powerPreference:"low-power"});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.45));
    renderer.outputColorSpace=T.SRGBColorSpace;
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(60,1,.04,90);
    const toVec = a=>new T.Vector3(...a);
    const paths = {}, projection=new T.Vector3(), pos=new T.Vector3(), tangent=new T.Vector3();
    // Positions of the five physical prints, measured in the high-resolution
    // board image, then unprojected onto the photographed wall at z=11.35 m.
    const boardRects=printRegions.map(({element,pixels})=>{
      const corners=pixels.map(([px,py])=>{
        return new T.Vector3(11.267-(px-768)*3.36/578.72951,1.64+(512-py)*3.36/578.72951,11.35);
      });
      return {element,corners};
    });
    const facing=(from,to)=>[Math.atan2(from.x-to.x,from.z-to.z),Math.atan2(to.y-from.y,Math.hypot(to.x-from.x,to.z-from.z))];
    const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
    for(const id of legs){
      const previous=itinerary[legs.indexOf(id)],start=rooms[previous], end=rooms[id];
      const p=[start.pos,...end.path,end.pos].map(toVec);
      paths[id]={previous,curve:new T.CatmullRomCurve3(p,false,"centripetal"),from:facing(p[0],toVec(start.view||start.look)),to:facing(p.at(-1),toVec(end.look))};
    }
    const photo=await window.createPhotographicStudio(T,scene,rooms,drawSoon);
    canvas.setAttribute("aria-hidden","true");surface.append(canvas);
    canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();failed=true;setMode();});
    let w=0,h=0,selected="";
    function resize(){
      const {width,height}=surface.getBoundingClientRect();
      if(!width || !height || width===w && height===h)return;
      w=width;h=height;renderer.setSize(w,h,false);
      camera.aspect=w/h;camera.fov=w<=680?76:61;
      // Frame the furniture away from the text, without moving the camera's eye.
      camera.setViewOffset(w,h,w*(w<=680?0:.065),0,w,h);
      camera.updateProjectionMatrix();
    }
    function locate(element,point,visible){
      if(!visible){element.hidden=true;return;}
      projection.fromArray(point).project(camera);
      const x=(projection.x*.5+.5)*w,y=(.5-projection.y*.5)*h;
      element.hidden=projection.z<0 || projection.z>1 || x<22 || x>w-22 || y<68 || y>h-26;
      if(element.hidden)return;
      element.style.transform="translate("+x.toFixed(2)+"px,"+y.toFixed(2)+"px) translate(-50%,-50%)";
      element.classList.toggle("label-right",x<135);
    }
    function placePrints(visible){
      for(const {element,corners} of boardRects){
        if(!visible){element.hidden=true;continue;}
        const pixels=corners.map(corner=>{
          projection.copy(corner).project(camera);
          return {x:(1+projection.x)*w/2,y:(1-projection.y)*h/2,z:projection.z};
        });
        if(pixels.some(p=>p.z<0 || p.z>1)){element.hidden=true;continue;}
        const xx=pixels.map(p=>p.x),yy=pixels.map(p=>p.y);
        const x=Math.min(...xx),y=Math.min(...yy),width=Math.max(...xx)-x,height=Math.max(...yy)-y;
        if(x+width<16 || x>w-16 || y+height<65 || y>h-12 || width<10){element.hidden=true;continue;}
        const polygon=pixels.map(p=>(p.x-x).toFixed(2)+"px "+(p.y-y).toFixed(2)+"px");
        Object.assign(element.style,{left:x+"px",top:y+"px",width:width+"px",height:height+"px",clipPath:"polygon("+polygon.join(",")+")"});
        element.hidden=false;
      }
    }
    function paint(room,t,globalProgress){
      resize();if(!w || !h)return;
      const path=paths[room],from=path.previous;
      if(selected!==room){selected=room;photo.select(from,room);}
      const u=ease(t);
      path.curve.getPointAt(u,pos);
      path.curve.getTangentAt(Math.min(1,u+.065),tangent);
      const along=[Math.atan2(-tangent.x,-tangent.z),Math.asin(tangent.y)];
      const depart=ease(t/.31),arrive=ease((t-.55)/.43);
      // From the worktable the meeting door is around a corner. Lead the
      // turn gradually, leaving the jamb in view well before the eye crosses.
      const pathYaw=angle(angle(path.from[0],along[0],depart),path.to[0],arrive);
      let baseYaw=pathYaw;
      if(room!=="showroom"){
        // Look through the opening while rounding the corner. The target
        // lies beyond the lintel, so it never flips as the eye crosses it.
        const door=rooms[room].door;
        const exitX=room==="contact"?rooms.contact.pos[0]:door[0];
        const doorYaw=Math.atan2(pos.x-exitX,pos.z-door[2]-1.85);
        const lead=ease(t/.38)*(1-ease((t-.48)/.24));
        baseYaw=angle(angle(path.from[0],path.to[0],ease(t/.82)),doorYaw,lead);
      }
      const framing=room==="projects"?ease((t-.25)/.68):from==="projects"?1-ease(t/.64):0;
      baseYaw+=(w<=680?.28:.18)*framing;
      // Pan just the arrival view toward the reception wordmark. Ease back
      // onto the established doorway path as soon as the visitor walks on.
      if(from==="lobby" && w>680){
        const receptionPan=.12+.12*clamp((2.15-w/h)/.6);
        baseYaw+=receptionPan*(1-ease(t/.36));
      }
      const lens=(w<=680?76:61)+(w<=680?6:10)*framing;
      if(Math.abs(camera.fov-lens)>.001){camera.fov=lens;camera.updateProjectionMatrix();}
      const basePitch=T.MathUtils.lerp(T.MathUtils.lerp(path.from[1],along[1],depart),path.to[1],arrive);
      const retain=1-ease(Math.abs(scrollY-lookOrigin)/Math.max(1,innerHeight*.65));
      camera.position.copy(pos);
      camera.rotation.set(basePitch+pitchOffset*retain,baseYaw+yawOffset*retain,0,"YXZ");
      camera.updateMatrixWorld();
      photo.blend(u,Math.sin(globalProgress*Math.PI*.72));
      renderer.render(scene,camera);
      const atLobby=from==="lobby" && u<.46;
      doors.forEach(button=>locate(button,rooms[button.dataset.door].door,atLobby));
      const near=from!=="lobby" && u<.24?from:u>.69?room:"";
      activeTable=near;
      if(rooms[near]?.table){
        const label=rooms[near].action;
        if(byId("pin-label").textContent!==label)byId("pin-label").textContent=label;
      }
      locate(table,rooms[near]?.table,Boolean(rooms[near]?.table));
      placePrints(near==="projects");
      world.dataset.leg=from+"-"+room;
      world.dataset.position=u.toFixed(3);
    }
    return {canvas,paint};
  }
  function turn(dx,dy){
    if(!engine || still() || failed)return;
    const retain=1-ease(Math.abs(scrollY-lookOrigin)/Math.max(1,innerHeight*.65));
    yawOffset=yawOffset*retain+dx;
    pitchOffset=Math.max(-1.04,Math.min(1.04,pitchOffset*retain+dy));
    lookOrigin=scrollY;drawSoon();
  }
  byId("look-left").onclick=()=>turn(.35,0);
  byId("look-right").onclick=()=>turn(-.35,0);
  byId("look-center").onclick=()=>{yawOffset=pitchOffset=0;drawSoon();};
  // A browser can suppress its synthetic click immediately after a panorama
  // drag. A completed tap on a scene control uses the same activation as Enter.
  let tapStart=null, tappedControl=null;
  world.addEventListener("pointerdown",event=>{
    const button=event.target.closest("button,a");
    tappedControl=null;
    tapStart=event.pointerType==="touch" && button ? {button,x:event.clientX,y:event.clientY,id:event.pointerId} : null;
  });
  world.addEventListener("pointercancel",()=>{tapStart=null;tappedControl=null;});
  world.addEventListener("pointerup",event=>{
    const start=tapStart;tapStart=null;
    if(!start || start.id!==event.pointerId || Math.hypot(event.clientX-start.x,event.clientY-start.y)>9)return;
    if(start.button.contains(document.elementFromPoint(event.clientX,event.clientY)))tappedControl=start.button;
  });
  world.addEventListener("touchend",event=>{
    const button=tappedControl;tappedControl=null;
    if(!button || !event.cancelable)return;
    // Cancel only this finished control tap. Its marker can disappear when
    // it opens the form, so a later compatibility click could hit the canvas.
    event.preventDefault();
    button.focus({preventScroll:true});
    button.click();
  },{passive:false});
  surface.addEventListener("keydown",event=>{
    if(event.key==="ArrowLeft" || event.key==="ArrowRight"){
      event.preventDefault();
      turn(event.key==="ArrowLeft" ? .22 : -.22,0);
    }
  });
  let grip=null;
  surface.addEventListener("pointerdown",e=>{
    if(failed || !engine || still() || !e.isPrimary || e.button!==0)return;
    grip={id:e.pointerId,x:e.clientX,y:e.clientY,held:false};
  });
  surface.addEventListener("pointermove",e=>{
    if(!grip || grip.id!==e.pointerId)return;
    const dx=e.clientX-grip.x,dy=e.clientY-grip.y;
    if(!grip.held){
      if(Math.abs(dx)+Math.abs(dy)<5)return;
      if(e.pointerType==="touch" && Math.abs(dy)>=Math.abs(dx)){grip=null;return;}
      grip.held=true;surface.setPointerCapture(e.pointerId);world.classList.add("is-dragging");
    }
    const speed=2/Math.max(320,Math.min(surface.clientWidth,surface.clientHeight));
    turn(dx*speed,dy*speed);grip.x=e.clientX;grip.y=e.clientY;
  });
  function endGrip(){grip=null;world.classList.remove("is-dragging");}
  surface.addEventListener("pointercancel",endGrip);surface.addEventListener("pointerup",endGrip);
  surface.addEventListener("pointerleave",()=>{if(!grip?.held)endGrip();});
  let guidedFrame=0;
  function stopGuidedWalk(){if(guidedFrame)cancelAnimationFrame(guidedFrame);guidedFrame=0;}
  function jumpTo(id,animate=false){
    const section=byId(id);
    if(!section)return;
    stopGuidedWalk();
    section.focus({preventScroll:true});
    const start=scrollY, distance=section.getBoundingClientRect().top;
    if(!animate || still() || Math.abs(distance)<3){
      section.scrollIntoView({block:"start",behavior:"instant"});drawSoon();return;
    }
    // Only clicking a door starts a timed move. Wheel, touch, a key or the
    // scrollbar immediately returns control to the visitor's native scroll.
    const duration=Math.min(2350,Math.max(700,1550*Math.abs(distance)/innerHeight));
    const began=performance.now();
    function walk(now){
      const t=clamp((now-began)/duration);
      scrollTo({top:start+distance*ease(t),behavior:"instant"});drawSoon();
      guidedFrame=t<1?requestAnimationFrame(walk):0;
    }
    guidedFrame=requestAnimationFrame(walk);
  }
  table.addEventListener("click",()=>{
    if(activeTable==="showroom"){window.RabenShowroom.open();return;}
    if(activeTable==="contact"){
      jumpTo("contact-room");
      byId("contact-name").focus({preventScroll:true});
    }
  });
  function route(){
    if(location.hash==="#control-room")history.replaceState(null,"","#projects-room");
    const hash=location.hash.slice(1);
    document.querySelectorAll("dialog[open]").forEach(dialog=>dialog.close());
    measure();initialize();
    const id=hash==="lobby"?"home":hash;
    if(stages.some(s=>s.id===id))jumpTo(id);
  }
  document.addEventListener("click",e=>{
    const a=e.target.closest("a[href^='#']");
    if(!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button!==0)return;
    const id=a.hash.slice(1);
    if(!stages.some(s=>s.id===id) || trail.hidden)return;
    e.preventDefault();
    if(location.hash!==a.hash)history.pushState(null,"",a.hash);
    document.querySelectorAll("dialog[open]").forEach(dialog=>dialog.close());
    yawOffset=pitchOffset=0;
    jumpTo(id,a.matches("#start-journey,.door-pin,.next-room"));
  });
  byId("help-open").onclick=()=>byId("help").showModal();
  byId("help-close").onclick=()=>byId("help").close();
  window.addEventListener("hashchange",route);
  ["wheel","pointerdown","touchstart","keydown"].forEach(type=>window.addEventListener(type,stopGuidedWalk,{capture:true,passive:true}));
  window.addEventListener("scroll",drawSoon,{passive:true});
  window.addEventListener("resize",measure,{passive:true});
  const sizeObserver=new ResizeObserver(measure);stages.forEach(stage=>sizeObserver.observe(stage));
  reduce.addEventListener("change",()=>{stopGuidedWalk();setMode();initialize();});
  stillControl.addEventListener("change",()=>{
    preferStill=stillControl.checked;
    setMode();initialize();
  });
  document.addEventListener("toggle",drawSoon,true);
  setMode();route();document.fonts.ready.then(measure);
})();
