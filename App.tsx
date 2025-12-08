import React, { useState, useRef, useEffect, Suspense } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows, Edges, Html, Line, Grid, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI } from "@google/genai";
import { 
  ArrowRight, 
  ScanLine, 
  PenTool, 
  Mic, 
  Send, 
  Wand2, 
  ChevronLeft,
  Loader2,
  MousePointer2,
  Undo2,
  Trash2,
  Box,
  Triangle,
  Circle,
  Upload,
  FileText,
  Sparkles,
  BrainCircuit,
  Layers,
  Cpu,
  Eye,
  GraduationCap,
  HelpCircle,
  Check
} from 'lucide-react';

// --- Types ---
type ViewState = 'landing' | 'dashboard' | 'scan' | 'sketchpad' | 'workspace';
type GeometryType = 'default' | 'cube' | 'pyramid' | 'frustum';
type ChatMessage = { role: 'ai' | 'user'; text: string; isThinking?: boolean };
type ProblemContext = {
    text: string;
    image?: string;
    type: GeometryType;
};

// --- Constants & Styles ---
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: 20, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -20, filter: 'blur(10px)' },
};

const TRANSITION = { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const };

// --- RAG / Knowledge Base ---
const GEOMETRY_KNOWLEDGE_BASE = {
  cube: {
    definition: "A regular hexahedron with 6 equal square faces.",
    formulas: [
      "Volume = s³ (where s is side length)",
      "Surface Area = 6s²",
      "Space Diagonal = s√3",
      "Face Diagonal = s√2"
    ],
    properties: ["12 Edges", "8 Vertices", "6 Faces", "All angles are 90°"]
  },
  pyramid: {
    definition: "A polyhedron with a polygonal base and triangular faces that meet at a point (apex).",
    formulas: [
      "Volume = (1/3) × Base Area × Height",
      "Slant Height² = Height² + (Base/2)² (for square pyramid)",
      "Total Surface Area = Base Area + Lateral Area"
    ],
    properties: ["The height is the perpendicular distance from apex to base", "Slant height is the height of the triangular face"]
  },
  frustum: {
    definition: "The portion of a cone or pyramid that remains after its upper part has been cut off by a plane parallel to its base.",
    formulas: [
      "Volume (Cone Frustum) = (1/3)πh(R² + r² + Rr)",
      "Lateral Area = π(R + r)s (where s is slant height)",
      "Slant Height s = √((R-r)² + h²)"
    ],
    properties: ["Two parallel bases (top and bottom)", "Height is perpendicular distance between bases"]
  },
  default: {
    definition: "A complex or general geometric shape.",
    formulas: ["Volume usually depends on decomposing the shape."],
    properties: ["Check for symmetry", "Identify basic components (spheres, cylinders, etc.)"]
  }
};

const retrieveContext = (query: string, type: GeometryType): string => {
  const knowledge = GEOMETRY_KNOWLEDGE_BASE[type] || GEOMETRY_KNOWLEDGE_BASE.default;
  const q = query.toLowerCase();
  
  let retrievedInfo = [`Definition: ${knowledge.definition}`];
  
  // Naive retrieval based on keywords
  if (q.includes("volume") || q.includes("space") || q.includes("capacity")) {
    retrievedInfo.push(`Relevant Formulas: ${knowledge.formulas.filter(f => f.includes("Volume")).join("; ")}`);
  }
  if (q.includes("area") || q.includes("surface")) {
    retrievedInfo.push(`Relevant Formulas: ${knowledge.formulas.filter(f => f.includes("Area")).join("; ")}`);
  }
  if (q.includes("diagonal") || q.includes("height") || q.includes("slant")) {
    retrievedInfo.push(`Properties/Other Formulas: ${knowledge.formulas.join("; ")}`);
  }
  
  // If query is generic, provide general properties
  if (retrievedInfo.length === 1) {
     retrievedInfo.push(`Key Properties: ${knowledge.properties.join("; ")}`);
  }

  return retrievedInfo.join("\n");
};

// --- Custom Cursor Component ---
const CustomCursor = () => {
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    
    const handleMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || 
          (e.target as HTMLElement).tagName === 'A' ||
          (e.target as HTMLElement).closest('button') ||
          (e.target as HTMLElement).closest('.interactive')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [mouseX, mouseY]);

  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  return (
    <motion.div
      className="fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-[9999] mix-blend-difference bg-white hidden md:block"
      style={{
        x: smoothX,
        y: smoothY,
        translateX: '-50%',
        translateY: '-50%',
      }}
      animate={{
        scale: isHovering ? 2.5 : 1,
        opacity: 1
      }}
      transition={{ duration: 0.2 }}
    />
  );
};


// --- 3D Materials & Components ---

const ClayMaterial = ({ color = "#1a1a1a", roughness = 0.6 }) => (
  <meshStandardMaterial 
    color={color}
    roughness={roughness} 
    metalness={0.1} 
  />
);

const CrystalMaterial = () => (
    <meshPhysicalMaterial 
        roughness={0} 
        transmission={1} 
        thickness={0.8}
        ior={1.5}
        clearcoat={1}
        clearcoatRoughness={0}
        attenuationDistance={0.8}
        attenuationColor="#ffffff"
        color="#ffffff"
        transparent
    />
);

const CanvasLoader = () => (
  <Html center>
    <div className="flex flex-col items-center gap-3 backdrop-blur-md bg-white/50 p-4 rounded-xl shadow-sm border border-white/50">
      <Loader2 className="w-6 h-6 text-black animate-spin" />
      <span className="text-[10px] font-serif font-bold text-slate-500 uppercase tracking-widest">Loading Model</span>
    </div>
  </Html>
);

