import { violatesConstraints, shouldUseDoublePeriod, assignToSlot, isValidDoublePeriod } from './autoScheduleUtils';

// scheduleTiengAnh.js
export const scheduleTiengAnh_TG = ({
  gvList = [],
  newTkb,
  globalSchedule,
  phanCongGVs,
  assignments,
  gvSummary,
  days
}) => {
  // 1) Fill trực tiếp cho từng GV (đôi -> đơn -> trySwapAndAssign)
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tiếng Anh")) continue;
    const lopList = assignments[gv.id]?.["Tiếng Anh"] || [];
    if (!lopList.length) continue;

    // build remainingMap từ phanCongGVs (số tiết cần xếp cho mỗi lớp)
    const remainingMap = {};
    lopList.forEach(lop => {
      remainingMap[lop] = phanCongGVs[gv.id]?.["Tiếng Anh"]?.[lop] || 0;
    });

    //const totalAssigned = Object.values(phanCongGVs[gv.id]?.["Tiếng Anh"] || {}).reduce((a, b) => a + b, 0);
    //const allowedSessions = totalAssigned < 20 ? ["afternoon"] : ["afternoon", "morning"];
    const allowedSessions = ["morning", "afternoon"];

    // lặp tối đa để cố gắng xếp các lớp (tránh infinite loop)
    let loopCount = 0;
    const MAX_LOOP = 10;
    while (Object.values(remainingMap).some(r => r > 0) && loopCount < MAX_LOOP) {
      loopCount++;
      fillSessionForGV({
        gv,
        lopList,
        remainingMap,
        tkb: newTkb,
        globalSchedule,
        assignments,
        teachers: gvList,
        days,
        allowedSessions
      });
    }

    // ghi nhận còn thiếu
    if (!gvSummary[gv.id]) gvSummary[gv.id] = gvSummary[gv.id] || { assigned: 0, failedLops: [] };
    recordRemaining({ gv, remainingMap, gvSummary });
  }

  // 2) Vòng hoán đổi nâng cao toàn cục: lặp cho đến khi không thể tiến triển thêm
  let overallProgress = true;
  while (overallProgress) {
    overallProgress = false;
    for (const gv of gvList) {
      if (!gv.monDay.includes("Tiếng Anh")) continue;
      if (!gvSummary[gv.id]?.failedLops || gvSummary[gv.id].failedLops.length === 0) continue;

      const didProgress = performAdvancedSwapsForGV({
        gv,
        tkb: newTkb,
        globalSchedule,
        assignments,
        teachers: gvList,
        days,
        gvSummary
      });
      if (didProgress) overallProgress = true;
    }
  }
  // Kết thúc: newTkb và globalSchedule đã được cập nhật; gvSummary chứa failedLops nếu còn
};

export const countClassInDay = (tkb, gvId, day, className, subject = "Tiếng Anh") => {
  const dayObj = tkb[gvId]?.[day];
  if (!dayObj) return 0;
  return [...(dayObj.morning || []), ...(dayObj.afternoon || [])]
    .filter(t => t && t.subject === subject && t.class === className).length;
};

// Thử gán tiết đôi tại vị trí (day, session, period) cho gvId; trả về true nếu thành công
export const tryPlaceDoubleAt = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lop,
  subject = "Tiếng Anh",
  assignments,
  teachers
}) => {
  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (period < 0 || period >= sessionArray.length - 1) return false;
  if (sessionArray[period] || sessionArray[period + 1]) return false;

  // Kiểm tra ràng buộc cho cả 2 vị trí
  if (violatesConstraints({ day, session, period, mon: subject, lop, gv: { id: gvId }, tkb })) return false;
  if (violatesConstraints({ day, session, period: period + 1, mon: subject, lop, gv: { id: gvId }, tkb })) return false;

  // Kiểm tra giới hạn 2 tiết/ngày cho lớp
  const countInDay = countClassInDay(tkb, gvId, day, lop, subject);
  if (countInDay + 2 > 2) return false;

  const ok = assignToSlot(tkb, globalSchedule, gvId, lop, subject, { day, session, period }, true, assignments, teachers);
  return !!ok;
};

// Thử gán tiết đơn tại vị trí (day, session, period) cho gvId; trả về true nếu thành công
export const tryPlaceSingleAt = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lop,
  subject = "Tiếng Anh",
  assignments,
  teachers
}) => {
  const sessionArray = tkb[gvId]?.[day]?.[session];
  if (!Array.isArray(sessionArray)) return false;
  if (period < 0 || period >= sessionArray.length) return false;
  if (sessionArray[period]) return false;

  if (violatesConstraints({ day, session, period, mon: subject, lop, gv: { id: gvId }, tkb })) return false;
  const countInDay = countClassInDay(tkb, gvId, day, lop, subject);
  if (countInDay + 1 > 2) return false;

  const ok = assignToSlot(tkb, globalSchedule, gvId, lop, subject, { day, session, period }, false, assignments, teachers);
  return !!ok;
};

