import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { useSchedule } from "../contexts/ScheduleContext";
import { useOpenFile } from "../contexts/OpenFileContext";

// Chuyển Map hoặc object sang object thường
const mapToObject = (map) => {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map);
  if (typeof map === "object") return map;
  return {};
};

// Chuẩn hóa dữ liệu TKB
const normalizeTkbData = (tkbAllTeachers) => {
  const teachersObj = mapToObject(tkbAllTeachers);
  const tkbToSave = {};

  Object.entries(teachersObj).forEach(([key, value]) => {
    const teacherData = mapToObject(value);
    if (teacherData.morning || teacherData.afternoon) {
      const normalizeDay = (arr, len) => {
        const slots = Array(len).fill(null);
        if (Array.isArray(arr)) {
          arr.forEach((item) => {
            if (item?.period >= 1 && item.period <= len) {
              slots[item.period - 1] = item;
            }
          });
        }
        return slots;
      };
      tkbToSave[key] = {
        morning: normalizeDay(teacherData.morning, 5),
        afternoon: normalizeDay(teacherData.afternoon, 4),
      };
    }
  });

  return tkbToSave;
};

// ✅ Custom hook
export const useSaveTKB_Tudong = () => {
  const scheduleContext = useSchedule();
  const { setOpenFileName } = useOpenFile();

  const saveTKB = async (docId) => {
    const { tkbAllTeachers, setTkbAllTeachers, setCurrentDocId } = scheduleContext;

    if (!docId) return alert("⚠️ Tên tệp không hợp lệ!");
    if (!tkbAllTeachers || !Object.keys(mapToObject(tkbAllTeachers)).length)
      return alert("⚠️ Không có dữ liệu để lưu!");

    try {
      const tkbToSave = normalizeTkbData(tkbAllTeachers);

      if (!Object.keys(tkbToSave).length)
        return alert("⚠️ Không có dữ liệu hợp lệ để lưu!");

      const docRef = doc(collection(db, "TKB_GVBM"), docId);
      await setDoc(docRef, {
        tkb: tkbToSave,
        updatedAt: new Date().toISOString(),
      });

      setCurrentDocId(docId);
      setOpenFileName(docId);

      // ✅ Cập nhật context đúng kiểu
      setTkbAllTeachers((prev) => {
        const updated =
          prev instanceof Map
            ? new Map(prev)
            : new Map(Object.entries(prev));
        updated.set(docId, tkbToSave);
        return updated;
      });

      console.log(`✅ Đã lưu TKB: ${docId}`);
    } catch (err) {
      console.error("❌ Lỗi khi lưu TKB:", err);
      alert("❌ Lưu thất bại. Xem console để biết chi tiết.");
    }
  };

  return { saveTKB };
};