const MathematicalSculpture = ({ scrollProgress = 0 }: { scrollProgress?: number }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Group>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // --- SCROLL DRIVEN ANIMATIONS ---
    // Target positions based on scroll phases
    // Phase 1 (Hero): x=4
    // Phase 2 (Features): x=-4
    // Phase 3 (Tech): x=0 (Center)
    
    let targetX = 4;
    let targetScale = 1;
    let targetWireframeOpacity = 0.05;
    let targetWireframeScale = 2.4;

    if (scrollProgress < 0.3) {
        // Hero -> Features
        const progress = Math.min(scrollProgress / 0.3, 1);
        targetX = THREE.MathUtils.lerp(4, -4, progress);
    } else if (scrollProgress < 0.6) {
        // Features -> Tech
        const progress = Math.min((scrollProgress - 0.3) / 0.3, 1);
        targetX = THREE.MathUtils.lerp(-4, 0, progress);
        targetScale = THREE.MathUtils.lerp(1, 1.3, progress);
        targetWireframeOpacity = THREE.MathUtils.lerp(0.05, 0.4, progress);
        targetWireframeScale = THREE.MathUtils.lerp(2.4, 3.5, progress); // Expand wireframe
    } else {
         // Tech -> End
         targetX = 0;
         targetScale = 1.3;
         targetWireframeOpacity = 0.4;
         targetWireframeScale = 3.5;
    }

    // Apply Lerp for smooth transition (adjusted for smoother feel)
    if (groupRef.current) {
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.08);
        groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.08));
        
        // Constant rotation
        groupRef.current.rotation.y = t * 0.1;
        groupRef.current.rotation.z = Math.sin(t * 0.1) * 0.05;
    }

    if (coreRef.current) {
        coreRef.current.rotation.x = t * 0.2;
        coreRef.current.rotation.z = t * 0.1;
    }
    
    if (outerRef.current) {
        outerRef.current.rotation.y = -t * 0.15;
        outerRef.current.rotation.x = Math.cos(t * 0.2) * 0.1;
        // Dynamically update wireframe scale and opacity based on scroll
        outerRef.current.scale.setScalar(THREE.MathUtils.lerp(outerRef.current.scale.x, targetWireframeScale, 0.05));
        
        const material = (outerRef.current.children[0] as any).material;
        if (material) {
             material.opacity = THREE.MathUtils.lerp(material.opacity, targetWireframeOpacity, 0.05);
        }
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5} floatingRange={[-0.2, 0.2]}>
      <group ref={groupRef} position={[4, 0, 0]}>
        
        {/* Layer 1: Solid Core */}
        <mesh ref={coreRef} scale={0.8} castShadow>
             <dodecahedronGeometry args={[1, 0]} />
             <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.8} />
             <Edges color="#404040" threshold={15} />
        </mesh>

        {/* Layer 2: Glass Shell */}
        <group rotation={[0.2, 0, 0]}>
            <mesh ref={glassRef} scale={1.6} castShadow>
                <icosahedronGeometry args={[1, 0]} />
                <CrystalMaterial />
                <Edges color="#e5e5e5" threshold={15} opacity={0.5} transparent />
            </mesh>
        </group>

        {/* Layer 3: Outer Wireframe Cage */}
        <group ref={outerRef} rotation={[0, 0, 0.5]}>
            <mesh scale={1}>
                <icosahedronGeometry args={[1, 1]} />
                <meshBasicMaterial color="#000000" wireframe transparent opacity={0.05} />
            </mesh>
            
            {/* Orbiting Satellites */}
            <mesh position={[2.8, 0, 0]} castShadow>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshStandardMaterial color="black" />
            </mesh>
            <mesh position={[-2.4, 1.2, 0]} castShadow>
                <sphereGeometry args={[0.1, 32, 32]} />
                <meshStandardMaterial color="black" />
            </mesh>
        </group>

        {/* Cinematic Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={3.5}>
            <torusGeometry args={[1, 0.005, 16, 100]} />
            <meshStandardMaterial color="#000000" />
        </mesh>
      </group>
    </Float>
  );
};

const WorkspaceGeometry = ({ type }: { type: GeometryType }) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
      if (type === 'default' && meshRef.current) {
          meshRef.current.rotation.y += 0.005;
          meshRef.current.rotation.z += 0.002;
      }
  });

  return (
    <group position={[0, -0.5, 0]}>
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
        
        {type === 'default' && (
          <group ref={meshRef}>
            {/* Complex/Scanning Shape Visualization */}
            <mesh castShadow receiveShadow>
              <dodecahedronGeometry args={[1.8, 0]} />
              <CrystalMaterial />
              <Edges color="#1a1a1a" threshold={10} opacity={0.5} transparent />
            </mesh>
            <mesh scale={1.2}>
               <dodecahedronGeometry args={[1.8, 1]} />
               <meshBasicMaterial color="#000000" wireframe opacity={0.05} transparent />
            </mesh>
            {/* Scanning Ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                 <torusGeometry args={[2.5, 0.02, 16, 100]} />
                 <meshBasicMaterial color="black" opacity={0.2} transparent />
            </mesh>
          </group>
        )}

        {type === 'cube' && (
          <group>
             <mesh position={[0, 0, 0]} castShadow receiveShadow rotation={[0.5, 0.5, 0]}>
                <boxGeometry args={[2.5, 2.5, 2.5]} />
                <CrystalMaterial />
                <Edges color="#000000" threshold={15} />
             </mesh>
             {/* Internal Diagonals */}
             <group rotation={[0.5, 0.5, 0]}>
                <Line points={[[-1.25, -1.25, -1.25], [1.25, 1.25, 1.25]]} color="#000000" opacity={0.2} transparent lineWidth={1} />
                <Line points={[[-1.25, 1.25, -1.25], [1.25, -1.25, 1.25]]} color="#000000" opacity={0.2} transparent lineWidth={1} />
                <Line points={[[-1.25, -1.25, 1.25], [1.25, 1.25, -1.25]]} color="#000000" opacity={0.2} transparent lineWidth={1} />
                <Line points={[[-1.25, 1.25, 1.25], [1.25, -1.25, -1.25]]} color="#000000" opacity={0.2} transparent lineWidth={1} />
             </group>
          </group>
        )}

        {type === 'pyramid' && (
           <group>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow rotation={[0, 0.5, 0]}>
                <coneGeometry args={[2, 3, 4]} />
                <CrystalMaterial />
                <Edges color="#000000" threshold={15} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 3]} />
                <meshBasicMaterial color="#ef4444" opacity={0.8} transparent />
            </mesh>
            <group position={[0, -1, 0]} rotation={[0, 0.5, 0]}>
                <Line points={[[-1.414, 0, -1.414], [1.414, 0, 1.414]]} color="#000000" opacity={0.2} transparent lineWidth={1} />
                <Line points={[[-1.414, 0, 1.414], [1.414, 0, -1.414]]} color="#000000" opacity={0.2} transparent lineWidth={1} />
            </group>
          </group>
        )}

        {type === 'frustum' && (
            <group>
             <mesh position={[0, 0, 0]} castShadow receiveShadow rotation={[0.2, 0, 0]}>
                 <cylinderGeometry args={[1, 2, 2.5, 32]} />
                 <CrystalMaterial />
                 <Edges color="#000000" threshold={15} />
             </mesh>
             <mesh position={[0, 0, 0]} rotation={[0.2, 0, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 2.5]} />
                <meshBasicMaterial color="#ef4444" opacity={0.5} transparent />
             </mesh>
            </group>
        )}

      </Float>
    </group>
  );
};

