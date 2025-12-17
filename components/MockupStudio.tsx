
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Wand2, Download, Eraser, CheckCircle2, Shirt, Zap, Move, Lock, Unlock, FlipHorizontal, FlipVertical, Sparkles, Maximize, Ruler, PenTool, RotateCcw, RefreshCcw, ZoomIn, ZoomOut, Hand, MousePointerClick } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from './Shared';

interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement;
  maskX: number; maskY: number; maskW: number; maskH: number; maskCenter: { x: number, y: number };
  pattern: CanvasPattern | null;
  offsetX: number; offsetY: number; scale: number; rotation: number; flipX: boolean; flipY: boolean;
  timestamp?: number;
}

export const MockupStudio: React.FC = () => {
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<'WAND' | 'MOVE' | 'HAND'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // UI Controls for Active Layer
  const [activeScale, setActiveScale] = useState(0.5);
  const [activeRotation, setActiveRotation] = useState(0);
  const [activeFlipX, setActiveFlipX] = useState(false);
  const [activeFlipY, setActiveFlipY] = useState(false);

  // Viewport Zoom
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const isPanning = useRef(false);
  const lastDistRef = useRef<number>(0);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const checkStorage = () => {
        const stored = localStorage.getItem('vingi_mockup_pattern');
        if (stored) { setPatternImage(stored); localStorage.removeItem('vingi_mockup_pattern'); }
    };
    checkStorage();
    const handleTransfer = (e: any) => { if (e.detail?.module === 'MOCKUP') checkStorage(); };
    window.addEventListener('vingi_transfer', handleTransfer);
    return () => window.removeEventListener('vingi_transfer', handleTransfer);
  }, []);

  useEffect(() => {
    if (moldImage) {
      const img = new Image(); 
      img.src = moldImage; 
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (mainCanvasRef.current) {
            const canvas = mainCanvasRef.current;
            const MAX_DIM = 2500; // Increased resolution
            let w = img.naturalWidth; let h = img.naturalHeight;
            if (w > MAX_DIM || h > MAX_DIM) { const ratio = w / h; if (w > h) { w = MAX_DIM; h = MAX_DIM / ratio; } else { h = MAX_DIM; w = MAX_DIM * ratio; } }
            canvas.width = w; canvas.height = h;
            if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
            tempCanvasRef.current.width = w; tempCanvasRef.current.height = h;
            
            // Auto Fit View
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const k = Math.min(rect.width / w, rect.height / h) * 0.9;
                setView({ x: 0, y: 0, k });
            }
        }
        setMoldImgObj(img); 
        setLayers([]); 
        setActiveLayerId(null);
        // Force render
        requestAnimationFrame(render);
      };
    }
  }, [moldImage]);

  useEffect(() => { if (patternImage) { const img = new Image(); img.src = patternImage; img.crossOrigin = "anonymous"; img.onload = () => setPatternImgObj(img); } }, [patternImage]);

  useEffect(() => {
      if (activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) { setActiveScale(layer.scale); setActiveRotation(layer.rotation); setActiveFlipX(layer.flipX); setActiveFlipY(layer.flipY); }
      }
  }, [activeLayerId, layers]);

  const updateActiveLayer = (updater: (l: AppliedLayer) => Partial<AppliedLayer>) => {
      if (!activeLayerId) return;
      setLayers(prev => prev.map(l => { if (l.id === activeLayerId) return { ...l, ...updater(l) }; return l; }));
  };

  const handleFlipX = () => updateActiveLayer(l => ({ flipX: !l.flipX, offsetX: -l.offsetX })); 
  const handleFlipY = () => updateActiveLayer(l => ({ flipY: !l.flipY, offsetY: -l.offsetY }));
  const handleRotate = (val: number) => updateActiveLayer(l => ({ rotation: val }));
  const handleScale = (val: number) => updateActiveLayer(l => ({ scale: val }));
  const resetActiveLayer = () => updateActiveLayer(l => ({ scale: 0.5, rotation: 0, offsetX: 0, offsetY: 0, flipX: false, flipY: false }));

  const render = useCallback(() => {
    const canvas = mainCanvasRef.current; const tempCanvas = tempCanvasRef.current;
    if (!canvas || !moldImgObj || !tempCanvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!; const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    layers.forEach(layer => {
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(layer.maskCanvas, layer.maskX, layer.maskY);
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.save();
        tempCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        tempCtx.rotate((layer.rotation * Math.PI) / 180);
        tempCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        tempCtx.scale(layer.scale, layer.scale);
        tempCtx.translate(layer.offsetX, layer.offsetY);
        if (layer.pattern) { 
            tempCtx.fillStyle = layer.pattern; 
            const diag = Math.sqrt(layer.maskW**2 + layer.maskH**2); const safeSize = (diag * 1.5) / layer.scale; 
            tempCtx.fillRect(-safeSize, -safeSize, safeSize*2, safeSize*2); 
        }
        tempCtx.restore();
        ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(tempCanvas, 0, 0); ctx.restore();

        if (layer.id === activeLayerId) {
            ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath(); ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 10 / view.k, 0, Math.PI * 2); // Scale adjust dot
            ctx.fillStyle = '#3b82f6'; ctx.strokeStyle = 'white'; ctx.lineWidth = 3 / view.k; ctx.shadowBlur = 5; ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height); ctx.restore();
  }, [moldImgObj, layers, activeLayerId, view.k]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  const createMaskFromClick = (startX: number, startY: number) => {
      if (!mainCanvasRef.current || !moldImgObj) return null;
      const canvas = mainCanvasRef.current;
      const width = canvas.width; const height = canvas.height;
      const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
      const data = tCtx.getImageData(0, 0, width, height).data;
      const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
      
      const visited = new Uint8Array(width * height);
      const stack = [[Math.floor(startX), Math.floor(startY)]];
      const tol = tolerance;
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let pixelCount = 0;
      const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
      const validPixels: number[] = [];

      while (stack.length) {
          const [x, y] = stack.pop()!;
          const idx = y * width + x;
          if (visited[idx]) continue;
          visited[idx] = 1;
          const pPos = idx * 4;
          const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
          if (diff <= tol * 3) {
              validPixels.push(idx); pixelCount++;
              if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
              if (x > 0) stack.push([x-1, y]); if (x < width - 1) stack.push([x+1, y]); if (y > 0) stack.push([x, y-1]); if (y < height - 1) stack.push([x, y+1]);
          }
      }
      if (pixelCount < 50) return null;

      const maskW = maxX - minX + 1; const maskH = maxY - minY + 1;
      const maskCanvas = document.createElement('canvas'); maskCanvas.width = maskW; maskCanvas.height = maskH;
      const mCtx = maskCanvas.getContext('2d')!; const mImgData = mCtx.createImageData(maskW, maskH); const mData = mImgData.data;
      for (const globalIdx of validPixels) {
          const gx = globalIdx % width; const gy = Math.floor(globalIdx / width);
          const lx = gx - minX; const ly = gy - minY;
          const localIdx = (ly * maskW + lx) * 4;
          mData[localIdx] = 255; mData[localIdx+1] = 255; mData[localIdx+2] = 255; mData[localIdx+3] = 255;
      }
      mCtx.putImageData(mImgData, 0, 0);
      return { maskCanvas, minX, minY, maskW, maskH, centerX: minX + maskW / 2, centerY: minY + maskH / 2 };
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      
      return { x, y, clientX, clientY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      if (activeLayerId) e.preventDefault(); 
      const { x, y, clientX, clientY } = getCanvasCoords(e);
      lastPos.current = { x: clientX, y: clientY };

      if (tool === 'HAND' || ('buttons' in e && e.buttons === 4)) {
          isPanning.current = true;
          return;
      }

      if (tool === 'WAND') {
          const res = createMaskFromClick(x, y);
          if (res) {
              const tempP = document.createElement('canvas');
              const ctxP = tempP.getContext('2d')!;
              const pat = ctxP.createPattern(patternImgObj, 'repeat');
              const newLayer: AppliedLayer = {
                  id: Date.now().toString(), maskCanvas: res.maskCanvas, maskX: res.minX, maskY: res.minY, maskW: res.maskW, maskH: res.maskH, maskCenter: { x: res.centerX, y: res.centerY },
                  pattern: pat, offsetX: 0, offsetY: 0, scale: 0.5, rotation: 0, flipX: false, flipY: false, timestamp: Date.now()
              };
              setLayers(prev => [...prev, newLayer]); setActiveLayerId(newLayer.id); setTool('MOVE');
          }
      } else if (tool === 'MOVE') {
          let clickedId = null;
          for (let i = layers.length - 1; i >= 0; i--) {
              const l = layers[i];
              const dist = Math.sqrt((x - l.maskCenter.x)**2 + (y - l.maskCenter.y)**2);
              if (dist < 50 / view.k) { clickedId = l.id; break; } // Hit area scales with zoom
          }
          if (clickedId) { setActiveLayerId(clickedId); isDragging.current = true; } 
          else { setActiveLayerId(null); }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      const { clientX, clientY } = 'touches' in e ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY };
      
      // PANNING
      if (isPanning.current) {
          const dx = clientX - lastPos.current.x;
          const dy = clientY - lastPos.current.y;
          setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
          lastPos.current = { x: clientX, y: clientY };
          return;
      }

      if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
      if (e.cancelable) e.preventDefault();
      
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width; 
      const dxCanvas = (clientX - lastPos.current.x) * scale;
      const dyCanvas = (clientY - lastPos.current.y) * scale;
      
      updateActiveLayer(layer => {
          const angleRad = (layer.rotation * Math.PI) / 180;
          let dxLocal = dxCanvas * Math.cos(angleRad) + dyCanvas * Math.sin(angleRad);
          let dyLocal = -dxCanvas * Math.sin(angleRad) + dyCanvas * Math.cos(angleRad);
          if (layer.flipX) dxLocal = -dxLocal; if (layer.flipY) dyLocal = -dyLocal; 
          dxLocal /= layer.scale; dyLocal /= layer.scale;
          return { offsetX: layer.offsetX + dxLocal, offsetY: layer.offsetY + dyLocal };
      });
      lastPos.current = { x: clientX, y: clientY };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
          lastDistRef.current = dist;
      } else {
          // Pass single touch to pointer down
          handlePointerDown(e);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
          const scale = dist / lastDistRef.current;
          setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * scale), 5) }));
          lastDistRef.current = dist;
      } else {
          handlePointerMove(e);
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || tool === 'HAND') {
          e.preventDefault();
          const s = Math.exp(-e.deltaY * 0.001);
          setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * s), 8) }));
      }
  };

  const handleDownload = () => {
    if (!mainCanvasRef.current) return;
    const link = document.createElement('a'); link.download = 'vingi-mockup.png'; link.href = mainCanvasRef.current.toDataURL('image/png', 1.0); link.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f0f2f5] overflow-hidden">
      <ModuleHeader icon={Shirt} title="Aplicação em Corte" subtitle="Engenharia Técnica 2D" actionLabel={moldImage ? "Novo Projeto" : undefined} onAction={() => { setMoldImage(null); setLayers([]); }} />

      {!moldImage ? (
          <div className="flex-1 overflow-y-auto">
              <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
              <ModuleLandingPage icon={Shirt} title="Mockup Técnico" description="Ferramenta de engenharia para aplicação de estampas em moldes de corte." primaryActionLabel="Carregar Molde/Peça" onPrimaryAction={() => moldInputRef.current?.click()} features={["Preenchimento Inteligente", "Controle de Fio", "Escala Real", "Espelhamento"]} />
          </div>
      ) : (
          // MAIN LAYOUT FIX: FLEX COLUMN to keep Toolbar Visible
          <div className="flex-1 flex flex-col relative h-full">
              {/* CANVAS AREA (Takes remaining space) */}
              <div 
                ref={containerRef} 
                className={`flex-1 bg-gray-100 relative flex items-center justify-center overflow-hidden touch-none ${tool==='HAND'?'cursor-grab active:cursor-grabbing':'cursor-crosshair'}`} 
                onWheel={handleWheel}
                onTouchStart={handleTouchStart} 
                onTouchMove={handleTouchMove}
              >
                  <div 
                      className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" 
                      style={{ 
                          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                          width: moldImgObj ? moldImgObj.width : 'auto',
                          height: moldImgObj ? moldImgObj.height : 'auto'
                      }}
                  >
                      <canvas 
                        ref={mainCanvasRef} 
                        onMouseDown={handlePointerDown} 
                        onMouseMove={handlePointerMove} 
                        onMouseUp={() => { isDragging.current = false; isPanning.current = false; }} 
                        onMouseLeave={() => { isDragging.current = false; isPanning.current = false; }}
                        className="block bg-white" 
                      />
                  </div>

                  {!patternImage && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm z-50">
                          <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                              <h3 className="text-xl font-bold mb-4">Selecione a Estampa</h3>
                              <button onClick={() => patternInputRef.current?.click()} className="w-full py-3 bg-vingi-900 text-white rounded-xl font-bold shadow-lg hover:bg-vingi-800 flex items-center justify-center gap-2"><UploadCloud size={20}/> Carregar Arquivo</button>
                              <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                          </div>
                      </div>
                  )}
                  
                  {/* INSTRUCTION OVERLAY IF PATTERN IS READY BUT NO LAYER */}
                  {patternImage && layers.length === 0 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-vingi-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-xl animate-bounce z-50 flex items-center gap-2 pointer-events-none">
                          <MousePointerClick size={16}/> Toque na peça para aplicar
                      </div>
                  )}

                  {/* ZOOM CONTROLS OVERLAY */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-md p-1 z-30">
                      <button onClick={()=>setView(v=>({...v, k: Math.min(v.k*1.2, 8)}))} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={18}/></button>
                      <button onClick={()=>setView(v=>({...v, k: Math.max(v.k*0.8, 0.1)}))} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={18}/></button>
                      <button onClick={()=>{ if(containerRef.current && moldImgObj) { const rect = containerRef.current.getBoundingClientRect(); setView({x:0, y:0, k: Math.min(rect.width/moldImgObj.width, rect.height/moldImgObj.height)*0.9}); } }} className="p-2 hover:bg-gray-100 rounded text-gray-600"><RotateCcw size={18}/></button>
                  </div>
              </div>

              {/* EDITOR TOOLBAR (FIXED BOTTOM - Shrink-0 prevents crushing) */}
              <div className="shrink-0 bg-white border-t border-gray-200 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-40 flex flex-col pb-safe">
                  {/* TOOLS SELECTOR */}
                  <div className="flex items-center justify-between p-2 border-b border-gray-100 overflow-x-auto gap-4 px-4">
                      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 shrink-0">
                          <button onClick={() => setTool('HAND')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${tool==='HAND' ? 'bg-white shadow text-vingi-600' : 'text-gray-500'}`}><Hand size={16}/> MOVER</button>
                          <button onClick={() => setTool('WAND')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${tool==='WAND' ? 'bg-white shadow text-vingi-600' : 'text-gray-500'}`}><Wand2 size={16}/> MÁGICA</button>
                          <button onClick={() => setTool('MOVE')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${tool==='MOVE' ? 'bg-white shadow text-vingi-600' : 'text-gray-500'}`}><Move size={16}/> EDITAR</button>
                      </div>
                      <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-vingi-900 text-white rounded-lg text-xs font-bold shadow-md hover:bg-vingi-800 shrink-0"><Download size={16}/> Exportar</button>
                  </div>

                  {/* ACTIVE LAYER CONTROLS (Only visible when layer active) */}
                  {activeLayerId && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 items-center bg-gray-50 animate-fade-in border-b border-gray-200">
                          <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Rotação ({activeRotation}°)</label>
                              <input type="range" min="0" max="360" value={activeRotation} onChange={(e) => handleRotate(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                          </div>
                          <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Escala ({Math.round(activeScale * 100)}%)</label>
                              <input type="range" min="0.1" max="3" step="0.1" value={activeScale} onChange={(e) => handleScale(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={handleFlipX} className={`flex-1 py-2 border rounded-lg flex items-center justify-center ${activeFlipX ? 'bg-vingi-200 border-vingi-300' : 'bg-white border-gray-300'}`} title="Espelhar H"><FlipHorizontal size={18}/></button>
                              <button onClick={handleFlipY} className={`flex-1 py-2 border rounded-lg flex items-center justify-center ${activeFlipY ? 'bg-vingi-200 border-vingi-300' : 'bg-white border-gray-300'}`} title="Espelhar V"><FlipVertical size={18}/></button>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={resetActiveLayer} className="flex-1 py-2 border border-gray-300 bg-white rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-1"><RefreshCcw size={14}/> Reset</button>
                              <button onClick={() => { setLayers(l => l.filter(x => x.id !== activeLayerId)); setActiveLayerId(null); }} className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center justify-center gap-1"><Eraser size={14}/> Del</button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
