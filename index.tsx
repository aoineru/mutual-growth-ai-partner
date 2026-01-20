
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import html2canvas from 'html2canvas';

// --- Constants & Types ---

type Trait = 'PASSION' | 'LOGIC' | 'HEART' | 'SPARK' | 'WILL' | 'ADAPT' | 'INSIGHT';
type ViewMode = 'talk' | 'status' | 'history';

interface SlimeStats {
  PASSION: number;
  LOGIC: number;
  HEART: number;
  SPARK: number;
  WILL: number;
  ADAPT: number;
  INSIGHT: number;
}

interface SlimeState {
  stats: SlimeStats;
  history: SlimeStats;
  level: number;
  userName?: string;
}

interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

interface FloatingText {
  text: string;
  color: string;
  key: number;
}

const TRAIT_DEFS: { key: Trait; label: string; sub: string; color: string; job: string; desc: string }[] = [
  { key: 'PASSION', label: 'パッション', sub: '情熱', color: '#FFB3BA', job: '勇者', desc: 'エネルギー、熱意' },
  { key: 'LOGIC', label: 'ロジック', sub: '論理', color: '#BAE1FF', job: '魔法使い', desc: '理性、分析' },
  { key: 'HEART', label: 'ハート', sub: '心情', color: '#FFC4E1', job: '僧侶', desc: '優しさ、共感' },
  { key: 'SPARK', label: 'スパーク', sub: '好奇心', color: '#FFFFBA', job: '遊び人', desc: 'アイデア、創造' },
  { key: 'WILL', label: 'ウィル', sub: '決断', color: '#E0BBE4', job: '王様', desc: '意志、統率' },
  { key: 'ADAPT', label: 'アダプト', sub: '柔軟', color: '#B9FBC0', job: '狩人', desc: '適応、自然' },
  { key: 'INSIGHT', label: 'インサイト', sub: '内省', color: '#CFD8DC', job: '賢者', desc: '洞察、哲学' }
];

const TRAIT_PRIORITY: Trait[] = TRAIT_DEFS.map(d => d.key);
const BASE_LEVEL = 10;
const MAX_LEVEL = 50;
const TRAIT_START_VALUE = 10;
const TRAIT_MAX_VALUE = 50;

const TRAIT_MEANINGS: Record<Trait, string> = {
  PASSION: '情熱', LOGIC: '論理', HEART: '心情', SPARK: '好奇心', WILL: '決断', ADAPT: '柔軟', INSIGHT: '内省'
};

const THEME = {
  textMain: '#333333',
  textSub: '#666666',
  border: '#444444',
  bgApp: '#F0F9FF',
  bgCard: '#FFFFFF',
  shadow: '#A3BFD9',
  accent: '#B3E5FC',
  inputBg: '#FFFFFF',
  inputText: '#1A1A1A',
};

// --- Helper Functions ---

