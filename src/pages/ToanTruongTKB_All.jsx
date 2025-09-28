import React, { useState, useEffect } from 'react';
import { Box, Button, MenuItem, Select, Typography, Paper, IconButton, LinearProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { getDocs, collection, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

export default function XepTKBToanTruong() {
  const [teachers, setTeachers] = useState([]);
  const [tkb, setTkb] = useState({});
  const [assignments, setAssignments] = useState({});
  const [vietTatMon, setVietTatMon] = useState({});
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedMon, setSelectedMon] = useState({});

  const [isLoading, setIsLoading] = useState(true); // kiểm soát hiển thị toàn bộ

  useEffect(() => {
  const fetchAllData = async () => {
    setIsLoading(true);
    setLoadingProgress(0);

    const snapshot = await getDocs(collection(db, "PHANCONG_2025-2026"));
    const newAssignments = {};
    const newTeachers = [];
    const vtMon = {};
    const defaultMon = {};
    const newTkb = {};
    let loaded = 0;

    const promises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const hoTen = data.hoTen || '';
      const monDay = data.monDay || [];
      const phanCong = data.phanCong || {};

      newAssignments[id] = phanCong;
      newTeachers.push({ id, name: hoTen, monDay });

      monDay.forEach(mon => {
        vtMon[mon] = mon.split(' ').map(t => t[0]).join('').toUpperCase();
      });
      defaultMon[id] = monDay[0] || '';

      try {
        const docRef = doc(db, "TKB_GVBM_2025-2026", id);
        const docSnapTKB = await getDoc(docRef);
        if (docSnapTKB.exists()) {
          const rawSchedule = docSnapTKB.data().schedule || {};
          const defaultSubject = monDay.length === 1 ? monDay[0] : null;
          const schedule = {};

          ["SÁNG", "CHIỀU"].forEach((buoiKey) => {
            const time = buoiKey === "SÁNG" ? "morning" : "afternoon";
            const dayMap = rawSchedule[buoiKey];
            if (!dayMap || typeof dayMap !== "object") return;

            Object.entries(dayMap).forEach(([day, periodsArray]) => {
              if (!Array.isArray(periodsArray)) return;
              const validPeriods = periodsArray
                .map((value, index) => {
                  if (!value || value.trim() === "") return null;
                  const parsed = parsePeriod(value);
                  return parsed
                    ? { period: index + 1, class: parsed.class, subject: parsed.subject }
                    : { period: index + 1, class: value, subject: defaultSubject };
                })
                .filter(Boolean);

              if (validPeriods.length > 0) {
                if (!schedule[day]) schedule[day] = {};
                schedule[day][time] = validPeriods;
              }
            });
          });

          newTkb[id] = schedule;
        } else {
          newTkb[id] = {};
        }
      } catch (err) {
        console.error(`Lỗi khi lấy TKB của ${hoTen}:`, err);
        newTkb[id] = {};
      } finally {
        loaded += 1;
        setLoadingProgress(Math.round((loaded / snapshot.docs.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 100)); // giữ lại 100ms để tránh nhảy nhanh
      }
    });

    await Promise.all(promises);

    setAssignments(newAssignments);
    setTeachers(newTeachers);
    setVietTatMon(vtMon);
    setSelectedMon(defaultMon);
    setTkb(newTkb);
    setIsLoading(false); // ✅ đánh dấu đã tải xong
  };

  fetchAllData();
}, []);

  const handleAddPeriod = (gvId, day, session) => {
    setTkb(prev => {
      const updated = { ...prev };
      if (!updated[gvId]) updated[gvId] = {};
      if (!updated[gvId][day]) updated[gvId][day] = { morning: [], afternoon: [] };

      const current = updated[gvId][day][session] || [];
      const last = current[current.length - 1];
      const isLastIncomplete = last && (last.period === '' || last.class === '');
      if (isLastIncomplete) return updated;

      updated[gvId][day][session] = [
        ...current,
        { period: '', class: '', subject: selectedMon[gvId] || '' }
      ];
      return updated;
    });
  };

  const handleRemovePeriod = (gvId, day, session, index) => {
    setTkb(prev => {
      const updated = { ...prev };
      updated[gvId][day][session] = updated[gvId][day][session].filter((_, i) => i !== index);
      return updated;
    });
  };

  const handleChange = (gvId, day, session, index, field, value) => {
    setTkb(prev => {
      const updated = { ...prev };
      updated[gvId][day][session][index][field] = value;
      return updated;
    });
  };

const getTenGoi = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
};

