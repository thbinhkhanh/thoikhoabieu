import { violatesConstraints, shouldUseDoublePeriod, assignToSlot } from './autoScheduleUtils';

// helper: khởi tạo đúng morning = 4, afternoon = 3
const ensureDaySession = (newTkb, gvId, day) => {
  if (!newTkb[gvId]) newTkb[gvId] = {};
  if (!newTkb[gvId][day]) {
    newTkb[gvId][day] = {
      morning: Array(4).fill(null),
      afternoon: Array(3).fill(null)
    };
  }
  if (!Array.isArray(newTkb[gvId][day].morning)) {
    newTkb[gvId][day].morning = Array(4).fill(null);
  }
  if (!Array.isArray(newTkb[gvId][day].afternoon)) {
    newTkb[gvId][day].afternoon = Array(3).fill(null);
  }
};

export const scheduleCongNghe = ({
  gvList = [],
  newTkb,
  globalSchedule,
  phanCongGVs,
  assignments,
  gvSummary,
  tinHocSlots
}) => {
  for (const gv of gvList) {
    if (!gv.monDay || !gv.monDay.includes("Công nghệ")) continue;
    const lopList = assignments[gv.id]?.["Công nghệ"] || [];

    for (const lop of [...lopList].sort(() => Math.random() - 0.5)) {
      let remaining = phanCongGVs[gv.id]?.["Công nghệ"]?.[lop] || 0;

      const priorityPlan = [
        { day: "Thứ 6", session: "afternoon" },
        { day: "Thứ 6", session: "morning" }
      ];

      for (const { day, session } of priorityPlan) {
        if (remaining <= 0) break;
        if (gv.offTimes?.[day]?.[session]) continue;

        ensureDaySession(newTkb, gv.id, day);
        const sessionArray = newTkb[gv.id][day][session];

        for (let i = 0; i < sessionArray.length && remaining > 0; i++) {
          if (sessionArray[i]) continue; // slot đã có tiết khác

          const violate = violatesConstraints({
            day,
            session,
            period: i,
            mon: "Công nghệ",
            lop,
            gv,
            tkb: newTkb
          });
          if (violate) continue;

          const double = shouldUseDoublePeriod({
            mon: "Công nghệ",
            remaining,
            period: i,
            sessionArray,
            day,
            lop,
            tkb: newTkb
          });

          const assigned = assignToSlot(
            newTkb,
            globalSchedule,
            gv.id,
            lop,
            "Công nghệ",
            { day, session, period: i },
            double,
            assignments,
            gvList
          );
          if (!assigned) continue;

          tinHocSlots.add(`${gv.id}-${day}-${session}-${i}`);
          if (!gvSummary[gv.id]) gvSummary[gv.id] = { assigned: 0, failedLops: [] };
          gvSummary[gv.id].assigned += double ? 2 : 1;
          remaining -= double ? 2 : 1;

          if (double) i++; // skip slot tiếp theo vì đã chiếm tiết đôi
        }
      }

      if (remaining > 0) {
        if (!gvSummary[gv.id]) gvSummary[gv.id] = { assigned: 0, failedLops: [] };
        gvSummary[gv.id].failedLops.push(lop);
      }
    }
  }
};
