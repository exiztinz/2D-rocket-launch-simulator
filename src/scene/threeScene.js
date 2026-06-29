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
const DEFAULT_LAUNCH_LAT = 28.6084;
const DEFAULT_LAUNCH_LON = -80.6043;
const ROCKET_SURFACE_OFFSET = 0;
const PAD_LOCK_ALTITUDE_THRESHOLD_M = 2000;
const ASCENT_ATTITUDE_LOCK_SEC = 8;
const SURFACE_LOCK_RELEASE_ALTITUDE_M = 1500;
const SURFACE_LOCK_RELEASE_VELOCITY_MPS = 70;
const SURFACE_LOCK_RELEASE_TIME_SEC = 10;
const TANGENT_BLEND_DURATION_SEC = 16;
const TRAJECTORY_ALTITUDE_SCALE_RATIO = 0.24;
const WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0);
const EARTH_TEXTURE_LONGITUDE_OFFSET_DEG = -18.4;
const EARTH_SIDEREAL_ROTATION_RAD_PER_SEC = 7.2921159e-5;
const EARTH_DAYMAP_HIRES_URL = '../../assets/textures/earth/earth_day_8192.png';
const EARTH_NORMALMAP_URL = '../../assets/textures/earth/earth_normal_2048.jpg';
const EARTH_NIGHTMAP_URL = '../../assets/textures/earth/earth_lights_2048.png';
const EARTH_CLOUDMAP_URL = '../../assets/textures/earth/earth_clouds_1024.png';

const QUALITY_LEVELS = {
  low: {
    nearStars: 500,
    midStars: 380,
    farStars: 280,
    twinkle: 0.45,
    shootingStars: 1,
    nebulaOpacity: 0.045,
    plumeExposure: 0.8
  },
  medium: {
    nearStars: 900,
    midStars: 700,
    farStars: 500,
    twinkle: 0.7,
    shootingStars: 2,
    nebulaOpacity: 0.075,
    plumeExposure: 1
  },
  high: {
    nearStars: 1350,
    midStars: 1050,
    farStars: 760,
    twinkle: 1,
    shootingStars: 3,
    nebulaOpacity: 0.11,
    plumeExposure: 1.16
  }
};

function loadEarthTexture(loader, fileNameOrUrl, isColor = false) {
  const isRemote = /^https?:\/\//i.test(fileNameOrUrl);
  const isLocalPath = /^(?:\.{1,2}\/|\/)/.test(fileNameOrUrl);
  const url = isRemote || isLocalPath
    ? new URL(fileNameOrUrl, import.meta.url).href
    : fileNameOrUrl;
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (isColor) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function makeEarth(maxAnisotropy = 1) {
  const earth = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();
  const dayMap = loadEarthTexture(textureLoader, EARTH_DAYMAP_HIRES_URL, true);
  const normalMap = loadEarthTexture(textureLoader, EARTH_NORMALMAP_URL);
  const nightMap = loadEarthTexture(textureLoader, EARTH_NIGHTMAP_URL, true);
  const cloudMap = loadEarthTexture(textureLoader, EARTH_CLOUDMAP_URL, true);
  const textures = [dayMap, normalMap, nightMap, cloudMap];
  textures.forEach((texture) => {
    texture.anisotropy = Math.max(1, Math.floor(maxAnisotropy));
  });

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_VISUAL_RADIUS, 128, 128),
    new THREE.MeshStandardMaterial({
      map: dayMap,
      normalMap,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.84,
      metalness: 0,
      emissive: 0xffffff,
      emissiveMap: nightMap,
      emissiveIntensity: 0.2
    })
  );
  earth.add(surface);

  const cloudBand = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_VISUAL_RADIUS + 1.1, 72, 72),
    new THREE.MeshStandardMaterial({
      map: cloudMap,
      alphaMap: cloudMap,
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  );
  earth.add(cloudBand);

  earth.userData.surface = surface;
  earth.userData.cloudBand = cloudBand;
  return earth;
}

