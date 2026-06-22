import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const EARTH_RADIUS_M = 6371000;
const EARTH_VISUAL_RADIUS = 53;
const ALTITUDE_VISUAL_SCALE = 1 / 12000;
const ROCKET_NOSE_AXIS = new THREE.Vector3(0, 1, 0);
const ROCKET_ENGINE_AXIS = new THREE.Vector3(0, -1, 0);
const FOLLOW_OFFSET_LOW = new THREE.Vector3(2.2, 4.2, 14);
const FOLLOW_OFFSET_HIGH = new THREE.Vector3(8, 12, 30);
const GROUND_OFFSET = new THREE.Vector3(0, 18, 56);
const ORBIT_OFFSET = new THREE.Vector3(44, 58, 86);

function buildStarField() {
  const starsGeometry = new THREE.BufferGeometry();
  const starCount = 1400;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    const radius = 280 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xdce8ff,
    size: 1.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });

  return new THREE.Points(starsGeometry, starsMaterial);
}

function buildExhaustTrail() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color: 0xffb264,
    transparent: true,
    opacity: 0.58,
    depthWrite: false
  });
  return new THREE.Line(geometry, material);
}

function makeRocket() {
  const rocket = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f3f8, metalness: 0.72, roughness: 0.26 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x161f30, metalness: 0.5, roughness: 0.42 });

  const stage1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.2, 24), bodyMaterial);
  stage1.position.y = 1.6;
  rocket.add(stage1);

  const interstage = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.28, 24), darkMaterial);
  interstage.position.y = 3.36;
  rocket.add(interstage);

  const stage2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.3, 24), bodyMaterial);
  stage2.position.y = 4.6;
  rocket.add(stage2);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 1.2, 22),
    new THREE.MeshStandardMaterial({ color: 0xf1f5fb, metalness: 0.55, roughness: 0.3 })
  );
  nose.position.y = 6.35;
  rocket.add(nose);

  const fins = [];
  for (let i = 0; i < 4; i += 1) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.42, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2b3548, metalness: 0.38, roughness: 0.45 })
    );
    const angle = (Math.PI * 2 * i) / 4;
    fin.position.set(Math.cos(angle) * 0.24, 0.22, Math.sin(angle) * 0.24);
    fin.lookAt(fin.position.clone().multiplyScalar(2));
    rocket.add(fin);
    fins.push(fin);
  }

  return { rocket };
}

function makeEarth() {
  const earth = new THREE.Group();

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(53, 96, 96),
    new THREE.MeshStandardMaterial({
      color: 0x1e4f88,
      roughness: 0.92,
      metalness: 0.03
    })
  );
  earth.add(surface);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(55, 72, 72),
    new THREE.MeshBasicMaterial({
      color: 0x66b9ff,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    })
  );
  earth.add(atmosphere);

  const cloudBand = new THREE.Mesh(
    new THREE.SphereGeometry(54.5, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xdff3ff,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending
    })
  );
  earth.add(cloudBand);

  earth.userData.cloudBand = cloudBand;

  return earth;
}