// Gán trực tiếp (đôi ưu tiên → đơn) cho một GV trong 1 buổi (sessionArray)
export const fillSessionForGV = ({
  gv,
  lopList,
  remainingMap,
  tkb,
  globalSchedule,
  assignments,
  teachers,
  days,
  allowedSessions
}) => {
  const gvId = gv.id;

  const availableDays = days.filter(day => {
    const off = gv.offTimes?.[day];
    return !off || !off.morning || !off.afternoon;
  });

  for (const day of availableDays) {
    for (const session of allowedSessions) {
      if (gv.offTimes?.[day]?.[session]) {
        //console.log(`⛔ Buổi ${session} của ngày ${day} bị nghỉ`);
        continue;
      }

      const sessionArray = tkb[gvId]?.[day]?.[session];
      if (!Array.isArray(sessionArray)) {
        //console.log(`⚠️ Không có sessionArray tại ${day} - ${session}`);
        continue;
      }

      // 🔀 Xáo trộn lại danh sách lớp còn tiết
      const remainingLops = Object.entries(remainingMap)
        .filter(([lop, r]) => r > 0)
        .map(([lop]) => lop);
      const shuffledLops = [...remainingLops].sort(() => Math.random() - 0.5);

      for (const lop of shuffledLops) {
        let remaining = remainingMap[lop];
        if (remaining <= 0) continue;

        //console.log(`→ GV ${gvId} đang xét lớp ${lop}, ngày ${day}, buổi ${session}, còn lại ${remaining} tiết`);

        for (let i = 0; i < sessionArray.length; i++) {
          if (remaining <= 0) break;

          //console.log(`→ Kiểm tra slot ${i} tại ${day} - ${session}:`, sessionArray[i]);

          if (sessionArray[i]) {
            //console.log(`⛔ Slot ${i} đã bị chiếm`);
            continue;
          }

          const classCount = countClassInDay(tkb, gvId, day, lop);
          //console.log(`→ Số tiết lớp ${lop} đã xếp trong ngày ${day}:`, classCount);
          if (classCount >= 2) {
            //console.log(`⛔ Đã đủ 2 tiết trong ngày ${day} cho lớp ${lop}`);
            continue;
          }

          // Tiết đôi
          if (
            remaining >= 2 &&
            i < sessionArray.length - 1 &&
            !sessionArray[i + 1]
          ) {
            //console.log(`→ Thử xếp tiết đôi tại ${day} - ${session} - Tiết ${i}`);
            const placed = tryPlaceDoubleAt({
              tkb,
              globalSchedule,
              gvId,
              day,
              session,
              period: i,
              lop,
              assignments,
              teachers
            });
            //console.log(`→ Kết quả xếp tiết đôi:`, placed);
            if (placed) {
              //console.log(`✅ Xếp tiết đôi tại ${day} - ${session} - Tiết ${i} cho lớp ${lop}`);
              remainingMap[lop] -= 2;
              remaining -= 2;
              continue;
            }
          }

          // Tiết đơn
          const violates = violatesConstraints({
            day,
            session,
            period: i,
            mon: "Tiếng Anh",
            lop,
            gv: { id: gvId },
            tkb
          });
          //console.log(`→ Vi phạm ràng buộc tại ${day} - ${session} - Tiết ${i}:`, violates);
          if (violates) continue;

          //console.log(`→ Thử xếp tiết đơn tại ${day} - ${session} - Tiết ${i}`);
          const placed = tryPlaceSingleAt({
            tkb,
            globalSchedule,
            gvId,
            day,
            session,
            period: i,
            lop,
            assignments,
            teachers
          });
          ////console.log(`→ Kết quả xếp tiết đơn:`, placed);

          if (placed) {
            ////console.log(`✅ Xếp tiết đơn tại ${day} - ${session} - Tiết ${i} cho lớp ${lop}`);
            remainingMap[lop] -= 1;
            remaining -= 1;
            continue;
          }

          ////console.log(`🚫 Không thể xếp tại ${day} - ${session} - Tiết ${i}`);
        }
      }
    }
  }
};

// Sau khi fill trực tiếp, ghi nhận lớp còn thiếu vào gvSummary.failedLops
export const recordRemaining = ({ gv, remainingMap, gvSummary }) => {
  const gvId = gv.id;

  if (!gvSummary[gvId]) gvSummary[gvId] = {};
  if (!gvSummary[gvId].failedLops) gvSummary[gvId].failedLops = [];

  Object.entries(remainingMap).forEach(([lop, remaining]) => {
    if (remaining > 0) {
      const tag = `${lop} - Tiếng Anh`;
      if (!gvSummary[gvId].failedLops.includes(tag)) {
        gvSummary[gvId].failedLops.push(tag);
      }
    }
  });
};

