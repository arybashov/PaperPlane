const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPhysics() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'physics.js'), 'utf8');
    const context = { console, Math };
    vm.createContext(context);
    vm.runInContext(`${source}
this.params = params;
this.AIRFOILS = AIRFOILS;
this.AIRCRAFT_PRESETS = AIRCRAFT_PRESETS;
this.DEG2RAD = DEG2RAD;
this.RAD2DEG = RAD2DEG;
this.quatInverseRotate = quatInverseRotate;
this.airflowVelocityAt = airflowVelocityAt;
this.buildAircraftConfig = buildAircraftConfig;
this.PaperPlane = PaperPlane;
`, context);
    return context;
}

function runFlight(ctx, overrides = {}) {
    Object.assign(ctx.params, {
        wind: 0,
        turb: 0,
        thermal: 0,
        v0: 12,
        angle: 10,
        h0: 2,
        mass: 170,
        area: 7.8,
        CL: 0.50,
        CD: 0.15,
        airfoil: 'e387Uiuc200k',
        cgMode: 'calculated',
        wingLE: 0.160,
        cgFromWingLE: 0.039,
        noseMass: 47,
        wingMass: 60,
        fuselageMass: 45,
        tailMass: 18,
        finMass: 0,
        noseMassX: 0.058,
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
        tailMode: 'vTail',
        tailDihedral: 40,
        wingIncidence: 0.0,
        tailIncidence: -0.5,
        dihedral: 8.0
    }, overrides);

    const plane = new ctx.PaperPlane(
        ctx.params.v0,
        ctx.params.angle,
        ctx.params.h0,
        ctx.params.mass,
        ctx.params.area,
        ctx.params.CL,
        ctx.params.CD
    );

    const stats = {
        minVx: Infinity,
        maxPitch: -Infinity,
        minPitch: Infinity,
        maxGamma: -Infinity,
        minGamma: Infinity,
        glideGammaSum: 0,
        glideGammaCount: 0
    };

    while (!plane.landed && plane.t < 12) {
        plane.step(0.005);
        const pitch = plane.getPitch() * ctx.RAD2DEG;
        const gamma = plane.gamma * ctx.RAD2DEG;
        const pastApex = plane.t > 0.3 && plane.y < plane.yMax - 0.05;
        stats.minVx = Math.min(stats.minVx, plane.vx);
        stats.maxPitch = Math.max(stats.maxPitch, pitch);
        stats.minPitch = Math.min(stats.minPitch, pitch);
        stats.maxGamma = Math.max(stats.maxGamma, gamma);
        stats.minGamma = Math.min(stats.minGamma, gamma);
        if (pastApex && plane.y > 0.6 && plane.vx > 1) {
            stats.glideGammaSum += gamma;
            stats.glideGammaCount++;
        }
    }

    stats.avgGlideGamma = stats.glideGammaCount ? stats.glideGammaSum / stats.glideGammaCount : NaN;
    return { plane, stats };
}

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

test('constructor uses BOO-derived wing, CG, and V-tail defaults', () => {
    const ctx = loadPhysics();
    const config = ctx.buildAircraftConfig(170, 7.8, 0.50, 0.15);
    const wing = config.surfaces.find(surface => surface.name.startsWith('wing'));
    const tail = config.surfaces.find(surface => surface.name.startsWith('tail'));
    const fin = config.surfaces.find(surface => surface.name.startsWith('fin'));

    assert.equal(config.mass, 0.17);
    assert.equal(config.wingLE, 0.16);
    assert.ok(Math.abs(config.cgFromWingLE - 0.039) < 0.001, 'calculated BOO CG should stay near 39 mm from wing LE');
    assert.equal(config.cgMode, 'calculated');
    assert.equal(config.tailMode, 'vTail');
    assert.equal(config.tailDihedral, 40);
    assert.equal(config.finHeight, 0);
    assert.equal(config.wingX, 0.18875);
    assert.ok(Math.abs(config.wingArea * 100 - 7.8) < 0.01, 'BOO wing area should be about 7.8 dm2');
    assert.ok(config.cgX > config.wingLE, 'CG should be measured from the wing leading edge');
    assert.ok(config.cgX < config.tailX, 'CG should stay ahead of tail surfaces');
    assert.equal(config.tailX, 0.455);
    assert.equal(config.finX, 0.435);
    assert.equal(config.fuselageLength, 0.485);
    assert.equal(config.tailSpan, 0.25);
    assert.ok(Math.abs(wing.position.x) < 0.06, 'wing root quarter chord should stay near CG for the default glider');
    assert.ok(wing.aspectRatio > 7.5, 'wing panels should use whole-wing aspect ratio for induced drag');
    assert.ok(tail.position.x < wing.position.x, 'tail should be behind wing');
    assert.equal(fin, undefined, 'V-tail mode should not create a separate fin');
});