function buildStarLayer(starCount, minRadius, maxRadius, size, opacity) {
  const starsGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const tint = 0.78 + Math.random() * 0.22;
    const blueBias = Math.random() > 0.75 ? 0.92 : 1;
    colors[i * 3] = tint;
    colors[i * 3 + 1] = tint * (0.94 + Math.random() * 0.08);
    colors[i * 3 + 2] = tint * blueBias;
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starsMaterial = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  return new THREE.Points(starsGeometry, starsMaterial);
}

function buildNebulaBands() {
  const group = new THREE.Group();
  const palette = [0x3360a2, 0x5a89b8, 0x40637f];
  for (let i = 0; i < 3; i += 1) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(350 + i * 55, 62 + i * 9, 24, 170),
      new THREE.MeshBasicMaterial({
        color: palette[i],
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      })
    );
    torus.rotation.set((Math.PI * 0.22) + i * 0.16, i * 0.43, i * 0.19);
    group.add(torus);
  }
  return group;
}

function buildShootingStar() {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const trail = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xffe2b8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  trail.visible = false;
  trail.userData = {
    active: false,
    age: 0,
    duration: 0,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    length: 0
  };
  return trail;
}

function createSunGradientTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.06,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  gradient.addColorStop(0, 'rgba(255, 252, 236, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 232, 166, 0.98)');
  gradient.addColorStop(0.58, 'rgba(255, 184, 104, 0.62)');
  gradient.addColorStop(1, 'rgba(255, 184, 104, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSunRaysTexture(size = 512, spokes = 16) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;

  const baseGlow = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.5);
  baseGlow.addColorStop(0, 'rgba(255, 236, 170, 0.45)');
  baseGlow.addColorStop(0.45, 'rgba(255, 196, 120, 0.16)');
  baseGlow.addColorStop(1, 'rgba(255, 196, 120, 0)');
  ctx.fillStyle = baseGlow;
  ctx.fillRect(0, 0, size, size);

  ctx.translate(cx, cy);
  for (let i = 0; i < spokes; i += 1) {
    ctx.rotate((Math.PI * 2) / spokes);
    const ray = ctx.createLinearGradient(0, 0, size * 0.46, 0);
    ray.addColorStop(0, 'rgba(255, 233, 166, 0.45)');
    ray.addColorStop(1, 'rgba(255, 233, 166, 0)');
    ctx.fillStyle = ray;
    ctx.fillRect(0, -2, size * 0.46, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

  for (let i = 0; i < 4; i += 1) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.42, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2b3548, metalness: 0.38, roughness: 0.45 })
    );
    const angle = (Math.PI * 2 * i) / 4;
    fin.position.set(Math.cos(angle) * 0.24, 0.22, Math.sin(angle) * 0.24);
    fin.lookAt(fin.position.clone().multiplyScalar(2));
    rocket.add(fin);
  }

  return { rocket };
}