// Thử hoán đổi 1 slot đã xếp với 1 slot trống (di chuyển 1 tiết) — trả true nếu thực hiện
// (sử dụng 2 điều kiện bạn đưa: 1) vị trí đang có slot có thể nhận lopMissing, 2) slot trống có thể nhận otherLop)
export const tryMoveOneSlot = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  period,
  lopMissing,
  days,
  allowedSessions,
  assignments,
  teachers,
  gvSummary
}) => {
  const sessionArray = tkb[gvId][day][session];
  if (!sessionArray) return false;
  const slot = sessionArray[period];
  if (!slot || slot.subject !== "Tiếng Anh") return false;
  const otherLop = slot.class;
  if (otherLop === lopMissing) return false;

  // scan tìm slot trống arr2[j] để chuyển otherLop sang
  for (const d2 of days) {
    for (const s2 of allowedSessions) {
      if (teachers.find(t => t.id === gvId).offTimes?.[d2]?.[s2]) continue;
      const arr2 = tkb[gvId][d2][s2];
      if (!Array.isArray(arr2)) continue;
      for (let j = 0; j < arr2.length; j++) {
        if (arr2[j]) continue; // cần trống
        // Điều kiện 1: đặt lopMissing vào vị trí (day,session,period)
        const canPlaceMissingHere = !violatesConstraints({ day, session, period, mon: "Tiếng Anh", lop: lopMissing, gv: { id: gvId }, tkb })
          && (countClassInDay(tkb, gvId, day, lopMissing) < 2);
        // Điều kiện 2: đặt otherLop vào arr2[j]
        const countOtherInD2 = countClassInDay(tkb, gvId, d2, otherLop);
        const canPlaceOtherThere = !violatesConstraints({ day: d2, session: s2, period: j, mon: "Tiếng Anh", lop: otherLop, gv: { id: gvId }, tkb })
          && (countOtherInD2 + (d2 === day ? 0 : 1) <= 2);

        if (canPlaceMissingHere && canPlaceOtherThere) {
          // thực hiện di chuyển 1 slot: otherLop -> arr2[j], lopMissing -> (day,session,period)
          arr2[j] = { subject: "Tiếng Anh", class: otherLop };
          sessionArray[period] = { subject: "Tiếng Anh", class: lopMissing };
          // cập nhật globalSchedule / assignments thông qua assignToSlot để giữ đồng bộ
          assignToSlot(tkb, globalSchedule, gvId, otherLop, "Tiếng Anh", { day: d2, session: s2, period: j }, false, assignments, teachers);
          assignToSlot(tkb, globalSchedule, gvId, lopMissing, "Tiếng Anh", { day, session, period }, false, assignments, teachers);
          // cập nhật gvSummary: +1 assigned cho lopMissing
          gvSummary[gvId].assigned += 1;
          // remove from failedLops by caller
          return true;
        }
      }
    }
  }
  return false;
};

// Thử xé một tiết của slot đôi (di chuyển 1 tiết) để cứu lopMissing.
// Trả true nếu thực hiện (một tiết được di chuyển ra, lopMissing được xếp vào vị trí vừa tạo)
export const trySplitDoubleAndMove = ({
  tkb,
  globalSchedule,
  gvId,
  day,
  session,
  i, // vị trí bắt đầu của double (sessionArray[i] có double = true, sessionArray[i+1].skip)
  lopMissing,
  days,
  allowedSessions,
  assignments,
  teachers,
  gvSummary
}) => {
  const sessionArray = tkb[gvId][day][session];
  if (!sessionArray) return false;
  const slotA = sessionArray[i];
  const slotB = sessionArray[i + 1];
  if (!slotA || !slotB) return false;
  if (!slotA.double || !slotB.skip) return false;
  const otherLop = slotA.class;
  if (otherLop === lopMissing) return false;

  // hai phương án: di chuyển phần sau (i+1) hoặc phần trước (i)
  // A) di chuyển phần sau (i+1) đi, đặt lopMissing vào i+1, giữ i là single otherLop
  const tryMovePart = (sourceIndexForMove, targetIndexForMissing) => {
    for (const d2 of days) {
      for (const s2 of allowedSessions) {
        if (teachers.find(t => t.id === gvId).offTimes?.[d2]?.[s2]) continue;
        const arr2 = tkb[gvId][d2][s2];
        if (!Array.isArray(arr2)) continue;
        for (let j = 0; j < arr2.length; j++) {
          if (arr2[j]) continue; // cần trống
          // can place lopMissing at targetIndexForMissing
          const canPlaceMissing = !violatesConstraints({ day, session, period: targetIndexForMissing, mon: "Tiếng Anh", lop: lopMissing, gv: { id: gvId }, tkb })
            && (countClassInDay(tkb, gvId, day, lopMissing) < 2);
          const countOtherInD2 = countClassInDay(tkb, gvId, d2, otherLop);
          const canPlaceOtherThere = !violatesConstraints({ day: d2, session: s2, period: j, mon: "Tiếng Anh", lop: otherLop, gv: { id: gvId }, tkb })
            && (countOtherInD2 + (d2 === day ? 0 : 1) <= 2);

          if (canPlaceMissing && canPlaceOtherThere) {
            // perform move
            arr2[j] = { subject: "Tiếng Anh", class: otherLop };
            // update the double -> become single + new single for missing
            if (sourceIndexForMove === i + 1) {
              // move back part (i+1); keep i as single otherLop, fill i+1 with missing
              sessionArray[i] = { subject: "Tiếng Anh", class: otherLop };
              sessionArray[i + 1] = { subject: "Tiếng Anh", class: lopMissing };
            } else {
              // move front (i); keep i+1 as single otherLop, fill i with missing
              sessionArray[i] = { subject: "Tiếng Anh", class: lopMissing };
              sessionArray[i + 1] = { subject: "Tiếng Anh", class: otherLop };
            }
            // sync via assignToSlot
            assignToSlot(tkb, globalSchedule, gvId, otherLop, "Tiếng Anh", { day: d2, session: s2, period: j }, false, assignments, teachers);
            assignToSlot(tkb, globalSchedule, gvId, lopMissing, "Tiếng Anh", { day, session, period: (sourceIndexForMove === i + 1 ? i + 1 : i) }, false, assignments, teachers);

            gvSummary[gvId].assigned += 1;
            return true;
          }
        }
      }
    }
    return false;
  };

  // thử di chuyển phần sau rồi phần trước
  if (tryMovePart(i + 1, i + 1)) return true;
  if (tryMovePart(i, i)) return true;
  return false;
};

