
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, RotateCw, ZoomIn, GripHorizontal, Eraser, Download, Wand2, MousePointer2, Move, Layers, Zap, Lock, Unlock, ArrowRight, Check, Maximize, Sparkles, FlipHorizontal, MonitorPlay, X, Target, Crosshair } from 'lucide-react';

// --- TYPES ---
interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement; // Canvas contendo a forma
  // Metadados espaciais da máscara para rotação correta
  maskCenter: { x: number, y: number }; 
  patternImg: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number; // Em graus
  timestamp?: number;
  isMirrored: boolean; // NOVO: Controle de espelhamento
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

  // --- STATE: TOOLS & SETTINGS ---
  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // Smart Settings
  const [globalScale, setGlobalScale] = useState(0.5); 
  const [globalRotation, setGlobalRotation] = useState(0);
  const [globalMirror, setGlobalMirror] = useState(false); // NOVO
  const [syncSettings, setSyncSettings] = useState(true); 
  const [realismOpacity, setRealismOpacity] = useState(0.9); 

  const [isProcessing, setIsProcessing] = useState(false);

  // --- LIVE SIMULATION STATE ---
  const [showSimModal, setShowSimModal] = useState(false);
  const [simImage, setSimImage] = useState<string | null>(null);
  const [simImgObj, setSimImgObj] = useState<HTMLImageElement | null>(null);
  const [simMappings, setSimMappings] = useState<SimulationMapping[]>([]);
  const [isSettingPoint, setIsSettingPoint] = useState(false);
  const [simModalPos, setSimModalPos] = useState({ x: 20, y: 20 });

  // --- REFS ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const simCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  const simInputRef = useRef<HTMLInputElement>(null);
  
  // Controle de Interação
  const isDragging = useRef(false);
  const isDraggingModal = useRef(false);
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
            canvas.width = w;
            canvas.height = h;
        }
        setMoldImgObj(img);
        setLayers([]);
      };
    }
  }, [moldImage]);

  useEffect(() => {
    if (patternImage) {
      const img = new Image();
      img.src = patternImage;
      img.onload = () => setPatternImgObj(img);
    }
  }, [patternImage]);

  useEffect(() => {
      if (simImage) {
          const img = new Image();
          img.src = simImage;
          img.onload = () => setSimImgObj(img);
      }
  }, [simImage]);

  // Sync Settings
  useEffect(() => {
    if (syncSettings && layers.length > 0) {
        setLayers(prev => prev.map(layer => ({
            ...layer,
            scale: globalScale,
            rotation: globalRotation,
            isMirrored: globalMirror
        })));
    }
  }, [globalScale, globalRotation, globalMirror, syncSettings]);

  useEffect(() => {
      if (!syncSettings && activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) {
              setGlobalScale(layer.scale);
              setGlobalRotation(layer.rotation);
              setGlobalMirror(layer.isMirrored);
          }
      }
  }, [activeLayerId, syncSettings]);


  // --- RENDER ENGINES ---
  
  // 1. MAIN CANVAS RENDER
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !moldImgObj) return;

    const ctx = canvas.getContext('2d')!;
    
    // Limpar e Base
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    // Layers
    layers.forEach(layer => {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = canvas.width;
        layerCanvas.height = canvas.height;
        const lCtx = layerCanvas.getContext('2d')!;

        // Máscara
        lCtx.drawImage(layer.maskCanvas, 0, 0);
        lCtx.globalCompositeOperation = 'source-in';

        lCtx.save();
        
        // PIVOTING E TRANSFORMAÇÃO
        lCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        lCtx.rotate((layer.rotation * Math.PI) / 180);
        
        // Espelhamento (Flip) - Aplicado no eixo local
        if (layer.isMirrored) {
            lCtx.scale(-1, 1);
        }

        lCtx.translate(-layer.maskCenter.x, -layer.maskCenter.y);
        lCtx.translate(layer.offsetX, layer.offsetY);
        lCtx.scale(layer.scale, layer.scale);
        
        const pat = lCtx.createPattern(layer.patternImg, 'repeat');
        if (pat) {
            lCtx.fillStyle = pat;
            const safeSize = 20000; 
            lCtx.fillRect(-safeSize/2, -safeSize/2, safeSize, safeSize);
        }
        lCtx.restore();

        // Composite Final
        ctx.save();
        ctx.globalAlpha = realismOpacity; 
        ctx.drawImage(layerCanvas, 0, 0);
        ctx.restore();

        // Marcador Ativo
        if (layer.id === activeLayerId) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    });

    // Traço Técnico (Multiply)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);
    ctx.restore();

  }, [moldImgObj, layers, activeLayerId, realismOpacity]);

  // 2. SIMULATION CANVAS RENDER (LIVE RUNWAY)
  const renderSimulation = useCallback(() => {
      const canvas = simCanvasRef.current;
      if (!canvas || !simImgObj) return;

      const ctx = canvas.getContext('2d')!;
      
      // Ajuste de tamanho se necessário (uma vez)
      if (canvas.width !== 300) { // Tamanho fixo do modal preview
          const ratio = simImgObj.width / simImgObj.height;
          canvas.width = 300;
          canvas.height = 300 / ratio;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(simImgObj, 0, 0, canvas.width, canvas.height);

      // Renderizar estampas mapeadas
      simMappings.forEach(mapping => {
          if (!mapping.active) return;
          const layer = layers.find(l => l.id === mapping.layerId);
          if (!layer) return;

          ctx.save();
          // Simula 'multiply' para parecer tecido
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = realismOpacity;

          // Transformação no Preview
          // Usamos o ponto clicado (mapping.targetX/Y) como âncora visual
          ctx.translate(mapping.targetX, mapping.targetY);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          if (layer.isMirrored) ctx.scale(-1, 1);
          
          // Usa os mesmos offsets do molde 2D para dar sensação de "Live Sync"
          // Precisamos normalizar a escala visual
          const simScale = 0.2; // Escala reduzida para o preview
          
          // O truque: offset relativo ao centro
          ctx.translate(layer.offsetX * simScale, layer.offsetY * simScale);
          ctx.scale(layer.scale * simScale, layer.scale * simScale);

          const pat = ctx.createPattern(layer.patternImg, 'repeat');
          if (pat) {
              ctx.fillStyle = pat;
              ctx.fillRect(-500, -500, 1000, 1000);
          }
          ctx.restore();

          // Marcador de vínculo
          if (layer.id === activeLayerId) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(mapping.targetX, mapping.targetY, 15, 0, Math.PI * 2);
            ctx.stroke();
          }
      });

  }, [simImgObj, layers, simMappings, realismOpacity, activeLayerId]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);
  useEffect(() => { 
      if(showSimModal) requestAnimationFrame(renderSimulation); 
  }, [renderSimulation, showSimModal]);


  // --- LOGIC ---

  const createMaskFromClick = (startX: number, startY: number) => {
    if (!mainCanvasRef.current || !moldImgObj) return null;

    const canvas = mainCanvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const tempC = document.createElement('canvas');
    tempC.width = width;
    tempC.height = height;
    const tCtx = tempC.getContext('2d')!;
    tCtx.drawImage(moldImgObj, 0, 0, width, height);
    const data = tCtx.getImageData(0, 0, width, height).data;

    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    if (data[startPos] < 100 && data[startPos + 1] < 100 && data[startPos + 2] < 100) return null;

    // Flood Fill simplificado para brevidade (mantendo o existente funcional)
    const maskData = new Uint8ClampedArray(width * height * 4);
    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(width * height);
    const tol = tolerance;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let pixelCount = 0;
    const r0 = data[startPos];

    while (stack.length) {
        const [x, y] = stack.pop()!;
        let py = y;
        let pPos = (py * width + x) * 4;
        while (py >= 0 && Math.abs(data[pPos] - r0) <= tol && visited[py*width+x]===0) { py--; pPos -= width*4; }
        pPos += width*4; py++;
        let reachL = false, reachR = false;
        while (py < height && Math.abs(data[pPos] - r0) <= tol && visited[py*width+x]===0) {
            maskData[pPos] = 255; maskData[pPos+1] = 255; maskData[pPos+2] = 255; maskData[pPos+3] = 255;
            visited[py*width+x] = 1; pixelCount++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
            if (x > 0) { if (Math.abs(data[pPos-4] - r0) <= tol && visited[py*width+(x-1)]===0) { if (!reachL) { stack.push([x-1, py]); reachL = true; } } else if (reachL) reachL = false; }
            if (x < width-1) { if (Math.abs(data[pPos+4] - r0) <= tol && visited[py*width+(x+1)]===0) { if (!reachR) { stack.push([x+1, py]); reachR = true; } } else if (reachR) reachR = false; }
            py++; pPos += width*4;
        }
    }
    if (pixelCount < 100) return null;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width; maskCanvas.height = height;
    maskCanvas.getContext('2d')!.putImageData(new ImageData(maskData, width, height), 0, 0);
    return { maskCanvas, centerX: minX + (maxX - minX) / 2, centerY: minY + (maxY - minY) / 2 };
  };

  const handleAutoFill = () => {
    if (!mainCanvasRef.current || !moldImgObj || !patternImgObj) return;
    setIsProcessing(true);
    setTimeout(() => {
        const canvas = mainCanvasRef.current!;
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(moldImgObj, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const visitedGlobal = new Uint8Array(width * height);
        const newLayers: AppliedLayer[] = [];
        const step = 40; 
        for (let y = step/2; y < height; y += step) {
            for (let x = step/2; x < width; x += step) {
                const pos = (Math.floor(y) * width + Math.floor(x)) * 4;
                if (data[pos] > 200 && data[pos+1] > 200 && data[pos+2] > 200 && visitedGlobal[Math.floor(y)*width+Math.floor(x)] === 0) {
                    const res = createMaskFromClick(x, y);
                    if (res) {
                        const mData = res.maskCanvas.getContext('2d')!.getImageData(0,0,width,height).data;
                        let hasNewPixels = false;
                        for(let i=0; i<mData.length; i+=4) { if (mData[i] === 255) { const idx = i/4; if (visitedGlobal[idx] === 0) { visitedGlobal[idx] = 1; hasNewPixels = true; } } }
                        if (hasNewPixels) {
                            const centeredOffsetX = res.centerX - (patternImgObj.width * globalScale) / 2;
                            const centeredOffsetY = res.centerY - (patternImgObj.height * globalScale) / 2;
                            newLayers.push({
                                id: Date.now() + Math.random().toString(),
                                maskCanvas: res.maskCanvas,
                                maskCenter: { x: res.centerX, y: res.centerY },
                                patternImg: patternImgObj,
                                offsetX: centeredOffsetX,
                                offsetY: centeredOffsetY,
                                scale: globalScale,
                                rotation: globalRotation,
                                isMirrored: globalMirror,
                                timestamp: Date.now()
                            });
                        }
                    }
                }
            }
        }
        setLayers(newLayers);
        if (newLayers.length > 0) { setTool('MOVE'); setActiveLayerId(newLayers[0].id); }
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
    
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (tool === 'WAND') {
        const res = createMaskFromClick(x, y);
        if (res) {
            const centeredOffsetX = res.centerX - (patternImgObj.width * globalScale) / 2;
            const centeredOffsetY = res.centerY - (patternImgObj.height * globalScale) / 2;
            const newLayer: AppliedLayer = {
                id: Date.now().toString(),
                maskCanvas: res.maskCanvas,
                maskCenter: { x: res.centerX, y: res.centerY },
                patternImg: patternImgObj,
                offsetX: centeredOffsetX, offsetY: centeredOffsetY,
                scale: globalScale, rotation: globalRotation, isMirrored: globalMirror,
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
            if (!syncSettings) {
                const l = layers.find(lay => lay.id === clickedId);
                if (l) { setGlobalScale(l.scale); setGlobalRotation(l.rotation); setGlobalMirror(l.isMirrored); }
            }
        } else { setActiveLayerId(null); }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
    e.preventDefault();

    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    
    // Delta natural na tela (Screen Space)
    const dxScreen = (clientX - lastPos.current.x) * (canvas.width / rect.width);
    const dyScreen = (clientY - lastPos.current.y) * (canvas.height / rect.height);

    // Encontrar a layer ativa para saber sua rotação
    const layer = layers.find(l => l.id === activeLayerId);
    
    if (layer) {
        // CORREÇÃO MATEMÁTICA DE ROTAÇÃO:
        // Precisamos converter o movimento da tela (Global) para o eixo local da estampa (Local)
        // Isso é feito aplicando a rotação INVERSA do objeto ao vetor de movimento.
        const angleRad = (layer.rotation * Math.PI) / 180;
        
        // Matriz de Rotação Inversa:
        // x' = x * cos(-a) - y * sin(-a)
        // y' = x * sin(-a) + y * cos(-a)
        // Como cos(-a) = cos(a) e sin(-a) = -sin(a):
        
        let dxLocal = dxScreen * Math.cos(angleRad) + dyScreen * Math.sin(angleRad);
        let dyLocal = -dxScreen * Math.sin(angleRad) + dyScreen * Math.cos(angleRad);

        // Correção para espelhamento: Se estiver espelhado, inverte o eixo X local
        if (layer.isMirrored) {
            dxLocal = -dxLocal;
        }

        setLayers(prev => prev.map(l => l.id === activeLayerId ? {
            ...l, 
            offsetX: l.offsetX + dxLocal, 
            offsetY: l.offsetY + dyLocal
        } : l));
    }

    lastPos.current = { x: clientX, y: clientY };
  };

  // --- SIMULATION MODAL EVENTS ---
  const handleSimCanvasClick = (e: React.MouseEvent) => {
      if (!isSettingPoint || !activeLayerId) return;
      
      const canvas = simCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      setSimMappings(prev => {
          const filtered = prev.filter(m => m.layerId !== activeLayerId);
          return [...filtered, { layerId: activeLayerId!, targetX: x, targetY: y, active: true }];
      });
      setIsSettingPoint(false);
  };

  // Dragging the Modal
  const handleModalMouseDown = (e: React.MouseEvent) => {
      isDraggingModal.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleModalMove = (e: React.MouseEvent) => {
      if(isDraggingModal.current) {
          const dx = e.clientX - lastPos.current.x;
          const dy = e.clientY - lastPos.current.y;
          setSimModalPos(p => ({ x: p.x + dx, y: p.y + dy }));
          lastPos.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleDownload = () => {
    if (!mainCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'vingi-briefing-tecnico.png';
    link.href = mainCanvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] md:flex-row overflow-hidden font-sans relative" onMouseMove={handleModalMove} onMouseUp={() => isDraggingModal.current = false}>
      
      {/* 1. SIDEBAR CONTROLS */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col shadow-2xl z-20 shrink-0 h-auto md:h-full overflow-y-auto">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={20} /> Mockup Studio 
                  <span className="text-[10px] bg-vingi-900 text-white px-2 py-0.5 rounded-full font-mono">v2.1</span>
              </h2>
          </div>

          <div className="p-5 space-y-8">
              {/* ASSETS */}
              <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Layers size={12}/> Arquivos Base
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                      <div onClick={() => moldInputRef.current?.click()} className={`relative h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${moldImage ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                          <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                          {moldImage ? <img src={moldImage} className="w-full h-full object-contain p-1"/> : <UploadCloud className="text-gray-300"/>}
                          <span className="text-[9px] font-bold text-gray-400 mt-1">MOLDE</span>
                      </div>
                      <div onClick={() => patternInputRef.current?.click()} className={`relative h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${patternImage ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-vingi-400'}`}>
                          <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} accept="image/*" className="hidden" />
                          {patternImage ? <img src={patternImage} className="w-full h-full object-cover rounded-lg"/> : <ImageIcon className="text-gray-300"/>}
                          <span className="text-[9px] font-bold text-gray-400 mt-1">ESTAMPA</span>
                      </div>
                  </div>
              </div>

              {/* MAGIC ACTIONS */}
              <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={12}/> Ferramentas
                  </h3>
                  <button 
                    onClick={handleAutoFill}
                    disabled={!moldImage || !patternImage || isProcessing}
                    className="w-full py-3 bg-gradient-to-r from-vingi-600 to-vingi-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                      {isProcessing ? <Wand2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      {isProcessing ? 'Processando...' : 'AUTO-POSICIONAR (IA)'}
                  </button>
                  
                  <div className="flex gap-2">
                      <button onClick={() => setTool('WAND')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${tool === 'WAND' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'}`}>MANUAL</button>
                      <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${tool === 'MOVE' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'}`}>AJUSTAR</button>
                  </div>
              </div>

              {/* CONTROLS */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
                   <div className="flex items-center justify-between mb-2">
                       <h3 className="text-[10px] font-bold text-vingi-600 uppercase tracking-widest">Ajuste Fino</h3>
                       <button onClick={() => setSyncSettings(!syncSettings)} className={`p-1 rounded ${syncSettings ? 'text-vingi-600 bg-vingi-100' : 'text-gray-400'}`}>
                           {syncSettings ? <Lock size={14}/> : <Unlock size={14}/>}
                       </button>
                   </div>

                   {/* Scale */}
                   <div className="space-y-1">
                       <div className="flex justify-between text-xs text-gray-500"><span>Escala</span><span>{Math.round(globalScale * 100)}%</span></div>
                       <input type="range" min="0.1" max="2.5" step="0.05" value={globalScale} onChange={(e) => setGlobalScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                   </div>

                   {/* Rotation */}
                   <div className="space-y-1">
                       <div className="flex justify-between text-xs text-gray-500"><span>Rotação</span><span>{globalRotation}°</span></div>
                       <input type="range" min="0" max="360" step="1" value={globalRotation} onChange={(e) => setGlobalRotation(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                       <div className="flex justify-between pt-2">
                           {[0, 45, 90, 180].map(deg => (<button key={deg} onClick={() => setGlobalRotation(deg)} className="px-2 py-1 text-[9px] font-bold bg-white border border-gray-200 rounded text-gray-600">{deg}°</button>))}
                       </div>
                   </div>

                   {/* Mirror & Realism */}
                   <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
                       <button 
                         onClick={() => setGlobalMirror(!globalMirror)} 
                         className={`flex-1 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 ${globalMirror ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-600 border-gray-200'}`}
                       >
                           <FlipHorizontal size={14} /> {globalMirror ? 'ESPELHADO' : 'ESPELHAR'}
                       </button>
                       <div className="flex-1">
                           <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Realismo</span></div>
                           <input type="range" min="0.5" max="1" step="0.05" value={realismOpacity} onChange={(e) => setRealismOpacity(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg accent-gray-600"/>
                       </div>
                   </div>
              </div>

              {/* FOOTER */}
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                  <button 
                    onClick={() => { setShowSimModal(true); }}
                    className="w-full py-2 text-xs font-bold text-vingi-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                      <MonitorPlay size={14}/> LIVE RUNWAY (SIMULADOR)
                  </button>
                  <button onClick={() => setLayers([])} className="w-full py-2 text-xs font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 flex items-center justify-center gap-2"><Eraser size={14}/> LIMPAR</button>
                  <button onClick={handleDownload} className="w-full py-3 bg-vingi-900 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><Download size={16}/> EXPORTAR</button>
              </div>
          </div>
      </div>

      {/* 2. WORKSPACE */}
      <div className="flex-1 bg-[#e2e8f0] relative flex items-center justify-center overflow-hidden touch-none">
           <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

           {!moldImage ? (
               <div className="text-center opacity-50">
                   <UploadCloud size={64} className="mx-auto mb-4 text-gray-400"/>
                   <h2 className="text-xl font-bold text-gray-500">Área de Trabalho</h2>
                   <p className="text-sm text-gray-400">Carregue um molde no menu lateral</p>
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
                        className="block w-auto h-auto max-w-full max-h-[85vh]"
                    />
                    {isProcessing && (
                         <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                             <div className="bg-vingi-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
                                 <Wand2 className="animate-spin" size={20}/><span className="font-bold tracking-wide">ANALISANDO GEOMETRIA...</span>
                             </div>
                         </div>
                    )}
                </div>
           )}

           {/* 3. FLOATING SIMULATION MODAL (LIVE RUNWAY) */}
           {showSimModal && (
               <div 
                 className="absolute w-80 bg-white rounded-xl shadow-2xl border border-gray-300 flex flex-col overflow-hidden z-[100]"
                 style={{ top: simModalPos.y, left: simModalPos.x }}
               >
                   <div 
                     onMouseDown={handleModalMouseDown}
                     className="bg-vingi-900 text-white p-3 flex justify-between items-center cursor-move select-none"
                   >
                       <span className="text-xs font-bold flex items-center gap-2"><MonitorPlay size={14}/> LIVE RUNWAY</span>
                       <button onClick={() => setShowSimModal(false)}><X size={14}/></button>
                   </div>
                   
                   <div className="p-3 bg-gray-50 min-h-[300px] flex items-center justify-center relative">
                       {!simImage ? (
                           <div onClick={() => simInputRef.current?.click()} className="text-center cursor-pointer opacity-60 hover:opacity-100">
                               <input type="file" ref={simInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setSimImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                               <UploadCloud size={32} className="mx-auto mb-2 text-vingi-500"/>
                               <p className="text-xs font-bold">Carregar Foto Modelo</p>
                           </div>
                       ) : (
                           <>
                             <canvas 
                                ref={simCanvasRef} 
                                onClick={handleSimCanvasClick}
                                className={`w-full h-auto rounded border border-gray-200 ${isSettingPoint ? 'cursor-crosshair ring-2 ring-red-500' : ''}`}
                             />
                             {isSettingPoint && (
                                 <div className="absolute top-4 bg-red-500 text-white px-3 py-1 text-[10px] font-bold rounded-full animate-bounce shadow-lg">
                                     CLIQUE NA PEÇA (MODELO)
                                 </div>
                             )}
                           </>
                       )}
                   </div>

                   <div className="p-3 border-t border-gray-100 bg-white">
                       <p className="text-[10px] text-gray-400 mb-2 leading-tight">
                           Selecione uma peça no molde 2D, clique em "Vincular" e depois clique na área correspondente na foto da modelo.
                       </p>
                       <button 
                         onClick={() => { if(activeLayerId) setIsSettingPoint(true); }}
                         disabled={!activeLayerId || !simImage}
                         className="w-full py-2 bg-vingi-100 text-vingi-700 font-bold text-xs rounded-lg hover:bg-vingi-200 disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                           <Target size={14}/> {isSettingPoint ? 'AGUARDANDO CLIQUE...' : 'VINCULAR PEÇA ATIVA'}
                       </button>
                   </div>
               </div>
           )}
      </div>
    </div>
  );
};
