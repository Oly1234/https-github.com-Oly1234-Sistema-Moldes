
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Search, Wand2, UploadCloud, Layers, Move, Eraser, Check, Loader2, Image as ImageIcon, Shirt, RefreshCw, X, Download, MousePointer2, ChevronRight, RotateCw, Sun, Droplets, Zap, Sliders, Sparkles, Brush, PenTool, Focus, ShieldCheck, Hand, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, Maximize, Undo2, Grid, ScanLine, ArrowLeft, MoreHorizontal, CheckCircle2, Play, Plus, MinusCircle, PlusCircle, Target, Move3d, Trash2 } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from '../components/Shared';
import { VingiSegmenter } from '../services/segmentationEngine';

export const VirtualRunway: React.FC<{ onNavigateToCreator: () => void }> = ({ onNavigateToCreator }) => {
    const [step, setStep] = useState<'SEARCH_BASE' | 'STUDIO'>('SEARCH_BASE');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    const [visibleBasesCount, setVisibleBasesCount] = useState(15);
    
    // Studio State
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const containerRef = useRef<HTMLDivElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
    const [baseImgObj, setBaseImgObj] = useState<HTMLImageElement | null>(null);
    const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);
    const [activeMask, setActiveMask] = useState<Uint8Array | null>(null);
    const [activeTool, setActiveTool] = useState<'WAND' | 'OFFSET' | 'HAND'>('WAND');
    const [history, setHistory] = useState<Uint8Array[]>([]);
    
    // Render Params
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const [patternScale, setPatternScale] = useState(0.5);
    const [patternRotation, setPatternRotation] = useState(0);
    const [patternOffset, setPatternOffset] = useState({ x: 0, y: 0 });
    const [shadowIntensity, setShadowIntensity] = useState(0.7);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showPatternModal, setShowPatternModal] = useState(false);
    
    const isDraggingRef = useRef(false);
    const lastPointerPos = useRef<{x: number, y: number} | null>(null);

    // --- RENDERER (ANTI-DISTORÇÃO MOBILE) ---
    const renderRunway = useCallback(() => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !baseImgObj || !maskCanvas) return;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const w = canvas.width, h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseImgObj, 0, 0, w, h);
        
        if (!patternImgObj || !activeMask) return;

        const tempC = document.createElement('canvas'); tempC.width = w; tempC.height = h;
        const tCtx = tempC.getContext('2d')!;
        tCtx.drawImage(maskCanvas, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        
        tCtx.save();
        tCtx.translate(w/2 + patternOffset.x, h/2 + patternOffset.y);
        tCtx.rotate((patternRotation * Math.PI) / 180);
        tCtx.scale(patternScale, patternScale);
        
        const pat = tCtx.createPattern(patternImgObj, 'repeat');
        if (pat) {
            tCtx.fillStyle = pat;
            const diag = Math.sqrt(w*w + h*h) * 2;
            tCtx.fillRect(-diag, -diag, diag*2, diag*2);
        }
        tCtx.restore();

        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.drawImage(tempC, 0, 0);
        ctx.restore();

        const shadowC = document.createElement('canvas'); shadowC.width = w; shadowC.height = h;
        const sCtx = shadowC.getContext('2d')!;
        sCtx.drawImage(maskCanvas, 0, 0);
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.filter = `grayscale(100%) contrast(140%) brightness(110%)`;
        sCtx.drawImage(baseImgObj, 0, 0);
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = shadowIntensity;
        ctx.drawImage(shadowC, 0, 0);
        ctx.restore();
    }, [baseImgObj, patternImgObj, patternScale, patternRotation, patternOffset, shadowIntensity, activeMask]);

    useEffect(() => {
        if (!activeMask || !baseImgObj) return;
        if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
        const mCanvas = maskCanvasRef.current;
        mCanvas.width = baseImgObj.width;
        mCanvas.height = baseImgObj.height;
        const mCtx = mCanvas.getContext('2d')!;
        const imgData = mCtx.createImageData(mCanvas.width, mCanvas.height);
        for (let i = 0; i < activeMask.length; i++) {
            if (activeMask[i] === 255) {
                const p = i * 4;
                imgData.data[p] = 255; imgData.data[p+1] = 255; imgData.data[p+2] = 255; imgData.data[p+3] = 255;
            }
        }
        mCtx.putImageData(imgData, 0, 0);
        renderRunway();
    }, [activeMask, baseImgObj, renderRunway]);

    const performSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setWhiteBases([]);
        try {
            const res = await fetch('/api/analyze', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ action: 'FIND_WHITE_MODELS', prompt: searchQuery }) 
            });
            const data = await res.json();
            if (data.success) {
                // Força a geração de 30 variações
                const queries = data.queries || Array(30).fill(searchQuery + " white clothing background");
                const results = await Promise.all(queries.slice(0, 30).map(async (q: string) => {
                    const r = await fetch('/api/analyze', { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({ action: 'GET_LINK_PREVIEW', backupSearchTerm: q, linkType: 'SEARCH_QUERY' }) 
                    });
                    const d = await r.json(); 
                    return d.success ? d.image : null;
                }));
                setWhiteBases(results.filter(u => u));
            }
        } catch(e) { console.error(e); } 
        finally { setIsSearching(false); }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if(!rect || !baseImgObj) return;
        const cx = rect.width / 2; const cy = rect.height / 2;
        const px = (e.clientX - rect.left - cx - view.x) / view.k + baseImgObj.width / 2;
        const py = (e.clientY - rect.top - cy - view.y) / view.k + baseImgObj.height / 2;
        lastPointerPos.current = { x: e.clientX, y: e.clientY };
        
        if (activeTool === 'HAND' || e.button === 1) return;
        
        if (activeTool === 'WAND') {
            const ctx = canvasRef.current!.getContext('2d')!;
            // VingiSegmenter modular para seleção por campo de energia
            const res = VingiSegmenter.segmentObject(ctx, baseImgObj.width, baseImgObj.height, px, py, 35);
            if (res) {
                setHistory(prev => [...prev.slice(-10), activeMask || new Uint8Array(0)]);
                // Seleção Cumulativa: Funde a nova máscara com a anterior
                setActiveMask(prev => prev ? VingiSegmenter.mergeMasks(prev, res.mask) : res.mask);
            }
        } else if (activeTool === 'OFFSET') {
            isDraggingRef.current = true;
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDraggingRef.current && lastPointerPos.current && activeTool === 'OFFSET') {
            const dx = (e.clientX - lastPointerPos.current.x) / view.k;
            const dy = (e.clientY - lastPointerPos.current.y) / view.k;
            setPatternOffset(p => ({ x: p.x + dx, y: p.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            renderRunway();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#080808] text-white overflow-hidden font-sans">
            {step === 'SEARCH_BASE' ? (
                <div className="flex-1 bg-[#f0f2f5] overflow-y-auto text-gray-800 custom-scrollbar">
                    <ModuleHeader icon={Camera} title="Provador Mágico" subtitle="Laboratório de Bases" />
                    <div className="max-w-6xl mx-auto p-4 md:p-12 space-y-10 pb-32">
                        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center animate-slide-up">
                            <h3 className="text-3xl font-black mb-6 uppercase tracking-tighter leading-none">Localizar Modelo de Base</h3>
                            <div className="flex flex-col md:flex-row gap-4 max-w-3xl mx-auto">
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && performSearch()} 
                                    placeholder="Ex: Calça branca modelo feminina..." 
                                    className="flex-1 p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-vingi-500 font-bold transition-all text-lg" 
                                />
                                <button onClick={performSearch} className="bg-vingi-900 text-white px-10 py-5 rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl">
                                    {isSearching ? <Loader2 className="animate-spin" size={24}/> : <Search size={24}/>} PESQUISAR 30+
                                </button>
                            </div>
                        </div>

                        {whiteBases.length > 0 && (
                            <div className="space-y-8 animate-fade-in">
                                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Modelos Disponíveis ({whiteBases.length})</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {whiteBases.slice(0, visibleBasesCount).map((u, i) => (
                                        <div key={i} onClick={() => { 
                                            const img = new Image(); img.src = u; img.crossOrigin = "anonymous";
                                            img.onload = () => {
                                                setBaseImgObj(img);
                                                // Bloqueio de Distorção: Canvas herda proporção natural
                                                if(canvasRef.current){ canvasRef.current.width = img.width; canvasRef.current.height = img.height; }
                                                setShowPatternModal(true);
                                                setStep('STUDIO');
                                            };
                                        }} className="aspect-[3/4] bg-white rounded-[1.5rem] overflow-hidden cursor-pointer hover:ring-8 ring-vingi-500/20 transition-all shadow-xl group relative border-2 border-transparent">
                                            <img src={u} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"/>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-vingi-500 p-3 rounded-full shadow-lg"><Check size={24}/></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#050505]">
                    {/* Studio Header */}
                    <div className="bg-[#111] h-14 border-b border-white/5 px-4 flex items-center justify-between shrink-0 z-50">
                        <div className="flex items-center gap-2">
                            <Camera size={18} className="text-vingi-400"/>
                            <span className="font-bold text-[11px] uppercase tracking-widest">Virtual Runway // Engine 4.5</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setStep('SEARCH_BASE'); setActiveMask(null); setHistory([]); }} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-red-500/10 font-bold uppercase transition-all">Nova Base</button>
                            <button onClick={() => { if(canvasRef.current){ const l=document.createElement('a'); l.download='vingi-provador.jpg'; l.href=canvasRef.current.toDataURL('image/jpeg', 0.95); l.click(); } }} className="text-[10px] bg-vingi-600 px-4 py-1.5 rounded-lg font-bold hover:bg-vingi-500 shadow-lg">EXPORTAR</button>
                        </div>
                    </div>
                    
                    {/* Canvas Area (Correção Anti-Distorção Mobile) */}
                    <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none p-4" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => isDraggingRef.current = false}>
                        <div className="relative shadow-2xl overflow-hidden rounded-xl border border-white/5" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: baseImgObj?.width, height: baseImgObj?.height, maxWidth: '95vw', maxHeight: '75vh' }}>
                            <canvas ref={canvasRef} className="block bg-[#111] object-contain w-full h-full" />
                        </div>

                        {/* Tactical Sliders (Floating) */}
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-[300px] pointer-events-none z-[100] animate-slide-up">
                            <div className="bg-[#111]/90 backdrop-blur-2xl border border-white/10 p-5 rounded-[2.5rem] pointer-events-auto shadow-2xl space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest"><span>Escala Arte</span><span>{Math.round(patternScale*100)}%</span></div>
                                    <input type="range" min="0.05" max="2" step="0.01" value={patternScale} onChange={e => { setPatternScale(parseFloat(e.target.value)); renderRunway(); }} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest"><span>Realismo (Sombra)</span><span>{Math.round(shadowIntensity*100)}%</span></div>
                                    <input type="range" min="0.2" max="1" step="0.05" value={shadowIntensity} onChange={e => { setShadowIntensity(parseFloat(e.target.value)); renderRunway(); }} className="w-full h-1 bg-gray-800 rounded-lg appearance-none accent-vingi-500 cursor-pointer"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dock Inferior (Estilo Mockup Studio) */}
                    <div className="bg-[#0a0a0a] border-t border-white/5 shrink-0 z-50 pb-[env(safe-area-inset-bottom)]">
                        <div className="flex items-center justify-between px-4 py-3 overflow-x-auto gap-2 max-w-4xl mx-auto no-scrollbar">
                            <ToolBtn icon={Hand} label="Pan" active={activeTool==='HAND'} onClick={() => setActiveTool('HAND')} />
                            <ToolBtn icon={Wand2} label="Varinha" active={activeTool==='WAND'} onClick={() => setActiveTool('WAND')} />
                            <ToolBtn icon={Move3d} label="Offset" active={activeTool==='OFFSET'} onClick={() => setActiveTool('OFFSET')} />
                            <div className="w-px h-10 bg-white/10 mx-2 shrink-0"></div>
                            <ToolBtn icon={Undo2} label="Undo" onClick={() => { if(history.length > 0) { const last = history.pop()!; setActiveMask(last); setHistory([...history]); } }} disabled={history.length === 0} />
                            <ToolBtn icon={Trash2} label="Limpar" onClick={() => { setActiveMask(null); setHistory([]); }} danger />
                            <ToolBtn icon={RefreshCw} label="Estampa" onClick={() => setShowPatternModal(true)} highlight />
                        </div>
                    </div>
                </div>
            )}

            {showPatternModal && (
                <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-[#111] border border-white/10 rounded-[3rem] p-12 max-w-md w-full text-center relative shadow-2xl">
                        <div className="w-20 h-20 bg-vingi-900 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 border border-vingi-500/30 shadow-vingi-500/20"><Layers size={40} className="text-vingi-400"/></div>
                        <h3 className="text-2xl font-black mb-4 uppercase tracking-tighter">Carregar Estampa</h3>
                        <p className="text-gray-400 text-[11px] mb-10 leading-relaxed uppercase tracking-widest font-bold">Selecione o arquivo da estampa para aplicar no modelo.</p>
                        <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>{ const pi=new Image(); pi.src=ev.target?.result as string; pi.onload=()=> { setPatternImgObj(pi); setShowPatternModal(false); renderRunway(); } }; r.readAsDataURL(f); } }} className="hidden" id="p-up-runway" />
                        <label htmlFor="p-up-runway" className="w-full py-5 bg-vingi-600 text-white rounded-2xl font-black flex items-center justify-center gap-4 cursor-pointer hover:bg-vingi-500 transition-all text-xs uppercase tracking-widest shadow-xl"><UploadCloud size={24}/> SELECIONAR ARTE</label>
                        <button onClick={() => setShowPatternModal(false)} className="mt-8 text-[10px] text-gray-600 hover:text-white uppercase font-black tracking-widest">Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ToolBtn = ({ icon: Icon, label, active, onClick, disabled, highlight, danger }: any) => (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center min-w-[72px] h-16 rounded-2xl gap-1.5 transition-all active:scale-90 shrink-0 ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5'} ${active ? 'bg-vingi-900/50 text-white border border-vingi-500/40 shadow-xl' : highlight ? 'bg-vingi-600 text-white' : danger ? 'text-red-500 hover:bg-red-500/10' : 'text-gray-500 hover:text-gray-300'}`}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} /> 
        <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
);