// Vòng hoán đổi nâng cao 2 tầng cho một GV — lặp liên tục cho đến khi không thể xử lý thêm
export const performAdvancedSwapsForGV = ({
  gv,
  tkb,
  globalSchedule,
  assignments,
  teachers,
  days,
  gvSummary
}) => {
  const gvId = gv.id;
  if (!gvSummary[gvId]?.failedLops || gvSummary[gvId].failedLops.length === 0) return false;
  //const allowedSessions = gvSummary[gvId].assigned < 20 ? ["afternoon"] : ["afternoon", "morning"];
  const allowedSessions = ["morning", "afternoon"];


  let progress = false;
  let progressThisGV = true;

  while (progressThisGV) {
    progressThisGV = false;

    // copy array to avoid mutation during iterate
    for (const lopStr of [...gvSummary[gvId].failedLops]) {
      const lopMissing = lopStr.split(" - ")[0];
      let resolved = false;

      outerDayLoop:
      for (const day of days) {
        for (const session of allowedSessions) {
          if (gv.offTimes?.[day]?.[session]) continue;
          const sessionArray = tkb[gvId][day][session];
          if (!Array.isArray(sessionArray)) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            const slot = sessionArray[i];
            if (!slot || slot.subject !== "Tiếng Anh" || slot.class === lopMissing || slot.skip) continue;

            // TH1: thử di chuyển 1 slot đơn
            const moved = tryMoveOneSlot({
              tkb, globalSchedule, gvId, day, session, period: i,
              lopMissing, days, allowedSessions, assignments, teachers, gvSummary
            });
            if (moved) {
              // remove lopMissing from failedLops
              gvSummary[gvId].failedLops = gvSummary[gvId].failedLops.filter(l => l !== lopStr);
              progressThisGV = true;
              progress = true;
              resolved = true;
              break outerDayLoop;
            }

            // TH2: nếu slot là double thì thử xé 1 tiết và di chuyển
            if (slot.double && sessionArray[i + 1] && sessionArray[i + 1].skip) {
              const splitMoved = trySplitDoubleAndMove({
                tkb, globalSchedule, gvId, day, session, i,
                lopMissing, days, allowedSessions, assignments, teachers, gvSummary
              });
              if (splitMoved) {
                gvSummary[gvId].failedLops = gvSummary[gvId].failedLops.filter(l => l !== lopStr);
                progressThisGV = true;
                progress = true;
                resolved = true;
                break outerDayLoop;
              }
            }
          } // end for i
          if (resolved) break;
        } // end for session
        if (resolved) break;
      } // end for day
    } // end for lopStr
  } // end while progressThisGV

  return progress;
};


//===========================================


