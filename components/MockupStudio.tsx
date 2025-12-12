
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Wand2, MonitorPlay, X, Target, Move, Trash2, Scissors, ScanFace, Sliders, Palette, Eye, Shirt, Sparkles, BoxSelect, CheckCircle2, Layers, FlipHorizontal, FlipVertical, RotateCw, ZoomIn, GripHorizontal, MousePointer2, Loader2, Download, ArrowRight, Brush } from 'lucide-react';

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

interface MockupStudioProps {
  externalPattern?: string | null;
}

export const MockupStudio: React.FC<MockupStudioProps> = ({ externalPattern }) => {
  // --- STATE ---
  const [tabMode, setTabMode] = useState<'TECHNICAL' | 'MOCKUP'>('TECHNICAL');
  
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 }); 

  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  const [globalScale, setGlobalScale] = useState(0.5); 
  const [globalRotation, setGlobalRotation] = useState(0);

  const [showVisualizer, setShowVisualizer] = useState(false);
  const [visualizerPos, setVisualizerPos] = useState({ x: 50, y: 50 });
  
  const isDraggingModal = useRef(false);
  const isDraggingLayer = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);

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
    // Carrega estampa externa (do Creator) ou upload manual
    const src = externalPattern || patternImage;
    if (src) {
        const img = new Image(); 
        img.src = src; 
        img.onload = () => {
             setPatternImgObj(img);
             // Se veio externo, garante que o state local reflita isso
             if(externalPattern) setPatternImage(externalPattern);
        };
    }
  }, [patternImage, externalPattern]);

  // Global Mouse Up
  useEffect(() => {
    const handleGlobalUp = () => {
        isDraggingLayer.current = false;
        isDraggingModal.current = false;
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchend', handleGlobalUp);
    };
  }, []);


  // --- CANVAS HANDLERS ---
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      
      let clientX, clientY;
      if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

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
                   offsetX: res.centerX - (patternImgObj.width * globalScale)/2,
                   offsetY: res.centerY - (patternImgObj.height * globalScale)/2,
                   scale: globalScale, rotation: globalRotation, 
                   flipX: false, flipY: false, skewX: 0, skewY: 0,
                   bodyPart: 'OUTROS'
               };
               setLayers(prev => [...prev, newLayer]);
               setActiveLayerId(newLayer.id);
           }
      } else if (tool === 'MOVE') {
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
          } else {
              setActiveLayerId(null);
          }
      }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingLayer.current || !activeLayerId || tool !== 'MOVE') return;
      if (e.cancelable) e.preventDefault();

      let clientX, clientY;
      if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

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


  // --- RENDER MAIN CANVAS (TECHNICAL) ---
  const renderMain = useCallback(() => {
      const canvas = mainCanvasRef.current;
      if (!canvas || !moldImgObj || canvasDims.w === 0) return;
      const ctx = canvas.getContext('2d')!;

      // 1. Fundo Branco Limpo
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#ffffff'; 
      ctx.fillRect(0,0,canvas.width,canvas.height);
      
      // 2. Molde Original
      ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

      // 3. Camadas (Recortes)
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

          if (layer.id === activeLayerId) {
              ctx.save();
              ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
              ctx.beginPath();
              ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 20, 0, 2 * Math.PI);
              ctx.stroke();
              
              ctx.beginPath();
              ctx.moveTo(layer.maskCenter.x, layer.maskCenter.y - 20);
              ctx.lineTo(layer.maskCenter.x, layer.maskCenter.y - 40);
              ctx.stroke();

              ctx.font = 'bold 12px sans-serif';
              const label = layer.bodyPart;
              const textW = ctx.measureText(label).width + 16;
              
              ctx.fillStyle = '#2563eb';
              ctx.shadowColor="rgba(0,0,0,0.2)"; ctx.shadowBlur=4;
              ctx.beginPath();
              ctx.roundRect(layer.maskCenter.x - textW/2, layer.maskCenter.y - 60, textW, 24, 4);
              ctx.fill();
              
              ctx.shadowColor="transparent";
              ctx.fillStyle = 'white'; 
              ctx.fillText(label, layer.maskCenter.x - textW/2 + 8, layer.maskCenter.y - 44);
              ctx.restore();
          }
      });
  }, [moldImgObj, layers, activeLayerId, canvasDims]);

  useEffect(() => { requestAnimationFrame(renderMain); }, [renderMain]);


  // --- RENDER VISUALIZER (3D) ---
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
    <div className="flex flex-col h-full bg-[#f0f2f5] md:flex-row overflow-hidden font-sans relative"
         onMouseMove={(e) => { 
             handleMouseMove(e);
             if(isDraggingModal.current) setVisualizerPos(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
         }}>
      
      {/* SIDEBAR */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col shadow-2xl z-20 shrink-0 h-auto md:h-full overflow-y-auto">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={20} /> Vingi Studio <span className="text-[10px] bg-black text-white px-1.5 rounded">PRO</span>
              </h2>
          </div>

          <div className="flex border-b border-gray-200">
              <button onClick={() => setTabMode('TECHNICAL')} className={`flex-1 py-3 text-xs font-bold ${tabMode==='TECHNICAL' ? 'text-vingi-900 border-b-2 border-vingi-900' : 'text-gray-400'}`}>TÉCNICO</button>
              <button onClick={() => { setTabMode('MOCKUP'); setShowVisualizer(true); }} className={`flex-1 py-3 text-xs font-bold ${tabMode==='MOCKUP' ? 'text-vingi-900 border-b-2 border-vingi-900' : 'text-gray-400'}`}>3D</button>
          </div>
          
          <div className="p-5 space-y-6">
               
               {/* ABA TÉCNICA - PADRÃO */}
               <div className="space-y-3">
                   <div onClick={() => moldInputRef.current?.click()} className="p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-center relative group">
                      <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                      {moldImage ? <img src={moldImage} className="h-20 mx-auto object-contain"/> : <span className="text-xs font-bold text-gray-400 flex flex-col items-center gap-2"><Scissors/> CARREGAR MOLDE</span>}
                   </div>

                   <div onClick={() => patternInputRef.current?.click()} className="p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-center relative group overflow-hidden">
                      <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                      {patternImage ? <img src={patternImage} className="w-full h-20 object-cover opacity-80"/> : <span className="text-xs font-bold text-gray-400 flex flex-col items-center gap-2"><Palette/> CARREGAR ESTAMPA</span>}
                   </div>
               </div>

               {activeLayer ? (
                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm animate-fade-in">
                       <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-3 flex items-center gap-2"><Layers size={12}/> Definir Peça (Tagging)</h3>
                       
                       <label className="text-xs font-bold text-gray-600 block mb-1">Este corte corresponde a:</label>
                       <div className="grid grid-cols-2 gap-2 mb-4">
                           {['FRENTE', 'MANGA', 'SAIA', 'COSTAS', 'GOLA'].map((part) => (
                               <button key={part} onClick={() => updateActiveLayer({ bodyPart: part as BodyPartType })}
                                className={`px-1 py-1.5 text-[10px] font-bold rounded border transition-all ${activeLayer.bodyPart === part ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white border-gray-200 text-gray-500 hover:bg-blue-100'}`}>
                                   {part}
                               </button>
                           ))}
                       </div>

                       <div className="space-y-3 border-t border-blue-200 pt-3">
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-500"><span>Zoom Estampa</span><span>{Math.round(activeLayer.scale * 100)}%</span></div>
                                <input type="range" min="0.1" max="2" step="0.01" value={activeLayer.scale} onChange={(e) => updateActiveLayer({ scale: parseFloat(e.target.value) })} className="w-full h-1 bg-blue-200 rounded-lg accent-blue-600"/>
                            </div>
                            <div className="flex gap-2 justify-center">
                                 <button onClick={() => updateActiveLayer({ rotation: activeLayer.rotation + 90 })} className="bg-white p-2 rounded text-blue-600 border border-blue-200"><RotateCw size={14}/></button>
                                 <button onClick={() => updateActiveLayer({ flipX: !activeLayer.flipX })} className="bg-white p-2 rounded text-blue-600 border border-blue-200"><FlipHorizontal size={14}/></button>
                            </div>
                       </div>
                       
                       <button onClick={deleteActiveLayer} className="w-full mt-4 py-2 bg-white border border-red-200 text-red-500 rounded text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-1"><Trash2 size={12}/> REMOVER SELEÇÃO</button>
                   </div>
               ) : (
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                       <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Wand2 size={12}/> Ferramentas</h3>
                       <div className="flex gap-2">
                           <button onClick={() => setTool('WAND')} className={`flex-1 py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 ${tool === 'WAND' ? 'bg-vingi-900 text-white' : 'bg-white text-gray-500'}`}><Wand2 size={14}/> APLICAR</button>
                           <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 ${tool === 'MOVE' ? 'bg-vingi-900 text-white' : 'bg-white text-gray-500'}`}><Move size={14}/> MOVER</button>
                       </div>
                   </div>
               )}

               <button onClick={() => setShowVisualizer(true)} className="w-full py-4 bg-vingi-900 text-white font-black text-sm rounded-xl shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 mt-auto">
                   <MonitorPlay size={18}/> ABRIR VISUALIZADOR 3D
               </button>
          </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 bg-[#e2e8f0] relative flex items-center justify-center overflow-auto p-4">
           <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

           <div className={`relative shadow-2xl bg-white border-4 border-white rounded-lg flex flex-col items-center justify-center overflow-hidden transition-all duration-500`}>
                {moldImgObj ? (
                    <canvas 
                        ref={mainCanvasRef}
                        width={canvasDims.w}
                        height={canvasDims.h}
                        onMouseDown={handleCanvasClick}
                        onMouseMove={handleMouseMove}
                        onTouchStart={handleCanvasClick}
                        onTouchMove={handleMouseMove}
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '85vh',
                            width: 'auto',
                            height: 'auto',
                            aspectRatio: canvasDims.w > 0 ? `${canvasDims.w}/${canvasDims.h}` : 'auto'
                        }}
                        className="cursor-crosshair block shadow-inner"
                    />
                ) : (
                    <div className="p-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-4">
                        <Scissors size={64} className="mx-auto mb-4 opacity-30"/>
                        <p className="font-bold text-lg">Área Técnica Vazia</p>
                        <p className="text-xs mt-2">Carregue um molde para começar</p>
                    </div>
                )}
           </div>
      </div>

      {/* MOCKUP MODAL */}
      {showVisualizer && (
           <div className="fixed w-[350px] bg-white rounded-xl shadow-2xl border-2 border-gray-900 flex flex-col overflow-hidden z-[9999]"
                style={{ top: visualizerPos.y, left: visualizerPos.x }}>
               
               <div onMouseDown={() => isDraggingModal.current = true} className="bg-vingi-900 text-white p-3 flex justify-between items-center cursor-move select-none">
                   <span className="text-xs font-bold flex items-center gap-2"><Sparkles size={14}/> PROVADOR VIRTUAL 3D</span>
                   <button onClick={() => setShowVisualizer(false)}><X size={14}/></button>
               </div>
               
               <div className="relative bg-gray-100 h-[500px] flex items-center justify-center overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoOHY4SDB6IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTAgMGg0djRINHptNCA0aDR2NEg0eiIgZmlsbD0iI2U1ZTVlNSIvPjwvc3ZnPg==')]">
                   <canvas ref={visualizerCanvasRef} className="h-full w-auto drop-shadow-2xl"/>
                   
                   <div className="absolute bottom-4 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-200">
                       <p className="text-[10px] font-bold text-gray-600 flex items-center gap-2">
                           <CheckCircle2 size={12} className="text-green-500"/>
                           {layers.length} PEÇAS SINCRONIZADAS
                       </p>
                   </div>
               </div>
           </div>
      )}
    </div>
  );
};