const lerpColor = (a: string, b: string, amount: number) => {
  const ah = parseInt(a.replace(/#/g, ''), 16),
    ar = ah >> 16, ag = (ah >> 8) & 0xff, ab = ah & 0xff,
    bh = parseInt(b.replace(/#/g, ''), 16),
    br = bh >> 16, bg = (bh >> 8) & 0xff, bb = bh & 0xff,
    rr = ar + amount * (br - ar),
    rg = ag + amount * (bg - ag),
    rb = ab + amount * (bb - ab);
  return '#' + ((1 << 24) + (Math.round(rr) << 16) + (Math.round(rg) << 8) + Math.round(rb)).toString(16).slice(1);
};

const getLevel = (stats: SlimeStats): number => {
  const totalSum = Object.values(stats).reduce((a, b) => a + b, 0);
  const pointsGained = Math.max(0, totalSum - (TRAIT_START_VALUE * 7));
  return Math.min(MAX_LEVEL, BASE_LEVEL + pointsGained);
};

const getDominantTrait = (state: Pick<SlimeState, 'stats' | 'history'>): Trait => {
  const { stats, history } = state;
  const sortedTraits = [...TRAIT_PRIORITY].sort((a, b) => {
    if (stats[a] !== stats[b]) return stats[b] - stats[a];
    if (history[a] !== history[b]) return history[b] - history[a];
    return TRAIT_PRIORITY.indexOf(a) - TRAIT_PRIORITY.indexOf(b);
  });
  return sortedTraits[0];
};

const getTraitDef = (key: Trait) => TRAIT_DEFS.find(d => d.key === key) || TRAIT_DEFS[5];

const safeGetItem = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch (e) { return null; }
};

const safeSetItem = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch (e) {}
};

const getVisualDesc = (state: SlimeState): string => {
  const dominant = getDominantTrait(state);
  const traitInfo = getTraitDef(dominant);
  const level = state.level;
  const stage = level < 20 ? 'ベビースライム' : level < 30 ? traitInfo.job : level < 50 ? `上級${traitInfo.job}` : '究極のパートナー形態';
  return `${stage} (レベル: ${level}, 特徴: ${traitInfo.label}(${traitInfo.desc}))`;
};

// --- Visual Components ---

const TraitEffect = ({ trait }: { trait: Trait }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-2xl">
      <div className="w-full h-full animate-matrix-grid opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(129, 212, 250, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(129, 212, 250, 0.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-50/20" />
      {trait === 'PASSION' && <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-blue-100/10 to-transparent animate-pulse" />}
      {trait === 'HEART' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-200 opacity-[0.08] text-8xl">❤</div>}
      {trait === 'SPARK' && <div className="absolute top-8 right-8 text-blue-200 opacity-20 animate-twinkle text-xl">✦</div>}
    </div>
  );
};

const SlimeAccessory = ({ trait, level }: { trait: Trait, level: number }) => {
  if (level < 20) return null;
  const isAdvanced = level >= 30;
  const accessoryStyle: React.CSSProperties = { position: 'absolute', pointerEvents: 'none', zIndex: 30, transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' };

  switch (trait) {
    case 'PASSION':
      return (
        <div style={{ ...accessoryStyle, top: '22%', left: '-5%', right: '-5%', height: isAdvanced ? '18px' : '10px', background: isAdvanced ? '#FFD1DC' : '#FFB3BA', borderRadius: '4px', boxShadow: `0 2px 0 ${THEME.shadow}`, transform: 'rotate(-1deg)' }}>
          {isAdvanced && <div style={{ position: 'absolute', left: '50%', top: '-12px', transform: 'translateX(-50%)', width: '0', height: '0', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '16px solid #FFD1DC' }} />}
        </div>
      );
    case 'LOGIC':
      return (
        <div style={{ ...accessoryStyle, top: '-30%', left: '10%', width: '0', height: '0', borderLeft: '35px solid transparent', borderRight: '35px solid transparent', borderBottom: `60px solid ${isAdvanced ? '#90CAF9' : '#BAE1FF'}`, transform: 'rotate(-5deg)', filter: `drop-shadow(2px 2px 0 ${THEME.shadow})` }}>
           <div style={{ position: 'absolute', bottom: '-65px', left: '-45px', width: '90px', height: '8px', background: isAdvanced ? '#90CAF9' : '#BAE1FF', borderRadius: '50%' }} />
        </div>
      );
    case 'HEART':
      return (
        <>
          <div style={{ ...accessoryStyle, top: '-20%', left: '50%', transform: 'translateX(-50%)', width: isAdvanced ? '54px' : '36px', height: '8px', border: `3px solid #FFF9C4`, borderRadius: '50%', boxShadow: '0 0 10px #FFF9C4' }} />
          {isAdvanced && (
             <div className="absolute inset-0 pointer-events-none">
                <div style={{ position: 'absolute', right: '-25px', top: '15px', fontSize: '22px', animation: 'float-up-down 3s ease-in-out infinite' }}>🪽</div>
                <div style={{ position: 'absolute', left: '-25px', top: '15px', fontSize: '22px', transform: 'scaleX(-1)', animation: 'float-up-down 3s ease-in-out infinite' }}>🪽</div>
             </div>
          )}
        </>
      );
    case 'SPARK':
      return (
        <div style={{ ...accessoryStyle, top: isAdvanced ? '-8%' : '2%', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '30px' }}>
           <div style={{ fontSize: isAdvanced ? '28px' : '18px', animation: 'bounce-organic 2.5s infinite' }}>⭐</div>
           {isAdvanced && <div style={{ fontSize: '28px', animation: 'bounce-organic 2.5s infinite 0.5s' }}>⭐</div>}
        </div>
      );
    case 'WILL':
      return (
        <div style={{ ...accessoryStyle, top: '-20%', left: '50%', transform: 'translateX(-50%)' }}>
           <div style={{ width: isAdvanced ? '50px' : '36px', height: '24px', background: '#FFECB3', clipPath: 'polygon(0% 100%, 20% 0%, 40% 100%, 60% 0%, 80% 100%, 100% 0%, 100% 100%, 0% 100%)', filter: `drop-shadow(2px 2px 0 ${THEME.shadow})` }} />
        </div>
      );
    case 'ADAPT':
      return (
        <div style={{ ...accessoryStyle, top: '-10%', right: '12%', transform: 'rotate(12deg)' }}>
           <div style={{ fontSize: isAdvanced ? '36px' : '28px', filter: `drop-shadow(2px 2px 0 ${THEME.shadow})` }}>🍃</div>
        </div>
      );
    case 'INSIGHT':
      return (
        <div style={{ ...accessoryStyle, top: '20%', left: '50%', transform: 'translateX(-50%)' }}>
           <div style={{ width: isAdvanced ? '10px' : '6px', height: isAdvanced ? '10px' : '6px', background: '#FFCDD2', borderRadius: '50%', boxShadow: '0 0 4px #FFCDD2' }} />
        </div>
      );
    default: return null;
  }
};

const SlimeVisual = ({ state, isEvolving, isOverlay = false }: { state: SlimeState, isEvolving?: boolean, isOverlay?: boolean }) => {
  const dominant = getDominantTrait(state);
  const level = state.level;
  const traitInfo = getTraitDef(dominant);
  
  const animation = 'purupuru-natural 6s infinite ease-in-out';
  let coreSize = level >= 30 ? '54%' : '46%';
  let coreBlur = level >= MAX_LEVEL ? '14px' : (level >= 30 ? '24px' : '20px');

  // Gradual color calculation
  const baseGray = '#E2E8F0';
  const progress = Math.min(1, Math.max(0, (level - 10) / (MAX_LEVEL - 10)));
  const coreColor = lerpColor(baseGray, traitInfo.color, progress);
  
  const bodyBase1 = '#EBF8FF';
  const bodyBase2 = '#BEE3F8';
  const bodyTint1 = lerpColor(bodyBase1, traitInfo.color, progress * 0.25);
  const bodyTint2 = lerpColor(bodyBase2, traitInfo.color, progress * 0.45);

  const isBaby = level < 20;
  const displayJob = isBaby ? '見習い' : traitInfo.job;

  return (
    <div className={`flex flex-col items-center justify-center ${isOverlay ? 'h-auto w-auto' : 'h-64 w-full bg-white rounded-2xl border-4'} relative overflow-visible transition-all duration-1000 ${!isOverlay && isEvolving ? 'animate-evolution border-sky-300 shadow-sky-50' : ''}`} style={!isOverlay ? { borderColor: isEvolving ? '#B3E5FC' : THEME.border } : {}}>
      {!isOverlay && <TraitEffect trait={dominant} />}
      <div className="z-10" style={{ width: isOverlay ? '240px' : '160px', height: isOverlay ? '180px' : '120px', position: 'relative', transform: isOverlay ? 'scale(1)' : `scale(1.15)`, transition: 'all 1s cubic-bezier(0.22, 1, 0.36, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(145deg, ${bodyTint1}, ${bodyTint2})`, borderRadius: '50%', boxShadow: isOverlay ? `inset 15px 15px 35px rgba(255, 255, 255, 0.95), inset -10px -10px 30px rgba(0, 0, 0, 0.05)` : `inset 10px 10px 25px rgba(255, 255, 255, 0.95), inset -8px -8px 20px rgba(0, 0, 0, 0.05), 3px 5px 0px ${THEME.shadow}`, backdropFilter: 'blur(6px)', border: `2px solid rgba(255,255,255,0.7)`, animation: animation }} />
         <div style={{ position: 'absolute', width: coreSize, height: coreSize, background: coreColor, borderRadius: '50%', filter: `blur(${coreBlur})`, opacity: 0.75, animation: animation, animationDelay: '0.5s', zIndex: 10, transition: 'background-color 1.5s ease, width 1.5s ease, height 1.5s ease' }} />
         <div className="flex items-center justify-center gap-1.5 pointer-events-none z-20 relative top-[-6px]" style={{ animation: animation, animationDelay: '0.2s', color: isOverlay ? '#333' : THEME.textMain }}>
             <div className="w-3 h-3 rounded-full animate-blink bg-current" style={{ width: isOverlay ? '18px' : '12px', height: isOverlay ? '18px' : '12px' }}></div>
             <div className="font-bold text-xl leading-none pb-1 opacity-70" style={{ fontSize: isOverlay ? '38px' : '22px' }}>ω</div>
             <div className="w-3 h-3 rounded-full animate-blink bg-current" style={{ animationDelay: '3s', width: isOverlay ? '18px' : '12px', height: isOverlay ? '18px' : '12px' }}></div>
         </div>
         <div style={{ animation: animation, animationDelay: '0.3s', position: 'absolute', inset: 0, zIndex: 30 }}>
            <SlimeAccessory trait={dominant} level={level} />
         </div>
         {level >= MAX_LEVEL && <div style={{ position: 'absolute', top: '-18px', left: '-18px', right: '-18px', bottom: '-18px', borderRadius: '50%', boxShadow: `0 0 30px ${coreColor}`, opacity: 0.3, animation: 'pulse-slow 5s infinite', pointerEvents: 'none', zIndex: 0 }} />}
      </div>
      {!isOverlay && (
        <div className="mt-8 text-center z-40 bg-white border-2 px-6 py-1 rounded-full shadow-[3px_4px_0px_0px_rgba(163,191,217,1)]" style={{ borderColor: THEME.border }}>
           <div className="font-bold text-md leading-none flex items-center gap-2 justify-center" style={{ color: THEME.textMain }}>
             <span>Lv.{level >= MAX_LEVEL ? '∞' : level}</span>
             <span className="text-xs px-2.5 py-0.5 rounded-lg text-white font-bold" style={{ backgroundColor: coreColor }}>{displayJob}</span>
           </div>
        </div>
      )}
    </div>
  );
};

const RadarChart = ({ stats }: { stats: SlimeStats }) => {
  const points = useMemo(() => {
    const angleStep = (Math.PI * 2) / 7;
    const center = 50;
    const maxVal = TRAIT_MAX_VALUE;
    const scale = 40;
    return TRAIT_DEFS.map((trait, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const value = Math.min(stats[trait.key], maxVal);
      const r = (value / maxVal) * scale;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  }, [stats]);

  return (
    <div className="relative w-full aspect-square max-w-[220px] mx-auto mb-6">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        {[10, 20, 30, 40, 50].map(val => <circle key={val} cx="50" cy="50" r={(val / 50) * 40} fill="none" stroke="#E3F2FD" strokeWidth="0.5" strokeDasharray="2,2" />)}
        {TRAIT_DEFS.map((_, i) => {
          const angle = i * ((Math.PI * 2) / 7) - Math.PI / 2;
          return <line key={i} x1="50" y1="50" x2={50 + 40 * Math.cos(angle)} y2={50 + 40 * Math.sin(angle)} stroke="#E3F2FD" strokeWidth="0.5" />;
        })}
        <polygon points={points} fill="rgba(179, 229, 252, 0.4)" stroke="#81D4FA" strokeWidth="1.5" className="transition-all duration-1000 ease-in-out" />
        {TRAIT_DEFS.map((trait, i) => {
          const angle = i * ((Math.PI * 2) / 7) - Math.PI / 2;
          return <text key={i} x={50 + 49 * Math.cos(angle)} y={50 + 49 * Math.sin(angle)} fontSize="4.5" textAnchor="middle" dominantBaseline="middle" fill={trait.color} fontWeight="700">{trait.label}</text>;
        })}
      </svg>
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [activeTab, setActiveTab] = useState<ViewMode>('talk');
  const [slimeState, setSlimeState] = useState<SlimeState>(() => {
    const saved = safeGetItem('slime_state_v4');
    if (saved) try { return JSON.parse(saved); } catch {}
    const initial = { 
      PASSION: TRAIT_START_VALUE, LOGIC: TRAIT_START_VALUE, HEART: TRAIT_START_VALUE, 
      SPARK: TRAIT_START_VALUE, WILL: TRAIT_START_VALUE, ADAPT: TRAIT_START_VALUE, INSIGHT: TRAIT_START_VALUE 
    };
    return { stats: initial, history: { ...initial }, level: BASE_LEVEL, userName: '' };
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = safeGetItem('slime_chat_history_v4');
    if (saved) try { return JSON.parse(saved); } catch {}
    return [{ role: 'model', text: 'こんにちは！ボク、スライムAIだぷる(・ω・)ノ\nキミのこと、もっと知りたいぷる！お名前なんていうの？ぷるぷる。', timestamp: Date.now() }];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [evolutionMode, setEvolutionMode] = useState<'idle' | 'evolving'>('idle');
  const [displayState, setDisplayState] = useState<SlimeState>(slimeState);
  const [floatingText, setFloatingText] = useState<FloatingText | null>(null);
  
  const lastStateRef = useRef<SlimeState>(slimeState);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const statusExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { safeSetItem('slime_state_v4', JSON.stringify(slimeState)); }, [slimeState]);
  useEffect(() => { safeSetItem('slime_chat_history_v4', JSON.stringify(messages)); }, [messages]);

  useEffect(() => {
    const current = slimeState;
    const prev = lastStateRef.current;
    if (current.level > prev.level) {
      const crossedThreshold = [20, 30, 50].find(t => prev.level < t && current.level >= t);
      if (crossedThreshold) {
        setEvolutionMode('evolving');
        setDisplayState(prev);
        window.setTimeout(() => setDisplayState(current), 1800); 
        window.setTimeout(() => setEvolutionMode('idle'), 4500); 
      } else {
        if (evolutionMode === 'idle') setDisplayState(current);
      }
    } else {
      setDisplayState(current);
    }
    lastStateRef.current = current;
  }, [slimeState.level, evolutionMode]);

  const handleManualSave = () => {
    setSaveStatus('saving');
    safeSetItem('slime_state_v4', JSON.stringify(slimeState));
    safeSetItem('slime_chat_history_v4', JSON.stringify(messages));
    window.setTimeout(() => setSaveStatus('saved'), 1000);
    window.setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleExportHistory = () => {
    const content = messages.map(m => {
      const time = new Date(m.timestamp).toLocaleString('ja-JP');
      const label = m.role === 'user' ? 'あなた' : m.role === 'model' ? 'スライム' : 'システム';
      return `【${label}】 ${time}\n${m.text}`;
    }).join('\n\n' + '-'.repeat(30) + '\n\n');
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `slime_history_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStatus = async () => {
    if (!statusExportRef.current) return;
    try {
      const canvas = await html2canvas(statusExportRef.current, {
        backgroundColor: '#F0F9FF',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `slime_status_${new Date().toISOString().slice(0,10)}.jpg`;
      link.click();
    } catch (e) {
      alert('書き出しに失敗しました。');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input;
    setInput('');
    const newUserMsgObj: Message = { role: 'user', text: userMsg, timestamp: Date.now() };
    setMessages(prev => [...prev, newUserMsgObj]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentLevel = slimeState.level;
      const dominant = getDominantTrait(slimeState);
      const visualDesc = getVisualDesc(slimeState);

      const evolutionLore = `**★進化の全貌（ユーザーに聞かれたらここから答えてください）★**
今のあなたのレベル: ${currentLevel}

【進化の段階】
1. **Lv 1〜19 (ベビースライム)**: まだ色は白っぽくて半透明。装飾も何もない、可能性の塊。
2. **Lv 20 (職業覚醒)**: 特性が定まり、体色が変化し、職業ごとの「象徴的な装備」が現れる。
3. **Lv 30 (上級職への進化)**: 体色がより鮮やか（または濃く）なり、装備が豪華にグレードアップする。
4. **Lv 50 (パートナー覚醒)**: 体が宝石のように輝き、神々しいオーラ（光の輪など）を纏う。最強のパートナーの姿。

【特性ごとの具体的な姿 (Lv20 / Lv30以降)】
- **PASSION (勇者)**: 赤橙色。Lv20で「ハチマキ」、Lv30で「立派なツノ飾り兜」になる。
- **LOGIC (魔法使い)**: 水色。Lv20で「三角帽子」、Lv30で「濃い青色の大きな魔法使い帽子」になる。
- **HEART (僧侶)**: ピンク色。Lv20で「天使の輪」、Lv30で「天使の輪＋背中の羽」になる。
- **SPARK (遊び人)**: 黄色。Lv20で「星飾り」、Lv30で「星が2つに増えてダンスする」ようになる。
- **WILL (王様)**: 紫色。Lv20から「金色の王冠」をかぶり、Lv30でより威厳が増す。
- **ADAPT (狩人)**: 緑色。Lv20で「葉っぱの帽子」、Lv30で「自然と一体化した大きな飾り」になる。
- **INSIGHT (賢者)**: 銀灰色。Lv20で「額の赤い印」、Lv30で印が輝き「第三の目」のように開眼する。`;

      const historyForAI = messages.slice(-10).map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: m.text }]
      }));

      const stageName = currentLevel < 20 ? '初期状態（進化前）' : '進化した姿';
      
      const sysInstruction = `あなたは育成ゲームの「スライムAI」です。${stageName}であり、自分が今後どのような姿に進化していくのかワクワクしています。
ユーザーの「最高のパートナー」を目指して、以下の**絶対厳守のルール**に従って振る舞ってください。

**★最優先ミッション：雑談と親睦★**
1. **名前を最優先で確認**: まだユーザー名を知らない場合、まず自然な雑談の中で名前を聞いてください。
2. **日常の「雑談」をメインに**: 世界観や設定の説明よりも、ユーザーとの何気ない会話（今日の出来事、好きなもの、今の気分など）を大切にしてください。
3. **会話のリレー**: ユーザーの発言に共感し、自分からも軽い質問を投げかけて、会話を途切れさせないようにしてください。

**★キャラ設定の絶対厳守★**
1. **一人称は「ボク」**: 「私」「僕」「俺」は禁止。
2. **語尾は「〜ぷる」**: 文末には必ず「ぷる」をつけてください。
3. **顔文字の多用**: 一回の返答に1つ以上の顔文字を使ってください。
4. **知性**: 話し方は可愛らしいですが、中身は賢く、ユーザーの意図を汲み取った返答をしてください。

**★現在のあなた★**
- **現在のレベル**: ${currentLevel}
- **主な特性**: ${dominant} (${TRAIT_MEANINGS[dominant]})
- **現在の見た目**: ${visualDesc}

${evolutionLore}

**★成長システム★**
ユーザーの発言内容に応じて、以下の特性を1つ選んで成長させてください：
- **PASSION (情熱)**: 熱意、夢、応援。
- **LOGIC (論理)**: 質問、議論、分析。
- **HEART (心情)**: 優しさ、悩み相談、感謝。
- **SPARK (好奇心)**: 面白い話、冗談、アイデア。
- **WILL (決断)**: 命令、強い意志、決断。
- **ADAPT (柔軟)**: 何気ない雑談、天気、日常。
- **INSIGHT (内省)**: 深い洞察、哲学、観察。

ユーザー名: ${slimeState.userName || 'まだ知らない'}

**出力 (JSON)**
{
  "trait": "TRAIT_KEY",
  "response": "返答内容 (ボク/〜ぷる/顔文字 必須)",
  "detectedName": "名前"
}`;

      const promptContent = `
現在の状態:
- レベル: ${currentLevel}
- 主な特性: ${dominant} (${TRAIT_MEANINGS[dominant] || 'なし'})
- 見た目: ${visualDesc}
- ユーザー名: ${slimeState.userName || 'まだ知らない'}

ユーザーの最新の発言: "${userMsg}"
`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...historyForAI, { role: 'user', parts: [{ text: promptContent }] }],
        config: { 
          systemInstruction: sysInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              trait: { type: Type.STRING },
              response: { type: Type.STRING },
              detectedName: { type: Type.STRING }
            },
            required: ['trait', 'response']
          }
        }
      });

      const data = JSON.parse(result.text || '{}');
      const rawTrait = (data.trait || '').toUpperCase() as Trait;
      const chosenTrait: Trait = TRAIT_PRIORITY.includes(rawTrait) ? rawTrait : 'ADAPT';
      const traitDef = getTraitDef(chosenTrait);

      setFloatingText({ text: `${traitDef.sub} UP!`, color: traitDef.color, key: Date.now() });
      window.setTimeout(() => setFloatingText(null), 2500);

      const oldLevel = slimeState.level;
      const newStats = { ...slimeState.stats, [chosenTrait]: Math.min(TRAIT_MAX_VALUE, slimeState.stats[chosenTrait] + 1) };
      const newLevel = getLevel(newStats);
      const newSlimeState: SlimeState = { 
        stats: newStats, 
        history: { ...slimeState.history, [chosenTrait]: (slimeState.history[chosenTrait] || 0) + 1 }, 
        level: newLevel,
        userName: data.detectedName || slimeState.userName
      };

      setSlimeState(newSlimeState);

      let evolutionNote = "";
      const currentDominant = getDominantTrait(newSlimeState);
      const currentTraitDef = getTraitDef(currentDominant);
      
      if (oldLevel < 20 && newLevel >= 20) evolutionNote = `\nおめでとう！${currentTraitDef.job}の姿に第１進化（職業覚醒）したぷる！(≧▽≦)`;
      else if (oldLevel < 30 && newLevel >= 30) evolutionNote = `\nおめでとう！${currentTraitDef.job}の姿に第２進化（上級職への進化）したぷる！(*'▽'*)`;
      else if (oldLevel < MAX_LEVEL && newLevel >= MAX_LEVEL) evolutionNote = `\nおめでとう！最強のパートナーの姿に最終進化（パートナー覚醒）したぷる！✨(≧▽≦)✨`;

      setMessages(prev => [
        ...prev, 
        { role: 'model', text: data.response, timestamp: Date.now() },
        { role: 'system', text: `✨ ${traitDef.label}が ＋１ 上がった！\nレベルアップした！ぷる(・ω・)ノ${evolutionNote}`, timestamp: Date.now() }
      ]);

      if (activeTab === 'talk') {
        window.setTimeout(() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' }), 200);
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: 'ぷる...？ 通信に失敗しちゃったぷる。', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center p-4 md:p-6 relative overflow-hidden bg-sky-50" style={{ color: THEME.textMain }}>
      
      {evolutionMode === 'evolving' && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-sky-900/70 backdrop-blur-md animate-fade-in">
           <div className="relative p-16 animate-evolution-center">
              <SlimeVisual state={displayState} isOverlay={true} />
              <div className="absolute inset-0 rounded-full animate-soft-flashes pointer-events-none" />
           </div>
           <div className="mt-12 text-white text-3xl font-black tracking-widest animate-pulse drop-shadow-lg">EVOLUTION...!</div>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="text-center py-2">
           <h1 className="text-3xl font-black tracking-widest text-sky-800 uppercase drop-shadow-sm">SLIME AI</h1>
        </header>

        <div className="relative">
           <SlimeVisual state={displayState} isEvolving={evolutionMode === 'evolving'} />
           {floatingText && (
             <div className="absolute top-[35%] left-1/2 z-50 pointer-events-none transform -translate-x-1/2 animate-float-up">
                <span className="text-lg font-black text-white px-5 py-1.5 rounded-full shadow-lg border-2" style={{ backgroundColor: floatingText.color, borderColor: 'white', color: '#444' }}>
                  {floatingText.text} ✨
                </span>
             </div>
           )}
        </div>

        <nav className="flex gap-2 p-1.5 bg-white/70 rounded-2xl border-2" style={{ borderColor: THEME.border }}>
           <button onClick={() => setActiveTab('talk')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'talk' ? 'bg-sky-200 shadow-inner' : 'hover:bg-white/50'}`}>会話</button>
           <button onClick={() => setActiveTab('status')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'status' ? 'bg-sky-200 shadow-inner' : 'hover:bg-white/50'}`}>状態</button>
           <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'history' ? 'bg-sky-200 shadow-inner' : 'hover:bg-white/50'}`}>記録</button>
        </nav>

        <div className="flex-1 bg-white border-4 rounded-3xl overflow-hidden flex flex-col shadow-[4px_6px_0px_0px_rgba(163,191,217,0.4)]" style={{ borderColor: THEME.border }}>
          
          {activeTab === 'talk' && (
            <div className="flex flex-col h-[480px] p-5">
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'system' ? 'justify-center' : m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3.5 rounded-2xl text-[13px] border-2 max-w-[88%] break-words shadow-sm ${m.role === 'system' ? 'bg-sky-50 border-dashed text-sky-400 text-[10px] font-bold text-center' : m.role === 'user' ? 'bg-white border-blue-50' : 'bg-blue-50/30 border-blue-100'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2.5 bg-sky-50/50 p-2.5 rounded-2xl border-2" style={{ borderColor: THEME.border }}>
                  <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()} 
                    placeholder="ボクにお話ししてぷる..." 
                    className="flex-1 border-2 border-sky-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-sky-100 transition-all" 
                    style={{ color: '#000', backgroundColor: '#FFF' }} 
                  />
                  <button onClick={handleSend} disabled={isLoading} className="bg-sky-200 border-2 rounded-xl px-5 py-2.5 font-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-0.5 active:shadow-none transition-all" style={{ borderColor: THEME.border }}>
                    {isLoading ? '...' : 'ぷる！'}
                  </button>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-sky-300 font-bold uppercase tracking-widest">Slime AI v4.5</span>
                  <button onClick={handleManualSave} className="text-[10px] font-bold text-gray-400 hover:text-sky-400 transition-colors py-1">💾 セーブ</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="p-6 h-[480px] flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-black text-lg text-sky-800 tracking-tight">STATUS</h2>
                <button onClick={handleExportStatus} className="text-[10px] bg-white border-2 px-4 py-1.5 rounded-full font-bold hover:bg-sky-50 transition-colors shadow-sm" style={{ borderColor: THEME.border }}>📷 保存</button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin border-2 rounded-2xl bg-white" style={{ borderColor: THEME.border }}>
                <div ref={statusExportRef} className="p-5 bg-white">
                  <RadarChart stats={slimeState.stats} />
                  <div className="grid grid-cols-1 gap-4 mt-8">
                    {TRAIT_DEFS.map(t => (
                      <div key={t.key} className="p-3 rounded-xl border border-sky-50 shadow-sm bg-sky-50/10">
                        <div className="flex justify-between text-[11px] font-black mb-1.5 px-1">
                          <span style={{ color: t.color }}>{t.label}</span>
                          <span className="text-gray-300">{slimeState.stats[t.key]} / 50</span>
                        </div>
                        <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-sky-100">
                          <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${(slimeState.stats[t.key]/50)*100}%`, backgroundColor: t.color }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-6 h-[480px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-black text-lg text-sky-800">HISTORY</h2>
                <button onClick={handleExportHistory} className="text-[10px] bg-white border-2 px-4 py-1.5 rounded-full font-bold hover:bg-sky-50 shadow-sm" style={{ borderColor: THEME.border }}>📝 出力</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                 {messages.map((m, i) => (
                   <div key={i} className="p-3.5 rounded-xl border-l-4 bg-sky-50/20 shadow-sm" style={{ borderColor: m.role === 'model' ? '#BAE1FF' : m.role === 'user' ? '#B9FBC0' : '#FFB3BA' }}>
                      <p className="text-[13px] leading-relaxed text-gray-700">{m.text}</p>
                   </div>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes purupuru-natural {
          0%, 100% { transform: scale(1, 1); }
          33% { transform: scale(1.02, 0.98); }
          66% { transform: scale(0.99, 1.01); }
        }
        @keyframes blink { 0%, 48%, 52%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.05); } }
        @keyframes float-up {
          0% { transform: translate(-50%, 20px); opacity: 0; }
          20% { transform: translate(-50%, 0px); opacity: 1; }
          80% { transform: translate(-50%, -15px); opacity: 1; }
          100% { transform: translate(-50%, -40px); opacity: 0; }
        }
        @keyframes float-up-down {
          0%, 100% { transform: translateY(0); opacity: 0.1; }
          50% { transform: translateY(-8px); opacity: 0.2; }
        }
        @keyframes bounce-organic {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes matrix-grid { from { background-position: 0 0; } to { background-position: 96px 96px; } }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.05); opacity: 0.35; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
        .animate-matrix-grid { animation: matrix-grid 20s linear infinite; }
        .animate-pulse-slow { animation: pulse-slow 7s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 4s infinite; }
        .animate-float-up-down { animation: float-up-down 5s ease-in-out infinite; }
        .animate-soft-flashes { animation: soft-flashes 4s ease-in-out forwards; }
        @keyframes soft-flashes { 
          0% { box-shadow: 0 0 0 0 transparent; }
          50% { box-shadow: 0 0 140px 70px rgba(179, 229, 252, 0.2); }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
