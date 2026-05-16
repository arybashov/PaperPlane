// ==========================================
// AIRCRAFT CONSTRUCTOR PHYSICS
// ==========================================

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const RHO = 1.225; // kg/m^3
const G = 9.81;
const AIR_KINEMATIC_VISCOSITY = 1.5e-5; // m^2/s near sea level

const BOO_SLOPE_800_PARAMS = Object.freeze({
    mass: 170,
    area: 7.8,
    CL: 0.50,
    CD: 0.15,
    airfoil: 'e387Uiuc200k',
    wingLE: 0.160,
    cgFromWingLE: 0.039,
    wingSpan: 0.80,
    rootChord: 0.115,
    tipChord: 0.080,
    sweep: 0,
    fuselageLength: 0.485,
    tailX: 0.455,
    finX: 0.435,
    tailSpan: 0.250,
    tailRootChord: 0.070,
    tailTipChord: 0.045,
    finHeight: 0.000,
    finRootChord: 0.060,
    finTipChord: 0.035,
    tailSweep: 0,
    tailMode: 'vTail',
    tailDihedral: 40,
    wingIncidence: 0.0,
    tailIncidence: -0.5,
    dihedral: 8.0,
    cgMode: 'calculated',
    noseMass: 47,
    wingMass: 60,
    fuselageMass: 45,
    tailMass: 18,
    finMass: 0,
    noseMassX: 0.058
});

const AIRCRAFT_PRESETS = Object.freeze({
    booSlope800: Object.freeze({
        label: 'BOO Slope Glider 800 mm',
        note: 'Robbe BOO baseline: 800 mm span, 485 mm length, 170 g, 7.8 dm2 wing, CG 39 mm from wing LE, V-tail, E387 UIUC low-Re polar.',
        params: BOO_SLOPE_800_PARAMS
    })
});

let params = {
    v0: 12,
    angle: 5,
    h0: 2,
    wind: 0.0,
    turb: 0,
    thermal: 0,
    ...BOO_SLOPE_800_PARAMS,
    preset: 'booSlope800',
    shape: 'custom'
};

const AIRFOILS = {
    flatPlate: {
        name: 'Flat plate',
        clAlpha: 4.8,
        clMax: 0.95,
        alphaStall: 12 * DEG2RAD,
        cd0: 0.035,
        cm0: 0.00,
        alphaZeroLift: 0
    },
    creasedPaper: {
        name: 'Creased paper',
        clAlpha: 5.2,
        clMax: 1.05,
        alphaStall: 14 * DEG2RAD,
        cd0: 0.045,
        cm0: -0.015,
        alphaZeroLift: -1.5 * DEG2RAD
    },
    camberedPlate: {
        name: 'Cambered plate',
        clAlpha: 5.6,
        clMax: 1.25,
        alphaStall: 15 * DEG2RAD,
        cd0: 0.040,
        cm0: -0.035,
        alphaZeroLift: -3.0 * DEG2RAD
    },
    naca0012: {
        name: 'NACA 0012',
        clAlpha: 6.0,
        clMax: 1.20,
        alphaStall: 15 * DEG2RAD,
        cd0: 0.020,
        cm0: 0.00,
        alphaZeroLift: 0
    },
    naca2412: {
        name: 'NACA 2412',
        clAlpha: 6.1,
        clMax: 1.45,
        alphaStall: 16 * DEG2RAD,
        cd0: 0.022,
        cm0: -0.050,
        alphaZeroLift: -2.2 * DEG2RAD
    },
    e387Uiuc200k: {
        name: 'E387 UIUC LSAT Re 200k',
        source: 'UIUC Low-Speed Airfoil Tests, E387 clean, Re about 200k',
        clAlpha: 5.6,
        clMax: 1.24,
        alphaStall: 12.2 * DEG2RAD,
        cd0: 0.010,
        cm0: -0.085,
        alphaZeroLift: -3.2 * DEG2RAD,
        polarCdIncludesInduced: false,
        polar: [
            { alpha: -6.24, CL: -0.332, CD: 0.0705, Cm: -0.0328 },
            { alpha: -5.20, CL: -0.138, CD: 0.0352, Cm: -0.0824 },
            { alpha: -4.17, CL: -0.015, CD: 0.0192, Cm: -0.0917 },
            { alpha: -3.14, CL: 0.081, CD: 0.0150, Cm: -0.0868 },
            { alpha: -2.14, CL: 0.178, CD: 0.0125, Cm: -0.0886 },
            { alpha: -1.09, CL: 0.271, CD: 0.0102, Cm: -0.0842 },
            { alpha: -0.05, CL: 0.381, CD: 0.0104, Cm: -0.0852 },
            { alpha: 0.97, CL: 0.483, CD: 0.0110, Cm: -0.0852 },
            { alpha: 2.01, CL: 0.593, CD: 0.0118, Cm: -0.0829 },
            { alpha: 3.00, CL: 0.698, CD: 0.0126, Cm: -0.0837 },
            { alpha: 4.09, CL: 0.806, CD: 0.0134, Cm: -0.0817 },
            { alpha: 5.02, CL: 0.902, CD: 0.0138, Cm: -0.0817 },
            { alpha: 6.09, CL: 1.017, CD: 0.0140, Cm: -0.0799 },
            { alpha: 7.14, CL: 1.119, CD: 0.0149, Cm: -0.0780 },
            { alpha: 8.15, CL: 1.191, CD: 0.0181, Cm: -0.0727 },
            { alpha: 9.18, CL: 1.226, CD: 0.0265, Cm: -0.0665 },
            { alpha: 10.12, CL: 1.234, CD: 0.0358, Cm: -0.0591 },
            { alpha: 11.18, CL: 1.227, CD: 0.0550, Cm: -0.0548 },
            { alpha: 12.20, CL: 1.218, CD: 0.0774, Cm: -0.0561 }
        ]
    }
};