export class LaunchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030913);
    this.scene.fog = new THREE.Fog(0x030913, 80, 520);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2600);
    this.camera.position.set(6, 64.5, 78);

    this.clock = new THREE.Clock();
    this.lastRenderMs = performance.now();
    this.cameraMode = 'follow';
    this.currentTarget = new THREE.Vector3(0, EARTH_VISUAL_RADIUS + 3.5, 0);
    this.previousRocketPosition = new THREE.Vector3(0, EARTH_VISUAL_RADIUS + 3.5, 0);
    this.previousLocalRocketPosition = new THREE.Vector3(0, EARTH_VISUAL_RADIUS + 3.5, 0);
    this.previousDirection = new THREE.Vector3(0, 1, 0);
    this.smoothedPathDirection = new THREE.Vector3(0, 1, 0);
    this.currentAltitudeM = 0;
    this.currentVelocityMps = 0;
    this.currentGeoLat = DEFAULT_LAUNCH_LAT;
    this.currentGeoLon = DEFAULT_LAUNCH_LON;
    this.surfaceLockActive = true;
    this.surfaceLockReleased = false;
    this.engineTrailPoints = [];
    this.earthRotationRate = EARTH_SIDEREAL_ROTATION_RAD_PER_SEC;
    this.launchLatitude = DEFAULT_LAUNCH_LAT;
    this.launchLongitude = DEFAULT_LAUNCH_LON;
    this.earthSpinOffset = 0;
    this.quality = 'medium';
    this.reducedMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.motionScale = this.reducedMotion ? 0.45 : 1;
    this.starLayers = [];
    this.shootingStars = [];
    this.lastSunUpdateMs = 0;
    this.simulationTimeSec = 0;
    this.hasSimulationClock = false;
    this.freeOrbit = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      yaw: 0,
      pitch: 0.34,
      distance: 38,
      minDistance: 8,
      maxDistance: 260,
      target: this.currentTarget.clone(),
      manualOffset: new THREE.Vector3(0, 0, 0),
      keyState: new Set(),
      baseMoveSpeed: 22
    };

    const ambient = new THREE.AmbientLight(0x6f8fb6, 0.58);
    const key = new THREE.DirectionalLight(0xfff4de, 1.95);
    key.position.set(120, 90, 120);
    const rim = new THREE.DirectionalLight(0x63a6ff, 0.42);
    rim.position.set(-110, 52, -82);
    const hemi = new THREE.HemisphereLight(0xa8cfff, 0x0b1224, 0.34);
    this.scene.add(ambient, key, rim, hemi);
    this.ambientLight = ambient;
    this.keyLight = key;
    this.rimLight = rim;
    this.hemiLight = hemi;

    this.sunGroup = new THREE.Group();
    this.scene.add(this.sunGroup);

    const sunCoreTexture = createSunGradientTexture(256);
    this.sunCore = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunCoreTexture,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        fog: false
      })
    );
    this.sunCore.scale.set(34, 34, 1);
    this.sunGroup.add(this.sunCore);

    const sunRaysTexture = createSunRaysTexture(512, 16);
    this.sunRays = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunRaysTexture,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        fog: false
      })
    );
    this.sunRays.scale.set(130, 130, 1);
    this.sunGroup.add(this.sunRays);

    this.earth = makeEarth(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.earth);

    this.backgroundGroup = new THREE.Group();
    this.scene.add(this.backgroundGroup);

    this.nebulaBands = buildNebulaBands();
    this.backgroundGroup.add(this.nebulaBands);

    const { rocket } = makeRocket();
    this.rocket = rocket;
    this.rocket.scale.setScalar(0.22);
    this.scene.add(this.rocket);

    this.nozzleMount = new THREE.Group();
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

    this.plumeBillboard = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffc26f,
        transparent: true,
        opacity: 0.78,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    this.plumeBillboard.position.set(0, -0.28, 0);
    this.plumeBillboard.scale.setScalar(0.24);
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
    this.earth.add(this.pathLine);

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
    this.earth.add(this.pathGlow);

    this.exhaustTrail = buildExhaustTrail();
    this.scene.add(this.exhaustTrail);

    this.nozzleLocal = new THREE.Vector3(0, -0.06, 0);

    this.rebuildSpaceEffects();
    this.setLaunchSite({ lat: DEFAULT_LAUNCH_LAT, lon: DEFAULT_LAUNCH_LON });

    this.initFreeOrbitControls();
    this.snapCamera();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  latLonToVector(latDeg, lonDeg, radius) {
    const lat = THREE.MathUtils.degToRad(latDeg);
    // Three.js sphere texture orientation is east-west flipped relative to our
    // initial mapping; invert longitude so historical sites align geographically.
    const lon = THREE.MathUtils.degToRad(-lonDeg);
    const cosLat = Math.cos(lat);
    const x = -radius * cosLat * Math.cos(lon);
    const y = radius * Math.sin(lat);
    const z = radius * cosLat * Math.sin(lon);
    return new THREE.Vector3(x, y, z);
  }

  dayOfYearUTC(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor((now - start) / 86400000);
  }

  computeSunDirectionUTC(date) {
    const utcHours = date.getUTCHours() + (date.getUTCMinutes() / 60) + (date.getUTCSeconds() / 3600);
    const dayOfYear = this.dayOfYearUTC(date);

    // Approximate solar declination and subsolar longitude from UTC.
    const decl = THREE.MathUtils.degToRad(23.44) * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
    const subsolarLatDeg = THREE.MathUtils.radToDeg(decl);
    const subsolarLonDeg = ((180 - (utcHours * 15) + 540) % 360) - 180;

    const direction = this.latLonToVector(subsolarLatDeg, subsolarLonDeg, 1).normalize();

    return {
      direction
    };
  }

  updateSunLighting(nowDate) {
    const { direction } = this.computeSunDirectionUTC(nowDate);

    this.keyLight.position.copy(direction.clone().multiplyScalar(230));
    this.rimLight.position.copy(direction.clone().multiplyScalar(-180).add(new THREE.Vector3(0, 35, 0)));
    this.ambientLight.intensity = 0.34;
    this.keyLight.intensity = 2.15;
    this.rimLight.intensity = 0.28;
    this.hemiLight.intensity = 0.28;

    this.sunGroup.position.copy(direction.clone().multiplyScalar(360));

    const surface = this.earth.userData?.surface;
    if (surface?.material) {
      surface.material.emissiveIntensity = 0.14;
    }
  }

  computeEarthSpinOffset(latDeg, lonDeg) {
    void latDeg;
    void lonDeg;
    return 0;
  }

  getEarthRotationRad() {
    const timeSec = this.hasSimulationClock ? this.simulationTimeSec : this.clock.getElapsedTime();
    return this.earthSpinOffset + (timeSec * this.earthRotationRate);
  }

  getRocketAnchoredPosition(altitudeM = 0, arcAngleRad = 0, includeEarthRotation = false) {
    const visualRadius = EARTH_VISUAL_RADIUS + ROCKET_SURFACE_OFFSET + Math.max(0, altitudeM) * ALTITUDE_VISUAL_SCALE;
    const local = this.latLonToVector(
      this.launchLatitude,
      this.launchLongitude + EARTH_TEXTURE_LONGITUDE_OFFSET_DEG - THREE.MathUtils.radToDeg(arcAngleRad),
      visualRadius
    );
    if (includeEarthRotation) {
      return local.applyAxisAngle(WORLD_Y_AXIS, this.getEarthRotationRad());
    }
    return local;
  }

  getGeoAnchoredPosition(latDeg, lonDeg, altitudeM = 0, includeEarthRotation = false) {
    const visualRadius = EARTH_VISUAL_RADIUS + ROCKET_SURFACE_OFFSET + Math.max(0, altitudeM) * ALTITUDE_VISUAL_SCALE;
    const local = this.latLonToVector(
      latDeg,
      lonDeg + EARTH_TEXTURE_LONGITUDE_OFFSET_DEG,
      visualRadius
    );
    if (includeEarthRotation) {
      return local.applyAxisAngle(WORLD_Y_AXIS, this.getEarthRotationRad());
    }
    return local;
  }

  setLaunchSite(location = {}) {
    const lat = Number.isFinite(location.lat) ? location.lat : DEFAULT_LAUNCH_LAT;
    const lon = Number.isFinite(location.lon) ? location.lon : DEFAULT_LAUNCH_LON;

    this.launchLatitude = lat;
    this.launchLongitude = lon;
    this.currentGeoLat = lat;
    this.currentGeoLon = lon;

    this.resetPath();
  }

  setQuality(level = 'medium') {
    if (!QUALITY_LEVELS[level]) return;
    if (this.quality === level) return;
    this.quality = level;
    this.rebuildSpaceEffects();
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
    this.motionScale = this.reducedMotion ? 0.45 : 1;
    this.shootingStars.forEach((star) => {
      star.visible = false;
      star.material.opacity = 0;
      star.userData.active = false;
    });
  }

  rebuildSpaceEffects() {
    const config = QUALITY_LEVELS[this.quality] || QUALITY_LEVELS.medium;

    this.starLayers.forEach((layer) => this.backgroundGroup.remove(layer));
    this.starLayers = [];

    const nearLayer = buildStarLayer(config.nearStars, 220, 440, 1.7, 0.8);
    const midLayer = buildStarLayer(config.midStars, 460, 760, 1.35, 0.66);
    const farLayer = buildStarLayer(config.farStars, 780, 1200, 1.1, 0.48);
    this.starLayers.push(nearLayer, midLayer, farLayer);
    this.starLayers.forEach((layer) => this.backgroundGroup.add(layer));

    this.nebulaBands.children.forEach((band) => {
      band.material.opacity = config.nebulaOpacity;
    });

    this.shootingStars.forEach((star) => this.scene.remove(star));
    this.shootingStars = [];
    for (let i = 0; i < config.shootingStars; i += 1) {
      const shootingStar = buildShootingStar();
      this.shootingStars.push(shootingStar);
      this.scene.add(shootingStar);
    }

    this.renderer.toneMappingExposure = 1.0 * config.plumeExposure;
    this.starTwinkleIntensity = config.twinkle;
  }

  resize() {
    const width = this.canvas.clientWidth || 1000;
    const height = this.canvas.clientHeight || 700;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setCameraMode(mode) {
    if (mode === 'free' && this.cameraMode !== 'free') {
      this.syncFreeOrbitToCamera();
    }
    this.cameraMode = mode;
    this.snapCamera();
  }

  syncFreeOrbitToCamera() {
    const offset = this.camera.position.clone().sub(this.currentTarget);
    const distance = Math.max(0.0001, offset.length());
    const direction = offset.normalize();

    this.freeOrbit.distance = THREE.MathUtils.clamp(
      distance,
      this.freeOrbit.minDistance,
      this.freeOrbit.maxDistance
    );
    this.freeOrbit.pitch = THREE.MathUtils.clamp(Math.asin(direction.y), -1.52, 1.52);
    this.freeOrbit.yaw = Math.atan2(direction.x, direction.z);
    this.freeOrbit.target.copy(this.currentTarget);
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

    window.addEventListener('keydown', (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = event.code;
      const isMoveKey = key === 'KeyW'
        || key === 'KeyA'
        || key === 'KeyS'
        || key === 'KeyD'
        || key === 'ArrowUp'
        || key === 'ArrowDown'
        || key === 'ArrowLeft'
        || key === 'ArrowRight'
        || key === 'KeyQ'
        || key === 'KeyE'
        || key === 'PageUp'
        || key === 'PageDown'
        || key === 'ShiftLeft'
        || key === 'ShiftRight';

      if (!isMoveKey) return;
      this.freeOrbit.keyState.add(key);
      if (this.cameraMode === 'free') {
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', (event) => {
      this.freeOrbit.keyState.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.freeOrbit.keyState.clear();
      this.freeOrbit.dragging = false;
    });
  }

  applyFreeOrbitKeyboardMovement(deltaSec) {
    if (this.cameraMode !== 'free' || deltaSec <= 0) return;

    const keys = this.freeOrbit.keyState;
    const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
      - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const strafeInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
      - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const verticalInput = (keys.has('KeyE') || keys.has('PageUp') ? 1 : 0)
      - (keys.has('KeyQ') || keys.has('PageDown') ? 1 : 0);

    if (forwardInput === 0 && strafeInput === 0 && verticalInput === 0) return;

    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.8 : 1;
    const zoomScaledSpeed = THREE.MathUtils.lerp(
      10,
      120,
      THREE.MathUtils.clamp(this.freeOrbit.distance / this.freeOrbit.maxDistance, 0, 1)
    );
    const moveStep = (this.freeOrbit.baseMoveSpeed + zoomScaledSpeed) * boost * deltaSec;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    if (forward.lengthSq() <= 0.000001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp);
    if (right.lengthSq() <= 0.000001) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    const movement = new THREE.Vector3();
    if (forwardInput !== 0) movement.addScaledVector(forward, forwardInput);
    if (strafeInput !== 0) movement.addScaledVector(right, strafeInput);
    if (verticalInput !== 0) movement.addScaledVector(worldUp, verticalInput);

    if (movement.lengthSq() <= 0.000001) return;
    movement.normalize().multiplyScalar(moveStep);
    this.freeOrbit.manualOffset.add(movement);
  }

  updateFreeOrbitCamera(snap = false, deltaSec = 0) {
    this.applyFreeOrbitKeyboardMovement(deltaSec);
    const desiredTarget = this.currentTarget.clone().add(this.freeOrbit.manualOffset);
    this.freeOrbit.target.lerp(desiredTarget, snap ? 1 : 0.12);

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

    this.currentArcAngleRad = 0;
    const padPosition = this.getRocketAnchoredPosition(0, this.currentArcAngleRad, true);
    const padLocalPosition = this.getRocketAnchoredPosition(0, this.currentArcAngleRad, false);
    const padNormal = padPosition.clone().normalize();
    this.rocket.position.copy(padPosition);
    this.currentTarget.copy(padPosition);
    this.rocket.scale.setScalar(0.22);
    this.rocket.quaternion.setFromUnitVectors(ROCKET_NOSE_AXIS, padNormal);
    this.previousRocketPosition.copy(this.rocket.position);
    this.previousLocalRocketPosition.copy(padLocalPosition);
    this.previousDirection.copy(padNormal);
    this.smoothedPathDirection.copy(padNormal);
    this.currentAltitudeM = 0;
    this.currentVelocityMps = 0;
    this.currentGeoLat = this.launchLatitude;
    this.currentGeoLon = this.launchLongitude;
    this.surfaceLockActive = true;
    this.surfaceLockReleased = false;
    this.simulationTimeSec = 0;
    this.hasSimulationClock = false;
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

  updateShootingStars(deltaSec) {
    if (this.reducedMotion || this.motionScale < 0.5) return;

    this.shootingStars.forEach((star) => {
      const state = star.userData;
      if (!state.active) {
        if (Math.random() < deltaSec * 0.015 * this.motionScale) {
          const startRadius = 280 + Math.random() * 260;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          state.start.set(
            startRadius * Math.sin(phi) * Math.cos(theta),
            startRadius * Math.cos(phi),
            startRadius * Math.sin(phi) * Math.sin(theta)
          );

          state.velocity
            .copy(state.start)
            .normalize()
            .multiplyScalar(-58 - Math.random() * 48)
            .add(new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12));

          state.age = 0;
          state.duration = 0.9 + Math.random() * 0.8;
          state.length = 8 + Math.random() * 7;
          state.active = true;
          star.visible = true;
        }
        return;
      }

      state.age += deltaSec;
      const life = THREE.MathUtils.clamp(state.age / state.duration, 0, 1);
      const head = state.start.clone().addScaledVector(state.velocity, state.age);
      const tail = head.clone().addScaledVector(state.velocity.clone().normalize(), -state.length);
      star.geometry.setFromPoints([tail, head]);
      star.material.opacity = (1 - life) * 0.72;

      if (life >= 1) {
        state.active = false;
        star.visible = false;
        star.material.opacity = 0;
      }
    });
  }

  updateFromSample(sample, options = {}) {
    const { appendPath = true, snapCamera = false } = options;
    const radialDistanceM = Math.hypot(sample.x, sample.y);
    const altitudeM = Math.max(0, radialDistanceM - EARTH_RADIUS_M);
    const arcAngle = Math.atan2(sample.x, sample.y);
    if (Number.isFinite(sample.tSec)) {
      this.simulationTimeSec = sample.tSec;
      this.hasSimulationClock = true;
    }
    this.currentArcAngleRad = arcAngle;
    const earthRotationRad = this.getEarthRotationRad();
    const hasGeo = Number.isFinite(sample.latDeg) && Number.isFinite(sample.lonDeg);
    const sampleLat = hasGeo ? sample.latDeg : this.launchLatitude;
    const sampleLon = hasGeo ? sample.lonDeg : this.launchLongitude;
    const localOriented = hasGeo
      ? this.getGeoAnchoredPosition(sampleLat, sampleLon, altitudeM, false)
      : this.getRocketAnchoredPosition(altitudeM, this.currentArcAngleRad, false);
    const pathAltitudeM = altitudeM * TRAJECTORY_ALTITUDE_SCALE_RATIO;
    const localPathPoint = hasGeo
        ? this.getGeoAnchoredPosition(sampleLat, sampleLon, pathAltitudeM, false)
        : this.getRocketAnchoredPosition(pathAltitudeM, this.currentArcAngleRad, false);
    const oriented = localPathPoint.clone().applyAxisAngle(WORLD_Y_AXIS, earthRotationRad);
    this.currentGeoLat = sampleLat;
    this.currentGeoLon = sampleLon;

    const missionTimeSec = Number.isFinite(sample.tSec) ? sample.tSec : 0;
    const shouldReleaseSurfaceLock = altitudeM > SURFACE_LOCK_RELEASE_ALTITUDE_M
      || sample.velocityMps > SURFACE_LOCK_RELEASE_VELOCITY_MPS
      || missionTimeSec > SURFACE_LOCK_RELEASE_TIME_SEC
      || Boolean(sample.landed);
    if (shouldReleaseSurfaceLock) {
      this.surfaceLockReleased = true;
    }
    const surfaceLock = !this.surfaceLockReleased && !sample.landed;
    this.surfaceLockActive = surfaceLock;
    const inLaunchAttitudeLock = surfaceLock
      || (missionTimeSec < ASCENT_ATTITUDE_LOCK_SEC && sample.altitudeM < 20000);

    this.previousRocketPosition.copy(this.rocket.position);

    this.rocket.position.copy(oriented);
    this.currentTarget.copy(oriented);
    this.currentAltitudeM = sample.altitudeM;
    this.currentVelocityMps = sample.velocityMps;

    const localMotion = localPathPoint.clone().sub(this.previousLocalRocketPosition);

    const readabilityScale = THREE.MathUtils.lerp(1.04, 0.68, THREE.MathUtils.clamp(sample.altitudeM / 260000, 0, 1));
    this.rocket.scale.setScalar(0.22 * readabilityScale);

    const radialOutward = this.currentTarget.clone().normalize();
    if (inLaunchAttitudeLock) {
      const attitude = new THREE.Quaternion().setFromUnitVectors(ROCKET_NOSE_AXIS, radialOutward);
      this.rocket.quaternion.copy(attitude);
      this.previousDirection.copy(radialOutward);
    } else if (localMotion.lengthSq() > 0.0000001) {
      const tangentWorld = localMotion.normalize().applyAxisAngle(WORLD_Y_AXIS, earthRotationRad);
      const blendStartSec = ASCENT_ATTITUDE_LOCK_SEC;
      const blendFactor = THREE.MathUtils.clamp(
        (missionTimeSec - blendStartSec) / TANGENT_BLEND_DURATION_SEC,
        0,
        1
      );
      const noseDirection = radialOutward.clone().lerp(tangentWorld, blendFactor).normalize();
      const attitude = new THREE.Quaternion().setFromUnitVectors(ROCKET_NOSE_AXIS, noseDirection);
      this.rocket.quaternion.copy(attitude);
      this.previousDirection.copy(noseDirection);
    } else {
      const fallbackDirection = this.previousDirection.lengthSq() > 0.0000001
        ? this.previousDirection
        : radialOutward;
      const attitude = new THREE.Quaternion().setFromUnitVectors(ROCKET_NOSE_AXIS, fallbackDirection);
      this.rocket.quaternion.copy(attitude);
    }

    if (appendPath) {
      this.pathPoints.push(localPathPoint.clone());
    }
    this.previousLocalRocketPosition.copy(localPathPoint);
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
      const thrustRatio = Number.isFinite(sample.thrustRatio) ? Math.max(0.05, sample.thrustRatio) : 1;
      const flickerScale = this.reducedMotion ? 0.45 : 1;
      const flicker = 0.75 + Math.sin(performance.now() * 0.022 * flickerScale) * 0.17 * flickerScale;
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
        const pulse = 0.82 + Math.sin(performance.now() * 0.016 + i * 0.7) * 0.22 * (this.reducedMotion ? 0.4 : 1);
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
      this.updateFreeOrbitCamera(true, 0);
      return;
    }

    const desired = this.getDesiredCameraPosition();
    this.camera.position.copy(desired);
    this.camera.lookAt(this.currentTarget);
  }

  updateCamera(snapCamera = false) {
    if (this.cameraMode === 'free') {
      this.updateFreeOrbitCamera(snapCamera, 0);
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
    const nowMs = performance.now();
    const deltaSec = Math.min(0.05, Math.max(0, (nowMs - this.lastRenderMs) / 1000));
    this.lastRenderMs = nowMs;
    const t = this.clock.getElapsedTime();

    if ((nowMs - this.lastSunUpdateMs) > 1000) {
      this.updateSunLighting(new Date());
      this.lastSunUpdateMs = nowMs;
    }
    if (this.cameraMode === 'free') {
      this.updateFreeOrbitCamera(false, deltaSec);
    }

    const twinkle = this.starTwinkleIntensity * this.motionScale;
    if (this.starLayers[0]) {
      this.starLayers[0].rotation.y += 0.00018 * this.motionScale;
      this.starLayers[0].material.opacity = 0.72 + Math.sin(t * 0.62) * 0.06 * twinkle;
    }
    if (this.starLayers[1]) {
      this.starLayers[1].rotation.y -= 0.00009 * this.motionScale;
      this.starLayers[1].rotation.x = Math.sin(t * 0.08) * 0.04;
      this.starLayers[1].material.opacity = 0.61 + Math.sin(t * 0.47 + 0.6) * 0.045 * twinkle;
    }
    if (this.starLayers[2]) {
      this.starLayers[2].rotation.y += 0.00005 * this.motionScale;
      this.starLayers[2].material.opacity = 0.44 + Math.sin(t * 0.33 + 1.8) * 0.03 * twinkle;
    }

    this.pathMaterial.opacity = 0.5 + Math.sin(t * 0.7) * 0.06;
    this.pathGlowMaterial.opacity = 0.28 + Math.sin(t * 0.6 + 0.25) * 0.05;

    this.earth.rotation.y = this.getEarthRotationRad();
    if (this.surfaceLockActive) {
      const surfaceLockAltitudeM = this.currentAltitudeM * TRAJECTORY_ALTITUDE_SCALE_RATIO;
      const anchoredPosition = this.getGeoAnchoredPosition(
        this.currentGeoLat,
        this.currentGeoLon,
        surfaceLockAltitudeM,
        true
      );
      const anchoredNormal = anchoredPosition.clone().normalize();
      this.rocket.position.copy(anchoredPosition);
      this.currentTarget.copy(anchoredPosition);
      this.rocket.quaternion.setFromUnitVectors(ROCKET_NOSE_AXIS, anchoredNormal);
      this.previousRocketPosition.copy(this.rocket.position);
      this.previousDirection.copy(anchoredNormal);
      this.smoothedPathDirection.copy(anchoredNormal);
    }
    if (this.earth.userData.cloudBand) {
      this.earth.userData.cloudBand.rotation.y += 0.00022 * this.motionScale;
      this.earth.userData.cloudBand.material.opacity = 0.14 + Math.sin(t * 0.4) * 0.03 * this.motionScale;
    }

    if (this.earth.userData.atmosphere) {
      this.earth.userData.atmosphere.material.opacity = 0.15 + Math.sin(t * 0.27 + 0.2) * 0.015 * this.motionScale;
    }

    if (this.nebulaBands) {
      this.nebulaBands.rotation.y += 0.00003 * this.motionScale;
      this.nebulaBands.rotation.z = Math.sin(t * 0.05) * 0.06;
    }

    if (this.sunRays) {
      this.sunRays.material.rotation += 0.0008 * this.motionScale;
      this.sunRays.material.opacity = 0.52 + Math.sin(t * 0.7) * 0.08;
    }

    this.updateShootingStars(deltaSec);

    this.renderer.render(this.scene, this.camera);
  }
}