export const finalFillMissingPeriods_TG = ({
  gvList = [],
  newTkb,
  globalSchedule,
  assignments,
  gvSummary,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tiếng Anh")) continue;

    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (failedLops.length === 0) continue;

    const allowedSessions = ["morning", "afternoon"];

    for (const lopStr of failedLops) {
      const lop = lopStr.split(" - ")[0];
      const totalNeeded = assignments[gv.id]?.["Tiếng Anh"]?.filter(l => l === lop).length || 0;
      let alreadyAssigned = [...days].reduce((sum, day) => {
        return sum + ["morning", "afternoon"].reduce((s, session) => {
          return s + newTkb[gv.id][day][session].filter(t => t?.subject === "Tiếng Anh" && t?.class === lop).length;
        }, 0);
      }, 0);

      let remaining = totalNeeded - alreadyAssigned;
      if (remaining <= 0) continue;

      for (const day of days) {
        for (const session of allowedSessions) {
          if (gv.offTimes?.[day]?.[session]) continue;
          const sessionArray = newTkb[gv.id][day][session];
          if (!sessionArray) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            if (remaining <= 0) break;

            const slot = sessionArray[i];

            // Nếu slot trống → xếp trực tiếp
            if (!slot) {
              const countInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                .filter(t => t?.subject === "Tiếng Anh" && t?.class === lop).length;
              if (countInDay >= 3) continue;

              if (!violatesConstraints({ day, session, period: i, mon: "Tiếng Anh", lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tiếng Anh", { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                remaining -= 1;
                continue;
              }
            }

            // Nếu slot là tiết đôi → xé đôi để xếp lớp còn thiếu
            if (slot?.subject === "Tiếng Anh" && slot?.double) {
              const skipSlot = sessionArray[i + 1];
              if (skipSlot?.skip) {
                sessionArray[i] = null;
                sessionArray[i + 1] = null;

                const countInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                  .filter(t => t?.subject === "Tiếng Anh" && t?.class === lop).length;
                if (countInDay >= 3) continue;

                if (!violatesConstraints({ day, session, period: i, mon: "Tiếng Anh", lop, gv, tkb: newTkb })) {
                  assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tiếng Anh", { day, session, period: i }, false, assignments, gvList);
                  gvSummary[gv.id].assigned += 1;
                  remaining -= 1;
                  continue;
                }
              }
            }

            // Nếu slot đã có lớp khác → thử hoán đổi
            if (slot?.subject === "Tiếng Anh" && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                for (const s2 of allowedSessions) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;
                  const arr2 = newTkb[gv.id][d2][s2];
                  if (!arr2) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (arr2[j]) continue;

                    const countOtherInDay = [...newTkb[gv.id][d2].morning, ...newTkb[gv.id][d2].afternoon]
                      .filter(t => t?.subject === "Tiếng Anh" && t?.class === otherLop).length;
                    if (countOtherInDay >= 3) continue;

                    if (!violatesConstraints({ day: d2, session: s2, period: j, mon: "Tiếng Anh", lop: otherLop, gv, tkb: newTkb })) {
                      arr2[j] = slot;
                      sessionArray[i] = null;

                      const countNewInDay = [...newTkb[gv.id][day].morning, ...newTkb[gv.id][day].afternoon]
                        .filter(t => t?.subject === "Tiếng Anh" && t?.class === lop).length;
                      if (countNewInDay >= 3) continue;

                      if (!violatesConstraints({ day, session, period: i, mon: "Tiếng Anh", lop, gv, tkb: newTkb })) {
                        assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tiếng Anh", { day, session, period: i }, false, assignments, gvList);
                        gvSummary[gv.id].assigned += 1;
                        remaining -= 1;
                        break;
                      }
                    }
                  }
                  if (remaining <= 0) break;
                }
                if (remaining <= 0) break;
              }
            }
          }
        }
      }

      // Nếu đã xếp đủ → xóa khỏi failedLops
      if (remaining <= 0) {
        gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
        //////console.log(`✅ Đã cứu lớp ${lop} bằng xếp bổ sung`);
      }
    }
  }
};

const trySwapAndAssign = ({
  gv,
  lop,
  day,
  session,
  period,
  newTkb,
  globalSchedule,
  assignments,
  gvList
}) => {
  const sessionArray = newTkb[gv.id][day][session];
  const slot = sessionArray[period];
  if (slot) return false;

  for (const d2 of Object.keys(newTkb[gv.id])) {
    for (const s2 of ["morning", "afternoon"]) {
      const arr2 = newTkb[gv.id][d2][s2];
      if (!arr2) continue;

      for (let k = 0; k < arr2.length; k++) {
        const current = arr2[k];
        if (!current || current.subject !== "Tiếng Anh" || current.class === lop) continue;

        // Kiểm tra nếu slot(i) có thể chứa current
        if (!violatesConstraints({ day, session, period, mon: "Tiếng Anh", lop: current.class, gv, tkb: newTkb })) {
          // Hoán đổi
          sessionArray[period] = current;
          arr2[k] = null;

          // Gán lớp mới vào slot(k)
          if (!violatesConstraints({ day: d2, session: s2, period: k, mon: "Tiếng Anh", lop, gv, tkb: newTkb })) {
            assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tiếng Anh", { day: d2, session: s2, period: k }, false, assignments, gvList);
            return true;
          }

          // Hoàn tác nếu không thể gán lớp mới
          arr2[k] = current;
          sessionArray[period] = null;
        }
      }
    }
  }
  return false;
};

const checkTietPerDay = ({ newTkb, gvList, days }) => {
  const violations = [];

  for (const gv of gvList) {
    for (const day of days) {
      const lopCount = {};

      for (const session of ["morning", "afternoon"]) {
        const arr = newTkb[gv.id][day][session];
        if (!arr) continue;

        for (const t of arr) {
          if (t?.subject === "Tiếng Anh") {
            lopCount[t.class] = (lopCount[t.class] || 0) + 1;
          }
        }
      }

      for (const lop in lopCount) {
        if (lopCount[lop] > 2) {
          violations.push({ gv: gv.id, lop, day, count: lopCount[lop] });
        }
      }
    }
  }

  return violations;
};

