// Spinning wireframe record behind the host UI (Three.js is loaded globally from the CDN)

export function startBackground(container, isPlaying) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Record
  const geometry = new THREE.CylinderGeometry(3, 3, 0.2, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0x1DB954, wireframe: true });
  const recordMesh = new THREE.Mesh(geometry, material);
  scene.add(recordMesh);

  camera.position.z = 7;
  recordMesh.rotation.x = 0.5;

  // Spin faster while the winning track is playing
  let spinSpeed = 0.001;
  function animate() {
    requestAnimationFrame(animate);
    const target = isPlaying() ? 0.02 : 0.001;
    spinSpeed += (target - spinSpeed) * 0.02;
    recordMesh.rotation.y += spinSpeed;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
