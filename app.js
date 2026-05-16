let plane = null;
let isRunning = false;
let isPaused = false;
let lastTime = 0;
let isApplyingPreset = false;

const AIRCRAFT_PARAM_IDS = new Set([
    'mass',
    'cgFromWingLE',
    'wingLE',
    'wingSpan',
    'rootChord',
    'tipChord',
    'sweep',
    'fuselageLength',
    'tailX',
    'finX',
    'tailSpan',
    'tailRootChord',
    'tailTipChord',
    'finHeight',
    'finRootChord',
    'finTipChord',
    'tailSweep',
    'wingIncidence',
    'tailIncidence',
    'dihedral',
    'noseMass',
    'wingMass',
    'fuselageMass',
    'tailMass',
    'finMass',
    'noseMassX'
]);

const CONTROL_SUFFIXES = {
    v0: ' м/с',
    angle: '°',
    h0: ' м',
    mass: ' г',
    noseMass: ' г',
    wingMass: ' г',
    fuselageMass: ' г',
    tailMass: ' г',
    finMass: ' г',
    noseMassX: ' м',
    cgFromWingLE: ' м',
    wingLE: ' м',
    wingSpan: ' м',
    rootChord: ' м',
    tipChord: ' м',
    sweep: '°',
    fuselageLength: ' м',
    tailX: ' м',
    finX: ' м',
    tailSpan: ' м',
    tailRootChord: ' м',
    tailTipChord: ' м',
    finHeight: ' м',
    finRootChord: ' м',
    finTipChord: ' м',
    tailSweep: '°',
    wingIncidence: '°',
    tailIncidence: '°',
    dihedral: '°',
    wind: ' м/с',
    turb: '',
    thermal: ''
};

// ==========================================
// ANIMATION LOOP
// ==========================================

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (isRunning && plane && !plane.landed) {
        const physDt = 0.005;
        const steps = Math.max(1, Math.round(dt / physDt));
        for (let i = 0; i < steps; i++) {
            plane.step(physDt);
            if (plane.landed) {
                isRunning = false;
                isPaused = false;
                updateStats();
                updatePauseButton();
                break;
            }
        }
        updateLiveStats();
    }

    updateScene();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
}

function updateLiveStats() {
    if (!plane) return;
    const speed = plane.getSpeed();
    const stallSpeed = plane.getStallSpeed();
    const ld = plane.ldNow;
    const alphaDeg = plane.alpha * RAD2DEG;
    const gammaDeg = plane.gamma * RAD2DEG;
    const pitchDeg = plane.getPitch() * RAD2DEG;
    
    document.getElementById('s-distance').textContent = plane.x.toFixed(1) + ' м';
    document.getElementById('s-zoffset').textContent = plane.z.toFixed(1) + ' м';
    document.getElementById('s-time').textContent = plane.t.toFixed(2) + ' с';
    document.getElementById('s-vfinal').textContent = speed.toFixed(1) + ' м/с';
    document.getElementById('s-hmax').textContent = plane.yMax.toFixed(1) + ' м';
    document.getElementById('s-vstall').textContent = stallSpeed.toFixed(1) + ' м/с';
    document.getElementById('s-wingload').textContent = plane.getWingLoading().toFixed(1) + ' г/дм²';
    document.getElementById('s-ld').textContent = Number.isFinite(ld) ? ld.toFixed(1) : '—';
    document.getElementById('s-re').textContent = plane.reNow > 0 ? (plane.reNow / 1000).toFixed(0) + 'k' : '—';
    document.getElementById('s-static-margin').textContent = plane.getStaticMargin().toFixed(1) + '%';
    document.getElementById('s-tail-volume').textContent = plane.getTailVolume().toFixed(2);
    document.getElementById('s-lift-breakdown').textContent =
        plane.wingLiftNow.toFixed(2) + ' / ' + plane.tailLiftNow.toFixed(2) + ' Н';
    document.getElementById('s-pitch-moment').textContent = plane.pitchMomentNow.toFixed(3) + ' Нм';
    document.getElementById('s-flow-y').textContent = plane.airflowNow.y.toFixed(2) + ' м/с';
    
    const speedHud = document.getElementById('hud-speed');
    speedHud.textContent = speed.toFixed(1) + ' м/с';
    speedHud.classList.toggle('warning', speed < stallSpeed * 1.15);
    document.getElementById('hud-vstall').textContent = stallSpeed.toFixed(1) + ' м/с';
    document.getElementById('hud-ld').textContent = Number.isFinite(ld) ? ld.toFixed(1) : '—';
    document.getElementById('hud-alpha').textContent = alphaDeg.toFixed(1) + '°';
    document.getElementById('hud-gamma').textContent = gammaDeg.toFixed(1) + '°';
    document.getElementById('hud-pitch').textContent = pitchDeg.toFixed(1) + '°';
    document.getElementById('hud-alt').textContent = plane.y.toFixed(1) + ' м';
    document.getElementById('hud-z').textContent = plane.z.toFixed(1) + ' м';
}

