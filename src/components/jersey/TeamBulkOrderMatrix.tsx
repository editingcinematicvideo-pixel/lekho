import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TeamBulkOrder, TeamTournamentPlayer } from '../../types';
import { dbService } from '../../services/db';
import {
  Users,
  Plus,
  Trash2,
  Printer,
  Save,
  Trophy,
  X,
} from 'lucide-react';

export const TeamBulkOrderMatrix: React.FC = () => {
  const { currentTenant, showToast } = useApp();
  const [orders, setOrders] = useState<TeamBulkOrder[]>(() =>
    dbService.getTeamOrders(currentTenant.id)
  );
  const [isCreating, setIsCreating] = useState(false);
  const [activePrintOrder, setActivePrintOrder] = useState<TeamBulkOrder | null>(null);

  // Form states for new order
  const [teamName, setTeamName] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [kitDesign, setKitDesign] = useState('');
  const [ratePerPiece, setRatePerPiece] = useState<number>(1100);
  const [advancePaid, setAdvancePaid] = useState<number>(2000);
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes] = useState('');

  // Matrix players list
  const [players, setPlayers] = useState<TeamTournamentPlayer[]>([
    { id: '1', name: 'RAKIB', number: '10', size: 'L', position: 'Forward' },
    { id: '2', name: 'SHAKIB', number: '7', size: 'M', position: 'Winger' },
    { id: '3', name: 'SOHAN', number: '1', size: 'XL', position: 'GK' },
    { id: '4', name: 'EMRAN', number: '4', size: 'L', position: 'Defender' },
    { id: '5', name: 'HASIB', number: '8', size: 'M', position: 'Midfield' },
  ]);

  const reload = () => {
    setOrders(dbService.getTeamOrders(currentTenant.id));
  };

  const handleAddPlayerRow = () => {
    setPlayers((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: '',
        number: '',
        size: 'L',
        position: 'Player',
      },
    ]);
  };

  const handleUpdatePlayer = (id: string, field: keyof TeamTournamentPlayer, value: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          if (field === 'name') {
            return { ...p, name: value.toUpperCase() };
          }
          if (field === 'number') {
            return { ...p, number: value.replace(/[^0-9]/g, '').slice(0, 2) };
          }
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 1) {
      showToast('At least one player required in team roster', 'error');
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const totalPlayersCount = players.length;
  const subtotal = totalPlayersCount * ratePerPiece;
  const dueAmount = Math.max(0, subtotal - advancePaid);

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !contactPhone) {
      showToast('Team name and contact phone are required', 'error');
      return;
    }

    const newOrder: TeamBulkOrder = {
      id: `team_${Date.now()}`,
      shopId: currentTenant.id,
      teamName: teamName.trim(),
      tournamentName: tournamentName.trim() || 'Custom Tournament',
      contactPerson: contactPerson.trim() || 'Team Manager',
      contactPhone: contactPhone.trim(),
      kitDesign: kitDesign.trim() || 'Standard Sublimation Print',
      players,
      ratePerPiece,
      subtotal,
      advancePaid,
      dueAmount,
      deliveryDate,
      status: 'confirmed',
      notes,
      createdAt: new Date().toISOString(),
    };

    dbService.addTeamOrder(currentTenant.id, newOrder);
    reload();
    setIsCreating(false);
    showToast(`Team Order for "${teamName}" confirmed with ${players.length} players!`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* Top Banner (LEKHO Light Design System) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-[#1f8a5b] dark:text-emerald-400 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Bulk Team & Tournament Matrix Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Spreadsheet-style multi-row roster entry for sports clubs, corporate leagues, and batch print jobs
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center justify-center gap-2 bg-[#164e3f] hover:bg-[#123e32] text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          {isCreating ? 'View Past Orders' : '+ New Team Roster Matrix'}
        </button>
      </div>

      {/* Creator Form */}
      {isCreating ? (
        <form
          onSubmit={handleSaveOrder}
          className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-6 shadow-2xs"
        >
          <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#1f8a5b] dark:text-emerald-400">
              1. Tournament & Team Specifications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Uttara Super Kings FC"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Tournament / League
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="e.g. BUET Alumni Cup 2026"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Contact Person & Phone *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Name"
                    className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="017..."
                    className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-2.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Kit Design / Color
                </label>
                <input
                  type="text"
                  value={kitDesign}
                  onChange={(e) => setKitDesign(e.target.value)}
                  placeholder="e.g. Crimson Red with Gold trim"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>
          </div>

          {/* Roster Spreadsheet Matrix */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#1f8a5b] dark:text-emerald-400">
                  2. Player Roster Spreadsheet Matrix ({players.length} Jerseys)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Names auto-transform to UPPERCASE. Numbers are validated for printing.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddPlayerRow}
                className="flex items-center gap-1.5 bg-[#e6f4ea] hover:bg-emerald-100 text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Player Row</span>
              </button>
            </div>

            <div className="border border-slate-200/90 dark:border-zinc-800 rounded-2xl overflow-x-auto bg-white dark:bg-zinc-950">
              <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
                <thead className="bg-[#f4f7f5] dark:bg-zinc-900 border-b border-slate-200/80 dark:border-zinc-800 text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Player Name on Back</th>
                    <th className="p-3 w-28">Jersey No</th>
                    <th className="p-3 w-32">Size</th>
                    <th className="p-3 w-36">Position (Opt)</th>
                    <th className="p-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {players.map((player, idx) => (
                    <tr key={player.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition">
                      <td className="p-3 text-center font-mono text-slate-400 dark:text-zinc-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={player.name}
                          onChange={(e) => handleUpdatePlayer(player.id, 'name', e.target.value)}
                          placeholder="e.g. NAFIS"
                          className="w-full bg-[#f4f7f5] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-750 rounded-xl px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#164e3f] dark:text-emerald-400 focus:outline-none focus:border-[#164e3f]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={player.number}
                          onChange={(e) => handleUpdatePlayer(player.id, 'number', e.target.value)}
                          placeholder="10"
                          className="w-full bg-[#f4f7f5] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-750 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={player.size}
                          onChange={(e) => handleUpdatePlayer(player.id, 'size', e.target.value)}
                          className="w-full bg-[#f4f7f5] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-750 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
                        >
                          <option value="S">S (36")</option>
                          <option value="M">M (38")</option>
                          <option value="L">L (40")</option>
                          <option value="XL">XL (42")</option>
                          <option value="XXL">XXL (44")</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={player.position || ''}
                          onChange={(e) => handleUpdatePlayer(player.id, 'position', e.target.value)}
                          placeholder="Midfield / GK"
                          className="w-full bg-[#f4f7f5] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-750 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer(player.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing & Advance Summary */}
          <div className="bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                Rate Per Piece (৳)
              </label>
              <input
                type="number"
                value={ratePerPiece}
                onChange={(e) => setRatePerPiece(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-750 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                Advance Received (৳)
              </label>
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-750 rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#1f8a5b] dark:text-emerald-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                Delivery Due (৳)
              </label>
              <div className="text-base font-mono font-bold text-rose-600 dark:text-rose-400 py-1.5">
                ৳{dueAmount}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Grand Total ({players.length} pcs)
              </span>
              <div className="text-2xl font-mono font-black text-slate-900 dark:text-white">
                ৳{subtotal}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-[#164e3f] hover:bg-[#123e32] text-white px-6 py-2.5 rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Team Order & Generate Job Sheet</span>
            </button>
          </div>
        </form>
      ) : (
        /* Orders list */
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3 shadow-2xs">
              <Users className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                No Team Orders Recorded Yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-500 max-w-sm mx-auto">
                Create a spreadsheet-style tournament matrix for whole squads with player numbers and sizes.
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 text-slate-800 dark:text-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      {order.teamName}
                    </span>
                    <span className="text-[11px] font-bold bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                      {order.tournamentName}
                    </span>
                    <span className="text-[10px] bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-zinc-700 font-mono font-bold">
                      {order.players.length} Jerseys
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 flex flex-wrap items-center gap-3">
                    <span>
                      Contact:{' '}
                      <strong className="text-slate-800 dark:text-zinc-200">
                        {order.contactPerson}
                      </strong>{' '}
                      ({order.contactPhone})
                    </span>
                    <span>•</span>
                    <span>
                      Delivery:{' '}
                      <strong className="text-slate-800 dark:text-zinc-200 font-mono">
                        {order.deliveryDate}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Design:{' '}
                      <strong className="text-slate-800 dark:text-zinc-200">
                        {order.kitDesign}
                      </strong>
                    </span>
                  </div>

                  {/* Size distribution chips */}
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => {
                      const count = order.players.filter((p) => p.size === sz).length;
                      if (count === 0) return null;
                      return (
                        <span
                          key={sz}
                          className="text-[10px] font-mono bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 px-2.5 py-0.5 rounded-lg text-slate-700 dark:text-zinc-300"
                        >
                          {sz}: <strong>{count}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-zinc-800">
                  <div className="text-left md:text-right">
                    <div className="text-base font-mono font-extrabold text-slate-900 dark:text-white">
                      ৳{order.subtotal}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                      Adv: <span className="text-[#1f8a5b] dark:text-emerald-400 font-bold">৳{order.advancePaid}</span> • Due:{' '}
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        ৳{order.dueAmount}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActivePrintOrder(order)}
                    className="flex items-center gap-1.5 bg-[#e6f4ea] hover:bg-emerald-100 text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-300 px-3.5 py-2 rounded-2xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Manifest</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Printable Team Manifest Dialog */}
      {activePrintOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#1f8a5b]" />
                <span>Team Roster Master Sheet ({activePrintOrder.teamName})</span>
              </h3>
              <button
                onClick={() => setActivePrintOrder(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              id="printable-job-sheet"
              className="p-4 bg-white text-zinc-900 rounded-2xl my-4 space-y-4 border border-slate-200"
            >
              <div className="border-b-2 border-black pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase">{currentTenant.name}</h1>
                  <p className="text-xs text-zinc-600">
                    {currentTenant.marketMallName} • Team Bulk Order Manifest
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-base font-black">{activePrintOrder.teamName}</div>
                  <div className="text-xs text-zinc-600">{activePrintOrder.tournamentName}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border border-zinc-300 p-2 rounded">
                <div>
                  <strong>Manager:</strong> {activePrintOrder.contactPerson} (
                  {activePrintOrder.contactPhone})
                </div>
                <div>
                  <strong>Delivery Date:</strong> {activePrintOrder.deliveryDate}
                </div>
                <div>
                  <strong>Rate:</strong> ৳{activePrintOrder.ratePerPiece}/pc
                </div>
                <div>
                  <strong>Due:</strong> ৳{activePrintOrder.dueAmount}
                </div>
              </div>

              <table className="w-full text-left text-xs border border-black border-collapse">
                <thead>
                  <tr className="bg-zinc-200 border-b border-black font-bold">
                    <th className="p-1.5 border-r border-black w-8 text-center">#</th>
                    <th className="p-1.5 border-r border-black">PRINT NAME</th>
                    <th className="p-1.5 border-r border-black text-center w-16">NUMBER</th>
                    <th className="p-1.5 border-r border-black text-center w-16">SIZE</th>
                    <th className="p-1.5 text-center w-24">PRESS CHECK</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintOrder.players.map((p, i) => (
                    <tr key={p.id} className="border-b border-zinc-300">
                      <td className="p-1.5 border-r border-black text-center font-bold">{i + 1}</td>
                      <td className="p-1.5 border-r border-black font-black uppercase tracking-wider">
                        {p.name}
                      </td>
                      <td className="p-1.5 border-r border-black text-center font-black font-mono">
                        {p.number}
                      </td>
                      <td className="p-1.5 border-r border-black text-center font-bold">{p.size}</td>
                      <td className="p-1.5 text-center text-zinc-400">[ ] OK</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-3 border-t border-zinc-300 flex justify-between text-xs text-zinc-600">
                <div>Total Jerseys: {activePrintOrder.players.length} pcs</div>
                <div>Print Operator Signature: _____________________</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActivePrintOrder(null)}
                className="px-4 py-2 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Master Roster Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
