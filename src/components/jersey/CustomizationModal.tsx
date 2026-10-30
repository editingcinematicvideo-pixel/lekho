import React, { useState } from 'react';
import { JerseyCustomization, JerseySize, PatchType, PrintStatus } from '../../types';
import { Shirt, Sparkles, X, Check, Flame, Award, Palette, Layers, RefreshCw } from 'lucide-react';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customization: JerseyCustomization) => void;
  initialData?: JerseyCustomization;
  itemTitle?: string;
  defaultSize?: JerseySize;
}

// Available Vinyl Print Colors with display metadata
const VINYL_COLORS = [
  { id: 'white', name: 'Pure White (সাদা)', hex: '#FFFFFF', textHex: '#FFFFFF', border: '#e2e8f0' },
  { id: 'gold', name: 'Athletic Gold (গোল্ডেন)', hex: '#F59E0B', textHex: '#FBBF24', border: '#d97706' },
  { id: 'black', name: 'Midnight Black (কালো)', hex: '#18181B', textHex: '#18181B', border: '#52525b' },
  { id: 'neon', name: 'Neon Cyber Green (নিওন)', hex: '#10B981', textHex: '#34D399', border: '#059669' },
  { id: 'silver', name: 'Metallic Silver (সিলভার)', hex: '#94A3B8', textHex: '#CBD5E1', border: '#64748b' },
];

// Jersey Preview Backdrop Colors (to preview print against different fabric colors)
const JERSEY_BG_PRESETS = [
  { id: 'emerald', name: 'Emerald', hex: '#164e3f', border: '#0f3a2f' },
  { id: 'navy', name: 'Royal Navy', hex: '#1e3a8a', border: '#172554' },
  { id: 'black', name: 'Stealth Black', hex: '#18181b', border: '#09090b' },
  { id: 'white', name: 'Clean White', hex: '#f8fafc', border: '#cbd5e1' },
  { id: 'crimson', name: 'Crimson Red', hex: '#991b1b', border: '#7f1d1d' },
];