const SHAPES = {
    dart: {
        mass: 4,
        area: 0.8,
        CL: 0.45,
        CD: 0.22,
        airfoil: 'creasedPaper',
        aspectRatio: 2.4,
        cgX: 0.08,
        wingX: 0.26,
        wingSpan: 0.18,
        rootChord: 0.075,
        tipChord: 0.030,
        sweep: 28,
        fuselageLength: 0.80,
        tailX: 0.74,
        finX: 0.70,
        tailShare: 0.10,
        finShare: 0.05,
        tailSweep: 8,
        wingIncidence: 3,
        tailIncidence: -2,
        dihedral: 16
    },
    glider: {
        mass: 6,
        area: 1.5,
        CL: 0.65,
        CD: 0.10,
        airfoil: 'camberedPlate',
        aspectRatio: 5.8,
        cgX: 0.08,
        wingX: 0.26,
        wingSpan: 0.30,
        rootChord: 0.070,
        tipChord: 0.050,
        sweep: 6,
        fuselageLength: 0.80,
        tailX: 0.74,
        finX: 0.70,
        tailShare: 0.20,
        finShare: 0.07,
        tailSweep: 0,
        wingIncidence: 2.5,
        tailIncidence: -2,
        dihedral: 8
    },
    delta: {
        mass: 5,
        area: 1.2,
        CL: 0.55,
        CD: 0.15,
        airfoil: 'flatPlate',
        aspectRatio: 3.2,
        cgX: 0.08,
        wingX: 0.26,
        wingSpan: 0.24,
        rootChord: 0.095,
        tipChord: 0.025,
        sweep: 38,
        fuselageLength: 0.80,
        tailX: 0.74,
        finX: 0.70,
        tailShare: 0.08,
        finShare: 0.06,
        tailSweep: 20,
        wingIncidence: 3.5,
        tailIncidence: -2,
        dihedral: 12
    }
};

const THERMALS = [
    { x: 20, z: 0, radius: 7, strength: 1.7, height: 9 },
    { x: 45, z: 3, radius: 6, strength: 2.1, height: 11 },
    { x: 8,  z: -2, radius: 5, strength: 1.3, height: 7 }
];

const THERMAL_COLOR = 0xff6633;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function thermalVelocityAt(x, y, z, strengthScale = params.thermal ?? 0) {
    if (strengthScale <= 0 || y < 0) return vec();

    let vy = 0;
    for (const thermal of THERMALS) {
        const dx = x - thermal.x;
        const dz = z - thermal.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < thermal.radius && y < thermal.height) {
            const radial = 1 - dist / thermal.radius;
            const vertical = 1 - y / thermal.height;
            vy += thermal.strength * strengthScale * radial * radial * vertical;
        }
    }

    return vec(0, vy, 0);
}

function turbulenceVelocityAt(x, y, z, time = 0, level = params.turb ?? 0) {
    if (level <= 0) return vec();

    const heightFade = 0.35 + 0.65 * Math.exp(-Math.max(y, 0) / 10);
    const amp = level * 0.16 * heightFade;
    const p1 = x * 0.31 + y * 0.11 + z * 0.23 + time * 0.85;
    const p2 = x * 0.17 - y * 0.19 + z * 0.29 + time * 1.20;
    const p3 = x * 0.27 + y * 0.07 - z * 0.21 + time * 0.70;

    return vec(
        Math.sin(p1) * amp + Math.sin(p2 * 0.63 + 1.7) * amp * 0.35,
        Math.sin(p2 + 2.1) * amp * 0.25,
        Math.sin(p3 - 0.8) * amp * 0.60
    );
}

function airflowVelocityAt(x, y, z, time = 0) {
    const baseWind = vec(params.wind || 0, 0, 0);
    return add(
        add(baseWind, thermalVelocityAt(x, y, z)),
        turbulenceVelocityAt(x, y, z, time)
    );
}

