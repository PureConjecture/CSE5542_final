var container;
var camera, target, scene, renderer, light;
var mesh, meshGroup, skyBox, nameText, loadText;
var vrEffect, vrControls, orbitControls;
var INTERSECTED, arrow, raycaster;
var outline, highlight, composer;
var hotspots = [], labels = [], labelGroup;


function init() {
    if (WEBGL.isWebGLAvailable() === false) {
        document.body.appendChild(WEBGL.getWebGLErrorMessage());
    }
    container = document.getElementById('container');

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);

    light = new THREE.DirectionalLight(0xffffff, 0.8);
    scene.add(light);

    // VR setup

    vrControls = new THREE.VRControls(camera);
    vrEffect = new THREE.VREffect(renderer);
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);

    if (navigator.getVRDisplays !== undefined) {
        navigator.getVRDisplays()
            .then(function (displays) {
                vrEffect.setVRDisplay(displays[0]);
                vrControls.setVRDisplay(displays[0]);
            });

        window.addEventListener('vrdisplaypresentchange', function () {
            if (!vrEffect.isPresenting) {
                camera.position.set(0, 0, 0);
                camera.quaternion.set(0, 0, 0, 1);
                orbitControls.target.copy(meshGroup.position);
            }
        }, false);

        window.addEventListener('vrdisplayactivate', function () {
            vrControls.resetPose();
        }, false);

        document.body.appendChild(WEBVR.getButton(vrEffect));
    } else {
        document.body.appendChild(WEBVR.getMessage());
    }

    // Skybox

    var loader = new THREE.CubeTextureLoader();
    loader.setPath('./assets/uw_sky/underwater/');
    var textureCube = loader.load(['uw_bk.jpg', 'uw_ft.jpg', 'uw_dn.jpg', 'uw_up.jpg', 'uw_rt.jpg', 'uw_lf.jpg']);

    var skyMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        envMap: textureCube,
        side: THREE.BackSide
    });

    var skyGeometry = new THREE.BoxGeometry(1024, 1024, 1024);
    var skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);

    skyBox = new THREE.Object3D();
    skyBox.add(skyMesh);
    scene.add(skyBox);

    // get fish model

    meshGroup = new THREE.Object3D();
    meshGroup.scale.set(0.25, 0.25, 0.25);

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 0) {
                var rep = xhr.response; // || xhr.mozResponseArrayBuffer;
                console.log(rep);
                parseStlBinary(rep);
                meshGroup.position.z = -1.5;
                orbitControls.target.copy(meshGroup.position);
                console.log('done parsing');
            }
        }
    }
    xhr.onerror = function (e) {
        console.log(e);
    }

    xhr.open("GET", 'assets/bellator.stl', true);
    xhr.responseType = "arraybuffer";
    xhr.send(null)

    // text
    
    var r = new XMLHttpRequest();
    r.onreadystatechange = function () {
        if (r.readyState == 4) {
            if (r.status == 200 || r.status == 0) {
                addText(JSON.parse(r.responseText));
            }         
        }
    };

    r.open('GET', 'assets/calibri.json');
    r.overrideMimeType("application/json");
    r.send();

    // image

    var img = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('assets/fish.jpg')
    })
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), img);
    plane.overdraw = true;
    plane.position.set(-20, 0, -20);
    plane.rotation.set(0, 120, 0);
    scene.add(plane);

    // raycast

    raycaster = new THREE.Raycaster();
    arrow = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 100, 0xff0000, 1, 1);
    arrow.line.visible = false;
    scene.add(arrow);

    // hotspots

    composer = new THREE.EffectComposer(renderer);
    var renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    outline = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    outline.selectedObjects = [];
    outline.visibleEdgeColor.set('#ffffff');
    outline.edgeStrength = 5;
    outline.edgeGlow = 0;
    outline.edgeThickness = 1;
    composer.addPass(outline);

    highlight = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    highlight.visibleEdgeColor.set('#ff0000');
    highlight.edgeStrength = 5;
    highlight.edgeGlow = 1;
    highlight.edgeThickness = 2;
    composer.addPass(highlight);

    var sphereGeometry = new THREE.SphereGeometry(.3, 32, 32);
    var canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    var ctx = canvas.getContext("2d");
    var gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0.35, "black");
    gradient.addColorStop(0.475, "white");
    gradient.addColorStop(0.525, "white");
    gradient.addColorStop(0.65, "black");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    var alphaTexture = new THREE.Texture(canvas);
    var sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, alphaMap: alphaTexture });

    addHotspot(sphereGeometry, sphereMaterial, .75, -.5, 1);
    addHotspot(sphereGeometry, sphereMaterial, -1.8, -.5, .4); 
    addHotspot(sphereGeometry, sphereMaterial, 2.2, .2, 0); 
    addHotspot(sphereGeometry, sphereMaterial, 1, -.1, 0); 

    // mouse control settings
    orbitControls.target.copy(meshGroup.position);
    orbitControls.minDistance = 0.0;
    orbitControls.maxDistance = 100.0;
    orbitControls.zoomSpeed = 4.0;
    orbitControls.update();

    // resize
    window.addEventListener('resize', onWindowResize, false);
}



function addHotspot(geo, mat, x, y, z) {  
    var sphere = new THREE.Mesh(geo, mat);
    sphere.scale.set(0.5, 0.5, 0.5);
    outline.selectedObjects.push(sphere);
    sphere.position.set(x, y, z);
    meshGroup.add(sphere);
    hotspots.push(sphere);
}


