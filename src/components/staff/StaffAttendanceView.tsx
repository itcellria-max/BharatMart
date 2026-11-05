import React, { useState, useEffect } from 'react';
import { UserCheck, Clock, Calendar, Check, X, UserPlus, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.ts';
import { Staff, StaffAttendance } from '../../types/index.ts';

export const StaffAttendanceView: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'directory'>('attendance');

  const loadData = async () => {
    try {
      const [stf, att] = await Promise.all([api.getStaff(), api.getTodayAttendance()]);
      setStaffList(stf);
      setAttendance(att);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkAttendance = async (staff: Staff, status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE') => {
    try {
      await api.recordAttendance({
        staffId: staff.id,
        staffName: staff.name,
        status,
        inTime: status === 'PRESENT' || status === 'HALF_DAY' ? '09:00' : null,
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Staff Management & Daily Attendance Roster</h2>
          <p className="text-xs text-slate-400 mt-0.5">Cashiers, supervisors, storekeepers, and attendance records</p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'attendance' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-400" />
          Today's Attendance ({attendance.filter((a) => a.status === 'PRESENT').length} Present)
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'directory' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4 text-sky-400" />
          Employee Directory ({staffList.length})
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Employee Code & Name</th>
                <th className="px-3 py-3">Designation / Role</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Punch In</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-center">Mark Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {staffList.map((s) => {
                const record: any = attendance.find((a: any) => a.staff_id === s.id || a.staffId === s.id);
                const status = record?.status || 'PRESENT';

                return (
                  <tr key={s.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{s.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{s.employeeCode || (s as any).employee_code}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{s.designation}</td>
                    <td className="px-3 py-3 text-slate-400">{s.department}</td>
                    <td className="px-3 py-3 font-mono text-slate-300">{record?.in_time || record?.inTime || '09:00 AM'}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          status === 'PRESENT'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : status === 'HALF_DAY'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleMarkAttendance(s, 'PRESENT')}
                          className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/60 rounded text-[11px]"
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleMarkAttendance(s, 'HALF_DAY')}
                          className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-400 border border-amber-800/60 rounded text-[11px]"
                        >
                          Half Day
                        </button>
                        <button
                          onClick={() => handleMarkAttendance(s, 'ABSENT')}
                          className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-800/60 rounded text-[11px]"
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {staffList.map((s) => (
            <div key={s.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-sm">{s.name}</h4>
                  <p className="text-xs text-slate-400">{s.designation}</p>
                </div>
                <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-emerald-400">
                  {s.employeeCode || (s as any).employee_code}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>Department: {s.department}</p>
                <p>Phone: {s.phone}</p>
                <p>Monthly Salary: ₹{s.salary.toLocaleString('en-IN')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