function updateStats() {
    updateLiveStats();
}

function updatePauseButton() {
    const button = document.getElementById('pause');
    if (!button) return;

    const canPause = Boolean(plane && !plane.landed);
    button.disabled = !canPause;
    button.textContent = isPaused ? '▶ Продолжить' : '⏸ Пауза';
}

// ==========================================
// CONTROLS
// ==========================================

function formatParamValue(id, value, suffix) {
    if (suffix === ' м') return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + suffix;
    if (suffix === '°') return value.toFixed(1) + suffix;
    return value + suffix;
}

function updateControlFromParam(id) {
    const control = document.getElementById(id);
    if (!control || params[id] === undefined) return;

    control.value = params[id];
    const display = document.getElementById('val-' + id);
    if (display) {
        display.textContent = formatParamValue(id, params[id], CONTROL_SUFFIXES[id] ?? '');
    }
}

function syncControlsFromParams() {
    Object.keys(CONTROL_SUFFIXES).forEach(updateControlFromParam);

    const airfoil = document.getElementById('airfoil');
    if (airfoil && params.airfoil) airfoil.value = params.airfoil;

    const preset = document.getElementById('aircraft-preset');
    if (preset) preset.value = params.preset || 'custom';
}

function markAircraftPresetCustom() {
    if (isApplyingPreset) return;

    params.preset = 'custom';
    const preset = document.getElementById('aircraft-preset');
    if (preset) preset.value = 'custom';
}

function syncCgModeState() {
    const mode = params.cgMode || 'calculated';
    params.cgMode = mode;

    document.querySelectorAll('[data-cg-mode]').forEach(button => {
        button.classList.toggle('active', button.dataset.cgMode === mode);
    });

    document.querySelectorAll('.cg-manual-control').forEach(group => {
        const disabled = mode === 'calculated';
        group.classList.toggle('is-disabled', disabled);
        group.querySelectorAll('input').forEach(input => {
            input.disabled = disabled;
        });
    });
}

function applyAircraftPreset(presetId) {
    if (presetId === 'custom') {
        params.preset = 'custom';
        return;
    }

    const preset = AIRCRAFT_PRESETS[presetId];
    if (!preset) return;

    isApplyingPreset = true;
    Object.assign(params, preset.params, {
        preset: presetId,
        shape: 'custom',
        cgX: undefined
    });

    syncDerivedGeometry();
    syncControlsFromParams();
    renderConstructorPreview();
    isApplyingPreset = false;
}

function initPresetMenu() {
    const preset = document.getElementById('aircraft-preset');
    if (!preset) return;

    Object.entries(AIRCRAFT_PRESETS).forEach(([id, config]) => {
        let option = preset.querySelector(`option[value="${id}"]`);
        if (!option) {
            option = document.createElement('option');
            option.value = id;
            preset.insertBefore(option, preset.querySelector('option[value="custom"]'));
        }
        option.textContent = config.label;
    });

    preset.value = params.preset || 'custom';
    preset.addEventListener('change', () => applyAircraftPreset(preset.value));
}

