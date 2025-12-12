
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Wand2, MonitorPlay, X, Target, Move, Trash2, Scissors, ScanFace, Sliders, Palette, Eye, Shirt, Sparkles, BoxSelect, CheckCircle2, Layers, FlipHorizontal, FlipVertical, RotateCw, ZoomIn, GripHorizontal, MousePointer2, Loader2, Download, ArrowRight, Brush, Undo2, ChevronUp, Hand } from 'lucide-react';

// --- TYPES ---
type BodyPartType = 'FRENTE' | 'COSTAS' | 'MANGA' | 'SAIA' | 'GOLA' | 'OUTROS';

interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement;
  maskCenter: { x: number, y: number }; 
  patternImg: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  skewX: number;
  skewY: number;
  bodyPart: BodyPartType; 
}

const VIRTUAL_MODEL = {
    skinPath: "M180,60 Q200,50 220,60 L230,150 L240,400 L230,580 L170,580 L160,400 L170,150 Z", 
    parts: {
        FRENTE: { path: "M175,120 Q200,150 225,120 Q235,140 230,220 Q200,230 170,220 Q165,140 175,120", zIndex: 2, shadowMap: "linear-gradient(90deg, rgba(0,0,0,0.2) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)" },
        COSTAS: { path: "M175,120 Q200,130 225,120 L230,220 Q200,210 170,220 Z", zIndex: 0, shadowMap: "linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 50%, rgba(0,0,0,0.3) 100%)" },
        SAIA: { path: "M170,220 Q200,230 230,220 L245,500 Q200,520 155,500 Z", zIndex: 1, shadowMap: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.1) 45px, transparent 50px)" },
        MANGA: { pathLeft: "M175,120 Q150,110 140,160 Q150,190 170,180", pathRight: "M225,120 Q250,110 260,160 Q250,190 230,180", zIndex: 3, shadowMap: "radial-gradient(circle at 50% 0%, transparent, rgba(0,0,0,0.3))" },
        GOLA: { path: "M175,120 Q200,150 225,120 Q200,130 175,120 Z", zIndex: 4, shadowMap: "" }
    }
};

const floodFill = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tol: number) => {
    const imageData = ctx.getImageData(0,0,width,height);
    const data = imageData.data;
    const maskData = new Uint8ClampedArray(width * height * 4);
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const a0 = data[startPos+3];
    
    if (a0 === 0) return null; 
    const r0 = data[startPos]; const g0 = data[startPos + 1]; const b0 = data[startPos + 2];

    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(width * height);
    let pixelCount = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;

    while (stack.length) {
        const [x, y] = stack.pop()!;
        const pos = y * width + x;
        const pPos = pos * 4;
        if (visited[pos]) continue;
        visited[pos] = 1;

        const r = data[pPos]; const g = data[pPos+1]; const b = data[pPos+2];
        const diff = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);

        if (diff <= tol) {
            maskData[pPos] = 255; maskData[pPos+1] = 255; maskData[pPos+2] = 255; maskData[pPos+3] = 255;
            pixelCount++;
            if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (x > 0) stack.push([x - 1, y]); if (x < width - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]); if (y < height - 1) stack.push([x, y + 1]);
        }
    }

    if (pixelCount < 50) return null;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width; maskCanvas.height = height;
    maskCanvas.getContext('2d')!.putImageData(new ImageData(maskData, width, height), 0, 0);
    return { maskCanvas, centerX: (minX+maxX)/2, centerY: (minY+maxY)/2 };
};

// --- MATH HELPERS FOR GESTURES ---
const getDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
};