test('BOO preset is saved as a reusable aircraft configuration', () => {
    const ctx = loadPhysics();
    const preset = ctx.AIRCRAFT_PRESETS.booSlope800;

    assert.ok(preset, 'BOO preset should exist');
    Object.assign(ctx.params, preset.params);

    const config = ctx.buildAircraftConfig(ctx.params.mass, ctx.params.area, ctx.params.CL, ctx.params.CD);
    assert.equal(preset.params.wingSpan, 0.80);
    assert.equal(preset.params.fuselageLength, 0.485);
    assert.equal(preset.params.cgFromWingLE, 0.039);
    assert.equal(preset.params.airfoil, 'e387Uiuc200k');
    assert.equal(preset.params.cgMode, 'calculated');
    assert.equal(config.tailMode, 'vTail');
    assert.equal(config.finHeight, 0);
});

test('calculated center of mass follows component masses', () => {
    const ctx = loadPhysics();
    Object.assign(ctx.params, ctx.AIRCRAFT_PRESETS.booSlope800.params);
    const baseline = ctx.buildAircraftConfig(ctx.params.mass, ctx.params.area, ctx.params.CL, ctx.params.CD);

    ctx.params.noseMass += 20;
    const noseHeavy = ctx.buildAircraftConfig(ctx.params.mass, ctx.params.area, ctx.params.CL, ctx.params.CD);

    ctx.params.tailMass += 20;
    const tailHeavy = ctx.buildAircraftConfig(ctx.params.mass, ctx.params.area, ctx.params.CL, ctx.params.CD);

    assert.ok(Math.abs(baseline.cgFromWingLE - 0.039) < 0.001, 'baseline calculated CG should match BOO reference');
    assert.ok(noseHeavy.cgX < baseline.cgX, 'adding nose mass should move CG forward');
    assert.ok(tailHeavy.cgX > noseHeavy.cgX, 'adding tail mass should move CG aft');
    assert.ok(baseline.massProps.items.some(item => item.name === 'wing'), 'mass breakdown should include wing contribution');
});

test('tail and optional fin use their own airfoils during force calculation', () => {
    const ctx = loadPhysics();
    Object.assign(ctx.params, { wind: 0, turb: 0, thermal: 0, tailMode: 'conventional', finHeight: 0.08 });
    const plane = new ctx.PaperPlane(12, 10, 2, 170, 7.8, 0.50, 0.15);
    const usedFoils = new Set();
    const original = plane.airfoilCoefficients.bind(plane);

    plane.airfoilCoefficients = (foil, alpha, aspectRatio) => {
        usedFoils.add(foil.name);
        return original(foil, alpha, aspectRatio);
    };

    plane.computeAero();
    assert.ok(usedFoils.has('Flat plate'), 'tail surfaces should use flat-plate airfoil');
    assert.ok(usedFoils.has('NACA 0012'), 'vertical fin should use symmetric fin airfoil');
});