function syncStationControls() {
    const fuselageLength = params.fuselageLength ?? 0.80;

    for (const id of ['tailX', 'finX']) {
        const slider = document.getElementById(id);
        const display = document.getElementById('val-' + id);
        if (!slider || !display) continue;

        slider.max = fuselageLength.toFixed(3);
        params[id] = Math.min(Math.max(params[id] ?? fuselageLength, parseFloat(slider.min)), fuselageLength);
        slider.value = params[id];
        display.textContent = formatParamValue(id, params[id], ' м');
    }
}

function syncDerivedGeometry() {
    const span = Math.max(params.wingSpan ?? 0, 0);
    const root = Math.max(params.rootChord ?? 0, 0);
    const tip = Math.min(Math.max(params.tipChord ?? 0, 0), root || Infinity);
    const wingAreaM2 = span * (root + tip) / 2;
    const taper = Math.min(Math.max(tip / Math.max(root, 1e-6), 0.01), 1);
    const mac = (2 / 3) * root * ((1 + taper + taper * taper) / (1 + taper));
    const yMac = (span / 2) * (1 + 2 * taper) / (3 * (1 + taper));
    const macLE = (params.wingLE ?? 0) + Math.tan((params.sweep ?? 0) * DEG2RAD) * yMac;

    params.area = wingAreaM2 * 100;
    params.mac = mac;
    params.macLE = macLE;
    params.cgFromWingLE = Math.min(
        Math.max(params.cgFromWingLE ?? 0.039, 0.005),
        Math.min(root * 0.95, 0.140)
    );
    params.cgX = (params.wingLE ?? 0) + params.cgFromWingLE;
    params.cgPercent = ((params.cgX - macLE) / Math.max(mac, 1e-6)) * 100;
    params.wingX = (params.wingLE ?? 0) + root * 0.25;

    const config = buildAircraftConfig(params.mass, params.area, params.CL, params.CD);
    if ((params.cgMode || 'calculated') === 'calculated') {
        params.mass = config.mass * 1000;
        params.cgX = config.cgX;
        params.cgFromWingLE = config.cgFromWingLE;
        params.cgPercent = config.cgPercent;
    }
}

function syncTailModeState() {
    const mode = params.tailMode || 'vTail';
    params.tailMode = mode;

    if (mode === 'vTail') {
        params.tailDihedral = params.tailDihedral ?? 40;
        params.finHeight = 0;
    } else {
        params.tailDihedral = 0;
        if (!params.finHeight || params.finHeight < 0.03) {
            params.finHeight = 0.08;
        }
    }

    document.querySelectorAll('[data-tail-mode]').forEach(button => {
        button.classList.toggle('active', button.dataset.tailMode === mode);
    });

    document.querySelectorAll('.fin-control').forEach(group => {
        const disabled = mode === 'vTail';
        group.classList.toggle('is-disabled', disabled);
        group.querySelectorAll('input').forEach(input => {
            input.disabled = disabled;
            if (params[input.id] !== undefined) input.value = params[input.id];
            const display = document.getElementById('val-' + input.id);
            if (display) display.textContent = formatParamValue(input.id, params[input.id], CONTROL_SUFFIXES[input.id] ?? ' м');
        });
    });
}