const getPriorityLevel = (monDay = []) => {
  const normalized = monDay.map(mon => mon.trim());

  if (normalized.length === 1 && normalized[0] === 'Tiếng Anh') return 1;
  if (
    normalized.length === 1 && normalized[0] === 'Tin học' ||
    normalized.length === 2 &&
    normalized.includes('Tin học') &&
    normalized.includes('Công nghệ')
  ) return 2;
  if (normalized.length === 1 && normalized[0] === 'GDTC') return 3;
  if (normalized.length === 1 && normalized[0] === 'Âm nhạc') return 4;
  if (normalized.length === 1 && normalized[0] === 'Mĩ thuật') return 5;
  if (normalized.includes('Đạo đức')) return 6;
  return 7;
};

const sortTeachersBySubject = (teachers) => {
  return [...teachers].sort((a, b) => {
    const aLevel = getPriorityLevel(a.monDay);
    const bLevel = getPriorityLevel(b.monDay);

    if (aLevel !== bLevel) return aLevel - bLevel;

    const tenA = getTenGoi(a.name);
    const tenB = getTenGoi(b.name);
    return tenA.localeCompare(tenB, 'vi', { sensitivity: 'base' });
  });
};

function parsePeriod(str) {
  const match = str.match(/^(\d+\.\d+)\s+\((.+)\)$/);
  if (!match) return null;
  return { class: match[1], subject: match[2] };
}

