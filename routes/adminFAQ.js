const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { createNotification } = require("../utils/notificationService");
// FAQ 목록 조회
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, category, question, answer, createdAt
       FROM FAQs
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("FAQ 조회 오류:", err);
    res.status(500).json({ message: "FAQ 조회 실패" });
  }
});

// FAQ 등록
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  const adminId = req.user.id;
  const { question, answer } = req.body;

  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ message: "제목과 내용을 입력하세요." });
  }

  try {
    await pool.execute(
      `INSERT INTO FAQs (adminId, question, answer) VALUES (?, ?, ?)`,
      [adminId, question.trim(), answer.trim()]
    );

    // 🔔 관리자 알림 생성
    await createNotification(
      adminId,
      "faq_created",
      "FAQ가 등록되었습니다.",
      `질문: ${question}`
    );

    res.json({ message: "FAQ 등록 완료" });
  } catch (err) {
    console.error("FAQ 등록 오류:", err);
    res.status(500).json({ message: "FAQ 등록 실패" });
  }
});

// FAQ 수정
router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  const adminId = req.user.id;
  const { id } = req.params;
  const { question, answer } = req.body;

  try {
    await pool.execute(
      `UPDATE FAQs SET question = ?, answer = ? WHERE id = ?`,
      [question.trim(), answer.trim(), id]
    );

    // 🔔 수정 알림
    await createNotification(
      adminId,
      "faq_updated",
      "FAQ가 수정되었습니다.",
      `수정된 질문: ${question}`
    );

    res.json({ message: "FAQ 수정 완료" });
  } catch (err) {
    console.error("FAQ 수정 오류:", err);
    res.status(500).json({ message: "FAQ 수정 실패" });
  }
});


// FAQ 삭제
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.execute(`DELETE FROM FAQs WHERE id = ?`, [id]);
    res.json({ message: "FAQ 삭제 완료" });
  } catch (err) {
    console.error("FAQ 삭제 오류:", err);
    res.status(500).json({ message: "FAQ 삭제 실패" });
  }
});

module.exports = router;
