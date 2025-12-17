
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Wand2, Download, Eraser, Shirt, Move, FlipHorizontal, FlipVertical, RotateCcw, ZoomIn, ZoomOut, Hand, MousePointerClick, RefreshCw, Layers, CopyCheck, Undo2, Redo2, Sliders, Check, X, BoxSelect, Grip, Maximize2, Grid } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from './Shared';

interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement;
  maskX: number; maskY: number; maskW: number; maskH: number; maskCenter: { x: number, y: number };
  pattern: CanvasPattern | null;
  patternSrc?: string; // Store source for UI feedback
  offsetX: number; offsetY: number; scale: number; rotation: number; flipX: boolean; flipY: boolean;
  timestamp?: number;
}

export const MockupStudio: React.FC = () => {
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  // State & History
  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [history, setHistory] = useState<AppliedLayer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  
  // Tools: 'WAND' (Fill), 'ADJUST' (Scale/Rot/Mode), 'HAND' (View)
  const [activeTool, setActiveTool] = useState<'WAND' | 'ADJUST' | 'HAND'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // Global Modifiers
  const [editAll, setEditAll] = useState(true);
  
  // Active Adjustment Values
  const [activeScale, setActiveScale] = useState(0.5);
  const [activeRotation, setActiveRotation] = useState(0);

  // Viewport
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

  // --- HISTORY MANAGEMENT ---
  const saveToHistory = (newLayers: AppliedLayer[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newLayers);
      if (newHistory.length > 20) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setLayers(newLayers);
  };

  const undo = () => {
      if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          setLayers(history[prevIndex]);
      } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setLayers([]);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setLayers(history[nextIndex]);
      }
  };

  // --- INIT ---
  useEffect(() => {
    const checkStorage = () => {
        const stored = localStorage.getItem('vingi_mockup_pattern');
        if (stored) { setPatternImage(stored); localStorage.removeItem('vingi_mockup_pattern'); }
    };
    checkStorage();
    window.addEventListener('vingi_transfer', (e: any) => { if (e.detail?.module === 'MOCKUP') checkStorage(); });
  }, []);

  useEffect(() => {
    if (moldImage) {
      const img = new Image(); 
      img.src = moldImage; 
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setMoldImgObj(img);
        setLayers([]); 
        setHistory([]);
        setHistoryIndex(-1);
        
        // Auto Fit
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setTimeout(() => {
                const k = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight) * 0.9;
                setView({ x: 0, y: 0, k: k || 0.5 });
            }, 50);
        }
        
        if (mainCanvasRef.current) { mainCanvasRef.current.width = img.naturalWidth; mainCanvasRef.current.height = img.naturalHeight; }
        if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
        tempCanvasRef.current.width = img.naturalWidth; tempCanvasRef.current.height = img.naturalHeight;
      };
    }
  }, [moldImage]);

  useEffect(() => { if (patternImage) { const img = new Image(); img.src = patternImage; img.crossOrigin = "anonymous"; img.onload = () => setPatternImgObj(img); } }, [patternImage]);

  // Sync UI with selection
  useEffect(() => {
      if (activeLayerId && !editAll) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) { setActiveScale(layer.scale); setActiveRotation(layer.rotation); }
      }
  }, [activeLayerId, editAll, layers]); 

  // --- ACTIONS ---
  const updateTargetLayers = (updater: (l: AppliedLayer) => Partial<AppliedLayer>, saveToHistoryFlag = false) => {
      if (layers.length === 0) return;
      const newLayers = layers.map(l => { 
          if (editAll || l.id === activeLayerId) { return { ...l, ...updater(l) }; }
          return l; 
      });
      setLayers(newLayers);
      if (saveToHistoryFlag) saveToHistory(newLayers);
  };

  const handleFlipX = () => updateTargetLayers(l => ({ flipX: !l.flipX, offsetX: -l.offsetX }), true);
  const handleFlipY = () => updateTargetLayers(l => ({ flipY: !l.flipY, offsetY: -l.offsetY }), true);
  
  const handleRotate = (val: number, commit = false) => {
      setActiveRotation(val);
      updateTargetLayers(l => ({ rotation: val }), commit);
  };

  const handleScale = (val: number, commit = false) => {
      setActiveScale(val);
      updateTargetLayers(l => ({ scale: val }), commit);
  };

  const handleModeSwitch = (mode: 'ALL' | 'SINGLE') => {
      setEditAll(mode === 'ALL');
      if (mode === 'ALL') setActiveLayerId(null);
  };

  // --- RENDERER (FIXED) ---
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current; 
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !moldImgObj || !tempCanvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!; 
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

    // 1. Draw Base Mold
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    // 2. Draw Layers
    layers.forEach(layer => {
        tempCtx.globalCompositeOperation = 'source-over'; 
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw Mask
        tempCtx.drawImage(layer.maskCanvas, layer.maskX, layer.maskY);
        
        // Clip Pattern to Mask
        tempCtx.globalCompositeOperation = 'source-in';
        
        tempCtx.save();
        tempCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        tempCtx.rotate((layer.rotation * Math.PI) / 180);
        tempCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        tempCtx.scale(layer.scale, layer.scale);
        tempCtx.translate(layer.offsetX, layer.offsetY);
        
        if (layer.pattern) { 
            tempCtx.fillStyle = layer.pattern; 
            const diag = Math.sqrt(layer.maskW**2 + layer.maskH**2); 
            const safeSize = (diag * 2) / layer.scale; 
            tempCtx.fillRect(-safeSize, -safeSize, safeSize*2, safeSize*2); 
        }
        tempCtx.restore();
        
        // Composite to Main
        ctx.save(); 
        ctx.globalAlpha = 0.95; 
        ctx.drawImage(tempCanvas, 0, 0); 
        ctx.restore();

        // Active Highlight
        if (layer.id === activeLayerId || (editAll && activeLayerId)) {
            ctx.save(); 
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
            ctx.beginPath(); 
            ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 6 / view.k, 0, Math.PI * 2); 
            ctx.fillStyle = editAll ? '#8b5cf6' : '#3b82f6'; 
            ctx.strokeStyle = 'white'; 
            ctx.lineWidth = 2 / view.k; 
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    });

    // 3. Multiply Shadows
    ctx.save(); 
    ctx.globalCompositeOperation = 'multiply'; 
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height); 
    ctx.restore();

  }, [moldImgObj, layers, activeLayerId, editAll, view.k]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  // --- INTERACTION & ZOOM LOGIC ---
  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || activeTool === 'HAND') { 
          e.preventDefault();
          const rect = containerRef.current!.getBoundingClientRect();
          // Calculate mouse pos relative to canvas view
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          const s = Math.exp(-e.deltaY * 0.001);
          const newK = Math.min(Math.max(0.1, view.k * s), 8);
          
          // Zoom towards mouse pointer
          const dx = (mouseX - view.x) * (newK / view.k - 1);
          const dy = (mouseY - view.y) * (newK / view.k - 1);

          setView({ k: newK, x: view.x - dx, y: view.y - dy });
      }
  };

  const createMaskFromClick = (startX: number, startY: number) => {
      if (!mainCanvasRef.current || !moldImgObj) return null;
      const width = mainCanvasRef.current.width; const height = mainCanvasRef.current.height;
      const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
      const data = tCtx.getImageData(0, 0, width, height).data;
      const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
      const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
      const visited = new Uint8Array(width * height);
      const stack = [[Math.floor(startX), Math.floor(startY)]];
      const tol = tolerance;
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let pixelCount = 0;
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
              if (x > 0) stack.push([x-1, y]); if (x < width - 1) stack.push([x+1, y]); 
              if (y > 0) stack.push([x, y-1]); if (y < height - 1) stack.push([x, y+1]);
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

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      
      lastPos.current = { x: clientX, y: clientY };

      if (activeTool === 'HAND' || ('buttons' in e && e.buttons === 4)) {
          isPanning.current = true;
          return;
      }

      if (activeTool === 'WAND') {
          const res = createMaskFromClick(x, y);
          if (res) {
              const tempP = document.createElement('canvas'); const ctxP = tempP.getContext('2d')!;
              const pat = ctxP.createPattern(patternImgObj, 'repeat');
              const newLayer: AppliedLayer = {
                  id: Date.now().toString(), maskCanvas: res.maskCanvas, 
                  maskX: res.minX, maskY: res.minY, maskW: res.maskW, maskH: res.maskH, maskCenter: { x: res.centerX, y: res.centerY },
                  pattern: pat, patternSrc: patternImage!, offsetX: 0, offsetY: 0, 
                  scale: activeScale, rotation: activeRotation, flipX: false, flipY: false, timestamp: Date.now()
              };
              const nextLayers = [...layers, newLayer];
              saveToHistory(nextLayers);
              // Auto-select the newly created layer and switch to Single Edit mode implicitly for UX
              setActiveLayerId(newLayer.id); 
              setEditAll(false); 
          }
      } else if (activeTool === 'ADJUST') {
          let clickedId = null;
          for (let i = layers.length - 1; i >= 0; i--) {
              const l = layers[i];
              if (Math.sqrt((x - l.maskCenter.x)**2 + (y - l.maskCenter.y)**2) < 50 / view.k) { clickedId = l.id; break; }
          }
          if (clickedId) { 
              setActiveLayerId(clickedId); 
              setEditAll(false); // Implicitly switch to single edit when clicking an object
              isDragging.current = true; 
          } else {
              // Clicked empty space? Deselect or switch to Global?
              // setActiveLayerId(null); 
              // setEditAll(true); 
          }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      const { clientX, clientY } = 'touches' in e ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY };
      if (isPanning.current) {
          const dx = clientX - lastPos.current.x; const dy = clientY - lastPos.current.y;
          setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
          lastPos.current = { x: clientX, y: clientY };
          return;
      }
      if (isDragging.current && activeTool === 'ADJUST' && activeLayerId) {
          const canvas = mainCanvasRef.current!; const rect = canvas.getBoundingClientRect();
          const scale = canvas.width / rect.width; 
          const dxCanvas = (clientX - lastPos.current.x) * scale;
          const dyCanvas = (clientY - lastPos.current.y) * scale;
          updateTargetLayers(l => {
              const rad = (l.rotation * Math.PI) / 180;
              let dx = dxCanvas * Math.cos(rad) + dyCanvas * Math.sin(rad);
              let dy = -dxCanvas * Math.sin(rad) + dyCanvas * Math.cos(rad);
              if(l.flipX) dx = -dx; if(l.flipY) dy = -dy;
              return { offsetX: l.offsetX + dx/l.scale, offsetY: l.offsetY + dy/l.scale };
          });
          lastPos.current = { x: clientX, y: clientY };
      }
  };

  const handleDownload = () => {
    if (!mainCanvasRef.current) return;
    const link = document.createElement('a'); link.download = 'vingi-mockup.png'; link.href = mainCanvasRef.current.toDataURL('image/png', 1.0); link.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#000000] overflow-hidden text-white">
      {/* HEADER COMPACTO */}
      <div className="bg-[#111111] px-4 py-2 flex items-center justify-between border-b border-gray-900 shrink-0 z-50 h-14">
          <div className="flex items-center gap-2"><Shirt size={18} className="text-vingi-400"/><span className="font-bold text-sm">Mockup Studio</span></div>
          <div className="flex gap-2">
              <button onClick={() => { setMoldImage(null); setLayers([]); }} className="text-[10px] bg-gray-800 px-3 py-1.5 rounded hover:bg-gray-700 font-medium">Novo</button>
              <button onClick={handleDownload} className="text-[10px] bg-vingi-600 text-white px-3 py-1.5 rounded font-bold hover:bg-vingi-500 flex items-center gap-1"><Download size={12}/> Salvar</button>
          </div>
      </div>

      {!moldImage ? (
          <div className="flex-1 bg-[#f0f2f5] overflow-y-auto">
              <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
              <ModuleLandingPage icon={Shirt} title="Mockup Técnico" description="Aplicação de estampas em moldes de corte." primaryActionLabel="Carregar Molde" onPrimaryAction={() => moldInputRef.current?.click()} />
          </div>
      ) : (
          <div className="flex-1 flex flex-col relative min-h-0 bg-[#050505]">
              {/* CANVAS */}
              <div 
                ref={containerRef} 
                className={`flex-1 relative flex items-center justify-center overflow-hidden touch-none ${activeTool==='HAND'?'cursor-grab active:cursor-grabbing': activeTool==='WAND' ? 'cursor-cell' : 'cursor-default'}`} 
                onWheel={handleWheel}
                onTouchStart={(e) => { if(e.touches.length===2) { e.preventDefault(); lastDistRef.current=Math.sqrt((e.touches[0].clientX-e.touches[1].clientX)**2+(e.touches[0].clientY-e.touches[1].clientY)**2); } else handlePointerDown(e); }} 
                onTouchMove={(e) => { if(e.touches.length===2) { e.preventDefault(); const d=Math.sqrt((e.touches[0].clientX-e.touches[1].clientX)**2+(e.touches[0].clientY-e.touches[1].clientY)**2); setView(v=>({...v, k:Math.min(Math.max(0.1,v.k*(d/lastDistRef.current)),8)})); lastDistRef.current=d; } else handlePointerMove(e); }}
                onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={() => { isDragging.current=false; isPanning.current=false; }}
              >
                  <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: moldImgObj ? moldImgObj.width : 'auto', height: moldImgObj ? moldImgObj.height : 'auto' }}>
                      <canvas ref={mainCanvasRef} className="block bg-white" />
                  </div>

                  {/* ACTIVE PATTERN INDICATOR */}
                  {patternImage && (
                      <div className="absolute top-4 left-4 z-30 animate-fade-in group">
                          <div className="relative w-12 h-12 rounded-full border-2 border-white/20 shadow-lg overflow-hidden cursor-pointer hover:scale-110 transition-transform bg-black" onClick={() => patternInputRef.current?.click()}>
                              <img src={patternImage} className="w-full h-full object-cover opacity-80" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <RefreshCw size={14} className="text-white"/>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* PATTERN SELECTOR (IF EMPTY) */}
                  {!patternImage && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-40 backdrop-blur-sm">
                          <button onClick={() => patternInputRef.current?.click()} className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform"><UploadCloud size={20}/> Selecionar Estampa</button>
                      </div>
                  )}
                  <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
              </div>

              {/* --- INSHOT STYLE TOOLBAR --- */}
              {/* STATUS BAR: SINGLE VS ALL MODE (PERSISTENT & CLEAR) */}
              <div className="bg-black/95 backdrop-blur-sm px-4 py-2 flex justify-center items-center shrink-0 z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
                  <div className="bg-gray-900 rounded-full p-0.5 flex items-center border border-gray-800">
                      <button 
                          onClick={() => handleModeSwitch('ALL')} 
                          className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${editAll ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                          <Grid size={10} /> Todos
                      </button>
                      <button 
                          onClick={() => handleModeSwitch('SINGLE')}
                          className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase transition-all flex items-center gap-1 ${!editAll ? 'bg-vingi-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                          <BoxSelect size={10} /> Seleção {activeLayerId ? '' : '(Clique no molde)'}
                      </button>
                  </div>
              </div>

              {/* SLIDERS CONTEXTUAL PANEL */}
              {activeTool === 'ADJUST' && (
                  <div className="bg-black px-6 py-4 flex flex-col gap-4 animate-slide-up shrink-0 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.8)] border-t border-white/5">
                      <div className="flex gap-6">
                          <div className="space-y-1 flex-1">
                              <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase"><span>Escala</span><span>{Math.round(activeScale*100)}%</span></div>
                              <input type="range" min="0.1" max="3" step="0.1" value={activeScale} onChange={(e) => handleScale(parseFloat(e.target.value))} onMouseUp={(e) => handleScale(parseFloat((e.target as HTMLInputElement).value), true)} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white cursor-pointer"/>
                          </div>
                          <div className="space-y-1 flex-1">
                              <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase"><span>Rotação</span><span>{activeRotation}°</span></div>
                              <input type="range" min="0" max="360" value={activeRotation} onChange={(e) => handleRotate(parseInt(e.target.value))} onMouseUp={(e) => handleRotate(parseInt((e.target as HTMLInputElement).value), true)} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-white cursor-pointer"/>
                          </div>
                      </div>
                  </div>
              )}

              {/* BOTTOM DOCK (INSHOT STYLE) - COMPACT & DARK */}
              <div className="bg-black flex flex-col shrink-0 z-50 pb-[env(safe-area-inset-bottom)] border-t border-white/5">
                  <div className="w-full overflow-hidden relative">
                      <div className="flex items-center justify-between px-4 py-2 overflow-x-auto w-full no-scrollbar gap-4" 
                           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
                          <style>{`.no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; }`}</style>
                          
                          <ToolBtn icon={Wand2} label="Preencher" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                          <ToolBtn icon={Sliders} label="Ajustar" active={activeTool==='ADJUST'} onClick={() => setActiveTool('ADJUST')} />
                          <ToolBtn icon={Hand} label="Mover Tela" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                          
                          <div className="w-px h-6 bg-gray-800 shrink-0 mx-1"></div>

                          <ToolBtn icon={FlipHorizontal} label="Espelhar H" onClick={handleFlipX} />
                          <ToolBtn icon={FlipVertical} label="Espelhar V" onClick={handleFlipY} />
                          <ToolBtn icon={RotateCcw} label="Girar +90" onClick={() => handleRotate((activeRotation + 90) % 360, true)} />
                          <ToolBtn icon={RefreshCw} label="Estampa" onClick={() => patternInputRef.current?.click()} />

                          <div className="w-px h-6 bg-gray-800 shrink-0 mx-1"></div>

                          <ToolBtn icon={Undo2} label="Desfazer" onClick={undo} disabled={historyIndex <= -1} />
                          <ToolBtn icon={Eraser} label="Apagar" onClick={() => { const newL = layers.filter(x => x.id !== activeLayerId); saveToHistory(newL); setActiveLayerId(null); }} disabled={!activeLayerId} danger />
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled, highlight, danger }: any) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`flex flex-col items-center justify-center min-w-[60px] h-[56px] rounded-lg transition-all active:scale-95 gap-1 shrink-0 ${
            disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-900 active:bg-gray-800'
        } ${active ? 'text-white' : 'text-gray-500'} ${highlight ? 'text-white' : ''} ${danger ? 'text-red-500' : ''}`}
    >
        <Icon size={20} strokeWidth={1.5} className={active ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : ''} />
        {label && <span className="text-[9px] font-medium tracking-wide leading-none">{label}</span>}
    </button>
);
