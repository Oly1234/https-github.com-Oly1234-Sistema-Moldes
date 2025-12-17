
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Wand2, Download, Eraser, Shirt, Move, FlipHorizontal, FlipVertical, RotateCcw, ZoomIn, ZoomOut, Hand, MousePointerClick, RefreshCw, Layers, CopyCheck, Undo2, Redo2, Sliders, Check, X } from 'lucide-react';
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

  // State & History
  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [history, setHistory] = useState<AppliedLayer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  
  // Tools: 'WAND' (Fill), 'ADJUST' (Scale/Rot), 'HAND' (View)
  const [activeTool, setActiveTool] = useState<'WAND' | 'ADJUST' | 'HAND'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // Global Modifiers
  const [editAll, setEditAll] = useState(true);
  
  // Active Adjustment Values (Reflects current selection or global)
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
        // CRITICAL FIX: Reset composite operation before drawing new mask
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
            const safeSize = (diag * 2) / layer.scale; // Doubled safety margin
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

    // 3. Multiply Shadows (Texture Overlay)
    ctx.save(); 
    ctx.globalCompositeOperation = 'multiply'; 
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height); 
    ctx.restore();

  }, [moldImgObj, layers, activeLayerId, editAll, view.k]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  // --- FLOOD FILL ---
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
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);
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
                  pattern: pat, offsetX: 0, offsetY: 0, 
                  scale: activeScale, rotation: activeRotation, flipX: false, flipY: false, timestamp: Date.now()
              };
              const nextLayers = [...layers, newLayer];
              saveToHistory(nextLayers);
              setActiveLayerId(newLayer.id); 
          }
      } else if (activeTool === 'ADJUST') {
          let clickedId = null;
          for (let i = layers.length - 1; i >= 0; i--) {
              const l = layers[i];
              if (Math.sqrt((x - l.maskCenter.x)**2 + (y - l.maskCenter.y)**2) < 50 / view.k) { clickedId = l.id; break; }
          }
          if (clickedId) { setActiveLayerId(clickedId); isDragging.current = true; } 
          else setActiveLayerId(null);
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
    <div className="flex flex-col h-full w-full bg-[#111827] overflow-hidden text-white">
      {/* HEADER COMPACTO */}
      <div className="bg-[#1f2937] px-4 py-2 flex items-center justify-between border-b border-gray-700 shrink-0 z-50">
          <div className="flex items-center gap-2"><Shirt size={18} className="text-vingi-400"/><span className="font-bold text-sm">Mockup Studio</span></div>
          <div className="flex gap-2">
              <button onClick={() => { setMoldImage(null); setLayers([]); }} className="text-[10px] bg-gray-700 px-3 py-1.5 rounded hover:bg-gray-600">Novo</button>
              <button onClick={handleDownload} className="text-[10px] bg-vingi-600 text-white px-3 py-1.5 rounded font-bold hover:bg-vingi-500 flex items-center gap-1"><Download size={12}/> Salvar</button>
          </div>
      </div>

      {!moldImage ? (
          <div className="flex-1 bg-[#f0f2f5] overflow-y-auto">
              <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
              <ModuleLandingPage icon={Shirt} title="Mockup Técnico" description="Aplicação de estampas em moldes de corte." primaryActionLabel="Carregar Molde" onPrimaryAction={() => moldInputRef.current?.click()} />
          </div>
      ) : (
          <div className="flex-1 flex flex-col relative h-full">
              {/* CANVAS */}
              <div 
                ref={containerRef} 
                className={`flex-1 bg-[#0f172a] relative flex items-center justify-center overflow-hidden touch-none ${activeTool==='HAND'?'cursor-grab active:cursor-grabbing': activeTool==='WAND' ? 'cursor-cell' : 'cursor-default'}`} 
                onWheel={(e) => { if(e.ctrlKey || activeTool==='HAND') { e.preventDefault(); const s=Math.exp(-e.deltaY*0.001); setView(v=>({...v, k:Math.min(Math.max(0.1,v.k*s),8)})); }}}
                onTouchStart={(e) => { if(e.touches.length===2) { e.preventDefault(); lastDistRef.current=Math.sqrt((e.touches[0].clientX-e.touches[1].clientX)**2+(e.touches[0].clientY-e.touches[1].clientY)**2); } else handlePointerDown(e); }} 
                onTouchMove={(e) => { if(e.touches.length===2) { e.preventDefault(); const d=Math.sqrt((e.touches[0].clientX-e.touches[1].clientX)**2+(e.touches[0].clientY-e.touches[1].clientY)**2); setView(v=>({...v, k:Math.min(Math.max(0.1,v.k*(d/lastDistRef.current)),8)})); lastDistRef.current=d; } else handlePointerMove(e); }}
                onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={() => { isDragging.current=false; isPanning.current=false; }}
              >
                  <div className="relative shadow-2xl transition-transform duration-75 ease-out" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: moldImgObj ? moldImgObj.width : 'auto', height: moldImgObj ? moldImgObj.height : 'auto' }}>
                      <canvas ref={mainCanvasRef} className="block bg-white" />
                  </div>

                  {/* FLOATING ZOOM CONTROLS */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 bg-black/50 backdrop-blur rounded-lg p-1.5 z-30 border border-white/10">
                      <button onClick={()=>setView(v=>({...v, k: Math.min(v.k*1.2, 8)}))} className="p-1.5 hover:bg-white/20 rounded text-white"><ZoomIn size={16}/></button>
                      <button onClick={()=>setView(v=>({...v, k: Math.max(v.k*0.8, 0.1)}))} className="p-1.5 hover:bg-white/20 rounded text-white"><ZoomOut size={16}/></button>
                      <button onClick={()=>{ if(containerRef.current && moldImgObj) { const rect = containerRef.current.getBoundingClientRect(); setView({x:0, y:0, k: Math.min(rect.width/moldImgObj.width, rect.height/moldImgObj.height)*0.9}); } }} className="p-1.5 hover:bg-white/20 rounded text-white"><RotateCcw size={16}/></button>
                  </div>

                  {/* PATTERN SELECTOR (IF EMPTY) */}
                  {!patternImage && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-40 backdrop-blur-sm">
                          <button onClick={() => patternInputRef.current?.click()} className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform"><UploadCloud size={20}/> Selecionar Estampa</button>
                      </div>
                  )}
                  <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
              </div>

              {/* --- INSHOT STYLE TOOLBAR --- */}
              <div className="bg-[#1f2937] border-t border-gray-800 flex flex-col shrink-0 pb-safe z-50 shadow-[0_-5px_30px_rgba(0,0,0,0.5)]">
                  
                  {/* UPPER SLIDER PANEL (CONTEXTUAL) */}
                  {activeTool === 'ADJUST' && (
                      <div className="bg-[#111827] p-4 flex flex-col gap-4 animate-slide-up border-b border-gray-800">
                          <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-400 uppercase">Modo de Edição</span>
                              <button onClick={() => setEditAll(!editAll)} className={`text-[10px] font-bold px-3 py-1 rounded-full border flex items-center gap-1 transition-colors ${editAll ? 'bg-purple-900/50 text-purple-300 border-purple-500' : 'bg-transparent text-gray-500 border-gray-600'}`}>
                                  {editAll ? <Layers size={12}/> : <CopyCheck size={12}/>} {editAll ? 'Aplicar em Todos' : 'Somente Seleção'}
                              </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase"><span>Escala</span><span>{Math.round(activeScale*100)}%</span></div>
                                  <input type="range" min="0.1" max="3" step="0.1" value={activeScale} onChange={(e) => handleScale(parseFloat(e.target.value))} onMouseUp={(e) => handleScale(parseFloat((e.target as HTMLInputElement).value), true)} className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-vingi-500"/>
                              </div>
                              <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase"><span>Rotação</span><span>{activeRotation}°</span></div>
                                  <input type="range" min="0" max="360" value={activeRotation} onChange={(e) => handleRotate(parseInt(e.target.value))} onMouseUp={(e) => handleRotate(parseInt((e.target as HTMLInputElement).value), true)} className="w-full h-1 bg-gray-600 rounded-lg appearance-none accent-vingi-500"/>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* BOTTOM ICONS SCROLL - FIXED SCROLLBAR ISSUE */}
                  <div className="w-full overflow-hidden">
                      <div className="flex items-center gap-4 px-4 py-3 overflow-x-auto w-full no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                          
                          {/* TOOL GROUP */}
                          <div className="flex items-center gap-1 shrink-0">
                              <ToolBtn icon={Wand2} label="Preencher" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                              <ToolBtn icon={Sliders} label="Ajustar" active={activeTool==='ADJUST'} onClick={() => setActiveTool('ADJUST')} />
                              <ToolBtn icon={Hand} label="Mover Tela" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                          </div>
                          
                          <div className="w-px h-8 bg-gray-700 mx-1 shrink-0"></div>

                          {/* ACTION GROUP */}
                          <div className="flex items-center gap-1 shrink-0">
                              <ToolBtn icon={FlipHorizontal} label="Espelhar H" onClick={handleFlipX} />
                              <ToolBtn icon={FlipVertical} label="Espelhar V" onClick={handleFlipY} />
                              <ToolBtn icon={RefreshCw} label="Estampa" onClick={() => patternInputRef.current?.click()} highlight />
                          </div>

                          <div className="w-px h-8 bg-gray-700 mx-1 shrink-0"></div>

                          {/* HISTORY GROUP */}
                          <div className="flex items-center gap-1 shrink-0">
                              <ToolBtn icon={Undo2} onClick={undo} disabled={historyIndex <= -1} />
                              <ToolBtn icon={Redo2} onClick={redo} disabled={historyIndex >= history.length - 1} />
                              <ToolBtn icon={Eraser} onClick={() => { const newL = layers.filter(x => x.id !== activeLayerId); saveToHistory(newL); setActiveLayerId(null); }} disabled={!activeLayerId} danger />
                          </div>
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
        className={`flex flex-col items-center justify-center min-w-[60px] p-2 rounded-lg transition-all active:scale-95 gap-1 shrink-0 ${
            disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'
        } ${active ? 'text-vingi-400 bg-white/5' : 'text-gray-400'} ${highlight ? 'text-white' : ''} ${danger ? 'text-red-400' : ''}`}
    >
        <Icon size={20} className={highlight ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : ''} />
        {label && <span className="text-[9px] font-medium tracking-wide">{label}</span>}
    </button>
);