function trapezoidMetrics(span, rootChord, tipChord, sweepDeg, leadingEdgeX) {
    const taper = clamp(tipChord / Math.max(rootChord, 1e-6), 0.01, 1);
    const mac = (2 / 3) * rootChord * ((1 + taper + taper * taper) / (1 + taper));
    const halfSpan = span / 2;
    const yMac = halfSpan * (1 + 2 * taper) / (3 * (1 + taper));
    const sweepOffset = Math.tan((sweepDeg || 0) * DEG2RAD) * yMac;
    const macLE = leadingEdgeX + sweepOffset;

    return {
        mac,
        macLE,
        rootQuarterX: leadingEdgeX + rootChord * 0.25,
        aerodynamicCenterX: macLE + mac * 0.25
    };
}

function calculateMassProperties({
    massGrams,
    wingMetrics,
    fuselageLength,
    tailX,
    tailSpan,
    tailRootChord,
    tailTipChord,
    tailSweep,
    finX,
    finSpan,
    finRootChord,
    finTipChord
}) {
    const noseMass = Math.max(params.noseMass ?? 0, 0);
    const wingMass = Math.max(params.wingMass ?? 0, 0);
    const fuselageMass = Math.max(params.fuselageMass ?? 0, 0);
    const tailMass = Math.max(params.tailMass ?? 0, 0);
    const finMass = Math.max(params.finMass ?? 0, 0);
    const noseX = clamp(params.noseMassX ?? 0.05, 0, fuselageLength);
    const fuselageX = fuselageLength * 0.48;
    const wingX = wingMetrics.macLE + wingMetrics.mac * 0.45;

    const tailLE = tailX - tailRootChord * 0.25;
    const tailMetrics = trapezoidMetrics(tailSpan, tailRootChord, tailTipChord, tailSweep, tailLE);
    const tailMassX = tailMetrics.macLE + tailMetrics.mac * 0.45;

    const finLE = finX - finRootChord * 0.25;
    const finMetrics = trapezoidMetrics(Math.max(finSpan, 0.001), finRootChord, finTipChord, tailSweep, finLE);
    const finMassX = finMetrics.macLE + finMetrics.mac * 0.45;

    let items = [
        { name: 'nose', mass: noseMass, x: noseX },
        { name: 'wing', mass: wingMass, x: wingX },
        { name: 'fuselage', mass: fuselageMass, x: fuselageX },
        { name: 'tail', mass: tailMass, x: tailMassX },
        { name: 'fin', mass: finMass, x: finMassX }
    ].filter(item => item.mass > 0);

    const rawComponentMass = items.reduce((sum, item) => sum + item.mass, 0);
    if (rawComponentMass > massGrams && massGrams > 0) {
        const scaleMass = massGrams / rawComponentMass;
        items = items.map(item => ({ ...item, mass: item.mass * scaleMass }));
    }

    const componentMass = items.reduce((sum, item) => sum + item.mass, 0);
    const residualMass = Math.max(0, (massGrams || 0) - componentMass);
    if (residualMass > 0) {
        items.push({ name: 'payload', mass: residualMass, x: noseX });
    }

    const totalMass = items.reduce((sum, item) => sum + item.mass, 0);
    const moment = items.reduce((sum, item) => sum + item.mass * item.x, 0);
    const cgX = totalMass > 0 ? moment / totalMass : wingMetrics.aerodynamicCenterX;

    return {
        cgX,
        totalMass: totalMass || massGrams,
        componentMass,
        rawComponentMass,
        residualMass,
        items,
        positions: {
            noseX,
            wingX,
            fuselageX,
            tailX: tailMassX,
            finX: finMassX
        }
    };
}

function vec(x = 0, y = 0, z = 0) {
    return { x, y, z };
}

