// src/utils/ThongKe.js

/**
 * Tính tổng số tiết, số tiết đã xếp và các lớp còn thiếu cho từng giáo viên
 * @param {Object} tkbData - Dữ liệu thời khóa biểu { gvId: { day: { morning: [], afternoon: [] } } }
 * @param {Array} teachersList - Danh sách giáo viên [{ id, name, monDay, ... }]
 * @param {Object} assignmentsMap - Bản đồ phân công { gvId: { mon: [lop1, lop2, ...] } }
 * @param {Object} phanCongMap - Số tiết cần dạy { gvId: { mon: { lop: soTiet } } }
 * @returns {Object} result - { gvId: { name, total, assigned, failedLops } }
 */
export function calculateGvSummaryFromTkb(tkbData, teachersList, assignmentsMap, phanCongMap) {
  const result = {};

  const normalize = str => (String(str || "").trim().toLowerCase());

  for (const gv of teachersList) {
    const gvId = gv.id;
    const planned = assignmentsMap[gvId] || {};       // { mon: [lop,...], ... }
    const phan = phanCongMap[gvId] || {};             // { mon: { lop: requiredCount } }

    let totalNeeded = 0;
    let assignedCount = 0;
    const assignedPerPair = {}; // key: "lop|mon_norm" -> count

    // 1) Tính tổng số tiết cần (dựa trên phanCongMap)
    for (const mon of Object.keys(planned)) {
      for (const lop of planned[mon]) {
        const need = Number(phan[mon]?.[lop] || 0);
        totalNeeded += need;
      }
    }

    // 2) Đếm số tiết thực tế đã xếp trong tkbData
    const gvTkb = tkbData?.[gvId] || {};
    for (const day of Object.keys(gvTkb)) {
      for (const session of ["morning", "afternoon"]) {
        const arr = gvTkb[day]?.[session] || [];
        if (!Array.isArray(arr)) continue;
        arr.forEach(period => {
          if (!period || !period.class || !period.subject) return;
          const lop = String(period.class).trim();
          const mon = normalize(period.subject);
          const key = `${lop}|${mon}`;
          assignedPerPair[key] = (assignedPerPair[key] || 0) + 1;
          assignedCount += 1;
        });
      }
    }

    // 3) Phát hiện các lớp còn thiếu (failedLops)
    const failedLops = [];
    for (const mon of Object.keys(planned)) {
      const monNorm = normalize(mon);
      for (const lop of planned[mon]) {
        const need = Number(phan[mon]?.[lop] || 0);
        const got = assignedPerPair[`${lop}|${monNorm}`] || 0;
        if (got < need) {
          const missing = need - got;
          failedLops.push(missing === 1 ? lop : `${lop} x${missing}`);
        }
      }
    }

    result[gvId] = {
      name: gv.name || gvId,
      total: totalNeeded,
      assigned: assignedCount,
      failedLops
    };
  }

  return result;
}