//=======================================

export const optimizeTiengAnhSchedule = ({
  newTkb,
  gvList,
  assignments,
  days
}) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tiếng Anh")) continue;

    const lopList = assignments[gv.id]?.["Tiếng Anh"] || [];

    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        if (gv.offTimes?.[day]?.[session]) continue;

        const sessionArray = newTkb[gv.id][day][session];
        if (!sessionArray) continue;

        // 🔹 Gom tiết đơn thành tiết đôi nếu cùng lớp và môn
        for (let i = 0; i < sessionArray.length - 1; i++) {
          const current = sessionArray[i];
          const next = sessionArray[i + 1];

          if (
            current &&
            next &&
            current.subject === "Tiếng Anh" &&
            next.subject === "Tiếng Anh" &&
            current.class === next.class
          ) {
            current.double = true;
            next.skip = true;
          }
        }

        // 🔹 Loại bỏ tiết đầu sáng Thứ 2 nếu có thể
        if (
          day === "Thứ 2" &&
          session === "morning" &&
          sessionArray[0]?.subject === "Tiếng Anh"
        ) {
          const moved = sessionArray.findIndex((t, idx) => idx > 0 && !t);
          if (moved !== -1) {
            sessionArray[moved] = sessionArray[0];
            sessionArray[0] = null;
          }
        }

        // 🔍 Kiểm tra tiết đôi có liền nhau không
        const hasDouble = sessionArray.some(t => t?.double);
        if (hasDouble && !isValidDoublePeriod(sessionArray)) {
          console.warn(`⚠️ GV ${gv.id} có tiết đôi không liền nhau ở ${day} ${session}`);
        }
      }
    }
  }

  // ✅ Kiểm tra vi phạm số tiết/ngày sau khi tối ưu
  const violations = checkTietPerDay({ newTkb, gvList, days });
  if (violations.length > 0) {
    //////console.log("⚠️ Các lớp bị xếp quá 2 tiết/ngày:");
    violations.forEach(v => {
      ////console.log(`- GV ${v.gv}, lớp ${v.lop}, ngày ${v.day}: ${v.count} tiết`);
    });
  } else {
    ////console.log("✅ Không có lớp nào bị xếp quá 2 tiết/ngày.");
  }
};


export const groupTiengAnhByClass = ({ newTkb, gvList, assignments, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tiếng Anh")) continue;

    const lopList = assignments[gv.id]?.["Tiếng Anh"] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue; // ✅ Bỏ qua nếu nghỉ

          const sessionArray = newTkb[gv.id][day][session];
          sessionArray.forEach((t, i) => {
            if (t?.subject === "Tiếng Anh" && t?.class === lop) {
              slots.push({ day, session, period: i });
            }
          });
        }
      }

      // 🔹 Gom tiết về giữa tuần nếu bị phân tán
      if (slots.length > 1) {
        const midDays = ["Thứ 3", "Thứ 4", "Thứ 5"];
        const targetDay = midDays.find(d => !slots.some(s => s.day === d));
        if (targetDay && !gv.offTimes?.[targetDay]?.["morning"]) {
          const targetSession = "morning";
          const sessionArray = newTkb[gv.id][targetDay][targetSession];
          const emptyIndex = sessionArray.findIndex(t => !t);
          if (emptyIndex !== -1) {
            const moved = slots[0];
            const movedSlot = newTkb[gv.id][moved.day][moved.session][moved.period];
            newTkb[gv.id][targetDay][targetSession][emptyIndex] = movedSlot;
            newTkb[gv.id][moved.day][moved.session][moved.period] = null;
          }
        }
      }
    }
  }
};

export const regroupTiengAnhSlots = ({ newTkb, gvList, assignments, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tiếng Anh")) continue;

    const lopList = assignments[gv.id]?.["Tiếng Anh"] || [];

    for (const lop of lopList) {
      const slots = [];

      for (const day of days) {
        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue; // ✅ Bỏ qua nếu nghỉ

          const sessionArray = newTkb[gv.id][day][session];
          sessionArray.forEach((t, i) => {
            if (t?.subject === "Tiếng Anh" && t?.class === lop) {
              slots.push({ day, session, period: i });
            }
          });
        }
      }

      // 🔹 Gom về Thứ 4 sáng nếu có thể
      const targetDay = "Thứ 4";
      const targetSession = "morning";
      if (slots.length >= 2 && !gv.offTimes?.[targetDay]?.[targetSession]) {
        const targetArray = newTkb[gv.id][targetDay][targetSession];
        let moved = 0;
        for (const slot of slots) {
          if (moved >= 2) break;
          const { day, session, period } = slot;
          const current = newTkb[gv.id][day][session][period];
          const emptyIndex = targetArray.findIndex(t => !t);
          if (emptyIndex !== -1) {
            targetArray[emptyIndex] = current;
            newTkb[gv.id][day][session][period] = null;
            moved++;
          }
        }
      }
    }
  }
};

