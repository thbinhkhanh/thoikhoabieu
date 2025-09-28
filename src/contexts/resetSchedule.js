// resetSchedule.js
export const resetSchedule = (setters) => {
  const { setCurrentDocId } = setters;

  // ✅ Chỉ reset currentDocId
  setCurrentDocId(null);

  // ✅ Xóa localStorage cho currentDocId nếu cần
  localStorage.removeItem('currentDocId');
};