function addText(font) {
    // pass font into TextBitmap object
    nameText = new TextBitmap({
        imagePath: 'assets/calibri.png',
        text: 'Bellator militaris',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.01,
        rotate: false,
        color: "#ccc",
        showHitBox: false // for debugging
    });

    nameText.group.position.set(-20, 6, -20);
    nameText.group.rotation.set(0, 120, 0);

    scene.add(nameText.group);

    loadText = new TextBitmap({
        imagePath: 'assets/calibri.png',
        text: 'Loading model ...',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.005,
        rotate: false,
        color: "#ccc",
        showHitBox: false
    });

    loadText.group.position.set(0, 0, -4);
    scene.add(loadText.group);

    labelGroup = new THREE.Object3D();
    meshGroup.add(labelGroup);

    labels[0] = new TextBitmap({
        imagePath: 'assets/calibri.png',
        text: 'Cheek spikes',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.0025,
        rotate: false,
        color: "#ff0000",
        showHitBox: false
    });

    labels[1] = new TextBitmap({
        imagePath: 'assets/calibri.png',
        text: 'Nose protrusions',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.0025,
        rotate: false,
        color: "#ff0000",
        showHitBox: false
    });

    labels[2] = new TextBitmap({
        imagePath: 'assets/calibri.png',
        text: 'Dorsal fin spines',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.0025,
        rotate: false,
        color: "#ff0000",
        showHitBox: false
    });

    labels[3] = new TextBitmap({
        imagePath: 'assets/calibri.png',
        text: 'Vertebrae',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.0025,
        rotate: false,
        color: "#ff0000",
        showHitBox: false
    });
    
    labels[0].group.position.set(.75, -1, 1);
    labels[1].group.position.set(-1.8, -1, .4);
    labels[2].group.position.set(2.2, -.3, 0);
    labels[3].group.position.set(1, -.6, 0);
}



function onWindowResize() {
    var width = window.innerWidth;
    var height = window.innerHeight;

    vrEffect.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}


function animate() {  

    vrEffect.requestAnimationFrame(animate);

    if (vrEffect.isPresenting) {
        vrControls.update();

        // update the raycaster
        var camPoint = new THREE.Vector3(0, 0, 0.5);
        camPoint.unproject(camera);
        raycaster.set(camera.position, camPoint.sub(camera.position).normalize());

        // update the position of arrow
        arrow.setDirection(raycaster.ray.direction);
        
        // intersect with hotspots
        var intersects = raycaster.intersectObjects(hotspots);
        var intersectedObject;
        if (intersects.length > 0) {
            intersectedObject = intersects[0].object;
            for (var i = 0; i < hotspots.length; i++) {
                if (intersectedObject == hotspots[i]) {
                    // if not highlighted, highlight and show text label
                    if (highlight.selectedObjects.length == 0) {
                        highlight.selectedObjects.push(hotspots[i]);
                        labelGroup.add(labels[i].group);
                        // face camera
                        labelGroup.quaternion.copy(camera.getWorldQuaternion());
                    }
                }
            }   
        } else {
            // un-highlight previously selected hotspot and remove text
            highlight.selectedObjects = [];
            labelGroup.remove(labelGroup.children[0]);
        }
    } else {
        orbitControls.update();
    }

    skyBox.position.copy(camera.position);
    
    vrEffect.render(scene, camera);
    composer.render();
}


// Notes:
// - STL file format: http://en.wikipedia.org/wiki/STL_(file_format)
// - 80 byte unused header
// - All binary STLs are assumed to be little endian, as per wiki doc
var parseStlBinary = function (stl) {
    var geo = new THREE.Geometry();
    var dv = new DataView(stl, 80); // 80 == unused header
    var isLittleEndian = true;
    var triangles = dv.getUint32(0, isLittleEndian);

    // console.log('arraybuffer length:  ' + stl.byteLength);
    // console.log('number of triangles: ' + triangles);

    var offset = 4;
    for (var i = 0; i < triangles; i++) {
        // Get the normal for this triangle
        var normal = new THREE.Vector3(
            dv.getFloat32(offset, isLittleEndian),
            dv.getFloat32(offset + 4, isLittleEndian),
            dv.getFloat32(offset + 8, isLittleEndian)
        );
        offset += 12;

        // Get all 3 vertices for this triangle
        for (var j = 0; j < 3; j++) {
            geo.vertices.push(
                new THREE.Vector3(
                    dv.getFloat32(offset, isLittleEndian),
                    dv.getFloat32(offset + 4, isLittleEndian),
                    dv.getFloat32(offset + 8, isLittleEndian)
                )
            );
            offset += 12
        }

        // there's also a Uint16 "attribute byte count" that we
        // don't need, it should always be zero.
        offset += 2;

        // Create a new face for from the vertices and the normal
        geo.faces.push(new THREE.Face3(i * 3, i * 3 + 1, i * 3 + 2, normal));
    }

    geo.computeFaceNormals();

    var loader = new THREE.TextureLoader();
    var texture = loader.load("assets/fossil.jpeg")
    texture.flipY = false;

    mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({
            map: texture
        }
        ));

    scene.remove(loadText.group);
    meshGroup.add(mesh);
    scene.add(meshGroup);

    stl = null;
};


init();
animate();