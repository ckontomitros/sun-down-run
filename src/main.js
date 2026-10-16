import * as THREE from 'three';

const root = document.querySelector('#game');
const distLabel = document.querySelector('#dist');
const bestLabel = document.querySelector('#best');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const soundButton = document.querySelector('#sound');
const storedBest = Number(localStorage.getItem('sundown-best') || 0);
bestLabel.textContent = storedBest;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#85c7d3');
scene.fog = new THREE.Fog('#9ccfd0', 105, 330);
const camera = new THREE.PerspectiveCamera(57, innerWidth / innerHeight, 0.1, 650);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xc8f2ff, 0x856750, 2.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4b1, 3.0);
sun.position.set(-36, 68, 28);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
sun.shadow.bias = -0.00015;
scene.add(sun);

const mat = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const asphaltMat = mat('#535c59');
const asphaltEdgeMat = mat('#d7c79e');
const sidewalkMat = mat('#c5b694');
const earthMat = mat('#8c9271');
const seaMat = new THREE.MeshStandardMaterial({ color: '#168db0', roughness: 0.28, metalness: 0.08 });
const waterLineMat = mat('#d7eee0', .42);
const roadLength = 110;
const roadHalf = 7.1;
const sidewalkWidth = 2.4;
const grade = 0.205;
const groundY = z => -grade * z;
const laneCurve = z => Math.sin(z * .009) * 1.05 + Math.sin(z * .024) * .28;