function renderConstructorPreview() {
    const svg = document.getElementById('constructor-svg');
    if (!svg) return;
    syncStationControls();
    syncCgModeState();
    syncTailModeState();
    syncDerivedGeometry();
    syncControlsFromParams();

    const rootChord = Math.max(params.rootChord, 0.02);
    const tipChord = Math.min(Math.max(params.tipChord, 0.01), rootChord);
    const cg = params.cgX;
    const wingLE = params.wingLE;
    const wingX = params.wingX;
    const fuselageLength = params.fuselageLength ?? params.tailArm ?? 0.80;
    const tailX = Math.min(params.tailX ?? fuselageLength - 0.06, fuselageLength);
    const finX = Math.min(params.finX ?? tailX, fuselageLength);
    const sweepOffset = Math.tan(params.sweep * DEG2RAD) * params.wingSpan / 2;
    const tailSpan = params.tailSpan;
    const tailDihedral = params.tailMode === 'vTail' ? (params.tailDihedral ?? 40) : 0;
    const tailRootChord = params.tailRootChord;
    const tailTipChord = Math.min(params.tailTipChord, tailRootChord);
    const tailSweepOffset = Math.tan(params.tailSweep * DEG2RAD) * tailSpan / 2;
    const finHeight = params.finHeight;
    const finRootChord = params.finRootChord;
    const finTipChord = Math.min(params.finTipChord, finRootChord);
    const finSweepOffset = Math.tan(params.tailSweep * DEG2RAD) * finHeight;

    const scale = 135;
    const originX = 170;
    const topY = 42;
    const sideY = 96;
    const xToSvg = x => originX - x * scale;
    const spanPx = Math.max(34, params.wingSpan * scale * 0.62);
    const tailSpanPx = Math.max(20, tailSpan * scale * 0.62);
    const rootChordPx = Math.max(8, rootChord * scale * 1.2);
    const tipChordPx = Math.max(5, tipChord * scale * 1.2);
    const tailRootPx = Math.max(5, tailRootChord * scale * 1.2);
    const tailTipPx = Math.max(4, tailTipChord * scale * 1.2);
    const finHeightPx = Math.max(18, finHeight * scale * 1.8);
    const finRootPx = Math.max(8, finRootChord * scale * 1.4);
    const finTipPx = Math.max(5, finTipChord * scale * 1.4);
    const wingRootX = xToSvg(wingLE);
    const wingTipX = xToSvg(wingLE + sweepOffset);
    const tailRootX = xToSvg(tailX);
    const tailTipX = xToSvg(tailX + tailSweepOffset);
    const finRootX = xToSvg(finX);
    const finTipX = xToSvg(finX + finSweepOffset);
    const bodyTailX = fuselageLength;
    const bodyNoseX = 0;
    const tailVHeightPx = Math.max(12, Math.sin(tailDihedral * DEG2RAD) * tailSpan * scale * 0.42);
    const tailTop = params.tailMode === 'vTail'
        ? `<polygon class="preview-tail" points="${tailRootX.toFixed(1)},${topY.toFixed(1)} ${tailTipX.toFixed(1)},${(topY - tailSpanPx / 2).toFixed(1)} ${(tailTipX - tailTipPx).toFixed(1)},${(topY - tailSpanPx / 2).toFixed(1)} ${(tailRootX - tailRootPx).toFixed(1)},${topY.toFixed(1)} ${(tailTipX - tailTipPx).toFixed(1)},${(topY + tailSpanPx / 2).toFixed(1)} ${tailTipX.toFixed(1)},${(topY + tailSpanPx / 2).toFixed(1)}"></polygon>`
        : `<polygon class="preview-tail" points="${tailRootX.toFixed(1)},${topY.toFixed(1)} ${tailTipX.toFixed(1)},${(topY - tailSpanPx / 2).toFixed(1)} ${(tailTipX - tailTipPx).toFixed(1)},${(topY - tailSpanPx / 2).toFixed(1)} ${(tailRootX - tailRootPx).toFixed(1)},${topY.toFixed(1)} ${(tailTipX - tailTipPx).toFixed(1)},${(topY + tailSpanPx / 2).toFixed(1)} ${tailTipX.toFixed(1)},${(topY + tailSpanPx / 2).toFixed(1)}"></polygon>`;
    const tailSide = params.tailMode === 'vTail'
        ? `<polygon class="preview-tail" points="${xToSvg(tailX).toFixed(1)},${sideY.toFixed(1)} ${(xToSvg(tailX) - tailRootPx).toFixed(1)},${sideY.toFixed(1)} ${(xToSvg(tailX + tailSweepOffset) - tailTipPx).toFixed(1)},${(sideY - tailVHeightPx).toFixed(1)} ${xToSvg(tailX + tailSweepOffset).toFixed(1)},${(sideY - tailVHeightPx * 0.72).toFixed(1)}"></polygon>`
        : `<line class="preview-tail" x1="${xToSvg(tailX).toFixed(1)}" y1="${sideY}" x2="${(xToSvg(tailX) - tailRootPx).toFixed(1)}" y2="${(sideY - Math.sin(params.tailIncidence * DEG2RAD) * 28).toFixed(1)}"></line>`;
    const finSide = params.tailMode === 'vTail' || finHeight <= 0.001
        ? ''
        : `<polygon class="preview-fin" points="${(finRootX - finRootPx * 0.2).toFixed(1)},${sideY.toFixed(1)} ${(finTipX - finTipPx * 0.25).toFixed(1)},${(sideY - finHeightPx).toFixed(1)} ${(finTipX + finTipPx * 0.75).toFixed(1)},${(sideY - finHeightPx * 0.72).toFixed(1)} ${(finRootX + finRootPx * 0.8).toFixed(1)},${sideY.toFixed(1)}"></polygon>`;

    svg.innerHTML = `
        <line class="preview-axis" x1="12" y1="${topY}" x2="248" y2="${topY}"></line>
        <line class="preview-axis" x1="12" y1="${sideY}" x2="248" y2="${sideY}"></line>
        <path class="preview-body" d="M ${xToSvg(bodyTailX).toFixed(1)} ${topY} L ${xToSvg(bodyNoseX).toFixed(1)} ${topY}"></path>
        <polygon class="preview-wing" points="${wingRootX.toFixed(1)},${topY.toFixed(1)} ${wingTipX.toFixed(1)},${(topY - spanPx / 2).toFixed(1)} ${(wingTipX - tipChordPx).toFixed(1)},${(topY - spanPx / 2).toFixed(1)} ${(wingRootX - rootChordPx).toFixed(1)},${topY.toFixed(1)} ${(wingTipX - tipChordPx).toFixed(1)},${(topY + spanPx / 2).toFixed(1)} ${wingTipX.toFixed(1)},${(topY + spanPx / 2).toFixed(1)}"></polygon>
        ${tailTop}
        <circle class="preview-cg" cx="${xToSvg(cg).toFixed(1)}" cy="${topY}" r="4"></circle>
        <text class="preview-label" x="${(xToSvg(cg) + 7).toFixed(1)}" y="${(topY - 6).toFixed(1)}">CG</text>
        <path class="preview-body" d="M ${xToSvg(bodyTailX).toFixed(1)} ${sideY} L ${xToSvg(bodyNoseX).toFixed(1)} ${sideY}"></path>
        <line class="preview-wing" x1="${xToSvg(wingLE).toFixed(1)}" y1="${sideY}" x2="${(xToSvg(wingLE) - rootChordPx).toFixed(1)}" y2="${(sideY - Math.sin(params.wingIncidence * DEG2RAD) * 28).toFixed(1)}"></line>
        ${tailSide}
        ${finSide}
        <circle class="preview-cg" cx="${xToSvg(cg).toFixed(1)}" cy="${sideY}" r="4"></circle>
        <text class="preview-label" x="${(xToSvg(cg) + 7).toFixed(1)}" y="${(sideY - 6).toFixed(1)}">CG</text>
        <text class="preview-label" x="12" y="118">L ${fuselageLength.toFixed(2)}m · CG ${(params.cgFromWingLE * 1000).toFixed(0)}mm · S ${(params.area / 100).toFixed(3)}m²</text>
    `;

    const summary = document.getElementById('design-summary');
    if (summary) {
        summary.textContent = `L ${fuselageLength.toFixed(2)} м · CG ${(params.cgFromWingLE * 1000).toFixed(0)} мм от крыла · S ${(params.area / 100).toFixed(3)} м²`;
    }

    if (typeof refreshDesignModel === 'function') {
        refreshDesignModel();
    }
}

