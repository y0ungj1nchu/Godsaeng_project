// routes/admin.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ----------------------------------------------------------------------
// 관리자 대시보드 API
// GET /api/admin/dashboard
// ----------------------------------------------------------------------
router.get("/dashboard", authMiddleware, adminOnly, async (req, res) => {
  try {
    // ================================
    // 1. 사용자 통계
    // ================================

    // 총 사용자 수
    const [userCountRows] = await pool.execute(
  "SELECT COUNT(*) AS totalUsers FROM Users WHERE role != 'ADMIN'"
);
    const totalUsers = userCountRows[0].totalUsers || 0;

    // 오늘 가입한 사용자 수
    const [newUserRows] = await pool.execute(
      "SELECT COUNT(*) AS newUsers FROM Users WHERE role != 'ADMIN' AND DATE(createdAt) = CURDATE()"
    );
    const newUsers = newUserRows[0].newUsers || 0;

    // 오늘 로그인 사용자 수 → 테이블에 lastLoginAt 없음
    // => 로그인 기록이 없으므로 0 처리
    const todayLogin = 0; 

    // ================================
    // 2. 미답변 / 답변완료 문의 목록
    // ================================

    const [inquiryRows] = await pool.execute(
      `
      SELECT 
        i.id,
        u.nickname AS name,
        i.title,
        i.status,
        DATE_FORMAT(i.createdAt, '%Y-%m-%d %H:%i') AS date
      FROM Inquiries i
      JOIN Users u ON i.userId = u.id
      ORDER BY i.createdAt DESC
      `
    );

    const unanswered = inquiryRows.filter((q) => q.status === "pending");
    const answered = inquiryRows.filter((q) => q.status === "answered");

    // ================================
    // 응답
    // ================================
    res.json({
      userStats: {
        totalUsers,
        todayLogin,
        newUsers,
      },
      inquiries: {
        unanswered,
        answered,
      },
    });

  } catch (err) {
    console.error("관리자 대시보드 API 오류:", err);
    res.status(500).json({ message: "관리자 대시보드 조회 오류" });
  }
});

module.exports = router;