const PRESET_PLAYERS = [
  { name: 'MESSI', num: '10' },
  { name: 'RONALDO', num: '7' },
  { name: 'BELLINGHAM', num: '5' },
  { name: 'MBAPPÉ', num: '9' },
  { name: 'VINICIUS JR', num: '7' },
  { name: 'NEYMAR JR', num: '10' },
];

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  itemTitle = 'Jersey Customization',
  defaultSize = 'L',
}) => {
  const [customName, setCustomName] = useState(initialData?.customName || '');
  const [customNumber, setCustomNumber] = useState(initialData?.customNumber || '');
  const [fontStyle, setFontStyle] = useState<string>(initialData?.fontStyle || 'Official Club Font 24/25');
  const [size, setSize] = useState<JerseySize>(initialData?.size || defaultSize);
  const [patches, setPatches] = useState<PatchType>(initialData?.patches || 'None');
  const [instructions, setInstructions] = useState(initialData?.instructions || '');
  const [extraCharge, setExtraCharge] = useState<number>(initialData?.extraCharge ?? 250);
  const [selectedColor, setSelectedColor] = useState('white');
  const [jerseyColor, setJerseyColor] = useState('emerald');

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomName(e.target.value.toUpperCase());
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setCustomNumber(val);
  };

  const handleApplyPresetPlayer = (name: string, num: string) => {
    setCustomName(name);
    setCustomNumber(num);
  };

  const handleApplyInstructionTag = (tag: string) => {
    if (instructions.includes(tag)) return;
    setInstructions((prev) => (prev ? `${prev}, ${tag}` : tag));
  };

  const handleApply = () => {
    const data: JerseyCustomization = {
      customName: customName.trim(),
      customNumber: customNumber.trim(),
      fontStyle: fontStyle.trim() || 'Official Club Font 24/25',
      size,
      patches,
      instructions: instructions.trim(),
      printStatus: initialData?.printStatus || 'order_taken',
      extraCharge: Number(extraCharge) || 0,
      copyCount: initialData?.copyCount || 0,
      dtfOrdered: initialData?.dtfOrdered || false,
      kitDetails: `Color: ${selectedColor}, Fabric: ${jerseyColor}`,
    };
    onSave(data);
    onClose();
  };

  const activeVinyl = VINYL_COLORS.find((c) => c.id === selectedColor) || VINYL_COLORS[0];
  const activeJerseyBg = JERSEY_BG_PRESETS.find((c) => c.id === jerseyColor) || JERSEY_BG_PRESETS[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2.5 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-2 sm:my-6 max-h-[94vh] flex flex-col">
        {/* Header matching Website Theme */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#164e3f] text-white flex items-center justify-center shadow-xs shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  Heat-Press Customization
                </h3>
                <span className="hidden sm:inline-block text-[11px] font-bold bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  জার্সি প্রিন্ট ও কাস্টমাইজেশন
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                {itemTitle} • Name, Number, Badges & Operator Job-Sheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Controls (7 cols) + Right Mockup Preview (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 mt-4 sm:mt-5 overflow-y-auto flex-1 pr-1 pb-2">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-4">
            {/* Quick Player Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                  Quick Player Presets (জনপ্রিয় জার্সি প্রিসেট)
                </label>
                <span className="text-[10px] text-slate-400">1-Tap Fill</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PLAYERS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPresetPlayer(p.name, p.num)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-xl border border-slate-200/90 dark:border-zinc-750 bg-slate-50 hover:bg-[#e6f4ea] dark:bg-zinc-800/80 dark:hover:bg-emerald-950/40 text-slate-700 hover:text-[#164e3f] dark:text-zinc-300 dark:hover:text-emerald-300 transition cursor-pointer"
                  >
                    {p.name} #{p.num}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Custom Name on Back (Auto-UPPERCASE)
              </label>
              <input
                type="text"
                value={customName}
                onChange={handleNameChange}
                placeholder="e.g. MESSI, TANVIR, RAFI"
                className="w-full bg-[#f8faf9] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3.5 py-2.5 text-sm font-extrabold text-[#164e3f] dark:text-emerald-400 uppercase tracking-widest focus:outline-none focus:border-[#164e3f] focus:ring-2 focus:ring-[#164e3f]/20 transition"
                maxLength={14}
              />
            </div>

            {/* Squad Number and Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Jersey Number (0-99)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customNumber}
                    onChange={handleNumberChange}
                    placeholder="10"
                    className="w-24 bg-[#f8faf9] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3 py-2 text-center text-lg font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f] focus:ring-2 focus:ring-[#164e3f]/20 transition"
                    maxLength={2}
                  />
                  <div className="flex items-center gap-1 flex-1">
                    {['10', '7', '9', '5'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCustomNumber(num)}
                        className={`flex-1 py-2 text-xs font-mono font-bold rounded-xl border transition cursor-pointer ${
                          customNumber === num
                            ? 'bg-[#164e3f] text-white border-[#164e3f]'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-transparent hover:bg-slate-200'
                        }`}
                      >
                        #{num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Jersey Size
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {(['S', 'M', 'L', 'XL', 'XXL', '3XL'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`py-2 text-xs font-extrabold rounded-xl border transition cursor-pointer ${
                        size === s
                          ? 'bg-[#164e3f] text-white border-[#164e3f] shadow-2xs'
                          : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-[#164e3f]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vinyl Print Color Picker */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1.5">
                <Palette className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                Vinyl Print Color (প্রিন্ট স্টিকার কালার)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VINYL_COLORS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColor(col.id)}
                    className={`flex items-center gap-2 p-2 rounded-2xl border text-xs font-bold transition cursor-pointer text-left ${
                      selectedColor === col.id
                        ? 'border-[#164e3f] bg-[#e6f4ea]/70 dark:bg-emerald-950/50 text-[#164e3f] dark:text-emerald-300 ring-2 ring-[#164e3f]/20'
                        : 'border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border shadow-2xs shrink-0"
                      style={{ backgroundColor: col.hex, borderColor: col.border }}
                    />
                    <span className="truncate text-[11px]">{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Style Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Font Cut / Typography (ফন্ট ও সিজন স্টাইল)
              </label>
              <input
                type="text"
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value)}
                placeholder="e.g. Official Club Font 24/25, World Cup 2026, UCL Starball"
                className="w-full bg-[#f8faf9] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f] transition"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {[
                  'Official Club Font 24/25',
                  'World Cup Official Font',
                  'UCL Starball Stencil',
                  'Retro 90s Classic Cut',
                  'Premier League Bold',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setFontStyle(chip)}
                    className={`px-2 py-0.5 text-[10px] rounded-lg border transition cursor-pointer ${
                      fontStyle === chip
                        ? 'bg-[#164e3f] text-white border-[#164e3f] font-bold'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-200'
                    }`}
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Sleeve Badges / Patches */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1.5">
                <Award className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                Sleeve & Chest Badges (হাতা ও চেস্ট ব্যাজ)
              </label>
              <select
                value={patches}
                onChange={(e) => setPatches(e.target.value as PatchType)}
                className="w-full bg-[#f8faf9] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f] transition cursor-pointer"
              >
                <option value="None">None (Clean Sleeve - কোনো ব্যাজ নেই)</option>
                <option value="UCL Starball + Foundation">UCL Starball + Foundation (+৳150)</option>
                <option value="Premier League Badge">Premier League Lion Badge (+৳150)</option>
                <option value="World Cup Champions Patch">World Cup Champions Patch (+৳150)</option>
                <option value="La Liga / Serie A">La Liga / Serie A Badge (+৳150)</option>
                <option value="Custom">Custom Tournament / Sponsor Patch (+৳200)</option>
              </select>
            </div>

            {/* Special Instructions & Quick Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Print Operator Instructions (হিট প্রেস মেশিনের নির্দেশনা)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="যেমন: নামের কার্ভ আর্চ করুন, ১৬০ ডিগ্রিতে ১৫ সেকেন্ড হিট, কোল্ড পিল..."
                className="w-full bg-[#f8faf9] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f] transition resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {[
                  'Curved Arch Name',
                  'Heat 160°C 15s',
                  'Cold Peel',
                  'Urgent Delivery Today',
                  'Gold Outline Sheen',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleApplyInstructionTag(tag)}
                    className="px-2 py-0.5 text-[10px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Customization Extra Charge */}
            <div className="bg-[#f4f7f5] dark:bg-zinc-850/80 p-3.5 rounded-2xl border border-slate-200/90 dark:border-zinc-750 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                  Customization Print Fee (কাস্টমাইজেশন চার্জ)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Added to POS order line item
                </span>
              </div>
              <div className="relative w-32 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  value={extraCharge}
                  onChange={(e) => setExtraCharge(Number(e.target.value))}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-7 pr-3 py-1.5 text-sm font-black text-[#164e3f] dark:text-emerald-400 focus:outline-none focus:border-[#164e3f] text-right"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Mockup Preview */}
          <div className="lg:col-span-5 flex flex-col items-center justify-between space-y-4 bg-[#f8faf9] dark:bg-zinc-950/70 border border-slate-200/90 dark:border-zinc-800 p-4 sm:p-5 rounded-3xl">
            <div className="w-full flex items-center justify-between">
              <div className="text-[11px] uppercase font-bold tracking-wider text-[#164e3f] dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Live Heat-Press Mockup
              </div>

              {/* Jersey Color Selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-1 rounded-xl">
                {JERSEY_BG_PRESETS.map((jb) => (
                  <button
                    key={jb.id}
                    type="button"
                    onClick={() => setJerseyColor(jb.id)}
                    title={`Jersey backdrop: ${jb.name}`}
                    className={`w-4 h-4 rounded-full border transition cursor-pointer ${
                      jerseyColor === jb.id ? 'scale-110 ring-2 ring-[#164e3f]' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: jb.hex, borderColor: jb.border }}
                  />
                ))}
              </div>
            </div>

            {/* Realistic Jersey Visual Preview */}
            <div
              className="w-full max-w-[270px] aspect-[4/5] rounded-3xl relative flex flex-col items-center justify-between p-4 shadow-xl border-2 transition-all duration-300"
              style={{
                backgroundColor: activeJerseyBg.hex,
                borderColor: activeJerseyBg.border,
              }}
            >
              {/* Jersey Raglan Sleeves & Collar */}
              <div className="w-full flex items-center justify-between px-2 pt-1">
                {/* Left Sleeve Badge */}
                <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-[7px] font-bold text-white shadow-2xs">
                  {patches !== 'None' ? '⭐' : '•'}
                </div>

                {/* Collar with Size Tag */}
                <div className="w-20 h-5 bg-black/40 backdrop-blur-xs rounded-b-2xl border-b border-x border-white/20 flex items-center justify-center">
                  <span className="text-[9px] font-extrabold text-white tracking-widest">{size}</span>
                </div>

                {/* Right Sleeve Badge */}
                <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-[7px] font-bold text-white shadow-2xs">
                  {patches !== 'None' ? '🏆' : '•'}
                </div>
              </div>

              {/* Back Print Content */}
              <div className="flex-1 flex flex-col items-center justify-center my-auto py-2">
                {/* Custom Name */}
                <div
                  className="font-black tracking-widest text-base sm:text-lg text-center uppercase drop-shadow-md select-none transition-colors duration-200"
                  style={{
                    color: activeVinyl.textHex,
                    textShadow:
                      activeJerseyBg.id === 'white' && activeVinyl.id === 'white'
                        ? '0 1px 3px rgba(0,0,0,0.8)'
                        : '0 2px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {customName || 'YOUR NAME'}
                </div>

                {/* Squad Number */}
                <div
                  className="font-black text-6xl sm:text-7xl font-mono leading-none tracking-tight my-2 drop-shadow-xl select-none transition-colors duration-200"
                  style={{
                    color: activeVinyl.textHex,
                    textShadow:
                      activeJerseyBg.id === 'white' && activeVinyl.id === 'white'
                        ? '0 2px 5px rgba(0,0,0,0.9)'
                        : '0 4px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  {customNumber || '10'}
                </div>

                {/* Typography font cut */}
                <div className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-xs text-[9px] font-semibold text-white/90 text-center max-w-[180px] truncate">
                  {fontStyle || 'Official Font'}
                </div>
              </div>

              {/* Sleeve Badge Banner */}
              <div className="w-full flex items-center justify-center gap-1.5 py-1 px-2 bg-black/50 backdrop-blur-md rounded-xl border border-white/15 text-[9px] font-bold text-white truncate shadow-xs">
                <Award className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{patches === 'None' ? 'Clean Sleeves (No Patch)' : patches}</span>
              </div>
            </div>

            {/* Print Specification Card */}
            <div className="w-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3 space-y-1.5 text-xs shadow-2xs">
              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
                <span>Print Spec:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {customName || 'NAME'} #{customNumber || '00'} ({size})
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
                <span>Vinyl Color:</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeVinyl.name}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Total Print Add-on:</span>
                <span className="font-black text-sm text-[#164e3f] dark:text-emerald-400">৳{extraCharge}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-5 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-2 bg-[#164e3f] hover:bg-[#123e32] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-[#164e3f]/20 transition cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            Apply Customization (৳{extraCharge})
          </button>
        </div>
      </div>
    </div>
  );
};