test('airfoil curves stay finite, monotonic near zero, and drag-positive', () => {
    const ctx = loadPhysics();
    const plane = new ctx.PaperPlane(12, 10, 2, 90, 8.0, 0.50, 0.15);
    const foil = ctx.AIRFOILS.camberedPlate;
    const low = plane.airfoilCoefficients(foil, -4 * ctx.DEG2RAD, 4);
    const zero = plane.airfoilCoefficients(foil, 0, 4);
    const high = plane.airfoilCoefficients(foil, 6 * ctx.DEG2RAD, 4);
    const stalled = plane.airfoilCoefficients(foil, 35 * ctx.DEG2RAD, 4);

    for (const coeffs of [low, zero, high, stalled]) {
        assert.ok(Number.isFinite(coeffs.CL));
        assert.ok(Number.isFinite(coeffs.CD));
        assert.ok(coeffs.CD > 0);
        assert.ok(Math.abs(coeffs.CL) < 2.0);
    }

    assert.ok(low.CL < zero.CL);
    assert.ok(zero.CL < high.CL);
    assert.ok(stalled.CD > high.CD);
});

test('UIUC tabular polar is interpolated and keeps induced drag separate', () => {
    const ctx = loadPhysics();
    const plane = new ctx.PaperPlane(12, 10, 2, 170, 7.8, 0.50, 0.15);
    const foil = ctx.AIRFOILS.e387Uiuc200k;
    const section = plane.airfoilCoefficients(foil, 3 * ctx.DEG2RAD, 1000);
    const wing = plane.airfoilCoefficients(foil, 3 * ctx.DEG2RAD, 8);
    const postStall = plane.airfoilCoefficients(foil, 25 * ctx.DEG2RAD, 8);

    assert.ok(Math.abs(section.CL - 0.698) < 0.01, 'CL should come from the UIUC polar table');
    assert.ok(Math.abs(section.CD - 0.0126) < 0.002, 'high-AR CD should stay close to section drag');
    assert.ok(wing.CD > section.CD + 0.015, 'finite wing should add induced drag on top of section CD');
    assert.ok(postStall.CD > wing.CD, 'extrapolated post-stall drag should rise');
});

test('airflow model separates turbulence from sustained updraft', () => {
    const ctx = loadPhysics();

    Object.assign(ctx.params, { wind: 0, turb: 0, thermal: 0 });
    const calm = ctx.airflowVelocityAt(8, 2, -2, 1);

    Object.assign(ctx.params, { wind: 0, turb: 5, thermal: 0 });
    const gust = ctx.airflowVelocityAt(8, 2, -2, 1);

    Object.assign(ctx.params, { wind: 0, turb: 0, thermal: 2 });
    const updraft = ctx.airflowVelocityAt(8, 2, -2, 1);

    assert.ok(Math.abs(calm.x) + Math.abs(calm.y) + Math.abs(calm.z) < 1e-9);
    assert.ok(Math.abs(gust.x) + Math.abs(gust.y) + Math.abs(gust.z) > 0.2, 'turbulence should create local gust velocity');
    assert.ok(updraft.y > 1.0, 'thermal setting should create sustained vertical air velocity');
});

test('thermal updraft extends flight, while turbulence alone does not act as lift', () => {
    const base = runFlight(loadPhysics(), { angle: 5 });
    const gust = runFlight(loadPhysics(), { angle: 5, turb: 5 });
    const lift = runFlight(loadPhysics(), { angle: 5, thermal: 4 });

    assert.ok(gust.plane.yMax < base.plane.yMax + 1.0, 'zero-mean turbulence should not become a hidden thermal');
    assert.ok(lift.plane.t > base.plane.t + 0.5, 'updraft should extend time aloft');
    assert.ok(lift.plane.x > base.plane.x + 5, 'updraft should extend range');
});

