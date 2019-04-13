var mesh, skyBox;

if (WEBGL.isWebGLAvailable() === false) {

    document.body.appendChild(WEBGL.getWebGLErrorMessage());

}

function getVRDisplay(onDisplay) {

    if ('getVRDisplays' in navigator) {

        navigator.getVRDisplays()
            .then(function (displays) {
                onDisplay(displays[0]);
            });

    }

}

var container;
var camera, scene, renderer, light;
var controls, water, sphere;



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
                mesh.position.z = -2;
                mesh.position.y = 0;
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


    document.body.appendChild(WEBVR.createButton(renderer));
    renderer.vr.enabled = true;

    getVRDisplay(function (display) {
        renderer.vr.setDevice(display);
    });


    //
    /*
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set( 0, 10, 0 );
    controls.minDistance = 40.0;
    controls.maxDistance = 200.0;
    controls.update();
    */

    //

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {

    if (mesh) {
        mesh.rotation.y += 0.02;
    }

    skyBox.position.copy(camera.position);
    renderer.render(scene, camera);
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