function stripGeometry(xMin, xMax, length, zDivisions = 50) {
  const positions = [], indices = [];
  for (let i = 0; i <= zDivisions; i++) {
    const z = length * i / zDivisions;
    positions.push(xMin, groundY(z), z, xMax, groundY(z), z);
    if (i < zDivisions) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoadSegment(startZ) {
  const group = new THREE.Group();
  group.position.set(0, groundY(startZ), startZ);
  const add = (x0, x1, material, yOffset = 0) => {
    const mesh = new THREE.Mesh(stripGeometry(x0, x1, roadLength, 60), material);
    mesh.position.y = yOffset;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(-82, 82, earthMat, -.04);
  add(-roadHalf - sidewalkWidth, roadHalf + sidewalkWidth, sidewalkMat, .015);
  add(-roadHalf, roadHalf, asphaltMat, .045);
  const shoulderWidth = .22;
  add(-roadHalf, -roadHalf + shoulderWidth, waterLineMat, .055);
  add(roadHalf - shoulderWidth, roadHalf, waterLineMat, .055);
  const dashGeo = new THREE.BoxGeometry(.12, .025, 3.5);
  const dashMat = mat('#d9d0b7', .75);
  for (let z = 8; z < roadLength; z += 15) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(0, groundY(z) + .07, z);
    dash.receiveShadow = true;
    group.add(dash);
  }
  scene.add(group);
  return group;
}

const roadSegments = [createRoadSegment(-110), createRoadSegment(0), createRoadSegment(110), createRoadSegment(220)];

function makeRoofMaterial(color) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 9; row++) {
    const shift = row % 2 ? 0 : 10;
    for (let col = -1; col < 7; col++) {
      ctx.strokeStyle = row % 2 ? '#f2b07870' : '#633e3370';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(col * 22 + shift, row * 15); ctx.lineTo(col * 22 + shift, row * 15 + 14); ctx.stroke();
      ctx.strokeStyle = '#f5d4a044'; ctx.beginPath(); ctx.moveTo(col * 22 + shift, row * 15 + 1); ctx.lineTo(col * 22 + shift + 21, row * 15 + 1); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return new THREE.MeshStandardMaterial({ map: texture, color: '#ffffff', roughness: .92 });
}
const roofMaterials = ['#b76342', '#c27349', '#a9573e', '#bc7048'].map(makeRoofMaterial);
const wallColors = ['#dfc69b', '#b7c5ba', '#d9b998', '#d8ceb0', '#b7c4c1', '#d3b184'];
const woodMat = mat('#78523a');
const stoneMats = ['#9d8971', '#817a68', '#aa9274'].map(c => mat(c));
const glassMats = ['#3e7180', '#426f80', '#56818b'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .32, metalness: .12 }));
const whiteMat = mat('#eadfc5');
const balconyMat = mat('#684b38');
const roofRidgeMat = mat('#793f30');
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function addBox(parent, geometry, material, position, scale, cast = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeHouse(side, index, z) {
  const group = new THREE.Group();
  const width = 7.5 + (index % 3) * 1.2;
  const depth = 4.2 + (index % 2) * .65;
  const height = 5.2 + (index % 4) * .55;
  const roofRise = 2.1 + (index % 2) * .3;
  const inward = side < 0 ? 1 : -1;
  const wallMat = mat(wallColors[(index * 3 + (side > 0 ? 1 : 0)) % wallColors.length]);
  const roofMat = roofMaterials[(index + (side > 0 ? 1 : 0)) % roofMaterials.length];
  const windowMat = glassMats[index % glassMats.length];
  const rotation = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  group.rotation.y = rotation;
  const body = addBox(group, boxGeo, wallMat, [0, height / 2, 0], [width, height, depth]);
  body.material = [wallMat, wallMat, wallMat, wallMat, wallMat, wallMat];
  // A stone plinth gives the houses the stepped, coastal-street silhouette.
  const plinthMat = stoneMats[index % stoneMats.length];
  addBox(group, boxGeo, plinthMat, [0, .47, 0], [width + .16, .94, depth + .12]);
  // Gable ends and two separate roof planes make the roof read clearly from the moving camera.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-width / 2, 0); gableShape.lineTo(width / 2, 0); gableShape.lineTo(0, roofRise); gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: depth * .94, bevelEnabled: false });
  const gable = new THREE.Mesh(gableGeo, wallMat);
  gable.position.set(0, height - .02, -depth * .47);
  gable.castShadow = true; gable.receiveShadow = true; group.add(gable);
  const roofSlope = Math.sqrt((depth / 2) ** 2 + roofRise ** 2);
  const roofPanelGeo = new THREE.BoxGeometry(width + .8, .19, roofSlope + .3);
  const angle = Math.atan2(roofRise, depth / 2);
  const leftRoof = new THREE.Mesh(roofPanelGeo, roofMat);
  leftRoof.position.set(0, height + roofRise / 2, -depth / 4);
  leftRoof.rotation.x = -angle;
  leftRoof.castShadow = true; leftRoof.receiveShadow = true; group.add(leftRoof);
  const rightRoof = new THREE.Mesh(roofPanelGeo, roofMat);
  rightRoof.position.set(0, height + roofRise / 2, depth / 4);
  rightRoof.rotation.x = angle;
  rightRoof.castShadow = true; rightRoof.receiveShadow = true; group.add(rightRoof);
  addBox(group, boxGeo, roofRidgeMat, [0, height + roofRise + .04, 0], [width + .95, .16, .2]);

  const frontZ = depth / 2 + .075;
  const count = width > 8 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const wx = (i - (count - 1) / 2) * (width * .28);
    const wy = 2.85 + (i % 2) * .15;
    const ww = 1.08, wh = 1.45;
    addBox(group, boxGeo, whiteMat, [wx, wy, frontZ], [ww + .17, wh + .17, .12]);
    addBox(group, boxGeo, windowMat, [wx, wy, frontZ + .075], [ww, wh, .06]);
    addBox(group, boxGeo, whiteMat, [wx, wy, frontZ + .12], [.065, wh, .035], false);
    addBox(group, boxGeo, whiteMat, [wx, wy, frontZ + .12], [ww, .065, .035], false);
    // A couple of windows get shallow balconies with visible rails and brackets.
    if (i === 0 && index % 3 !== 1) {
      const balconyY = wy - .95, balconyDepth = .65;
      addBox(group, boxGeo, balconyMat, [wx, balconyY, frontZ + balconyDepth / 2], [ww + .48, .13, balconyDepth]);
      addBox(group, boxGeo, balconyMat, [wx, balconyY + .48, frontZ + balconyDepth], [ww + .48, .09, .09]);
      for (let p = -2; p <= 2; p++) addBox(group, boxGeo, balconyMat, [wx + p * (ww + .3) / 4, balconyY + .24, frontZ + balconyDepth], [.055, .48, .055], false);
    }
  }
  const doorX = width * .34;
  addBox(group, boxGeo, woodMat, [doorX, 1.57, frontZ + .045], [1.02, 2.65, .14]);
  addBox(group, boxGeo, mat('#e9c78e', .35, { emissive: '#4a3015', emissiveIntensity: .12 }), [doorX - inward * .29, 1.6, frontZ + .13], [.12, .12, .05], false);
  // Side-wall openings ensure the buildings still feel three-dimensional when the camera swings.
  for (let level = 0; level < 2; level++) {
    const sideZ = -depth * .23 + level * depth * .46;
    addBox(group, boxGeo, woodMat, [inward * (width / 2 + .035), 2.3 + level * 1.7, sideZ], [.1, .85, 1.1]);
    addBox(group, boxGeo, windowMat, [inward * (width / 2 + .1), 2.3 + level * 1.7, sideZ], [.05, .66, .88]);
  }

  const worldX = side * (roadHalf + sidewalkWidth + depth / 2 + 1.15 + (index % 2) * 1.2);
  group.position.set(worldX, groundY(z), z);
  group.userData.side = side;
  group.userData.index = index;
  group.userData.worldX = worldX;
  group.userData.worldZ = z;
  group.userData.width = width;
  scene.add(group);
  return group;
}