function getPeriodsBySubject(schedule, mon) {
  return Object.values(schedule?.CHIỀU || {})
    .concat(...Object.values(schedule?.SÁNG || {}))
    .flat()
    .filter(Boolean)
    .map(str => {
      const match = str.match(/^(\d+\.\d+)\s+\((.+)\)$/);
      return match?.[2] === mon ? str : null;
    })
    .filter(Boolean);
}

  const getPeriodOptions = session => session === 'morning' ? [1,2,3,4,5] : [1,2,3,4];

  return (
  <Box sx={{ p: 2 }}>
    <Typography
      variant="h5"
      align="center"
      fontWeight="bold"
      gutterBottom
      sx={{ color: "#1976d2" }}
    >
      THỜI KHÓA BIỂU TOÀN TRƯỜNG 2025-2026
    </Typography>

    {isLoading && (
      <Box sx={{ width: '20%', mx: 'auto', mt: 2, mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={loadingProgress}
          sx={{ height: 4, borderRadius: 4 }}
        />
        <Typography variant="body2" align="center" sx={{ mt: 0.5 }}>
          {`Đang tải dữ liệu: ${loadingProgress}%`}
        </Typography>
      </Box>
    )}

    {sortTeachersBySubject(teachers).map(gv => (
      <Paper key={gv.id} sx={{ mb: 3, p: 2 }}>
        <Typography variant="h7" sx={{ fontWeight: 'bold', mt: 0 }}>{gv.name}</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 2, mt: 2 }}>
          {days.map(day => (
            <Box key={day} sx={{ border: '1px solid #ccc', p: 1, borderRadius: 1 }}>
              <Typography
                variant="subtitle2"
                align="center"
                sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  textTransform: 'uppercase',
                  color: '#1976d2'
                }}
              >
                {day}
              </Typography>

              {/* Buổi sáng */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                    Buổi sáng
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleAddPeriod(gv.id, day, 'morning')}
                    sx={{ color: '#1976d2' }}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>

                {tkb[gv.id]?.[day]?.morning?.map((p, idx) => {
                  if (!p.subject && gv.monDay.length > 0) {
                    p.subject = gv.monDay[0];
                  }

                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        gap: 1,
                        mb: 0.5,
                        position: 'relative',
                        '&:hover .delete-icon': {
                          visibility: 'visible'
                        }
                      }}
                    >
                      <Select
                        size="small"
                        value={p.period}
                        onChange={e => handleChange(gv.id, day, 'morning', idx, 'period', e.target.value)}
                        sx={{ minWidth: 40 }}
                      >
                        {getPeriodOptions('morning').map(n => (
                          <MenuItem key={n} value={n}>{n}</MenuItem>
                        ))}
                      </Select>

                      <Select
                        size="small"
                        value={p.class}
                        onChange={e => handleChange(gv.id, day, 'morning', idx, 'class', e.target.value)}
                        sx={{ minWidth: 70 }}
                      >
                        {(gv.monDay || [])
                          .flatMap(mon => {
                            const fromAssignments = assignments[gv.id]?.[mon] || [];

                            const fromSchedule = Object.values(gv.schedule?.SÁNG || {})
                              .concat(...Object.values(gv.schedule?.CHIỀU || {}))
                              .flat()
                              .filter(str => str)
                              .map(str => {
                                const match = str.match(/^(\d+\.\d+)\s+\((.+)\)$/);
                                return match?.[2] === mon ? match[1] : null;
                              })
                              .filter(Boolean);

                            const allClasses = Array.from(new Set([...fromAssignments, ...fromSchedule]));
                            return allClasses.map(c => [c, mon]);
                          })
                          .map(([c, mon]) => (
                            gv.monDay.length > 1
                              ? <MenuItem key={`${c}-${mon}`} value={c}>{c} ({vietTatMon[mon]})</MenuItem>
                              : <MenuItem key={c} value={c}>{c}</MenuItem>
                          ))}
                      </Select>

                      <Select
                        size="small"
                        value={p.subject}
                        onChange={e => handleChange(gv.id, day, 'morning', idx, 'subject', e.target.value)}
                        sx={{ minWidth: 80, display: 'none' }} // Ẩn khỏi UI
                      >
                        {gv.monDay.map(mon => (
                          <MenuItem key={mon} value={mon}>{mon}</MenuItem>
                        ))}
                      </Select>

                      <IconButton
                        size="small"
                        onClick={() => handleRemovePeriod(gv.id, day, 'morning', idx)}
                        className="delete-icon"
                        sx={{
                          color: 'red',
                          visibility: 'hidden',
                          position: 'absolute',
                          right: 0
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>

              {/* Buổi chiều */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                    Buổi chiều
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleAddPeriod(gv.id, day, 'afternoon')}
                    sx={{ color: '#1976d2' }}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>

                {tkb[gv.id]?.[day]?.afternoon?.map((p, idx) => {
                  if (!p.subject && gv.monDay.length > 0) {
                    p.subject = gv.monDay[0];
                  }

                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        gap: 1,
                        mb: 0.5,
                        position: 'relative',
                        '&:hover .delete-icon': {
                          visibility: 'visible'
                        }
                      }}
                    >
                      <Select
                        size="small"
                        value={p.period}
                        onChange={e => handleChange(gv.id, day, 'afternoon', idx, 'period', e.target.value)}
                        sx={{ minWidth: 40 }}
                      >
                        {getPeriodOptions('afternoon').map(n => (
                          <MenuItem key={n} value={n}>{n}</MenuItem>
                        ))}
                      </Select>

                      <Select
                        size="small"
                        value={p.class}
                        onChange={e => handleChange(gv.id, day, 'afternoon', idx, 'class', e.target.value)}
                        sx={{ minWidth: 70 }}
                      >
                        {(gv.monDay || [])
                          .flatMap(mon => (assignments[gv.id]?.[mon] || []).map(c => [c, mon]))
                          .map(([c, mon]) => (
                            gv.monDay.length > 1
                              ? <MenuItem key={c} value={c}>{c} ({vietTatMon[mon]})</MenuItem>
                              : <MenuItem key={c} value={c}>{c}</MenuItem>
                          ))}
                      </Select>

                      <Select
                        size="small"
                        value={p.subject}
                        onChange={e => handleChange(gv.id, day, 'afternoon', idx, 'subject', e.target.value)}
                        sx={{ minWidth: 80, display: 'none' }} // Ẩn khỏi giao diện
                      >
                        {gv.monDay.map(mon => (
                          <MenuItem key={mon} value={mon}>{mon}</MenuItem>
                        ))}
                      </Select>

                      <IconButton
                        size="small"
                        onClick={() => handleRemovePeriod(gv.id, day, 'afternoon', idx)}
                        className="delete-icon"
                        sx={{
                          color: 'red',
                          visibility: 'hidden',
                          position: 'absolute',
                          right: 0
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    ))}
  </Box>
);
}