function bindSlider(id, param, suffix = '') {
    const slider = document.getElementById(id);
    const display = document.getElementById('val-' + id);
    
    slider.addEventListener('input', () => {
        params[param] = parseFloat(slider.value);
        display.textContent = formatParamValue(id, params[param], suffix);
        if (AIRCRAFT_PARAM_IDS.has(param)) {
            markAircraftPresetCustom();
        }
        
        renderConstructorPreview();
    });
}

bindSlider('v0', 'v0', ' м/с');
bindSlider('angle', 'angle', '°');
bindSlider('h0', 'h0', ' м');
bindSlider('mass', 'mass', ' г');
bindSlider('cgFromWingLE', 'cgFromWingLE', ' м');
bindSlider('noseMass', 'noseMass', ' г');
bindSlider('noseMassX', 'noseMassX', ' м');
bindSlider('wingMass', 'wingMass', ' г');
bindSlider('fuselageMass', 'fuselageMass', ' г');
bindSlider('tailMass', 'tailMass', ' г');
bindSlider('wingLE', 'wingLE', ' м');
bindSlider('wingSpan', 'wingSpan', ' м');
bindSlider('rootChord', 'rootChord', ' м');
bindSlider('tipChord', 'tipChord', ' м');
bindSlider('sweep', 'sweep', '°');
bindSlider('fuselageLength', 'fuselageLength', ' м');
bindSlider('tailX', 'tailX', ' м');
bindSlider('finX', 'finX', ' м');
bindSlider('tailSpan', 'tailSpan', ' м');
bindSlider('tailRootChord', 'tailRootChord', ' м');
bindSlider('tailTipChord', 'tailTipChord', ' м');
bindSlider('finHeight', 'finHeight', ' м');
bindSlider('finRootChord', 'finRootChord', ' м');
bindSlider('finTipChord', 'finTipChord', ' м');
bindSlider('finMass', 'finMass', ' г');
bindSlider('tailSweep', 'tailSweep', '°');
bindSlider('wingIncidence', 'wingIncidence', '°');
bindSlider('tailIncidence', 'tailIncidence', '°');
bindSlider('dihedral', 'dihedral', '°');
bindSlider('wind', 'wind', ' м/с');
bindSlider('turb', 'turb', '');
bindSlider('thermal', 'thermal', '');
document.getElementById('wind').addEventListener('input', recomputeVectorField);
document.getElementById('turb').addEventListener('input', recomputeVectorField);
document.getElementById('thermal').addEventListener('input', recomputeVectorField);

