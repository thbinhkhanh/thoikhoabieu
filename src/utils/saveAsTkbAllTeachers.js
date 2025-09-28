// src/hooks/useSaveAsTkbAllTeachers.jsx
import { useState } from "react";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { useSchedule } from "../contexts/ScheduleContext";
import { useOpenFile } from "../contexts/OpenFileContext";

// Chuyển Map hoặc object sang plain object
const mapToObject = (map) => {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map);
  if (typeof map === "object") return map;
  return {};
};

// Chuẩn hóa dữ liệu TKB để lưu, đảm bảo đúng số slot sáng/chiều
const normalizeTkbData = (tkbAllTeachers, openFileName) => {
  const teachersObj = mapToObject(tkbAllTeachers);
  const tkbToSave = {};

  console.log("🔍 Dữ liệu gốc trước chuẩn hóa:", JSON.parse(JSON.stringify(teachersObj)));

  // ✅ Gán lại period theo thứ tự mảng
  const normalizeDaySequential = (arr, len) => {
    const slots = Array(len).fill(null);
    if (Array.isArray(arr)) {
      arr.forEach((item, index) => {
        if (item && index < len) {
          slots[index] = { ...item, period: index + 1 };
        }
      });
    }
    return slots;
  };

  Object.entries(teachersObj).forEach(([key, value]) => {
    if (key === openFileName) return;

    const teacherData = mapToObject(value);

    if (openFileName === "TKB chưa lưu") {
      // ✅ Gán lại period cho từng buổi
      const normalizedDays = {};
      Object.entries(teacherData).forEach(([day, dayData]) => {
        const dayObj = mapToObject(dayData);
        const morning = normalizeDaySequential(dayObj.morning || [], 5);
        const afternoon = normalizeDaySequential(dayObj.afternoon || [], 4);
        normalizedDays[day] = { morning, afternoon };
      });
      tkbToSave[key] = normalizedDays;
      return;
    }

    // ✅ Trường hợp giáo viên trực tiếp (có morning/afternoon)
    if (teacherData.morning || teacherData.afternoon) {
      tkbToSave[key] = {
        morning: normalizeDaySequential(teacherData.morning || [], 5),
        afternoon: normalizeDaySequential(teacherData.afternoon || [], 4),
      };
      return;
    }

    // ✅ Trường hợp file đã lưu (nested theo ngày)
    const normalizedTeacherData = {};
    Object.entries(teacherData).forEach(([day, dayData]) => {
      const dayObj = mapToObject(dayData);
      const morning = normalizeDaySequential(dayObj.morning || [], 5);
      const afternoon = normalizeDaySequential(dayObj.afternoon || [], 4);
      normalizedTeacherData[day] = { morning, afternoon };
    });

    tkbToSave[key] = normalizedTeacherData;
  });

  console.log("✅ Dữ liệu sau chuẩn hóa:", JSON.parse(JSON.stringify(tkbToSave)));

  return tkbToSave;
};

export const useSaveAsTkbAllTeachers = () => {
  const { tkbAllTeachers, setTkbAllTeachers, setCurrentDocId } = useSchedule();
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  //const { setOpenFileName } = useOpenFile(); // 🔹 thêm dòng này
  const { openFileName, setOpenFileName } = useOpenFile();


  const saveAsTkbAllTeachers = async (docId) => {
    if (!docId || typeof docId !== "string") {
      alert("⚠️ Tên tệp không hợp lệ!");
      return;
    }

    if (!tkbAllTeachers || Object.keys(tkbAllTeachers).length === 0) {
      alert("⚠️ Không có dữ liệu để lưu!");
      return;
    }

    try {
      setSaving(true);
      setSaveProgress(0);

      let tkbToSave;

      if (openFileName === "TKB chưa lưu") {
        // 🔹 Chỉ lấy dữ liệu trong "TKB chưa lưu"
        const sourceTkb = tkbAllTeachers[openFileName];
        tkbToSave = normalizeTkbData(sourceTkb, openFileName);
      } else {
        // 🔹 Với file đã lưu thì truyền cả tkbAllTeachers
        tkbToSave = normalizeTkbData(tkbAllTeachers, openFileName);
      }

      if (!tkbToSave || Object.keys(tkbToSave).length === 0) {
        //console.warn("⚠️ Không có dữ liệu hợp lệ để lưu!");
        alert("⚠️ Không có dữ liệu hợp lệ để lưu!");
        return;
      }

      //console.log("✅ Dữ liệu sau chuẩn hóa:", tkbToSave);


      // Mô phỏng tiến trình lưu
      const steps = 3;
      for (let i = 1; i <= steps; i++) {
        await new Promise((res) => setTimeout(res, 200));
        setSaveProgress(Math.round((i / steps) * 100));
      }

      // Lưu vào Firestore
      const docRef = doc(collection(db, "TKB_GVBM"), docId);
      await setDoc(docRef, { tkb: tkbToSave, updatedAt: new Date() });

      // Đồng bộ context: gắn docId và ghi đè tkbAllTeachers
      setCurrentDocId(docId);
      setTkbAllTeachers({ [docId]: tkbToSave });
      // 🔹 Cập nhật tên file vừa lưu để hiển thị trên menu
      setOpenFileName(docId);

      //console.log(`✅ Đã lưu TKB và cập nhật context: ${docId}`);
    } catch (error) {
      console.error("❌ Lỗi khi lưu TKB:", error);
      alert("❌ Lưu thất bại. Xem console để biết chi tiết.");
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  return { saveAsTkbAllTeachers, saving, saveProgress };
};
