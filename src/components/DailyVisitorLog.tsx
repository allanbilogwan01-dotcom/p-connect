import { forwardRef } from 'react';
import { getVisitSessions, getVisitors, getPDLs, getSettings } from '@/lib/localStorage';
import { format } from 'date-fns';

interface DailyVisitorLogProps {
  date?: Date;
}

export const DailyVisitorLog = forwardRef<HTMLDivElement, DailyVisitorLogProps>(
  ({ date = new Date() }, ref) => {
    const settings = getSettings();
    const dateStr = format(date, 'yyyy-MM-dd');
    const sessions = getVisitSessions().filter(s => s.time_in.startsWith(dateStr));
    const visitors = getVisitors();
    const pdls = getPDLs();

    const getVisitorName = (id: string) => {
      const v = visitors.find(vis => vis.id === id);
      return v ? `${v.last_name}, ${v.first_name} ${v.middle_name || ''}`.trim() : 'Unknown';
    };

    const getPDLName = (id: string) => {
      const p = pdls.find(pdl => pdl.id === id);
      return p ? `${p.last_name}, ${p.first_name}` : 'Unknown';
    };

    const getPDLCode = (id: string) => {
      const p = pdls.find(pdl => pdl.id === id);
      return p?.pdl_code || '-';
    };

    const getVisitorCode = (id: string) => {
      const v = visitors.find(vis => vis.id === id);
      return v?.visitor_code || '-';
    };

    return (
      <div ref={ref} className="bg-white text-black p-8 min-w-[800px]" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase">{settings.facility_name}</h1>
          <h2 className="text-lg font-semibold">Daily Visitor Log</h2>
          <p className="text-sm mt-1">{format(date, 'MMMM dd, yyyy (EEEE)')}</p>
        </div>

        {/* Summary */}
        <div className="flex justify-between text-sm mb-4 border-b border-black pb-2">
          <span>Total Visits: <strong>{sessions.length}</strong></span>
          <span>Regular: <strong>{sessions.filter(s => s.visit_type === 'regular').length}</strong></span>
          <span>Conjugal: <strong>{sessions.filter(s => s.visit_type === 'conjugal').length}</strong></span>
          <span>Active: <strong>{sessions.filter(s => !s.time_out).length}</strong></span>
        </div>

        {/* Table */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-left w-8">#</th>
              <th className="border border-black p-2 text-left">Visitor Name</th>
              <th className="border border-black p-2 text-left w-24">Visitor ID</th>
              <th className="border border-black p-2 text-left">PDL Name</th>
              <th className="border border-black p-2 text-left w-24">PDL Code</th>
              <th className="border border-black p-2 text-center w-16">Type</th>
              <th className="border border-black p-2 text-center w-20">Time In</th>
              <th className="border border-black p-2 text-center w-20">Time Out</th>
              <th className="border border-black p-2 text-center w-20">Duration</th>
              <th className="border border-black p-2 text-left w-24">Signature</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-black p-4 text-center text-gray-500">
                  No visits recorded for this date
                </td>
              </tr>
            ) : (
              sessions.map((session, idx) => {
                const duration = session.time_out 
                  ? Math.round((new Date(session.time_out).getTime() - new Date(session.time_in).getTime()) / 60000)
                  : null;
                return (
                  <tr key={session.id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className="border border-black p-2">{idx + 1}</td>
                    <td className="border border-black p-2">{getVisitorName(session.visitor_id)}</td>
                    <td className="border border-black p-2 font-mono text-[10px]">{getVisitorCode(session.visitor_id)}</td>
                    <td className="border border-black p-2">{getPDLName(session.pdl_id)}</td>
                    <td className="border border-black p-2 font-mono text-[10px]">{getPDLCode(session.pdl_id)}</td>
                    <td className="border border-black p-2 text-center uppercase">{session.visit_type === 'conjugal' ? 'C' : 'R'}</td>
                    <td className="border border-black p-2 text-center">{format(new Date(session.time_in), 'HH:mm')}</td>
                    <td className="border border-black p-2 text-center">{session.time_out ? format(new Date(session.time_out), 'HH:mm') : '-'}</td>
                    <td className="border border-black p-2 text-center">{duration ? `${duration}m` : '-'}</td>
                    <td className="border border-black p-2"></td>
                  </tr>
                );
              })
            )}
            {/* Extra empty rows for manual entries */}
            {Array.from({ length: Math.max(0, 5 - sessions.length) }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td className="border border-black p-2 h-8">{sessions.length + idx + 1}</td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-8 flex justify-between text-sm">
          <div className="border-t border-black pt-2 w-48 text-center">
            <p className="font-semibold">Duty Officer</p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>Generated: {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
            <p>WatchGuard - Jail Visitation System</p>
          </div>
        </div>
      </div>
    );
  }
);

DailyVisitorLog.displayName = 'DailyVisitorLog';

export default DailyVisitorLog;