export class LaunchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040d1d);
    this.scene.fog = new THREE.Fog(0x040d1d, 60, 420);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2600);
    this.camera.position.set(6, 64.5, 78);

    this.clock = new THREE.Clock();
    this.cameraMode = 'follow';
    this.currentTarget = new THREE.Vector3(0, 56.5, 0);
    this.previousRocketPosition = new THREE.Vector3(0, 56.5, 0);
    this.previousDirection = new THREE.Vector3(0, 1, 0);
    this.smoothedPathDirection = new THREE.Vector3(0, 1, 0);
    this.currentAltitudeM = 0;
    this.engineTrailPoints = [];
    this.freeOrbit = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      yaw: 0,
      pitch: 0.34,
      distance: 38,
      minDistance: 8,
      maxDistance: 260,
      target: this.currentTarget.clone()
    };

    const ambient = new THREE.AmbientLight(0x6d8ebd, 0.72);
    const key = new THREE.DirectionalLight(0xf5fcff, 1.08);
    key.position.set(80, 120, 120);
    const rim = new THREE.DirectionalLight(0x5a9dff, 0.5);
    rim.position.set(-90, 80, -70);
    this.scene.add(ambient, key, rim);

    this.earth = makeEarth();
    this.scene.add(this.earth);

    this.stars = buildStarField();
    this.scene.add(this.stars);

    const { rocket } = makeRocket();
    this.rocket = rocket;
    this.rocket.position.set(0, 56.5, 0);
    this.rocket.scale.setScalar(0.22);
    this.scene.add(this.rocket);

    this.nozzleMount = new THREE.Group();
    // Placed at the bottom of stage1 (stage1 spans y=0 to y=3.2 in rocket-local space).
    this.nozzleMount.position.set(0, 0, 0);
    this.rocket.add(this.nozzleMount);

    this.engineLight = new THREE.PointLight(0xffa552, 0, 24, 2);
    this.engineLight.position.set(0, -0.06, 0);
    this.nozzleMount.add(this.engineLight);

    this.plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.95, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffb061,
        transparent: true,
        opacity: 0.56,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      })
    );
    this.plume.position.set(0, -0.42, 0);
    this.plume.rotation.z = Math.PI;
    this.plume.renderOrder = 12;
    this.plume.visible = false;
    this.nozzleMount.add(this.plume);

    this.plumeCore = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.62, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c2,
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      })
    );
    this.plumeCore.position.set(0, -0.34, 0);
    this.plumeCore.rotation.z = Math.PI;
    this.plumeCore.renderOrder = 13;
    this.plumeCore.visible = false;
    this.nozzleMount.add(this.plumeCore);

    this.plumeCorona = new THREE.Group();
    for (let i = 0; i < 10; i += 1) {
      const tongue = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.46, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffc37a,
          transparent: true,
          opacity: 0.48,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        })
      );
      const angle = (Math.PI * 2 * i) / 10;
      tongue.position.set(Math.cos(angle) * 0.12, -0.22, Math.sin(angle) * 0.12);
      tongue.rotation.z = Math.PI;
      this.plumeCorona.add(tongue);
    }
    this.plumeCorona.visible = false;
    this.plumeCorona.renderOrder = 11;
    this.nozzleMount.add(this.plumeCorona);

    this.plumeHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffd18a,
        transparent: true,
        opacity: 0.68,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.plumeHalo.position.set(0, -0.06, 0);
    this.plumeHalo.renderOrder = 14;
    this.plumeHalo.visible = false;
    this.nozzleMount.add(this.plumeHalo);

    this.plumeBillboard = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xffc26f,
        transparent: true,
        opacity: 0.78,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.plumeBillboard.position.set(0, -0.28, 0);
    this.plumeBillboard.scale.set(0.24, 0.24, 0.24);
    this.plumeBillboard.visible = false;
    this.plumeBillboard.renderOrder = 15;
    this.nozzleMount.add(this.plumeBillboard);

    this.pathPoints = [];
    this.pathGeometry = new THREE.BufferGeometry();
    this.pathMaterial = new THREE.LineBasicMaterial({
      color: 0x9fdcff,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      depthTest: false
    });
    this.pathLine = new THREE.Line(this.pathGeometry, this.pathMaterial);
    this.pathLine.frustumCulled = false;
    this.pathLine.renderOrder = 4;
    this.scene.add(this.pathLine);

    this.pathGlowGeometry = new THREE.BufferGeometry();
    this.pathGlowMaterial = new THREE.PointsMaterial({
      color: 0x86dcff,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      depthTest: false
    });
    this.pathGlow = new THREE.Points(this.pathGlowGeometry, this.pathGlowMaterial);
    this.pathGlow.frustumCulled = false;
    this.pathGlow.renderOrder = 3;
    this.scene.add(this.pathGlow);

    this.exhaustTrail = buildExhaustTrail();
    this.scene.add(this.exhaustTrail);

    this.nozzleLocal = new THREE.Vector3(0, -0.06, 0);

    this.initFreeOrbitControls();
    this.snapCamera();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = this.canvas.clientWidth || 1000;
    const height = this.canvas.clientHeight || 700;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.snapCamera();
  }

  initFreeOrbitControls() {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.cameraMode !== 'free') return;
      this.freeOrbit.dragging = true;
      this.freeOrbit.lastX = event.clientX;
      this.freeOrbit.lastY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (this.cameraMode !== 'free' || !this.freeOrbit.dragging) return;
      const dx = event.clientX - this.freeOrbit.lastX;
      const dy = event.clientY - this.freeOrbit.lastY;
      this.freeOrbit.lastX = event.clientX;
      this.freeOrbit.lastY = event.clientY;

      this.freeOrbit.yaw -= dx * 0.005;
      this.freeOrbit.pitch = THREE.MathUtils.clamp(this.freeOrbit.pitch + dy * 0.004, -1.52, 1.52);
    });

    this.canvas.addEventListener('pointerup', (event) => {
      this.freeOrbit.dragging = false;
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Ignore if capture was not set.
      }
    });

    this.canvas.addEventListener('wheel', (event) => {
      if (this.cameraMode !== 'free') return;
      event.preventDefault();
      const zoomFactor = 1 + Math.sign(event.deltaY) * 0.08;
      this.freeOrbit.distance = THREE.MathUtils.clamp(
        this.freeOrbit.distance * zoomFactor,
        this.freeOrbit.minDistance,
        this.freeOrbit.maxDistance
      );
    }, { passive: false });
  }

  updateFreeOrbitCamera(snap = false) {
    this.freeOrbit.target.lerp(this.currentTarget, snap ? 1 : 0.12);

    const cp = Math.cos(this.freeOrbit.pitch);
    const sp = Math.sin(this.freeOrbit.pitch);
    const cy = Math.cos(this.freeOrbit.yaw);
    const sy = Math.sin(this.freeOrbit.yaw);

    const offset = new THREE.Vector3(
      sy * cp,
      sp,
      cy * cp
    ).multiplyScalar(this.freeOrbit.distance);

    this.camera.position.copy(this.freeOrbit.target.clone().add(offset));
    this.camera.lookAt(this.freeOrbit.target);
  }

  resetPath() {
    this.pathPoints = [];
    this.pathGeometry.setFromPoints(this.pathPoints);
    this.pathGlowGeometry.setFromPoints(this.pathPoints);
    this.rocket.position.set(0, 56.5, 0);
    this.rocket.scale.setScalar(0.22);
    this.rocket.quaternion.identity();
    this.previousRocketPosition.copy(this.rocket.position);
    this.previousDirection.set(0, 1, 0);
    this.smoothedPathDirection.set(0, 1, 0);
    this.currentAltitudeM = 0;
    this.engineTrailPoints = [];
    this.exhaustTrail.geometry.setFromPoints(this.engineTrailPoints);
    this.engineLight.intensity = 0;
    this.plume.visible = false;
    this.plumeCore.visible = false;
    this.plumeCorona.visible = false;
    this.plumeHalo.visible = false;
    this.plumeBillboard.visible = false;
    this.snapCamera();
  }

  updateFromSample(sample, options = {}) {
    const { appendPath = true, snapCamera = false } = options;
    const radialDistanceM = Math.hypot(sample.x, sample.y);
    const altitudeM = Math.max(0, radialDistanceM - EARTH_RADIUS_M);
    const arcAngle = Math.atan2(sample.x, sample.y);
    const visualRadius = EARTH_VISUAL_RADIUS + altitudeM * ALTITUDE_VISUAL_SCALE;
    const sx = Math.sin(arcAngle) * visualRadius;
    const sy = Math.cos(arcAngle) * visualRadius;

    this.previousRocketPosition.copy(this.rocket.position);

    this.rocket.position.set(sx, sy, 0);
    this.currentTarget.set(sx, sy, 0);
    this.currentAltitudeM = sample.altitudeM;

    const readabilityScale = THREE.MathUtils.lerp(1.04, 0.68, THREE.MathUtils.clamp(sample.altitudeM / 260000, 0, 1));
    this.rocket.scale.setScalar(0.22 * readabilityScale);

    const radialOutward = this.currentTarget.clone().normalize();
    const onPad = this.pathPoints.length < 2 && sample.altitudeM < 2000 && sample.velocityMps < 40 && !sample.landed;

    // Use physics velocity vector (vx, vy) for orientation so the nose points along the
    // actual velocity direction, not the visually-compressed position delta which
    // systematically overstates vertical angle during high-horizontal-velocity phases.
    if (onPad) {
      const attitude = new THREE.Quaternion().setFromUnitVectors(ROCKET_NOSE_AXIS, radialOutward);
      this.rocket.quaternion.copy(attitude);
      this.previousDirection.copy(radialOutward);
    } else if (Number.isFinite(sample.vx) && Number.isFinite(sample.vy) && sample.velocityMps > 0.1) {
      const noseDirection = new THREE.Vector3(sample.vx, sample.vy, 0).normalize();
      const attitude = new THREE.Quaternion().setFromUnitVectors(ROCKET_NOSE_AXIS, noseDirection);
      this.rocket.quaternion.copy(attitude);
      this.previousDirection.copy(noseDirection);
    } else {
      // Velocity is zero or undefined (e.g. landed, coast edge). Hold the last
      // known direction so the rocket does not snap to an arbitrary orientation.
      const fallbackDirection = this.previousDirection.lengthSq() > 0.0000001
        ? this.previousDirection
        : radialOutward;
      const attitude = new THREE.Quaternion().setFromUnitVectors(ROCKET_NOSE_AXIS, fallbackDirection);
      this.rocket.quaternion.copy(attitude);
    }

    // Visual stage separation block removed: the generic rocket mesh is not designed
    // for per-stage body removal, and hiding parts produced a broken half-invisible rocket.

    if (appendPath) {
      this.pathPoints.push(new THREE.Vector3(sx, sy, 0));
    }
    if (this.pathPoints.length >= 2) {
      this.pathGeometry.setFromPoints(this.pathPoints);
      this.pathGlowGeometry.setFromPoints(this.pathPoints);

      if (this.pathPoints.length >= 8) {
        const recentPoint = this.pathPoints[this.pathPoints.length - 1];
        const olderPoint = this.pathPoints[this.pathPoints.length - 7];
        const tangent = recentPoint.clone().sub(olderPoint);
        if (tangent.lengthSq() > 0.00001) {
          this.smoothedPathDirection.copy(tangent.normalize());
        }
      }
    }

    const thrustVisible = Boolean(sample.engineOn) && sample.altitudeM < 700000;
    if (thrustVisible) {
      // Scale plume and engine light by actual thrust ratio so visual intensity matches
      // simulated thrust level (e.g. max-Q throttle-down, end-of-burn tailoff).
      const thrustRatio = Number.isFinite(sample.thrustRatio) ? Math.max(0.05, sample.thrustRatio) : 1;
      const flicker = 0.75 + Math.sin(performance.now() * 0.022) * 0.17;
      this.engineLight.intensity = (1.7 + flicker * 1.3) * thrustRatio;
      this.plume.visible = true;
      this.plumeCore.visible = true;
      this.plumeCorona.visible = true;
      this.plumeHalo.visible = true;
      this.plumeBillboard.visible = true;

      const altitudeBlend = THREE.MathUtils.clamp(sample.altitudeM / 90000, 0, 1);
      const plumeLength = THREE.MathUtils.lerp(0.75, 1.12, altitudeBlend) * (0.6 + thrustRatio * 0.4);
      const plumeWidth = THREE.MathUtils.lerp(0.78, 1.22, altitudeBlend) * (0.6 + thrustRatio * 0.4);
      this.plume.scale.set(plumeWidth + flicker * 0.06, plumeLength + flicker * 0.2, plumeWidth + flicker * 0.06);
      this.plumeCore.scale.set(0.72 + flicker * 0.05, 0.72 + flicker * 0.16, 0.72 + flicker * 0.05);
      this.plumeHalo.scale.setScalar(0.86 + flicker * 0.25);
      this.plumeBillboard.scale.setScalar(0.26 + flicker * 0.09);
      this.plumeBillboard.material.opacity = 0.7 + flicker * 0.14;

      for (let i = 0; i < this.plumeCorona.children.length; i += 1) {
        const tongue = this.plumeCorona.children[i];
        const pulse = 0.82 + Math.sin(performance.now() * 0.016 + i * 0.7) * 0.22;
        tongue.scale.set(0.85 + pulse * 0.25, 0.72 + pulse * 0.4, 0.85 + pulse * 0.25);
      }

      const localTrail = new THREE.Vector3(
        this.nozzleLocal.x + (Math.random() - 0.5) * 0.03,
        this.nozzleLocal.y,
        this.nozzleLocal.z + (Math.random() - 0.5) * 0.03
      );
      const nozzleWorld = this.nozzleMount.localToWorld(localTrail);
      const engineDirectionWorld = ROCKET_ENGINE_AXIS.clone().applyQuaternion(this.rocket.quaternion).normalize();
      const trailPoint = nozzleWorld.addScaledVector(engineDirectionWorld, 0.22 + Math.random() * 0.06);

      if (sample.altitudeM > 8 && sample.velocityMps > 6) {
        this.engineTrailPoints.push(trailPoint);
      }
      if (this.engineTrailPoints.length > 160) {
        this.engineTrailPoints.shift();
      }
      this.exhaustTrail.geometry.setFromPoints(this.engineTrailPoints);
    } else if (this.engineTrailPoints.length > 0) {
      this.engineLight.intensity = 0;
      this.plume.visible = false;
      this.plumeCore.visible = false;
      this.plumeCorona.visible = false;
      this.plumeHalo.visible = false;
      this.plumeBillboard.visible = false;
      this.engineTrailPoints.shift();
      this.exhaustTrail.geometry.setFromPoints(this.engineTrailPoints);
    } else {
      this.engineLight.intensity = 0;
      this.plume.visible = false;
      this.plumeCore.visible = false;
      this.plumeCorona.visible = false;
      this.plumeHalo.visible = false;
      this.plumeBillboard.visible = false;
    }

    this.updateCamera(snapCamera);
  }

  getDesiredCameraPosition() {
    const target = this.currentTarget.clone();

    if (this.cameraMode === 'ground') {
      return target.clone().add(GROUND_OFFSET);
    }

    if (this.cameraMode === 'orbit') {
      return target.clone().add(ORBIT_OFFSET);
    }

    const altitudeBlend = THREE.MathUtils.clamp(this.currentAltitudeM / 130000, 0, 1);
    const dynamicFollow = FOLLOW_OFFSET_LOW.clone().lerp(FOLLOW_OFFSET_HIGH, altitudeBlend);
    return target.clone().add(dynamicFollow);
  }

  snapCamera() {
    if (this.cameraMode === 'free') {
      this.updateFreeOrbitCamera(true);
      return;
    }

    const desired = this.getDesiredCameraPosition();
    this.camera.position.copy(desired);
    this.camera.lookAt(this.currentTarget);
  }

  updateCamera(snapCamera = false) {
    if (this.cameraMode === 'free') {
      this.updateFreeOrbitCamera(snapCamera);
      return;
    }

    const desired = this.getDesiredCameraPosition();
    if (snapCamera) {
      this.camera.position.copy(desired);
    } else {
      const damping = this.cameraMode === 'follow' ? 0.17 : 0.1;
      this.camera.position.lerp(desired, damping);
    }
    this.camera.lookAt(this.currentTarget);
  }

  render() {
    const t = this.clock.getElapsedTime();
    if (this.cameraMode === 'free') {
      this.updateFreeOrbitCamera(false);
    }
    this.stars.rotation.y += 0.00006;
    this.stars.rotation.x = Math.sin(t * 0.04) * 0.03;
    this.pathMaterial.opacity = 0.5 + Math.sin(t * 0.7) * 0.06;
    this.pathGlowMaterial.opacity = 0.28 + Math.sin(t * 0.6 + 0.25) * 0.05;
    this.earth.rotation.y += 0.00014;
    if (this.earth.userData.cloudBand) {
      this.earth.userData.cloudBand.rotation.y += 0.00024;
      this.earth.userData.cloudBand.material.opacity = 0.055 + Math.sin(t * 0.8) * 0.02;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