const houses = [];
for (let row = 0; row < 18; row++) {
  const z = -18 + row * 12.8;
  houses.push(makeHouse(-1, row, z));
  houses.push(makeHouse(1, row + 2, z + (row % 2 ? 3.2 : 0)));
}

const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1500, 1, 1), seaMat);
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(0, groundY(305) - 5, 920);
scene.add(ocean);
// Pale little breakers near the coastline.
const waveLines = [];
for (let i = 0; i < 24; i++) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(3, 14), .035, .18), waterLineMat);
  line.position.set(THREE.MathUtils.randFloat(-55, 55), ocean.position.y + .08, 250 + i * 2.4);
  scene.add(line); waveLines.push(line);
}

const islandMat = mat('#52756a');
const islands = [];
for (let i = 0; i < 7; i++) {
  const island = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), islandMat);
  const height = 15 + (i % 3) * 8;
  island.scale.set(THREE.MathUtils.randFloat(18, 37), height, THREE.MathUtils.randFloat(22, 46));
  island.position.set((i - 3) * 37, ocean.position.y + height * .18, 340 + (i % 2) * 32);
  island.rotation.y = i * .7;
  island.receiveShadow = true;
  scene.add(island); islands.push(island);
}

const cloudMat = new THREE.MeshStandardMaterial({ color: '#fff1d5', roughness: 1, transparent: true, opacity: .84 });
const clouds = [];
for (let i = 0; i < 16; i++) {
  const group = new THREE.Group();
  const baseX = THREE.MathUtils.randFloatSpread(190);
  const baseZ = 30 + i * 23;
  for (let j = 0; j < 4; j++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    puff.scale.set(THREE.MathUtils.randFloat(3.5, 8), THREE.MathUtils.randFloat(1.4, 3.2), THREE.MathUtils.randFloat(2, 4));
    puff.position.set((j - 1.5) * 4.6, THREE.MathUtils.randFloat(-1, 1), THREE.MathUtils.randFloat(-2, 2));
    group.add(puff);
  }
  group.position.set(baseX, 24 + (i % 4) * 5, baseZ);
  group.userData.baseX = baseX;
  group.userData.baseZ = baseZ;
  scene.add(group); clouds.push(group);
}

const board = new THREE.Group();
scene.add(board);
const deckShape = new THREE.Shape();
deckShape.moveTo(-.22, 1.19);
deckShape.quadraticCurveTo(-.36, 1.2, -.36, .98);
deckShape.lineTo(-.29, -.94);
deckShape.quadraticCurveTo(-.28, -1.2, 0, -1.27);
deckShape.quadraticCurveTo(.28, -1.2, .29, -.94);
deckShape.lineTo(.36, .98);
deckShape.quadraticCurveTo(.36, 1.2, .22, 1.19);
deckShape.closePath();
const deckGeometry = new THREE.ExtrudeGeometry(deckShape, { depth: .13, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025 });
const deck = new THREE.Mesh(deckGeometry, mat('#ed863d', .48));
deck.rotation.x = -Math.PI / 2;
deck.position.y = .27;
deck.castShadow = true; deck.receiveShadow = true;
board.add(deck);
const grip = new THREE.Mesh(new THREE.ShapeGeometry(deckShape), mat('#e99a4e', .8));
grip.rotation.x = -Math.PI / 2;
grip.position.y = .405;
board.add(grip);
const boardStripe = addBox(board, boxGeo, mat('#f4c773', .55), [0, .42, 0], [.055, .025, 1.65], false);
boardStripe.rotation.x = 0;