test('calm-air baseline flights do not loop, reverse, or climb unrealistically', () => {
    for (const angle of [0, 5, 10, 15]) {
        const ctx = loadPhysics();
        const { plane, stats } = runFlight(ctx, { angle });

        assert.ok(plane.landed, `angle ${angle}: should land within test horizon`);
        assert.ok(plane.x > 6, `angle ${angle}: should make forward range`);
        assert.ok(stats.minVx > 0.5, `angle ${angle}: should not reverse direction`);
        assert.ok(plane.yMax < ctx.params.h0 + 3.5, `angle ${angle}: climb is too large`);
        assert.ok(stats.maxPitch < angle + 20, `angle ${angle}: pitch-up overshoot is too large`);
        assert.ok(stats.maxGamma < angle + 20, `angle ${angle}: flight-path climb is too large`);
        if (angle <= 5) {
            assert.ok(stats.avgGlideGamma > -22, `angle ${angle}: average glide path is too steep`);
        }
        assert.ok(stats.maxPitch - stats.minPitch < 95, `angle ${angle}: pitch excursion suggests a loop`);
    }
});

test('geometry sensitivity stays sane when CG, wing, and tail stations move independently', () => {
    const cases = [
        { cgMode: 'manual', cgFromWingLE: 0.030 },
        { cgMode: 'manual', cgFromWingLE: 0.045 },
        { cgMode: 'manual', wingLE: 0.12 },
        { cgMode: 'manual', wingLE: 0.26 },
        { tailX: 0.42 },
        { tailMode: 'conventional', finHeight: 0.08 },
        { tailSpan: 0.32 },
        { tailDihedral: 45 }
    ];

    for (const overrides of cases) {
        const ctx = loadPhysics();
        const { plane, stats } = runFlight(ctx, overrides);
        assert.ok(plane.landed, `${JSON.stringify(overrides)}: should land`);
        assert.ok(plane.x > 5, `${JSON.stringify(overrides)}: should retain forward range`);
        assert.ok(stats.minVx > 0.3, `${JSON.stringify(overrides)}: should not fly backward`);
        assert.ok(plane.yMax < ctx.params.h0 + 4.5, `${JSON.stringify(overrides)}: climb is too large`);
    }
});

test('BOO default has glider-like range from a hand launch', () => {
    const ctx = loadPhysics();
    const { plane, stats } = runFlight(ctx, { angle: 5 });

    assert.ok(plane.x > 30, `default range is too short: ${plane.x.toFixed(1)} m`);
    assert.ok(plane.t > 3.4, `default flight time is too short: ${plane.t.toFixed(2)} s`);
    assert.ok(stats.avgGlideGamma > -12, `default glide path is too steep: ${stats.avgGlideGamma.toFixed(1)} deg`);
});

test('BOO default stall speed and wing loading stay in a plausible range', () => {
    const ctx = loadPhysics();
    const plane = new ctx.PaperPlane(12, 5, 2, 170, 7.8, 0.50, 0.15);

    assert.ok(plane.getStallSpeed() > 5.0, 'stall speed should not be unrealistically low');
    assert.ok(plane.getStallSpeed() < 7.0, 'stall speed should not be unrealistically high');
    assert.ok(Math.abs(plane.getWingLoading() - 21.8) < 0.5, 'wing loading should match BOO geometry and mass');
});

test('BOO diagnostics expose Reynolds number and stability metrics', () => {
    const ctx = loadPhysics();
    const plane = new ctx.PaperPlane(12, 5, 2, 170, 7.8, 0.50, 0.15);
    plane.computeAero();

    assert.ok(plane.reNow > 50000, `wing Reynolds number is too low: ${plane.reNow}`);
    assert.ok(plane.reNow < 140000, `wing Reynolds number is too high: ${plane.reNow}`);
    assert.ok(plane.getTailVolume() > 0.15, 'tail volume should be positive for BOO V-tail');
    assert.ok(plane.getTailVolume() < 0.50, 'tail volume estimate should stay plausible');
    assert.ok(plane.getStaticMargin() > -5, 'static margin should not be wildly unstable');
    assert.ok(plane.getStaticMargin() < 30, 'static margin should not be unrealistically high');
    assert.ok(Math.abs(plane.wingLiftNow) > Math.abs(plane.tailLiftNow), 'wing should dominate lift in trimmed flight');
    assert.ok(Number.isFinite(plane.pitchMomentNow));
});

