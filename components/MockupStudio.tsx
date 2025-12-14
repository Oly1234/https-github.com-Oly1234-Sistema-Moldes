
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, RotateCw, ZoomIn, Eraser, Download, Wand2, MonitorPlay, X, Target, FlipHorizontal, FlipVertical, Lock, Unlock, Layers, Zap, MousePointer2, CheckCircle2, Sparkles, Move } from 'lucide-react';

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
  flipX: boolean; // Novo: Controle Horizontal
  flipY: boolean; // Novo: Controle Vertical
  timestamp?: number;
}

interface SimulationMapping {
    layerId: string;
    targetX: number;
    targetY: number;
    active: boolean;
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
  
  // Smart Settings (Globais ou Individuais)
  const [globalScale, setGlobalScale] = useState(0.5); 
  const [globalRotation, setGlobalRotation] = useState(0);
  const [globalFlipX, setGlobalFlipX] = useState(false);
  const [globalFlipY, setGlobalFlipY] = useState(false);
  const [syncSettings, setSyncSettings] = useState(true); // Se true, sliders afetam TUDO. Se false, afetam só a camada ativa.
  const [realismOpacity, setRealismOpacity] = useState(0.9); 
  const [isProcessing, setIsProcessing] = useState(false);

  // --- LIVE SIMULATION STATE ---
  const [showSimModal, setShowSimModal] = useState(false);
  const [simImage, setSimImage] = useState<string | null>(null);
  const [simImgObj, setSimImgObj] = useState<HTMLImageElement | null>(null);
  const [simMappings, setSimMappings] = useState<SimulationMapping[]>([]);