const truckMat = mat('#9ca3a0', .38, { metalness: .55 });
const wheelMat = mat('#de7037', .48);
const axleGeo = new THREE.CylinderGeometry(.045, .045, .83, 12);
const wheelGeo = new THREE.CylinderGeometry(.16, .16, .12, 16);
const wheels = [];
for (const z of [-.76, .76]) {
  const truck = new THREE.Mesh(axleGeo, truckMat);
  truck.rotation.z = Math.PI / 2;
  truck.position.set(0, .23, z);
  truck.castShadow = true; board.add(truck);
  addBox(board, boxGeo, truckMat, [0, .22, z], [.23, .11, .2]);
  for (const x of [-.4, .4]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, .16, z);
    wheel.castShadow = true; wheel.receiveShadow = true;
    board.add(wheel); wheels.push(wheel);
  }
}

const rider = new THREE.Group();
board.add(rider);
const shirtMat = mat('#3189b2', .8);
const shirtLightMat = mat('#48a2c7', .8);
const shortsMat = mat('#296c89', .83);
const skinMat = mat('#e6a56e', .84);
const sockMat = mat('#357da2', .82);
const shoeMat = mat('#d4c7a7', .85);
const laceMat = mat('#f1e8d5', .8);
const packMat = mat('#d69630', .8);
const packDarkMat = mat('#a96d24', .8);
const hairMat = mat('#75442b', .91);
const hairLightMat = mat('#925a36', .9);
const seamLineMat = mat('#67472f', .85);

function addCapsule(parent, a, b, radius, material) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const delta = new THREE.Vector3().subVectors(to, from);
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(.02, delta.length() - radius * 2), 4, 9);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).add(to).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Staggered feet and bent knees give the rider a balanced downhill stance.
addBox(rider, boxGeo, shortsMat, [0, 1.28, 0], [.66, .39, .58]);
addCapsule(rider, [-.2, 1.16, .24], [-.27, .78, .38], .095, skinMat);
addCapsule(rider, [.2, 1.16, -.24], [.25, .78, -.38], .095, skinMat);
for (const [x, z] of [[-.27, .38], [.25, -.38]]) {
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(.085, .1, .29, 10), sockMat);
  sock.position.set(x, .64, z); sock.castShadow = true; rider.add(sock);
  addBox(rider, boxGeo, shoeMat, [x, .47, z], [.25, .15, .43]);
  addBox(rider, boxGeo, laceMat, [x, .55, z + .04], [.15, .025, .14], false);
}

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .67, 5, 12), shirtMat);
torso.position.set(0, 2.02, 0);
torso.rotation.x = -.08;
torso.castShadow = true; torso.receiveShadow = true; rider.add(torso);
addBox(rider, boxGeo, shortsMat, [0, 1.48, 0], [.56, .18, .49]);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .2, 10), skinMat);
neck.position.set(0, 2.56, .02); rider.add(neck);
const head = new THREE.Mesh(new THREE.SphereGeometry(.27, 16, 12), skinMat);
head.position.set(0, 2.83, .035); head.castShadow = true; rider.add(head);
const hair = new THREE.Mesh(new THREE.SphereGeometry(.29, 14, 10), hairMat);
hair.scale.set(1.02, .84, .92); hair.position.set(0, 2.91, -.07); hair.castShadow = true; rider.add(hair);
const bun = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 9), hairLightMat);
bun.position.set(0, 3.15, -.11); bun.castShadow = true; rider.add(bun);
for (const side of [-1, 1]) {
  const lock = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), hairMat);
  lock.scale.set(.75, 1.35, .78); lock.position.set(side * .2, 2.79, -.04); rider.add(lock);
}

