
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, RotateCw, ZoomIn, Eraser, Download, Wand2, MonitorPlay, X, Target, FlipHorizontal, FlipVertical, Lock, Unlock, Layers, Zap, MousePointer2, CheckCircle2, Sparkles, Move, Maximize } from 'lucide-react';

// --- TYPES ---
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
  timestamp?: number;
}

export const MockupStudio: React.FC = () => {
  // --- STATE: ASSETS ---
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  // --- STATE: ENGINE ---
  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // Smart Settings
  const [globalScale, setGlobalScale] = useState(0.5); 
  const [globalRotation, setGlobalRotation] = useState(0);
  const [globalFlipX, setGlobalFlipX] = useState(false);
  const [globalFlipY, setGlobalFlipY] = useState(false);
  const [syncSettings, setSyncSettings] = useState(true); 
  const [realismOpacity, setRealismOpacity] = useState(0.9); 
  const [isProcessing, setIsProcessing] = useState(false);

  // --- VIEWPORT STATE (ZOOM/PAN DA CÂMERA) ---
  const [viewTransform, setViewTransform] = useState({ k: 1, x: 0, y: 0 }); // k = scale
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isPinching, setIsPinching] = useState(false);

  // --- REFS ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  
  // Controle de Interação
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number>(0);
  const lastPinchCenter = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // --- INITIALIZATION ---
  useEffect(() => {
    // Check for transferred pattern from Atelier
    const transferredPattern = localStorage.getItem('vingi_mockup_pattern');
    if (transferredPattern) {
        setPatternImage(transferredPattern);
        localStorage.removeItem('vingi_mockup_pattern');
    }
  }, []);

  useEffect(() => {
    if (moldImage) {
      const img = new Image();
      img.src = moldImage;
      img.onload = () => {
        if (mainCanvasRef.current) {
            const canvas = mainCanvasRef.current;
            const MAX_DIM = 2500; // Alta resolução interna
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = w / h;
                if (w > h) { w = MAX_DIM; h = MAX_DIM / ratio; } 
                else { h = MAX_DIM; w = MAX_DIM * ratio; }
            }
            canvas.width = w; canvas.height = h;
            
            // Reset Viewport
            setViewTransform({ k: 1, x: 0, y: 0 });
        }
        setMoldImgObj(img);
        setLayers([]);
      };
    }
  }, [moldImage]);

  useEffect(() => {
    if (patternImage) { const img = new Image(); img.src = patternImage; img.onload = () => setPatternImgObj(img); }
  }, [patternImage]);

  // Sync Settings Logic
  useEffect(() => {
    if (syncSettings && layers.length > 0) {
        setLayers(prev => prev.map(layer => ({ 
            ...layer, 
            scale: globalScale, rotation: globalRotation, flipX: globalFlipX, flipY: globalFlipY
        })));
    } else if (!syncSettings && activeLayerId) {
        setLayers(prev => prev.map(layer => {
            if (layer.id === activeLayerId) {
                return { ...layer, scale: globalScale, rotation: globalRotation, flipX: globalFlipX, flipY: globalFlipY };
            }
            return layer;
        }));
    }
  }, [globalScale, globalRotation, globalFlipX, globalFlipY, syncSettings]);

  // Inverse Sync
  useEffect(() => {
      if (!syncSettings && activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) { 
              setGlobalScale(layer.scale); setGlobalRotation(layer.rotation); setGlobalFlipX(layer.flipX); setGlobalFlipY(layer.flipY);
          }
      }
  }, [activeLayerId, syncSettings]);


  // --- RENDER ENGINE ---
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !moldImgObj) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Base Mold
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    // 2. Draw Layers
    layers.forEach(layer => {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
        const lCtx = layerCanvas.getContext('2d')!;
        
        lCtx.drawImage(layer.maskCanvas, 0, 0);
        lCtx.globalCompositeOperation = 'source-in';
        lCtx.save();
        lCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        lCtx.rotate((layer.rotation * Math.PI) / 180);
        lCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        lCtx.scale(layer.scale, layer.scale);
        lCtx.translate(layer.offsetX, layer.offsetY);
        
        const pat = lCtx.createPattern(layer.patternImg, 'repeat');
        if (pat) { 
            lCtx.fillStyle = pat; 
            const safeSize = 10000; 
            lCtx.fillRect(-safeSize/2, -safeSize/2, safeSize, safeSize); 
        }
        lCtx.restore();
        
        ctx.save();
        ctx.globalAlpha = realismOpacity; 
        ctx.drawImage(layerCanvas, 0, 0);
        ctx.restore();

        if (layer.id === activeLayerId) {
            ctx.save();
            ctx.globalAlpha = 1; 
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6'; 
            ctx.strokeStyle = 'white'; 
            ctx.lineWidth = 3;
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    });

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [moldImgObj, layers, activeLayerId, realismOpacity]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  // --- FLOOD FILL LOGIC ---
  const createMaskFromClick = (startX: number, startY: number) => {
    if (!mainCanvasRef.current || !moldImgObj) return null;
    const canvas = mainCanvasRef.current;
    const width = canvas.width; const height = canvas.height;
    
    const tempC = document.createElement('canvas'); tempC.width = width; tempC.height = height;
    const tCtx = tempC.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
    const data = tCtx.getImageData(0, 0, width, height).data;
    
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    if (data[startPos] < 40 && data[startPos + 1] < 40 && data[startPos + 2] < 40) return null;

    const maskData = new Uint8ClampedArray(width * height * 4);
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(width * height);
    const tol = tolerance;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let pixelCount = 0;
    const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
    
    while (stack.length) {
        const [x, y] = stack.pop()!;
        let py = y;
        let pPos = (py * width + x) * 4;
        
        while (py >= 0 && !visited[py*width+x]) {
            const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
            if (diff > tol * 3) break;
            py--; pPos -= width*4;
        }
        pPos += width*4; py++; 
        
        let reachL = false, reachR = false;
        while (py < height && !visited[py*width+x]) {
            const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
            if (diff > tol * 3) break;

            maskData[pPos] = 255; maskData[pPos+1] = 255; maskData[pPos+2] = 255; maskData[pPos+3] = 255;
            visited[py*width+x] = 1; pixelCount++;

            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (py < minY) minY = py; if (py > maxY) maxY = py;

            if (x > 0) {
                const lp = pPos - 4;
                const lDiff = Math.abs(data[lp] - r0) + Math.abs(data[lp+1] - g0) + Math.abs(data[lp+2] - b0);
                if (lDiff <= tol*3 && !visited[py*width+(x-1)]) {
                    if (!reachL) { stack.push([x-1, py]); reachL = true; }
                } else if (reachL) reachL = false;
            }
            if (x < width-1) {
                const rp = pPos + 4;
                const rDiff = Math.abs(data[rp] - r0) + Math.abs(data[rp+1] - g0) + Math.abs(data[rp+2] - b0);
                if (rDiff <= tol*3 && !visited[py*width+(x+1)]) {
                    if (!reachR) { stack.push([x+1, py]); reachR = true; }
                } else if (reachR) reachR = false;
            }
            py++; pPos += width*4;
        }
    }
    
    if (pixelCount < 50) return null; 
    const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
    maskCanvas.getContext('2d')!.putImageData(new ImageData(maskData, width, height), 0, 0);
    return { maskCanvas, centerX: minX + (maxX - minX) / 2, centerY: minY + (maxY - minY) / 2 };
  };

  const handleAutoFill = () => {
    if (!mainCanvasRef.current || !moldImgObj || !patternImgObj) return;
    setIsProcessing(true);
    setTimeout(() => {
        const canvas = mainCanvasRef.current!;
        const width = canvas.width; const height = canvas.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(moldImgObj, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const visitedGlobal = new Uint8Array(width * height);
        const newLayers: AppliedLayer[] = [];
        const step = 40; 
        for (let y = step/2; y < height; y += step) {
            for (let x = step/2; x < width; x += step) {
                const pos = (Math.floor(y) * width + Math.floor(x)) * 4;
                if (data[pos] > 220 && data[pos+1] > 220 && data[pos+2] > 220 && visitedGlobal[Math.floor(y)*width+Math.floor(x)] === 0) {
                    const res = createMaskFromClick(x, y);
                    if (res) {
                        const mData = res.maskCanvas.getContext('2d')!.getImageData(0,0,width,height).data;
                        let hasNewPixels = false;
                        for(let i=0; i<mData.length; i+=4) { if (mData[i] === 255) { const idx = i/4; if (visitedGlobal[idx] === 0) { visitedGlobal[idx] = 1; hasNewPixels = true; } } }
                        if (hasNewPixels) {
                            newLayers.push({
                                id: Date.now() + Math.random().toString(),
                                maskCanvas: res.maskCanvas,
                                maskCenter: { x: res.centerX, y: res.centerY },
                                patternImg: patternImgObj,
                                offsetX: 0, offsetY: 0,
                                scale: globalScale, rotation: globalRotation, flipX: globalFlipX, flipY: globalFlipY, 
                                timestamp: Date.now()
                            });
                        }
                    }
                }
            }
        }
        setLayers(newLayers);
        if (newLayers.length > 0) setActiveLayerId(newLayers[0].id);
        setIsProcessing(false);
    }, 100);
  };

  // --- TOUCH / MOUSE EVENTS ---
  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (t1: React.Touch, t2: React.Touch) => {
      return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    // 2 Fingers -> Zoom/Pan (Multi-touch)
    if ('touches' in e && e.touches.length === 2) {
        setIsPinching(true);
        lastPinchDist.current = getDistance(e.touches[0], e.touches[1]);
        lastPinchCenter.current = getCenter(e.touches[0], e.touches[1]);
        return;
    }

    // 1 Finger -> Tool Action
    if (!moldImgObj || !patternImgObj) return;
    const { x: clientX, y: clientY } = getCoords(e);
    
    // Convert to Canvas Local Coords accounting for CSS Transform (Scale/Pan)
    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect(); // This rect already includes the CSS transform scale!
    
    // Normalization works because getBoundingClientRect gives the VISUAL dimensions
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (tool === 'WAND') {
        const res = createMaskFromClick(x, y);
        if (res) {
            const newLayer: AppliedLayer = {
                id: Date.now().toString(),
                maskCanvas: res.maskCanvas,
                maskCenter: { x: res.centerX, y: res.centerY },
                patternImg: patternImgObj,
                offsetX: 0, offsetY: 0,
                scale: globalScale, rotation: globalRotation, flipX: globalFlipX, flipY: globalFlipY, 
                timestamp: Date.now()
            };
            setLayers(prev => [...prev, newLayer]);
            setActiveLayerId(newLayer.id);
        }
    } else if (tool === 'MOVE') {
        let clickedId = null;
        for (let i = layers.length - 1; i >= 0; i--) {
            const ctx = layers[i].maskCanvas.getContext('2d')!;
            // Check alpha channel
            if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { clickedId = layers[i].id; break; }
        }
        
        if (clickedId) {
            setActiveLayerId(clickedId);
            isDragging.current = true;
            lastPos.current = { x: clientX, y: clientY };
            if (!syncSettings) {
                const l = layers.find(lay => lay.id === clickedId);
                if (l) { 
                    setGlobalScale(l.scale); setGlobalRotation(l.rotation); setGlobalFlipX(l.flipX); setGlobalFlipY(l.flipY);
                }
            }
        } else {
            setActiveLayerId(null);
        }
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPinching && 'touches' in e && e.touches.length === 2) {
        const dist = getDistance(e.touches[0], e.touches[1]);
        const center = getCenter(e.touches[0], e.touches[1]);
        
        // Zoom Logic
        const zoomFactor = dist / lastPinchDist.current;
        const newScale = Math.min(Math.max(viewTransform.k * zoomFactor, 0.5), 5); // Limit Zoom 0.5x to 5x
        
        // Pan Logic (Move center)
        const dx = center.x - lastPinchCenter.current.x;
        const dy = center.y - lastPinchCenter.current.y;
        
        setViewTransform(prev => ({
            k: newScale,
            x: prev.x + dx,
            y: prev.y + dy
        }));

        lastPinchDist.current = dist;
        lastPinchCenter.current = center;
        return;
    }

    if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
    if (e.cancelable && e.nativeEvent) e.preventDefault(); // Stop scroll

    const { x: clientX, y: clientY } = getCoords(e);
    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate raw screen delta
    const dxScreenRaw = clientX - lastPos.current.x;
    const dyScreenRaw = clientY - lastPos.current.y;

    // Adjust for CANVAS SCALE (Resolution vs CSS Size)
    // ratio = (Canvas Real Width) / (CSS Displayed Width)
    const ratioX = canvas.width / rect.width;
    const ratioY = canvas.height / rect.height;

    // Apply ratio to get delta in CANVAS PIXELS
    const dxCanvas = dxScreenRaw * ratioX;
    const dyCanvas = dyScreenRaw * ratioY;
    
    const layer = layers.find(l => l.id === activeLayerId);
    
    if (layer) {
        // Project screen movement to local pattern space accounting for rotation
        const angleRad = (layer.rotation * Math.PI) / 180;
        
        // Standard rotation matrix for coordinate projection
        let dxLocal = dxCanvas * Math.cos(angleRad) + dyCanvas * Math.sin(angleRad);
        let dyLocal = -dxCanvas * Math.sin(angleRad) + dyCanvas * Math.cos(angleRad);
        
        // Flip Correction: If flipped, visual right is local left (or vice-versa), so invert delta
        if (layer.flipX) dxLocal = -dxLocal;
        if (layer.flipY) dyLocal = -dyLocal; 

        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, offsetX: l.offsetX + dxLocal, offsetY: l.offsetY + dyLocal } : l));
    }
    lastPos.current = { x: clientX, y: clientY };
  };

  const handlePointerUp = () => {
      isDragging.current = false;
      setIsPinching(false);
  };

  const handleDownload = () => {
    if (!mainCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'vingi-mockup.png';
    link.href = mainCanvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  // --- LAYOUT ---
  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#f0f2f5] overflow-hidden relative">
      
      {/* 1. WORKSPACE (Maximizado Mobile) */}
      <div className="order-1 md:order-2 flex-1 relative bg-gray-200/50 flex items-center justify-center overflow-hidden touch-none h-[65vh] md:h-full shrink-0">
           <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

           {!moldImage ? (
               <div className="text-center opacity-50 px-4">
                   <UploadCloud size={48} className="mx-auto mb-2 text-gray-400"/>
                   <h2 className="text-lg font-bold text-gray-500">Área de Trabalho</h2>
                   <p className="text-xs text-gray-400">Carregue um molde para começar</p>
               </div>
           ) : (
                <div 
                    ref={viewportRef}
                    className="relative w-full h-full flex items-center justify-center p-0 md:p-8 overflow-hidden"
                >
                    {/* CANVAS CONTAINER COM TRANSFORM (ZOOM) */}
                    <div 
                        style={{ 
                            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`,
                            transformOrigin: 'center center',
                            transition: isPinching ? 'none' : 'transform 0.1s ease-out',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <canvas 
                            ref={mainCanvasRef}
                            onMouseDown={handlePointerDown}
                            onMouseMove={handlePointerMove}
                            onMouseUp={handlePointerUp}
                            onMouseLeave={handlePointerUp}
                            onTouchStart={handlePointerDown}
                            onTouchMove={handlePointerMove}
                            onTouchEnd={handlePointerUp}
                            className="block max-w-full max-h-full object-contain shadow-2xl bg-white"
                            style={{ cursor: tool === 'WAND' ? 'crosshair' : (isDragging.current ? 'grabbing' : 'grab') }}
                        />
                    </div>
                    
                    {/* RESET ZOOM BUTTON */}
                    <button 
                        onClick={() => setViewTransform({ k: 1, x: 0, y: 0 })}
                        className="absolute top-4 right-4 bg-white/80 backdrop-blur p-2 rounded-full shadow-lg text-gray-600 hover:text-gray-900 z-50 md:hidden"
                    >
                        <Maximize size={16} />
                    </button>

                    {isProcessing && (
                         <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
                             <div className="bg-vingi-900 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-pulse">
                                 <Wand2 className="animate-spin" size={16}/><span className="text-xs font-bold tracking-wide">IA...</span>
                             </div>
                         </div>
                    )}
                </div>
           )}
      </div>

      {/* 2. CONTROLS (Compacto Mobile) */}
      <div className="order-2 md:order-1 w-full md:w-80 bg-white border-t md:border-t-0 md:border-r border-gray-200 flex flex-col shadow-2xl z-20 h-[35vh] md:h-full overflow-y-auto custom-scrollbar">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur">
              <h2 className="text-sm font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={16} /> Studio
              </h2>
              {activeLayerId && <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10}/> ATIVA</span>}
          </div>

          <div className="p-3 space-y-4 pb-24 md:pb-5">
              {/* ASSETS */}
              <div className="grid grid-cols-2 gap-2">
                  <div onClick={() => moldInputRef.current?.click()} className={`relative h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${moldImage ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                      <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                      {moldImage ? <img src={moldImage} className="w-full h-full object-contain p-1"/> : <UploadCloud size={20} className="text-gray-300"/>}
                      <span className="text-[8px] font-bold text-gray-400 mt-1">MOLDE</span>
                  </div>
                  <div onClick={() => patternInputRef.current?.click()} className={`relative h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${patternImage ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                      <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                      {patternImage ? <img src={patternImage} className="w-full h-full object-cover rounded-lg"/> : <ImageIcon size={20} className="text-gray-300"/>}
                      <span className="text-[8px] font-bold text-gray-400 mt-1">ESTAMPA</span>
                  </div>
              </div>

              {/* TOOLS */}
              <div className="flex gap-2">
                  <button 
                    onClick={() => setTool('WAND')} 
                    className={`flex-1 py-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${tool === 'WAND' ? 'border-vingi-600 bg-vingi-50 text-vingi-700 shadow-md' : 'border-gray-200 text-gray-400'}`}
                  >
                      <Zap size={14}/> SELECIONAR
                  </button>
                  <button 
                    onClick={() => setTool('MOVE')} 
                    className={`flex-1 py-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${tool === 'MOVE' ? 'border-vingi-600 bg-vingi-50 text-vingi-700 shadow-md' : 'border-gray-200 text-gray-400'}`}
                  >
                      <Move size={14}/> MOVER
                  </button>
                  <button onClick={handleAutoFill} disabled={!moldImage || !patternImage || isProcessing} className="px-3 py-2 bg-vingi-900 text-white rounded-lg flex items-center justify-center shadow-md disabled:opacity-50">
                     <Sparkles size={14}/>
                  </button>
              </div>

              {/* ACTIVE LAYER CONTROLS */}
              <div className={`bg-white rounded-xl border border-gray-200 transition-all ${activeLayerId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                   <div className="p-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                       <span className="text-[9px] font-bold text-gray-500 uppercase">Ajustes</span>
                       <button onClick={() => setSyncSettings(!syncSettings)} className="text-gray-400">
                           {syncSettings ? <Lock size={10}/> : <Unlock size={10}/>}
                       </button>
                   </div>
                   <div className="p-3 space-y-3">
                       <div className="flex items-center gap-2">
                           <span className="text-[9px] font-bold text-gray-400 w-8">TAM</span>
                           <input type="range" min="0.1" max="2.5" step="0.05" value={globalScale} onChange={(e) => setGlobalScale(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                       </div>
                       <div className="flex items-center gap-2">
                           <span className="text-[9px] font-bold text-gray-400 w-8">ROT</span>
                           <input type="range" min="0" max="360" step="1" value={globalRotation} onChange={(e) => setGlobalRotation(parseInt(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                           <button onClick={() => setGlobalFlipX(!globalFlipX)} className={`py-1.5 rounded border text-[9px] font-bold flex justify-center gap-1 ${globalFlipX ? 'bg-gray-800 text-white' : 'text-gray-500'}`}><FlipHorizontal size={10} /> HORIZ</button>
                           <button onClick={() => setGlobalFlipY(!globalFlipY)} className={`py-1.5 rounded border text-[9px] font-bold flex justify-center gap-1 ${globalFlipY ? 'bg-gray-800 text-white' : 'text-gray-500'}`}><FlipVertical size={10} /> VERT</button>
                       </div>
                   </div>
              </div>
              
              <div className="flex gap-2">
                  <button onClick={() => setLayers([])} className="flex-1 py-2 bg-red-50 text-red-500 border border-red-100 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1">
                      <Eraser size={12}/> LIMPAR
                  </button>
                  <button onClick={handleDownload} className="flex-[2] py-2 bg-vingi-900 text-white font-bold rounded-lg text-[10px] shadow-lg flex items-center justify-center gap-2">
                      <Download size={12}/> SALVAR
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};