document.querySelectorAll('[data-tail-mode]').forEach(button => {
    button.addEventListener('click', () => {
        params.tailMode = button.dataset.tailMode;
        markAircraftPresetCustom();
        syncTailModeState();
        renderConstructorPreview();
    });
});

document.querySelectorAll('[data-cg-mode]').forEach(button => {
    button.addEventListener('click', () => {
        params.cgMode = button.dataset.cgMode;
        markAircraftPresetCustom();
        syncCgModeState();
        renderConstructorPreview();
    });
});

document.getElementById('airfoil').addEventListener('change', function() {
    params.airfoil = this.value;
    markAircraftPresetCustom();
    renderConstructorPreview();
});

function launch() {
    // Store old trail
    if (plane && plane.trail.length > 1) {
        const oldGeo = new THREE.BufferGeometry();
        const oldPoints = plane.trail.map(p => new THREE.Vector3(p.x, p.y, p.z));
        oldGeo.setFromPoints(oldPoints);
        const oldMat = new THREE.LineBasicMaterial({ 
            color: 0x4ecca3, 
            transparent: true, 
            opacity: 0.2 
        });
        const oldLine = new THREE.Line(oldGeo, oldMat);
        scene.add(oldLine);
        window.oldTrailLines.push(oldLine);
        
        // Limit old trails
        if (window.oldTrailLines.length > 5) {
            const removed = window.oldTrailLines.shift();
            scene.remove(removed);
            removed.geometry.dispose();
            removed.material.dispose();
        }
    }
    
    plane = new PaperPlane(
        params.v0, params.angle, params.h0,
        params.mass, params.area, params.CL, params.CD
    );
    isRunning = true;
    isPaused = false;
    lastTime = 0;
    updatePauseButton();
    
    // Reset trail line
    trailLine.geometry.setFromPoints([new THREE.Vector3(0, params.h0, 0)]);
}