export const splitDoublePeriodsIfNeeded = ({ newTkb, gvList, days }) => {
  for (const gv of gvList) {
    if (!gv.monDay.includes("Tiếng Anh")) continue;

    for (const day of days) {
      for (const session of ["morning", "afternoon"]) {
        if (gv.offTimes?.[day]?.[session]) {
          //console.log(`⛔ GV ${gv.id} nghỉ buổi ${session} ngày ${day}`);
          continue;
        }

        const sessionArray = newTkb[gv.id]?.[day]?.[session];
        if (!Array.isArray(sessionArray) || sessionArray.length < 2) {
          //console.log(`⛔ Không có sessionArray hợp lệ tại ${day} - ${session} của GV ${gv.id}`);
          continue;
        }

        const otherSession = session === "morning" ? "afternoon" : "morning";
        if (gv.offTimes?.[day]?.[otherSession]) {
          //console.log(`⛔ GV ${gv.id} nghỉ buổi ${otherSession} ngày ${day}`);
          continue;
        }

        const otherArray = newTkb[gv.id]?.[day]?.[otherSession];
        if (!Array.isArray(otherArray) || otherArray.length < 2) {
          //console.log(`⛔ Không có otherArray hợp lệ tại ${day} - ${otherSession} của GV ${gv.id}`);
          continue;
        }

        for (let i = 0; i < sessionArray.length - 1; i++) {
          const t1 = sessionArray[i];
          const t2 = sessionArray[i + 1];

          const isDouble = t1 && t2 &&
            t1.subject === "Tiếng Anh" &&
            t2.subject === "Tiếng Anh" &&
            t1.class === t2.class &&
            t1.double === true &&
            t2.skip === true;

          if (!isDouble) continue;

          const emptySlots = otherArray.filter(t => !t).length;
          if (emptySlots < 1) {
            //console.log(`⛔ Không đủ slot trống ở ${otherSession} ${day} để tách lớp ${t1.class}`);
            continue;
          }

          const movedSlot = { ...t2 };
          sessionArray[i].double = false;
          sessionArray[i + 1] = null;

          let placed = false;
          for (let j = 0; j < otherArray.length; j++) {
            if (!otherArray[j]) {
              otherArray[j] = movedSlot;
              placed = true;
              //console.log(`✅ Đã tách lớp ${movedSlot.class} từ ${session} sang ${otherSession} ngày ${day}, vị trí ${j}`);
              break;
            }
          }

          if (!placed) {
            //console.log(`⚠️ Không thể đặt lớp ${movedSlot.class} vào ${otherSession} ngày ${day} vì không tìm thấy slot trống`);
          }
        }
      }
    }
  }
};

