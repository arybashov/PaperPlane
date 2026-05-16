// ==========================================
// THREE.JS SCENE
// ==========================================

let scene, camera, renderer, controls;
let planeMesh, trailLine, gridHelper;
let sceneInitialized = false;
let vectorField = null;
let windArrow = null;
let planeDesignKey = '';

// Параметры сетки векторов воздушного потока
const VF_W = 30;  // ширина по X и Z
const VF_H = 15;  // высота по Y
const VF_STEP = 1; // шаг
const VF_NX = Math.floor(VF_W / VF_STEP) + 1; // 31
const VF_NY = Math.floor(VF_H / VF_STEP) + 1; // 16
const VF_NZ = Math.floor(VF_W / VF_STEP) + 1; // 31

// Детерминированный хеш для стабильного шума турбулентности
function hash3(x, y, z) {
    let h = x * 374761393 + y * 668265263 + z * 1274126177;
    h = ((h ^ (h >> 13)) * 1274126177);
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function initScene() {
    if (sceneInitialized) return;
    
    const container = document.getElementById('scene-container');
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.FogExp2(0x0a0a12, 0.008);
    
    // Camera
    camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(25, 30, 40);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 150;
    controls.target.set(15, 5, 0);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const hemiLight = new THREE.HemisphereLight(0x4ecca3, 0x1a2f23, 0.3);
    scene.add(hemiLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    scene.add(dirLight);
    
    // Ground
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x0d1a14,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Grid
    gridHelper = new THREE.GridHelper(200, 50, 0x1a3d2e, 0x0f1f18);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    
    // Distance markers
    for (let d = 0; d <= 100; d += 10) {
        const markerGeo = new THREE.PlaneGeometry(0.5, 0.5);
        const markerMat = new THREE.MeshBasicMaterial({ 
            color: 0x4ecca3, 
            transparent: true, 
            opacity: 0.6 
        });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(d, 0.02, 0);
        scene.add(marker);
    }
    
    // Paper plane model
    createPlaneModel();
    
    // Trail line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ 
        color: 0x4ecca3,
        transparent: true,
        opacity: 0.8
    });
    trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    
    // Old trails
    window.oldTrailLines = [];
    
    // ========== VECTOR FIELD (grid of airflow vectors) ==========
    
    const totalVerts = VF_NX * VF_NY * VF_NZ; // 15376
    const vfPos = new Float32Array(totalVerts * 6); // start + end for each
    const vfCol = new Float32Array(totalVerts * 6); // color per vertex
    
    for (let ix = 0; ix < VF_NX; ix++) {
        for (let iy = 0; iy < VF_NY; iy++) {
            for (let iz = 0; iz < VF_NZ; iz++) {
                const gx = ix * VF_STEP;
                const gy = iy * VF_STEP;
                const gz = iz * VF_STEP;
                const idx = (ix * VF_NY * VF_NZ) + (iy * VF_NZ) + iz;
                
                const flow = airflowVelocityAt(gx, gy, gz, 0);
                const fx = flow.x;
                const fy = flow.y;
                const fz = flow.z;
                
                // Длина вектора
                const len = Math.sqrt(fx*fx + fy*fy + fz*fz);
                const scale = 0.6;
                const mag = Math.min(len / 2.5, 1);
                
                // Start point
                vfPos[idx*6] = gx;
                vfPos[idx*6+1] = gy;
                vfPos[idx*6+2] = gz;
                // End point
                vfPos[idx*6+3] = gx + fx * scale;
                vfPos[idx*6+4] = gy + fy * scale;
                vfPos[idx*6+5] = gz + fz * scale;
                
                // Color: blue (weak) → red (strong)
                const r = mag;
                const g = 0.2 + (1-mag) * 0.5;
                const b = 0.2 + (1-mag) * 0.5;
                
                for (let k = 0; k < 6; k += 3) {
                    vfCol[idx*6+k] = r;
                    vfCol[idx*6+k+1] = g;
                    vfCol[idx*6+k+2] = b;
                }
            }
        }
    }
    
    const vfGeo = new THREE.BufferGeometry();
    vfGeo.setAttribute('position', new THREE.BufferAttribute(vfPos, 3));
    vfGeo.setAttribute('color', new THREE.BufferAttribute(vfCol, 3));
    
    const vfMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5
    });
    
    vectorField = new THREE.LineSegments(vfGeo, vfMat);
    vectorField.position.set(-VF_W/2, 0, -VF_W/2); // центрируем сетку
    scene.add(vectorField);
    
    // Wind arrow on ground
    windArrow = new THREE.Group();
    const arrowLen = 4;
    const shaftGeo = new THREE.BoxGeometry(arrowLen, 0.05, 0.05);
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.x = arrowLen / 2;
    windArrow.add(shaft);
    
    const headGeo = new THREE.ConeGeometry(0.2, 0.5, 6);
    const headMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.x = arrowLen;
    head.rotation.z = -Math.PI / 2;
    windArrow.add(head);
    
    windArrow.position.set(-5, 0.1, -6);
    scene.add(windArrow);
    
    sceneInitialized = true;
}