function clearAll() {
    plane = null;
    isRunning = false;
    isPaused = false;
    
    // Clear trails
    trailLine.geometry.setFromPoints([]);
    window.oldTrailLines.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    });
    window.oldTrailLines = [];
    
    // Reset plane position
    if (planeMesh) {
        planeMesh.position.set(0, params.h0, 0);
        planeMesh.rotation.set(0, 0, params.angle * Math.PI / 180);
    }
    
    // Reset stats
    document.getElementById('s-distance').textContent = '—';
    document.getElementById('s-zoffset').textContent = '—';
    document.getElementById('s-time').textContent = '—';
    document.getElementById('s-vfinal').textContent = '—';
    document.getElementById('s-hmax').textContent = '—';
    document.getElementById('s-vstall').textContent = '—';
    document.getElementById('s-wingload').textContent = '—';
    document.getElementById('s-ld').textContent = '—';
    document.getElementById('s-re').textContent = '—';
    document.getElementById('s-static-margin').textContent = '—';
    document.getElementById('s-tail-volume').textContent = '—';
    document.getElementById('s-lift-breakdown').textContent = '—';
    document.getElementById('s-pitch-moment').textContent = '—';
    document.getElementById('s-flow-y').textContent = '—';
    document.getElementById('hud-speed').textContent = '— м/с';
    document.getElementById('hud-speed').classList.remove('warning');
    document.getElementById('hud-vstall').textContent = '— м/с';
    document.getElementById('hud-ld').textContent = '—';
    document.getElementById('hud-alpha').textContent = '—°';
    document.getElementById('hud-gamma').textContent = '—°';
    document.getElementById('hud-pitch').textContent = '—°';
    document.getElementById('hud-alt').textContent = '— м';
    document.getElementById('hud-z').textContent = '— м';
    updatePauseButton();
}

function togglePause() {
    if (!plane || plane.landed) {
        updatePauseButton();
        return;
    }

    isPaused = !isPaused;
    isRunning = !isPaused;
    if (!isPaused) lastTime = 0;
    updatePauseButton();
}

document.getElementById('launch').addEventListener('click', launch);
document.getElementById('pause').addEventListener('click', togglePause);
document.getElementById('clear').addEventListener('click', clearAll);