export const resolveMissingTiengAnh_TG = ({
  newTkb,
  gvList,
  gvSummary,
  assignments,
  globalSchedule,
  days
}) => {
  for (const gv of gvList) {
    const failedLops = gvSummary[gv.id]?.failedLops || [];
    if (!failedLops.length) continue;

    for (const lopStr of failedLops) {
      const lop = lopStr.split(" - ")[0];
      let resolved = false;

      for (const day of days) {
        const morningArr = newTkb[gv.id][day]?.morning || [];
        const afternoonArr = newTkb[gv.id][day]?.afternoon || [];

        const morningSlots = morningArr.filter(t => t?.subject === "Tiếng Anh" && t?.class === lop);
        const afternoonSlots = afternoonArr.filter(t => t?.subject === "Tiếng Anh" && t?.class === lop);

        // 🔄 Gom tiết phân tán trong ngày về một buổi nếu có thể
        if (morningSlots.length > 0 && afternoonSlots.length > 0) {
          const targetSession = morningSlots.length <= afternoonSlots.length ? "morning" : "afternoon";
          const sourceSession = targetSession === "morning" ? "afternoon" : "morning";

          const sourceArray = newTkb[gv.id][day][sourceSession];
          const targetArray = newTkb[gv.id][day][targetSession];

          for (let i = 0; i < sourceArray.length; i++) {
            const slot = sourceArray[i];
            if (slot?.subject === "Tiếng Anh" && slot.class === lop) {
              const emptyIndex = targetArray.findIndex(t => !t);
              if (emptyIndex !== -1 && !gv.offTimes?.[day]?.[targetSession]) {
                targetArray[emptyIndex] = slot;
                sourceArray[i] = null;
                ////console.log(`🔄 Gom lớp ${lop} về buổi ${targetSession} ngày ${day}`);
              }
            }
          }
        }

        // 🔁 Nếu không thể gom, hoán đổi tiết sáng để lớp khác có tiết đôi, lớp này chuyển sang buổi khác
        if (morningSlots.length === 1 && afternoonSlots.length === 1) {
          const slotIndex = morningArr.findIndex(t => t?.subject === "Tiếng Anh" && t?.class === lop);
          if (slotIndex !== -1) {
            const originalSlot = morningArr[slotIndex];
            const candidateLops = assignments[gv.id]?.["Tiếng Anh"]?.filter(l => l !== lop) || [];
            let swapped = false;

            for (const candidate of candidateLops) {
              const hasAfternoon = afternoonArr.some(t => t?.subject === "Tiếng Anh" && t?.class === candidate);
              const alreadyInMorning = morningArr.some(t => t?.class === candidate);
              if (hasAfternoon && !alreadyInMorning) {
                morningArr[slotIndex] = { ...originalSlot, class: candidate };
                swapped = true;
                ////console.log(`🔁 Hoán đổi lớp ${lop} sáng ${day} thành lớp ${candidate} để tạo tiết đôi`);
                break;
              }
            }

            if (swapped) {
              const emptyIndex = afternoonArr.findIndex(t => !t);
              if (emptyIndex !== -1 && !gv.offTimes?.[day]?.afternoon) {
                afternoonArr[emptyIndex] = originalSlot;
                ////console.log(`📦 Chuyển lớp ${lop} sang chiều ${day} sau khi hoán đổi`);
              } else {
                for (const d2 of days) {
                  if (d2 === day) continue;
                  for (const s2 of ["morning", "afternoon"]) {
                    if (gv.offTimes?.[d2]?.[s2]) continue;
                    const arr2 = newTkb[gv.id][d2][s2];
                    const empty2 = arr2.findIndex(t => !t);
                    if (empty2 !== -1) {
                      arr2[empty2] = originalSlot;
                      ////console.log(`📦 Chuyển lớp ${lop} sang ${s2} ${d2} sau khi hoán đổi`);
                      break;
                    }
                  }
                }
              }
              morningArr[slotIndex] = null;
            }
          }
        }

        for (const session of ["morning", "afternoon"]) {
          if (gv.offTimes?.[day]?.[session]) continue;

          const sessionArray = newTkb[gv.id][day][session];
          if (!sessionArray) continue;

          for (let i = 0; i < sessionArray.length; i++) {
            const slot = sessionArray[i];

            // 🔹 Nếu slot trống → thử gán lớp thiếu vào
            if (!slot) {
              const countInDay = [...morningArr, ...afternoonArr]
                .filter(t => t?.subject === "Tiếng Anh" && t?.class === lop).length;
              if (countInDay >= 2) continue;

              if (!violatesConstraints({ day, session, period: i, mon: "Tiếng Anh", lop, gv, tkb: newTkb })) {
                assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tiếng Anh", { day, session, period: i }, false, assignments, gvList);
                gvSummary[gv.id].assigned += 1;
                gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
                resolved = true;
                break;
              }
            }

            // 🔁 Nếu slot đã có lớp khác → thử hoán đổi
            else if (slot.subject === "Tiếng Anh" && slot.class !== lop) {
              const otherLop = slot.class;

              for (const d2 of days) {
                for (const s2 of ["morning", "afternoon"]) {
                  if (gv.offTimes?.[d2]?.[s2]) continue;

                  const arr2 = newTkb[gv.id][d2][s2];
                  if (!arr2) continue;

                  for (let j = 0; j < arr2.length; j++) {
                    if (!arr2[j]) {
                      const countOtherInDay = [...newTkb[gv.id][d2].morning, ...newTkb[gv.id][d2].afternoon]
                        .filter(t => t?.subject === "Tiếng Anh" && t?.class === otherLop).length;
                      if (countOtherInDay >= 2) continue;

                      if (!violatesConstraints({ day: d2, session: s2, period: j, mon: "Tiếng Anh", lop: otherLop, gv, tkb: newTkb })) {
                        arr2[j] = slot;
                        sessionArray[i] = null;

                        const countNewInDay = [...morningArr, ...afternoonArr]
                          .filter(t => t?.subject === "Tiếng Anh" && t?.class === lop).length;
                        if (countNewInDay >= 2) continue;

                        if (!violatesConstraints({ day, session, period: i, mon: "Tiếng Anh", lop, gv, tkb: newTkb })) {
                          assignToSlot(newTkb, globalSchedule, gv.id, lop, "Tiếng Anh", { day, session, period: i }, false, assignments, gvList);
                          gvSummary[gv.id].assigned += 1;
                          gvSummary[gv.id].failedLops = gvSummary[gv.id].failedLops.filter(l => l !== lopStr);
                          resolved = true;
                          break;
                        }
                      }
                    }
                  }
                  if (resolved) break;
                }
                if (resolved) break;
              }
            }
            if (resolved) break;
          }
          if (resolved) break;
        }
        if (resolved) break;
      }
    }
  }
};

export const optimizeFullTiengAnhSchedule_TG = ({ newTkb, gvList, assignments, days }) => {
  //optimizeTiengAnhSchedule({ newTkb, gvList, assignments, days });
  //groupTiengAnhByClass({ newTkb, gvList, assignments, days });
  //regroupTiengAnhSlots({ newTkb, gvList, assignments, days });
  splitDoublePeriodsIfNeeded({ newTkb, gvList, days }); // 👈 thêm dòng này
};