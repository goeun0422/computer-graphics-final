<img width="1470" height="956" alt="img5" src="https://github.com/user-attachments/assets/deedcd5c-1aa6-41f1-a098-3f92ab982bb9" />
<img width="1470" height="956" alt="img1" src="https://github.com/user-attachments/assets/767917d7-e827-4d45-a0dd-ec977db6a0b3" />
<img width="1470" height="956" alt="img4" src="https://github.com/user-attachments/assets/5400de57-fac6-4f08-9460-21cdba90be12" />
<img width="1470" height="956" alt="img3" src="https://github.com/user-attachments/assets/e61e75df-e6ac-4f44-aa35-58b0f8202f1e" />

# [최종 과제] Dodge the Spheres: 1인칭 서바이벌 게임

**이름:** 이고은
**학번:** 2024404017
**소속:** 정보융합학부

## 1. 게임 기획 및 개발 상세

### 1.1. 게임 기획 및 컨셉
'Dodge the Spheres'는 1인칭 시점의 미니멀리스트 3D 생존 회피 게임입니다. 어두운 공간 속에서 무작위로 생성되어 플레이어를 향해 날아오는 구체(Spheres)들을 피하며 최대한 오래 살아남는 것이 목표입니다. 
- **조작 방법**: WASD 키를 이용한 평면 이동 및 마우스를 이용한 1인칭 시점(PointerLockControls) 전환.
- **게임 루프**: 'Ready' -> 'Playing' -> 'Game Over'의 3단계 페이즈로 구성되어 있으며, 생존 시간(Score)과 최고 기록(Best)이 UI로 제공됩니다.

### 1.2. 개발 기술 및 환경
- **라이브러리**: React, Three.js, TanStack Router
- **렌더링**: WebGL 기반 래스터라이저(`THREE.WebGLRenderer`) 사용, 안티앨리어싱(Antialias) 및 PCFSoftShadowMap 그림자 렌더링 적용.