// Optimization
document.getElementById('optimize').addEventListener('click', function() {
    const status = document.getElementById('opt-status');
    status.className = 'show';
    status.textContent = '⚡ Подбор ЦТ и хвоста... 0%';
    this.disabled = true;

    syncDerivedGeometry();
    const baseParams = {...params};
    const cgSlider = document.getElementById('cgFromWingLE');
    const tailSlider = document.getElementById('tailIncidence');
    const cgMin = parseFloat(cgSlider.min);
    const cgMax = Math.min(parseFloat(cgSlider.max), Math.max(baseParams.rootChord * 0.95, cgMin));
    const tailMin = parseFloat(tailSlider.min);
    const tailMax = parseFloat(tailSlider.max);
    let best = { score: -Infinity, distance: 0, cg: baseParams.cgFromWingLE, tail: baseParams.tailIncidence };
    let candidates = [];
    let done = 0;
    let stage = 'coarse';

    function buildRange(min, max, step) {
        const values = [];
        for (let v = min; v <= max + step * 0.25; v += step) {
            values.push(Number(v.toFixed(4)));
        }
        return values;
    }

    function buildCandidates(cgValues, tailValues) {
        const list = [];
        for (const cg of cgValues) {
            for (const tail of tailValues) {
                list.push({ cg, tail });
            }
        }
        return list;
    }

    function simulateCandidate(candidate) {
        Object.assign(params, baseParams, {
            cgMode: 'manual',
            cgFromWingLE: candidate.cg,
            tailIncidence: candidate.tail,
            cgX: undefined
        });

        const p = new PaperPlane(
            baseParams.v0,
            baseParams.angle,
            baseParams.h0,
            baseParams.mass,
            baseParams.area,
            baseParams.CL,
            baseParams.CD
        );

        let minVx = Infinity;
        let maxPitch = -Infinity;
        let minPitch = Infinity;

        while (!p.landed && p.t < 15) {
            p.step(0.01);
            const pitch = p.getPitch() * RAD2DEG;
            minVx = Math.min(minVx, p.vx);
            maxPitch = Math.max(maxPitch, pitch);
            minPitch = Math.min(minPitch, pitch);
        }

        const pitchRange = maxPitch - minPitch;
        const invalid = minVx < 0.2 || p.yMax > baseParams.h0 + 12 || pitchRange > 140;
        const score = invalid ? -Infinity : p.x;
        return { score, distance: p.x, time: p.t, cg: candidate.cg, tail: candidate.tail };
    }

    function startCoarsePass() {
        stage = 'coarse';
        done = 0;
        const cgValues = buildRange(cgMin, cgMax, 0.004);
        const tailValues = buildRange(tailMin, tailMax, 0.5);
        candidates = buildCandidates(cgValues, tailValues);
        runBatch();
    }

    function startFinePass() {
        stage = 'fine';
        done = 0;
        const cgValues = buildRange(
            Math.max(cgMin, best.cg - 0.008),
            Math.min(cgMax, best.cg + 0.008),
            0.001
        );
        const tailValues = buildRange(
            Math.max(tailMin, best.tail - 1.0),
            Math.min(tailMax, best.tail + 1.0),
            0.1
        );
        candidates = buildCandidates(cgValues, tailValues);
        runBatch();
    }

    function runBatch() {
        const batchSize = 20;
        for (let b = 0; b < batchSize && done < candidates.length; b++) {
            const result = simulateCandidate(candidates[done]);
            done++;
            if (result.score > best.score) {
                best = result;
            }
        }
        
        const progress = Math.round(done / candidates.length * 100);
        status.textContent = `⚡ ${stage === 'coarse' ? 'Грубый' : 'Точный'} подбор ЦТ/хвоста... ${progress}%`;
        
        if (done < candidates.length) {
            setTimeout(runBatch, 0);
        } else if (stage === 'coarse') {
            startFinePass();
        } else {
            Object.assign(params, baseParams, {
                cgMode: 'manual',
                cgFromWingLE: best.cg,
                tailIncidence: best.tail,
                cgX: undefined
            });

            cgSlider.value = best.cg.toFixed(3);
            tailSlider.value = best.tail.toFixed(1);
            document.getElementById('val-cgFromWingLE').textContent = formatParamValue('cgFromWingLE', best.cg, ' м');
            document.getElementById('val-tailIncidence').textContent = formatParamValue('tailIncidence', best.tail, '°');
            renderConstructorPreview();
            markAircraftPresetCustom();

            status.innerHTML = `✓ Лучший результат: <strong style="color:#4ecca3">${best.distance.toFixed(1)} м</strong><br>` +
                `CG: ${(best.cg * 1000).toFixed(0)} мм · хвост: ${best.tail.toFixed(1)}°`;
            
            launch();
            document.getElementById('optimize').disabled = false;
        }
    }

    startCoarsePass();
});

//{}

// Init
initScene();
initPresetMenu();
syncControlsFromParams();
renderConstructorPreview();
launch();
updatePauseButton();
requestAnimationFrame(loop);
