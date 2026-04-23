document.addEventListener('DOMContentLoaded', () => {
    // Basic Three.js setup
    const container = document.getElementById('canvas-container');
    if (!container || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Objects
    // Main Geometry - Rotating Sphere built with particles
    const geometry = new THREE.IcosahedronGeometry(2, 2);
    
    // Material
    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x38bdf8, // Sky Blue
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    // Mesh
    const sphere = new THREE.Points(geometry, material);
    scene.add(sphere);

    // Add some random floating particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 700;
    const posArray = new Float32Array(particlesCount * 3);

    for(let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 15; // Spread particles around
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x818cf8, // Indigo
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX - windowHalfX);
        mouseY = (event.clientY - windowHalfY);
    });

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Theme integration - listen for theme changes to alter colors slightly
    const themeBtn = document.getElementById('theme-toggle');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-theme');
            if(!isDark) {
                // Light mode colors
                material.color.setHex(0x0ea5e9); // Darker blue
                particlesMaterial.color.setHex(0x4f46e5); // Darker indigo
            } else {
                // Dark mode colors
                material.color.setHex(0x38bdf8); // Sky blue
                particlesMaterial.color.setHex(0x818cf8); // Indigo
            }
        });
    }

    // Animation Loop
    const clock = new THREE.Clock();

    const tick = () => {
        const elapsedTime = clock.getElapsedTime();

        // Update objects
        sphere.rotation.y = .1 * elapsedTime;
        sphere.rotation.x = .05 * elapsedTime;
        
        particlesMesh.rotation.y = -0.05 * elapsedTime;

        // Smooth mouse movement tracking
        targetX = mouseX * 0.001;
        targetY = mouseY * 0.001;

        sphere.rotation.y += 0.05 * (targetX - sphere.rotation.y);
        sphere.rotation.x += 0.05 * (targetY - sphere.rotation.x);

        // Render
        renderer.render(scene, camera);

        // Call tick again on the next frame
        window.requestAnimationFrame(tick);
    };

    tick();
});