* **웹 구동 링크:** [https://stackblitz.com/github/goeun0422/computer-graphics-final](https://stackblitz.com/github/goeun0422/computer-graphics-final)

<img width="1470" height="956" alt="img1" src="https://github.com/user-attachments/assets/767917d7-e827-4d45-a0dd-ec977db6a0b3" />
*그림 1: 어두운 방 안에서 구체들이 날아오고 있는 역동적인 전체 플레이 대기 화면*

---

## 2. 컴퓨터그래픽스 강의 내용과 구현 내용 매핑

### 2.1. Rasterization 파이프라인 및 애니메이션 적용
강의에서 다룬 래스터라이제이션(Rasterization)은 3D 씬의 정점(Vertices)과 프리미티브(Primitives)를 2D 화면의 픽셀(Fragments)로 변환하는 핵심 그래픽스 파이프라인입니다. 본 게임에서는 `WebGLRenderer`를 사용하여 3D 공간의 구체 기하학(Geometry) 데이터를 매 프레임 모니터 화면의 픽셀로 변환하여 출력합니다. `renderer.setPixelRatio`와 `antialias: true` 속성을 통해 픽셀 계단 현상(Jaggies)을 완화하여 자연스러운 래스터라이제이션 결과물을 얻었습니다.
또한 시간의 흐름에 따라 3D 공간상 객체에 Local Transform을 적용하는 애니메이션 기법을 활용하여, 매 프레임 구체 벡터에 Translation(이동 변환)을 가해 플레이어 방향으로 지속적으로 다가오는 동적 장애물 애니메이션을 구현했습니다.

### 2.2. 계층적 씬 그래프(Scene Graph)와 손전등(Flashlight) 메커니즘
3D 씬은 계층적인 노드 구조인 씬 그래프로 구성되며, 모델 변환(Model Transform)은 이 트리를 기반으로 이루어집니다. 본 게임은 `THREE.Scene`을 루트 노드로 하여 환경광, 구체, 프로브를 자식으로 가집니다.
특히 1인칭 시점의 현실적인 몰입감을 위해 카메라(`PerspectiveCamera`) 객체에 손전등 역할을 하는 직접광인 `PointLight`를 자식 노드로 추가(`camera.add(flashlight)`)하였습니다. 이를 통해 카메라의 Local Transform(이동 및 회전)이 변경될 때마다 손전등 조명도 부모 노드인 카메라의 변환 행렬을 그대로 상속받아 함께 이동하고 회전합니다. 마우스를 움직여 시점을 돌릴 때 플래시라이트가 시야가 향하는 벽면과 구체를 정확하게 비추는 계층적 씬 그래프 구조를 완벽하게 증명했습니다.

### 2.3. 물리 기반 조명(Lighting)과 셰이딩(Shading)
빛과 표면의 물리적 상호작용을 처리하기 위해 `MeshStandardMaterial`을 사용하여 물리 기반 렌더링(PBR)을 구현했습니다. 아주 어두운 씬 배경광 위에 카메라에 부착된 강렬한 `PointLight`(색상: 0xfff1d0)가 직접광(Direct Lighting)으로 작용합니다.
플래시라이트의 빛이 다가오는 구체에 부딪힐 때, 정반사(Specular Highlight)가 발생하여 표면에 미려한 광택이 맺히며, 빛이 닿지 않는 반대편은 Shaded Side로 어둡게 처리됩니다. 또한 빛이 물체에 막히는 공간에는 그림자 맵(`shadowMap`) 기술을 활성화하고 `PCFSoftShadowMap`을 적용하여 동적인 실시간 그림자(Shadow)를 부드럽고 명확하게 표현했습니다.

<img width="1470" height="956" alt="img5" src="https://github.com/user-attachments/assets/deedcd5c-1aa6-41f1-a098-3f92ab982bb9" />
*그림 2: 플래시라이트를 받아 구체 표면에 광택(Specular Highlight)이 맺혀 있고, 그 뒤로 길게 바닥에 실시간 그림자(Shadow)가 드리워진 장면*

---

## 3. Global Illumination (DDGI) 기술 적용

본 과제의 핵심 기술 요건인 **GI 기술(DDGI)**을 게임 내에 구현하였습니다. 직접광(Direct Lighting)만으로는 현실적인 빛의 퍼짐을 표현하기 어려워, 공간 내에서 빛이 반사되어 들어오는 간접광(Indirect Lighting) 시뮬레이션이 필수적입니다. 본 게임은 공간을 샘플링하는 프로브 기반의 DDGI 기법을 적용했습니다.

* **프로브 볼륨(Probe Volume) 생성:** 무한한 빛의 반사를 근사하기 위해 공간 전체를 덮는 3D 격자 형태의 프로브를 배치했습니다. 각 프로브는 간접광을 내뿜는 `PointLight`와 시각화용 `Mesh`를 포함합니다.
* **실시간 레이캐스팅 및 간접광 표현:** 프루브에서 사방으로 Ray를 쏘아 플레이어(광원)와의 거리 및 반사광을 계산합니다. 단일 플래시라이트에서 발생한 빛이 벽면이나 바닥에 부딪힌 뒤, 빛이 직접 닿지 않는 구체의 어두운 뒷면이나 구석진 공간까지 빛이 반사되어 묻어나는 동적 난반사(Diffuse) 간접 조명 효과를 시뮬레이션 하였습니다.
* **디버그 모드 (P키 토글 구현):** 채점 시 GI 기술 적용 여부를 시각적으로 명확하게 확인하실 수 있도록, 게임 구동 중 `P`키를 누르면 숨겨져 있던 프로브 격자(Wireframe)가 화면에 나타나는 토글 기능을 추가했습니다.

<img width="1470" height="956" alt="img3" src="https://github.com/user-attachments/assets/e61e75df-e6ac-4f44-aa35-58b0f8202f1e" />
*그림 3: P키를 눌러 활성화한 DDGI 프로브 격자 시각화 모습. 공간 전체에 배치된 프로브가 빛을 연산하며, 간접광 효과로 인해 완전한 암흑이 아니라 바닥의 색상이 은은하게 반사됨.*

---

## 4. 플레이 방법 및 결론

* **조작 방법:** WASD(이동), 마우스(시야 회전)
* **시작 및 재시작:** 화면 클릭, Space, 또는 Enter
* **디버그 모드:** P 키 (DDGI 프로브 격자 시각화 켜기/끄기)

![게임 오버 및 HUD 화면 캡처](./images/img4.jpg)
*그림 4: Game Over 시 최고 기록(Best)과 현재 생존 시간을 보여주는 UI*