function add(a, b) {
    return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function sub(a, b) {
    return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function scale(v, s) {
    return vec(v.x * s, v.y * s, v.z * s);
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
    return vec(
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    );
}

function length(v) {
    return Math.sqrt(dot(v, v));
}

function normalize(v) {
    const len = length(v);
    return len > 1e-8 ? scale(v, 1 / len) : vec();
}

function quat(w = 1, x = 0, y = 0, z = 0) {
    return { w, x, y, z };
}

function quatNormalize(q) {
    const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z) || 1;
    q.w /= len;
    q.x /= len;
    q.y /= len;
    q.z /= len;
    return q;
}

function quatMul(a, b) {
    return quat(
        a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    );
}

function quatFromAxisAngle(axis, angle) {
    const n = normalize(axis);
    const h = angle / 2;
    const s = Math.sin(h);
    return quat(Math.cos(h), n.x * s, n.y * s, n.z * s);
}

function quatRotate(q, v) {
    const u = vec(q.x, q.y, q.z);
    const uv = cross(u, v);
    const uuv = cross(u, uv);
    return add(v, add(scale(uv, 2 * q.w), scale(uuv, 2)));
}

function quatInverseRotate(q, v) {
    return quatRotate(quat(q.w, -q.x, -q.y, -q.z), v);
}

function rotateAroundX(v, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return vec(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
}

function makeSurfaceBasis(surface) {
    const incidence = (surface.incidence || 0) * DEG2RAD;
    const dihedral = (surface.dihedral || 0) * DEG2RAD * (surface.side || 1);

    let forward = vec(Math.cos(incidence), Math.sin(incidence), 0);
    let normal = vec(-Math.sin(incidence), Math.cos(incidence), 0);
    let span = vec(0, 0, surface.side || 1);

    if (surface.orientation === 'vertical') {
        forward = vec(Math.cos(incidence), 0, Math.sin(incidence));
        normal = vec(-Math.sin(incidence), 0, Math.cos(incidence));
        span = vec(0, 1, 0);
    } else {
        normal = rotateAroundX(normal, dihedral);
        span = rotateAroundX(span, dihedral);
    }

    return {
        forward: normalize(forward),
        normal: normalize(normal),
        span: normalize(span)
    };
}

function createWingPanels({
    name,
    x,
    y = 0,
    z = 0,
    span,
    rootChord,
    tipChord,
    sweep,
    dihedral,
    incidence,
    airfoil,
    segments = 5,
    vertical = false
}) {
    const panels = [];
    const halfSpan = span / 2;
    const sweepTan = Math.tan((sweep || 0) * DEG2RAD);
    const totalArea = span * (rootChord + tipChord) / 2;
    const fullAspectRatio = span * span / Math.max(totalArea, 1e-6);

    const sides = vertical ? [1] : [-1, 1];
    for (const side of sides) {
        for (let i = 0; i < segments; i++) {
            const a0 = i / segments;
            const a1 = (i + 1) / segments;
            const am = (a0 + a1) / 2;
            const localSpan = halfSpan * (a1 - a0);
            const chord0 = rootChord + (tipChord - rootChord) * a0;
            const chord1 = rootChord + (tipChord - rootChord) * a1;
            const chord = (chord0 + chord1) / 2;
            const area = localSpan * chord;
            const zOffset = vertical ? 0 : side * halfSpan * am;
            const yOffset = vertical
                ? halfSpan * am
                : Math.tan((dihedral || 0) * DEG2RAD) * Math.abs(zOffset);
            const leadingEdgeX = x - rootChord * 0.25 - sweepTan * halfSpan * am;
            const acX = leadingEdgeX + chord * 0.25;

            panels.push({
                name: `${name}_${side < 0 ? 'L' : 'R'}_${i}`,
                area,
                span: localSpan,
                chord,
                aspectRatio: fullAspectRatio,
                position: vec(acX, y + yOffset, z + zOffset),
                incidence,
                dihedral: vertical ? 0 : dihedral,
                sweep,
                side,
                orientation: vertical ? 'vertical' : 'horizontal',
                airfoil
            });
        }
    }

    return panels;
}

function makeWorkingAirfoil(baseName, targetCL, targetCD) {
    const base = AIRFOILS[baseName] || AIRFOILS.camberedPlate;
    if (base.polar) {
        return {
            ...base,
            polar: base.polar
                .map(point => ({ ...point, alphaRad: point.alpha * DEG2RAD }))
                .sort((a, b) => a.alpha - b.alpha)
        };
    }

    const clScale = clamp(targetCL / 0.55, 0.75, 1.25);
    return {
        name: base.name,
        clAlpha: base.clAlpha * clScale,
        clMax: Math.max(base.clMax * clScale, targetCL * 1.55),
        alphaStall: base.alphaStall,
        cd0: Math.max(0.014, Math.min(base.cd0, targetCD * 0.55)),
        cm0: base.cm0,
        alphaZeroLift: base.alphaZeroLift
    };
}

function buildAircraftConfig(massGrams, areaDm2, targetCL, targetCD) {
    const shape = SHAPES[params.shape] || {};
    const wingSpan = clamp(params.wingSpan ?? shape.wingSpan ?? 0.80, 0.10, 1.50);
    const rootChord = clamp(params.rootChord ?? (shape.rootChord ?? 0.12), 0.02, 0.35);
    const tipChord = clamp(params.tipChord ?? (shape.tipChord ?? rootChord * 0.65), 0.01, rootChord);
    const sweep = clamp(params.sweep ?? (shape.sweep ?? 10), -20, 55);
    const tailSweep = clamp(params.tailSweep ?? (shape.tailSweep ?? 0), -15, 35);
    const wingArea = wingSpan * (rootChord + tipChord) / 2;
    const aspectRatio = wingSpan * wingSpan / Math.max(wingArea, 0.0001);
    const meanChord = wingArea / wingSpan;
    const tailSpan = clamp(params.tailSpan ?? shape.tailSpan ?? 0.28, 0.04, 0.80);
    const tailRootChord = clamp(params.tailRootChord ?? shape.tailRootChord ?? 0.08, 0.015, 0.30);
    const tailTipChord = clamp(params.tailTipChord ?? shape.tailTipChord ?? tailRootChord * 0.65, 0.01, tailRootChord);
    const tailMode = params.tailMode || shape.tailMode || 'vTail';
    const rawFinSpan = clamp(params.finHeight ?? shape.finHeight ?? 0.00, 0.00, 0.50);
    const finSpan = tailMode === 'vTail' ? 0 : rawFinSpan;
    const finRootChord = clamp(params.finRootChord ?? shape.finRootChord ?? 0.10, 0.015, 0.30);
    const finTipChord = clamp(params.finTipChord ?? shape.finTipChord ?? finRootChord * 0.60, 0.01, finRootChord);
    const tailArea = tailSpan * (tailRootChord + tailTipChord) / 2;
    const finArea = finSpan * (finRootChord + finTipChord) / 2;
    const tailShare = tailArea / Math.max(wingArea, 1e-6);
    const finShare = finArea / Math.max(wingArea, 1e-6);
    const wingLE = clamp(params.wingLE ?? (shape.wingLE ?? 0.160), 0.02, 1.10);
    const wingMetrics = trapezoidMetrics(wingSpan, rootChord, tipChord, sweep, wingLE);
    const wingX = wingMetrics.rootQuarterX;
    const fuselageLength = clamp(params.fuselageLength ?? params.tailArm ?? (shape.fuselageLength || shape.tailArm || 1.05), 0.25, 1.50);
    const tailX = clamp(params.tailX ?? (shape.tailX ?? fuselageLength - 0.06), 0.08, fuselageLength);
    const finX = clamp(params.finX ?? (shape.finX ?? tailX), 0.08, fuselageLength);
    const massProps = calculateMassProperties({
        massGrams,
        wingMetrics,
        fuselageLength,
        tailX,
        tailSpan,
        tailRootChord,
        tailTipChord,
        tailSweep,
        finX,
        finSpan,
        finRootChord,
        finTipChord
    });
    const cgMode = params.cgMode || 'calculated';
    const manualCgFromWingLE = clamp(params.cgFromWingLE ?? (shape.cgFromWingLE ?? 0.039), 0.005, Math.min(rootChord * 0.95, 0.140));
    const derivedCgX = wingLE + manualCgFromWingLE;
    const cgX = cgMode === 'calculated'
        ? clamp(massProps.cgX, 0.02, Math.max(fuselageLength, wingLE + rootChord))
        : clamp(params.cgX ?? derivedCgX, 0.02, 1.10);
    const cgFromWingLE = cgX - wingLE;
    const cgPercent = ((cgX - wingMetrics.macLE) / Math.max(wingMetrics.mac, 1e-6)) * 100;
    const effectiveMassGrams = cgMode === 'calculated' ? massProps.totalMass : massGrams;
    const wingIncidence = params.wingIncidence ?? (shape.wingIncidence ?? (1.5 + targetCL * 3.0));
    const tailIncidence = params.tailIncidence ?? (shape.tailIncidence ?? -3.5);
    const tailDihedral = tailMode === 'vTail'
        ? clamp(params.tailDihedral ?? (shape.tailDihedral ?? 40), 0, 65)
        : 0;
    const dihedral = params.dihedral ?? (shape.dihedral ?? 10);
    const airfoil = params.airfoil || shape.airfoil || 'camberedPlate';
    const pitchTailArea = tailMode === 'vTail'
        ? tailArea * Math.pow(Math.cos(tailDihedral * DEG2RAD), 2)
        : tailArea;
    const tailArm = tailX - cgX;
    const tailVolume = pitchTailArea * Math.max(tailArm, 0) / Math.max(wingArea * wingMetrics.mac, 1e-6);
    const neutralPointX = wingMetrics.aerodynamicCenterX + wingMetrics.mac * clamp(0.72 * tailVolume, 0, 0.65);
    const staticMargin = ((neutralPointX - cgX) / Math.max(wingMetrics.mac, 1e-6)) * 100;
    const finSurfaces = finSpan > 1e-4
        ? createWingPanels({
            name: 'fin',
            x: cgX - finX,
            y: 0.02,
            span: finSpan,
            rootChord: finRootChord,
            tipChord: finTipChord,
            sweep: tailSweep,
            dihedral: 0,
            incidence: 0,
            airfoil: 'naca0012',
            segments: 3,
            vertical: true
        })
        : [];

    return {
        mass: effectiveMassGrams / 1000,
        requestedMass: massGrams / 1000,
        cgX,
        cgFromWingLE,
        cgPercent,
        cgMode,
        massProps,
        wingLE,
        wingX,
        mac: wingMetrics.mac,
        macLE: wingMetrics.macLE,
        aerodynamicCenterX: wingMetrics.aerodynamicCenterX,
        rootChord,
        tipChord,
        sweep,
        fuselageLength,
        tailX,
        finX,
        tailArm,
        tailShare,
        finShare,
        tailVolume,
        pitchTailArea,
        neutralPointX,
        staticMargin,
        tailSpan,
        tailRootChord,
        tailTipChord,
        finHeight: finSpan,
        finRootChord,
        finTipChord,
        tailSweep,
        tailMode,
        tailDihedral,
        wingIncidence,
        tailIncidence,
        dihedral,
        length: fuselageLength,
        span: wingSpan,
        chord: meanChord,
        wingArea,
        tailArea,
        finArea,
        airfoil,
        workingAirfoil: makeWorkingAirfoil(airfoil, targetCL, targetCD),
        surfaces: [
            ...createWingPanels({
                name: 'wing',
                x: cgX - wingX,
                span: wingSpan,
                rootChord,
                tipChord,
                sweep,
                dihedral,
                incidence: wingIncidence,
                airfoil,
                segments: 5
            }),
            ...createWingPanels({
                name: 'tail',
                x: cgX - tailX,
                y: 0.015,
                span: tailSpan,
                rootChord: tailRootChord,
                tipChord: tailTipChord,
                sweep: tailSweep,
                dihedral: tailDihedral,
                incidence: tailIncidence,
                airfoil: 'flatPlate',
                segments: 3
            }),
            ...finSurfaces
        ]
    };
}

class PaperPlane {
    constructor(v0, angleDeg, h0, mass, area, CL, CD) {
        this.config = buildAircraftConfig(mass, area, CL, CD);
        this.m = this.config.mass;
        this.S = this.config.wingArea;
        this.CL = CL;
        this.CD = CD;

        this.x = 0;
        this.y = h0;
        this.z = 0;
        this.vx = v0 * Math.cos(angleDeg * DEG2RAD);
        this.vy = v0 * Math.sin(angleDeg * DEG2RAD);
        this.vz = 0;

        this.qrot = quatFromAxisAngle(vec(0, 0, 1), angleDeg * DEG2RAD);
        this.omega = vec(0, 0, 0);
        this.inertia = this.estimateInertia();

        this.alpha = 0;
        this.gamma = angleDeg * DEG2RAD;
        this.CLNow = CL;
        this.CDNow = CD;
        this.liftNow = 0;
        this.dragNow = 0;
        this.ldNow = 0;
        this.reNow = 0;
        this.wingLiftNow = 0;
        this.tailLiftNow = 0;
        this.finLiftNow = 0;
        this.wingDragNow = 0;
        this.tailDragNow = 0;
        this.pitchMomentNow = 0;
        this.airflowNow = vec();
        this.turbMem = vec();

        this.trail = [{ x: this.x, y: this.y, z: this.z }];
        this.t = 0;
        this.yMax = h0;
        this.vMax = v0;
        this.landed = false;
    }

    estimateInertia() {
        const m = this.m;
        const span = this.config.span;
        const length = this.config.length;
        const thickness = Math.max(this.config.chord * 0.18, 0.015);
        return vec(
            Math.max(m * (span * span + thickness * thickness) / 12, 1e-6),
            Math.max(m * (length * length + thickness * thickness) / 12, 1e-6),
            Math.max(m * (length * length + span * span) / 12, 1e-6)
        );
    }

    getSpeed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    }

    getV() {
        return this.getSpeed();
    }

    getForwardWorld() {
        return quatRotate(this.qrot, vec(1, 0, 0));
    }

    getYaw() {
        const f = this.getForwardWorld();
        return Math.atan2(f.z, f.x);
    }

    getPitch() {
        const f = this.getForwardWorld();
        return Math.atan2(f.y, Math.sqrt(f.x * f.x + f.z * f.z));
    }

    getCL(alpha) {
        const foil = this.config.workingAirfoil;
        return this.airfoilCoefficients(foil, alpha, 4).CL;
    }

    getCD(CL, alpha = this.alpha) {
        const foil = this.config.workingAirfoil;
        return this.airfoilCoefficients(foil, alpha, 4).CD;
    }

    getWingLoading() {
        return (this.m * 1000) / Math.max(this.S * 100, 1e-6);
    }

    getStallSpeed() {
        const clMax = Math.max(this.config.workingAirfoil.clMax, 0.1);
        return Math.sqrt((2 * this.m * G) / (RHO * Math.max(this.S, 1e-6) * clMax));
    }

    getStaticMargin() {
        return this.config.staticMargin;
    }

    getTailVolume() {
        return this.config.tailVolume;
    }

    interpolatePolar(foil, alphaDeg) {
        const polar = foil.polar;
        if (!polar || polar.length === 0) return null;

        if (alphaDeg <= polar[0].alpha) return { ...polar[0], extrapolated: true };
        if (alphaDeg >= polar[polar.length - 1].alpha) return { ...polar[polar.length - 1], extrapolated: true };

        for (let i = 0; i < polar.length - 1; i++) {
            const a = polar[i];
            const b = polar[i + 1];
            if (alphaDeg >= a.alpha && alphaDeg <= b.alpha) {
                const t = (alphaDeg - a.alpha) / Math.max(b.alpha - a.alpha, 1e-6);
                return {
                    alpha: alphaDeg,
                    CL: a.CL + (b.CL - a.CL) * t,
                    CD: a.CD + (b.CD - a.CD) * t,
                    Cm: a.Cm + (b.Cm - a.Cm) * t,
                    extrapolated: false
                };
            }
        }

        return { ...polar[polar.length - 1], extrapolated: true };
    }

    tabularAirfoilCoefficients(foil, alpha, aspectRatio) {
        const alphaDeg = alpha * RAD2DEG;
        const sample = this.interpolatePolar(foil, alphaDeg);
        if (!sample) return null;

        let CL = sample.CL;
        let CD = sample.CD;
        let Cm = sample.Cm;

        if (sample.extrapolated) {
            const edgeAlpha = sample.alpha;
            const excessDeg = Math.abs(alphaDeg - edgeAlpha);
            const decay = clamp(1 - excessDeg / 45, 0.35, 1);
            CL *= decay;
            CD += 0.0009 * excessDeg * excessDeg;
            Cm += -0.0015 * (alphaDeg - edgeAlpha);
        }

        if (!foil.polarCdIncludesInduced) {
            CD += CL * CL / (Math.PI * 0.78 * Math.max(aspectRatio, 0.8));
        }

        return { CL, CD: Math.max(CD, 0.002), Cm };
    }

    airfoilCoefficients(foil, alpha, aspectRatio) {
        if (foil.polar) {
            const tabular = this.tabularAirfoilCoefficients(foil, alpha, aspectRatio);
            if (tabular) return tabular;
        }

        const effectiveAlpha = alpha - foil.alphaZeroLift;
        const sign = effectiveAlpha < 0 ? -1 : 1;
        const absAlpha = Math.abs(effectiveAlpha);
        const clLinear = foil.clAlpha * effectiveAlpha;
        const clAtStall = clamp(foil.clAlpha * foil.alphaStall, -foil.clMax, foil.clMax);
        let CL;

        if (absAlpha <= foil.alphaStall) {
            CL = clamp(clLinear, -foil.clMax, foil.clMax);
        } else {
            const excess = absAlpha - foil.alphaStall;
            const decay = clamp(1 - excess / (55 * DEG2RAD), 0.42, 1);
            CL = sign * Math.abs(clAtStall) * decay;
        }

        const induced = CL * CL / (Math.PI * 0.75 * Math.max(aspectRatio, 0.8));
        const stallDrag = Math.max(0, absAlpha - foil.alphaStall) / (35 * DEG2RAD);
        const CD = foil.cd0 + induced + 0.07 * stallDrag * stallDrag;
        const Cm = foil.cm0 - 0.025 * effectiveAlpha;
        return { CL, CD, Cm };
    }

    airflowAt(worldPoint) {
        return airflowVelocityAt(worldPoint.x, worldPoint.y, worldPoint.z, this.t);
    }

    computeAero() {
        let totalForce = vec(0, -this.m * G, 0);
        let totalTorque = vec();
        let alphaSum = 0;
        let clSum = 0;
        let cdSum = 0;
        let liftSum = 0;
        let dragSum = 0;
        let sampleCount = 0;
        let wingReArea = 0;
        let wingAreaSample = 0;
        let wingLift = 0;
        let tailLift = 0;
        let finLift = 0;
        let wingDrag = 0;
        let tailDrag = 0;
        let pitchMoment = 0;

        const velocity = vec(this.vx, this.vy, this.vz);
        const omegaWorld = quatRotate(this.qrot, this.omega);
        const cgWorld = vec(this.x, this.y, this.z);

        for (const surface of this.config.surfaces) {
            if (surface.area <= 0) continue;

            const basis = makeSurfaceBasis(surface);
            const rWorld = quatRotate(this.qrot, surface.position);
            const pointVelocity = add(velocity, cross(omegaWorld, rWorld));
            const pointWorld = add(cgWorld, rWorld);
            const airWorld = this.airflowAt(pointWorld);
            const relWorld = sub(pointVelocity, airWorld);
            const relBody = quatInverseRotate(this.qrot, relWorld);
            const V = length(relBody);
            if (V < 0.25) continue;

            const vDir = scale(relBody, 1 / V);
            const vForward = dot(relBody, basis.forward);
            const vNormal = dot(relBody, basis.normal);
            const alpha = clamp(Math.atan2(-vNormal, vForward), -60 * DEG2RAD, 60 * DEG2RAD);
            const foil = surface.name.startsWith('tail') || surface.name.startsWith('fin')
                ? AIRFOILS[surface.airfoil]
                : this.config.workingAirfoil;
            const aspectRatio = surface.aspectRatio ?? (surface.span * surface.span / Math.max(surface.area, 1e-5));
            const coeffs = this.airfoilCoefficients(foil, alpha, aspectRatio);
            const qdyn = 0.5 * RHO * V * V;
            const liftMag = qdyn * surface.area * coeffs.CL;
            const dragMag = qdyn * surface.area * coeffs.CD;
            let liftDir = normalize(sub(basis.normal, scale(vDir, dot(basis.normal, vDir))));

            if (length(liftDir) < 1e-6) {
                liftDir = basis.normal;
            }

            const forceBody = add(scale(liftDir, liftMag), scale(vDir, -dragMag));
            const forceWorld = quatRotate(this.qrot, forceBody);
            const momentAxis = surface.orientation === 'vertical' ? vec(0, 1, 0) : vec(0, 0, 1);
            const pitchMomentBody = scale(momentAxis, qdyn * surface.area * surface.chord * coeffs.Cm);
            const pitchMomentWorld = quatRotate(this.qrot, pitchMomentBody);
            const surfaceTorqueWorld = add(cross(rWorld, forceWorld), pitchMomentWorld);
            const surfaceTorqueBody = quatInverseRotate(this.qrot, surfaceTorqueWorld);
            const re = V * surface.chord / AIR_KINEMATIC_VISCOSITY;
            const family = surface.name.split('_')[0];

            totalForce = add(totalForce, forceWorld);
            totalTorque = add(totalTorque, surfaceTorqueWorld);
            alphaSum += alpha;
            clSum += coeffs.CL;
            cdSum += coeffs.CD;
            liftSum += liftMag;
            dragSum += dragMag;
            pitchMoment += surfaceTorqueBody.z;
            sampleCount++;

            if (family === 'wing') {
                wingLift += liftMag;
                wingDrag += dragMag;
                wingReArea += re * surface.area;
                wingAreaSample += surface.area;
            } else if (family === 'tail') {
                tailLift += liftMag;
                tailDrag += dragMag;
            } else if (family === 'fin') {
                finLift += liftMag;
            }
        }

        if (sampleCount > 0) {
            this.alpha = alphaSum / sampleCount;
            this.CLNow = clSum / sampleCount;
            this.CDNow = cdSum / sampleCount;
            this.liftNow = liftSum;
            this.dragNow = dragSum;
            this.ldNow = dragSum > 1e-6 ? liftSum / dragSum : 0;
            this.reNow = wingAreaSample > 1e-9 ? wingReArea / wingAreaSample : 0;
            this.wingLiftNow = wingLift;
            this.tailLiftNow = tailLift;
            this.finLiftNow = finLift;
            this.wingDragNow = wingDrag;
            this.tailDragNow = tailDrag;
            this.pitchMomentNow = pitchMoment;
        }

        const cgAirWorld = this.airflowAt(cgWorld);
        this.airflowNow = cgAirWorld;
        const relCgBody = quatInverseRotate(this.qrot, sub(velocity, cgAirWorld));
        const cgSpeed = length(relCgBody);
        if (cgSpeed > 0.5) {
            const qdynRef = 0.5 * RHO * cgSpeed * cgSpeed;
            const pitchDampingMoment = qdynRef * this.config.wingArea * this.config.chord * (-0.08 * this.omega.z);
            totalTorque = add(totalTorque, quatRotate(this.qrot, vec(0, 0, pitchDampingMoment)));
        }

        const lateralScale = params.turb > 0 ? 0.45 : 0.05;
        totalForce.z *= lateralScale;
        totalTorque.x *= lateralScale;
        totalTorque.y *= lateralScale;

        return { force: totalForce, torque: totalTorque };
    }

    step(dt) {
        const maxStep = 0.001;
        if (dt > maxStep) {
            const steps = Math.ceil(dt / maxStep);
            const subDt = dt / steps;
            for (let i = 0; i < steps; i++) {
                this.step(subDt);
                if (this.landed) break;
            }
            return;
        }

        this.stepOnce(dt);
    }

    stepOnce(dt) {
        if (this.landed) return;

        const { force, torque } = this.computeAero();
        const accel = scale(force, 1 / this.m);

        this.vx += accel.x * dt;
        this.vy += accel.y * dt;
        this.vz += accel.z * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;

        const torqueBody = quatInverseRotate(this.qrot, torque);
        const angularAccel = vec(
            clamp(torqueBody.x / this.inertia.x, -60, 60) * 0.22,
            clamp(torqueBody.y / this.inertia.y, -60, 60) * 0.22,
            clamp(torqueBody.z / this.inertia.z, -60, 60)
        );

        this.omega.x = clamp(this.omega.x + angularAccel.x * dt, -8, 8);
        this.omega.y = clamp(this.omega.y + angularAccel.y * dt, -8, 8);
        this.omega.z = clamp(this.omega.z + angularAccel.z * dt, -8, 8);
        const lateralDamping = Math.exp(-8.0 * dt);
        const pitchDamping = Math.exp(-4.0 * dt);
        this.omega.x *= lateralDamping;
        this.omega.y *= lateralDamping;
        this.omega.z *= pitchDamping;

        const qdot = quatMul(this.qrot, quat(0, this.omega.x, this.omega.y, this.omega.z));
        this.qrot.w += 0.5 * qdot.w * dt;
        this.qrot.x += 0.5 * qdot.x * dt;
        this.qrot.y += 0.5 * qdot.y * dt;
        this.qrot.z += 0.5 * qdot.z * dt;
        quatNormalize(this.qrot);

        this.gamma = Math.atan2(this.vy, Math.sqrt(this.vx * this.vx + this.vz * this.vz));
        this.t += dt;
        this.yMax = Math.max(this.yMax, this.y);
        this.vMax = Math.max(this.vMax, this.getSpeed());

        if (this.y <= 0) {
            this.y = 0;
            this.vy = 0;
            this.omega = vec();
            this.landed = true;
        }

        const last = this.trail[this.trail.length - 1];
        const dist = Math.sqrt((this.x - last.x) ** 2 + (this.y - last.y) ** 2 + (this.z - last.z) ** 2);
        if (dist > 0.25) {
            this.trail.push({ x: this.x, y: this.y, z: this.z });
        }
    }
}