const SceneSetup = ({ children, grid = false, eventSource }: { children?: React.ReactNode, grid?: boolean, eventSource?: React.RefObject<HTMLElement> }) => (
  <Canvas shadows eventSource={eventSource} className="canvas-container" camera={{ position: [0, 0, 9], fov: 35 }} dpr={[1, 2]}>
    <color attach="background" args={['#FFFFFF']} />
    
    {/* Studio Lighting Environment - High End Look */}
    <Environment resolution={512}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="rect" intensity={4} position={[10, 5, 10]} scale={10} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        </group>
        <group rotation={[Math.PI / 3, 0, 1]}>
           <Lightformer form="rect" intensity={2} position={[-5, 1, -10]} scale={10} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        </group>
         <group rotation={[0, 0, 1]}>
           <Lightformer form="circle" intensity={2} position={[0, 10, 0]} scale={10} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        </group>
    </Environment>

    {/* Supplementary Lights */}
    <ambientLight intensity={0.4} />
    <spotLight 
      position={[10, 10, 10]} 
      angle={0.15} 
      penumbra={1} 
      intensity={1} 
      castShadow 
      shadow-mapSize={[2048, 2048]} 
    />

    {grid && (
        <Grid 
            position={[0, -4, 0]} 
            args={[20, 20]} 
            cellSize={1} 
            cellThickness={0.5} 
            cellColor="#cbd5e1" 
            sectionSize={5} 
            sectionThickness={1}
            sectionColor="#94a3b8"
            fadeDistance={15}
            fadeStrength={1}
        />
    )}

    <Suspense fallback={<CanvasLoader />}>
      {children}
    </Suspense>
    
    {/* Soft Contact Shadows */}
    <ContactShadows position={[0, -3.5, 0]} opacity={0.4} scale={20} blur={2.5} far={4} color="#000000" />
    <OrbitControls makeDefault enableZoom={false} enablePan={false} enableRotate={true} autoRotate={false} />
  </Canvas>
);

// --- UI Components ---

const LogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="21" y="4" width="6" height="40" rx="0.5" /> 
    <rect x="4" y="21" width="40" height="6" rx="0.5" /> 
    <rect x="21" y="4" width="6" height="40" rx="0.5" transform="rotate(45 24 24)" /> 
  </svg>
);

// --- Sub-Views ---