function makeQuadGeometry(points) {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array(points.flatMap(p => [p.x, p.y, p.z]));
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    return geo;
}

function addPanelMesh(group, points, color, opacity = 0.95) {
    const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.1,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        opacity
    });
    const mesh = new THREE.Mesh(makeQuadGeometry(points), mat);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
}

function clearGroup(group) {
    while (group.children.length) {
        const child = group.children.pop();
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
}

function buildParametricPlaneModel(config) {
    if (!planeMesh) {
        planeMesh = new THREE.Group();
        scene.add(planeMesh);
    }

    clearGroup(planeMesh);

    const wingX = config.cgX - config.wingX;
    const tailX = config.cgX - config.tailX;
    const finX = config.cgX - config.finX;
    const halfSpan = config.span / 2;
    const sweepOffset = Math.tan(config.sweep * DEG2RAD) * halfSpan;
    const dihedralRise = Math.tan(config.dihedral * DEG2RAD) * halfSpan;
    const root = config.rootChord;
    const tip = config.tipChord;
    const rootLE = wingX - root * 0.25;
    const rootTE = wingX + root * 0.75;
    const tipLE = rootLE - sweepOffset;
    const tipTE = tipLE + tip;

    addPanelMesh(planeMesh, [
        { x: rootLE, y: 0, z: 0 },
        { x: tipLE, y: dihedralRise, z: -halfSpan },
        { x: tipTE, y: dihedralRise, z: -halfSpan },
        { x: rootTE, y: 0, z: 0 }
    ], 0xff5f7c);

    addPanelMesh(planeMesh, [
        { x: rootLE, y: 0, z: 0 },
        { x: rootTE, y: 0, z: 0 },
        { x: tipTE, y: dihedralRise, z: halfSpan },
        { x: tipLE, y: dihedralRise, z: halfSpan }
    ], 0xff5f7c);

    const tailSpan = config.tailSpan;
    const tailHalf = tailSpan / 2;
    const tailRoot = config.tailRootChord;
    const tailTip = config.tailTipChord;
    const tailSweepOffset = Math.tan(config.tailSweep * DEG2RAD) * tailHalf;
    const tailLE = tailX - tailRoot * 0.25;
    const tailTE = tailX + tailRoot * 0.75;
    const tailTipLE = tailLE - tailSweepOffset;
    const tailTipTE = tailTipLE + tailTip;
    const tailRise = Math.tan((config.tailDihedral || 0) * DEG2RAD) * tailHalf;

    if (config.tailMode === 'vTail') {
        addPanelMesh(planeMesh, [
            { x: tailLE, y: 0.015, z: 0 },
            { x: tailTipLE, y: 0.015 + tailRise, z: -tailHalf },
            { x: tailTipTE, y: 0.015 + tailRise, z: -tailHalf },
            { x: tailTE, y: 0.015, z: 0 }
        ], 0x4ecca3, 0.85);

        addPanelMesh(planeMesh, [
            { x: tailLE, y: 0.015, z: 0 },
            { x: tailTE, y: 0.015, z: 0 },
            { x: tailTipTE, y: 0.015 + tailRise, z: tailHalf },
            { x: tailTipLE, y: 0.015 + tailRise, z: tailHalf }
        ], 0x4ecca3, 0.85);
    } else {
        addPanelMesh(planeMesh, [
            { x: tailLE, y: 0.015, z: -tailHalf },
            { x: tailTipLE, y: 0.015, z: -tailHalf },
            { x: tailTipTE, y: 0.015, z: tailHalf },
            { x: tailTE, y: 0.015, z: tailHalf }
        ], 0x4ecca3, 0.85);
    }

    const finHeight = config.finHeight;
    const finRoot = config.finRootChord;
    const finTip = config.finTipChord;
    if (finHeight > 0.001) {
        addPanelMesh(planeMesh, [
            { x: finX - finRoot * 0.2, y: 0.015, z: 0 },
            { x: finX - finTip * 0.25, y: 0.015 + finHeight, z: 0 },
            { x: finX + finTip * 0.75, y: 0.015 + finHeight * 0.65, z: 0 },
            { x: finX + finRoot * 0.75, y: 0.015, z: 0 }
        ], 0x4ecca3, 0.85);
    }

    const bodyTailX = config.cgX - config.fuselageLength;
    const bodyNoseX = config.cgX;
    const bodyLen = Math.max(0.05, bodyNoseX - bodyTailX);
    const bodyGeo = new THREE.BoxGeometry(bodyLen, 0.012, 0.012);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set((bodyNoseX + bodyTailX) / 2, 0, 0);
    body.castShadow = true;
    planeMesh.add(body);

    const cgGeo = new THREE.SphereGeometry(0.012, 12, 8);
    const cgMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const cg = new THREE.Mesh(cgGeo, cgMat);
    cg.position.set(0, 0.02, 0);
    planeMesh.add(cg);
}

function refreshDesignModel() {
    if (!sceneInitialized || !planeMesh || typeof buildAircraftConfig !== 'function') return;
    const config = buildAircraftConfig(params.mass, params.area, params.CL, params.CD);
    if (typeof plane !== 'undefined' && plane && !isRunning) {
        plane.config = config;
    }
    buildParametricPlaneModel(config);
    planeDesignKey = JSON.stringify({
        cgX: config.cgX,
        wingX: config.wingX,
        span: config.span,
        rootChord: config.rootChord,
        tipChord: config.tipChord,
        sweep: config.sweep,
        fuselageLength: config.fuselageLength,
        tailX: config.tailX,
        finX: config.finX,
        tailSpan: config.tailSpan,
        tailRootChord: config.tailRootChord,
        tailTipChord: config.tailTipChord,
        finHeight: config.finHeight,
        finRootChord: config.finRootChord,
        finTipChord: config.finTipChord,
        tailSweep: config.tailSweep,
        dihedral: config.dihedral
    });
}

function createPlaneModel() {
    planeMesh = new THREE.Group();
    scene.add(planeMesh);
}

// ==========================================
// PHYSICS - 3D
// ==========================================

function updateScene() {
    // Animate vector field with time
    if (vectorField) {
        recomputeVectorField(Date.now() * 0.001);
    }
    
    if (!plane || !planeMesh) return;
    const nextDesignKey = JSON.stringify({
        cgX: plane.config.cgX,
        wingX: plane.config.wingX,
        span: plane.config.span,
        rootChord: plane.config.rootChord,
        tipChord: plane.config.tipChord,
        sweep: plane.config.sweep,
        fuselageLength: plane.config.fuselageLength,
        tailX: plane.config.tailX,
        finX: plane.config.finX,
        tailSpan: plane.config.tailSpan,
        tailRootChord: plane.config.tailRootChord,
        tailTipChord: plane.config.tailTipChord,
        finHeight: plane.config.finHeight,
        finRootChord: plane.config.finRootChord,
        finTipChord: plane.config.finTipChord,
        tailSweep: plane.config.tailSweep,
        dihedral: plane.config.dihedral
    });
    if (nextDesignKey !== planeDesignKey) {
        buildParametricPlaneModel(plane.config);
        planeDesignKey = nextDesignKey;
    }
    
    // Update plane position в 3D
    planeMesh.position.set(plane.x, plane.y, plane.z);
    planeMesh.visible = true;
    
    // Orient plane along velocity в 3D
    if (plane.qrot && planeMesh.quaternion) {
        planeMesh.quaternion.set(plane.qrot.x, plane.qrot.y, plane.qrot.z, plane.qrot.w);
    } else if (plane.getSpeed() > 0.1) {
        const yaw = plane.getYaw();
        const pitch = plane.getPitch();
        
        planeMesh.rotation.y = -yaw;
        planeMesh.rotation.z = pitch;
        planeMesh.rotation.x = 0;
    }
    
    // Update trail в 3D
    if (plane.trail.length > 1) {
        const points = plane.trail.map(p => new THREE.Vector3(p.x, p.y, p.z));
        trailLine.geometry.setFromPoints(points);
    }
    
    // Camera follows plane smoothly
    if (isRunning) {
        controls.target.lerp(new THREE.Vector3(plane.x * 0.5, plane.y * 0.3 + 5, plane.z * 0.5), 0.02);
    }
    // Wind arrow
    if (windArrow) {
        if (params.wind !== 0) {
            windArrow.visible = true;
            windArrow.rotation.y = params.wind > 0 ? 0 : Math.PI;
            windArrow.position.set(-5, 0.1, -6);
        } else {
            windArrow.visible = false;
        }
    }
}

// ========== VECTOR FIELD UPDATE ==========

function recomputeVectorField(time) {
    if (!vectorField) return;
    time = time || 0;
    
    const pos = vectorField.geometry.attributes.position.array;
    const col = vectorField.geometry.attributes.color.array;
    
    for (let ix = 0; ix < VF_NX; ix++) {
        for (let iy = 0; iy < VF_NY; iy++) {
            for (let iz = 0; iz < VF_NZ; iz++) {
                const gx = ix * VF_STEP;
                const gy = iy * VF_STEP;
                const gz = iz * VF_STEP;
                const idx = (ix * VF_NY * VF_NZ) + (iy * VF_NZ) + iz;
                
                const flow = airflowVelocityAt(gx, gy, gz, time);
                const fx = flow.x;
                const fy = flow.y;
                const fz = flow.z;
                
                const len = Math.sqrt(fx*fx + fy*fy + fz*fz);
                const scale = 0.6;
                const mag = Math.min(len / 2.5, 1);
                
                pos[idx*6] = gx;
                pos[idx*6+1] = gy;
                pos[idx*6+2] = gz;
                pos[idx*6+3] = gx + fx * scale;
                pos[idx*6+4] = gy + fy * scale;
                pos[idx*6+5] = gz + fz * scale;
                
                const r = mag;
                const g = 0.2 + (1-mag) * 0.5;
                const b = 0.2 + (1-mag) * 0.5;
                for (let k = 0; k < 6; k += 3) {
                    col[idx*6+k] = r;
                    col[idx*6+k+1] = g;
                    col[idx*6+k+2] = b;
                }
            }
        }
    }
    
    vectorField.geometry.attributes.position.needsUpdate = true;
    vectorField.geometry.attributes.color.needsUpdate = true;
}

// Resize handler
window.addEventListener('resize', () => {
    const container = document.getElementById('scene-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