// Small backpack, front pocket, seams and straps, kept behind the torso like the reference.
addBox(rider, boxGeo, packMat, [0, 2.04, -.39], [.66, .82, .31]);
addBox(rider, boxGeo, packDarkMat, [0, 1.81, -.565], [.49, .3, .055]);
addBox(rider, boxGeo, packMat, [0, 1.99, -.6], [.43, .035, .025], false);
for (const side of [-1, 1]) {
  addBox(rider, boxGeo, packDarkMat, [side * .22, 2.3, -.15], [.075, .55, .075], false);
  addBox(rider, boxGeo, packDarkMat, [side * .29, 1.98, -.46], [.06, .12, .2], false);
}
// Relaxed arms held out slightly for balance.
for (const side of [-1, 1]) {
  const shoulder = [side * .29, 2.34, .02];
  const elbow = [side * .59, 2.08 + side * .04, .1];
  const hand = [side * .83, 1.91 + side * .08, .22];
  addCapsule(rider, shoulder, elbow, .115, shirtLightMat);
  addCapsule(rider, elbow, hand, .085, skinMat);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(.095, 10, 8), skinMat);
  palm.position.set(...hand); palm.castShadow = true; rider.add(palm);
}

const boardShadow = new THREE.Mesh(new THREE.CircleGeometry(1.55, 32), new THREE.MeshBasicMaterial({ color: '#203b35', transparent: true, opacity: .34, depthWrite: false }));
boardShadow.rotation.x = -Math.PI / 2;
boardShadow.scale.set(.78, 1, 1.5);
boardShadow.position.y = .035;
scene.add(boardShadow);

let running = false;
let steer = 0;
let velocity = 0;
let cameraX = 0;
let playerZ = 0;
let runDistance = 0;
let runSpeed = 0;
let previousTime = performance.now();
let audioContext = null;
let audioOsc = null;
let audioGain = null;
const held = { left: false, right: false };

function begin() {
  running = true; playerZ = 0; steer = 0; velocity = 0; cameraX = 0; runDistance = 0; runSpeed = 12;
  startButton.textContent = 'Start rolling';
  overlay.classList.add('hidden');
  previousTime = performance.now();
}
startButton.addEventListener('click', begin);
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'arrowleft' || key === 'a') held.left = true;
  if (key === 'arrowright' || key === 'd') held.right = true;
  if (key === ' ' && !running) begin();
});
window.addEventListener('keyup', event => {
  const key = event.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') held.left = false;
  if (key === 'arrowright' || key === 'd') held.right = false;
});
let dragging = false, pointerX = 0;
renderer.domElement.addEventListener('pointerdown', event => { dragging = true; pointerX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); });
renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging) return;
  velocity = THREE.MathUtils.clamp(velocity - (event.clientX - pointerX) / innerWidth * 10, -7, 7);
  pointerX = event.clientX;
});
renderer.domElement.addEventListener('pointerup', () => dragging = false);
renderer.domElement.addEventListener('pointercancel', () => dragging = false);

function setSound(on) {
  if (on && !audioContext) {
    audioContext = new AudioContext();
    audioOsc = audioContext.createOscillator();
    audioGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    audioOsc.type = 'sine'; audioOsc.frequency.value = 110;
    filter.type = 'lowpass'; filter.frequency.value = 260;
    audioGain.gain.value = .012;
    audioOsc.connect(filter).connect(audioGain).connect(audioContext.destination);
    audioOsc.start();
  }
  if (!audioContext) return;
  on ? audioContext.resume() : audioContext.suspend();
}
soundButton.addEventListener('click', () => {
  const on = soundButton.dataset.on !== 'true';
  soundButton.dataset.on = String(on);
  soundButton.innerHTML = on ? '♫ &nbsp; SOUND ON' : '♫ &nbsp; SOUND OFF';
  setSound(on);
});

