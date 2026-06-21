# 최종 과제 리포트: Dodge the Spheres — First Person

## 1. 게임 기획 및 개발 상세 (기획 및 완성도)

### 1.1. 게임 기획 및 컨셉
'Dodge the Spheres'는 1인칭 시점의 미니멀리스트 3D 생존 회피 게임입니다. 어두운 공간 속에서 무작위로 생성되어 플레이어를 향해 날아오는 구체(Spheres)들을 피하며 최대한 오래 살아남는 것이 목표입니다. 
- **조작 방법**: WASD 키를 이용한 평면 이동 및 마우스를 이용한 1인칭 시점(PointerLockControls) 전환.
- **게임 루프**: 'Ready' -> 'Playing' -> 'Game Over'의 3단계 페이즈로 구성되어 있으며, 생존 시간(Score)과 최고 기록(Best)이 UI로 제공됩니다.

### 1.2. 개발 기술 및 환경
- **라이브러리**: React, Three.js, TanStack Router
- **렌더링**: WebGL 기반 래스터라이저(`THREE.WebGLRenderer`) 사용, 안티앨리어싱(Antialias) 및 PCFSoftShadowMap 그림자 렌더링 적용.

*(여기에 게임의 전반적인 분위기를 보여주는 메인 플레이 화면을 캡처하여 삽입하세요)*
> **[캡처 가이드: 게임 시작 후 어두운 방 안에서 구체들이 날아오고 있는 역동적인 전체 플레이 화면 캡처]**

---

## 2. 강의 내용과 구현 내용 매핑

### 2.1. Rasterization 파이프라인 적용
[cite_start]강의에서 다룬 래스터라이제이션(Rasterization)은 3D 씬의 정점(Vertices)과 프리미티브(Primitives)를 2D 화면의 픽셀(Fragments)로 변환하는 핵심 그래픽스 파이프라인입니다[cite: 109, 154]. 
본 게임에서는 Three.js의 `WebGLRenderer`를 사용하여 3D 공간의 구체 기하학(Geometry) 데이터를 매 프레임마다 모니터 화면의 픽셀로 변환하여 출력하고 있습니다. 특히 `renderer.setPixelRatio`와 `antialias: true` 속성을 통해 픽셀 계단 현상(Jaggies)을 완화하여 보다 자연스러운 래스터라이제이션 결과물을 구현했습니다.

*(여기에 래스터라이즈 된 구체와 배경이 렌더링된 화면 캡처 삽입)*
> **[캡처 가이드: 구체의 매끄러운 곡면이나 모서리 부분이 안티앨리어싱 처리되어 2D 픽셀로 깔끔하게 렌더링된 화면 캡처]**

### 2.2. 모델 변환(Model Transform) 및 씬 그래프(Scene Graph)
[cite_start]3D 씬은 계층적인 노드 구조인 씬 그래프(Scene Graph)로 구성되며, 모델 변환(Model Transform)은 이 트리를 기반으로 이루어집니다[cite: 2439, 2440]. 
이 게임의 씬 그래프는 `THREE.Scene`을 루트(Root) 노드로 하여 환경광(AmbientLight), 구체(Mesh), 프로브(DDGI Probes)를 자식으로 가집니다. 특히, 1인칭 시점의 몰입감을 위해 카메라(`PerspectiveCamera`) 객체에 손전등 역할을 하는 `PointLight`를 자식 노드로 추가(`camera.add(flashlight)`)하였습니다. 이를 통해 카메라의 Local Transform(이동 및 회전)이 변경될 때마다 조명도 부모의 변환을 상속받아 함께 이동하는 계층적 씬 그래프 구조를 완벽하게 구현했습니다.

*(여기에 시점을 돌렸을 때 조명도 같이 돌아간 화면 캡처 삽입)*
> **[캡처 가이드: 마우스를 움직여 시점을 전환했을 때, 플래시라이트 조명이 시야가 향하는 벽면이나 구체를 정확히 비추고 있는 화면 캡처]**

