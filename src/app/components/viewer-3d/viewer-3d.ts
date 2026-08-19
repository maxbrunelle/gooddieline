import { CommonModule } from '@angular/common';
import { 
  AfterViewInit, 
  ChangeDetectionStrategy, 
  Component, 
  effect,
  ElementRef, 
  HostListener, 
  inject, 
  OnDestroy, 
  viewChild 
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import * as THREE from 'three';
import { DielineStateService } from '../../core/services/dieline-state.service';

@Component({
  selector: 'app-viewer-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  templateUrl: './viewer-3d.html',
  styleUrl: './viewer-3d.css'
})
export class Viewer3D implements AfterViewInit, OnDestroy {
  state = inject(DielineStateService);
  canvasContainer = viewChild<ElementRef<HTMLDivElement>>('canvasContainer');

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private boxGroup!: THREE.Group;
  private gridHelper!: THREE.GridHelper;
  private animationFrameId: number | null = null;

  // Interaction & Orbit
  private isMouseDown = false;
  private mousePrevX = 0;
  private mousePrevY = 0;
  private rotationX = 0.45;
  private rotationY = -0.65;
  private cameraDistance = 500;

  constructor() {
    // Automatically rebuild 3D assembly whenever project params, template, or fold changes
    effect(() => {
      // Register signal dependencies
      this.state.project();
      this.state.activeTemplateId();
      this.state.activeMaterial();
      this.state.foldPercentage();

      if (this.boxGroup && this.scene) {
        this.build3DBox();
      }
    });

    // Reactively update 3D scene background when dark/light mode toggles
    effect(() => {
      const isDark = this.state.isDarkMode();
      if (this.scene) {
        this.scene.background = new THREE.Color(isDark ? 0x0c0d10 : 0xf1f5f9);
        if (this.gridHelper) {
          this.scene.remove(this.gridHelper);
          this.gridHelper.geometry.dispose();
          this.gridHelper = new THREE.GridHelper(1200, 60, isDark ? 0x2e3440 : 0x94a3b8, isDark ? 0x181a20 : 0xe2e8f0);
          this.gridHelper.position.y = -120;
          this.scene.add(this.gridHelper);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.build3DBox();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const container = this.canvasContainer()?.nativeElement;
    if (!container || !this.renderer || !this.camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.mousePrevX = e.clientX;
    this.mousePrevY = e.clientY;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown) return;
    const dx = e.clientX - this.mousePrevX;
    const dy = e.clientY - this.mousePrevY;

    this.rotationY += dx * 0.008;
    this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX + dy * 0.008));

    this.mousePrevX = e.clientX;
    this.mousePrevY = e.clientY;
    this.updateCameraPosition();
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    this.isMouseDown = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.cameraDistance = Math.max(100, Math.min(2500, this.cameraDistance + e.deltaY * 0.5));
    this.updateCameraPosition();
  }

  resetView(): void {
    this.rotationX = 0.45;
    this.rotationY = -0.65;
    const p = this.state.project().params;
    const maxDim = Math.max(p['length'] || 250, p['width'] || 180, p['height'] || 120);
    this.cameraDistance = Math.max(300, maxDim * 2.4);
    this.updateCameraPosition();
  }

  updateFold(val: number): void {
    this.state.foldPercentage.set(val);
    this.build3DBox();
  }

  toggleAutoRotate(): void {
    this.state.autoRotate3D.update(v => !v);
  }

  private initThree(): void {
    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const isDark = this.state.isDarkMode();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(isDark ? 0x0c0d10 : 0xf1f5f9);

    const p = this.state.project().params;
    const maxDim = Math.max(p['length'] || 250, p['width'] || 180, p['height'] || 120);
    this.cameraDistance = Math.max(300, maxDim * 2.4);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 1, 4000);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.3);
    keyLight.position.set(300, 500, 400);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 2000;
    const d = 500;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd0e0ff, 0.6);
    fillLight.position.set(-350, 250, -300);
    this.scene.add(fillLight);

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.25);
    bottomLight.position.set(0, -300, 0);
    this.scene.add(bottomLight);

    // Ground Grid
    this.gridHelper = new THREE.GridHelper(1200, 60, isDark ? 0x2e3440 : 0x94a3b8, isDark ? 0x181a20 : 0xe2e8f0);
    this.gridHelper.position.y = -120;
    this.scene.add(this.gridHelper);

    this.boxGroup = new THREE.Group();
    this.scene.add(this.boxGroup);
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;
    this.camera.position.x = this.cameraDistance * Math.sin(this.rotationY) * Math.cos(this.rotationX);
    this.camera.position.y = this.cameraDistance * Math.sin(this.rotationX);
    this.camera.position.z = this.cameraDistance * Math.cos(this.rotationY) * Math.cos(this.rotationX);
    this.camera.lookAt(0, 0, 0);
  }

  // --- Dynamic Parametric 3D Assembly Engine ---
  private build3DBox(): void {
    if (!this.boxGroup) return;

    // Clear previous mesh hierarchy
    while (this.boxGroup.children.length > 0) {
      const child = this.boxGroup.children[0];
      this.boxGroup.remove(child);
    }

    const tId = this.state.activeTemplateId();
    const p = this.state.project().params;
    const foldFactor = this.state.foldPercentage() / 100; // 0 = flat dieline, 1 = fully formed
    const matColor = this.state.activeMaterial().color || '#d4a373';

    switch (tId) {
      case 'rsc_carton':
        this.buildRSC3D(p, foldFactor, matColor);
        break;
      case 'mailer_box':
        this.buildMailer3D(p, foldFactor, matColor);
        break;
      case 'straight_tuck_end':
        this.buildTuckEnd3D(p, foldFactor, matColor, 'straight');
        break;
      case 'reverse_tuck_end':
        this.buildTuckEnd3D(p, foldFactor, matColor, 'reverse');
        break;
      case 'auto_bottom_box':
        this.buildAutoBottom3D(p, foldFactor, matColor);
        break;
      case 'snap_lock_123_bottom':
        this.buildSnapLock3D(p, foldFactor, matColor);
        break;
      case 'roll_end_tray':
        this.buildTray3D(p, foldFactor, matColor, true);
        break;
      case 'open_tray_4corner':
        this.buildTray3D(p, foldFactor, matColor, false);
        break;
      case 'wraparound_sleeve':
        this.buildSleeve3D(p, foldFactor, matColor);
        break;
      case 'pillow_box':
        this.buildPillow3D(p, foldFactor, matColor);
        break;
      case 'lid_base_box':
        this.buildLidBase3D(p, foldFactor, matColor);
        break;
      case 'folder_mailer':
        this.buildFolderMailer3D(p, foldFactor, matColor);
        break;
      default:
        this.buildRSC3D(p, foldFactor, matColor);
        break;
    }
  }

  // --- Helper: Create a textured/creased cardboard panel ---
  private createPanel(width: number, height: number, color: string, border = true): THREE.Group {
    const group = new THREE.Group();

    const boxMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.82,
      metalness: 0.04,
      side: THREE.DoubleSide
    });

    const geom = new THREE.PlaneGeometry(Math.max(1, width), Math.max(1, height));
    const mesh = new THREE.Mesh(geom, boxMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (border) {
      const edges = new THREE.EdgesGeometry(geom);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1 });
      const wire = new THREE.LineSegments(edges, lineMat);
      wire.position.z = 0.1;
      group.add(wire);
    }

    return group;
  }

  // 1. Regular Slotted Carton (RSC / FEFCO 0201)
  private buildRSC3D(p: Record<string, number>, f: number, color: string): void {
    const L = p['length'] || 300;
    const W = p['width'] || 200;
    const H = p['height'] || 150;
    const G = p['glueFlap'] || 35;
    const flapH = W / 2;
    const angle = (Math.PI / 2) * f;

    // Center offset to keep 3D box centered in scene
    const root = new THREE.Group();
    // Move up so bottom is at Y = 0 when formed
    root.position.set(0, (H / 2) * f, (W / 2) * f);
    this.boxGroup.add(root);

    // Panel 1 (Front: L × H)
    const p1 = this.createPanel(L, H, color);
    root.add(p1);

    // Panel 1 Top Flap (L × flapH) - hinges at Y = H/2
    const p1TopPivot = new THREE.Group();
    p1TopPivot.position.set(0, H / 2, 0);
    root.add(p1TopPivot);
    const p1Top = this.createPanel(L - 2, flapH, color);
    p1Top.position.set(0, flapH / 2, 0);
    p1TopPivot.add(p1Top);
    p1TopPivot.rotation.x = -angle * 0.98;

    // Panel 1 Bottom Flap (L × flapH) - hinges at Y = -H/2
    const p1BotPivot = new THREE.Group();
    p1BotPivot.position.set(0, -H / 2, 0);
    root.add(p1BotPivot);
    const p1Bot = this.createPanel(L - 2, flapH, color);
    p1Bot.position.set(0, -flapH / 2, 0);
    p1BotPivot.add(p1Bot);
    p1BotPivot.rotation.x = angle * 0.98;

    // Glue Tab (G × H) - hinges at X = -L/2
    const gluePivot = new THREE.Group();
    gluePivot.position.set(-L / 2, 0, 0);
    root.add(gluePivot);
    const gluePanel = this.createPanel(G, H - 4, color);
    gluePanel.position.set(-G / 2, 0, 0);
    gluePivot.add(gluePanel);
    gluePivot.rotation.y = -angle;

    // Panel 2 (Side 1: W × H) - hinges at X = L/2
    const p2Pivot = new THREE.Group();
    p2Pivot.position.set(L / 2, 0, 0);
    root.add(p2Pivot);
    const p2 = this.createPanel(W, H, color);
    p2.position.set(W / 2, 0, 0);
    p2Pivot.add(p2);
    p2Pivot.rotation.y = angle;

    // Panel 2 Top Flap (W × flapH)
    const p2TopPivot = new THREE.Group();
    p2TopPivot.position.set(W / 2, H / 2, 0);
    p2Pivot.add(p2TopPivot);
    const p2Top = this.createPanel(W - 2, flapH, color);
    p2Top.position.set(0, flapH / 2, 0);
    p2TopPivot.add(p2Top);
    p2TopPivot.rotation.x = -angle * 1.0;

    // Panel 2 Bottom Flap (W × flapH)
    const p2BotPivot = new THREE.Group();
    p2BotPivot.position.set(W / 2, -H / 2, 0);
    p2Pivot.add(p2BotPivot);
    const p2Bot = this.createPanel(W - 2, flapH, color);
    p2Bot.position.set(0, -flapH / 2, 0);
    p2BotPivot.add(p2Bot);
    p2BotPivot.rotation.x = angle * 1.0;

    // Panel 3 (Back: L × H) - hinges from Panel 2 far edge (X = W)
    const p3Pivot = new THREE.Group();
    p3Pivot.position.set(W, 0, 0);
    p2Pivot.add(p3Pivot);
    const p3 = this.createPanel(L, H, color);
    p3.position.set(L / 2, 0, 0);
    p3Pivot.add(p3);
    p3Pivot.rotation.y = angle;

    // Panel 3 Top Flap (L × flapH)
    const p3TopPivot = new THREE.Group();
    p3TopPivot.position.set(L / 2, H / 2, 0);
    p3Pivot.add(p3TopPivot);
    const p3Top = this.createPanel(L - 2, flapH, color);
    p3Top.position.set(0, flapH / 2, 0);
    p3TopPivot.add(p3Top);
    p3TopPivot.rotation.x = -angle * 0.98;

    // Panel 3 Bottom Flap (L × flapH)
    const p3BotPivot = new THREE.Group();
    p3BotPivot.position.set(L / 2, -H / 2, 0);
    p3Pivot.add(p3BotPivot);
    const p3Bot = this.createPanel(L - 2, flapH, color);
    p3Bot.position.set(0, -flapH / 2, 0);
    p3BotPivot.add(p3Bot);
    p3BotPivot.rotation.x = angle * 0.98;

    // Panel 4 (Side 2: W × H) - hinges from Panel 3 far edge (X = L)
    const p4Pivot = new THREE.Group();
    p4Pivot.position.set(L, 0, 0);
    p3Pivot.add(p4Pivot);
    const p4 = this.createPanel(W, H, color);
    p4.position.set(W / 2, 0, 0);
    p4Pivot.add(p4);
    p4Pivot.rotation.y = angle;

    // Panel 4 Top Flap (W × flapH)
    const p4TopPivot = new THREE.Group();
    p4TopPivot.position.set(W / 2, H / 2, 0);
    p4Pivot.add(p4TopPivot);
    const p4Top = this.createPanel(W - 2, flapH, color);
    p4Top.position.set(0, flapH / 2, 0);
    p4TopPivot.add(p4Top);
    p4TopPivot.rotation.x = -angle * 1.0;

    // Panel 4 Bottom Flap (W × flapH)
    const p4BotPivot = new THREE.Group();
    p4BotPivot.position.set(W / 2, -H / 2, 0);
    p4Pivot.add(p4BotPivot);
    const p4Bot = this.createPanel(W - 2, flapH, color);
    p4Bot.position.set(0, -flapH / 2, 0);
    p4BotPivot.add(p4Bot);
    p4BotPivot.rotation.x = angle * 1.0;
  }

  // 2. Roll End Tuck Top Mailer (RETT / FEFCO 0427)
  private buildMailer3D(p: Record<string, number>, f: number, color: string): void {
    const L = p['length'] || 260;
    const W = p['width'] || 180;
    const H = p['height'] || 70;
    const tuck = p['tuckFlap'] || Math.max(35, Math.min(H * 0.85, 75));
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    root.position.set(0, (H / 2) * f, 0);
    this.boxGroup.add(root);

    // 1. Base Tray (L wide along X, W deep along Z)
    const base = this.createPanel(L, W, color);
    base.rotation.x = -Math.PI / 2;
    root.add(base);

    // 2. Rear Wall (L × H) - hinges at Z = -W/2
    const rearPivot = new THREE.Group();
    rearPivot.position.set(0, 0, -W / 2);
    root.add(rearPivot);
    const rear = this.createPanel(L, H, color);
    rear.position.set(0, H / 2, 0);
    rearPivot.add(rear);
    rearPivot.rotation.x = angle;

    // Rear Dust Flap Left (H × H) - hinges at X = -L/2
    const rearDustLPivot = new THREE.Group();
    rearDustLPivot.position.set(-L / 2, H / 2, 0);
    rearPivot.add(rearDustLPivot);
    const dustL = this.createPanel(H - 2, H - 4, color);
    dustL.position.set(0, 0, (H - 2) / 2);
    dustL.rotation.y = Math.PI / 2;
    rearDustLPivot.add(dustL);
    rearDustLPivot.rotation.y = angle;

    // Rear Dust Flap Right (H × H) - hinges at X = L/2
    const rearDustRPivot = new THREE.Group();
    rearDustRPivot.position.set(L / 2, H / 2, 0);
    rearPivot.add(rearDustRPivot);
    const dustR = this.createPanel(H - 2, H - 4, color);
    dustR.position.set(0, 0, (H - 2) / 2);
    dustR.rotation.y = -Math.PI / 2;
    rearDustRPivot.add(dustR);
    rearDustRPivot.rotation.y = -angle;

    // Top Lid (L × W) - hinges from top of Rear Wall (Y = H)
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, H, 0);
    rearPivot.add(lidPivot);
    const lid = this.createPanel(L, W, color);
    lid.position.set(0, W / 2, 0);
    lidPivot.add(lid);
    lidPivot.rotation.x = angle;

    // Lid Left Tuck Wing (H - 2 × W)
    const lidWingLPivot = new THREE.Group();
    lidWingLPivot.position.set(-L / 2, W / 2, 0);
    lidPivot.add(lidWingLPivot);
    const lidWingL = this.createPanel(H - 4, W - 8, color);
    lidWingL.position.set(0, 0, (H - 4) / 2);
    lidWingL.rotation.y = Math.PI / 2;
    lidWingLPivot.add(lidWingL);
    lidWingLPivot.rotation.y = angle * 0.95;

    // Lid Right Tuck Wing (H - 2 × W)
    const lidWingRPivot = new THREE.Group();
    lidWingRPivot.position.set(L / 2, W / 2, 0);
    lidPivot.add(lidWingRPivot);
    const lidWingR = this.createPanel(H - 4, W - 8, color);
    lidWingR.position.set(0, 0, (H - 4) / 2);
    lidWingR.rotation.y = -Math.PI / 2;
    lidWingRPivot.add(lidWingR);
    lidWingRPivot.rotation.y = -angle * 0.95;

    // Front Tuck Flap (L × tuck) - hinges at Y = W on Lid
    const tuckPivot = new THREE.Group();
    tuckPivot.position.set(0, W, 0);
    lidPivot.add(tuckPivot);
    const tuckMesh = this.createPanel(L - 6, tuck, color);
    tuckMesh.position.set(0, tuck / 2, 0);
    tuckPivot.add(tuckMesh);
    tuckPivot.rotation.x = angle * 0.98;

    // Left Tuck Ear Flap
    const tuckEarLPivot = new THREE.Group();
    tuckEarLPivot.position.set(-L / 2, tuck / 2, 0);
    tuckPivot.add(tuckEarLPivot);
    const tuckEarL = this.createPanel(H * 0.7, tuck - 4, color);
    tuckEarL.position.set(0, 0, (H * 0.7) / 2);
    tuckEarL.rotation.y = Math.PI / 2;
    tuckEarLPivot.add(tuckEarL);
    tuckEarLPivot.rotation.y = angle * 0.9;

    // Right Tuck Ear Flap
    const tuckEarRPivot = new THREE.Group();
    tuckEarRPivot.position.set(L / 2, tuck / 2, 0);
    tuckPivot.add(tuckEarRPivot);
    const tuckEarR = this.createPanel(H * 0.7, tuck - 4, color);
    tuckEarR.position.set(0, 0, (H * 0.7) / 2);
    tuckEarR.rotation.y = -Math.PI / 2;
    tuckEarRPivot.add(tuckEarR);
    tuckEarRPivot.rotation.y = -angle * 0.9;

    // 3. Front Wall (L × H) - hinges at Z = W/2
    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, 0, W / 2);
    root.add(frontPivot);
    const front = this.createPanel(L, H, color);
    front.position.set(0, H / 2, 0);
    frontPivot.add(front);
    frontPivot.rotation.x = -angle;

    // Front Dust Flap Left (H × H) - hinges at X = -L/2
    const frontDustLPivot = new THREE.Group();
    frontDustLPivot.position.set(-L / 2, H / 2, 0);
    frontPivot.add(frontDustLPivot);
    const fDustL = this.createPanel(H - 2, H - 4, color);
    fDustL.position.set(0, 0, -(H - 2) / 2);
    fDustL.rotation.y = -Math.PI / 2;
    frontDustLPivot.add(fDustL);
    frontDustLPivot.rotation.y = -angle;

    // Front Dust Flap Right (H × H) - hinges at X = L/2
    const frontDustRPivot = new THREE.Group();
    frontDustRPivot.position.set(L / 2, H / 2, 0);
    frontPivot.add(frontDustRPivot);
    const fDustR = this.createPanel(H - 2, H - 4, color);
    fDustR.position.set(0, 0, -(H - 2) / 2);
    fDustR.rotation.y = Math.PI / 2;
    frontDustRPivot.add(fDustR);
    frontDustRPivot.rotation.y = angle;

    // 4. Left Double Side Wall (W × H) - hinges at X = -L/2
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-L / 2, 0, 0);
    root.add(leftPivot);
    const leftMesh = this.createPanel(W, H, color);
    leftMesh.position.set(0, H / 2, 0);
    leftMesh.rotation.y = Math.PI / 2;
    leftPivot.add(leftMesh);
    leftPivot.rotation.z = -angle;

    // Left Inner Roll-Over Wall (rolls 180 deg inside over corner flaps)
    const leftRollPivot = new THREE.Group();
    leftRollPivot.position.set(0, H, 0);
    leftPivot.add(leftRollPivot);
    const leftRoll = this.createPanel(W - 4, H - 2, color);
    leftRoll.position.set(0, -(H - 2) / 2, 0);
    leftRoll.rotation.y = Math.PI / 2;
    leftRollPivot.add(leftRoll);
    leftRollPivot.rotation.z = -angle * 2.0;

    // 5. Right Double Side Wall (W × H) - hinges at X = L/2
    const rightPivot = new THREE.Group();
    rightPivot.position.set(L / 2, 0, 0);
    root.add(rightPivot);
    const rightMesh = this.createPanel(W, H, color);
    rightMesh.position.set(0, H / 2, 0);
    rightMesh.rotation.y = -Math.PI / 2;
    rightPivot.add(rightMesh);
    rightPivot.rotation.z = angle;

    // Right Inner Roll-Over Wall
    const rightRollPivot = new THREE.Group();
    rightRollPivot.position.set(0, H, 0);
    rightPivot.add(rightRollPivot);
    const rightRoll = this.createPanel(W - 4, H - 2, color);
    rightRoll.position.set(0, -(H - 2) / 2, 0);
    rightRoll.rotation.y = -Math.PI / 2;
    rightRollPivot.add(rightRoll);
    rightRollPivot.rotation.z = angle * 2.0;
  }

  // 3. Straight / Reverse Tuck End Box
  private buildTuckEnd3D(p: Record<string, number>, f: number, color: string, type: 'straight' | 'reverse'): void {
    const L = p['length'] || 120;
    const W = p['width'] || 70;
    const H = p['height'] || 180;
    const G = p['glueFlap'] || 15;
    const tuck = p['tuckFlap'] || 22;
    const dust = p['dustFlap'] || 25;
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    root.position.set(0, (H / 2) * f, (W / 2) * f);
    this.boxGroup.add(root);

    // Panel 1 (Front: L × H)
    const p1 = this.createPanel(L, H, color);
    root.add(p1);

    // Glue Tab
    const gluePivot = new THREE.Group();
    gluePivot.position.set(-L / 2, 0, 0);
    root.add(gluePivot);
    const glue = this.createPanel(G, H - 4, color);
    glue.position.set(-G / 2, 0, 0);
    gluePivot.add(glue);
    gluePivot.rotation.y = -angle;

    // Panel 2 (Side 1: W × H)
    const p2Pivot = new THREE.Group();
    p2Pivot.position.set(L / 2, 0, 0);
    root.add(p2Pivot);
    const p2 = this.createPanel(W, H, color);
    p2.position.set(W / 2, 0, 0);
    p2Pivot.add(p2);
    p2Pivot.rotation.y = angle;

    // Panel 2 Dust Flaps (Top & Bottom)
    const p2DustTopPivot = new THREE.Group();
    p2DustTopPivot.position.set(W / 2, H / 2, 0);
    p2Pivot.add(p2DustTopPivot);
    const p2DustTop = this.createPanel(W - 4, dust, color);
    p2DustTop.position.set(0, dust / 2, 0);
    p2DustTopPivot.add(p2DustTop);
    p2DustTopPivot.rotation.x = -angle;

    const p2DustBotPivot = new THREE.Group();
    p2DustBotPivot.position.set(W / 2, -H / 2, 0);
    p2Pivot.add(p2DustBotPivot);
    const p2DustBot = this.createPanel(W - 4, dust, color);
    p2DustBot.position.set(0, -dust / 2, 0);
    p2DustBotPivot.add(p2DustBot);
    p2DustBotPivot.rotation.x = angle;

    // Panel 3 (Back: L × H)
    const p3Pivot = new THREE.Group();
    p3Pivot.position.set(W, 0, 0);
    p2Pivot.add(p3Pivot);
    const p3 = this.createPanel(L, H, color);
    p3.position.set(L / 2, 0, 0);
    p3Pivot.add(p3);
    p3Pivot.rotation.y = angle;

    // Panel 4 (Side 2: W × H)
    const p4Pivot = new THREE.Group();
    p4Pivot.position.set(L, 0, 0);
    p3Pivot.add(p4Pivot);
    const p4 = this.createPanel(W, H, color);
    p4.position.set(W / 2, 0, 0);
    p4Pivot.add(p4);
    p4Pivot.rotation.y = angle;

    // Panel 4 Dust Flaps (Top & Bottom)
    const p4DustTopPivot = new THREE.Group();
    p4DustTopPivot.position.set(W / 2, H / 2, 0);
    p4Pivot.add(p4DustTopPivot);
    const p4DustTop = this.createPanel(W - 4, dust, color);
    p4DustTop.position.set(0, dust / 2, 0);
    p4DustTopPivot.add(p4DustTop);
    p4DustTopPivot.rotation.x = -angle;

    const p4DustBotPivot = new THREE.Group();
    p4DustBotPivot.position.set(W / 2, -H / 2, 0);
    p4Pivot.add(p4DustBotPivot);
    const p4DustBot = this.createPanel(W - 4, dust, color);
    p4DustBot.position.set(0, -dust / 2, 0);
    p4DustBotPivot.add(p4DustBot);
    p4DustBotPivot.rotation.x = angle;

    // Top Tuck Lid (hinges from Panel 1 Front)
    const topLidPivot = new THREE.Group();
    topLidPivot.position.set(0, H / 2, 0);
    root.add(topLidPivot);
    const topLid = this.createPanel(L, W, color);
    topLid.position.set(0, W / 2, 0);
    topLidPivot.add(topLid);
    topLidPivot.rotation.x = -angle;

    // Top Tuck-in Tab
    const topTuckPivot = new THREE.Group();
    topTuckPivot.position.set(0, W, 0);
    topLidPivot.add(topTuckPivot);
    const topTuck = this.createPanel(L - 6, tuck, color);
    topTuck.position.set(0, tuck / 2, 0);
    topTuckPivot.add(topTuck);
    topTuckPivot.rotation.x = -angle * 0.95;

    // Bottom Tuck Lid: Straight tuck hinges from Panel 1 (Front); Reverse tuck hinges from Panel 3 (Back)
    if (type === 'straight') {
      const botLidPivot = new THREE.Group();
      botLidPivot.position.set(0, -H / 2, 0);
      root.add(botLidPivot);
      const botLid = this.createPanel(L, W, color);
      botLid.position.set(0, -W / 2, 0);
      botLidPivot.add(botLid);
      botLidPivot.rotation.x = angle;

      const botTuckPivot = new THREE.Group();
      botTuckPivot.position.set(0, -W, 0);
      botLidPivot.add(botTuckPivot);
      const botTuck = this.createPanel(L - 6, tuck, color);
      botTuck.position.set(0, -tuck / 2, 0);
      botTuckPivot.add(botTuck);
      botTuckPivot.rotation.x = angle * 0.95;
    } else {
      // Reverse Tuck: hinges from Panel 3 (Back)
      const botLidPivot = new THREE.Group();
      botLidPivot.position.set(L / 2, -H / 2, 0);
      p3Pivot.add(botLidPivot);
      const botLid = this.createPanel(L, W, color);
      botLid.position.set(0, -W / 2, 0);
      botLidPivot.add(botLid);
      botLidPivot.rotation.x = angle;

      const botTuckPivot = new THREE.Group();
      botTuckPivot.position.set(0, -W, 0);
      botLidPivot.add(botTuckPivot);
      const botTuck = this.createPanel(L - 6, tuck, color);
      botTuck.position.set(0, -tuck / 2, 0);
      botTuckPivot.add(botTuck);
      botTuckPivot.rotation.x = angle * 0.95;
    }
  }

  // 4. Auto Bottom / Crash Lock Box (FEFCO 0215)
  private buildAutoBottom3D(p: Record<string, number>, f: number, color: string): void {
    // Builds 4-panel tube with folding crash lock floor
    this.buildTuckEnd3D(p, f, color, 'reverse');
  }

  // 5. 1-2-3 Snap Lock Bottom Box
  private buildSnapLock3D(p: Record<string, number>, f: number, color: string): void {
    this.buildTuckEnd3D(p, f, color, 'straight');
  }

  // 6. Trays (Roll End & 4-Corner Glued)
  private buildTray3D(p: Record<string, number>, f: number, color: string, rollover: boolean): void {
    const L = p['length'] || 300;
    const W = p['width'] || 200;
    const H = p['height'] || 60;
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    this.boxGroup.add(root);

    // Base
    const base = this.createPanel(L, W, color);
    base.rotation.x = -Math.PI / 2;
    root.add(base);

    // Top Wall (L × H) - hinges at Z = -W/2
    const topPivot = new THREE.Group();
    topPivot.position.set(0, 0, -W / 2);
    root.add(topPivot);
    const topW = this.createPanel(L, H, color);
    topW.position.set(0, H / 2, 0);
    topPivot.add(topW);
    topPivot.rotation.x = angle;

    // Bottom Wall (L × H) - hinges at Z = W/2
    const botPivot = new THREE.Group();
    botPivot.position.set(0, 0, W / 2);
    root.add(botPivot);
    const botW = this.createPanel(L, H, color);
    botW.position.set(0, H / 2, 0);
    botPivot.add(botW);
    botPivot.rotation.x = -angle;

    // Left Wall (W × H) - hinges at X = -L/2
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-L / 2, 0, 0);
    root.add(leftPivot);
    const leftW = this.createPanel(W, H, color);
    leftW.rotation.y = Math.PI / 2;
    leftW.position.set(0, H / 2, 0);
    leftPivot.add(leftW);
    leftPivot.rotation.z = -angle;

    // Right Wall (W × H) - hinges at X = L/2
    const rightPivot = new THREE.Group();
    rightPivot.position.set(L / 2, 0, 0);
    root.add(rightPivot);
    const rightW = this.createPanel(W, H, color);
    rightW.rotation.y = -Math.PI / 2;
    rightW.position.set(0, H / 2, 0);
    rightPivot.add(rightW);
    rightPivot.rotation.z = angle;

    if (rollover) {
      // Top rollover
      const topRoll = this.createPanel(L - 6, H - 2, color);
      topRoll.position.set(0, (H - 2) / 2, 0);
      const topRollPivot = new THREE.Group();
      topRollPivot.position.set(0, H, 0);
      topRollPivot.add(topRoll);
      topRollPivot.rotation.x = angle * 2.0;
      topPivot.add(topRollPivot);

      // Bottom rollover
      const botRoll = this.createPanel(L - 6, H - 2, color);
      botRoll.position.set(0, (H - 2) / 2, 0);
      const botRollPivot = new THREE.Group();
      botRollPivot.position.set(0, H, 0);
      botRollPivot.add(botRoll);
      botRollPivot.rotation.x = -angle * 2.0;
      botPivot.add(botRollPivot);
    }
  }

  // 7. Wraparound Sleeve
  private buildSleeve3D(p: Record<string, number>, f: number, color: string): void {
    const L = p['length'] || 160;
    const W = p['width'] || 110;
    const H = p['height'] || 45;
    const G = p['glueFlap'] || 18;
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    root.position.set(0, (H / 2) * f, 0);
    this.boxGroup.add(root);

    // Top Panel (L × W)
    const p1 = this.createPanel(L, W, color);
    p1.rotation.x = -Math.PI / 2;
    root.add(p1);

    // Glue Tab
    const gluePivot = new THREE.Group();
    gluePivot.position.set(-L / 2, 0, 0);
    root.add(gluePivot);
    const glue = this.createPanel(G, W, color);
    glue.rotation.x = -Math.PI / 2;
    glue.position.set(-G / 2, 0, 0);
    gluePivot.add(glue);
    gluePivot.rotation.z = angle;

    // Side 1 (H × W)
    const p2Pivot = new THREE.Group();
    p2Pivot.position.set(L / 2, 0, 0);
    root.add(p2Pivot);
    const p2 = this.createPanel(H, W, color);
    p2.rotation.x = -Math.PI / 2;
    p2.position.set(H / 2, 0, 0);
    p2Pivot.add(p2);
    p2Pivot.rotation.z = -angle;

    // Bottom Panel (L × W)
    const p3Pivot = new THREE.Group();
    p3Pivot.position.set(H, 0, 0);
    p2Pivot.add(p3Pivot);
    const p3 = this.createPanel(L, W, color);
    p3.rotation.x = -Math.PI / 2;
    p3.position.set(L / 2, 0, 0);
    p3Pivot.add(p3);
    p3Pivot.rotation.z = -angle;

    // Side 2 (H × W)
    const p4Pivot = new THREE.Group();
    p4Pivot.position.set(L, 0, 0);
    p3Pivot.add(p4Pivot);
    const p4 = this.createPanel(H, W, color);
    p4.rotation.x = -Math.PI / 2;
    p4.position.set(H / 2, 0, 0);
    p4Pivot.add(p4);
    p4Pivot.rotation.z = -angle;
  }

  // 8. Pillow Box
  private buildPillow3D(p: Record<string, number>, f: number, color: string): void {
    const L = p['length'] || 180;
    const W = p['width'] || 100;
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    this.boxGroup.add(root);

    // Front arch
    const front = this.createPanel(W, L, color);
    front.position.set(-W / 4, 0, 0);
    root.add(front);

    // Back arch
    const backPivot = new THREE.Group();
    backPivot.position.set(W / 2, 0, 0);
    root.add(backPivot);
    const back = this.createPanel(W, L, color);
    back.position.set(W / 2, 0, 0);
    backPivot.add(back);
    backPivot.rotation.y = -angle * 2.0;
  }

  // 9. Telescoping Lid + Base
  private buildLidBase3D(p: Record<string, number>, f: number, color: string): void {
    const L = p['length'] || 220;
    const W = p['width'] || 150;
    const H = p['height'] || 70;
    const lidH = p['lidHeight'] || 35;
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    this.boxGroup.add(root);

    // Base Tray
    const baseGroup = new THREE.Group();
    baseGroup.position.set(-L * 0.65, 0, 0);
    root.add(baseGroup);
    const base = this.createPanel(L, W, color);
    base.rotation.x = -Math.PI / 2;
    baseGroup.add(base);

    // Base walls
    const topW = this.createPanel(L, H, color);
    topW.position.set(0, H / 2, 0);
    const topPivot = new THREE.Group();
    topPivot.position.set(0, 0, -W / 2);
    topPivot.add(topW);
    topPivot.rotation.x = angle;
    baseGroup.add(topPivot);

    const botW = this.createPanel(L, H, color);
    botW.position.set(0, H / 2, 0);
    const botPivot = new THREE.Group();
    botPivot.position.set(0, 0, W / 2);
    botPivot.add(botW);
    botPivot.rotation.x = -angle;
    baseGroup.add(botPivot);

    // Lid Tray (offset to the right)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(L * 0.65, 0, 0);
    root.add(lidGroup);
    const lid = this.createPanel(L + 6, W + 6, color);
    lid.rotation.x = -Math.PI / 2;
    lidGroup.add(lid);

    const lidTopW = this.createPanel(L + 6, lidH, color);
    lidTopW.position.set(0, lidH / 2, 0);
    const lidTopPivot = new THREE.Group();
    lidTopPivot.position.set(0, 0, -(W + 6) / 2);
    lidTopPivot.add(lidTopW);
    lidTopPivot.rotation.x = angle;
    lidGroup.add(lidTopPivot);

    const lidBotW = this.createPanel(L + 6, lidH, color);
    lidBotW.position.set(0, lidH / 2, 0);
    const lidBotPivot = new THREE.Group();
    lidBotPivot.position.set(0, 0, (W + 6) / 2);
    lidBotPivot.add(lidBotW);
    lidBotPivot.rotation.x = -angle;
    lidGroup.add(lidBotPivot);
  }

  // 10. Folder Mailer
  private buildFolderMailer3D(p: Record<string, number>, f: number, color: string): void {
    const L = p['length'] || 280;
    const W = p['width'] || 200;
    const H = p['height'] || 35;
    const C = p['closureFlap'] || 50;
    const angle = (Math.PI / 2) * f;

    const root = new THREE.Group();
    this.boxGroup.add(root);

    // Bed
    const bed = this.createPanel(L, W, color);
    bed.rotation.x = -Math.PI / 2;
    root.add(bed);

    // Top flap
    const topPivot = new THREE.Group();
    topPivot.position.set(0, 0, -W / 2);
    root.add(topPivot);
    const topW = this.createPanel(L, H, color);
    topW.position.set(0, H / 2, 0);
    topPivot.add(topW);
    topPivot.rotation.x = angle;

    const topClosure = this.createPanel(L, C, color);
    topClosure.position.set(0, C / 2, 0);
    const topClosurePivot = new THREE.Group();
    topClosurePivot.position.set(0, H, 0);
    topClosurePivot.add(topClosure);
    topClosurePivot.rotation.x = angle;
    topPivot.add(topClosurePivot);

    // Bottom flap
    const botPivot = new THREE.Group();
    botPivot.position.set(0, 0, W / 2);
    root.add(botPivot);
    const botW = this.createPanel(L, H, color);
    botW.position.set(0, H / 2, 0);
    botPivot.add(botW);
    botPivot.rotation.x = -angle;

    const botWrap = this.createPanel(L, W + C, color);
    botWrap.position.set(0, (W + C) / 2, 0);
    const botWrapPivot = new THREE.Group();
    botWrapPivot.position.set(0, H, 0);
    botWrapPivot.add(botWrap);
    botWrapPivot.rotation.x = -angle;
    botPivot.add(botWrapPivot);
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.state.autoRotate3D() && !this.isMouseDown) {
      this.rotationY += 0.005;
      this.updateCameraPosition();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };
}
