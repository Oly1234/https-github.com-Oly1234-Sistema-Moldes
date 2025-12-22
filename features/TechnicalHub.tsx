
import React, { useState, useEffect } from 'react';
import { 
    FileText, Printer, Download, Palette, Truck, ShoppingCart, 
    Layers, Cpu, Hash, Briefcase, Target, Plus, Trash2, Check,
    Scissors, Ruler, Droplets, Thermometer, Factory, ExternalLink,
    Maximize, Zap, Gauge, ListOrdered, Calendar, Globe, Eye, EyeOff,
    MessageSquare, Settings, Share2, ClipboardList, Beaker, Pipette,
    Box, ChevronRight, HardHat, Cog, RefreshCw
} from 'lucide-react';
import { PantoneColor } from '../types';
import { ModuleHeader } from '../components/Shared';

type SheetType = 
    | 'PRODUCAO_MISTA' 
    | 'COZINHA_TEXTIL' 
    | 'TINTURARIA' 
    | 'ESTAMPARIA_ROTATIVA' 
    | 'GRAVACAO_CILINDRO' 
    | 'SUBLIMACAO_PRO' 
    | 'EXPEDICAO_ROMANEIO' 
    | 'AMOSTRA_TECNICA';

interface VisibilityConfig {
    pantones: boolean;
    images: boolean;
    technicalTable: boolean;
    logistics: boolean;
    observation: boolean;
}

interface SheetData {
    id: string;
    type: SheetType;
    numero: string;
    cliente: string;
    representante: string;
    base: string;
    localEnvio: string;
    fornecedor: string;
    qtdCores: number;
    pantones: PantoneColor[];
    mesh: string; 
    rapport: string; 
    metragem: string;
    status: 'AMOSTRA' | 'PRODUCAO' | 'TESTE';
    terceirizado: boolean;
    obs: string;
    estampaSrc?: string;
    banhoRatio: string;
    temperatura: string;
    tempo: string;
}