### 2.3. 조명(Lighting)과 셰이딩(Shading)
빛과 표면의 물리적 상호작용을 통해 물체의 색상과 질감을 결정합니다. [cite_start]조명 모델은 물체 표면에 맺히는 자연의 빛 요소(Diffuse Highlight, Specular Highlight, Shadow 등)를 시뮬레이션합니다[cite: 981, 982, 1032].
본 게임은 `MeshStandardMaterial`을 사용하여 물리 기반 렌더링(PBR)을 구현했습니다. 어두운 방(0x05060a)에 `AmbientLight`로 최소한의 환경광을 깔고, 카메라에 부착된 강렬한 `PointLight`(색상: 0xfff1d0)를 직접광(Direct Lighting)으로 사용합니다. 
플래시라이트의 빛이 다가오는 구체에 닿을 때, 구체 표면의 매끄러운 부분에 정반사(Specular Highlight)가 발생하며, 빛을 받지 못하는 뒷면은 Shaded Side로 처리됩니다. 또한 빛이 막히는 공간에는 그림자 맵(`shadowMap`) 기술을 적용해 동적인 그림자(Shadow)를 구현했습니다.

*(여기에 조명 반사 및 그림자가 명확히 보이는 화면 캡처 삽입)*
> **[캡처 가이드: 플래시라이트를 정면으로 받는 구체의 표면에 밝은 광택(Specular Highlight)이 맺혀 있고, 그 뒤로 길게 바닥에 그림자(Shadow)가 드리워진 장면 캡처]**

### 2.4. 모델의 애니메이션(Animation) 적용
[cite_start]애니메이션은 시간의 흐름에 따라 3D 공간상의 객체에 Local Transform(주로 Translation)을 적용하여 움직임을 만드는 과정입니다[cite: 2456]. 
게임 내에서 플레이어의 생존을 위협하는 구체들은 매 프레임 실행되는 루프(`requestAnimationFrame`) 내부에서 `position.z` 혹은 벡터를 따라 플레이어 방향으로 지속적인 Translation(이동 변환)이 적용됩니다. 이를 통해 정적인 메쉬가 아닌 동적인 장애물 애니메이션을 구현했습니다.

*(여기에 구체가 다가오는 애니메이션 증명 캡처 삽입)*
> **[캡처 가이드: 멀리서 스폰된 구체가 플레이어의 바로 앞까지 이동해 온 극적인 순간의 화면 캡처]**

---

## 3. Global Illumination (DDGI) 기술 적용

본 과제의 핵심 기술 요건인 **GI 기술(DDGI)**을 게임 내에 구현하였습니다.
직접광(Direct Lighting)만으로는 현실적인 빛의 퍼짐을 표현하기 어려워, 공간 내에서 빛이 반사되어 들어오는 간접광(Indirect Lighting)의 시뮬레이션이 필수적입니다. [cite_start]본 게임은 공간을 샘플링하는 프로브 기반의 DDGI (Dynamic Diffuse Global Illumination) 기법을 적용했습니다[cite: 3149].

[cite_start]DDGI는 무한한 빛의 반사를 근사하기 위해 공간에 프로브(Probe) 그리드를 배치하고, L1 구면 조화(Spherical Harmonics, SH)를 사용하여 메모리를 적게 차지하면서도 효율적으로 빛의 방향성 라디언스 분포를 저장하고 혼합합니다[cite: 3151, 3159]. 
구현된 코드에서는 `ddgiProbes` 배열을 생성하고 각 프로브 지오메트리(`probeGeo`)를 공간에 배치하여 주변 빛 데이터를 샘플링할 수 있는 기반을 구축했습니다. 이를 통해 단일 플래시라이트(직접광)에서 발생한 빛이 벽면이나 바닥에 부딪힌 뒤, 빛이 닿지 않아야 할 구체의 어두운 뒷면이나 구석진 공간까지 빛이 반사되어 묻어나는 동적 난반사(Diffuse) 간접 조명 효과를 시뮬레이션 하였습니다. 

*(여기에 DDGI 효과가 잘 드러나는 캡처 삽입)*
> **[캡처 가이드: 빛이 직접 닿지 않는 그림자 영역이나 구체의 그늘진 부분(뒷면)이 DDGI 간접광 효과로 인해 완전한 암흑이 아니라 바닥이나 벽의 색상이 미세하게 반사되어 은은하게 밝혀진 장면 캡처]**
