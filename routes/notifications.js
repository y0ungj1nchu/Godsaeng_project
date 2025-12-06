// routes/notifications.js
const express = require("express");
const router = express.Router();
const {authMiddleware} = require("../middleware/auth");

const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require("../utils/notificationService");

// ================================
// 🔔 1. 내 알림 목록 조회
// ================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await getNotifications(userId);
    res.json(list);
  } catch (error) {
    console.error("알림 조회 오류:", error);
    res.status(500).json({ message: "알림 조회 실패" });
  }
});

// ================================
// 🔔 2. 특정 알림 읽음 처리
// ================================
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    await markAsRead(notificationId, userId);

    res.json({ message: "읽음 처리 완료" });
  } catch (error) {
    console.error("읽음 처리 실패:", error);
    res.status(500).json({ message: "읽음 처리 실패" });
  }
});

// ================================
// 🔔 3. 전체 읽음 처리
// ================================
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    await markAllAsRead(userId);

    res.json({ message: "전체 읽음 처리 완료" });
  } catch (error) {
    console.error("전체 읽음 오류:", error);
    res.status(500).json({ message: "전체 읽음 실패" });
  }
});

// ================================
// 🔔 4. 알림 삭제
// ================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    await deleteNotification(notificationId, userId);

    res.json({ message: "알림 삭제 완료" });
  } catch (error) {
    console.error("알림 삭제 오류:", error);
    res.status(500).json({ message: "알림 삭제 실패" });
  }
});

// ================================
// 🔔 (관리자/시스템) 알림 생성용 API (선택사항)
// ================================
// 예: /notifications/create → 관리자만 호출 가능
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { userId, type, title, message } = req.body;

    await createNotification(userId, type, title, message);

    res.json({ message: "알림 생성 완료" });
  } catch (error) {
    console.error("알림 생성 오류:", error);
    res.status(500).json({ message: "알림 생성 실패" });
  }
});

module.exports = router;
