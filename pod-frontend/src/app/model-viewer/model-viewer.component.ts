import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-model-viewer',
  standalone: true,
  template: `<div #viewerContainer class="viewer-container"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .viewer-container { width: 100%; height: 100%; min-height: 240px; border-radius: 1.5rem; overflow: hidden; }
  `]
})
export class ModelViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('viewerContainer') viewerContainer!: ElementRef<HTMLDivElement>;
  @Input() modelUrl?: string;
  @Input() modelFormat?: 'glb' | 'gltf' | 'stl' | '3mf';
  /** CSS colour applied to the model material, e.g. the filament colour being ordered. */
  @Input() modelColor?: string;
  @Input() autoRotate = false;
  @Input() autoRotateSpeed = 1;
  @Input() sourceUpAxis: 'x' | 'y' | 'z' = 'z';
  @Output() loadStateChange = new EventEmitter<ModelLoadState>();
  @Output() loadProgress = new EventEmitter<number>();

  private readonly isBrowser: boolean;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId?: number;
  private activeModel?: THREE.Object3D;
  private readonly zAxis = new THREE.Vector3(0, 0, 1);
  private readonly timer = new THREE.Timer();

  // Define your brand material once to reuse it
  private brandMaterial = new THREE.MeshStandardMaterial({
    color: 0x3ea37f,
    roughness: 0.5,
    metalness: 0.1
  });

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (!this.isBrowser) {
      return;
    }

    if (!this.initThreeJs()) {
      return;
    }
    if (this.modelUrl) {
      this.loadModel(this.modelUrl);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const nextModelUrl = changes['modelUrl']?.currentValue;

    if (changes['modelColor'] && this.modelColor) {
      this.brandMaterial.color.set(this.modelColor);
    }

    if (!this.isBrowser || !this.renderer) {
      return;
    }

    if (changes['sourceUpAxis'] && this.activeModel) {
      this.applyUpAxisCorrection(this.activeModel);
      this.centerCameraOnObject(this.activeModel);
    }

    if (nextModelUrl) {
      this.loadModel(nextModelUrl);
    }
  }

  /** Sets up renderer, lights and controls; false when the browser cannot provide WebGL. */
  private initThreeJs(): boolean {
    const container = this.viewerContainer.nativeElement;

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.up.set(0, 0, 1);

    // Browsers without WebGL (and jsdom in unit tests) cannot create a context; the page must
    // still work without the 3D preview, so report the failure instead of throwing.
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      console.warn('WebGL is not available, the 3D preview is disabled.', error);
      this.setLoadingState('error');
      return false;
    }
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.timer.connect(document);

    // Soft base light so the model never goes fully black
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x111827, 1.1);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(120, -80, 180);
    this.scene.add(keyLight);

    // Neutral fill: a tinted fill light colours the shadow side of dark models.
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(-140, 120, 90);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-40, -120, 160);
    this.scene.add(rimLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.enableZoom = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 100;

    this.animate();
    window.addEventListener('resize', this.onResize);
    return true;
  }

  private loadModel(modelUrl: string) {
    const extension = this.modelFormat ?? modelUrl.split('.').pop()?.toLowerCase();
    this.setLoadingState('loading');
    this.loadProgress.emit(0);

    const onProgress = (event: ProgressEvent<EventTarget>) => {
      this.emitProgress(event);
    };

    const onError = () => {
      this.setLoadingState('error');
    };

    if (extension === 'glb' || extension === 'gltf') {
      const loader = new GLTFLoader();
      loader.load(modelUrl, (gltf) => {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = this.brandMaterial;
          }
        });

        this.setActiveModel(gltf.scene);
        this.finishLoading();
      }, onProgress, onError);

    } else if (extension === 'stl') {
      const loader = new STLLoader();
      loader.load(modelUrl, (geometry) => {
        geometry.center();
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, this.brandMaterial);
        this.setActiveModel(mesh);
        this.finishLoading();
      }, onProgress, onError);

    } else if (extension === '3mf') {
      const loader = new ThreeMFLoader();
      loader.load(modelUrl, (object) => {

        // 3MF files load as a Group of meshes. Traverse them to override the material.
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = this.brandMaterial;
          }
        });

        this.setActiveModel(object);
        this.finishLoading();
      }, onProgress, onError);

    } else {
      this.setLoadingState('error');
    }
  }

  private setLoadingState(state: ModelLoadState) {
    this.loadStateChange.emit(state);
  }

  private emitProgress(event: ProgressEvent<EventTarget>) {
    if (!event.lengthComputable || event.total <= 0) {
      return;
    }

    const progress = Math.round((event.loaded / event.total) * 100);
    this.loadProgress.emit(Math.min(100, Math.max(0, progress)));
  }

  private finishLoading() {
    this.loadProgress.emit(100);
    this.setLoadingState('loaded');
  }

  private setActiveModel(object: THREE.Object3D) {
    if (this.activeModel) {
      this.scene.remove(this.activeModel);
    }

    this.applyUpAxisCorrection(object);

    // Models rarely sit at the origin: a 3MF exported from a slicer keeps its place on the
    // plate, often 100 mm or more away. The auto-rotation turns around the world axis, so an
    // off-origin model would orbit in and out of view. A pivot at the model's own centre
    // keeps the rotation, and the camera target, where the model is.
    const pivot = new THREE.Group();
    const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    object.position.sub(center);
    pivot.add(object);
    pivot.updateMatrixWorld(true);

    this.activeModel = pivot;
    this.scene.add(pivot);
    this.centerCameraOnObject(pivot);
  }

  private applyUpAxisCorrection(object: THREE.Object3D) {
    object.rotation.set(0, 0, 0);

    if (this.sourceUpAxis === 'y') {
      object.rotateX(Math.PI / 2);
    } else if (this.sourceUpAxis === 'x') {
      object.rotateY(-Math.PI / 2);
    }

    object.updateMatrixWorld(true);
  }

  // Generic function to center the camera regardless of the loader output
  private centerCameraOnObject(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);

    // Keep zoom limits proportional to model size so interaction feels natural for tiny and large models.
    this.controls.minDistance = Math.max(0.05, maxDim * 0.45);
    this.controls.maxDistance = Math.max(this.controls.minDistance * 2, maxDim * 4);

    this.camera.position.set(center.x + maxDim * 1.5, center.y + maxDim * 1.5, center.z + maxDim * 1.5);
    this.controls.target.copy(center);
    this.controls.update();
  }

  private animate = (timestamp?: number) => {
    this.animationId = requestAnimationFrame(this.animate);
    this.timer.update(timestamp);
    const delta = this.timer.getDelta();

    if (this.autoRotate && this.activeModel) {
      this.activeModel.rotateOnWorldAxis(this.zAxis, delta * this.autoRotateSpeed * 0.4);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    const container = this.viewerContainer.nativeElement;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  };

  ngOnDestroy() {
    if (this.isBrowser && this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      window.removeEventListener('resize', this.onResize);
      this.timer.dispose();
      this.renderer.dispose();
    }
  }
}