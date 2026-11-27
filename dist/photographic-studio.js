/* Four spherical photographs share one floor plan. The glass reception
   opening and the two timber/metal jambs occlude all views beyond them. */
window.createPhotographicStudio = async function (THREE, scene, rooms, repaint) {
  "use strict";
  const ids = Object.keys(rooms);
  const folder = "assets/office/";
  const loader = new THREE.TextureLoader();

  async function loadMap(file, repeat = false) {
    const texture = await loader.loadAsync(folder + file);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    return texture;
  }

  const walls = {
    lobby: [[-7.2,0,-5.45],[7.19,4.50,6.18]],
    showroom: [[7.19,0,-4.56],[14.5,4.50,4.56]],
    projects: rooms.projects.bounds, contact: rooms.contact.bounds
  };
  // Floor contacts and head heights, measured on the front and rear lips
  // of the metal frame in the approved reception photograph (metres).
  // This short passage has a flared reveal and a slightly sloping soffit.
  const head = [
    [6.912,2.527,-.011], [7.087,2.580,1.401],
    [7.225,2.487,.103], [7.155,2.497,1.337]
  ].map(p => new THREE.Vector3(...p));
  const foot = head.map(p => new THREE.Vector3(p.x,0,p.z));
  const inside = new THREE.Vector3(7.09,1.65,.72);
  function inwardPlane(a,b,c) {
    const plane = new THREE.Plane().setFromCoplanarPoints(a,b,c);
    if (plane.distanceToPoint(inside)<0) plane.negate();
    return new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
  }
  const receptionPassage = [
    inwardPlane(foot[0],foot[1],head[0]), inwardPlane(foot[2],foot[3],head[2]),
    inwardPlane(foot[0],foot[2],head[0]), inwardPlane(foot[1],foot[3],head[1]),
    inwardPlane(foot[0],foot[1],foot[2]),
    inwardPlane(head[0],head[1],head[2]), inwardPlane(head[1],head[3],head[2])
  ];
  // Forward depth of the nearest table feet, measured from the showroom
  // panorama using the known eye height and the angle down to the slab.
  const [smallViews, firstPanorama, firstDetail, showroomPanorama, showroomDetail] = await Promise.all([
    Promise.all(ids.map(id => loadMap(id + "-small.webp", true))),
    loadMap("lobby.webp",true).catch(() => null),
    loadMap("lobby-detail.webp").catch(() => null),
    loadMap("showroom.webp",true).catch(() => null),
    loadMap("showroom-detail.webp").catch(() => null)
  ]);
  const stations = new Map(ids.map((id, index) => {
    const {pos, look} = rooms[id];
    return [id, {
      id, eye: new THREE.Vector3(...pos), heading: Math.atan2(look[0]-pos[0], pos[2]-look[2]),
      lower: new THREE.Vector3(...walls[id][0]), upper: new THREE.Vector3(...walls[id][1]),
      small: smallViews[index], panorama: null, detail: null, loading: false
    }];
  }));
  let source = stations.get("lobby"), destination = source;
  let crossing=false, pendingTextures=false;
  source.panorama = firstPanorama;
  source.detail = firstDetail;
  stations.get("showroom").panorama = showroomPanorama;
  stations.get("showroom").detail = showroomDetail;
  const wing=["showroom","projects","contact"].map(id=>stations.get(id));
  const uniforms = {
    receptionPlanes:{value:receptionPassage}, daylight:{value:0},
    dividers:{value:[rooms.projects,rooms.contact].map(room=>new THREE.Vector4(...room.opening))},
    wingEye:{value:wing.map(s=>s.eye)},wingLo:{value:wing.map(s=>s.lower)},wingHi:{value:wing.map(s=>s.upper)},
    wingHead:{value:wing.map(s=>s.heading)},roomA:{value:-1},roomB:{value:0},
    neighborMap:{value:wing[1].small},meetingMap:{value:wing[2].small},
    galleryPrint:{value:wing[1].small},hasPrint:{value:0},oak:{value:await loader.loadAsync("assets/oak.webp")}
  };
  for (const side of ["A","B"]) {
    for (const key of ["pano","detail","hasDetail","eye","heading","lower","upper"]) uniforms[key+side] = {value: null};
  }

  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `
      varying vec3 worldPoint;
      void main() {
        vec4 point = modelMatrix * vec4(position, 1.0);
        worldPoint = point.xyz;
        gl_Position = projectionMatrix * viewMatrix * point;
      }`,
    fragmentShader: `
      varying vec3 worldPoint;
      uniform sampler2D panoA, panoB, detailA, detailB;
      uniform vec3 eyeA, eyeB, lowerA, upperA, lowerB, upperB;
      uniform vec4 receptionPlanes[7];
      uniform vec4 dividers[2];
      uniform vec3 wingEye[3],wingLo[3],wingHi[3];
      uniform float wingHead[3],headingA, headingB, hasDetailA, hasDetailB, daylight;
      uniform int roomA,roomB;
        uniform sampler2D neighborMap, meetingMap, galleryPrint, oak;
        uniform float hasPrint;
      const float pi = 3.141592654;

      // Project a world-space ray into both a spherical map and a calibrated
      // 106-degree rectilinear detail photograph, taken from the same eye.
      vec3 sampleStation(sampler2D panorama, sampler2D detail, float sharp, vec3 ray, float heading, int room) {
        float azimuth = atan(ray.x, -ray.z) - heading;
        vec2 uv = vec2(fract(azimuth/(2.0*pi) + .5), asin(clamp(ray.y,-1.0,1.0))/pi + .5);
        vec3 color = texture2D(panorama, uv).rgb;
        float forward = ray.x*sin(heading) - ray.z*cos(heading);
        if (forward > .23) {
          float right = ray.x*cos(heading) + ray.z*sin(heading);
          vec2 crop = .5 + vec2(right / 2.65408964, ray.y / 1.76939309) / forward;
          vec2 edges = min(crop, 1.0-crop);
          float weight = smoothstep(.005,.105,min(edges.x,edges.y));
          if (sharp>.5 && weight>0.0) color=mix(color,texture2D(detail,crop).rgb,weight);
          if(room==1 && hasPrint>.5){
            // Pixel coordinates on the calibrated 1536 × 1024 lens plate.
            vec2 pixels=crop*vec2(1536.0,1024.0);
            vec2 wallUV=(pixels-vec2(299.0,408.0))/vec2(553.0,285.0);
            if(all(greaterThan(wallUV,vec2(0))) && all(lessThan(wallUV,vec2(1))))
              color=texture2D(galleryPrint,wallUV).rgb;
          }
        }
        return color;
      }
      // Intersect the viewing ray with the room envelope. Project a single
      // coherent image onto each plane so moving past a door cannot split
      // its frame into unrelated foreground and background fragments.
      float roomDistance(vec3 ray, vec3 lower, vec3 upper) {
        vec3 safeRay=mix(vec3(.00001),ray,step(vec3(.00001),abs(ray)));
        vec3 t0=(lower-cameraPosition)/safeRay, t1=(upper-cameraPosition)/safeRay;
        vec3 farSide=max(t0,t1), nearSide=min(t0,t1);
        float farHit=min(farSide.x,min(farSide.y,farSide.z));
        float nearHit=max(nearSide.x,max(nearSide.y,nearSide.z));
        return (farHit>=nearHit && farHit>.01) ? farHit : 22.0;
      }
      vec3 roomRay(vec3 ray, vec3 eye, vec3 lower, vec3 upper) {
        return normalize(cameraPosition + ray*roomDistance(ray,lower,upper)-eye);
      }
      vec3 wingView(int id,vec3 ray) {
        vec3 eye=wingEye[id];
        float heading=wingHead[id];
        float distance=roomDistance(ray,wingLo[id],wingHi[id]);
        if(id!=1){
          vec3 forward=vec3(sin(heading),0.,-cos(heading));
          float front=dot(ray,forward);
          // The nearest photographed feet sit at 1.49 m in the showroom
          // and 0.65 m in the meeting room (low upholstered chairs).
          float depth=(id==0?1.49:.65)+dot(eye-cameraPosition,forward);
          if(front>.0001 && depth>.0)distance=min(distance,depth/front);
        }
        vec3 sight=normalize(cameraPosition+ray*distance-eye);
        if(id==roomA)return sampleStation(panoA,detailA,hasDetailA,sight,heading,id);
        if(id==roomB)return sampleStation(panoB,detailB,hasDetailB,sight,heading,id);
        if(id==2)return sampleStation(meetingMap,meetingMap,0.,sight,heading,id);
        return sampleStation(neighborMap,neighborMap,0.,sight,heading,id);
      }
      // Trace the actual front opening, reveals and back opening together.
      // A ray sees one room or one metal surface, including on the first frame.
      float receptionView(vec3 ray, out vec3 lobbySight) {
        vec4 origin=vec4(cameraPosition,1.0);
        float front=dot(receptionPlanes[0],origin);
        float back=dot(receptionPlanes[1],origin);
        float facing=dot(receptionPlanes[0].xyz,ray);
        // The glass wall meets the front of the frame on this oblique plane.
        float distance=roomDistance(ray,lowerA,vec3(40.0,upperA.yz));
        if(front<0.0 && facing>0.00001) distance=min(distance,-front/facing);
        lobbySight=normalize(cameraPosition+ray*distance-eyeA);

        float outside=back<0.0 ? 1.0 : 0.0;
        float enter=0.0, leave=100.0;
        int nearFace=-1, farFace=-1;
        for(int i=0;i<7;i++){
          vec4 face=receptionPlanes[i];
          float offset=dot(face,origin), speed=dot(face.xyz,ray);
          if(abs(speed)<0.000001){
            if(offset<0.0)return outside;
          }else{
            float t=-offset/speed;
            if(speed>0.0 && t>enter){enter=t;nearFace=i;}
            if(speed<0.0 && t<leave){leave=t;farFace=i;}
            if(leave<=enter)return outside;
          }
        }
        if((front<0.0 && nearFace!=0) || (back<0.0 && nearFace!=1))return outside;
        if(farFace==1)return 1.0;
        if(farFace>=2)lobbySight=normalize(cameraPosition+ray*leave-eyeA);
        // Once at the showroom's stationary eye its sphere supplies the
        // reverse view. This affects only rays looking back through the opening.
        return back<0.0 ? smoothstep(.18,1.18,-back) : 0.0;
      }
      const float halfWall=.09;
      // 0 = wall, 1 = visible jamb, 2 = open sightline through both lips.
      // Starting inside a jamb uses the same exit test as approaching it.
      int passage(vec3 ray,vec4 door,int index,out vec3 finish){
        float signZ=sign(ray.z);
        float nearT=max(0.,(door.y-signZ*halfWall-cameraPosition.z)/ray.z);
        float farT=(door.y+signZ*halfWall-cameraPosition.z)/ray.z;
        if(farT<=0.)return 0;
        vec3 hit=cameraPosition+ray*nearT;
        float side=abs(hit.x-door.x)-door.z;
        float edge=max(side,hit.y-door.w);
        if(hit.y<0. || edge>.094)return 0;
        float depthShade=1.0;
        if(edge<=0.){
          vec3 farHit=cameraPosition+ray*farT;
          if(abs(farHit.x-door.x)<door.z && farHit.y>0. && farHit.y<door.w)return 2;
          float t=farT;
          if(abs(ray.x)>.00001)t=min(t,(door.x+sign(ray.x)*door.z-cameraPosition.x)/ray.x);
          if(abs(ray.y)>.00001)t=min(t,((ray.y>0.?door.w:0.)-cameraPosition.y)/ray.y);
          hit=cameraPosition+ray*max(nearT,t);
          depthShade=.62+.23*abs(hit.z-door.y)/halfWall;
        }
        vec2 grainUV=vec2((hit.x-door.x)+(hit.z-door.y),hit.y)*vec2(.42,.33);
        if(hit.y>door.w-.01)grainUV=grainUV.yx;
        float grain=dot(texture2D(oak,fract(grainUV)).rgb,vec3(.30,.53,.17));
        vec3 finishColor=index==0 ? vec3(.034,.021,.012)+grain*vec3(.20,.113,.051)
                                  : vec3(.064,.048,.030)+grain*vec3(.096,.078,.050);
        if(hit.y<.012)finishColor=vec3(.20,.166,.117);
        float faceLight=hit.y>=door.w?1.13:(hit.x<door.x?.82:1.);
        float bevel=1.+.42*exp(-abs(edge-.012)*152.)+.25*exp(-abs(edge-.078)*145.);
        finish=finishColor*depthShade*faceLight*bevel;
        return 1;
      }
      vec3 viewThroughWing(vec3 ray){
        bool ahead=ray.z>=0.;
        float z=cameraPosition.z+(ahead?-halfWall:halfWall);
        int area=z<dividers[0].y?0:(z<dividers[1].y?1:2);
        if(abs(ray.z)>.00001){
          for(int i=0;i<2;i++){
            int border=ahead?area:area-1;
            if(border<0 || border>1)break;
            vec3 finish=vec3(0.);
            int hit=passage(ray,dividers[border],border,finish);
            if(hit==0)break;
            if(hit==1)return finish;
            area+=ahead?1:-1;
          }
        }
        return wingView(area,ray);
      }
      void main() {
        vec3 ray=normalize(worldPoint-cameraPosition),color=vec3(0.);
        float reveal=1.;
        if(roomA<0){
          vec3 lobbySight=ray;
          reveal=receptionView(ray,lobbySight);
          if(reveal<1.)color=sampleStation(panoA,detailA,hasDetailA,lobbySight,headingA,-1);
        }
        if(reveal>.0001)color=mix(color,viewThroughWing(ray),reveal);
        float windowLight=max(0.,dot(ray,normalize(vec3(-.68,.38,-.43))));
        color*=1.+daylight*(.025+.115*windowLight);
        color.r*=1.+daylight*.023*windowLight;
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(35,32,20), material));
  // The same exhibition is baked into all spherical and still views.
  // This independent detail map keeps the actual screen captures legible up close.
  let printLoading=false;
  function sharpenBoard(){
    if(printLoading || uniforms.hasPrint.value)return;
    printLoading=true;
    loader.load("assets/projects/board.webp",map=>{
      map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
      uniforms.galleryPrint.value=map;uniforms.hasPrint.value=1;repaint();
    },undefined,()=>{printLoading=false;});
  }

  function bind(station, side) {
    uniforms["pano"+side].value = station.panorama || station.small;
    uniforms["detail"+side].value = station.detail || station.small;
    uniforms["hasDetail"+side].value = Number(Boolean(station.detail));
    uniforms["eye"+side].value = station.eye;
    uniforms["heading"+side].value = station.heading;
    uniforms["lower"+side].value = station.lower;
    uniforms["upper"+side].value = station.upper;
  }
  function sync() {
    if(crossing){pendingTextures=true;return;}
    pendingTextures=false;bind(source,"A");bind(destination,"B");
    const neighbor=source.id==="lobby"?wing[1]:wing[0];
    uniforms.neighborMap.value=neighbor.panorama || neighbor.small;
    uniforms.meetingMap.value=wing[2].panorama || wing[2].small;
    repaint();
  }
  function prepare(station) {
    if (station.loading || (station.panorama && station.detail)) return;
    station.loading = true;
    const requests = [];
    for (const [key,suffix,repeat] of [["panorama",".webp",true],["detail","-detail.webp",false]]) {
      if (station[key]) continue;
      const request = loadMap(station.id+suffix,repeat).then(texture => {
        station[key] = texture;
        sync();
      });
      requests.push(request);
    }
    // The complete low-resolution sphere stays available if a detail file
    // cannot be decoded. A later visit can retry that file.
    Promise.allSettled(requests).then(() => {station.loading=false;});
  }
  function select(fromId,toId) {
    source = stations.get(fromId); destination = stations.get(toId);
    crossing=false;
    uniforms.roomA.value=wing.indexOf(source);
    uniforms.roomB.value=wing.indexOf(destination);
    sync();
    prepare(source);
    prepare(destination);
    if(source===wing[1] || destination===wing[1])sharpenBoard();
  }
  return {select, blend(amount, light) {
    uniforms.daylight.value=light;
    // Keep the panorama pair fixed while the eye passes the physical jamb.
    crossing=amount>.13 && amount<.94;
    if(!crossing && pendingTextures)sync();
    if(amount>.43 && destination===wing[0])prepare(wing[1]);
    if(amount>.43 && destination===wing[1])prepare(wing[2]);
  }};
};