  // --- REFS ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const simCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  
  // Controle de Interação
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // --- INITIALIZATION ---
  useEffect(() => {
    if (moldImage) {
      const img = new Image();
      img.src = moldImage;
      img.onload = () => {
        if (mainCanvasRef.current) {
            const canvas = mainCanvasRef.current;
            const MAX_DIM = 2000;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = w / h;
                if (w > h) { w = MAX_DIM; h = MAX_DIM / ratio; } 
                else { h = MAX_DIM; w = MAX_DIM * ratio; }
            }
            canvas.width = w; canvas.height = h;
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
            scale: globalScale, 
            rotation: globalRotation, 
            flipX: globalFlipX,
            flipY: globalFlipY
        })));
    } else if (!syncSettings && activeLayerId) {
        // Atualiza apenas a camada ativa se o sync estiver desligado
        setLayers(prev => prev.map(layer => {
            if (layer.id === activeLayerId) {
                return {
                    ...layer,
                    scale: globalScale,
                    rotation: globalRotation,
                    flipX: globalFlipX,
                    flipY: globalFlipY
                };
            }
            return layer;
        }));
    }
  }, [globalScale, globalRotation, globalFlipX, globalFlipY, syncSettings]);

  // Update controls when active layer changes (Inverse Sync)
  useEffect(() => {
      if (!syncSettings && activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) { 
              setGlobalScale(layer.scale); 
              setGlobalRotation(layer.rotation); 
              setGlobalFlipX(layer.flipX);
              setGlobalFlipY(layer.flipY);
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
        
        // Draw Mask
        lCtx.drawImage(layer.maskCanvas, 0, 0);
        
        // Composite Pattern inside Mask
        lCtx.globalCompositeOperation = 'source-in';
        lCtx.save();
        
        // Transform Origin to Mask Center
        lCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        
        // Apply Transforms
        lCtx.rotate((layer.rotation * Math.PI) / 180);
        lCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        lCtx.scale(layer.scale, layer.scale);
        
        // Move Pattern relative to center
        lCtx.translate(layer.offsetX, layer.offsetY);
        
        // Draw Tiled Pattern
        const pat = lCtx.createPattern(layer.patternImg, 'repeat');
        if (pat) { 
            lCtx.fillStyle = pat; 
            // Draw a huge rect to cover rotation/movement
            const safeSize = 10000; 
            lCtx.fillRect(-safeSize/2, -safeSize/2, safeSize, safeSize); 
        }
        lCtx.restore();
        
        // Draw Composition to Main Canvas
        ctx.save();
        ctx.globalAlpha = realismOpacity; 
        ctx.drawImage(layerCanvas, 0, 0);
        ctx.restore();

        // Draw Active Indicator
        if (layer.id === activeLayerId) {
            ctx.save();
            ctx.globalAlpha = 1; 
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6'; 
            ctx.strokeStyle = 'white'; 
            ctx.lineWidth = 2;
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.fill(); 
            ctx.stroke();
            ctx.restore();
        }
    });

    // 3. Multiply Original Shadows (Realism)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [moldImgObj, layers, activeLayerId, realismOpacity]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  // --- LOGIC ---
  const createMaskFromClick = (startX: number, startY: number) => {
    if (!mainCanvasRef.current || !moldImgObj) return null;
    const canvas = mainCanvasRef.current;
    const width = canvas.width; const height = canvas.height;
    
    // Get Raw Pixel Data
    const tempC = document.createElement('canvas'); tempC.width = width; tempC.height = height;
    const tCtx = tempC.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
    const data = tCtx.getImageData(0, 0, width, height).data;
    
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    // Ignore pure black/dark areas (lines)
    if (data[startPos] < 40 && data[startPos + 1] < 40 && data[startPos + 2] < 40) return null;

    const maskData = new Uint8ClampedArray(width * height * 4);
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(width * height);
    const tol = tolerance;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let pixelCount = 0;
    const r0 = data[startPos];
    const g0 = data[startPos+1];
    const b0 = data[startPos+2];
    
    // Optimized Scanline Flood Fill
    while (stack.length) {
        const [x, y] = stack.pop()!;
        let py = y;
        let pPos = (py * width + x) * 4;
        
        // Move UP
        while (py >= 0 && !visited[py*width+x]) {
            const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
            if (diff > tol * 3) break;
            py--; pPos -= width*4;
        }
        pPos += width*4; py++; // Back one step valid
        
        let reachL = false, reachR = false;
        
        // Move DOWN painting
        while (py < height && !visited[py*width+x]) {
            const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
            if (diff > tol * 3) break;

            maskData[pPos] = 255; maskData[pPos+1] = 255; maskData[pPos+2] = 255; maskData[pPos+3] = 255;
            visited[py*width+x] = 1; 
            pixelCount++;

            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (py < minY) minY = py; if (py > maxY) maxY = py;

            // Check Left
            if (x > 0) {
                const lp = pPos - 4;
                const lDiff = Math.abs(data[lp] - r0) + Math.abs(data[lp+1] - g0) + Math.abs(data[lp+2] - b0);
                if (lDiff <= tol*3 && !visited[py*width+(x-1)]) {
                    if (!reachL) { stack.push([x-1, py]); reachL = true; }
                } else if (reachL) reachL = false;
            }
            // Check Right
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
    
    if (pixelCount < 50) return null; // Too small noise
    const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
    maskCanvas.getContext('2d')!.putImageData(new ImageData(maskData, width, height), 0, 0);
    return { maskCanvas, centerX: minX + (maxX - minX) / 2, centerY: minY + (maxY - minY) / 2 };
  };

  const handleAutoFill = () => {
    if (!mainCanvasRef.current || !moldImgObj || !patternImgObj) return;
    setIsProcessing(true);
    setTimeout(() => {
        // ... (Logica de autofill mantida, mas agora adicionando flipX/Y defaults)
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

  // --- EVENTS ---
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (!moldImgObj || !patternImgObj) return;
    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    
    // Convert click to canvas coordinates
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
                scale: globalScale, 
                rotation: globalRotation, 
                flipX: globalFlipX, 
                flipY: globalFlipY, 
                timestamp: Date.now()
            };
            setLayers(prev => [...prev, newLayer]);
            setActiveLayerId(newLayer.id);
            // CORREÇÃO: NÃO MUDAR A TOOL AUTOMATICAMENTE
            // Isso permite clicar em várias áreas (manga esq, manga dir) sequencialmente
        }
    } else if (tool === 'MOVE') {
        // Hit Detection para selecionar camada
        let clickedId = null;
        // Check de cima para baixo (ordem de render)
        for (let i = layers.length - 1; i >= 0; i--) {
            const ctx = layers[i].maskCanvas.getContext('2d')!;
            if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { clickedId = layers[i].id; break; }
        }
        
        if (clickedId) {
            setActiveLayerId(clickedId);
            isDragging.current = true;
            lastPos.current = { x: clientX, y: clientY };
            
            // Se o sync estiver desligado, puxa os dados da camada clicada para os controles
            if (!syncSettings) {
                const l = layers.find(lay => lay.id === clickedId);
                if (l) { 
                    setGlobalScale(l.scale); 
                    setGlobalRotation(l.rotation); 
                    setGlobalFlipX(l.flipX);
                    setGlobalFlipY(l.flipY);
                }
            }
        } else { 
            setActiveLayerId(null); 
        }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
    if (e.cancelable) e.preventDefault();

    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    
    // Delta em pixels do canvas (considerando o zoom CSS)
    const dxScreen = (clientX - lastPos.current.x) * (canvas.width / rect.width);
    const dyScreen = (clientY - lastPos.current.y) * (canvas.height / rect.height);
    
    const layer = layers.find(l => l.id === activeLayerId);
    
    if (layer) {
        // Ajusta o movimento baseado na rotação para ser intuitivo (arrastar pra direita sempre move a estampa pra direita visualmente)
        const angleRad = (layer.rotation * Math.PI) / 180;
        let dxLocal = dxScreen * Math.cos(angleRad) + dyScreen * Math.sin(angleRad);
        let dyLocal = -dxScreen * Math.sin(angleRad) + dyScreen * Math.cos(angleRad);
        
        // Ajusta se estiver espelhado
        if (layer.flipX) dxLocal = -dxLocal;
        if (layer.flipY) dyLocal = -dyLocal; // Correção para flip vertical

        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, offsetX: l.offsetX + dxLocal, offsetY: l.offsetY + dyLocal } : l));
    }
    lastPos.current = { x: clientX, y: clientY };
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
      
      {/* 1. WORKSPACE (TOP on Mobile, RIGHT on Desktop) */}
      <div className="order-1 md:order-2 flex-1 relative bg-[#e2e8f0] flex items-center justify-center overflow-hidden touch-none h-[50vh] md:h-full shrink-0">
           <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

           {!moldImage ? (
               <div className="text-center opacity-50 px-4">
                   <UploadCloud size={64} className="mx-auto mb-4 text-gray-400"/>
                   <h2 className="text-xl font-bold text-gray-500">Área de Trabalho</h2>
                   <p className="text-sm text-gray-400">Carregue um molde para começar</p>
               </div>
           ) : (
                <div 
                    className="relative shadow-2xl bg-white border-4 border-white rounded-lg overflow-hidden max-w-[95%] max-h-[90%]"
                    style={{ cursor: tool === 'WAND' ? 'crosshair' : (isDragging.current ? 'grabbing' : 'grab') }}
                >
                    <canvas 
                        ref={mainCanvasRef}
                        onMouseDown={handleCanvasClick}
                        onMouseMove={handleMove}
                        onMouseUp={() => isDragging.current = false}
                        onMouseLeave={() => isDragging.current = false}
                        onTouchStart={handleCanvasClick}
                        onTouchMove={handleMove}
                        onTouchEnd={() => isDragging.current = false}
                        className="block w-auto h-auto max-w-full max-h-[85vh] md:max-h-[85vh] object-contain"
                    />
                    {isProcessing && (
                         <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                             <div className="bg-vingi-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
                                 <Wand2 className="animate-spin" size={20}/><span className="font-bold tracking-wide">AUTO-FILL IA</span>
                             </div>
                         </div>
                    )}
                </div>
           )}
      </div>

      {/* 2. CONTROLS (BOTTOM on Mobile, LEFT on Desktop) */}
      <div className="order-2 md:order-1 w-full md:w-80 bg-white border-t md:border-t-0 md:border-r border-gray-200 flex flex-col shadow-2xl z-20 h-[50vh] md:h-full overflow-y-auto custom-scrollbar">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur">
              <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={20} /> Studio
              </h2>
              {activeLayerId && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10}/> CAMADA ATIVA</span>}
          </div>

          <div className="p-5 space-y-6 pb-24 md:pb-5">
              {/* ASSETS */}
              <div className="grid grid-cols-2 gap-3">
                  <div onClick={() => moldInputRef.current?.click()} className={`relative h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${moldImage ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                      <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                      {moldImage ? <img src={moldImage} className="w-full h-full object-contain p-1"/> : <UploadCloud className="text-gray-300"/>}
                      <span className="text-[9px] font-bold text-gray-400 mt-1">MOLDE</span>
                  </div>
                  <div onClick={() => patternInputRef.current?.click()} className={`relative h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${patternImage ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                      <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                      {patternImage ? <img src={patternImage} className="w-full h-full object-cover rounded-lg"/> : <ImageIcon className="text-gray-300"/>}
                      <span className="text-[9px] font-bold text-gray-400 mt-1">ESTAMPA</span>
                  </div>
              </div>

              {/* TOOLS */}
              <div className="space-y-3">
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setTool('WAND')} 
                        className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1 transition-all ${tool === 'WAND' ? 'border-vingi-600 bg-vingi-50 text-vingi-700 shadow-md' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}
                      >
                          <Zap size={16}/> SELECIONAR
                      </button>
                      <button 
                        onClick={() => setTool('MOVE')} 
                        className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1 transition-all ${tool === 'MOVE' ? 'border-vingi-600 bg-vingi-50 text-vingi-700 shadow-md' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}
                      >
                          <Move size={16}/> MOVER
                      </button>
                  </div>
                  
                  <button 
                    onClick={handleAutoFill}
                    disabled={!moldImage || !patternImage || isProcessing}
                    className="w-full py-2 bg-gradient-to-r from-vingi-600 to-vingi-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                  >
                      {isProcessing ? <Wand2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                      {isProcessing ? 'PROCESSANDO...' : 'PREENCHIMENTO INTELIGENTE (IA)'}
                  </button>
              </div>

              {/* ACTIVE LAYER CONTROLS */}
              <div className={`bg-white rounded-xl border-2 transition-all duration-300 ${activeLayerId ? 'border-blue-200 shadow-lg' : 'border-gray-100 opacity-50 pointer-events-none'}`}>
                   <div className="p-3 bg-blue-50/50 border-b border-blue-100 flex justify-between items-center">
                       <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2">
                           <Layers size={12}/> Camada Ativa
                       </h3>
                       <button onClick={() => setSyncSettings(!syncSettings)} className={`p-1 rounded ${syncSettings ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-gray-600'}`} title={syncSettings ? "Configurações sincronizadas em todas as camadas" : "Configuração Individual"}>
                           {syncSettings ? <Lock size={12}/> : <Unlock size={12}/>}
                       </button>
                   </div>

                   <div className="p-4 space-y-4">
                       {/* Scale */}
                       <div className="space-y-1">
                           <div className="flex justify-between text-[10px] font-bold text-gray-500"><span>ZOOM</span><span>{Math.round(globalScale * 100)}%</span></div>
                           <input type="range" min="0.1" max="2.5" step="0.05" value={globalScale} onChange={(e) => setGlobalScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600 cursor-pointer"/>
                       </div>

                       {/* Rotation */}
                       <div className="space-y-1">
                           <div className="flex justify-between text-[10px] font-bold text-gray-500"><span>ROTAÇÃO</span><span>{globalRotation}°</span></div>
                           <input type="range" min="0" max="360" step="1" value={globalRotation} onChange={(e) => setGlobalRotation(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600 cursor-pointer"/>
                       </div>

                       {/* Flip Actions */}
                       <div className="grid grid-cols-2 gap-2">
                           <button 
                             onClick={() => setGlobalFlipX(!globalFlipX)} 
                             className={`py-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-2 transition-colors ${globalFlipX ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                           >
                               <FlipHorizontal size={12} /> {globalFlipX ? 'ESPELHADO H' : 'FLIP HORIZ'}
                           </button>
                           <button 
                             onClick={() => setGlobalFlipY(!globalFlipY)} 
                             className={`py-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-2 transition-colors ${globalFlipY ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                           >
                               <FlipVertical size={12} /> {globalFlipY ? 'ESPELHADO V' : 'FLIP VERT'}
                           </button>
                       </div>
                       
                       <button onClick={() => setLayers([])} className="w-full py-2 bg-red-50 text-red-500 border border-red-100 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-red-100 mt-2">
                           <Eraser size={12}/> LIMPAR TUDO
                       </button>
                   </div>
              </div>

              <button onClick={handleDownload} className="w-full py-3 bg-vingi-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-transform active:scale-95">
                  <Download size={16}/> EXPORTAR MOCKUP
              </button>
          </div>
      </div>
    </div>
  );
};
