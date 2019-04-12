

var camera, cameraCube, controls, scene, renderer,
    geometry, material, mesh, light1, stats;

function trim(str) {
    str = str.replace(/^\s+/, '');
    for (var i = str.length - 1; i >= 0; i--) {
        if (/\S/.test(str.charAt(i))) {
            str = str.substring(0, i + 1);
            break;
        }
    }
    return str;
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

    return mesh;
};

if (WEBGL.isWebGLAvailable() === false) {

    document.body.appendChild(WEBGL.getWebGLErrorMessage());

}

init();
animate();

function init() {

    //Detector.addGetWebGLMessage();

    scene = new THREE.Scene();
    sceneCube = new THREE.Scene();

    textureCube = new THREE.TextureLoader().load("background.png");
    textureCube.format = THREE.PNGFormat;
    textureCube.mapping = THREE.CubeReflectionMapping;
    textureCube.encoding = THREE.sRGBEncoding;

    var cubeShader = THREE.ShaderLib["cube"];
    var cubeMaterial = new THREE.ShaderMaterial({
        fragmentShader: cubeShader.fragmentShader,
        vertexShader: cubeShader.vertexShader,
        uniforms: cubeShader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    });

    cubeMaterial.uniforms["tCube"].value = textureCube;
    Object.defineProperty(cubeMaterial, 'map', {

        get: function () {

            return this.uniforms.tCube.value;

        }

    });

    // Skybox

    cubeMesh = new THREE.Mesh(new THREE.BoxBufferGeometry(100, 100, 100), cubeMaterial);
    sceneCube.add(cubeMesh);

    renderer = new THREE.WebGLRenderer();
    renderer.autoClear = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    renderer.gammaOutput = true;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 500;
    camera.position.y = 0;
    scene.add(camera);

    cameraCube = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100000);

    //controls = new THREE.OrbitControls(camera);
    //controls.minDistance = 500;
    //controls.maxDistance = 2500;


    var directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.x = 0;
    directionalLight.position.y = 0;
    directionalLight.position.z = 1;
    directionalLight.position.normalize();
    scene.add(directionalLight);

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 0) {
                var rep = xhr.response; // || xhr.mozResponseArrayBuffer;
                console.log(rep);
                parseStlBinary(rep);
                //parseStl(xhr.responseText);
                mesh.rotation.x = 5;
                mesh.rotation.z = .25;
                mesh.position.z = -1500;
                mesh.position.y = -400;
                console.log('done parsing');
            }
        }
    }
    xhr.onerror = function (e) {
        console.log(e);
    }

    xhr.open("GET", 'bellator.stl', true);
    xhr.responseType = "arraybuffer";
    //xhr.setRequestHeader("Accept","text/plain");
    //xhr.setRequestHeader("Content-Type","text/plain");
    //xhr.setRequestHeader('charset', 'x-user-defined');
    xhr.send(null);

    /*
    AFRAME.registerComponent('example-geometry', {
        update: function () {
            var mesh = this.el.getOrCreateObject3D('mesh', THREE.Mesh);
            mesh.geometry = new THREE.Geometry();
        }
    });
    */

    //renderer = new THREE.WebGLRenderer(); //new THREE.CanvasRenderer();
    //renderer.setSize(window.innerWidth, window.innerHeight);

    //document.body.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    document.body.appendChild(WEBVR.createButton(renderer));
    renderer.vr.enabled = true;

    /*
    // vive controllers
    controller1 = new THREE.ViveController(0);
    controller1.standingMatrix = renderer.vr.getStandingMatrix();
    controller1.userData.id = 0;
    scene.add(controller1);

    controller2 = new THREE.ViveController(1);
    controller2.standingMatrix = renderer.vr.getStandingMatrix();
    controller2.userData.id = 1;
    scene.add(controller2);
    

    var loader = new THREE.OBJLoader();
    loader.setPath('vive-controller/');
    loader.load('vr_controller_vive_1_5.obj', function (object) {

        var loader = new THREE.TextureLoader();
        loader.setPath('vive-controller/');

        var controller = object.children[0];
        controller.material.map = loader.load('onepointfive_texture.png');
        controller.material.specularMap = loader.load('onepointfive_spec.png');
        controller.castShadow = true;
        controller.receiveShadow = true;

        controller1.add(controller.clone());
        controller2.add(controller.clone());
    });
    */

    //renderer.setAnimationLoop(render);
}

function animate() {
    requestAnimationFrame(animate);

    render();
}

function render() {

    //handleController(controller1);
    //handleController(controller2);

    //mesh.rotation.x += 0.01;
        if (mesh) {
        mesh.rotation.z += 0.02;
    }
    //light1.position.z -= 1;

    //controls.update();
    //camera.lookAt(scene.position);
    cameraCube.rotation.copy(camera.rotation);

    renderer.render(sceneCube, cameraCube);

    renderer.render(scene, camera);
    stats.update();
}

function handleController(controller) {
    controller.update();

}