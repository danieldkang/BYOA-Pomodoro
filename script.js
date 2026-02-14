// ============================================
// RoomVision 3D - Interior Design Studio
// ============================================

(function () {
    'use strict';

    // ---- State ----
    const state = {
        photos: [],
        roomConfig: {
            type: 'living',
            width: 12,
            depth: 14,
            height: 9
        },
        roomGenerated: false,
        selectedStyle: 'modern',
        furniture: [],
        wallColor: '#f5f0eb',
        floorMaterial: 'hardwood',
        lightIntensity: 1.0,
        timeOfDay: 'afternoon',
        showGrid: true,
        wallsTransparent: false
    };

    // ---- Three.js globals ----
    let scene, camera, renderer, controls;
    let roomGroup, furnitureGroup, gridHelper;
    let ambientLight, directionalLight, pointLight;
    let wallMeshes = [];

    // ---- DOM refs ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ---- Navigation ----
    $$('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $$('.view').forEach(v => v.classList.remove('active'));
            $(`#${view}-view`).classList.add('active');

            if (view === 'editor' && !renderer) {
                initThreeJS();
            }
            if (view === 'editor' && renderer) {
                onResize();
            }
        });
    });

    // ---- Toast ----
    function showToast(message, type = '') {
        const toast = $('#toast');
        toast.textContent = message;
        toast.className = 'toast ' + type;
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => { toast.className = 'toast hidden'; }, 300);
        }, 2500);
    }

    // ============================================
    // PHOTO UPLOAD
    // ============================================
    const dropZone = $('#drop-zone');
    const fileInput = $('#file-input');
    const photoGrid = $('#uploaded-photos');
    const roomConfig = $('#room-config');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const photo = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    dataUrl: e.target.result
                };
                state.photos.push(photo);
                renderPhotoGrid();
                roomConfig.classList.remove('hidden');
                showToast('Photo uploaded!', 'success');
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPhotoGrid() {
        photoGrid.innerHTML = state.photos.map((photo, i) => `
            <div class="photo-card">
                <img src="${photo.dataUrl}" alt="${photo.name}">
                <button class="remove-photo" data-index="${i}">&times;</button>
                <div class="photo-label">${photo.name}</div>
            </div>
        `).join('');

        photoGrid.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.photos.splice(parseInt(btn.dataset.index), 1);
                renderPhotoGrid();
                if (state.photos.length === 0) {
                    roomConfig.classList.add('hidden');
                }
            });
        });
    }

    // ---- Room config ----
    $('#room-type').addEventListener('change', (e) => { state.roomConfig.type = e.target.value; });
    $('#room-width').addEventListener('change', (e) => { state.roomConfig.width = parseInt(e.target.value) || 12; });
    $('#room-depth').addEventListener('change', (e) => { state.roomConfig.depth = parseInt(e.target.value) || 14; });
    $('#room-height').addEventListener('change', (e) => { state.roomConfig.height = parseInt(e.target.value) || 9; });

    $('#generate-3d-btn').addEventListener('click', () => {
        state.roomGenerated = true;
        // Switch to editor view
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        $$('.nav-btn')[1].classList.add('active');
        $$('.view').forEach(v => v.classList.remove('active'));
        $('#editor-view').classList.add('active');

        if (!renderer) {
            initThreeJS();
        }
        buildRoom();
        showToast('3D room generated!', 'success');
    });

    // ============================================
    // THREE.JS 3D ENGINE
    // ============================================
    function initThreeJS() {
        const container = $('#viewport-container');
        const canvas = $('#three-canvas');

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1c25);

        camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(8, 7, 12);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI / 2.05;
        controls.minDistance = 3;
        controls.maxDistance = 30;
        controls.target.set(0, 2, 0);

        // Lighting
        ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        directionalLight = new THREE.DirectionalLight(0xfff5e6, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        scene.add(directionalLight);

        pointLight = new THREE.PointLight(0xffeedd, 0.3, 20);
        pointLight.position.set(0, 5, 0);
        scene.add(pointLight);

        // Groups
        roomGroup = new THREE.Group();
        scene.add(roomGroup);

        furnitureGroup = new THREE.Group();
        scene.add(furnitureGroup);

        // Grid
        gridHelper = new THREE.GridHelper(20, 20, 0x444857, 0x33363f);
        scene.add(gridHelper);

        // Build the room if we have config
        if (state.roomGenerated) {
            buildRoom();
        }

        window.addEventListener('resize', onResize);
        animate();
    }

    function onResize() {
        if (!renderer) return;
        const container = $('#viewport-container');
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function animate() {
        requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    // ============================================
    // ROOM BUILDER
    // ============================================
    function buildRoom() {
        // Clear old room
        while (roomGroup.children.length) {
            roomGroup.remove(roomGroup.children[0]);
        }
        wallMeshes = [];

        const w = state.roomConfig.width * 0.3048; // ft to meters
        const d = state.roomConfig.depth * 0.3048;
        const h = state.roomConfig.height * 0.3048;

        const wallColor = new THREE.Color(state.wallColor);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(w, d);
        const floorMat = createFloorMaterial(state.floorMaterial);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, 0);
        floor.receiveShadow = true;
        roomGroup.add(floor);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({
            color: wallColor,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        // Back wall
        const backWallGeo = new THREE.PlaneGeometry(w, h);
        const backWall = new THREE.Mesh(backWallGeo, wallMat.clone());
        backWall.position.set(0, h / 2, -d / 2);
        backWall.receiveShadow = true;
        roomGroup.add(backWall);
        wallMeshes.push(backWall);

        // Left wall
        const leftWallGeo = new THREE.PlaneGeometry(d, h);
        const leftWall = new THREE.Mesh(leftWallGeo, wallMat.clone());
        leftWall.position.set(-w / 2, h / 2, 0);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        roomGroup.add(leftWall);
        wallMeshes.push(leftWall);

        // Right wall
        const rightWall = new THREE.Mesh(leftWallGeo, wallMat.clone());
        rightWall.position.set(w / 2, h / 2, 0);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.receiveShadow = true;
        roomGroup.add(rightWall);
        wallMeshes.push(rightWall);

        // Apply photo as texture to back wall if we have photos
        if (state.photos.length > 0) {
            const texture = new THREE.TextureLoader().load(state.photos[0].dataUrl);
            texture.encoding = THREE.sRGBEncoding;
            backWall.material.map = texture;
            backWall.material.needsUpdate = true;
        }

        // Ceiling (subtle)
        const ceilGeo = new THREE.PlaneGeometry(w, d);
        const ceilMat = new THREE.MeshStandardMaterial({
            color: 0xfafafa,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide
        });
        const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, h, 0);
        roomGroup.add(ceiling);

        // Baseboard trim
        addBaseboard(w, d, h);

        // Window on left wall
        addWindow(leftWall, w, d, h);

        // Update camera to fit room
        camera.position.set(w * 0.8, h * 0.7, d * 0.9);
        controls.target.set(0, h * 0.35, 0);
        controls.update();

        // Re-add existing furniture
        rebuildFurniture();
    }

    function addBaseboard(w, d, h) {
        const baseH = 0.08;
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });

        // Back
        const bb = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, 0.02), baseMat);
        bb.position.set(0, baseH / 2, -d / 2 + 0.01);
        roomGroup.add(bb);

        // Left
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.02, baseH, d), baseMat);
        bl.position.set(-w / 2 + 0.01, baseH / 2, 0);
        roomGroup.add(bl);

        // Right
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.02, baseH, d), baseMat);
        br.position.set(w / 2 - 0.01, baseH / 2, 0);
        roomGroup.add(br);
    }

    function addWindow(wall, roomW, roomD, roomH) {
        // Add a simple window frame on left wall
        const frameW = 1.2;
        const frameH = 1.0;
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 });

        const frame = new THREE.Group();

        // Frame border
        const topBar = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.1, 0.05, 0.06), frameMat);
        topBar.position.y = frameH / 2;
        frame.add(topBar);

        const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.1, 0.05, 0.06), frameMat);
        bottomBar.position.y = -frameH / 2;
        frame.add(bottomBar);

        const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, frameH, 0.06), frameMat);
        leftBar.position.x = -frameW / 2;
        frame.add(leftBar);

        const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, frameH, 0.06), frameMat);
        rightBar.position.x = frameW / 2;
        frame.add(rightBar);

        // Glass pane
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1,
            metalness: 0.1
        });
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), glassMat);
        frame.add(glass);

        frame.position.set(-roomW / 2 * 0.3048 + 0.03, roomH * 0.3048 * 0.55, 0);
        frame.rotation.y = Math.PI / 2;
        roomGroup.add(frame);
    }

    // ---- Floor Materials ----
    function createFloorMaterial(type) {
        const mats = {
            hardwood: { color: 0x8B6914, roughness: 0.6, metalness: 0.05 },
            carpet: { color: 0x9e9e9e, roughness: 1.0, metalness: 0 },
            tile: { color: 0xe0d5c7, roughness: 0.3, metalness: 0.05 },
            marble: { color: 0xf0ece3, roughness: 0.15, metalness: 0.1 },
            concrete: { color: 0xb0b0b0, roughness: 0.9, metalness: 0.02 }
        };
        const p = mats[type] || mats.hardwood;

        // Create a procedural texture for the floor
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const baseColor = '#' + new THREE.Color(p.color).getHexString();
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 512, 512);

        if (type === 'hardwood') {
            // Draw planks
            const plankW = 512;
            const plankH = 64;
            for (let y = 0; y < 512; y += plankH) {
                const offset = (y / plankH % 2 === 0) ? 0 : plankW / 3;
                for (let x = -plankW; x < 512 + plankW; x += plankW) {
                    const shade = 0.9 + Math.random() * 0.2;
                    const r = parseInt(baseColor.slice(1, 3), 16) * shade;
                    const g = parseInt(baseColor.slice(3, 5), 16) * shade;
                    const b = parseInt(baseColor.slice(5, 7), 16) * shade;
                    ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
                    ctx.fillRect(x + offset, y, plankW - 2, plankH - 1);
                }
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fillRect(0, y + plankH - 1, 512, 1);
            }
        } else if (type === 'tile') {
            const tileSize = 64;
            for (let y = 0; y < 512; y += tileSize) {
                for (let x = 0; x < 512; x += tileSize) {
                    const shade = 0.95 + Math.random() * 0.1;
                    const r = parseInt(baseColor.slice(1, 3), 16) * shade;
                    const g = parseInt(baseColor.slice(3, 5), 16) * shade;
                    const b = parseInt(baseColor.slice(5, 7), 16) * shade;
                    ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
                    ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
                }
            }
            ctx.fillStyle = 'rgba(180,180,180,0.5)';
            for (let y = 0; y < 512; y += tileSize) {
                ctx.fillRect(0, y, 512, 1);
            }
            for (let x = 0; x < 512; x += tileSize) {
                ctx.fillRect(x, 0, 1, 512);
            }
        } else if (type === 'marble') {
            // Add veins
            for (let i = 0; i < 30; i++) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(160,150,140,${0.1 + Math.random() * 0.15})`;
                ctx.lineWidth = 0.5 + Math.random() * 2;
                let x = Math.random() * 512;
                let y = Math.random() * 512;
                ctx.moveTo(x, y);
                for (let j = 0; j < 8; j++) {
                    x += (Math.random() - 0.5) * 100;
                    y += (Math.random() - 0.5) * 100;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        return new THREE.MeshStandardMaterial({
            map: texture,
            roughness: p.roughness,
            metalness: p.metalness,
            side: THREE.DoubleSide
        });
    }

    // ============================================
    // FURNITURE BUILDER
    // ============================================
    const furnitureBuilders = {
        sofa: (color) => {
            const g = new THREE.Group();
            const c = new THREE.Color(color || 0x5a6e82);
            const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });

            // Seat
            const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.9), mat);
            seat.position.y = 0.35;
            seat.castShadow = true;
            g.add(seat);

            // Back
            const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.15), mat);
            back.position.set(0, 0.75, -0.38);
            back.castShadow = true;
            g.add(back);

            // Arms
            const armMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.85), roughness: 0.8 });
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.9), armMat);
            armL.position.set(-0.93, 0.55, 0);
            armL.castShadow = true;
            g.add(armL);
            const armR = armL.clone();
            armR.position.x = 0.93;
            g.add(armR);

            // Cushions
            const cushionMat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(1.1), roughness: 0.9 });
            for (let i = -1; i <= 1; i++) {
                const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.7), cushionMat);
                cushion.position.set(i * 0.62, 0.61, 0.0);
                cushion.castShadow = true;
                g.add(cushion);
            }

            // Legs
            const legMat = new THREE.MeshStandardMaterial({ color: 0x3d3027, roughness: 0.6 });
            const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15);
            [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(x, 0.075, z);
                g.add(leg);
            });

            return g;
        },

        chair: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x8d6e4c, roughness: 0.7 });

            // Seat
            const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), mat);
            seat.position.y = 0.45;
            seat.castShadow = true;
            g.add(seat);

            // Back
            const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.04), mat);
            back.position.set(0, 0.75, -0.23);
            back.castShadow = true;
            g.add(back);

            // Legs
            const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x3d3027, roughness: 0.6 });
            [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(x, 0.225, z);
                g.add(leg);
            });

            return g;
        },

        coffeetable: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x6b4c3b, roughness: 0.5 });

            // Top
            const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.6), mat);
            top.position.y = 0.42;
            top.castShadow = true;
            g.add(top);

            // Shelf
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.5), mat.clone());
            shelf.material.color.multiplyScalar(0.8);
            shelf.position.y = 0.18;
            g.add(shelf);

            // Legs
            const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.42);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5 });
            [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(x, 0.21, z);
                g.add(leg);
            });

            return g;
        },

        bookshelf: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x7a5c3e, roughness: 0.6 });

            // Sides
            const sideGeo = new THREE.BoxGeometry(0.04, 1.8, 0.35);
            const sideL = new THREE.Mesh(sideGeo, mat);
            sideL.position.set(-0.48, 0.9, 0);
            sideL.castShadow = true;
            g.add(sideL);
            const sideR = sideL.clone();
            sideR.position.x = 0.48;
            g.add(sideR);

            // Shelves
            for (let i = 0; i < 5; i++) {
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.03, 0.35), mat);
                shelf.position.y = i * 0.42 + 0.05;
                g.add(shelf);
            }

            // Books (colored blocks)
            const bookColors = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0xe74c3c, 0x3498db];
            for (let shelf = 0; shelf < 4; shelf++) {
                let x = -0.4;
                while (x < 0.35) {
                    const bw = 0.04 + Math.random() * 0.06;
                    const bh = 0.25 + Math.random() * 0.12;
                    const bookMat = new THREE.MeshStandardMaterial({
                        color: bookColors[Math.floor(Math.random() * bookColors.length)],
                        roughness: 0.8
                    });
                    const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.2), bookMat);
                    book.position.set(x + bw / 2, shelf * 0.42 + 0.05 + bh / 2 + 0.015, 0);
                    g.add(book);
                    x += bw + 0.01;
                }
            }

            return g;
        },

        lamp: (color) => {
            const g = new THREE.Group();

            // Base
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.7 });
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.04, 16), baseMat);
            base.position.y = 0.02;
            g.add(base);

            // Pole
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), baseMat);
            pole.position.y = 0.77;
            g.add(pole);

            // Shade
            const shadeMat = new THREE.MeshStandardMaterial({
                color: color || 0xfaf0e6,
                roughness: 0.9,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            });
            const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.3, 16, 1, true), shadeMat);
            shade.position.y = 1.55;
            g.add(shade);

            // Light bulb glow
            const glowMat = new THREE.MeshStandardMaterial({
                color: 0xfff4e0,
                emissive: 0xfff4e0,
                emissiveIntensity: 0.5
            });
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glowMat);
            bulb.position.y = 1.45;
            g.add(bulb);

            return g;
        },

        plant: (color) => {
            const g = new THREE.Group();

            // Pot
            const potMat = new THREE.MeshStandardMaterial({ color: color || 0xb87333, roughness: 0.7 });
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 12), potMat);
            pot.position.y = 0.125;
            pot.castShadow = true;
            g.add(pot);

            // Soil
            const soil = new THREE.Mesh(
                new THREE.CylinderGeometry(0.14, 0.14, 0.03, 12),
                new THREE.MeshStandardMaterial({ color: 0x3e2723 })
            );
            soil.position.y = 0.25;
            g.add(soil);

            // Leaves (clusters of spheres)
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8 });
            const leafPositions = [
                [0, 0.5, 0, 0.15],
                [0.08, 0.6, 0.05, 0.12],
                [-0.07, 0.55, -0.06, 0.11],
                [0.05, 0.65, -0.04, 0.1],
                [-0.04, 0.62, 0.07, 0.09]
            ];
            leafPositions.forEach(([x, y, z, r]) => {
                const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), leafMat);
                leaf.position.set(x, y, z);
                leaf.castShadow = true;
                g.add(leaf);
            });

            return g;
        },

        rug: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({
                color: color || 0x7b68ae,
                roughness: 1.0,
                metalness: 0
            });

            const rug = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.02, 1.8), mat);
            rug.position.y = 0.01;
            rug.receiveShadow = true;
            g.add(rug);

            // Border
            const borderMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(color || 0x7b68ae).multiplyScalar(0.7),
                roughness: 1.0
            });
            const borderGeo = new THREE.BoxGeometry(2.5, 0.022, 0.1);
            const b1 = new THREE.Mesh(borderGeo, borderMat);
            b1.position.set(0, 0.011, 0.85);
            g.add(b1);
            const b2 = b1.clone();
            b2.position.z = -0.85;
            g.add(b2);
            const borderGeo2 = new THREE.BoxGeometry(0.1, 0.022, 1.8);
            const b3 = new THREE.Mesh(borderGeo2, borderMat);
            b3.position.set(1.2, 0.011, 0);
            g.add(b3);
            const b4 = b3.clone();
            b4.position.x = -1.2;
            g.add(b4);

            return g;
        },

        bed: (color) => {
            const g = new THREE.Group();
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 });
            const fabricMat = new THREE.MeshStandardMaterial({ color: color || 0xecf0f1, roughness: 0.9 });

            // Frame
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.2), frameMat);
            frame.position.y = 0.15;
            frame.castShadow = true;
            g.add(frame);

            // Mattress
            const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 2.1), fabricMat);
            mattress.position.y = 0.4;
            mattress.castShadow = true;
            g.add(mattress);

            // Headboard
            const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.08), frameMat);
            headboard.position.set(0, 0.7, -1.05);
            headboard.castShadow = true;
            g.add(headboard);

            // Pillows
            const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
            const pillowGeo = new THREE.BoxGeometry(0.55, 0.12, 0.35);
            const p1 = new THREE.Mesh(pillowGeo, pillowMat);
            p1.position.set(-0.4, 0.56, -0.75);
            g.add(p1);
            const p2 = p1.clone();
            p2.position.x = 0.4;
            g.add(p2);

            // Blanket
            const blanketMat = new THREE.MeshStandardMaterial({ color: color || 0x6c5ce7, roughness: 0.95 });
            const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.06, 1.4), blanketMat);
            blanket.position.set(0, 0.53, 0.25);
            g.add(blanket);

            return g;
        },

        desk: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x7a5c3e, roughness: 0.5 });

            // Top
            const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.7), mat);
            top.position.y = 0.75;
            top.castShadow = true;
            g.add(top);

            // Legs
            const legGeo = new THREE.BoxGeometry(0.05, 0.75, 0.05);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.5 });
            [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(x, 0.375, z);
                g.add(leg);
            });

            // Monitor
            const monitorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });
            const screen = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.4, 0.02), monitorMat);
            screen.position.set(0, 1.17, -0.2);
            g.add(screen);
            // Screen face
            const screenFace = new THREE.Mesh(
                new THREE.PlaneGeometry(0.6, 0.35),
                new THREE.MeshStandardMaterial({ color: 0x1a1c25, emissive: 0x2244aa, emissiveIntensity: 0.2 })
            );
            screenFace.position.set(0, 1.17, -0.189);
            g.add(screenFace);
            // Stand
            const stand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), monitorMat);
            stand.position.set(0, 0.87, -0.2);
            g.add(stand);
            const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.15), monitorMat);
            standBase.position.set(0, 0.78, -0.2);
            g.add(standBase);

            // Keyboard
            const kbMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });
            const kb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.015, 0.13), kbMat);
            kb.position.set(0, 0.78, 0.05);
            g.add(kb);

            return g;
        },

        tvstand: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x4a4a4a, roughness: 0.5 });

            // Console
            const console = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.4), mat);
            console.position.y = 0.25;
            console.castShadow = true;
            g.add(console);

            // TV
            const tvMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
            const tv = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.04), tvMat);
            tv.position.set(0, 0.88, -0.1);
            tv.castShadow = true;
            g.add(tv);

            // Screen
            const screenMat = new THREE.MeshStandardMaterial({
                color: 0x0a0a14,
                emissive: 0x1a2a4a,
                emissiveIntensity: 0.15
            });
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.68), screenMat);
            screen.position.set(0, 0.88, -0.079);
            g.add(screen);

            return g;
        },

        diningtable: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x8d6e4c, roughness: 0.5 });

            // Top
            const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.9), mat);
            top.position.y = 0.76;
            top.castShadow = true;
            g.add(top);

            // Legs
            const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.76, 8);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6 });
            [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]].forEach(([x, z]) => {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(x, 0.38, z);
                g.add(leg);
            });

            return g;
        },

        sidetable: (color) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color || 0x6b4c3b, roughness: 0.5 });

            // Top
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), mat);
            top.position.y = 0.55;
            top.castShadow = true;
            g.add(top);

            // Single leg
            const leg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 })
            );
            leg.position.y = 0.275;
            g.add(leg);

            // Base
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 })
            );
            base.position.y = 0.01;
            g.add(base);

            return g;
        }
    };

    function addFurniture(type, color, position) {
        const builder = furnitureBuilders[type];
        if (!builder) return;

        const mesh = builder(color);
        const w = state.roomConfig.width * 0.3048;
        const d = state.roomConfig.depth * 0.3048;

        if (position) {
            mesh.position.set(position.x, position.y, position.z);
        } else {
            // Place semi-randomly within room bounds
            mesh.position.set(
                (Math.random() - 0.5) * (w * 0.5),
                0,
                (Math.random() - 0.5) * (d * 0.3)
            );
        }

        mesh.userData.type = type;
        furnitureGroup.add(mesh);

        state.furniture.push({
            type,
            color: color || null,
            position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }
        });

        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added!`, 'success');
    }

    function rebuildFurniture() {
        while (furnitureGroup.children.length) {
            furnitureGroup.remove(furnitureGroup.children[0]);
        }
        const items = [...state.furniture];
        state.furniture = [];
        items.forEach(item => {
            addFurniture(item.type, item.color, item.position);
        });
    }

    // Furniture button handlers
    $$('.furniture-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!state.roomGenerated) {
                showToast('Generate a 3D room first!', 'warning');
                return;
            }
            addFurniture(btn.dataset.item);
        });
    });

    $('#clear-furniture').addEventListener('click', () => {
        while (furnitureGroup.children.length) {
            furnitureGroup.remove(furnitureGroup.children[0]);
        }
        state.furniture = [];
        showToast('Furniture cleared', '');
    });

    // ============================================
    // EDITOR CONTROLS
    // ============================================

    // Wall color
    const wallColorInput = $('#wall-color');
    const colorLabel = $('.color-label');
    wallColorInput.addEventListener('input', (e) => {
        state.wallColor = e.target.value;
        colorLabel.textContent = e.target.value;
        wallMeshes.forEach(mesh => {
            mesh.material.color.set(e.target.value);
            if (mesh.material.map && mesh === wallMeshes[0]) return; // Don't clear photo texture
            mesh.material.needsUpdate = true;
        });
    });

    // Floor material
    $$('.mat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.mat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.floorMaterial = btn.dataset.floor;
            if (state.roomGenerated) buildRoom();
        });
    });

    // Lighting
    $('#light-intensity').addEventListener('input', (e) => {
        const val = parseInt(e.target.value) / 100;
        state.lightIntensity = val;
        if (ambientLight) ambientLight.intensity = 0.4 * val;
        if (directionalLight) directionalLight.intensity = 0.8 * val;
        if (pointLight) pointLight.intensity = 0.3 * val;
    });

    // Time of day
    $$('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.timeOfDay = btn.dataset.time;
            applyTimeOfDay(btn.dataset.time);
        });
    });

    function applyTimeOfDay(time) {
        if (!directionalLight) return;
        const settings = {
            morning: { bg: 0xfff5e6, dirColor: 0xffe4b5, dirIntensity: 0.7, ambIntensity: 0.45, exposure: 0.9 },
            afternoon: { bg: 0xfff8f0, dirColor: 0xfff5e6, dirIntensity: 0.8, ambIntensity: 0.4, exposure: 1.0 },
            evening: { bg: 0xffe0c0, dirColor: 0xff9e5e, dirIntensity: 0.5, ambIntensity: 0.3, exposure: 0.7 },
            night: { bg: 0x1a1c35, dirColor: 0x4466aa, dirIntensity: 0.15, ambIntensity: 0.15, exposure: 0.5 }
        };
        const s = settings[time] || settings.afternoon;
        if (scene) scene.background = new THREE.Color(s.bg);
        directionalLight.color.set(s.dirColor);
        directionalLight.intensity = s.dirIntensity * state.lightIntensity;
        ambientLight.intensity = s.ambIntensity * state.lightIntensity;
        renderer.toneMappingExposure = s.exposure;
    }

    // Toolbar buttons
    $('#reset-camera').addEventListener('click', () => {
        if (!camera || !controls) return;
        const w = state.roomConfig.width * 0.3048;
        const h = state.roomConfig.height * 0.3048;
        const d = state.roomConfig.depth * 0.3048;
        camera.position.set(w * 0.8, h * 0.7, d * 0.9);
        controls.target.set(0, h * 0.35, 0);
        controls.update();
    });

    $('#toggle-grid').addEventListener('click', function () {
        this.classList.toggle('active');
        state.showGrid = !state.showGrid;
        if (gridHelper) gridHelper.visible = state.showGrid;
    });

    $('#toggle-walls').addEventListener('click', function () {
        this.classList.toggle('active');
        state.wallsTransparent = !state.wallsTransparent;
        wallMeshes.forEach(mesh => {
            mesh.material.transparent = state.wallsTransparent;
            mesh.material.opacity = state.wallsTransparent ? 0.3 : 1.0;
            mesh.material.needsUpdate = true;
        });
    });

    $('#screenshot-btn').addEventListener('click', () => {
        if (!renderer) return;
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'roomvision-screenshot.png';
        link.href = dataUrl;
        link.click();
        showToast('Screenshot saved!', 'success');
    });

    // ============================================
    // DESIGN IDEAS ENGINE
    // ============================================
    const designStyles = {
        modern: {
            name: 'Modern',
            wallColor: '#f5f5f5',
            palette: ['#2d3436', '#636e72', '#dfe6e9', '#6c5ce7', '#fdcb6e'],
            floor: 'hardwood',
            furniture: [
                { type: 'sofa', color: 0x636e72, name: 'Charcoal Sectional' },
                { type: 'coffeetable', color: 0x2d3436, name: 'Black Coffee Table' },
                { type: 'lamp', color: 0xfafafa, name: 'White Arc Lamp' },
                { type: 'rug', color: 0xdfe6e9, name: 'Light Gray Rug' },
                { type: 'plant', color: 0x444444, name: 'Dark Planter' }
            ],
            tips: [
                'Keep lines clean and geometric - avoid ornate decorations',
                'Use a monochromatic base with one bold accent color',
                'Choose furniture with low profiles and minimal ornamentation',
                'Incorporate metallic accents in brushed nickel or chrome',
                'Use statement lighting as a focal point'
            ]
        },
        minimalist: {
            name: 'Minimalist',
            wallColor: '#ffffff',
            palette: ['#ffffff', '#f5f5f5', '#e0e0e0', '#9e9e9e', '#212121'],
            floor: 'concrete',
            furniture: [
                { type: 'sofa', color: 0xeeeeee, name: 'White Low Sofa' },
                { type: 'coffeetable', color: 0xfafafa, name: 'Glass Coffee Table' },
                { type: 'plant', color: 0xf5f5f5, name: 'White Ceramic Planter' }
            ],
            tips: [
                'Less is more - remove anything that doesn\'t serve a purpose',
                'Stick to a maximum of 3 colors in the entire room',
                'Choose multi-functional furniture pieces',
                'Hide storage behind clean, handle-free cabinetry',
                'Let negative space be a design element itself'
            ]
        },
        scandinavian: {
            name: 'Scandinavian',
            wallColor: '#fafaf8',
            palette: ['#fafaf8', '#e8dfd3', '#81ecec', '#b8d4e3', '#d4a76a'],
            floor: 'hardwood',
            furniture: [
                { type: 'sofa', color: 0xb8d4e3, name: 'Soft Blue Sofa' },
                { type: 'coffeetable', color: 0xd4a76a, name: 'Light Oak Table' },
                { type: 'chair', color: 0xd4a76a, name: 'Birch Wood Chair' },
                { type: 'rug', color: 0xe8dfd3, name: 'Cream Wool Rug' },
                { type: 'plant', color: 0xfafaf8, name: 'White Planter' },
                { type: 'lamp', color: 0xfafaf8, name: 'Minimal White Lamp' }
            ],
            tips: [
                'Maximize natural light - use sheer white curtains',
                'Mix warm wood tones with soft pastels and whites',
                'Add texture through wool, linen, and sheepskin throws',
                'Include plenty of greenery in simple white pots',
                'Choose furniture with tapered wooden legs'
            ]
        },
        industrial: {
            name: 'Industrial',
            wallColor: '#d5cec5',
            palette: ['#636e72', '#b2bec3', '#d35400', '#2d3436', '#8d6e63'],
            floor: 'concrete',
            furniture: [
                { type: 'sofa', color: 0x8d6e63, name: 'Leather Sofa' },
                { type: 'coffeetable', color: 0x2d3436, name: 'Iron & Wood Table' },
                { type: 'bookshelf', color: 0x2d3436, name: 'Metal Pipe Shelf' },
                { type: 'lamp', color: 0x2d3436, name: 'Edison Bulb Lamp' },
                { type: 'desk', color: 0x5c4033, name: 'Reclaimed Wood Desk' }
            ],
            tips: [
                'Expose brick, pipes, and ductwork where possible',
                'Mix raw materials: iron, reclaimed wood, concrete',
                'Use Edison bulb and pendant cage lighting',
                'Add warmth with leather and distressed wood',
                'Keep window treatments minimal or use metal blinds'
            ]
        },
        bohemian: {
            name: 'Bohemian',
            wallColor: '#fdf6ee',
            palette: ['#e17055', '#fdcb6e', '#00b894', '#6c5ce7', '#fd79a8'],
            floor: 'hardwood',
            furniture: [
                { type: 'sofa', color: 0xe17055, name: 'Terracotta Sofa' },
                { type: 'rug', color: 0xfdcb6e, name: 'Moroccan Pattern Rug' },
                { type: 'plant', color: 0xb87333, name: 'Terracotta Planter' },
                { type: 'bookshelf', color: 0x8d6e4c, name: 'Rattan Bookshelf' },
                { type: 'sidetable', color: 0xb87333, name: 'Brass Side Table' },
                { type: 'lamp', color: 0xfdcb6e, name: 'Macrame Lamp Shade' }
            ],
            tips: [
                'Layer patterns, textures, and colors freely',
                'Mix vintage and handcrafted pieces for eclectic charm',
                'Use floor cushions and poufs for casual seating',
                'Incorporate macrame, woven baskets, and tapestries',
                'Create a gallery wall with collected art and photos'
            ]
        },
        midcentury: {
            name: 'Mid-Century Modern',
            wallColor: '#f8f4ef',
            palette: ['#e17055', '#fdcb6e', '#0984e3', '#6d4c41', '#f8f4ef'],
            floor: 'hardwood',
            furniture: [
                { type: 'sofa', color: 0xe17055, name: 'Burnt Orange Sofa' },
                { type: 'chair', color: 0x0984e3, name: 'Teal Accent Chair' },
                { type: 'coffeetable', color: 0x6d4c41, name: 'Walnut Coffee Table' },
                { type: 'sidetable', color: 0x6d4c41, name: 'Walnut Side Table' },
                { type: 'lamp', color: 0xfdcb6e, name: 'Brass Tripod Lamp' },
                { type: 'plant', color: 0x6d4c41, name: 'Wooden Planter' }
            ],
            tips: [
                'Look for organic curves and tapered angled legs',
                'Use bold accent colors: mustard, teal, burnt orange',
                'Choose walnut and teak wood tones for warmth',
                'Add a statement Sputnik or globe pendant light',
                'Mix geometric patterns on pillows and textiles'
            ]
        },
        coastal: {
            name: 'Coastal',
            wallColor: '#f8fbfd',
            palette: ['#74b9ff', '#dfe6e9', '#ffeaa7', '#81ecec', '#ffffff'],
            floor: 'hardwood',
            furniture: [
                { type: 'sofa', color: 0xdfe6e9, name: 'Linen White Sofa' },
                { type: 'coffeetable', color: 0xdfe6e9, name: 'Driftwood Table' },
                { type: 'rug', color: 0x74b9ff, name: 'Blue Striped Rug' },
                { type: 'lamp', color: 0xffffff, name: 'White Rope Lamp' },
                { type: 'plant', color: 0xffffff, name: 'White Wicker Planter' },
                { type: 'chair', color: 0x81ecec, name: 'Light Aqua Chair' }
            ],
            tips: [
                'Use a palette of ocean blues, sandy beiges, and crisp whites',
                'Incorporate natural textures: rattan, jute, linen, rope',
                'Keep the space airy with sheer curtains and open layouts',
                'Add nautical accents subtly - avoid being too thematic',
                'Use weathered or whitewashed wood finishes'
            ]
        },
        japandi: {
            name: 'Japandi',
            wallColor: '#f5f0e8',
            palette: ['#f5f0e8', '#636e72', '#d4a76a', '#2d3436', '#a8a29e'],
            floor: 'hardwood',
            furniture: [
                { type: 'sofa', color: 0xa8a29e, name: 'Taupe Low Sofa' },
                { type: 'coffeetable', color: 0xd4a76a, name: 'Light Wood Table' },
                { type: 'plant', color: 0x636e72, name: 'Charcoal Stone Pot' },
                { type: 'rug', color: 0xf5f0e8, name: 'Natural Jute Rug' },
                { type: 'sidetable', color: 0xd4a76a, name: 'Wooden Stool Table' }
            ],
            tips: [
                'Blend Japanese minimalism with Scandinavian warmth',
                'Use natural, muted earth tones throughout the space',
                'Choose low-profile furniture with clean lines',
                'Incorporate wabi-sabi: embrace imperfect, handmade objects',
                'Create calm through intentional negative space and order'
            ]
        }
    };

    // Style selection
    $$('.style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedStyle = btn.dataset.style;
            renderDesignIdeas();
        });
    });

    function renderDesignIdeas() {
        const style = designStyles[state.selectedStyle];
        if (!style) return;

        const output = $('#design-output');
        const details = $('#design-details');

        if (!state.roomGenerated) {
            output.innerHTML = `
                <div class="design-card placeholder-card">
                    <div class="placeholder-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                    </div>
                    <p>Upload a photo and generate your 3D room first, then come back here for design ideas!</p>
                </div>`;
            details.classList.add('hidden');
            return;
        }

        // Show the style description
        output.innerHTML = `
            <div class="design-card" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px;">
                <h3 style="margin-bottom: 8px; font-size: 1.1rem;">${style.name} Style</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
                    Transform your ${state.roomConfig.type === 'living' ? 'living room' :
                    state.roomConfig.type === 'bedroom' ? 'bedroom' :
                    state.roomConfig.type === 'kitchen' ? 'kitchen' :
                    state.roomConfig.type === 'bathroom' ? 'bathroom' :
                    state.roomConfig.type === 'office' ? 'home office' :
                    'dining room'} with the ${style.name.toLowerCase()} aesthetic.
                    This style features ${style.tips[0].toLowerCase()}.
                </p>
            </div>`;

        // Color palette
        const paletteEl = $('#color-palette');
        paletteEl.innerHTML = style.palette.map(c => `
            <div class="palette-swatch">
                <div class="swatch" style="background: ${c};" title="${c}"></div>
                <span>${c}</span>
            </div>
        `).join('');

        // Furniture recommendations
        const recsEl = $('#furniture-recs');
        recsEl.innerHTML = style.furniture.map(f => `
            <div class="rec-item">
                <span class="rec-name">${f.name}</span>
                <div class="rec-color" style="background: #${new THREE.Color(f.color).getHexString()};"></div>
            </div>
        `).join('');

        // Tips
        const tipsEl = $('#design-tips');
        tipsEl.innerHTML = style.tips.map(t => `<li>${t}</li>`).join('');

        details.classList.remove('hidden');
    }

    // Apply design to 3D room
    $('#apply-design').addEventListener('click', () => {
        const style = designStyles[state.selectedStyle];
        if (!style || !state.roomGenerated) {
            showToast('Generate a 3D room first!', 'warning');
            return;
        }

        // Apply wall color
        state.wallColor = style.wallColor;
        wallColorInput.value = style.wallColor;
        colorLabel.textContent = style.wallColor;
        wallMeshes.forEach((mesh, i) => {
            if (i === 0 && state.photos.length > 0) return; // Keep photo on back wall
            mesh.material.color.set(style.wallColor);
            mesh.material.needsUpdate = true;
        });

        // Apply floor
        state.floorMaterial = style.floor;
        $$('.mat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.floor === style.floor);
        });

        // Clear and add recommended furniture
        while (furnitureGroup.children.length) {
            furnitureGroup.remove(furnitureGroup.children[0]);
        }
        state.furniture = [];

        const w = state.roomConfig.width * 0.3048;
        const d = state.roomConfig.depth * 0.3048;

        style.furniture.forEach((f, i) => {
            const angle = (i / style.furniture.length) * Math.PI * 1.2 - 0.3;
            const radius = Math.min(w, d) * 0.25;
            const pos = {
                x: Math.cos(angle) * radius * (0.5 + Math.random() * 0.5),
                y: 0,
                z: Math.sin(angle) * radius * (0.5 + Math.random() * 0.5)
            };
            addFurniture(f.type, f.color, pos);
        });

        // Rebuild room with new floor material
        buildRoom();

        // Switch to editor view
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        $$('.nav-btn')[1].classList.add('active');
        $$('.view').forEach(v => v.classList.remove('active'));
        $('#editor-view').classList.add('active');
        onResize();

        showToast(`${style.name} style applied!`, 'success');
    });

    // Initialize design view on first load
    renderDesignIdeas();

})();
