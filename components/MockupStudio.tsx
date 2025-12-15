
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Wand2, Download, Eraser, CheckCircle2, Shirt, Zap, Move, Lock, Unlock, FlipHorizontal, FlipVertical, Sparkles, Maximize } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from './Shared';

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
  // State
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // Settings
  const [globalScale, setGlobalScale] = useState(0.5); 
  const [globalRotation, setGlobalRotation] = useState(0);
  const [globalFlipX, setGlobalFlipX] = useState(false);
  const [globalFlipY, setGlobalFlipY] = useState(false);
  const [syncSettings, setSyncSettings] = useState(true); 
  const [isProcessing, setIsProcessing] = useState(false);

  // Viewport
  const [viewTransform, setViewTransform] = useState({ k: 1, x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isPinching, setIsPinching] = useState(false);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number>(0);
  const lastPinchCenter = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // --- TRANSFER LISTENER ---
  useEffect(() => {
    // Check on mount
    const checkStorage = () => {
        const stored = localStorage.getItem('vingi_mockup_pattern');
        if (stored) {
            setPatternImage(stored);
            localStorage.removeItem('vingi_mockup_pattern'); // Consume
        }
    };
    checkStorage();

    // Listen for live events
    const handleTransfer = (e: any) => {
        if (e.detail?.module === 'MOCKUP') checkStorage();
    };
    window.addEventListener('vingi_transfer', handleTransfer);
    return () => window.removeEventListener('vingi_transfer', handleTransfer);
  }, []);

  useEffect(() => {
    if (moldImage) {
      const img = new Image();
      img.src = moldImage;
      img.onload = () => {
        if (mainCanvasRef.current) {
            const canvas = mainCanvasRef.current;
            const MAX_DIM = 2500; 
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = w / h;
                if (w > h) { w = MAX_DIM; h = MAX_DIM / ratio; } 
                else { h = MAX_DIM; w = MAX_DIM * ratio; }
            }
            canvas.width = w; canvas.height = h;
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

  // Sync Settings
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

  // Render Loop
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !moldImgObj) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    // Draw Layers
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
        ctx.globalAlpha = 0.9; // Realism
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
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    });

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [moldImgObj, layers, activeLayerId]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  // Interaction Logic (Same as before, simplified for brevity)
  const createMaskFromClick = (startX: number, startY: number) => {
      // (Keep existing flood fill logic)
      if (!mainCanvasRef.current || !moldImgObj) return null;
      const canvas = mainCanvasRef.current;
      const width = canvas.width; const height = canvas.height;
      const tempC = document.createElement('canvas'); tempC.width = width; tempC.height = height;
      const tCtx = tempC.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
      const data = tCtx.getImageData(0, 0, width, height).data;
      const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
      if (data[startPos] < 40 && data[startPos+1] < 40 && data[startPos+2] < 40) return null;

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
                  if (Math.abs(data[lp]-r0)+Math.abs(data[lp+1]-g0)+Math.abs(data[lp+2]-b0) <= tol*3 && !visited[py*width+(x-1)]) { if (!reachL) { stack.push([x-1, py]); reachL = true; } } else if (reachL) reachL = false;
              }
              if (x < width-1) {
                  const rp = pPos + 4;
                  if (Math.abs(data[rp]-r0)+Math.abs(data[rp+1]-g0)+Math.abs(data[rp+2]-b0) <= tol*3 && !visited[py*width+(x+1)]) { if (!reachR) { stack.push([x+1, py]); reachR = true; } } else if (reachR) reachR = false;
              }
              py++; pPos += width*4;
          }
      }
      if (pixelCount < 50) return null;
      const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
      maskCanvas.getContext('2d')!.putImageData(new ImageData(maskData, width, height), 0, 0);
      return { maskCanvas, centerX: minX + (maxX - minX) / 2, centerY: minY + (maxY - minY) / 2 };
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      const { x: clientX, y: clientY } = getCoords(e);
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
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
              if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { clickedId = layers[i].id; break; }
          }
          if (clickedId) {
              setActiveLayerId(clickedId);
              isDragging.current = true;
              lastPos.current = { x: clientX, y: clientY };
          } else setActiveLayerId(null);
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
      if (e.cancelable && e.nativeEvent) e.preventDefault();
      const { x: clientX, y: clientY } = getCoords(e);
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const dxCanvas = (clientX - lastPos.current.x) * (canvas.width / rect.width);
      const dyCanvas = (clientY - lastPos.current.y) * (canvas.height / rect.height);
      const layer = layers.find(l => l.id === activeLayerId);
      if (layer) {
          const angleRad = (layer.rotation * Math.PI) / 180;
          let dxLocal = dxCanvas * Math.cos(angleRad) + dyCanvas * Math.sin(angleRad);
          let dyLocal = -dxCanvas * Math.sin(angleRad) + dyCanvas * Math.cos(angleRad);
          if (layer.flipX) dxLocal = -dxLocal;
          if (layer.flipY) dyLocal = -dyLocal; 
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

  return (
    <div className="flex flex-col h-full w-full bg-[#f0f2f5] overflow-hidden">
      <ModuleHeader 
          icon={Shirt} 
          title="Provador Virtual" 
          subtitle="Simulação Física de Caimento"
          referenceImage={patternImage}
          actionLabel={patternImage ? "Trocar Estampa" : undefined}
          onAction={() => setPatternImage(null)}
      />

      {/* CONDITIONAL RENDER: EMPTY VS WORKSPACE */}
      {!moldImage ? (
          <div className="flex-1 overflow-y-auto">
              <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
              <ModuleLandingPage 
                  icon={Shirt}
                  title="Provador Virtual"
                  description="Aplique estampas em moldes reais instantaneamente. A simulação física respeita sombras e dobras para um resultado ultra-realista."
                  primaryActionLabel="Carregar Molde (Base)"
                  onPrimaryAction={() => moldInputRef.current?.click()}
                  features={["Warping", "Shadow Match", "3D Drape", "Export"]}
                  secondaryAction={
                      <div className="h-full flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-4">
                              <span className="w-2 h-2 rounded-full bg-vingi-500"></span>
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dica Profissional</h3>
                          </div>
                          <div className="space-y-4">
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                  <h4 className="text-sm font-bold text-gray-800 mb-1">Base de Contraste</h4>
                                  <p className="text-xs text-gray-500">Prefira fotos de bases brancas ou cinzas para preservar as sombras originais.</p>
                              </div>
                              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-left">
                                  <h4 className="text-sm font-bold text-gray-800 mb-1">Mistura Realista</h4>
                                  <p className="text-xs text-gray-500">O modo 'Multiply' é aplicado automaticamente para integrar a estampa ao tecido.</p>
                              </div>
                          </div>
                      </div>
                  }
              />
          </div>
      ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* WORKSPACE */}
            <div className="order-1 md:order-2 flex-1 relative bg-gray-200/50 flex items-center justify-center overflow-hidden touch-none h-[65vh] md:h-full">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                
                <div 
                    ref={viewportRef}
                    className="relative w-full h-full flex items-center justify-center p-0 md:p-8 overflow-hidden"
                >
                    <div style={{ transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`, transition: 'transform 0.1s ease-out', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <canvas 
                            ref={mainCanvasRef}
                            onMouseDown={handlePointerDown}
                            onMouseMove={handlePointerMove}
                            onMouseUp={() => isDragging.current = false}
                            onTouchStart={handlePointerDown}
                            onTouchMove={handlePointerMove}
                            onTouchEnd={() => isDragging.current = false}
                            className="block max-w-full max-h-full object-contain shadow-2xl bg-white"
                            style={{ cursor: tool === 'WAND' ? 'crosshair' : (isDragging.current ? 'grabbing' : 'grab') }}
                        />
                    </div>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="order-2 md:order-1 w-full md:w-80 bg-white border-t md:border-t-0 md:border-r border-gray-200 flex flex-col shadow-2xl z-20 h-[35vh] md:h-full overflow-y-auto custom-scrollbar">
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                <p className="text-[10px] text-vingi-700">
                    <strong>Como usar:</strong> 1. Carregue molde e estampa. 2. Use a Varinha para clicar nas partes do molde. 3. Ajuste escala e rotação.
                </p>
                </div>

                <div className="p-4 space-y-4 pb-20">
                    <div className="grid grid-cols-2 gap-2">
                        <div onClick={() => moldInputRef.current?.click()} className={`relative h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${moldImage ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                            <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                            {moldImage ? <img src={moldImage} className="w-full h-full object-contain p-1"/> : <UploadCloud size={20} className="text-gray-300"/>}
                            <span className="text-[9px] font-bold text-gray-500 mt-1">BASE/MOLDE</span>
                        </div>
                        <div onClick={() => patternInputRef.current?.click()} className={`relative h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${patternImage ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                            <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                            {patternImage ? <img src={patternImage} className="w-full h-full object-cover rounded-lg"/> : <ImageIcon size={20} className="text-gray-300"/>}
                            <span className="text-[9px] font-bold text-gray-500 mt-1">ESTAMPA</span>
                        </div>
                    </div>

                    <div className="flex gap-2 bg-gray-50 p-1 rounded-lg">
                        <button onClick={() => setTool('WAND')} className={`flex-1 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${tool === 'WAND' ? 'bg-white shadow text-vingi-700' : 'text-gray-400'}`}><Zap size={14}/> SELECIONAR</button>
                        <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 ${tool === 'MOVE' ? 'bg-white shadow text-vingi-700' : 'text-gray-400'}`}><Move size={14}/> MOVER</button>
                    </div>

                    <div className={`space-y-3 ${activeLayerId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase">Propriedades</h4>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 w-8">ESC</span>
                            <input type="range" min="0.1" max="2.5" step="0.05" value={globalScale} onChange={(e) => setGlobalScale(parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 w-8">ROT</span>
                            <input type="range" min="0" max="360" step="1" value={globalRotation} onChange={(e) => setGlobalRotation(parseInt(e.target.value))} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setGlobalFlipX(!globalFlipX)} className={`py-1.5 rounded border text-[9px] font-bold flex justify-center gap-1 ${globalFlipX ? 'bg-gray-800 text-white' : 'text-gray-500'}`}><FlipHorizontal size={12} /> Espelhar H</button>
                            <button onClick={() => setGlobalFlipY(!globalFlipY)} className={`py-1.5 rounded border text-[9px] font-bold flex justify-center gap-1 ${globalFlipY ? 'bg-gray-800 text-white' : 'text-gray-500'}`}><FlipVertical size={12} /> Espelhar V</button>
                        </div>
                    </div>
                    </div>

                    <button onClick={handleDownload} className="w-full py-3 bg-vingi-900 text-white font-bold rounded-xl text-xs shadow-lg flex items-center justify-center gap-2 mt-4">
                        <Download size={14}/> EXPORTAR MOCKUP
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
