
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Wand2, X, Move, Trash2, Scissors, Layers, FlipHorizontal, RotateCw, Check, Palette, Hand, PlusCircle } from 'lucide-react';

// --- TYPES ---
type BodyPartType = 'DEFAULT';

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

// Algoritmo de Flood Fill Otimizado
const floodFill = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tol: number) => {
    const imageData = ctx.getImageData(0,0,width,height);
    const data = imageData.data;
    const maskData = new Uint8ClampedArray(width * height * 4);
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const a0 = data[startPos+3];
    
    // Se clicou em algo transparente (fundo do canvas), ignora
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

    if (pixelCount < 50) return null; // Ignora ruído
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
  
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs for logic
  const isDraggingLayer = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Refs for Multi-touch Gestures
  const gestureStartScale = useRef<number>(1);
  const gestureStartRotation = useRef<number>(0);
  const gestureStartDist = useRef<number>(0);
  const gestureStartAngle = useRef<number>(0);
  const isGestureActive = useRef<boolean>(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
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
        isGestureActive.current = false;
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchend', handleGlobalUp);
    };
  }, []);


  // --- MOUSE/TOUCH HANDLERS (UNIFIED & IMPROVED) ---

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const isTouch = 'touches' in e;
      
      // 1. Multitouch Check (Gestures)
      if (isTouch && (e as React.TouchEvent).touches.length === 2 && activeLayerId) {
          e.preventDefault(); 
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

      // 2. Get Coordinates
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

      // 3. HIT TEST: Check if we clicked on an existing layer
      let clickedLayerId = null;
      for (let i = layers.length - 1; i >= 0; i--) {
          const ctx = layers[i].maskCanvas.getContext('2d')!;
          // Simple alpha check
          if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { 
              clickedLayerId = layers[i].id;
              break; 
          }
      }

      // 4. INTELLIGENT MODE SWITCHING
      if (clickedLayerId) {
          // Clicked on a layer -> Select it and switch to MOVE mode
          setActiveLayerId(clickedLayerId);
          setTool('MOVE');
          isDraggingLayer.current = true;
          lastMousePos.current = { x: clientX, y: clientY };
      } else {
          // Clicked on EMPTY space
          // Behavior: Always try to FILL (Wand) if we clicked empty space, 
          // even if we were in "Move" mode for another layer.
          
          // Deselect current layer visually first
          setActiveLayerId(null); 
          
          // Perform Flood Fill
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
                   bodyPart: 'DEFAULT'
               };
               setLayers(prev => [...prev, newLayer]);
               setActiveLayerId(newLayer.id);
               setTool('MOVE'); // Auto-switch to move after creation for adjustments
          }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (e.cancelable) e.preventDefault(); 
      
      const isTouch = 'touches' in e;

      // --- GESTURES ---
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

      // --- DRAG ---
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


  const activeLayer = layers.find(l => l.id === activeLayerId);

  return (
    <div className="flex flex-col h-full bg-[#e2e8f0] md:flex-row overflow-hidden font-sans relative"
         onMouseMove={(e) => { 
             handlePointerMove(e);
         }}>
      
      {/* --- SIDEBAR / BOTTOM SHEET --- */}
      <div className={`
        bg-white border-r border-gray-200 flex flex-col shadow-2xl z-30 transition-all duration-300
        md:w-80 md:h-full md:relative md:translate-y-0
        fixed bottom-0 left-0 w-full rounded-t-2xl md:rounded-none
        ${activeLayer && isMobile ? 'h-auto pb-4' : isMobile ? 'h-auto pb-6' : ''}
      `}
        style={{
             maxHeight: isMobile && activeLayer ? '35vh' : 'auto' 
        }}
      >
          
          {/* Mobile Handle */}
          <div className="md:hidden w-full flex justify-center pt-2 pb-1" onClick={() => setActiveLayerId(null)}>
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50 hidden md:block">
              <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={20} /> Vingi Studio <span className="text-[10px] bg-black text-white px-1.5 rounded">2D</span>
              </h2>
          </div>
          
          <div className="p-4 md:p-5 space-y-4 md:space-y-6 overflow-y-auto max-h-full">
               
               {/* UPLOAD BUTTONS WITH VISUAL FEEDBACK */}
               {!activeLayer && (
                   <div className="flex gap-2 md:flex-col">
                       {/* BOTÃO MOLDE */}
                       <div onClick={() => moldInputRef.current?.click()} 
                            className={`flex-1 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 text-center relative group flex flex-col items-center justify-center gap-2 transition-all ${moldImage ? 'border-green-500 bg-green-50' : 'border-dashed border-gray-300'}`}>
                          <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                          
                          {moldImage ? (
                              <>
                                <div className="w-full h-12 rounded-lg overflow-hidden border border-green-300 mb-1 bg-white relative">
                                    <img src={moldImage} className="w-full h-full object-contain" />
                                    <div className="absolute top-0 right-0 bg-green-500 text-white p-0.5 rounded-bl"><Check size={10}/></div>
                                </div>
                                <span className="text-[10px] font-bold text-green-700">MOLDE OK</span>
                              </>
                          ) : (
                              <>
                                <Scissors size={20} className="text-gray-400"/>
                                <span className="text-[10px] md:text-xs font-bold text-gray-500">MOLDE</span>
                              </>
                          )}
                       </div>

                       {/* BOTÃO ESTAMPA */}
                       <div onClick={() => patternInputRef.current?.click()} 
                            className={`flex-1 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 text-center relative group flex flex-col items-center justify-center gap-2 transition-all ${patternImage ? 'border-purple-500 bg-purple-50' : 'border-dashed border-gray-300'}`}>
                          <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                          
                          {patternImage ? (
                               <>
                                <div className="w-full h-12 rounded-lg overflow-hidden border border-purple-300 mb-1 bg-white relative">
                                    <img src={patternImage} className="w-full h-full object-cover" />
                                    <div className="absolute top-0 right-0 bg-purple-500 text-white p-0.5 rounded-bl"><Check size={10}/></div>
                                </div>
                                <span className="text-[10px] font-bold text-purple-700">ESTAMPA OK</span>
                               </>
                          ) : (
                               <>
                                <Palette size={20} className="text-gray-400"/>
                                <span className="text-[10px] md:text-xs font-bold text-gray-500">ESTAMPA</span>
                               </>
                          )}
                       </div>
                   </div>
               )}

               {/* LAYER CONTROLS (SIMPLIFICADO - SEM SELETOR DE PARTES) */}
               {activeLayer ? (
                   <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm animate-fade-in-up">
                       <div className="flex justify-between items-center mb-4">
                           <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2"><Layers size={12}/> Camada Ativa</h3>
                           <button onClick={() => setActiveLayerId(null)} className="md:hidden text-blue-500 bg-white p-1 rounded-full shadow"><X size={14}/></button>
                       </div>
                       
                       <div className="flex gap-2 justify-center mb-2">
                            <button onClick={() => updateActiveLayer({ rotation: activeLayer.rotation + 45 })} className="flex-1 bg-white p-3 rounded-lg text-blue-600 border border-blue-200 flex justify-center shadow-sm active:scale-95"><RotateCw size={20}/></button>
                            <button onClick={() => updateActiveLayer({ flipX: !activeLayer.flipX })} className="flex-1 bg-white p-3 rounded-lg text-blue-600 border border-blue-200 flex justify-center shadow-sm active:scale-95"><FlipHorizontal size={20}/></button>
                            <button onClick={deleteActiveLayer} className="flex-1 bg-red-100 p-3 rounded-lg text-red-500 border border-red-200 flex justify-center shadow-sm active:scale-95"><Trash2 size={20}/></button>
                       </div>
                       
                       <div className="bg-white/60 p-2 rounded border border-blue-100 text-[10px] text-blue-500 text-center font-bold flex items-center justify-center gap-2">
                           <Hand size={14}/> Use 2 dedos para zoom/rotação
                       </div>
                   </div>
               ) : (
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-2">
                       <button onClick={() => setTool('WAND')} className={`flex-1 py-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-1 transition-all ${tool === 'WAND' ? 'bg-vingi-900 text-white shadow-lg' : 'bg-white text-gray-500'}`}>
                           <Wand2 size={18}/> APLICAR
                       </button>
                       <button onClick={() => setTool('MOVE')} className={`flex-1 py-3 rounded-lg text-xs font-bold border flex flex-col items-center justify-center gap-1 transition-all ${tool === 'MOVE' ? 'bg-vingi-900 text-white shadow-lg' : 'bg-white text-gray-500'}`}>
                           <Move size={18}/> MOVER
                       </button>
                   </div>
               )}
          </div>
      </div>

      {/* WORKSPACE (CANVAS) */}
      <div className="fixed top-0 left-0 w-full h-[65vh] md:relative md:h-full md:flex-1 bg-[#e2e8f0] flex items-center justify-center overflow-hidden z-0">
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
                            maxHeight: isMobile ? '60vh' : '85vh',
                            width: 'auto',
                            height: 'auto',
                            aspectRatio: canvasDims.w > 0 ? `${canvasDims.w}/${canvasDims.h}` : 'auto',
                            touchAction: 'none' // IMPEDE O SCROLL DA PÁGINA AO TOCAR
                        }}
                        className="cursor-crosshair block shadow-inner bg-white"
                    />
                ) : (
                    <div 
                        onClick={() => moldInputRef.current?.click()}
                        className="p-10 md:p-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-4 cursor-pointer hover:bg-gray-50 active:scale-95 transition-all group"
                    >
                        <Scissors size={48} className="mx-auto mb-4 opacity-30 group-hover:text-vingi-900 group-hover:opacity-100 transition-all"/>
                        <p className="font-bold text-sm md:text-lg">Carregue um Molde</p>
                        <p className="text-xs mt-2 opacity-50">Toque aqui para abrir</p>
                    </div>
                )}
           </div>
      </div>
    </div>
  );
};
