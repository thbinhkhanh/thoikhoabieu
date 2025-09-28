import { assignToSlot } from './autoScheduleUtils';

export const scheduleTinHoc = ({
  gvList,
  newTkb,
  globalSchedule,
  phanCongGVs,
  assignments,
  gvSummary,
  tinHocSlots,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tin học")) continue;

    const lopList = assignments[gv.id]?.["Tin học"] || [];

    for (const lop of lopList) {
      let remaining = phanCongGVs[gv.id]?.["Tin học"]?.[lop] || 0;
      const sessionOrder = ["afternoon", "morning"];

      // 🔹 Vòng xếp chính
      for (const day of days) {
        for (const session of sessionOrder) {
          if (remaining <= 0) break;

          // ❗ Kiểm tra nghỉ cả buổi
          if (gv.offTimes?.[day]?.[session] === true) continue;

          const sessionArray = newTkb[gv.id][day][session];
          if (!sessionArray) continue;

          for (let i = 0; i < sessionArray.length && remaining > 0; i++) {
            if (day === "Thứ 2" && session === "morning" && i === 0) continue;
            if (sessionArray[i]) continue;

            const countInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
              .filter(t => t?.subject === "Tin học" && t?.class === lop).length;
            if (countInDay >= 1) continue;

            assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tin học", { day, session, period: i }, false, assignments, gvList);
            tinHocSlots.add(`${gv.id}-${day}-${session}-${i}`);
            remaining--;
            gvSummary[gv.id].assigned++;
          }
        }
      }

      // 🔹 Vòng ép xếp nếu còn thiếu
      if (remaining > 0) {
        for (const day of days) {
          for (const session of sessionOrder) {
            if (gv.offTimes?.[day]?.[session] === true) continue;

            const sessionArray = newTkb[gv.id][day][session];
            if (!sessionArray) continue;

            for (let i = 0; i < sessionArray.length && remaining > 0; i++) {
              if (day === "Thứ 2" && session === "morning" && i === 0) continue;
              if (sessionArray[i]) continue;

              const countInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                .filter(t => t?.subject === "Tin học" && t?.class === lop).length;
              if (countInDay >= 1) continue;

              assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tin học", { day, session, period: i }, false, assignments, gvList);
              tinHocSlots.add(`${gv.id}-${day}-${session}-${i}`);
              remaining--;
              gvSummary[gv.id].assigned++;
            }
          }
        }
      }

      // 🔹 Nếu vẫn còn thiếu, ghi nhận lớp chưa xếp đủ
      if (remaining > 0) {
        gvSummary[gv.id].failedLops.push(lop);
      }
    }
  }
};

export const optimizeTinHocSchedule = ({ gvList, newTkb, tinHocSlots, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tin học")) continue;

    const slots = [];

    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        const periods = newTkb[gv.id][day][session];
        if (!periods) continue;

        for (let i = 0; i < periods.length; i++) {
          const slot = periods[i];
          if (slot?.subject === "Tin học") {
            slots.push({ day, session, period: i, class: slot.class });
          }
        }
      }
    }

    // Gom nhóm theo buổi chiều trước
    const grouped = groupSlots(slots, gv.offTimes, days);

    // Thử hoán đổi các tiết phân tán
    regroupSlots(newTkb, gv.id, grouped, gv.offTimes, tinHocSlots);
  }
};

const groupSlots = (slots, offTimes, days) => {
  const result = [];

  for (const day of days) {
    const afternoonSlots = slots.filter(s => s.day === day && s.session === "afternoon");
    if (afternoonSlots.length > 0 && offTimes?.[day]?.afternoon !== true) {
      result.push(...afternoonSlots);
    }
  }

  // Nếu chưa đủ, gom thêm sáng
  for (const day of days) {
    const morningSlots = slots.filter(s => s.day === day && s.session === "morning");
    if (morningSlots.length > 0 && offTimes?.[day]?.morning !== true) {
      result.push(...morningSlots);
    }
  }

  return result;
};

const regroupSlots = (newTkb, gvId, groupedSlots, offTimes, tinHocSlots) => {
  const maxPerClassPerDay = 1;

  // Gom theo lớp để xử lý từng lớp một
  const byClass = {};
  for (const slot of groupedSlots) {
    if (!byClass[slot.class]) byClass[slot.class] = [];
    byClass[slot.class].push(slot);
  }

  for (const lop in byClass) {
    const slots = byClass[lop];

    // Nếu lớp có nhiều tiết phân tán → gom về cùng ngày nếu có slot trống
    for (const slot of slots) {
      const { day: oldDay, session: oldSession, period: oldPeriod } = slot;

      for (const targetDay of Object.keys(newTkb[gvId])) {
        if (targetDay === oldDay) continue;

        for (const targetSession of ["afternoon", "morning"]) {
          if (offTimes?.[targetDay]?.[targetSession]) continue;

          const sessionArray = newTkb[gvId][targetDay][targetSession];
          if (!sessionArray) continue;

          // Kiểm tra lớp đã có tiết Tin học trong ngày đó chưa
          const countInDay = [...newTkb[gvId][targetDay].morning, ...newTkb[gvId][targetDay].afternoon]
            .filter(t => t?.subject === "Tin học" && t?.class === lop).length;
          if (countInDay >= maxPerClassPerDay) continue;

          // Tìm slot trống để hoán đổi
          for (let i = 0; i < sessionArray.length; i++) {
            if (targetDay === "Thứ 2" && targetSession === "morning" && i === 0) continue;
            if (sessionArray[i]) continue;

            // Thực hiện hoán đổi
            const oldSlot = newTkb[gvId][oldDay][oldSession][oldPeriod];
            newTkb[gvId][oldDay][oldSession][oldPeriod] = null;
            newTkb[gvId][targetDay][targetSession][i] = oldSlot;

            // Cập nhật tinHocSlots
            tinHocSlots.delete(`${gvId}-${oldDay}-${oldSession}-${oldPeriod}`);
            tinHocSlots.add(`${gvId}-${targetDay}-${targetSession}-${i}`);

            // Cập nhật slot đã gom
            slot.day = targetDay;
            slot.session = targetSession;
            slot.period = i;

            break;
          }

          // Nếu đã hoán đổi xong thì không cần xét thêm
          break;
        }
      }
    }
  }
};