const getAngle = (t1: React.Touch, t2: React.Touch) => {
    return (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;
};

interface MockupStudioProps {
  externalPattern?: string | null;
}

export const MockupStudio: React.FC<MockupStudioProps> = ({ externalPattern }) => {
  // --- STATE ---
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 }); 

  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [visualizerPos, setVisualizerPos] = useState({ x: 50, y: 50 });
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs for logic
  const isDraggingModal = useRef(false);
  const isDraggingLayer = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Refs for Multi-touch Gestures
  const gestureStartScale = useRef<number>(1);
  const gestureStartRotation = useRef<number>(0);
  const gestureStartDist = useRef<number>(0);
  const gestureStartAngle = useRef<number>(0);
  const isGestureActive = useRef<boolean>(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- INIT ---
  useEffect(() => {
    if (moldImage) {
      const img = new Image(); img.src = moldImage;
      img.onload = () => { 
          setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight });
          setMoldImgObj(img); 
          setLayers([]); 
      };
    }
  }, [moldImage]);

  useEffect(() => {
    const src = externalPattern || patternImage;
    if (src) {
        const img = new Image(); 
        img.src = src; 
        img.onload = () => {
             setPatternImgObj(img);
             if(externalPattern) setPatternImage(externalPattern);
        };
    }
  }, [patternImage, externalPattern]);

  // Global Mouse Up
  useEffect(() => {
    const handleGlobalUp = () => {
        isDraggingLayer.current = false;
        isDraggingModal.current = false;
        isGestureActive.current = false;
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchend', handleGlobalUp);
    };
  }, []);


  // --- MOUSE/TOUCH HANDLERS (UNIFIED) ---

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      // 1. Setup Coordinates
      if (!moldImgObj || !patternImgObj) return;
      
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const isTouch = 'touches' in e;
      
      // Multitouch Logic (2 fingers)
      if (isTouch && (e as React.TouchEvent).touches.length === 2 && activeLayerId) {
          e.preventDefault(); // Prevent browser zoom
          const t1 = (e as React.TouchEvent).touches[0];
          const t2 = (e as React.TouchEvent).touches[1];
          const activeLayer = layers.find(l => l.id === activeLayerId);
          if (activeLayer) {
              isGestureActive.current = true;
              gestureStartDist.current = getDistance(t1, t2);
              gestureStartAngle.current = getAngle(t1, t2);
              gestureStartScale.current = activeLayer.scale;
              gestureStartRotation.current = activeLayer.rotation;
          }
          return;
      }

      // Single Touch/Click Logic
      let clientX, clientY;
      if (isTouch) { 
          clientX = (e as React.TouchEvent).touches[0].clientX; 
          clientY = (e as React.TouchEvent).touches[0].clientY; 
      } else { 
          clientX = (e as React.MouseEvent).clientX; 
          clientY = (e as React.MouseEvent).clientY; 
      }

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      if (tool === 'WAND') {
           const ctx = canvas.getContext('2d')!;
           const res = floodFill(ctx, canvas.width, canvas.height, x, y, 40);
           
           if (res) {
               const newLayer: AppliedLayer = {
                   id: Date.now().toString(),
                   maskCanvas: res.maskCanvas,
                   maskCenter: { x: res.centerX, y: res.centerY },
                   patternImg: patternImgObj,
                   offsetX: res.centerX - (patternImgObj.width * 0.5)/2,
                   offsetY: res.centerY - (patternImgObj.height * 0.5)/2,
                   scale: 0.5, rotation: 0, 
                   flipX: false, flipY: false, skewX: 0, skewY: 0,
                   bodyPart: 'OUTROS'
               };
               setLayers(prev => [...prev, newLayer]);
               setActiveLayerId(newLayer.id);
               setTool('MOVE');
           }
      } else if (tool === 'MOVE') {
          // Hit Detection
          let clickedId = null;
          for (let i = layers.length - 1; i >= 0; i--) {
              const ctx = layers[i].maskCanvas.getContext('2d')!;
              if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { 
                  clickedId = layers[i].id;
                  break; 
              }
          }
          
          if (clickedId) {
              setActiveLayerId(clickedId);
              isDraggingLayer.current = true;
              lastMousePos.current = { x: clientX, y: clientY };
          }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (e.cancelable) e.preventDefault(); // Critical for mobile
      
      const isTouch = 'touches' in e;

      // --- MULTITOUCH GESTURES (SCALE & ROTATE) ---
      if (isTouch && (e as React.TouchEvent).touches.length === 2 && isGestureActive.current && activeLayerId) {
          const t1 = (e as React.TouchEvent).touches[0];
          const t2 = (e as React.TouchEvent).touches[1];
          
          const newDist = getDistance(t1, t2);
          const newAngle = getAngle(t1, t2);

          const scaleFactor = newDist / gestureStartDist.current;
          const newScale = Math.max(0.1, Math.min(5, gestureStartScale.current * scaleFactor));
          
          const rotationDelta = newAngle - gestureStartAngle.current;
          const newRotation = gestureStartRotation.current + rotationDelta;

          updateActiveLayer({ scale: newScale, rotation: newRotation });
          return;
      }

      // --- SINGLE TOUCH DRAG ---
      if (!isDraggingLayer.current || !activeLayerId || tool !== 'MOVE') return;

      let clientX, clientY;
      if (isTouch) { 
          clientX = (e as React.TouchEvent).touches[0].clientX; 
          clientY = (e as React.TouchEvent).touches[0].clientY; 
      } else { 
          clientX = (e as React.MouseEvent).clientX; 
          clientY = (e as React.MouseEvent).clientY; 
      }

      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const dx = (clientX - lastMousePos.current.x) * scaleX;
      const dy = (clientY - lastMousePos.current.y) * scaleY;

      updateActiveLayer({ 
          offsetX: layers.find(l => l.id === activeLayerId)!.offsetX + dx,
          offsetY: layers.find(l => l.id === activeLayerId)!.offsetY + dy
      });

      lastMousePos.current = { x: clientX, y: clientY };
  };

  const updateActiveLayer = (updates: Partial<AppliedLayer>) => {
      if (!activeLayerId) return;
      setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, ...updates } : l));
  };

  const deleteActiveLayer = () => {
    setLayers(prev => prev.filter(l => l.id !== activeLayerId));
    setActiveLayerId(null);
  };


  // --- RENDER MAIN CANVAS ---
  const renderMain = useCallback(() => {
      const canvas = mainCanvasRef.current;
      if (!canvas || !moldImgObj || canvasDims.w === 0) return;
      const ctx = canvas.getContext('2d')!;

      // 1. Background
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0,0,canvas.width,canvas.height);
      
      // 2. Mold
      ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

      // 3. Layers
      layers.forEach(layer => {
          const tC = document.createElement('canvas'); tC.width = canvas.width; tC.height = canvas.height;
          const tCtx = tC.getContext('2d')!;
          
          tCtx.drawImage(layer.maskCanvas, 0, 0);
          tCtx.globalCompositeOperation = 'source-in';
          
          tCtx.save();
          tCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
          tCtx.rotate((layer.rotation * Math.PI)/180);
          tCtx.scale(layer.flipX?-1:1, layer.flipY?-1:1);
          tCtx.translate(-layer.maskCenter.x, -layer.maskCenter.y);
          tCtx.translate(layer.offsetX, layer.offsetY);
          tCtx.scale(layer.scale, layer.scale);
          
          const pat = tCtx.createPattern(layer.patternImg, 'repeat');
          if(pat) { tCtx.fillStyle = pat; tCtx.fillRect(-10000,-10000,20000,20000); }
          tCtx.restore();

          ctx.drawImage(tC, 0, 0);

          // Selection Outline
          if (layer.id === activeLayerId) {
              ctx.save();
              ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; 
              ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 10;
              ctx.setLineDash([8,8]);
              ctx.beginPath();
              // Create a circular handle around the geometric center of the mask
              ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 40, 0, 2 * Math.PI);
              ctx.stroke();
              
              // Helper Crosshair
              ctx.lineWidth = 1; ctx.setLineDash([]);
              ctx.moveTo(layer.maskCenter.x - 10, layer.maskCenter.y);
              ctx.lineTo(layer.maskCenter.x + 10, layer.maskCenter.y);
              ctx.moveTo(layer.maskCenter.x, layer.maskCenter.y - 10);
              ctx.lineTo(layer.maskCenter.x, layer.maskCenter.y + 10);
              ctx.stroke();
              
              ctx.restore();
          }
      });
  }, [moldImgObj, layers, activeLayerId, canvasDims]);

  useEffect(() => { requestAnimationFrame(renderMain); }, [renderMain]);


  // --- RENDER VISUALIZER ---
  const renderVisualizer = useCallback(() => {
      const canvas = visualizerCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      
      if (canvas.width !== 400) { canvas.width = 400; canvas.height = 600; }
      ctx.clearRect(0,0,400,600);
      
      ctx.fillStyle = '#eecfb4'; 
      ctx.fill(new Path2D(VIRTUAL_MODEL.skinPath));
      
      const renderPart = (pathStr: string, type: BodyPartType, shadowStyle: string) => {
          const sourceLayer = layers.find(l => l.bodyPart === type);
          const path = new Path2D(pathStr);

          ctx.save();
          if (sourceLayer && sourceLayer.patternImg) {
              const scale = sourceLayer.scale * 0.8; 
              
              const pC = document.createElement('canvas'); pC.width=400; pC.height=600;
              const pCtx = pC.getContext('2d')!;
              pCtx.translate(200, 300); 
              pCtx.rotate((sourceLayer.rotation * Math.PI)/180);
              pCtx.scale(scale, scale);
              const pat = pCtx.createPattern(sourceLayer.patternImg, 'repeat');
              if(pat) { pCtx.fillStyle = pat; pCtx.fillRect(-1000,-1000,2000,2000); }
              
              ctx.clip(path);
              ctx.drawImage(pC, 0, 0);
          } else {
              ctx.fillStyle = '#f8fafc'; 
              ctx.fill(path);
          }
          
          ctx.globalCompositeOperation = 'multiply';
          const grad = ctx.createLinearGradient(0,0,400,0);
          grad.addColorStop(0, 'rgba(0,0,0,0.1)');
          grad.addColorStop(0.2, 'transparent');
          grad.addColorStop(0.8, 'transparent');
          grad.addColorStop(1, 'rgba(0,0,0,0.15)');
          ctx.fillStyle = grad;
          ctx.fill(path);
          
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
          ctx.stroke(path);
          ctx.restore();
      };

      renderPart(VIRTUAL_MODEL.parts.SAIA.path, 'SAIA', VIRTUAL_MODEL.parts.SAIA.shadowMap);
      renderPart(VIRTUAL_MODEL.parts.FRENTE.path, 'FRENTE', VIRTUAL_MODEL.parts.FRENTE.shadowMap);
      renderPart(VIRTUAL_MODEL.parts.MANGA.pathLeft, 'MANGA', '');
      renderPart(VIRTUAL_MODEL.parts.MANGA.pathRight, 'MANGA', '');
      renderPart(VIRTUAL_MODEL.parts.GOLA.path, 'GOLA', '');

  }, [layers]);

  useEffect(() => { if(showVisualizer) requestAnimationFrame(renderVisualizer); }, [renderVisualizer, showVisualizer]);


  const activeLayer = layers.find(l => l.id === activeLayerId);

  return (
    <div className="flex flex-col h-full bg-[#e2e8f0] md:flex-row overflow-hidden font-sans relative"
         onMouseMove={(e) => { 
             handlePointerMove(e);
             if(isDraggingModal.current) setVisualizerPos(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
         }}>
      
      {/* --- SIDEBAR / BOTTOM SHEET --- */}
      <div className={`
        bg-white border-r border-gray-200 flex flex-col shadow-2xl z-30 transition-all duration-300
        md:w-80 md:h-full md:relative md:translate-y-0
        fixed bottom-0 left-0 w-full rounded-t-2xl md:rounded-none
        ${activeLayer && isMobile ? 'h-[55vh]' : isMobile ? 'h-auto pb-6' : ''}
      `}>
          
          {/* Mobile Handle */}
          <div className="md:hidden w-full flex justify-center pt-2 pb-1" onClick={() => setActiveLayerId(null)}>
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50 hidden md:block">
              <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={20} /> Vingi Studio <span className="text-[10px] bg-black text-white px-1.5 rounded">PRO</span>
              </h2>
          </div>
          
          <div className="p-4 md:p-5 space-y-4 md:space-y-6 overflow-y-auto max-h-full">
               
               {/* UPLOAD BUTTONS */}
               {!activeLayer && (
                   <div className="flex gap-2 md:flex-col">
                       <div onClick={() => moldInputRef.current?.click()} className="flex-1 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-center relative group flex items-center justify-center gap-2">
                          <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                          <Scissors size={16} className="text-gray-400"/>
                          <span className="text-[10px] md:text-xs font-bold text-gray-500">{moldImage ? "TROCAR MOLDE" : "MOLDE"}</span>
                       </div>

                       <div onClick={() => patternInputRef.current?.click()} className="flex-1 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-center relative group flex items-center justify-center gap-2">
                          <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                          <Palette size={16} className="text-gray-400"/>
                          <span className="text-[10px] md:text-xs font-bold text-gray-500">{patternImage ? "TROCAR ESTAMPA" : "ESTAMPA"}</span>
                       </div>
                   </div>
               )}

               {/* LAYER CONTROLS */}
               {activeLayer ? (
                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm animate-fade-in-up">
                       <div className="flex justify-between items-center mb-2">
                           <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> Camada Ativa</h3>
                           <button onClick={() => setActiveLayerId(null)} className="md:hidden text-blue-500"><ChevronUp className="rotate-180" size={16}/></button>
                       </div>
                       
                       <div className="grid grid-cols-3 md:grid-cols-2 gap-2 mb-4">
                           {['FRENTE', 'MANGA', 'SAIA', 'COSTAS', 'GOLA', 'OUTROS'].map((part) => (
                               <button key={part} onClick={() => updateActiveLayer({ bodyPart: part as BodyPartType })}
                                className={`px-1 py-1.5 text-[10px] font-bold rounded border transition-all ${activeLayer.bodyPart === part ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>
                                   {part}
                               </button>
                           ))}
                       </div>

                       <div className="space-y-3 border-t border-blue-200 pt-3">
                            <div className="flex gap-2 justify-center">
                                 <button onClick={() => updateActiveLayer({ rotation: activeLayer.rotation + 90 })} className="flex-1 bg-white p-2 rounded text-blue-600 border border-blue-200 flex justify-center"><RotateCw size={16}/></button>
                                 <button onClick={() => updateActiveLayer({ flipX: !activeLayer.flipX })} className="flex-1 bg-white p-2 rounded text-blue-600 border border-blue-200 flex justify-center"><FlipHorizontal size={16}/></button>
                                 <button onClick={deleteActiveLayer} className="flex-1 bg-red-100 p-2 rounded text-red-500 border border-red-200 flex justify-center"><Trash2 size={16}/></button>
                            </div>
                            <div className="bg-white/50 p-2 rounded border border-blue-100 text-[10px] text-blue-400 text-center flex items-center justify-center gap-2">
                                <Hand size={12}/> Use 2 dedos na tela para zoom e rotação
                            </div>
                       </div>
                   </div>
               ) : (
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-2">
                       <button onClick={() => setTool('WAND')} className={`flex-1 py-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-1 ${tool === 'WAND' ? 'bg-vingi-900 text-white shadow-lg scale-105' : 'bg-white text-gray-500'}`}>
                           <Wand2 size={18}/> APLICAR
                       </button>
                       <button onClick={() => setTool('MOVE')} className={`flex-1 py-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-1 ${tool === 'MOVE' ? 'bg-vingi-900 text-white shadow-lg scale-105' : 'bg-white text-gray-500'}`}>
                           <Move size={18}/> MOVER
                       </button>
                       <button onClick={() => setShowVisualizer(true)} className="flex-1 py-3 bg-purple-600 text-white rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-1 shadow-lg">
                           <MonitorPlay size={18}/> 3D
                       </button>
                   </div>
               )}
          </div>
      </div>

      {/* WORKSPACE (CANVAS) */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#e2e8f0] pb-32 md:pb-0">
           <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

           <div className={`relative shadow-2xl bg-white border-4 border-white md:rounded-lg flex flex-col items-center justify-center overflow-hidden transition-all duration-500`}>
                {moldImgObj ? (
                    <canvas 
                        ref={mainCanvasRef}
                        width={canvasDims.w}
                        height={canvasDims.h}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        style={{ 
                            maxWidth: '100vw', 
                            maxHeight: isMobile ? '70vh' : '85vh',
                            width: 'auto',
                            height: 'auto',
                            aspectRatio: canvasDims.w > 0 ? `${canvasDims.w}/${canvasDims.h}` : 'auto',
                            touchAction: 'none' // CRITICAL: DISABLES BROWSER SCROLLING FOR CANVAS
                        }}
                        className="cursor-crosshair block shadow-inner"
                    />
                ) : (
                    <div className="p-10 md:p-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-4">
                        <Scissors size={48} className="mx-auto mb-4 opacity-30"/>
                        <p className="font-bold text-sm md:text-lg">Carregue um Molde</p>
                    </div>
                )}
           </div>
      </div>

      {/* VISUALIZER */}
      {showVisualizer && (
           <div className={`
                fixed z-[9999] bg-white shadow-2xl overflow-hidden flex flex-col
                ${isMobile ? 'inset-0' : 'w-[350px] rounded-xl border-2 border-gray-900'}
           `}
                style={!isMobile ? { top: visualizerPos.y, left: visualizerPos.x } : {}}
           >
               <div onMouseDown={() => !isMobile && (isDraggingModal.current = true)} className="bg-vingi-900 text-white p-4 flex justify-between items-center cursor-move select-none shrink-0">
                   <span className="text-sm font-bold flex items-center gap-2"><Sparkles size={16}/> PROVADOR VIRTUAL 3D</span>
                   <button onClick={() => setShowVisualizer(false)}><X size={20}/></button>
               </div>
               <div className="relative bg-gray-100 flex-1 flex items-center justify-center overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoOHY4SDB6IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTAgMGg0djRINHptNCA0aDR2NEg0eiIgZmlsbD0iI2U1ZTVlNSIvPjwvc3ZnPg==')]">
                   <canvas ref={visualizerCanvasRef} className="h-full w-auto drop-shadow-2xl object-contain"/>
                   <div className="absolute bottom-8 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-gray-200">
                       <p className="text-xs font-bold text-gray-600 flex items-center gap-2">
                           <CheckCircle2 size={16} className="text-green-500"/>
                           {layers.length} PEÇAS SINCRONIZADAS
                       </p>
                   </div>
               </div>
           </div>
      )}
    </div>
  );
};