export const TechnicalHub: React.FC = () => {
    const [activeSheet, setActiveSheet] = useState<SheetType>('PRODUCAO_MISTA');
    const [config, setConfig] = useState<VisibilityConfig>({
        pantones: true,
        images: true,
        technicalTable: true,
        logistics: true,
        observation: true
    });

    const [data, setData] = useState<SheetData>({
        id: `VNG-${Math.floor(10000 + Math.random() * 90000)}`,
        type: 'PRODUCAO_MISTA',
        numero: '15884',
        cliente: 'KABRIOLLI A/C KAREN',
        representante: 'CALDEIRA',
        base: '280V - VISCOSE PREMIUM',
        localEnvio: 'Americana - SP',
        fornecedor: 'VINGI TEXTIL',
        qtdCores: 4,
        pantones: [
            { name: 'Fundo Bege', code: '13-1013 TCX', hex: '#e5d5c5' },
            { name: 'Motivo Dark', code: '19-0303 TCX', hex: '#2b2c28' },
            { name: 'Accent Rust', code: '18-1442 TCX', hex: '#a85133' },
            { name: 'White Flash', code: '11-0601 TCX', hex: '#f0f0f0' }
        ],
        mesh: '125',
        rapport: '64cm',
        metragem: '850m',
        status: 'PRODUCAO',
        terceirizado: false,
        obs: 'Respeitar toque macio. Conferir encaixe de cilindro na lateral esquerda.',
        banhoRatio: '1:10',
        temperatura: '60°C',
        tempo: '45 min',
        estampaSrc: ''
    });

    useEffect(() => {
        const estampa = localStorage.getItem('vingi_mockup_pattern');
        if (estampa) setData(prev => ({ ...prev, estampaSrc: estampa }));
    }, []);

    const updateField = (field: keyof SheetData, value: any) => setData(prev => ({ ...prev, [field]: value }));
    const toggleConfig = (field: keyof VisibilityConfig) => setConfig(prev => ({ ...prev, [field]: !prev[field] }));

    const handlePrint = () => window.print();

    const handleWhatsApp = () => {
        const text = `*VINGI TECHNICAL HUB*\n\nDocumento: ${activeSheet.replace(/_/g, ' ')}\nID: ${data.id}\nDesenho: ${data.numero}\nCliente: ${data.cliente}\nBase: ${data.base}\nMetragem: ${data.metragem}\nStatus: ${data.status}\n\n_Gerado por Vingi AI Engine_`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden font-sans">
            <ModuleHeader 
                icon={ClipboardList} 
                title="Industrial Hub" 
                subtitle="Gestão de Fichas Técnicas"
                rightContent={
                    <div className="flex gap-2">
                        <button onClick={handleWhatsApp} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all">
                            <MessageSquare size={16}/> WHATSAPP
                        </button>
                        <button onClick={handlePrint} className="bg-vingi-900 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-xl hover:bg-black transition-all">
                            <Printer size={16}/> IMPRIMIR
                        </button>
                    </div>
                }
            />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <aside className="w-full md:w-80 bg-white border-r border-gray-200 overflow-y-auto p-6 space-y-6 no-print shrink-0 custom-scrollbar shadow-inner">
                    <section>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Cog size={12}/> Fluxo de Trabalho</h3>
                        <div className="grid gap-1.5">
                            <TypeBtn active={activeSheet === 'PRODUCAO_MISTA'} icon={ShoppingCart} label="Pedido Produção (Mix)" onClick={() => setActiveSheet('PRODUCAO_MISTA')} />
                            <TypeBtn active={activeSheet === 'COZINHA_TEXTIL'} icon={Beaker} label="Cozinha (Colorimetria)" onClick={() => setActiveSheet('COZINHA_TEXTIL')} />
                            <TypeBtn active={activeSheet === 'TINTURARIA'} icon={Droplets} label="Tinturaria" onClick={() => setActiveSheet('TINTURARIA')} />
                            <TypeBtn active={activeSheet === 'ESTAMPARIA_ROTATIVA'} icon={RefreshCw} label="Estamparia Rotativa" onClick={() => setActiveSheet('ESTAMPARIA_ROTATIVA')} />
                            <TypeBtn active={activeSheet === 'GRAVACAO_CILINDRO'} icon={Cpu} label="Gravadora de Cilindro" onClick={() => setActiveSheet('GRAVACAO_CILINDRO')} />
                            <TypeBtn active={activeSheet === 'SUBLIMACAO_PRO'} icon={Zap} label="Sublimação Industrial" onClick={() => setActiveSheet('SUBLIMACAO_PRO')} />
                            <TypeBtn active={activeSheet === 'EXPEDICAO_ROMANEIO'} icon={Truck} label="Expedição & Romaneio" onClick={() => setActiveSheet('EXPEDICAO_ROMANEIO')} />
                            <TypeBtn active={activeSheet === 'AMOSTRA_TECNICA'} icon={Scissors} label="Pedido de Amostra" onClick={() => setActiveSheet('AMOSTRA_TECNICA')} />
                        </div>
                    </section>

                    <section className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Settings size={12}/> Configuração Visual</h3>
                        <div className="grid gap-2">
                            <Toggle label="Exibir Pantones" active={config.pantones} onToggle={() => toggleConfig('pantones')} />
                            <Toggle label="Exibir Imagens" active={config.images} onToggle={() => toggleConfig('images')} />
                            <Toggle label="Tabela Técnica" active={config.technicalTable} onToggle={() => toggleConfig('technicalTable')} />
                            <Toggle label="Aprovações" active={config.logistics} onToggle={() => toggleConfig('logistics')} />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Metadados de Produção</h3>
                        <InputField label="Nº Desenho / Cil" value={data.numero} onChange={(v:any) => updateField('numero', v)} icon={Hash}/>
                        <InputField label="Cliente" value={data.cliente} onChange={(v:any) => updateField('cliente', v)} icon={Briefcase}/>
                        <InputField label="Base / Artigo" value={data.base} onChange={(v:any) => updateField('base', v)} icon={Layers}/>
                        <div className="grid grid-cols-2 gap-2">
                             <InputField label="Rapport" value={data.rapport} onChange={(v:any) => updateField('rapport', v)} />
                             <InputField label="Mesh" value={data.mesh} onChange={(v:any) => updateField('mesh', v)} />
                        </div>
                        <InputField label="Metragem" value={data.metragem} onChange={(v:any) => updateField('metragem', v)} icon={Ruler}/>
                        
                        <div className="pt-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block">Status do Fluxo</label>
                            <div className="flex gap-2">
                                {['AMOSTRA', 'PRODUCAO', 'TESTE'].map(s => (
                                    <button key={s} onClick={() => updateField('status', s)} className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${data.status === s ? 'bg-vingi-900 border-vingi-900 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>{s}</button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <button onClick={() => updateField('pantones', [...data.pantones, { name: 'Nova Cor', code: '00-0000 TCX', hex: '#555' }])} className="w-full py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-xl hover:bg-black transition-all">
                        <Plus size={16}/> Adicionar Pantone
                    </button>
                </aside>

                <div className="flex-1 bg-[#cbd5e1] p-4 md:p-10 overflow-y-auto custom-scrollbar flex justify-center items-start">
                    <div className="a4-container bg-white shadow-2xl flex flex-col print:shadow-none print:m-0" id="printable-area">
                        <div className="h-32 bg-[#0f172a] text-white flex items-center justify-between px-10 relative overflow-hidden shrink-0">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, #1e293b 25%, transparent 25%, transparent 50%, #1e293b 50%, #1e293b 75%, transparent 75%, transparent)', backgroundSize: '10px 10px' }}></div>
                            <div className="relative z-10 flex items-center gap-6">
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-[#0f172a] shadow-xl">
                                    {getIconForType(activeSheet)}
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase tracking-tight leading-none">
                                        {activeSheet.replace(/_/g, ' ')}
                                    </h1>
                                    <p className="text-[10px] font-mono opacity-50 mt-1 uppercase tracking-[0.4em]">VINGI OS // INDUSTRIAL CORE 7.0</p>
                                    <div className="mt-2 flex gap-2">
                                        <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase ${data.status === 'PRODUCAO' ? 'bg-green-600' : 'bg-amber-500'}`}>{data.status}</span>
                                        {data.terceirizado && <span className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-600">Serviço Externo</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right relative z-10">
                                <div className="text-lg font-black bg-white/10 px-4 py-1 rounded-xl mb-1 font-mono tracking-widest">ID: {data.id}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">{new Date().toLocaleDateString('pt-BR')} • {new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
                            </div>
                        </div>

                        <div className="p-10 flex-1 flex flex-col gap-8 overflow-hidden">
                            <div className="grid grid-cols-12 gap-8">
                                <div className="col-span-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                                        <DataField label="Cliente / Destinatário" value={data.cliente} />
                                        <DataField label="Nº do Desenho / Lote" value={data.numero} />
                                        <DataField label="Representante / Canal" value={data.representante} />
                                        <DataField label="Substrato / Base Têxtil" value={data.base} />
                                        <DataField label="Local de Processamento" value={data.fornecedor} />
                                        <DataField label="Volume / Metragem Total" value={data.metragem} />
                                    </div>
                                    
                                    <div className="grid grid-cols-4 gap-4 pt-4">
                                        <MetricBox label="Cores" value={data.qtdCores.toString()} icon={Palette} />
                                        <MetricBox label="Mesh" value={data.mesh + "m"} icon={Gauge} />
                                        <MetricBox label="Rapport" value={data.rapport} icon={Box} />
                                        <MetricBox label="Lead Time" value="12 dias" icon={Calendar} />
                                    </div>

                                    {(activeSheet === 'COZINHA_TEXTIL' || activeSheet === 'TINTURARIA') && (
                                        <div className="bg-gray-900 text-white p-6 rounded-3xl grid grid-cols-3 gap-6 shadow-xl">
                                            <div><p className="text-[9px] font-black uppercase text-gray-500 mb-1">Relação Banho</p><p className="text-xl font-bold font-mono">{data.banhoRatio}</p></div>
                                            <div><p className="text-[9px] font-black uppercase text-gray-500 mb-1">Temperatura</p><p className="text-xl font-bold font-mono">{data.temperatura}</p></div>
                                            <div><p className="text-[9px] font-black uppercase text-gray-500 mb-1">Tempo Est.</p><p className="text-xl font-bold font-mono">{data.tempo}</p></div>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-4">
                                    {config.images && (
                                        <div className="space-y-4 h-full flex flex-col">
                                            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Amostra Digital</h2>
                                            <div className="flex-1 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200 overflow-hidden flex items-center justify-center relative">
                                                {data.estampaSrc ? (
                                                    <img src={data.estampaSrc} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center opacity-20"><Palette size={48} className="mx-auto mb-2"/><p className="text-[10px] font-bold uppercase">Sem Imagem</p></div>
                                                )}
                                                <div className="absolute bottom-4 right-4 bg-black/80 text-[8px] text-white px-3 py-1 rounded-full uppercase font-black backdrop-blur-md border border-white/10">Ref_Visual_v1.0</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {config.pantones && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                        <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Paleta de Cores Industrial (TCX)</h2>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Referência Pantone Cotton System</span>
                                    </div>
                                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                        {data.pantones.map((p, i) => (
                                            <div key={i} className="flex flex-col bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden group">
                                                <div className="h-16 w-full shadow-inner" style={{ backgroundColor: p.hex }}></div>
                                                <div className="p-3">
                                                    <div className="text-[10px] font-black text-gray-800 uppercase truncate mb-0.5">{p.name}</div>
                                                    <div className="text-[11px] font-mono text-vingi-600 font-bold">{p.code}</div>
                                                    <div className="text-[8px] text-gray-400 font-bold mt-1 uppercase">Cor {i + 1}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {config.technicalTable && (
                                <div className="space-y-4">
                                    <h2 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Matriz de Execução Técnica</h2>
                                    <div className="bg-gray-50 rounded-[32px] overflow-hidden border border-gray-200">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200">
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider w-20 text-center">Pos.</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider">Especificação Química / Corante</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider w-32 text-center">Mesh / Filtro</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider w-32 text-center">Inclin.</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider text-right">Controle de Qualidade</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {data.pantones.slice(0, 4).map((p, i) => (
                                                    <tr key={i} className="hover:bg-white transition-colors group">
                                                        <td className="px-6 py-4 text-center font-mono text-sm font-black text-gray-300 group-hover:text-vingi-600">{i + 1}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg shrink-0 border border-black/5 shadow-sm" style={{ backgroundColor: p.hex }}></div>
                                                                <div>
                                                                    <div className="text-[11px] font-black text-gray-800 uppercase">{p.name}</div>
                                                                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Carga: 4.8g/kg</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-[11px] font-black text-gray-700 bg-gray-200 px-2 py-1 rounded-lg font-mono">{data.mesh}M</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono text-[11px] text-gray-500">90°</td>
                                                        <td className="px-6 py-4 text-right text-[10px] text-gray-400 italic">Inspeção Visual Obrigatória.</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {config.logistics && (
                                <div className="grid grid-cols-2 gap-12 mt-auto pt-8 border-t-2 border-gray-100 border-dashed">
                                    <div className="space-y-4">
                                        <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><HardHat size={14}/> Engenharia & Qualidade</h2>
                                        <div className="flex flex-col gap-6">
                                            <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Aprovação Técnica</span>
                                                <span className="text-[10px] font-mono opacity-20">____/____/____</span>
                                            </div>
                                            <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Laboratório (Cozinha)</span>
                                                <span className="text-[10px] font-mono opacity-20">____/____/____</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-between">
                                        <div className="space-y-6">
                                            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Truck size={14}/> Liberação Expedição</h2>
                                            <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">Checkout Final</span>
                                                <span className="text-[10px] font-mono opacity-20">____/____/____</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-4 opacity-30 mt-6 grayscale">
                                            <div className="text-right">
                                                <p className="text-[9px] font-black uppercase tracking-widest">VINGI INDUSTRIAL CORE</p>
                                                <p className="text-[7px] font-mono leading-none">SECURITY ID: VX-7.0.4-SEC</p>
                                            </div>
                                            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white"><Globe size={32}/></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-14 bg-gray-900 flex items-center justify-between px-10 text-[9px] font-bold text-gray-500 shrink-0">
                            <div className="flex items-center gap-6">
                                <span className="text-white tracking-widest uppercase">VINGI AI ERP // OS SYSTEM</span>
                                <span>|</span>
                                <span className="uppercase">Documento Oficial de Produção Têxtil</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="tracking-[0.4em] uppercase text-[8px]">PROPRIEDADE INTELECTUAL VINGI</span>
                                <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .a4-container { width: 210mm; min-height: 297mm; background: white; }
                @media print {
                    body { background: white !important; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    #printable-area { position: absolute; left: 0; top: 0; width: 210mm; margin: 0; padding: 0; z-index: 9999; }
                    .custom-scrollbar::-webkit-scrollbar { display: none; }
                }
                @page { size: A4; margin: 0; }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
};

const getIconForType = (type: SheetType) => {
    switch(type) {
        case 'COZINHA_TEXTIL': return <Beaker size={40}/>;
        case 'TINTURARIA': return <Droplets size={40}/>;
        case 'GRAVACAO_CILINDRO': return <Cpu size={40}/>;
        case 'SUBLIMACAO_PRO': return <Zap size={40}/>;
        case 'ESTAMPARIA_ROTATIVA': return <RefreshCw size={40}/>;
        default: return <FileText size={40}/>;
    }
};

const DataField = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col gap-0.5 group">
        <span className="text-[9px] font-black text-gray-300 uppercase tracking-tight group-hover:text-vingi-400 transition-colors">{label}</span>
        <span className="text-[12px] font-bold text-gray-900 uppercase truncate">{value}</span>
    </div>
);

const MetricBox = ({ label, value, icon: Icon }: any) => (
    <div className="bg-gray-50 p-4 rounded-[24px] border border-gray-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-all hover:bg-white hover:border-vingi-200">
        <div className="bg-white p-2 rounded-xl shadow-sm text-vingi-600 border border-gray-50"><Icon size={16}/></div>
        <div>
            <p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">{label}</p>
            <p className="text-sm font-black text-gray-900 tracking-tighter leading-none">{value}</p>
        </div>
    </div>
);

const TypeBtn = ({ active, icon: Icon, label, onClick }: any) => (
    <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left group ${active ? 'bg-[#0f172a] border-vingi-500 text-white shadow-2xl scale-[1.03] z-10' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-white hover:border-gray-200'}`}>
        <Icon size={18} className={active ? 'text-vingi-400' : 'text-gray-400 group-hover:text-vingi-600'} />
        <span className="text-[10px] font-black uppercase tracking-tight leading-tight">{label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-vingi-400" />}
    </button>
);

const InputField = ({ label, value, onChange, icon: Icon, type = "text", placeholder = "" }: any) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1.5">{Icon && <Icon size={12}/>} {label}</label>
        <input 
            type={type} 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            placeholder={placeholder}
            className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:border-vingi-500 focus:bg-white outline-none transition-all placeholder:text-gray-300 shadow-inner"
        />
    </div>
);

const Toggle = ({ label, active, onToggle }: any) => (
    <button onClick={onToggle} className="flex items-center justify-between w-full p-3 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 group">
        <span className={`text-[10px] font-bold uppercase transition-colors ${active ? 'text-slate-800' : 'text-gray-400'}`}>{label}</span>
        {active ? <Eye size={16} className="text-vingi-500" /> : <EyeOff size={16} className="text-gray-300" />}
    </button>
);
