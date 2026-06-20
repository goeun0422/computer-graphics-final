import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dodge the Spheres — First Person" },
      { name: "description", content: "A minimalist first-person Three.js game: dodge incoming spheres in a dark room." },
      { property: "og:title", content: "Dodge the Spheres" },
      { property: "og:description", content: "Minimalist first-person dodging game built with Three.js." },
    ],
  }),
  component: Game,
});

type GameState = "ready" | "playing" | "gameover";

function Game() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  // bridges from three.js world → React
  const tryStartRef = useRef<() => void>(() => {});

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.Fog(0x05060a, 6, 22);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.03);
    scene.add(ambient);

    const flashlight = new THREE.PointLight(0xfff1d0, 3.2, 18, 1.4);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.set(1024, 1024);
    flashlight.shadow.bias = -0.0008;
    flashlight.position.set(0, 0, -0.2);
    camera.add(flashlight);
    scene.add(camera);

    const ddgiProbes = [];
    const probeGeo = new THREE.SphereGeometry(0.15, 4, 4); // 리포트 캡처용 가시화 메쉬
    const probeSpacing = 6; // 프루브 간격

    // 1. 공간 전체를 덮는 3D 격자(Grid) 형태의 프루브 볼륨 생성
    for (let x = -8; x <= 8; x += probeSpacing) {
      for (let y = 1; y <= 3; y += 2) {
        for (let z = -8; z <= 8; z += probeSpacing) {
          // 실제 간접광을 내뿜을 PointLight
          const light = new THREE.PointLight(0xffffff, 0, probeSpacing * 1.5);
          light.position.set(x, y, z);
          scene.add(light);

          // 디버깅 및 리포트 캡처용 와이어프레임 (프루브의 위치와 색상을 시각적으로 보여줌)
          const mesh = new THREE.Mesh(
            probeGeo,
            new THREE.MeshBasicMaterial({ color: 0x555555, wireframe: true })
          );
          mesh.visible = false;
          mesh.position.set(x, y, z);
          scene.add(mesh);

          ddgiProbes.push({ light, mesh, basePos: new THREE.Vector3(x, y, z) });
        }
      }
    }

    // 레이캐스팅 방향 (사방으로 빛의 반사를 추적)
    const ddgiRaycaster = new THREE.Raycaster();
    const ddgiDirs = [
      new THREE.Vector3(0, -1, 0), // 바닥
      new THREE.Vector3(1, 0, 0),  // 벽면들
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
    let probeUpdateIndex = 0;

    scene.add(camera);

    // Room
    const ROOM = 18;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xdedcd6, roughness: 0.95 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a857c, roughness: 1.0 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xbab7b0, roughness: 1.0 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    const wallGeo = new THREE.PlaneGeometry(ROOM, 4);
    const walls: THREE.Mesh[] = [];
    const makeWall = (x: number, z: number, ry: number) => {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x, 2, z);
      w.rotation.y = ry;
      w.receiveShadow = true;
      scene.add(w);
      walls.push(w);
    };
    makeWall(0, -ROOM / 2, 0);
    makeWall(0, ROOM / 2, Math.PI);
    makeWall(-ROOM / 2, 0, Math.PI / 2);
    makeWall(ROOM / 2, 0, -Math.PI / 2);

    // Controls
    const controls = new PointerLockControls(camera, renderer.domElement);

    const keys: Record<string, boolean> = {};

    // -------- Game State Machine --------
    let gameState: GameState = "ready";
    const setState = (next: GameState) => {
      if (gameState === next) return;
      gameState = next;
      setPhase(next);
    };

    // Obstacles
    type Sphere = { mesh: THREE.Mesh; vel: THREE.Vector3; radius: number };
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff4d4d,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x220000,
    });
    const spheres: Sphere[] = [];

    const playerPos = new THREE.Vector3();
    let spawnTimer = 0;
    let elapsed = 0;
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const forward = new THREE.Vector3();

    const spawnSphere = () => {
      const radius = 0.35 + Math.random() * 0.25;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), sphereMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const edge = Math.floor(Math.random() * 4);
      const t = (Math.random() - 0.5) * (ROOM - 2);
      const off = ROOM / 2 - 0.6;
      const pos = new THREE.Vector3();
      if (edge === 0) pos.set(t, radius, -off);
      else if (edge === 1) pos.set(off, radius, t);
      else if (edge === 2) pos.set(t, radius, off);
      else pos.set(-off, radius, t);
      mesh.position.copy(pos);

      camera.getWorldPosition(playerPos);
      const dir = new THREE.Vector3().subVectors(playerPos, pos);
      dir.y = 0;
      dir.normalize();
      const speed = 2.2 + Math.random() * 1.6;
      spheres.push({ mesh, vel: dir.multiplyScalar(speed), radius });
      scene.add(mesh);
    };

    // Safe disposal — geometries are unique per sphere, material is shared
    const clearObstacles = () => {
      for (const s of spheres) {
        s.mesh.removeFromParent();
        s.mesh.geometry.dispose();
      }
      spheres.length = 0;
    };

    const resetWorld = () => {
      clearObstacles();
      controls.object.position.set(0, 1.6, 0);
      camera.rotation.set(0, 0, 0);
      velocity.set(0, 0, 0);
      spawnTimer = 0;
      elapsed = 0;
      setScore(0);
    };

    const startGame = () => {
      resetWorld();
      setState("playing");
      if (!controls.isLocked) controls.lock();
    };

    const gameOver = () => {
      setState("gameover");
      setBest((b) => Math.max(b, Math.floor(elapsed)));
      if (controls.isLocked) controls.unlock();
    };

    // Unified input entry — click / Space / Enter
    const tryStart = () => {
      if (gameState === "ready" || gameState === "gameover") startGame();
    };
    tryStartRef.current = tryStart;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        tryStart();
        return;
      }
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onCanvasClick = () => tryStart();
    renderer.domElement.addEventListener("click", onCanvasClick);

    // Pointer lock dropping (Esc) while playing → gameover
    controls.addEventListener("unlock", () => {
      if (gameState === "playing") gameOver();
    });

    // -------- Loop --------
    let prev = performance.now();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;

      if (gameState === "playing") {
        elapsed += dt;
        setScore(Math.floor(elapsed));

        // Movement
        const speed = 4.0;
        direction.set(
          (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0),
          0,
          (keys["KeyS"] ? 1 : 0) - (keys["KeyW"] ? 1 : 0)
        );
        if (direction.lengthSq() > 0) direction.normalize();
        velocity.x = direction.x * speed;
        velocity.z = direction.z * speed;
        controls.moveRight(velocity.x * dt);
        controls.moveForward(-velocity.z * dt);

        const p = controls.object.position;
        const bound = ROOM / 2 - 0.5;
        p.x = Math.max(-bound, Math.min(bound, p.x));
        p.z = Math.max(-bound, Math.min(bound, p.z));

        // Spawn
        spawnTimer += dt;
        if (spawnTimer > 1.1) {
          spawnTimer = 0;
          spawnSphere();
        }

        // Update spheres + collision
        camera.getWorldPosition(playerPos);
        for (let i = spheres.length - 1; i >= 0; i--) {
          const s = spheres[i];
          s.mesh.position.x += s.vel.x * dt;
          s.mesh.position.z += s.vel.z * dt;
          s.mesh.rotation.x += (s.vel.z * dt) / s.radius;
          s.mesh.rotation.z -= (s.vel.x * dt) / s.radius;

          const dx = s.mesh.position.x - playerPos.x;
          const dz = s.mesh.position.z - playerPos.z;
          const hit = s.radius + 0.4;
          if (dx * dx + dz * dz < hit * hit) {
            gameOver();
            break;
          }

          const lim = ROOM / 2 + 2;
          if (Math.abs(s.mesh.position.x) > lim || Math.abs(s.mesh.position.z) > lim) {
            s.mesh.removeFromParent();
            s.mesh.geometry.dispose();
            spheres.splice(i, 1);
          }
        }
      }

      camera.getWorldPosition(playerPos);
      
      // 매 프레임 모든 프루브를 계산하면 버벅이므로, 프레임당 3개씩 분산 처리 (최적화)
      for(let i = 0; i < 3; i++) {
        const probe = ddgiProbes[probeUpdateIndex];
        if(!probe) break;

        let totalIllumination = 0;
        
        // 프루브에서 주변으로 Ray를 쏴서 플레이어(광원)와의 거리 및 반사광 계산
        for(const dir of ddgiDirs) {
          ddgiRaycaster.set(probe.basePos, dir);
          const hits = ddgiRaycaster.intersectObjects([...walls, floor, ceiling], false);
          
          if(hits.length > 0) {
            const distToPlayer = probe.basePos.distanceTo(playerPos);
            // 광원(플레이어)이 가까울수록 간접광 에너지가 강해짐
            if(distToPlayer < 8) {
               totalIllumination += Math.max(0, 1.0 - (distToPlayer / 8));
            }
          }
        }

        // 수집된 빛 에너지를 바탕으로 프루브의 색상과 밝기 업데이트
        if(totalIllumination > 0.1) {
          const intensity = totalIllumination * 0.4;
          probe.light.intensity = intensity;
          
          // 바닥과 벽의 반사광 톤(따뜻한 색)을 띄게 만듦
          const r = Math.min(1.0, 1.0 * intensity);
          const g = Math.min(1.0, 0.8 * intensity);
          const b = Math.min(1.0, 0.6 * intensity);
          
          probe.light.color.setRGB(r, g, b);
          probe.mesh.material.color.copy(probe.light.color); // 디버그 메쉬도 같은 색으로 빛남!
        } else {
          probe.light.intensity = 0;
          probe.mesh.material.color.setHex(0x222222); // 빛이 닿지 않으면 어두워짐
        }

        probeUpdateIndex = (probeUpdateIndex + 1) % ddgiProbes.length;
      }

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      clearObstacles();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Crosshair — only while playing */}
      {phase === "playing" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      )}

      {/* HUD — only while playing */}
      {phase === "playing" && (
        <div className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 text-center">
          <p className="text-sm font-light uppercase tracking-[0.3em] text-white/80">
            공을 피해야 한다
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/40">
            Score · {score}s
          </p>
        </div>
      )}

      {/* Ready overlay */}
      {phase === "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-w-sm text-center text-white">
            <h1 className="text-2xl font-light tracking-wide">Dodge the Spheres</h1>
            <p className="mt-3 text-sm text-white/60">
              WASD to move · Mouse to look
            </p>
            <button
              onClick={() => tryStartRef.current()}
              className="mt-6 rounded-md border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.25em] text-white/80 transition hover:bg-white/10"
            >
              Start
            </button>
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/40">
              Click · Space · Enter
            </p>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {phase === "gameover" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="max-w-sm text-center text-white">
            <h1 className="text-2xl font-light tracking-wide">Game Over</h1>
            <p className="mt-3 text-sm text-white/60">
              Score · {score}s &nbsp;·&nbsp; Best · {best}s
            </p>
            <button
              onClick={() => tryStartRef.current()}
              className="mt-6 rounded-md border border-white/30 px-6 py-2 text-sm uppercase tracking-[0.25em] text-white/80 transition hover:bg-white/10"
            >
              Replay
            </button>
            <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/40">
              Click · Space · Enter
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