function updateRoad() {
  for (const segment of roadSegments) {
    if (playerZ > segment.position.z + roadLength + 8) {
      segment.position.z += roadLength * roadSegments.length;
      segment.position.y = groundY(segment.position.z);
      // Rebuild the segment's continuous slope at its new world location.
      let strip = 0;
      for (const child of segment.children) {
        if (!(child.geometry instanceof THREE.BoxGeometry)) {
          const ranges = [[-82, 82], [-roadHalf - sidewalkWidth, roadHalf + sidewalkWidth], [-roadHalf, roadHalf], [-roadHalf, -roadHalf + .22], [roadHalf - .22, roadHalf]];
          if (strip < ranges.length) {
            child.geometry.dispose();
            child.geometry = stripGeometry(ranges[strip][0], ranges[strip][1], roadLength, 60);
            strip++;
          }
        }
      }
    }
  }
}

function updateHouses() {
  for (const house of houses) {
    if (playerZ > house.userData.worldZ + 28) {
      house.userData.worldZ += 230.4;
      house.position.z = house.userData.worldZ;
      house.position.y = groundY(house.position.z);
    }
  }
}

function updateScene(dt, time) {
  const input = (held.left ? 1 : 0) - (held.right ? 1 : 0);
  velocity += (input * 10 - velocity * 2.8) * dt;
  steer = THREE.MathUtils.clamp(steer + velocity * dt, -5.1, 5.1);
  runSpeed = Math.min(27, runSpeed + dt * .42);
  playerZ += runSpeed * dt;
  runDistance += runSpeed * dt;
  distLabel.textContent = Math.floor(runDistance);

  const roadX = laneCurve(playerZ);
  const playerX = roadX + steer;
  const playerY = groundY(playerZ);
  board.position.set(playerX, playerY, playerZ);
  const desiredHeading = THREE.MathUtils.clamp(Math.atan2(velocity * 2.3, runSpeed), -.62, .62);
  board.rotation.y += (desiredHeading - board.rotation.y) * (1 - Math.exp(-dt * 4.8));
  board.rotation.z = THREE.MathUtils.clamp(-velocity * .012, -.09, .09);
  rider.position.y = Math.sin(time * 5.3) * .018;
  for (const wheel of wheels) wheel.rotation.y -= runSpeed * dt / .16;
  boardShadow.position.set(playerX, groundY(playerZ) + .035, playerZ);

  // The camera starts centered behind the rider, then catches up with gentle spring lag when steering.
  const camTargetX = roadX + steer * .72;
  cameraX += (camTargetX - cameraX) * (1 - Math.exp(-dt * 1.35));
  const camY = groundY(playerZ) + 5.2;
  camera.position.set(cameraX - velocity * .1, camY, playerZ - 10.5);
  camera.lookAt(roadX + steer * .22, groundY(playerZ + 23) + 1.9, playerZ + 23);
  camera.rotateZ(-velocity * .0015);

  sun.position.set(playerX - 36, playerY + 72, playerZ + 28);
  sun.target.position.set(playerX, playerY + 1.5, playerZ + 32);
  sun.target.updateMatrixWorld();
  updateRoad(); updateHouses();

  ocean.position.z = playerZ + 920;
  ocean.position.y = groundY(playerZ + 305) - 5;
  for (let i = 0; i < waveLines.length; i++) {
    const line = waveLines[i];
    line.position.z = playerZ + 235 + i * 2.4;
    line.position.y = ocean.position.y + .08;
    line.position.x += Math.sin(time * .35 + i) * dt * .35;
  }
  for (let i = 0; i < islands.length; i++) {
    const island = islands[i];
    island.position.z = playerZ + 330 + (i % 2) * 32;
    island.position.y = ocean.position.y + island.scale.y * .18;
  }
  for (const cloud of clouds) {
    if (cloud.userData.baseZ < playerZ - 80) cloud.userData.baseZ += 500;
    cloud.position.z = cloud.userData.baseZ;
    cloud.position.x = cloud.userData.baseX + Math.sin(time * .018 + cloud.userData.baseZ) * 2;
  }

  if (runDistance > Number(bestLabel.textContent)) {
    bestLabel.textContent = Math.floor(runDistance);
    localStorage.setItem('sundown-best', String(Math.floor(runDistance)));
  }
}

function frame(now) {
  const dt = Math.min((now - previousTime) / 1000, .04);
  previousTime = now;
  if (running) updateScene(dt, now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener('resize', resize);

camera.position.set(0, 5.2, -10.5);
camera.lookAt(0, -2.8, 23);
requestAnimationFrame(frame);