test('longitudinal model has no hidden alpha-hold trim moment', () => {
    const ctx = loadPhysics();
    Object.assign(ctx.params, {
        wind: 0,
        turb: 0,
        thermal: 0,
        cgMode: 'manual',
        tailIncidence: -0.5,
        cgFromWingLE: 0.039
    });

    const plane = new ctx.PaperPlane(12, 5, 2, 170, 7.8, 0.50, 0.15);
    const still = ctx.quatInverseRotate(plane.qrot, plane.computeAero().torque).z;
    plane.omega.z = 0.5;
    const damped = ctx.quatInverseRotate(plane.qrot, plane.computeAero().torque).z;

    assert.ok(damped < still, 'extra longitudinal helper should only damp pitch rate, not hold alpha');
});

test('moving CG aft makes the static pitch moment more nose-up', () => {
    const ctx = loadPhysics();

    function pitchMoment(cgFromWingLE) {
        Object.assign(ctx.params, {
            wind: 0,
            turb: 0,
            thermal: 0,
            cgMode: 'manual',
            angle: 5,
            cgX: undefined,
            cgFromWingLE,
            wingIncidence: 0,
            tailIncidence: -0.5
        });
        const plane = new ctx.PaperPlane(
            ctx.params.v0,
            ctx.params.angle,
            ctx.params.h0,
            ctx.params.mass,
            ctx.params.area,
            ctx.params.CL,
            ctx.params.CD
        );
        return ctx.quatInverseRotate(plane.qrot, plane.computeAero().torque).z;
    }

    const neutral = pitchMoment(0.030);
    const aft = pitchMoment(0.065);
    assert.ok(aft > neutral, 'aft CG should increase nose-up pitch moment');
    assert.ok(aft > 0, 'CG clearly aft of the wing should produce a nose-up moment');
});

test('mass changes sink behavior through wing loading, not only range', () => {
    const ctx = loadPhysics();

    function flightForMass(mass) {
        const scale = mass / 170;
        const { plane, stats } = runFlight(ctx, {
            mass,
            angle: 5,
            noseMass: 47 * scale,
            wingMass: 60 * scale,
            fuselageMass: 45 * scale,
            tailMass: 18 * scale
        });
        return { plane, stats };
    }

    const light = flightForMass(100);
    const nominal = flightForMass(170);
    const heavy = flightForMass(260);

    assert.ok(Math.abs(light.plane.x - nominal.plane.x) > 0.5, 'mass should change range, not only labels');
    assert.ok(light.plane.yMax > nominal.plane.yMax, 'light aircraft should climb more under the same launch');
    assert.ok(light.plane.getSpeed() < nominal.plane.getSpeed(), 'light aircraft should bleed more speed');
    assert.ok(heavy.plane.yMax < nominal.plane.yMax, 'heavy aircraft should climb less than nominal');
    assert.ok(heavy.plane.t < nominal.plane.t, 'heavy aircraft should have shorter time aloft under the same launch');
    assert.ok(heavy.plane.getSpeed() > nominal.plane.getSpeed(), 'heavy aircraft should retain more speed');
});

test('maximum wing geometry remains numerically stable for low mass', () => {
    const ctx = loadPhysics();
    const { plane, stats } = runFlight(ctx, {
        mass: 40,
        wingSpan: 1.50,
        rootChord: 0.35,
        tipChord: 0.30,
        angle: 5
    });

    assert.ok(Number.isFinite(plane.x));
    assert.ok(Number.isFinite(plane.y));
    assert.ok(Number.isFinite(plane.getSpeed()));
    assert.ok(plane.getSpeed() < 100, 'extreme wing should not create numerical speed explosion');
    assert.ok(stats.minVx > -0.2, 'drag should not pull the aircraft backward in calm air');
});
