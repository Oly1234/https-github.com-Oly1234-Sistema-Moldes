
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Wand2, X, Move, Trash2, Scissors, Layers, FlipHorizontal, FlipVertical, RotateCw, Check, Palette, Hand, PlusCircle, Maximize, Pointer } from 'lucide-react';

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
        const pos = y * width + x; const pPos = pos * 4;
        if (visited[pos]) continue;
        visited[pos] = 1;
        const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
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

const getDistance = (t1: React.Touch, t2: React.Touch) => Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
const getAngle = (t1: React.Touch, t2: React.Touch) => (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;

interface MockupStudioProps {
  externalPattern?: string | null;
}

export const MockupStudio: React.FC<MockupStudioProps> = ({ externalPattern }) => {
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [canvasDims, setCanvasDims] = useState({ w: 0, h: 0 }); 
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  
  // Refs
  const isDraggingLayer = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const gestureStartScale = useRef<number>(1);
  const gestureStartRotation = useRef<number>(0);
  const gestureStartDist = useRef<number>(0);
  const gestureStartAngle = useRef<number>(0);
  const isGestureActive = useRef<boolean>(false);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (moldImage) {
      const img = new Image(); img.src = moldImage;
      img.onload = () => { setCanvasDims({ w: img.naturalWidth, h: img.naturalHeight }); setMoldImgObj(img); setLayers([]); };
    }
  }, [moldImage]);

  useEffect(() => {
    const src = externalPattern || patternImage;
    if (src) {
        const img = new Image(); img.src = src; 
        img.onload = () => { setPatternImgObj(img); if(externalPattern) setPatternImage(externalPattern); };
    }
  }, [patternImage, externalPattern]);

  useEffect(() => {
    const handleGlobalUp = () => { isDraggingLayer.current = false; isGestureActive.current = false; };
    window.addEventListener('mouseup', handleGlobalUp); window.addEventListener('touchend', handleGlobalUp);
    return () => { window.removeEventListener('mouseup', handleGlobalUp); window.removeEventListener('touchend', handleGlobalUp); };
  }, []);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const isTouch = 'touches' in e;
      
      if (isTouch && (e as React.TouchEvent).touches.length === 2 && activeLayerId) {
          e.preventDefault(); 
          const t1 = (e as React.TouchEvent).touches[0]; const t2 = (e as React.TouchEvent).touches[1];
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

      let clientX, clientY;
      if (isTouch) { clientX = (e as React.TouchEvent).touches[0].clientX; clientY = (e as React.TouchEvent).touches[0].clientY; } 
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

      const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX; const y = (clientY - rect.top) * scaleY;

      let clickedLayerId = null;
      for (let i = layers.length - 1; i >= 0; i--) {
          const ctx = layers[i].maskCanvas.getContext('2d')!;
          if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { clickedLayerId = layers[i].id; break; }
      }

      if (clickedLayerId) {
          setActiveLayerId(clickedLayerId); setTool('MOVE');
          isDraggingLayer.current = true; lastMousePos.current = { x: clientX, y: clientY };
      } else {
          setActiveLayerId(null); 
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
                   scale: 0.5, rotation: 0, flipX: false, flipY: false, skewX: 0, skewY: 0, bodyPart: 'DEFAULT'
               };
               setLayers(prev => [...prev, newLayer]);
               setActiveLayerId(newLayer.id);
               setTool('MOVE'); 
          }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (e.cancelable) e.preventDefault(); 
      const isTouch = 'touches' in e;
      if (isTouch && (e as React.TouchEvent).touches.length === 2 && isGestureActive.current && activeLayerId) {
          const t1 = (e as React.TouchEvent).touches[0]; const t2 = (e as React.TouchEvent).touches[1];
          const newDist = getDistance(t1, t2); const newAngle = getAngle(t1, t2);
          const scaleFactor = newDist / gestureStartDist.current;
          const newScale = Math.max(0.1, Math.min(5, gestureStartScale.current * scaleFactor));
          const rotationDelta = newAngle - gestureStartAngle.current;
          const newRotation = gestureStartRotation.current + rotationDelta;
          updateActiveLayer({ scale: newScale, rotation: newRotation });
          return;
      }
      if (!isDraggingLayer.current || !activeLayerId || tool !== 'MOVE') return;
      let clientX, clientY;
      if (isTouch) { clientX = (e as React.TouchEvent).touches[0].clientX; clientY = (e as React.TouchEvent).touches[0].clientY; } 
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
      const dx = (clientX - lastMousePos.current.x) * scaleX; const dy = (clientY - lastMousePos.current.y) * scaleY;
      updateActiveLayer({ offsetX: layers.find(l => l.id === activeLayerId)!.offsetX + dx, offsetY: layers.find(l => l.id === activeLayerId)!.offsetY + dy });
      lastMousePos.current = { x: clientX, y: clientY };
  };

  const updateActiveLayer = (updates: Partial<AppliedLayer>) => {
      if (!activeLayerId) return;
      setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, ...updates } : l));
  };

  const deleteActiveLayer = () => { setLayers(prev => prev.filter(l => l.id !== activeLayerId)); setActiveLayerId(null); };

  const renderMain = useCallback(() => {
      const canvas = mainCanvasRef.current;
      if (!canvas || !moldImgObj || canvasDims.w === 0) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

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
              ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; 
              ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 15;
              ctx.setLineDash([6,4]);
              ctx.beginPath();
              // Desenha caixa bounding aproximada ou circulo
              ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 50, 0, 2 * Math.PI);
              ctx.stroke();
              
              // Crosshair
              ctx.lineWidth = 1; ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(layer.maskCenter.x - 15, layer.maskCenter.y); ctx.lineTo(layer.maskCenter.x + 15, layer.maskCenter.y);
              ctx.moveTo(layer.maskCenter.x, layer.maskCenter.y - 15); ctx.lineTo(layer.maskCenter.x, layer.maskCenter.y + 15);
              ctx.stroke();
              ctx.restore();
          }
      });
  }, [moldImgObj, layers, activeLayerId, canvasDims]);

  useEffect(() => { requestAnimationFrame(renderMain); }, [renderMain]);

  const activeLayer = layers.find(l => l.id === activeLayerId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-full bg-[#f1f5f9] font-sans overflow-hidden">
      
      {/* 1. AREA DO CANVAS */}
      <div className="flex-1 relative flex items-center justify-center bg-[#f1f5f9] overflow-hidden p-4 md:p-8">
           <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

           {/* Canvas Container */}
           <div className={`relative shadow-2xl bg-white border border-gray-200 md:rounded-lg flex flex-col items-center justify-center overflow-hidden transition-all duration-300 w-full h-full max-w-full max-h-[60vh] md:max-h-[85vh]`}>
                {moldImgObj ? (
                    <canvas 
                        ref={mainCanvasRef}
                        width={canvasDims.w}
                        height={canvasDims.h}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', touchAction: 'none' }}
                        className="cursor-crosshair block shadow-inner bg-white"
                    />
                ) : (
                    <div onClick={() => moldInputRef.current?.click()} className="p-10 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-4 cursor-pointer hover:bg-gray-50 active:scale-95 transition-all group">
                        <Scissors size={48} className="mx-auto mb-4 opacity-30 group-hover:text-vingi-900 group-hover:opacity-100 transition-all"/>
                        <p className="font-bold text-sm">Carregue um Molde</p>
                    </div>
                )}
           </div>

           {/* Ferramentas Flutuantes de Tela (Desktop/Mobile) */}
           {moldImage && (
             <div className="absolute top-4 right-4 flex flex-col gap-2">
                 <button onClick={() => { setCanvasDims({...canvasDims}); }} className="bg-white p-2 rounded-lg shadow-lg text-gray-700 active:scale-90 transition-transform border border-gray-200" title="Recentralizar">
                    <Maximize size={20} />
                 </button>
             </div>
           )}
      </div>

      {/* 2. BARRA DE FERRAMENTAS INFERIOR */}
      <div className="bg-white border-t border-gray-200 z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] pb-safe relative">
          
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center px-4">
              <h2 className="text-xs font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={16} /> Vingi Studio <span className="text-[9px] bg-black text-white px-1 rounded">2D</span>
              </h2>
              {/* Inputs Invisíveis */}
              <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
              <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
          </div>
          
          <div className="p-3 space-y-3 relative">
               
               {/* BOTÕES DE UPLOAD (ESTADO SÓLIDO) */}
               <div className="flex gap-3">
                   <button 
                       onClick={() => moldInputRef.current?.click()} 
                       className={`flex-1 py-3 px-2 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 text-xs ${
                           moldImage 
                             ? 'bg-emerald-500 border-emerald-600 text-white' // SÓLIDO VERDE
                             : 'bg-white border-dashed border-gray-300 text-gray-400 hover:bg-gray-50'
                       }`}
                   >
                      {moldImage ? <Check size={16} strokeWidth={3}/> : <Scissors size={16}/>} 
                      {moldImage ? 'MOLDE OK' : 'MOLDE'}
                   </button>

                   <button 
                       onClick={() => patternInputRef.current?.click()} 
                       className={`flex-1 py-3 px-2 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 text-xs ${
                           patternImage 
                             ? 'bg-violet-600 border-violet-700 text-white' // SÓLIDO ROXO
                             : 'bg-white border-dashed border-gray-300 text-gray-400 hover:bg-gray-50'
                       }`}
                   >
                      {patternImage ? <Check size={16} strokeWidth={3}/> : <Palette size={16}/>} 
                      {patternImage ? 'ESTAMPA OK' : 'ESTAMPA'}
                   </button>
               </div>

               {/* CONTROLES DA CAMADA (FERRAMENTAS) */}
               {activeLayer ? (
                   <div className="animate-fade-in-up bg-slate-50 p-2 rounded-xl border border-slate-200">
                       <div className="flex items-center justify-between mb-2 px-1">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Editar Camada</span>
                           <button onClick={deleteActiveLayer} className="text-red-500 bg-white p-1.5 rounded-md border border-red-100 shadow-sm"><Trash2 size={14}/></button>
                       </div>
                       
                       <div className="grid grid-cols-4 gap-2">
                            <button onClick={() => updateActiveLayer({ rotation: activeLayer.rotation + 45 })} className="bg-white p-2 rounded-lg text-slate-600 border border-slate-200 flex flex-col items-center justify-center active:scale-95"><RotateCw size={18}/><span className="text-[9px] mt-1">Girar</span></button>
                            <button onClick={() => updateActiveLayer({ flipX: !activeLayer.flipX })} className="bg-white p-2 rounded-lg text-slate-600 border border-slate-200 flex flex-col items-center justify-center active:scale-95"><FlipHorizontal size={18}/><span className="text-[9px] mt-1">Flip H</span></button>
                            <button onClick={() => updateActiveLayer({ flipY: !activeLayer.flipY })} className="bg-white p-2 rounded-lg text-slate-600 border border-slate-200 flex flex-col items-center justify-center active:scale-95"><FlipVertical size={18}/><span className="text-[9px] mt-1">Flip V</span></button>
                            <button onClick={() => { setActiveLayerId(null); setTool('WAND'); }} className="bg-vingi-900 text-white p-2 rounded-lg border border-vingi-800 flex flex-col items-center justify-center active:scale-95 shadow-md"><PlusCircle size={18}/><span className="text-[9px] mt-1">Novo</span></button>
                       </div>
                   </div>
               ) : (
                   <div className="flex gap-2 opacity-50 pointer-events-none grayscale">
                       <div className="flex-1 py-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 bg-white text-gray-400">
                           <Pointer size={16}/> Selecione uma área
                       </div>
                   </div>
               )}
          </div>
      </div>
    </div>
  );
};
