var mesh, skyBox, bmtext;

if (WEBGL.isWebGLAvailable() === false) {

    document.body.appendChild(WEBGL.getWebGLErrorMessage());

}

var container;
var camera, scene, renderer, light;

var vrEffect, vrControls, orbitControls;

function init() {

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

    //document.body.appendChild(WEBVR.createButton(renderer));
    //renderer.vr.enabled = true;

    vrControls = new THREE.VRControls(camera);
    vrEffect = new THREE.VREffect(renderer);

    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);

    if (navigator.getVRDisplays !== undefined) {
        navigator.getVRDisplays()
            .then(function (displays) {
                vrEffect.setVRDisplay(displays[0]);
                vrControls.setVRDisplay(displays[0]);
                //renderer.setDevice(displays[0]);
            });

        window.addEventListener('vrdisplaypresentchange', function () {
            if (!vrEffect.isPresenting) {
                camera.position.set(0.13, 0, -0.26);
                camera.quaternion.set(0, 0, 0, 1);
                orbitControls.target.copy(mesh.position);
            }
        }, false);

        window.addEventListener('vrdisplayactivate', function () {
            vrControls.resetPose();
        }, false);

        document.body.appendChild(WEBVR.getButton(vrEffect));

    } else {
        document.body.appendChild(WEBVR.getMessage());
    }


    //orbitControls.maxPolarAngle = Math.PI * 0.495;
    orbitControls.target.set(0, 10, 0);
    orbitControls.minDistance = 0.0;
    orbitControls.maxDistance = 100.0;
    orbitControls.zoomSpeed = 4.0;
    orbitControls.update();


    // Skybox

    var loader = new THREE.CubeTextureLoader();
    loader.setPath('./uw_sky/underwater/');
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

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 0) {
                var rep = xhr.response; // || xhr.mozResponseArrayBuffer;
                console.log(rep);
                parseStlBinary(rep);
                mesh.position.z = -3;
                mesh.position.y = 0;
                orbitControls.target.copy(mesh.position);
                console.log('done parsing');
            }
        }
    }
    xhr.onerror = function (e) {
        console.log(e);
    }

    xhr.open("GET", 'bellator.stl', true);
    xhr.responseType = "arraybuffer";
    xhr.send(null)

    //text
    
    var r = new XMLHttpRequest();
    

    r.onreadystatechange = function () {
        if (r.readyState === 4 && r.status === 200) {
            setup(JSON.parse(r.responseText));
        }
    };

    r.open('GET', 'bitmap.json');
    r.responseType = 'json';
    r.overrideMimeType("application/json");

    r.send();

    //window.addEventListener('resize', onWindowResize, false);
}

function setup(font) {
    // pass font into TextBitmap object
    bmtext = new TextBitmap({
        imagePath: 'bitmap1.png',
        text: 'The quick brown fox jumps over the lazy dog.',
        width: 1000,
        align: 'center',
        font: font,
        lineHeight: font.common.lineHeight - 20,
        letterSpacing: 1,
        scale: 0.004, //0.0004,
        rotate: false,
        color: "#ccc",
        showHitBox: true // for debugging
    });

    bmtext.group.position.set(0, 10, 0);
    //orbitControls.target.copy(bmtext.group.position);

    scene.add(bmtext.group);
    //hitBoxes.push(bmtext.hitBox);

    bmtext.group.add(new THREE.AxisHelper(20));
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
    } else {
        orbitControls.update();
    }


    if (mesh) {
        //mesh.rotation.y += 0.02;
    }

    skyBox.position.copy(camera.position);

    vrEffect.render(scene, camera);
    //renderer.setAnimationLoop(render);
}

function render() {
    
    //renderer.render(scene, camera);
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

    // The binary STL I'm testing with seems to have all
    // zeroes for the normals, unlike its ASCII counterpart.
    // We can use three.js to compute the normals for us, though,
    // once we've assembled our geometry. This is a relatively
    // expensive operation, but only needs to be done once.
    geo.computeFaceNormals();

    var loader = new THREE.TextureLoader();
    var texture = loader.load("fossil.jpeg")
    texture.flipY = false;

    mesh = new THREE.Mesh(
        geo,
        // new THREE.MeshNormalMaterial({
        //     overdraw:true
        // }
        new THREE.MeshLambertMaterial({
            map: texture
            //overdraw: true,
            //color: 0xaaaaaa,
            //shading: THREE.FlatShading
        }
        ));

    scene.add(mesh);

    stl = null;
};

init();
animate();