const LandingView: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const progress = scrollTop / (scrollHeight - clientHeight);
        setScrollProgress(progress);
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" as const },
    transition: { duration: 0.8, ease: "easeOut" as const }
  };

  return (
    <motion.div 
      className="relative w-full h-full bg-white overflow-hidden cursor-none" // Hide default cursor here
      initial="initial" animate="animate" exit="exit" variants={ANIMATION_VARIANTS} transition={TRANSITION}
    >
      <CustomCursor />
      
      {/* 3D Background - Fixed & Interactive via eventSource */}
      <div className="absolute inset-0 z-0">
          <SceneSetup grid eventSource={containerRef}>
             <MathematicalSculpture scrollProgress={scrollProgress} />
          </SceneSetup>
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent pointer-events-none" />
      </div>

      {/* Scrollable Container - Now Interactive for Scrolling */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="relative z-10 w-full h-full overflow-y-auto no-scrollbar scroll-smooth"
      >
          {/* SECTION 1: HERO */}
          <section className="min-h-screen w-full flex flex-col justify-center px-8 md:px-16 lg:px-24">
            <div className="w-full md:w-1/2">
                <motion.div variants={ANIMATION_VARIANTS} transition={{ delay: 0.1 }}>
                    <div className="inline-block mb-6 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-slate-200">
                        <span className="text-xs font-bold uppercase tracking-widest text-black">The New Standard</span>
                    </div>
                    <h1 className="text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-[0.9] mb-8 text-black font-serif interactive">
                        <span className="block italic">Geometry</span>
                        <span className="block">Smart.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 mb-12 max-w-sm leading-relaxed font-light">
                        Bridging the gap between abstract mathematics and tangible understanding through constructivist AI.
                    </p>
                    <button 
                        onClick={onStart}
                        className="group relative inline-flex items-center gap-4 bg-black text-white pl-8 pr-6 py-5 rounded-2xl font-medium transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-black/20 overflow-hidden cursor-none interactive"
                    >
                        <span className="relative z-10">Start Visualizing</span>
                        <div className="relative z-10 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <ArrowRight className="w-4 h-4" />
                        </div>
                    </button>
                </motion.div>
            </div>
          </section>

          {/* SECTION 2: FEATURES */}
          <section className="min-h-[80vh] w-full flex items-center px-8 md:px-16 lg:px-24">
            <div className="w-full flex justify-end">
                <motion.div 
                    className="w-full md:w-[50%]"
                    {...fadeInUp}
                >
                    <h2 className="text-4xl md:text-5xl font-serif mb-12 text-black interactive">Redefining Education</h2>
                    
                    <div className="grid grid-cols-1 gap-6">
                        {[
                            { icon: BrainCircuit, title: "Socratic Intelligence", desc: "AI that asks the right questions instead of giving answers. Built for deep learning." },
                            { icon: Eye, title: "Real-time Visualization", desc: "Instant 3D reconstruction from sketches and text. See what you're solving." },
                            { icon: Layers, title: "Adaptive Scaffolding", desc: "Personalized hints that adapt to your knowledge level and confusion." }
                        ].map((item, i) => (
                            <div key={i} className="group p-6 bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm hover:shadow-xl hover:bg-white/60 transition-all duration-500 interactive">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-black/5 rounded-xl group-hover:bg-black group-hover:text-white transition-colors">
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-medium mb-2">{item.title}</h3>
                                        <p className="text-slate-500 leading-relaxed text-sm">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
          </section>

          {/* SECTION 3: TECH STACK */}
          <section className="min-h-[80vh] w-full flex flex-col justify-center items-center px-8 md:px-16 lg:px-24 py-24">
             <motion.div className="text-center max-w-2xl mb-16" {...fadeInUp}>
                 <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Under the Hood</span>
                 <h2 className="text-4xl md:text-5xl font-serif text-black mb-6 interactive">Engineered for Clarity</h2>
                 <p className="text-slate-600 text-lg font-light">
                     Powered by client-side RAG technology and physically-based rendering, Geometry Smart delivers a latency-free, immersive experience.
                 </p>
             </motion.div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                 <motion.div 
                    {...fadeInUp}
                    className="p-8 bg-white/40 backdrop-blur-md border border-white/60 rounded-3xl flex flex-col items-center text-center shadow-lg hover:shadow-xl transition-shadow interactive"
                 >
                     <Cpu className="w-12 h-12 text-black mb-6" />
                     <h3 className="text-2xl font-serif mb-3">RAG Context Engine</h3>
                     <p className="text-slate-500 text-sm leading-relaxed">
                         Our retrieval system injects precise mathematical formulas into the LLM context window, ensuring hallucination-free guidance.
                     </p>
                 </motion.div>
                 <motion.div 
                    {...fadeInUp}
                    transition={{ ...fadeInUp.transition, delay: 0.2 }}
                    className="p-8 bg-white/40 backdrop-blur-md border border-white/60 rounded-3xl flex flex-col items-center text-center shadow-lg hover:shadow-xl transition-shadow interactive"
                 >
                     <Box className="w-12 h-12 text-black mb-6" />
                     <h3 className="text-2xl font-serif mb-3">Crystal Rendering</h3>
                     <p className="text-slate-500 text-sm leading-relaxed">
                         WebGL transmission materials simulate refractive index and light attenuation for objects that feel tangible and premium.
                     </p>
                 </motion.div>
             </div>
          </section>

          {/* SECTION 4: USE CASES */}
          <section className="min-h-[60vh] w-full flex flex-col justify-center px-8 md:px-16 lg:px-24 py-24 bg-gradient-to-b from-transparent to-slate-50">
             <div className="w-full flex justify-between items-end mb-12">
                <h2 className="text-4xl md:text-5xl font-serif text-black interactive">Empowering <br/>Every Learner</h2>
                <GraduationCap className="w-16 h-16 text-slate-200" />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { role: "Student", text: "Struggling to visualize cross-sections? Sketch it and rotate it in real-time." },
                    { role: "Teacher", text: "Create interactive problem sets that adapt to each student's pace." },
                    { role: "Researcher", text: "Model complex geometric proofs with semantic AI assistance." }
                ].map((card, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="p-8 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow interactive cursor-none"
                    >
                        <h4 className="text-lg font-bold uppercase tracking-wide mb-3">{card.role}</h4>
                        <p className="text-slate-600 font-light">{card.text}</p>
                    </motion.div>
                ))}
             </div>
          </section>

          {/* SECTION 5: FOOTER */}
          <footer className="w-full bg-black text-white py-24 px-8 md:px-16 lg:px-24">
             <div className="flex flex-col md:flex-row justify-between items-start">
                 <div className="mb-8 md:mb-0">
                     <div className="flex items-center gap-3 mb-4">
                        <LogoIcon className="w-8 h-8" />
                        <span className="font-serif text-2xl font-bold">Geometry Smart</span>
                     </div>
                     <p className="text-slate-400 max-w-xs text-sm leading-relaxed">
                         The future of mathematical visualization. <br/>Based in Stockholm, Sweden.
                     </p>
                 </div>
                 <div className="flex flex-col items-start md:items-end gap-2">
                     <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contact</span>
                     <a href="mailto:cuz.im.yixiang@gmail.com" className="text-lg font-medium hover:text-slate-300 transition-colors interactive cursor-none">cuz.im.yixiang@gmail.com</a>
                     <span className="text-slate-500 text-sm">Based in Shanghai, China</span>
                 </div>
             </div>
             <div className="w-full h-px bg-white/10 my-12" />
             <div className="flex justify-between text-xs text-slate-500 uppercase tracking-widest">
                 <span>© 2024 Geometry Smart Inc.</span>
                 <span>Privacy & Terms</span>
             </div>
          </footer>
      </div>
    </motion.div>
  );
};

const DashboardView: React.FC<{ onSelect: (mode: 'scan' | 'sketch') => void }> = ({ onSelect }) => {
  return (
    <motion.div 
      className="w-full h-full flex flex-col items-center justify-center p-6 bg-white pt-24"
      initial="initial" animate="animate" exit="exit" variants={ANIMATION_VARIANTS} transition={TRANSITION}
    >
      <div className="text-center mb-16">
        <h2 className="text-5xl font-serif text-black tracking-tight mb-4">Input Method</h2>
        <p className="text-slate-500 text-lg font-light">Select how you want to input your geometry problem.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl px-4">
        {/* Card A: Scan */}
        <button 
          onClick={() => onSelect('scan')}
          className="group relative h-[360px] flex flex-col items-start justify-between p-10 bg-[#F8F9FA] rounded-[2rem] border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden"
        >
          {/* Animation Background */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
             
             {/* Geometry Problem Diagram */}
             <div className="absolute inset-0 flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-700">
                <svg viewBox="0 0 200 200" className="w-56 h-56 text-slate-800 opacity-60" fill="none" stroke="currentColor">
                   <rect x="50" y="30" width="100" height="140" rx="4" className="fill-white text-slate-200" strokeWidth="1.5" />
                   <path d="M60 45 H140" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
                   <path d="M60 55 H140" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
                   <path d="M60 65 H110" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/>
                   <g transform="translate(100, 110)">
                        <path d="M0 -30 L-25 10 H25 L0 -30 Z" stroke="#475569" strokeWidth="1.5" fill="none"/>
                        <path d="M0 10 L0 -30" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2" />
                        <circle cx="0" cy="-30" r="1.5" fill="black" />
                        <circle cx="-25" cy="10" r="1.5" fill="black" />
                        <circle cx="25" cy="10" r="1.5" fill="black" />
                        <path d="M28 10 L28 -30" stroke="#CBD5E1" strokeWidth="1" />
                        <text x="32" y="-5" fontSize="8" fill="#64748B" fontFamily="sans-serif">h</text>
                   </g>
                   <text x="60" y="155" fontSize="8" fontWeight="bold" fill="#334155" fontFamily="sans-serif">Find Volume?</text>
                </svg>
             </div>

             {/* Scanning Line */}
             <motion.div 
                className="absolute top-0 left-0 w-full h-[2px] bg-black/20 shadow-[0_0_20px_rgba(0,0,0,0.1)] z-10"
                initial={{ y: 0 }}
                animate={{ y: [0, 360, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
             />
          </div>

          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500 border border-slate-100 z-10">
            <ScanLine className="w-7 h-7 text-black" />
          </div>
          <div className="text-left z-10">
             <h3 className="text-3xl font-serif text-black mb-2">Scan Problem</h3>
             <p className="text-slate-500 text-sm leading-relaxed max-w-[80%]">Capture diagrams from textbooks or paper directly with your camera.</p>
          </div>
          <div className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0 z-10">
              <ArrowRight className="w-6 h-6 text-black" />
          </div>
        </button>

        {/* Card B: Sketch */}
        <button 
          onClick={() => onSelect('sketch')}
          className="group relative h-[360px] flex flex-col items-start justify-between p-10 bg-[#F8F9FA] rounded-[2rem] border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden"
        >
           <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none flex items-center justify-center">
             <motion.div 
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
             >
                <PenTool className="w-32 h-32 text-black/5" />
             </motion.div>
          </div>

          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500 border border-slate-100 z-10">
            <PenTool className="w-7 h-7 text-black" />
          </div>
           <div className="text-left z-10">
             <h3 className="text-3xl font-serif text-black mb-2">Smart Sketchpad</h3>
             <p className="text-slate-500 text-sm leading-relaxed max-w-[80%]">Draw rough geometric shapes and let our AI reconstruct them instantly.</p>
          </div>
          <div className="absolute top-10 right-10 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0 z-10">
              <ArrowRight className="w-6 h-6 text-black" />
          </div>
        </button>
      </div>
    </motion.div>
  );
};

const ScanView: React.FC<{ onBack: () => void, onAnalyze: (context: ProblemContext) => void }> = ({ onBack, onAnalyze }) => {
  const [dragActive, setDragActive] = useState(false);
  const [problemText, setProblemText] = useState("");

  const examples: ProblemContext[] = [
    { type: 'pyramid', text: "Calculate the total surface area of a square-based pyramid with base length 10cm and slant height 14cm." },
    { type: 'cube', text: "A cube has a volume of 512 cm³. Find the length of its main space diagonal." },
    { type: 'frustum', text: "A bucket is in the shape of a frustum with top radius 15cm, bottom radius 10cm, and height 20cm. Find its capacity." },
    { type: 'default', text: "A sphere is inscribed perfectly inside a cylinder with height 10 units. What is the ratio of their volumes?" },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Provide detailed context so the AI knows to ask for inputs
      setProblemText("User uploaded an image file containing a geometry problem. The AI should act as if it can see the problem but needs the user to transcribe specific numbers.");
    }
  };

  const handleAnalyze = () => {
    if (!problemText.trim()) return;
    onAnalyze({ type: 'default', text: problemText });
  };

  return (
    <motion.div 
      className="w-full h-full flex flex-col items-center justify-start p-6 bg-white pt-24 overflow-y-auto"
      initial="initial" animate="animate" exit="exit" variants={ANIMATION_VARIANTS} transition={TRANSITION}
    >
        <div className="w-full max-w-5xl flex items-center justify-between mb-8">
             <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
        </div>

        <div className="text-center mb-12">
            <h2 className="text-4xl font-serif text-black tracking-tight mb-3">Upload Problem</h2>
            <p className="text-slate-500 text-lg font-light">Upload an image or paste your problem text below.</p>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Input Area */}
            <div className="space-y-6">
                <div 
                    className={`relative h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors cursor-pointer
                    ${dragActive ? 'border-black bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    onClick={() => setProblemText(prev => prev || "User uploaded an image file containing a geometry problem. The AI should act as if it can see the problem but needs the user to transcribe specific numbers.")}
                >
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-slate-700 font-medium">Drag & drop or click to upload</p>
                    <p className="text-slate-400 text-sm mt-1">Supports JPG, PNG, PDF</p>
                </div>

                <div className="relative">
                    <div className="absolute top-4 left-4 text-slate-400 pointer-events-none">
                        <FileText className="w-5 h-5" />
                    </div>
                    <textarea 
                        className="w-full h-40 p-4 pl-12 bg-[#F8F9FA] border border-slate-200 rounded-2xl focus:bg-white focus:border-slate-400 focus:ring-0 outline-none resize-none text-slate-800 placeholder:text-slate-400 transition-colors"
                        placeholder="Or paste your problem text here..."
                        value={problemText}
                        onChange={(e) => setProblemText(e.target.value)}
                    />
                </div>

                <button 
                    onClick={handleAnalyze}
                    disabled={!problemText}
                    className="w-full py-4 bg-black text-white rounded-xl font-medium shadow-lg shadow-black/10 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Sparkles className="w-5 h-5" />
                    <span>Analyze Problem</span>
                </button>
            </div>

            {/* Right: Examples */}
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-4 text-slate-400 uppercase tracking-widest text-xs font-bold">
                    <span>Try an Example</span>
                    <div className="h-px bg-slate-200 flex-1" />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {examples.map((ex, i) => (
                        <button 
                            key={i}
                            onClick={() => onAnalyze(ex)}
                            className="text-left p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider
                                    ${ex.type === 'cube' ? 'bg-blue-50 text-blue-600' : 
                                      ex.type === 'pyramid' ? 'bg-orange-50 text-orange-600' :
                                      ex.type === 'frustum' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {ex.type === 'default' ? 'COMPLEX' : ex.type}
                                </span>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-black transition-colors" />
                            </div>
                            <p className="text-slate-700 text-sm font-medium leading-relaxed line-clamp-2">{ex.text}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </motion.div>
  );
}

// --- Shape Templates ---
const TEMPLATES = {
    CUBE: "M 150 100 L 236 150 L 236 250 L 150 300 L 64 250 L 64 150 L 150 100 Z M 150 100 L 150 200 M 150 200 L 64 250 M 150 200 L 236 250",
    PYRAMID: "M 150 60 L 70 200 L 150 250 L 230 200 Z M 150 60 L 150 250", // Improved pyramid perspective
    FRUSTUM: "M 100 100 L 200 100 L 220 250 L 80 250 Z M 100 100 Q 150 80 200 100 M 100 100 Q 150 120 200 100 M 80 250 Q 150 270 220 250"
};

const getSmoothedPath = (points: number[][]) => {
  if (points.length === 0) return '';
  if (points.length < 3) {
    return `M ${points.map(p => p.join(' ')).join(' L ')}`;
  }
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const next = points[i + 1];
    const midX = (cp[0] + next[0]) / 2;
    const midY = (cp[1] + next[1]) / 2;
    d += ` Q ${cp[0].toFixed(2)} ${cp[1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0].toFixed(2)} ${last[1].toFixed(2)}`;
  return d;
};

const ShapeRecognitionModal: React.FC<{ 
  onConfirm: (type: GeometryType) => void, 
  onCancel: () => void 
}> = ({ onConfirm, onCancel }) => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-sm">
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-[90%] max-w-md"
        >
            <div className="flex items-center gap-3 mb-4 text-black">
                <HelpCircle className="w-6 h-6" />
                <h3 className="text-xl font-serif font-bold">Confirm Geometry</h3>
            </div>
            <p className="text-slate-500 mb-6 text-sm">
                Our AI detected a freehand sketch. To ensure the best 3D visualization, please confirm what shape you intended to draw.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                    { label: "Cube / Box", type: 'cube' as const, icon: Box },
                    { label: "Pyramid", type: 'pyramid' as const, icon: Triangle },
                    { label: "Frustum / Cone", type: 'frustum' as const, icon: Circle },
                    { label: "Other / Complex", type: 'default' as const, icon: Sparkles }
                ].map((item) => (
                    <button 
                        key={item.type}
                        onClick={() => onConfirm(item.type)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-black hover:bg-slate-50 transition-all group"
                    >
                        <item.icon className="w-6 h-6 mb-2 text-slate-400 group-hover:text-black" />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-black">{item.label}</span>
                    </button>
                ))}
            </div>
            <button onClick={onCancel} className="w-full py-3 text-slate-400 hover:text-slate-600 text-sm font-medium">
                Cancel
            </button>
        </motion.div>
    </div>
);

const SketchpadView: React.FC<{ onComplete: (context: ProblemContext) => void, onBack: () => void }> = ({ onComplete, onBack }) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false); // Modal State
  const [selectedTemplate, setSelectedTemplate] = useState<GeometryType>('default');
  const svgRef = useRef<SVGSVGElement>(null);

  const getCoordinates = (e: React.PointerEvent) => {
    if (!svgRef.current) return [0, 0];
    const rect = svgRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSolving) return;
    const [x, y] = getCoordinates(e);
    setCurrentPoints([[x, y]]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1 || isSolving) return;
    const [x, y] = getCoordinates(e);
    setCurrentPoints(prev => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = Math.hypot(last[0] - x, last[1] - y);
        if (dist < 4) return prev; 
      }
      return [...prev, [x, y]];
    });
  };

  const handlePointerUp = () => {
    if (currentPoints.length > 1) {
      const d = getSmoothedPath(currentPoints);
      setPaths(prev => [...prev, d]);
    }
    setCurrentPoints([]);
  };

  const addTemplate = (d: string, type: GeometryType) => {
      setPaths(prev => [...prev, d]);
      setSelectedTemplate(type);
  };

  const clearCanvas = () => {
      setPaths([]);
      setSelectedTemplate('default');
  }
  const undoLast = () => setPaths(prev => prev.slice(0, -1));

  const handleMagic = () => {
    if (paths.length === 0) return;
    
    // If freehand, show confirmation modal
    if (selectedTemplate === 'default') {
        setShowRecognition(true);
        return;
    }

    // If template used, proceed directly
    setIsSolving(true);
    setTimeout(() => {
      onComplete({ type: selectedTemplate, text: `User sketched a ${selectedTemplate} and wants to analyze it.` });
    }, 1500);
  };

  const handleRecognitionConfirm = (type: GeometryType) => {
      setShowRecognition(false);
      setIsSolving(true);
      setTimeout(() => {
        onComplete({ 
            type: type, 
            text: type === 'default' 
                ? "User sketched a complex geometric shape. Ask them to describe its faces and vertices." 
                : `User sketched a ${type}.` 
        });
      }, 1500);
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-white flex flex-col z-[55]" 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.98 }}
    >
      {showRecognition && (
          <ShapeRecognitionModal 
            onConfirm={handleRecognitionConfirm} 
            onCancel={() => setShowRecognition(false)} 
          />
      )}

      <div className="h-20 px-8 flex items-center justify-between border-b border-slate-100 bg-white">
        <div className="flex items-center gap-6">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 text-black">
                    <LogoIcon />
                </div>
                <span className="font-serif font-bold tracking-tight text-black text-2xl">Sketchpad</span>
            </div>
            
            <div className="h-6 w-px bg-slate-200 mx-2" />

            <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-black font-medium text-sm">
                    <PenTool className="w-4 h-4" />
                    <span>Draw</span>
                </button>
                <button onClick={undoLast} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors" title="Undo">
                    <Undo2 className="w-5 h-5" />
                </button>
                <button onClick={clearCanvas} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Clear All">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

             <div className="h-6 w-px bg-slate-200 mx-2" />

             <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">Templates</span>
                <button onClick={() => addTemplate(TEMPLATES.CUBE, 'cube')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 border border-slate-200 hover:border-slate-300 transition-all" title="Cube">
                    <Box className="w-5 h-5" />
                </button>
                <button onClick={() => addTemplate(TEMPLATES.PYRAMID, 'pyramid')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 border border-slate-200 hover:border-slate-300 transition-all" title="Pyramid">
                    <Triangle className="w-5 h-5" />
                </button>
                 <button onClick={() => addTemplate(TEMPLATES.FRUSTUM, 'frustum')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 border border-slate-200 hover:border-slate-300 transition-all" title="Frustum">
                    <Circle className="w-5 h-5" />
                </button>
             </div>
        </div>

        <button 
            onClick={handleMagic}
            disabled={paths.length === 0 || isSolving}
            className="flex items-center gap-2 bg-black text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-black/10 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isSolving ? (
                <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Solving...</span>
                </>
            ) : (
                <>
                <Wand2 className="w-4 h-4" />
                <span>Solve Geometry</span>
                </>
            )}
        </button>
      </div>

      <div className="flex-1 relative bg-[#FDFDFD] cursor-crosshair overflow-hidden touch-none">
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
        />

        <svg 
            ref={svgRef}
            className="w-full h-full"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {paths.map((d, i) => (
                <path 
                    key={i} 
                    d={d} 
                    stroke="#1a1a1a" 
                    strokeWidth="3" 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
            ))}
            {currentPoints.length > 1 && (
                <path 
                    d={getSmoothedPath(currentPoints)} 
                    stroke="#000000" 
                    strokeWidth="3" 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="opacity-70" 
                />
            )}
        </svg>

        <AnimatePresence>
            {paths.length === 0 && currentPoints.length === 0 && (
            <motion.div 
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <MousePointer2 className="w-6 h-6 animate-bounce" />
                </div>
                <p className="text-slate-400 font-medium text-lg">Draw freely or select a template</p>
            </motion.div>
            )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const WorkspaceView: React.FC<{ context: ProblemContext }> = ({ context }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false); // RAG State
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    const initChat = async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `
            You are Geo, a Socratic Geometry Tutor in the "Geometry Smart" app.
            
            Current Task: Help the user solve a problem regarding a ${context.type}.
            User's Input/Problem: "${context.text}"
            
            Pedagogical Strategy (Constructivist Learning):
            1. **Active Inquiry**: Do NOT just solve the problem. Ask the user what they think the first step is.
            2. **Visual Anchoring**: Encourage the user to look at the 3D model. Ask specific questions like "What defines the height in this shape?" or "Where is the hypotenuse?".
            3. **Scaffolding**: If the user is stuck, provide a hint, not the solution. Break complex problems into smaller, manageable steps.
            4. **Verification**: When the user provides a number or step, verify it positively. If wrong, ask them to check their math or reasoning gently.
            
            Knowledge Injection:
            You may receive specific formulas or property definitions in brackets like [Context: ...]. Use this information to be mathematically precise, but don't just vomit the formula unless asked. Integrate it into your teaching.
            
            Rules:
            - Keep responses concise (2-3 sentences max) to maintain a conversational flow.
            - Be encouraging, professional, and precise.
            - If the input suggests an image was uploaded but no text, explicitly ask the user to provide the measurements visible in the image.
        `;

        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
        });
        
        chatSessionRef.current = chat;
        
        let initialMsg = `I've analyzed the ${context.type === 'default' ? 'geometry' : context.type}.`;
        
        // Context-aware initialization
        if (context.text && context.text.includes("User uploaded an image")) {
             initialMsg += " Since I can't read the specific numbers from the image perfectly yet, could you tell me what values are given?";
        } else if (context.type === 'default') {
             initialMsg += " It looks complex. Can you describe the faces or vertices to help me understand it better?";
        } else if (context.text && context.text.length > 10) {
             initialMsg += " It looks like an interesting problem. What is the first variable we need to identify?";
        } else {
             initialMsg += " I'm ready to help you solve it. Where should we start?";
        }

        setMessages([{ role: 'ai', text: initialMsg }]);
    };
    initChat();
  }, [context]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatSessionRef.current) return;
    const userMsg = inputText;
    setInputText("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    // Simulate RAG Retrieval
    setIsRetrieving(true);
    
    // 1. Retrieve Context from Knowledge Base
    const contextData = retrieveContext(userMsg, context.type);
    
    // Simulate network delay for retrieval agent
    setTimeout(async () => {
        setIsRetrieving(false);
        setIsTyping(true);

        try {
            // 2. Inject Context into Prompt
            const promptWithContext = `[Context: ${contextData}] User Question: ${userMsg}`;
            
            // 3. Send to Gemini
            const result = await chatSessionRef.current.sendMessageStream({ message: promptWithContext });
            
            setMessages(prev => [...prev, { role: 'ai', text: "" }]);
            let fullText = "";
            for await (const chunk of result) {
                const text = chunk.text;
                if (text) {
                    fullText += text;
                    setMessages(prev => {
                        const newArr = [...prev];
                        newArr[newArr.length - 1] = { role: 'ai', text: fullText };
                        return newArr;
                    });
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'ai', text: "Connection error. Please try again." }]);
        } finally {
            setIsTyping(false);
        }
    }, 600); // 600ms artificial delay for "Thinking/Retrieving" effect
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSendMessage();
  }

  return (
    <motion.div 
      className="w-full h-full flex flex-col md:flex-row bg-[#F5F5F7] pt-20"
      initial="initial" animate="animate" exit="exit" variants={ANIMATION_VARIANTS} transition={TRANSITION}
    >
      <div className="w-full md:w-[35%] h-[40vh] md:h-full bg-white flex flex-col border-r border-slate-200 shadow-xl z-20">
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-xl">
            <h3 className="font-serif font-bold text-black text-2xl">Analysis Result</h3>
            <p className="text-sm text-slate-500 mt-1 capitalize">Detected: {context.type === 'default' ? 'Complex Shape' : context.type}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Problem Card */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Problem</span>
              <p className="text-sm text-slate-700 mt-1 font-medium leading-relaxed">{context.text}</p>
          </div>

          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                {msg.role === 'ai' && (
                     <div className="w-8 h-8 rounded-full bg-black flex-shrink-0 flex items-center justify-center text-white mr-3 mt-1">
                        <LogoIcon className="w-4 h-4" />
                     </div>
                )}
              <div className={`
                max-w-[85%] p-5 rounded-2xl text-[15px] leading-relaxed shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-black text-white rounded-br-none' 
                  : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-bl-none'}
              `}>
                {msg.text}
              </div>
            </motion.div>
          ))}
          
          {isRetrieving && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex justify-start items-center gap-2 pl-12"
              >
                  <BrainCircuit className="w-3 h-3 text-blue-500 animate-pulse" />
                  <span className="text-xs text-blue-500 font-medium">Retrieving formulas...</span>
              </motion.div>
          )}

          {isTyping && (
             <div className="flex justify-start">
                 <div className="w-8 h-8 rounded-full bg-black flex-shrink-0 flex items-center justify-center text-white mr-3 mt-1">
                    <LogoIcon className="w-4 h-4" />
                 </div>
                 <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-none p-4">
                     <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                 </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <div className="relative flex items-center bg-[#F8F9FA] border border-slate-200 rounded-2xl px-2 py-2 transition-colors focus-within:border-slate-400 focus-within:bg-white">
            <button className="p-3 text-slate-400 hover:text-slate-600 transition-colors">
              <Mic className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a follow-up question..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-base text-slate-900 placeholder:text-slate-400 px-2 outline-none h-10"
            />
            <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isTyping || isRetrieving}
                className="p-3 bg-black text-white rounded-xl hover:scale-105 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 h-[60vh] md:h-full relative bg-[#F5F5F7] overflow-hidden">
        <div className="absolute top-6 right-6 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm text-xs font-bold text-slate-500 border border-white tracking-wide uppercase">
          Interactive View
        </div>
        <SceneSetup>
          <WorkspaceGeometry key={context.type} type={context.type} />
        </SceneSetup>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [loading, setLoading] = useState(false);
  const [problemContext, setProblemContext] = useState<ProblemContext>({ type: 'default', text: '' });

  const navigateTo = (target: ViewState) => {
    setView(target);
  };

  const handleDashboardSelect = (mode: 'scan' | 'sketch') => {
    if (mode === 'scan') {
      navigateTo('scan');
    } else {
      navigateTo('sketchpad');
    }
  };

  const handleAnalyze = (context: ProblemContext) => {
      setLoading(true);
      setTimeout(() => {
          setLoading(false);
          setProblemContext(context);
          navigateTo('workspace');
      }, 1500);
  }

  return (
    <div className="w-full h-screen bg-white overflow-hidden text-slate-900 font-sans selection:bg-slate-200">
      <AnimatePresence>
        {loading && (
          <motion.div 
            className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
            <h3 className="text-xl font-serif font-bold text-black">Processing Geometry</h3>
          </motion.div>
        )}
      </AnimatePresence>

      {view !== 'sketchpad' && (
        <motion.div 
          className="fixed top-0 left-0 w-full px-8 py-6 z-50 pointer-events-none flex justify-between items-center"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
           <div className="flex items-center gap-3 pointer-events-auto cursor-pointer group" onClick={() => setView('landing')}>
             <div className="w-10 h-10 text-black transition-transform group-hover:rotate-90 duration-500">
               <LogoIcon />
             </div>
             <span className="font-serif font-bold tracking-tight text-black text-2xl hidden sm:block">Geometry Smart</span>
           </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingView key="landing" onStart={() => navigateTo('dashboard')} />
        )}
        {view === 'dashboard' && (
          <DashboardView key="dashboard" onSelect={handleDashboardSelect} />
        )}
        {view === 'scan' && (
            <ScanView key="scan" onBack={() => navigateTo('dashboard')} onAnalyze={handleAnalyze} />
        )}
        {view === 'sketchpad' && (
          <SketchpadView key="sketchpad" onBack={() => navigateTo('dashboard')} onComplete={handleAnalyze} />
        )}
        {view === 'workspace' && (
          <WorkspaceView key="workspace" context={problemContext} />
        )}
      </AnimatePresence>
    </div>
  );
}